# CONTEXT_Forge update · 2026-07-12g (fifth session — 12f verified on real main, then the ledge test's REAL blocker found and fixed)

Supersedes `CONTEXT_Forge-update-2026-07-12f.md` as the current session record; 12f's
content stands but was written before the real-repo verification and before the table
exposed the weapon-range gap.

## The 12f bundle did not apply to real main — and that was the system working

The uploaded rev-f patcher was fixture-verified in a container that couldn't reach
GitHub. Run against a fresh clone of actual `main @ 7cd067c`, it **aborted, writing
nothing** — three of its replacements assumed single-line compact formatting where the
repo has aligned multi-line code (the HP projection pair, the ForgeKit return fields),
and its `verdictFromEye` replacement silently dropped M's dated 2026-07-11 cover-ruling
comment. Repairs: both regexes now match the repo's actual byte shapes; the ruling
comment is restored verbatim. **Lesson, pinned in §7: a fixture "carrying the reviewed
code shapes" is not the repo. Patcher anchors are verified against a fresh clone of
main, or the guard aborting IS the verification you skipped.**

## Fixture authority — the kit-derive AC pins now derive from the party's real gear

`smoke-kit-derive.js` pinned cached `structural.combat.ac` over armorless fixture
inventories, so database character authority turned all four AC pins red. The nightly
`characters-export` (service-role, "a COMPLETE backup of the row," committed to
`data/characters/` — at most one night stale) supplied the real gear: Vesperian Scale
Mail + Shield, Cosmere Scale Mail + Shield (Hexblade medium armor), Líadan Leather,
Caim unarmored. The patcher's `patchKitFixtures()` step enriches the fixtures with it.
**All four pins keep their values — 18 / 16 / 18 / 12 — now derived instead of
cached.** Caim's fixture wis was corrected +2 → +3: its own feature text reads
"AC = 10 + DEX + WIS," so the old 16 pin was never reachable from its own abilities.

Ground truth at verification time: **all four live rows derive to exactly their cached
AC** — no live staleness in the party. Note: Líadan's current row is **Leather, AC
12**, self-consistent; the Scale-Mail-17 narrative in the 12e/12f docs does not
describe her current gear. Table checks expect what her row says, not 17.

## The table catch — "out of reach" was never the wall

M re-tested the ledge shot post-deploy and every goblin badged **⤢ out of reach**.
That is the **reach gate**, not geometry: `reachOK` melee-branches when the armed
action has `rng ≤ 1`, and the shot dies before `losVerdict` is ever consulted. The
bar's own hint confirmed it ("click a highlighted target" only renders for
`pending.rng ≤ 1`).

Root cause — a Bite-2 contract gap, predating 12f: `weapon-actions.js` was built for
the sheet's dice roller, which never needed range, so `assembleActions` emitted attack
actions with **no range field at all** — even though its own weapon table carries
`range: '80/320'` and even though `forge-kit-derive`'s tile builder already parses
`a.range` into squares. Every ranged weapon on the live-derivation path armed as
melee. Melee weapons worked by coincidence.

**Fix (deployed, `weapon-actions.js` +6):** `deck()` copies range onto the action for
`w.ranged` weapons — item data wins over the base table (magic bows) — **deliberately
ranged-only**, so a thrown melee weapon keeps its melee identity at the reach gate.
Verified: shortbow arms at 16/64 squares (80/320 ft); Longsword stays `rng 1`.

Known gaps left open by that deliberate scoping (§5): thrown-weapon ranged mode, reach
weapons (reach 10 ft → `rng 2` is unmodeled; §4's parser comment already anticipates
it), and the standing `cbDist` (Chebyshev) vs `TG.range3d` (Euclidean) divergence.

## Ledge geometry as ratified and shipped (12f, restated with the 12g refinements)

A shooter at a ledge may lean over an **immediately adjacent, target-facing wall**
whose top is below the shooter's eye. The lean requires a **shared cardinal edge**; at
an exact 45° shot both cardinal edges are candidates and **the diagonal cell is never
the ignored parapet**. The legal exception forgives **only the cell's added `occ`
height — its terrain stays solid**, so a shallow line clears a low cap while a steep
line still hits the earth berm beneath it (`losVerdict` probes and rejects an
alternate eye whose centre ray dies in the ignored cell's terrain). A wall at or above
eye height blocks; a wall one or more open cells away is traced normally; a side wall
cannot create a corner-graze loophole; target-side cover grades normally. The winning
`eye` (origin + ignored-occluder cell) rides into `losRay`, so the drawn line is the
line that authorized the shot. `forge/tests/smoke-ledge-fire.js` freezes eleven
clauses alongside `smoke-los-cover.js`.

## Verification record

Fresh clone of `main @ 7cd067c`: patcher applied cleanly after repair; double-apply
aborted at the guard with zero writes; both mock inline geometries byte-identical to
canonical; `git diff --check` clean. Battery: ledge-fire **11/11**, character-combat
**9/9**, tactics-geometry **26/26**, los-cover **37/37**, kit-derive **341/341**,
starter-kits **20/20**, and the full Forge suite (engine 14 · board 26 · protocol 56 ·
replay 35 · cover-contest 24 · feed-render 66 · placement 19 · pick-unit 12 ·
tiers-rebase 32 · spell-icons 43 · flora 22 · bus-reconnect 12 · map-bridge 16) —
**zero failures**. Post-fix re-run after the weapon-range change: green again.

## Deliberate boundary (unchanged from 12f)

This bite governs **new-fight initialization** from current database rows. Active
combat remains event-log authoritative. Importing a mid-fight sheet edit still
requires a named replayable synchronization fact and one publishing authority —
that protocol fact is the next character-authority bite.
