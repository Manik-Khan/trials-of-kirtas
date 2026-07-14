# Battle Forge Phase 2 — snapshot authority slice

This bundle begins Phase 2 without changing the completed Phase 1.5h.1 combat, geometry, camera, or fog rules.

## Replace / add

- Replace `forge/forge-generator-foundation.js`
- Replace `forge/forge-engine.js`
- Replace `forge/topography-test-mock.html`
- Replace `forge/tests/smoke-phase15h-contract.js`
- Add `forge/tests/smoke-snapshot-authority.js`

## What changed

- `mapSnapshot` is authoritative whenever the key exists on a session envelope.
- The stored fingerprint is verified before normalization.
- Missing `mapSnapshot` alone triggers the legacy seed/theme/sliders recipe.
- Present-but-null, malformed, wrong-sized, out-of-bounds, or fingerprint-mismatched snapshots fail loudly and never regenerate.
- Each load returns a detached runtime clone.
- `coverShape[]` is now part of the saved rules map.
- Infinite void occlusion is serialized as the JSON-safe string `"Infinity"` and restored to numeric `Infinity` at runtime.
- New sessions retain compact renderer-only `type[]`, `foot[]`, and base-terrain `occ[]` data in `mapSnapshot.meta.renderField`.
- The production mock holds the restored combat map separately as `SESSION_MAP_AUTHORITY`; `combatMapFromF()` clones that exact map rather than reverse-engineering geometry from renderer state.
- Older foundation.2 snapshots remain loadable. Their combat map remains exact; absent renderer metadata is inferred only for presentation.
- Cache stamps are bumped to `g2s1` and `fe2`.

## Validation completed in this bundle

- All three executable inline scripts in `topography-test-mock.html` parse in Node.
- Both changed runtime JavaScript modules parse.
- Both smoke tests parse.
- `smoke-snapshot-authority.js`: 24 checks green.
- Phase 1.5h.1 discovery registry still initializes before the first `resize(); rebuild();`.

The complete repository battery and real browser/two-device session still remain release gates because only the requested working set was supplied here.

## Browser field check

1. Hard-refresh the Forge once after upload.
2. Create a new staged session and copy its join link.
3. Open it on a second device/browser.
4. Confirm both devices show the same terrain, props, cover shapes, and spawns.
5. Refresh both devices mid-session and confirm the battlefield does not change.
6. Confirm an older recipe-only staged session still opens.
7. For a deliberate corruption check in a non-production test row, alter `mapFingerprint`; the session should refuse to open rather than regenerate.

## Deploy rule

M uploads, commits, and pushes. This bundle does not push.
