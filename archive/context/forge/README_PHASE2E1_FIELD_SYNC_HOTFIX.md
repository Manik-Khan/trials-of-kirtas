# Battle Forge Phase 2e.1 — staging, replay, feed, and token-sync hotfix

Apply this **over Phase 2e**. Phase 2f is paused until this field gate passes.

## Runtime replacement

Replace:

- `forge/topography-test-mock.html`

The two included smoke files are repository tests, not browser dependencies:

- `forge/tests/smoke-phase2e1-field-sync.js`
- `forge/tests/smoke-phase2b1-field-round.js`

No Node patcher must be run for this hotfix. The production HTML now contains guarded compatibility repairs for older `weapon-actions.js`, `forge-table-correctness.js`, and `forge-feed-render.js` copies, because uploading a patcher through GitHub does not execute it.

## Fixed

1. **Renderer/staging boot** — Phase 2e introduced `verticalOverlayGroup` after the initial `resize(); rebuild();`. The first `renderField()` called `drawVerticalOverlay()` while that registry was still `undefined`, preventing `window.CHAR` and `topo:ready`. The group now initializes before the first rebuild, beside the existing discovery/session boot guards.
2. **Remote start without refresh** — a player waiting in the claim screen receives the `session_started` echo, the screen changes to active, and the Enter button changes to **Enter the fight** without reloading.
3. **Claim during cold catch-up** — claims made before `window.__forgeSession` is assigned are re-seated into the pipeline identity instead of leaving that device acting like a spectator.
4. **Active-row/start-event race** — boot retries the authoritative event log when the session row is active but replay still says staging. It refuses a half-synced board if the start fact remains unavailable.
5. **Encounter feed persistence** — cold join, refresh, and watchdog resync rebuild the visible feed from `pipe.events()` rather than starting visually empty.
6. **Damage evidence** — `dmgParts` survives event→fact presentation and component arithmetic is visible by default. New Vesperian one-handed attacks/weapon cantrips project Dueling at +2 even when the earlier external-module patcher was never executed.
7. **Weapon-cantrip authority** — live Booming Blade / Green-Flame Blade math wins over a stale legacy twin while retaining the saved legacy action id.
8. **Feed channels** — Table/System/All filtering now actually hides other channels. Transport and resync diagnostics go to System.
9. **Defeated-token convergence** — cold spawn and resync immediately apply the downed/removed visual, so a foe cannot remain as an attackable-looking ghost after its replay state says defeated.
10. **Cover Contest** — it is available only for current half or three-quarters cover, is never armed automatically, and an older HUD decorator cannot expose or arm it on a clear shot.

## Browser field checklist

1. Open a shared link before the DM starts. Claim one or more characters. Have the DM start. Confirm the claim screen updates to **fight underway / Enter the fight** without refreshing.
2. Open an already-active link. Confirm it never enters a half-active “waiting for DM” board. Claim multiple characters before entering.
3. Move and attack, then refresh either device. Confirm positions, HP, turn economy, and the full protocol-derived combat feed return.
4. Defeat a foe. Confirm both devices apply the defeated visual; refresh both and confirm it stays defeated.
5. Use Vesperian’s one-handed longsword/Booming Blade. Confirm damage shows component arithmetic such as `[die] +6 = total`, and that no stale duplicate Booming Blade action owns the math.
6. Switch Table/System/All. Table should show combat/story/chat rows; System should show transport/resync/geometry diagnostics; All should show both.
7. Attack a clear target: no Cover Contest control and no pause. Attack a half/three-quarters-cover target: the optional control appears; the attack pauses only after the player explicitly arms it.
8. Re-test flanking on a clean synchronized round. If advantage is still absent, record attacker, target, both flankers’ cells, and selected flanking rule; that would then be a rules failure rather than a transport artifact.

## Validation

231 runnable checks green in this reduced working set:

- snapshot authority: 24
- Map Contract/render truth: 23
- Phase 2b.1 field round: 30
- Phase 2c parameters: 41
- Phase 2d stage ownership: 36
- Phase 2e vertical geometry: 39
- Phase 2e.1 field sync: 38

All three executable inline scripts parse. The full historical repository battery and a real two-device Supabase round remain release gates.
