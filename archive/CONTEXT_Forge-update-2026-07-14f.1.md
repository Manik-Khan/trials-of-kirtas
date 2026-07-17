# CONTEXT Forge update · 2026-07-14f.1

Supersedes `CONTEXT_Forge-update-2026-07-14f.md` as the current concise Forge handoff. Phase 2f.1 is a field-audit correction; do not begin doors/tunnels/fords until this browser gate passes.

## Field verdict overrode the Phase 2f claims

M’s live screenshots showed two facts:

1. Cosmere and Vesperian still displayed scalar damage such as `4 dmg` and `5 dmg`, without source formula or rolled arithmetic.
2. Bridge/connector controls described by the checklist were not discoverable in the actual staff panel.

The prior Phase 2f validation was insufficient because it proved helper output and an extracted known-answer roll, not the complete production event-to-HUD insertion path. It also treated an obscure dropdown overlay control as though it were an adequate bridge-generation workflow. Those claims are closed and replaced by this audit.

## Damage evidence v2

`forge-damage-evidence.js` is now version `2.0.0` and installs over the actual `ForgeTableCorrectness` seam.

Authoritative route:

`attack_resolved / ability_used event → factFromEvent → attach dmgParts/dmgFormula → factHtml → inject evidence → addForgeRow`

Evidence enters the HTML before the HUD can repaint it. A successful scalar-only event visibly fails with **Damage evidence missing** and emits a System warning. No new attack may silently display only a total.

Dueling is repaired on the final `kit.actions` structure consumed by combat. Eligible one-handed weapon attacks and bound Booming Blade/Green-Flame Blade actions receive +2 once; two-handed modes are excluded. Vesperian’s new one-handed longsword/Booming Blade hit must visibly show `1d8 + 6` and `[roll] +6 = total`.

Historical rows that never saved components remain unreconstructable. Test with new Phase 2f.1 attack events.

## Discoverable vertical diagnostics

The left staff authoring panel now owns a visible **Vertical geometry** block:

- `Show connectors` toggles the overlay;
- `Find bridge seed` searches 48 nearby deterministic root seeds;
- status reports stair, ramp, bridge, and open-ledge counts;
- zero-bridge seeds are stated explicitly.

Bridge generation remains deterministic and automatic. The finder is an authoring convenience, not a new random authority. Every candidate is re-normalized so its stage seeds derive from that candidate root seed.

## Runtime replacements

For the incremental hotfix over Phase 2f, replace/add only:

- `forge/topography-test-mock.html`
- `forge/forge-damage-evidence.js`

No geometry patcher is required; Phase 2f bridge geometry remains unchanged.

## Validation

Nine runnable changed-file suites: **289 checks green**. This includes exact event-to-row insertion, scalar-only failure visibility, final-kit Dueling, visible panel controls, executable bridge-seed search with fresh stage streams, startup-order guards, snapshot authority, multiplayer field regressions, vertical geometry, and bridges.

All three executable production inline scripts parse. The full repository battery and live two-device round remain field gates.

## Browser gate before more Phase 2 work

1. New Vesperian hit visibly shows formula, rolls, and +6.
2. New Cosmere Eldritch Blast visibly shows formula and rolls.
3. Refresh/rejoin preserves those new evidence-bearing rows.
4. Any scalar-only new hit fails visibly and reports to System.
5. Left panel shows Vertical geometry status, Show connectors, and Find bridge seed.
6. A nearby bridge-bearing seed can be found and its bridge rendered/overlaid/played/reloaded.
7. Staging, claims, remote start, movement refresh, defeated visuals, cover contest, and feed channels remain green.

## Next order

Only after Phase 2f.1 passes the browser/two-device gate:

1. first-class doors;
2. tunnels and explicit under/over transitions;
3. fords and water traversal;
4. semantic objectives and spawn influence;
5. validation/local repair and expanded overlays.

M uploads, commits, and pushes. Return repository-structured files; do not push unless explicitly instructed.
