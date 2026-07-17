# CONTEXT Forge update · 2026-07-13h.1

Hotfix to the Phase 1.5h geometry/fog bundle.

## Renderer boot failure

The first Phase 1.5h `topography-test-mock.html` initialized
`DISCOVERY_RENDER` after the module's initial `resize(); rebuild();` call.
Terrain construction calls `tagDiscoveryObject()`, so startup threw before
`window.CHAR` and `topo:ready` were published. The visible symptom was the party
screen showing `NO COMBAT SHEET` followed by **The renderer did not load**.

This was a source initialization-order defect, not an upload mistake, Three.js
CDN failure, or a problem with the battle-tactics geometry patcher.

## Fix

`DISCOVERY_RENDER` is now initialized before terrain construction. The later
duplicate assignment is removed. `smoke-phase15h-contract.js` freezes the
ordering requirement.

Only `forge/topography-test-mock.html` must be replaced at runtime. Canonical
geometry and the reference battle-tactics mock remain unchanged from 1.5h.
