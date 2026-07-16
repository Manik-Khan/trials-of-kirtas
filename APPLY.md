# Apply Phase 2f.4 structural bridge completion

Baseline: the repository after `forge-phase2-initiative-authority-cleanup-2026-07-16`.

## Recommended guarded application

Copy this bundle over the repository root, then run:

```bash
node forge/patch-phase2f4-bridge-completion.js /absolute/path/to/trials-of-kirtas
```

The installer verifies SHA-256 hashes for every existing baseline file, writes through temporary files, and refuses an unexpected or partially edited baseline. Running it a second time is safe and reports that every target is already current.

M may instead copy the repo-structured files directly or apply the standalone unified patch supplied beside this ZIP.

## Focused validation

From the repository root:

```bash
node forge/tests/smoke-phase2f4-bridge-completion.js
node forge/tests/smoke-phase2f-bridges-damage.js
node forge/tests/smoke-replay.js
node forge/tests/smoke-tactics-geometry.mjs
node forge/tests/smoke-phase2d-stage-ownership.js
```

Expected focused result: `33 passed, 0 failed` for Phase 2f.4.

## Browser verification

1. Generate a battlefield containing a bridge.
2. Confirm both clients report the same stable bridge ID and path.
3. Refresh/reconnect and confirm the identity and state persist.
4. Cross the open bridge in both directions.
5. Test rail cover from both sides.
6. Close and break the span; its interior must become unavailable while the land endpoints remain usable.
7. Confirm an interior occupant blocks the state edit but an endpoint occupant does not.
8. Rewind/correct the edit and confirm the snapshot baseline returns.
9. Run **Audit Bridges** and inspect the endpoint/path markers.

After this focused pass, begin doors.
