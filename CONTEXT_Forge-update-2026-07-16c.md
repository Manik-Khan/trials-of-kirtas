# CONTEXT Forge update · 2026-07-16c

Supersedes `CONTEXT_Forge-update-2026-07-16b.md` as the current concise Forge authority.

Read this with:

1. `CONTEXT.md`
2. `CONTEXT_Forge.md`
3. `FORGE_PHASE2_REMAINDER_2026-07-16.md`
4. `PHASE2F4_STRUCTURAL_BRIDGE_COMPLETION_2026-07-16.md`
5. `README_NEW_SESSION_2026-07-16.md`

## Current field verdict

The long correctness/trust wave and bounded product-promotion milestone are complete enough to resume active Phase 2 work.

Field-confirmed results include:

- canonical component damage display;
- two-d20 advantage/disadvantage evidence;
- replay-authoritative Ki spending and Step of the Wind Dash;
- Sanctuary's hostile-target Wisdom-save gate;
- Bless target selection, character badges, and recorded d4 additions;
- player-side hostile AC redaction;
- canonical initiative component evidence;
- Líadan's initiative authority: Dexterity +1 plus Jack of All Trades +1, with no manufactured negative modifier;
- canonical `/forge/` product surface and usable Workshop/Table flow.

Do not reopen a signed-off item merely because an older handoff described it as pending. Reopen it only when a new browser test demonstrates a regression.

## Implemented trust foundation

The current Forge working set also contains:

- resource-spend IDs and reducer-level duplicate-payment protection;
- Dash and movement capacity derived from replay facts;
- movement-highlight reconciliation and destination pulse;
- downed-creature recovery-shard presentation;
- bonus-action spell legality;
- multiclass ordinary/Pact slot authority;
- multiplayer opportunity-attack and nested-reaction infrastructure;
- Silvery Barbs roll evidence, granted advantage, and higher-level slot selection;
- Shield presentation that preserves its legitimate value against later attacks after a critical;
- manual initiative editing and ordering;
- wall-aware personal sight, party-shared explored memory, continuous fog presentation, and long-range creature recognition;
- replay-safe Open/Closed/Broken connector state infrastructure.

These systems have automated coverage. When touching a related authority, run the focused tests and a real two-browser pass rather than relying only on static inspection.

## Product surface

The promoted product contract is now:

- visible name: **The Forge**;
- canonical route: `/forge/`;
- canonical implementation: `forge/index.html`;
- pre-session identity: **Workshop**;
- persistent encounter identity: **Table**;
- shared-encounter creation: **Roll Initiative**;
- old `forge/topography-test-mock.html` route redirects while preserving query and hash parameters;
- grid opacity defaults to 50% and remains a local presentation preference;
- active controls and future work are separated into **Active** and **Planned**;
- structural bridges and connector tools remain Active;
- old disabled prototype controls remain hidden or retired.

Do not restore the old mock as a second implementation.

## Phase 2f.4 — structural bridge authority

The current implementation raises bridges to a trustworthy connector contract:

- bridge IDs derive from their exact ordered path and elevations, not array position;
- path signatures protect live edits from stale identity collisions;
- immutable snapshots preserve full bridge records;
- replay stores connector state and identity proof;
- rewind/correction restores the snapshot baseline when an override disappears;
- Closed and Broken block only the interior span, not safe land endpoints;
- occupancy protection applies to the interior span;
- bridge rails participate in canonical cover evidence as `bridge-rail`;
- state changes remove deck, rail, movement, and cover authority together;
- staff cards expose stable ID, span, state, occupancy, movement audit, rail audit, inspection, and state controls;
- **Audit Bridges** checks identity, continuity, traversal, unavailable-state blocking, bridgehead usability, and rail cover.

Automated Phase 2f.4 validation is green. The focused real-browser bridge pass is the first task of the next session.

## Immediate execution order

1. Run the focused two-browser Phase 2f.4 bridge checklist.
2. Fix only demonstrated bridge blockers or correctness contradictions.
3. Once the bridge pass is clean, begin **doors**.
4. Build doors on the same connector principles:
   - stable identity;
   - immutable snapshot baseline;
   - replayable state;
   - truthful movement and sight authority;
   - rendering that matches rules state;
   - occupancy-safe transitions;
   - staff inspection and audit;
   - refresh/reconnect/rewind reconstruction.
5. Continue connectors in this order:
   - tunnels;
   - fords;
   - hazardous crossings;
   - ladders, jump points, and climb points where supported.
6. Then continue semantic spawns and map validation.

## Bridge field checklist

1. Generate a bridge and record its staff-card ID.
2. Confirm the same ID and path on both browsers.
3. Refresh/reconnect both clients and confirm identity is unchanged.
4. Save/reload the battlefield and confirm identity remains unchanged.
5. Cross an Open bridge in both directions.
6. Test attacks across each rail and confirm at least half cover when the rail blocks the body samples.
7. Close the bridge and confirm only the interior span becomes unavailable.
8. Confirm both adjacent land bridgeheads remain usable.
9. Break the bridge and repeat the movement check.
10. Put a creature on the interior span and confirm Close/Break is refused.
11. Move it to a land endpoint and confirm the state change is allowed.
12. Rewind/correct a state change and confirm the snapshot baseline returns.
13. Run **Audit Bridges** and confirm all indicators pass.
14. Refresh both devices after state edits and confirm identical reconstruction.

## Current validation baseline

After Phase 2f.4:

- whole Forge battery: **47 passing suites**;
- inherited failures: **7**;
- inherited timeout: **1**;
- focused Phase 2f.4 suite: **33/33**;
- Phase 2f bridges/damage: **40/40**;
- replay: **35/35**;
- canonical tactics geometry: **26/26**;
- generator foundation: **38/38**;
- initiative authority cleanup: **14/14**.

The inherited red harnesses predate this slice. Compare test status against the recorded baseline before calling a result a regression.

## Scope and deployment discipline

Use this triage:

1. **Blocker:** cannot enter, join, move, attack, save, restore, or continue — stop and fix.
2. **Correctness/trust:** wrong rules, state, replay, geometry, identity, or visual contradiction — fix before claiming the slice.
3. **Product clarity:** misleading workflow or unsupported controls — address at a bounded milestone.
4. **Polish:** spacing, color, animation, or convenience — record unless it materially blocks testing.

Working rule:

> Correct enough to trust. Clear enough to test. Then move forward. Polish at milestones.

M uploads, commits, and pushes through GitHub. Return repository-structured files and guarded patchers. Do not push unless explicitly instructed.
