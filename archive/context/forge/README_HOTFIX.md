# Battle Forge Phase 1.5h.1 — renderer boot hotfix

## What happened

The Phase 1.5h production HTML called `resize(); rebuild();` during ES-module
startup. The new terrain renderer calls `tagDiscoveryObject()` while rebuilding,
but `DISCOVERY_RENDER` was assigned later in the same module. Because `var` was
hoisted as `undefined`, the first terrain object caused a runtime exception before
`window.CHAR` and the `topo:ready` event were published.

That is why the party screen showed **No combat sheet** and then reported that the
renderer did not load. It was not an upload mistake and it was not a jsDelivr or
Three.js failure.

## Apply

Replace only:

- `forge/topography-test-mock.html`

The canonical geometry file and the patched battle-tactics reference mock do not
need to be changed again.

After upload, hard-refresh once. The party cards should populate and **Enter the
Forge** should become available.

## Regression guard

`smoke-phase15h-contract.js` now asserts that the discovery render registry is
initialized before the initial `resize(); rebuild();` call.
