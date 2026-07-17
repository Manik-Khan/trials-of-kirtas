# CONTEXT_Forge update · 2026-07-12f

## Ledge geometry ruling — shared-edge parapet lean

M ratified the corrected geometry after the table screenshot showed the drawn sight line reaching the target while the corner tracer reported an adjacent traced wall as 8/8 blocked.

**Rule:** a shooter standing at a ledge may lean over an immediately adjacent, target-facing wall when the wall top is below the shooter’s eye. The lean requires a **shared cardinal edge**. At an exact 45° shot, either of the two shared cardinal edges may qualify; the diagonal cell is never the ignored parapet. A wall at or above eye height blocks, a wall farther away is traced normally, and a side wall cannot create a corner-graze loophole.

The legal parapet exception removes only the cell’s added `occ` height. Its terrain height remains in the trace. Therefore a shallow line can clear a low cap while a steep downward line can still hit the earth berm beneath it. `losVerdict().eye` carries the winning origin and ignored-occluder cell into `losRay()`, so authorization and rendering share one geometry.

`forge/tests/smoke-ledge-fire.js` pins eleven clauses: shallow clear, steep berm block, tall/equal block, one-back block, side-wall closure, target-side cover, diagonal-only no-ignore, exact-45 cardinal lean, x/y near-45 selection, and two-cardinal-candidate behavior.

## Character authority — fail closed, contain per character

The database row is the pre-combat authority. HP comes from `vitals`; AC and armor consequences are recomputed with the sheet’s shared `ArmorAC` and `EquipSlots` modules. Cached `structural.combat.ac` is not an acceptable fallback.

`character-combat.js` now throws named dependency/projection errors when those shared calculations are unavailable or invalid. `ForgeKitDerive.combatStats` also fails closed. `derive()` contains that failure per character by returning an unmistakable disabled error kit, logging it, feeding it when the Forge feed is mounted, and dispatching `forge:characterDataError`; the other party rows still derive instead of one bad row aborting the entire party.

Every HTML page that actually loads `forge-kit-derive.js` is verified to load `armor-ac.js`, `equip-slots.js`, and `character-combat.js` first. Mentions in comments/docs do not count as script references.

## Patcher discipline

Rev `2026-07-12f` supersedes the earlier `e` bundle. The patcher computes all outputs in memory, count-guards every replacement, verifies script order and all three geometry copies, writes sibling temporary files, then renames only after full validation. It commits and pushes nothing.

## Deliberate boundary

This bite governs **new-fight initialization** from current database rows. Active combat remains event-log authoritative. Importing a mid-fight sheet edit still requires a named replayable synchronization fact and one publishing authority.
