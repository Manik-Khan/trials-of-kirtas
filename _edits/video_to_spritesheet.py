# -*- coding: utf-8 -*-
"""
video_to_spritesheet.py
=======================

Turns a chroma-keyed video into a game-ready sprite sheet + atlas JSON.

This is the packing step the Chromakey-video-to-image repo does NOT do.
It expects per-frame transparent PNGs (produced by chromakey_video2png.py)
and assembles them into a sheet with:

  - one ROW per animation (walk / attack / block / cast ...)
  - a FIXED cell size across the whole sheet (no per-frame jitter)
  - a STABLE anchor so the character doesn't wander inside its cell
  - alpha CLEANUP to kill stray keyed specks
  - optional horizontal MIRROR rows (with an optional protected region,
    e.g. to keep a shoulder companion from swapping sides)
  - an ATLAS JSON describing every frame rect (what a game engine reads)

Nothing here commits or pushes anything. It only reads keyed PNGs and
writes a sheet + json to the output folder.

------------------------------------------------------------------------
CONFIG (actions.json)
------------------------------------------------------------------------
{
  "frames_glob": "frames3/*_HSV_0.png",   # keyed PNGs, sorted = frame order
  "cell": {"mode": "auto", "pad": 8, "max_width": 220},
  "anchor": "bottom_center",              # bottom_center | centroid | union | tight
  "cleanup": {"alpha_thresh": 40, "min_area_frac": 0.02},
  "animations": [
    {"name": "walk",   "start": 0,   "end": 95,  "count": 10},
    {"name": "attack", "start": 96,  "end": 155, "count": 8},
    {"name": "walk_R", "start": 0,   "end": 95,  "count": 10,
     "mirror": true,
     "protect_rect": [0.42, 0.05, 0.28, 0.30]}   # x,y,w,h in cell fractions
  ]
}

Run:
  python video_to_spritesheet.py --config actions.json -o out/
"""

import os, json, argparse, glob
import cv2
import numpy as np


# ----------------------------------------------------------------------
# frame loading + alpha cleanup
# ----------------------------------------------------------------------
def load_frames(pattern):
    files = sorted(glob.glob(pattern))
    if not files:
        raise SystemExit(f"No frames matched: {pattern}")
    return files


def clean_alpha(rgba, alpha_thresh=40, min_area_frac=0.02):
    """Remove tiny keyed specks: keep connected components whose area is at
    least `min_area_frac` of the largest component. Returns a copy with the
    stray regions made fully transparent."""
    out = rgba.copy()
    alpha = out[:, :, 3]
    solid = (alpha > alpha_thresh).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if n <= 1:
        return out
    areas = stats[1:, cv2.CC_STAT_AREA]
    biggest = areas.max()
    keep = np.zeros_like(solid)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area_frac * biggest:
            keep[labels == i] = 1
    out[:, :, 3] = np.where(keep > 0, alpha, 0)
    return out


def content_bbox(rgba, alpha_thresh=40):
    ys, xs = np.where(rgba[:, :, 3] > alpha_thresh)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def centroid(rgba, alpha_thresh=40):
    ys, xs = np.where(rgba[:, :, 3] > alpha_thresh)
    if len(xs) == 0:
        return None
    return float(xs.mean()), float(ys.mean())


# ----------------------------------------------------------------------
# frame selection
# ----------------------------------------------------------------------
def sample_indices(start, end, count):
    start = max(0, start)
    if count <= 1:
        return [start]
    return [int(round(v)) for v in np.linspace(start, end, count)]


# ----------------------------------------------------------------------
# cell sizing
# ----------------------------------------------------------------------
def measure_cell(frame_paths, selected, anchor, alpha_thresh, min_area_frac, pad):
    """Return (cell_w, cell_h) and, for union anchor, the shared union rect."""
    max_w = max_h = 0
    ux0 = uy0 = 10**9
    ux1 = uy1 = -1
    for fi in selected:
        im = cv2.imread(frame_paths[fi], cv2.IMREAD_UNCHANGED)
        im = clean_alpha(im, alpha_thresh, min_area_frac)
        bb = content_bbox(im, alpha_thresh)
        if bb is None:
            continue
        x0, y0, x1, y1 = bb
        max_w = max(max_w, x1 - x0 + 1)
        max_h = max(max_h, y1 - y0 + 1)
        ux0, uy0 = min(ux0, x0), min(uy0, y0)
        ux1, uy1 = max(ux1, x1), max(uy1, y1)
    if anchor == "union":
        return (ux1 - ux0 + 1 + 2 * pad, uy1 - uy0 + 1 + 2 * pad), (ux0, uy0, ux1, uy1)
    return (max_w + 2 * pad, max_h + 2 * pad), None


def place_in_cell(rgba, cell_w, cell_h, anchor, alpha_thresh, pad, union_rect=None):
    """Return a cell_h x cell_w x 4 image with this frame's content placed
    according to the chosen anchor. Feet-planted (bottom_center) is the
    default and usually what you want for walk/attack cycles."""
    cell = np.zeros((cell_h, cell_w, 4), np.uint8)
    bb = content_bbox(rgba, alpha_thresh)
    if bb is None:
        return cell

    if anchor == "union" and union_rect is not None:
        x0, y0, x1, y1 = union_rect
    else:
        x0, y0, x1, y1 = bb
    patch = rgba[y0:y1 + 1, x0:x1 + 1]
    ph, pw = patch.shape[:2]

    if anchor == "bottom_center":
        px = cell_w // 2 - pw // 2
        py = cell_h - pad - ph
    elif anchor == "centroid":
        cx, cy = centroid(rgba, alpha_thresh)
        # offset so the centroid lands at cell center
        px = int(cell_w / 2 - (cx - x0))
        py = int(cell_h / 2 - (cy - y0))
    elif anchor == "union":
        px = cell_w // 2 - pw // 2
        py = cell_h // 2 - ph // 2
    else:  # tight
        px = pad
        py = pad

    px = max(0, min(px, cell_w - pw))
    py = max(0, min(py, cell_h - ph))
    cell[py:py + ph, px:px + pw] = patch
    return cell


def apply_mirror(cell, protect_rect=None):
    """Flip the cell horizontally. If protect_rect (x,y,w,h in [0,1]) is given,
    restore that region from the UN-flipped cell at the SAME screen position,
    so e.g. a shoulder companion keeps its place instead of swapping sides.
    This is a convenience approximation; a separate composited layer is the
    'correct' pipeline for a persistent asymmetric prop."""
    flipped = cv2.flip(cell, 1)
    if protect_rect is None:
        return flipped
    h, w = cell.shape[:2]
    x, y, rw, rh = protect_rect
    x0, y0 = int(x * w), int(y * h)
    x1, y1 = int((x + rw) * w), int((y + rh) * h)
    x0, x1 = max(0, x0), min(w, x1)
    y0, y1 = max(0, y0), min(h, y1)
    orig_patch = cell[y0:y1, x0:x1]
    # only overwrite where the original patch is actually opaque (keeps the
    # companion, leaves the flipped body showing around it)
    mask = orig_patch[:, :, 3:4] > 40
    region = flipped[y0:y1, x0:x1]
    flipped[y0:y1, x0:x1] = np.where(mask, orig_patch, region)
    return flipped


# ----------------------------------------------------------------------
# main build
# ----------------------------------------------------------------------
def build(config, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    paths = load_frames(config["frames_glob"])
    total = len(paths)

    anchor = config.get("anchor", "bottom_center")
    cl = config.get("cleanup", {})
    at = cl.get("alpha_thresh", 40)
    maf = cl.get("min_area_frac", 0.02)
    ccfg = config.get("cell", {})
    pad = ccfg.get("pad", 8)
    max_width = ccfg.get("max_width", None)

    anims = config["animations"]

    # ---- pass 1: figure out a single uniform cell size across ALL rows ----
    cell_w = cell_h = 0
    per_anim = []
    for a in anims:
        start = a["start"]
        end = min(a["end"], total - 1)
        sel = sample_indices(start, end, a["count"])
        (cw, ch), urect = measure_cell(paths, sel, anchor, at, maf, pad)
        per_anim.append({"sel": sel, "urect": urect})
        cell_w = max(cell_w, cw)
        cell_h = max(cell_h, ch)

    # optional downscale so the sheet is not enormous
    scale = 1.0
    if max_width and cell_w > max_width:
        scale = max_width / cell_w
    scaled_w = int(round(cell_w * scale))
    scaled_h = int(round(cell_h * scale))

    cols = max(a["count"] for a in anims)
    rows = len(anims)
    sheet = np.zeros((scaled_h * rows, scaled_w * cols, 4), np.uint8)

    atlas = {
        "sheet": None,
        "cell_w": scaled_w, "cell_h": scaled_h,
        "anchor": anchor,
        "animations": [],
    }

    # ---- pass 2: render every cell ----
    for r, (a, info) in enumerate(zip(anims, per_anim)):
        sel = info["sel"]
        urect = info["urect"]
        frames_meta = []
        for c, fi in enumerate(sel):
            im = cv2.imread(paths[fi], cv2.IMREAD_UNCHANGED)
            im = clean_alpha(im, at, maf)
            cell = place_in_cell(im, cell_w, cell_h, anchor, at, pad, urect)
            if a.get("mirror"):
                cell = apply_mirror(cell, a.get("protect_rect"))
            if scale != 1.0:
                cell = cv2.resize(cell, (scaled_w, scaled_h), interpolation=cv2.INTER_AREA)
            x, y = c * scaled_w, r * scaled_h
            sheet[y:y + scaled_h, x:x + scaled_w] = cell
            frames_meta.append({"col": c, "src_frame": int(fi),
                                "x": x, "y": y, "w": scaled_w, "h": scaled_h})
        atlas["animations"].append({
            "name": a["name"], "row": r,
            "frames": len(sel),
            "mirrored": bool(a.get("mirror", False)),
            "rects": frames_meta,
        })
        print(f"row {r}: {a['name']:10s} {len(sel):2d} frames  "
              f"(src {a['start']}-{min(a['end'], total-1)}"
              f"{'  MIRRORED' if a.get('mirror') else ''})")

    sheet_path = os.path.join(out_dir, "spritesheet.png")
    cv2.imwrite(sheet_path, sheet)
    atlas["sheet"] = os.path.basename(sheet_path)
    with open(os.path.join(out_dir, "atlas.json"), "w") as f:
        json.dump(atlas, f, indent=2)

    # a checkerboard preview so transparency is visible at a glance
    preview = checker_preview(sheet, scaled_w, scaled_h, cols, rows)
    cv2.imwrite(os.path.join(out_dir, "spritesheet_preview.png"), preview)

    print(f"\ncell {scaled_w}x{scaled_h}  grid {cols}x{rows}  sheet {sheet.shape[1]}x{sheet.shape[0]}")
    print(f"wrote {sheet_path}")
    print(f"wrote {os.path.join(out_dir,'atlas.json')}")
    print(f"wrote {os.path.join(out_dir,'spritesheet_preview.png')}")
    return sheet_path


def checker_preview(sheet, cw, ch, cols, rows, s=12):
    h, w = sheet.shape[:2]
    board = np.zeros((h, w, 3), np.uint8)
    for y in range(0, h, s):
        for x in range(0, w, s):
            board[y:y+s, x:x+s] = 210 if ((x//s + y//s) % 2 == 0) else 120
    a = sheet[:, :, 3:4].astype(float) / 255.0
    out = (sheet[:, :, :3].astype(float) * a + board.astype(float) * (1 - a)).astype(np.uint8)
    for c in range(1, cols):
        out[:, c*cw-1:c*cw+1] = (60, 60, 60)
    for r in range(1, rows):
        out[r*ch-1:r*ch+1, :] = (60, 60, 60)
    return out


def main():
    ap = argparse.ArgumentParser(description="Assemble keyed PNG frames into a sprite sheet + atlas.")
    ap.add_argument("--config", required=True, help="Path to actions.json")
    ap.add_argument("-o", "--output", required=True, help="Output folder")
    args = ap.parse_args()
    with open(args.config) as f:
        config = json.load(f)
    build(config, args.output)


if __name__ == "__main__":
    main()
