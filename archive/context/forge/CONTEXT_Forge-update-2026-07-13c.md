# CONTEXT_Forge update · 2026-07-13c

Supersedes the 13b camera-only handoff as the current Phase 1.5 record. The 13b document remains the authority for the production 3D ↔ Top-down camera implementation; do not delete it.

## Phase 1.5c built

Top-down now has a dedicated tactical-token representation rather than trying to read upright sprites from above.

Each unit is one combat object with a dual visual rig:

- existing standee in 3D;
- flat circular token in Top-down;
- shared position, movement tween, selection, target, hit flash, death/revival, inspection, God Mode, and future discovery state.

The top-down picker raycasts visible discs directly. This avoids the old standee-column picker becoming unstable near a vertical camera while leaving the field-tested 3D WYSIWYG picker unchanged.

## Token-art resolver

New `forge/forge-unit-art.js` provides a pure, smoke-tested art resolver:

1. shared/authoritative `tokenArt` on the unit or roster row;
2. this-device per-combatant override;
3. this-device character/creature-kind default;
4. PC portrait;
5. explicit statblock art;
6. derived 5e.tools token URL;
7. initials fallback.

The editor accepts URLs and local image files. Local images are center-cropped and compressed to 384×384 before local persistence. **Use default** clears only the individual override; clearing a kind default is explicit in the editor.

Current overrides are local presentation preferences, not protocol facts. The unit/roster `tokenArt` seam is already accepted for a later shared-authority design.

## Fog dependency

Fog remains next. It must drive the existing `foeVisible()` seam and call the unit-rig sync once. It must not independently manage standee visibility and token visibility.

## Validation

- unit-art smoke: 27 green;
- token-rig contract: 26 green;
- guarded fixture patch green;
- Node/browser patch parity green;
- patched fixture inline syntax green.

The exact production camera-patched file was not supplied in this request, so real-file application and browser eyeballing remain M’s next check.

## Next order

1. Apply and eyeball Phase 1.5c on the working camera build.
2. Build party-shared three-state world-space fog and interaction gating.
3. Complete snapshot-first session loading with legacy recipe fallback.
4. Continue Phase 2 archetypes, elevations, connectors, spawns, validation/repair, and debug overlays.
