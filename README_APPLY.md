# Battle Forge Phase 1.5h — apply and field-check

This bundle is based on the exact Phase 1.5g production `forge/topography-test-mock.html` that M field-tested on July 13, 2026. It retains all Phase 1.5b–g camera, token, feed, effect, discovery, class-action, flanking, Prone, and Player View work.

No database migration, commit, or push is included.

## Upload through GitHub

Replace:

- `forge/topography-test-mock.html`
- `forge/tactics-geometry.js`
- `forge/forge-discovery.js`
- `forge/tests/smoke-los-cover.js`
- `forge/tests/smoke-forge-discovery.js`
- `forge/tests/smoke-phase15f-contract.js`

Add:

- `forge/tests/smoke-cover-calibration.js`
- `forge/tests/smoke-phase15h-contract.js`
- `forge/tests/smoke-geometry-sync.js`
- `forge/PHASE15H_GEOMETRY_AND_FOG.md`

The other cumulative Phase 1.5 support modules/tests in the ZIP are unchanged convenience copies and do not need to replace byte-identical deployed files.

## Synchronize the reference tactical mock

`tactics-geometry.js` is also inlined in `battle-tactics-geo-mock.html`. Use one of these offline guarded tools:

### Browser

1. Open `tools/forge-phase15h-sync-battle-mock.html` locally.
2. Choose the current live `battle-tactics-geo-mock.html` from GitHub/downloaded checkout.
3. Click **Validate, patch, and download**.
4. Upload the downloaded replacement to the same repository path.

### Checkout

From the repository root:

```bash
node path/to/unzipped-bundle/tools/apply-forge-phase15h-battle-mock.js .
```

The patcher checks both repository-root and `forge/` locations. It aborts unless exactly one canonical geometry block is found. It does not commit or push.

## Browser field pass

### Cover

1. Compare shots over low lips. A shin-high obstruction should normally be **clear**, not automatic half cover.
2. Confirm waist-high broad barriers still grant half cover.
3. Confirm a near-full wall can grant three-quarters or total depending on geometry.
4. Shoot past narrow trees/columns and broad boulders; they should no longer behave as identical five-foot walls.
5. Place one living creature between attacker and target and confirm intervening-creature cover can appear.
6. Down the intervening creature and confirm it stops supplying creature cover.
7. Recheck ledge peek and parapet lean: shallow legal shot, steep berm block, tall parapet block, one-square-back block.
8. Use **Contest next shot** and confirm the DM ruling still replaces the computed cover.
9. In Staff View, run **Forge → Run cover audit** on several seeds and inspect the System-feed distribution before changing thresholds.

### Fog

1. Enter Player View in both 3D and top-down.
2. Confirm the triangular/checker z-fighting is gone.
3. Confirm unexplored areas do not reveal hidden wall, room, prop, or light silhouettes.
4. Move PCs and confirm visible terrain becomes normal while explored memory remains dark.
5. Confirm props, decals, local lights, enemies, badges, and targeting disappear outside current visibility.
6. Refresh or join from a second device and confirm explored memory reconstructs from the shared movement history.
7. Switch to Staff View and confirm the complete battlefield returns without changing session authority.

## Headless checks

From the repository root:

```bash
node forge/tests/smoke-los-cover.js
node forge/tests/smoke-cover-calibration.js
node forge/tests/smoke-geometry-sync.js
node forge/tests/smoke-forge-discovery.js
node forge/tests/smoke-phase15h-contract.js
```

Run the retained Forge battery after integration as well.

## New-session handoff

After the field pass, use the refreshed context files in this bundle:

- `CONTEXT.md`
- `CONTEXT_Forge.md`
- `CONTEXT_Forge-update-2026-07-13h.md`
- `README_NEW_SESSION.md`

The next build is active Phase 2 generator terrain, not another redesign of Phase 1.5 unless the field pass demonstrates a regression.
