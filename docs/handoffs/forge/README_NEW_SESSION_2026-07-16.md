# The Forge — new session launch checklist · 2026-07-16

Use these documents:

1. `CONTEXT.md`
2. `CONTEXT_Forge.md`
3. `docs/handoffs/forge/CONTEXT_Forge-update-2026-07-16c.md`
4. `docs/handoffs/forge/FORGE_PHASE2_REMAINDER_2026-07-16.md`
5. `docs/handoffs/forge/PHASE2F4_STRUCTURAL_BRIDGE_COMPLETION_2026-07-16.md`
6. this `docs/handoffs/forge/README_NEW_SESSION_2026-07-16.md`

The current concise authority is
`docs/handoffs/forge/CONTEXT_Forge-update-2026-07-16c.md`.

## Suggested first prompt

> Read all current context documents completely. Treat `docs/handoffs/forge/CONTEXT_Forge-update-2026-07-16c.md` as the concise field authority. Use the current repository `main` after the Phase 2f.4 structural-bridge patch; do not work from an older mock bundle. The canonical product is `/forge/` using `forge/index.html`; the old topography-test mock is only a query-preserving redirect. Do not reopen signed-off combat, initiative, AC-redaction, or product-promotion work without a demonstrated regression. First run the focused two-browser Phase 2f.4 bridge field checklist: stable identity, refresh/save persistence, open traversal, rail cover, Closed/Broken movement refusal, usable bridgeheads, occupancy protection, rewind restoration, and Audit Bridges. Fix demonstrated blockers or correctness contradictions only. Once bridges pass, begin doors using the same stable identity, snapshot, replay, movement, sight, rendering, inspection, and audit contract. Keep connector tools Active and future authoring tools in Planned. Do not push to GitHub unless explicitly instructed.

## Preferred session-start source

Preferred:

- upload a ZIP of the current repository `main` after the Phase 2f.4 patch is committed; or
- upload the exact current repository files listed below.

Do not use an older generated working directory as the baseline.

## Minimum current files for bridge verification and doors

### Canonical surface

- `forge/index.html`
- `forge/topography-test-mock.html`
- `forge/forge-hud.js`
- `forge/forge-feed-render.js`
- `forge/forge-table-correctness.js`

### Connector, replay, and geometry authority

- `forge/forge-bridge-authority.js`
- `forge/forge-generator-foundation.js`
- `forge/forge-engine.js`
- `forge/forge-replay.js`
- `forge/forge-pipeline.js`
- `forge/forge-board.js`
- `forge/forge-discovery.js`
- `forge/forge-combat-rules.js`
- `forge/tactics-geometry.js`

### Contracts and current reports

- `forge/FORGE_MAP_CONTRACT_2.md`
- `forge/FORGE_VERTICAL_GEOMETRY_1.md`
- `forge/FORGE_STRUCTURAL_BRIDGES_1.md`
- `FORGE_PROTOCOL.md`
- `docs/handoffs/forge/PHASE2F4_STRUCTURAL_BRIDGE_COMPLETION_2026-07-16.md`

### Tests

- `forge/tests/smoke-phase2f4-bridge-completion.js`
- the current Forge smoke-test directory or permission to read it from the uploaded repository.

Diff any uploaded individual files against the uploaded/current `main` before claiming either copy is newer.

## First browser pass — bridges

1. Open canonical `/forge/` on two browsers.
2. Generate a map containing at least one structural bridge.
3. Record the bridge ID and path shown in the staff panel.
4. Confirm both devices show the same bridge identity.
5. Refresh and reconnect; confirm identity and state remain unchanged.
6. Save/reload the battlefield; confirm identity remains unchanged.
7. Cross the Open bridge in both directions.
8. Attack across each rail and verify half-cover evidence when appropriate.
9. Set the bridge Closed; verify the interior is blocked but both land endpoints remain usable.
10. Set it Broken and repeat the movement check.
11. Occupy the interior span and confirm Close/Break is refused.
12. Stand on an endpoint and confirm Close/Break is allowed.
13. Rewind/correct the state change and confirm the snapshot baseline returns.
14. Run **Audit Bridges** and confirm all indicators pass.
15. Refresh both devices after the final state edit and confirm identical reconstruction.

## First implementation slice after bridge sign-off — doors

Before coding, define the minimum supported door state model.

Then establish:

1. stable identity tied to the threshold and connected spaces;
2. snapshot baseline;
3. replayable state;
4. shared movement and sight authority;
5. truthful rendering;
6. occupied-threshold protection;
7. staff inspection;
8. focused automated audit;
9. two-browser refresh/reconnect/rewind verification.

Do not add locks, keys, secret detection, traps, or destructible-door combat merely as labels. Each must wait until its authority and test contract are explicit.

## Validation baseline

Current expected whole-battery status after Phase 2f.4:

- **47 passing suites**
- **7 inherited failures**
- **1 inherited timeout**

Focused Phase 2f.4:

- **33/33**

Known inherited red harnesses from the recent baseline include the older cover-contest, flora, flat-mode engine calibration, pick-unit, tiers-rebase, token-rig, and unit-art tests, plus the placement timeout. Compare exact status before classifying a failure as new.

## Stop conditions

Stop and fix before continuing when:

- the canonical Forge fails to boot;
- a player cannot join or claim a character;
- bridge identity differs between clients;
- bridge state changes after refresh without an authoritative event;
- movement, cover, sight, and rendering disagree;
- Closed/Broken disables safe land endpoints;
- occupancy protection fails;
- rewind does not restore the snapshot state;
- the same live edit targets a different connector after regeneration;
- hidden topology or hostile AC leaks to Player View.

Record non-blocking visual ideas without interrupting the connector slice.
