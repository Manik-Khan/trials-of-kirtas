# Trials of Kirtas — At-a-Glance Sheet + Appearance Engine (session handoff)

**Companion to the Soul Shards `CONTEXT.md`** — same stack, same `characters` table. The two threads meet at the **`structural` contract**: Soul Shards P7 *writes* `structural`; this sheet *renders* it. This session built (1) the visual direction for a new at-a-glance character sheet, (2) a player-customizable Appearance/theming engine, and (3) the data-binding that makes the sheet read live `characters` rows.

---

## Stack / working context (unchanged)
- Solo dev/DM **M**; `tok.manikkhan.com`; vanilla JS/HTML/CSS, Supabase (Postgres + Realtime + RLS), Netlify, GitHub `Manik-Khan/trials-of-kirtas`. **M commits + deploys manually; Claude never pushes.**
- Working rules: mock before code · approve before building · read source before editing · `node --check` all JS · never change a theme CSS var for a per-page issue (hardcode page overrides).
- `window.__tok.sb` = the Supabase client. **`CharacterData`** (`loadParty` / `loadCharacter` / `canEdit` / `save`) = the client read/write module. `public.characters` columns: `structural` / `vitals` / `inventory` / `equipment` / `currency` / `bio` / `notes`.

---

## 1. Visual direction — the at-a-glance sheet (mocks v1 → v10)
- **Target aesthetic:** *Metaphor: ReFantazio* (bold, distressed, torn red-paint swashes, high contrast) + a touch of *Studio Ghibli* watercolor warmth, pulled hard toward Metaphor. **Not** the old exploratory Phantom/cream theme.
- **Type:** Playfair Display (distressed titles) / EB Garamond (body) / Oswald (HUD + data labels).
- **Palette tokens** (live in the mock `:root`): `--ground #182826`, `--cream #ece2cd`, `--cream-dim #c2b99f`, `--cream-fnt #8d8675`, `--gold #c79a4a` / `--gold-br #e7c279`, `--red #cf3b2c` / `--red-br #e0584a`, `--frame rgba(199,154,74,.34)`, `--hair rgba(236,226,205,.13)`. **Origin colors:** class = gold, subclass = teal `#55c4c0`, species/race = red, feat = purple.
- **Layout:** an everything-visible "play view" dashboard that **complements** the immersive `party.html` menu sheet. Left column = combat medallions + Senses/Lore + Resources + Status + Notes; right column = Abilities, Skills, Spellcasting, Features, Equipment/Story. Info panels are translucent dark so any background harmonizes — this is what makes theming possible.
- **Subject (fixed across mocks for comparison):** Cosmere Runestar — Warlock 2 (The Hexblade) / Sorcerer 1 (Shadow Magic), Astral Elf, L3, Neutral Good.
- **Evolution:** v1 Ghibli → v2 Metaphor idiom → v3 embedded teal grunge bg → v4 header legibility + left dashboard → v5–v8 Appearance pane grows (live sliders → swatches → effects rack → **static Glitch slider** replacing the chroma checkbox) → **v9** restored hex + a Geometry shape layer (7 shapes) + a **Void** background → **v10** data-driven (see §3). **Final visual = v9; final functional = v10.**

---

## 2. Appearance / theming engine — DEPLOYABLE (4 client files + 1 SQL)
Per-player look, saved to `profiles.appearance` (jsonb). The engine injects a fixed background stack behind the page and applies a saved config.

- **`appearance-data.js`** — manifest (data only). `BG_PATH='/assets/backgrounds/'`; `BACKGROUNDS` (astral-teal / verdant / steel / shadow / ember / amber as files + **void** as a solid `#0a0e0d`); `SHAPES` (none/hex/triangles/diamonds/grid/dots/rings/crosses); `DEFAULT_APPEARANCE` (the saved-config shape). **Add a background = drop a file + one line.**
- **`appearance.js`** — ES-module engine. `initAppearance(supabase, uid)` (inject layers + load saved look) · `applyAppearance(cfg)` · `loadAppearance` / `saveAppearance` · `buildAppearancePanel(mount, {supabase, uid})` (renders the settings pane, wired live). Backgrounds load as file URLs; grain + weave textures are embedded (tiny). The 4 static Glitch filters + 7 geometry SVG patterns are injected automatically.
- **`appearance.css`** — styles the settings pane. Add `class="tok-appearance"` to the mount element (optional `tok-appearance--float` pins it top-right like the mock). Palette in `--ap-*` vars (self-contained; repoint to `theme.css` if desired). Includes the teal "Saved ✓" flash.
- **Controls:** Background swatches (7, incl. Void) · Color (bg hue/sat, accent hue) · Texture (grain, canvas weave, scanlines) · Geometry (shape picker + density + scale) · Lens (blur, vignette, **Glitch 0–4, static**).
- **Void = paint-on-black:** solid background drops the painterly image, so the geometry + texture overlays become the whole picture.
- **Perf (decided):** static filters on the fixed background rasterize once = **free during use**. Animated glitch is the costly kind → only ever a **brief triggered burst** (page load / damage), never always-on. Glitch shipped static-only.
- **Integration note:** the background layers use **negative z-index**, so the page body must be transparent (let these layers be the ground) — don't paint an opaque background over them.

---

## 3. Sheet data-binding — `sheet-data.js` + v10
- **`sheet-data.js`** — committable render module. `renderSheet(root, char)` fills the sheet from a `characters` row; `mountSheet(key, root)` pulls the row via `window.CharacterData.loadCharacter(key)` and renders. Reads documented **`structural`** (identity / abilities / combat / saves / skills / features) + **`vitals`** (hp / hpTemp / hpBonus / concentration / conditions) + `notes`.
- **Mechanism:** every value node carries `data-f="path"`; repeating sections carry `data-list="abilities|saves|skills|features|subline"` and are regenerated from arrays. v10 = v9 + these hooks; the hardcoded values stay as fallback content.
- **Proven:** v10 renders a sample Cosmere record in the exact `structural`/`vitals` shape — **46/46 jsdom parity smoke** (every rendered value matches hardcoded v9).
- **Live wiring = one line:** `import { mountSheet } from './sheet-data.js'; await mountSheet('cosmere');`
- **Wired this pass:** identity, combat medallions (AC, initiative, HP bar from vitals, speed, prof, spell DC/atk, hit dice), abilities, saves, all 18 skills, senses, status, features (origin-colored from each feature's `source`).
- **Deferred (next passes — each couples to other in-flight work):**
  - **Spellcasting** block — slot pools + spell lists w/ provenance. Couples to **Soul Shards P6**; the multiclass pact/sorcerer slot split is **not** in the documented `structural` shape yet.
  - **Resources** trackers — no `structural` source for custom limited-use trackers. Decide: derive from limited-use features, or add a small field.
  - **Equipment + Attunement** — the GEAR port (`inventory` / `equipment` / `currency`).
- **Assumption to verify:** `loadCharacter` resolves to the row with `.structural` / `.vitals` / `.notes` on it directly. If wrapped differently → a one-line change in `mountSheet`; everything downstream reads `char.structural` / `char.vitals`.
- **Multiclass:** documented `structural` carries a single `classLabel` / `subclass` / `hitDice`. The render reads an **optional `classes[]` array** to preserve Cosmere's two-class display, falling back to the single strings if absent. Confirm whether Soul Shards emits `classes[]` for multiclass PCs.

---

## Deliverables (all in `/mnt/user-data/outputs/`)
- **Sheet mocks:** `mockup-sheet-visual-direction-v1…v10.html` (v9 = final visual, v10 = data-driven).
- **Appearance:** `appearance-data.js`, `appearance.js`, `appearance.css`.
- **Sheet binding:** `sheet-data.js`.
- **Demo background assets** generated this arc (hue-rotated colorways + a weave tile): `bg_crimson/violet/amber/steel/green.webp`, `bg_weave.webp` — **demo only**; production needs curated finals at the manifest filenames (see Open items).

---

## Deploy (M commits/deploys manually)
- **Static files → repo**, alongside the other shared modules (same dir as `character-data.js` / `nav.js` / `theme.css`): `appearance-data.js`, `appearance.js`, `appearance.css`, `sheet-data.js`. **Nothing goes in `/functions`** — this stack's backend is Supabase (RLS + Postgres RPCs), not Netlify serverless. The export backstop (if it has a function) is unrelated and untouched.
- **Backgrounds → `/assets/backgrounds/`** as `astral-teal.webp`, `verdant.webp`, `steel.webp`, `shadow.webp`, `ember.webp`, `amber.webp` (the manifest names). Served by Netlify CDN.
- **One SQL (Supabase SQL editor, not the repo):**
  `alter table profiles add column if not exists appearance jsonb not null default '{}'::jsonb;`
  Existing per-user `profiles` RLS covers it; add the GRANTs to `anon` / `authenticated` / `service_role` if run as raw SQL. **No SQL for the sheet binding** (read-only).
- **Wire-up:** import `appearance.js` (call `initAppearance`) + `sheet-data.js` (call `mountSheet`) on the relevant page(s); give the settings-pane mount `class="tok-appearance"`.

---

## Open / next session
1. **Build order:** Spellcasting block (richest; provenance + loadout work lives here) vs. GEAR. M leaning?
2. **Create the 6 curated background `.webp`s** at the manifest filenames (mocks embed demo data-URIs; production needs real files in `/assets/backgrounds/`).
3. **Verify `loadCharacter` return shape** (`.structural` / `.vitals` / `.notes`) → confirm or patch `mountSheet`.
4. **Confirm Soul Shards multiclass `classes[]`** emission, or accept single-class strings.
5. **Resources trackers** — derive-from-features vs. a new field.
6. **Naming note:** `profiles.appearance` (per-account theming, this work) is **distinct from** `structural.appearance` (a character's physical-description field in the Soul Shards shape) — no collision, different tables.

---

## Working rules (reaffirmed)
mock before code · approve before build · read source before editing · `node --check` every JS · never change a theme var for a per-page issue (hardcode overrides) · **M commits/deploys, Claude never pushes.**
