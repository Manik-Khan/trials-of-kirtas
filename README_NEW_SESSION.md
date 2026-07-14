# Battle Forge context handoff — 2026-07-13h

Start the next session with these four files:

1. `CONTEXT.md` — whole Trials of Kirtas project context.
2. `CONTEXT_Forge.md` — refreshed canonical Forge subsystem context, rules, bugs, file map, and next order.
3. `CONTEXT_Forge-update-2026-07-13h.md` — concise record of Phase 1.5 completion and the geometry/fog calibration.
4. `README_NEW_SESSION.md` — this launch checklist.

Keep `CONTEXT_Forge-update-2026-07-12g.md` available when touching ledge firing, database character authority, or ranged-weapon projection. Earlier July 13 handoffs remain useful historical records, but h is the current concise authority.

## Suggested first prompt

> Read all four current context documents completely. Then diff the current uploaded/live copies of `forge/topography-test-mock.html`, `forge/tactics-geometry.js`, `forge/forge-discovery.js`, and `battle-tactics-geo-mock.html` against the Phase 1.5h handoff before editing. Confirm the Phase 1.5h browser/two-device checklist or record any demonstrated regression. Then begin active Phase 2 generator terrain with snapshot-first session loading, archetype parameters, stage-owned deterministic streams, constrained elevations/connectors, semantic spawns/objectives, validation/local repair, and debug overlays. Do not redesign completed Phase 1.5 systems without a field failure.

## Immediate release checklist

- Upload the Phase 1.5h runtime replacements.
- Use the guarded patcher to synchronize the reference battle mock’s inlined geometry.
- Confirm no triangular/checker fog in 3D or top-down Player View.
- Confirm unexplored areas do not leak room/wall/prop silhouettes.
- Recheck low lips, broad waist barriers, narrow props, intervening creatures, ledge/parapet firing, and Cover Contest.
- Run **Forge → Run cover audit** on several seeds.
- Run the full repository battery and a two-device session.

## Active Phase 2 order

1. Make exact `mapSnapshot` authoritative on session load; retain legacy recipe fallback.
2. Add archetype selector and versioned parameter records.
3. Make `layout`, `height`, `semantics`, `decor`, and `foes` consume their own stage seeds.
4. Assign bounded tactical elevations.
5. Emit first-class ramps, stairs, bridges, doors, tunnels, ledges, and fords.
6. Place semantic PC/foe/objective spawns.
7. Validate and locally repair connectivity, fairness, objective access, melee access, cover, sightlines, elevation advantage, and chokepoints.
8. Add graph/critical-path/semantics/height/connector/cover/spawn overlays.
9. Expand `coverShape` into the authored tactical-prop contract.

## Working rule

M uploads, commits, and pushes through GitHub. Return repository-structured files and guarded patchers; do not push unless explicitly instructed.
