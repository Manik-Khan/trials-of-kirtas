# Battle Forge — reaction and hidden-information hardening · 2026-07-16

This bounded patch follows the Phase 2 final trust slice. It closes the three issues demonstrated in the subsequent two-browser field round without reopening the broader correctness wave.

## Closed issues

### Flexible reaction spell slots

Reaction spells now carry a minimum spell-slot level rather than relying only on a fixed `slot1` cost. Eligibility searches every available ordinary and Pact slot at or above that minimum and selects the lowest eligible pool deterministically.

Consequences:

- Silvery Barbs remains available after 1st-level slots are exhausted when a higher slot remains;
- Shield and other slot-backed reactions use the same rule;
- the prompt states which slot will be spent;
- replay state, rather than a stale browser-unit resource copy, decides whether the reaction is available.

### Authoritative reaction payment

An accepted reaction publishes:

```text
resource_spend
resource_spend_id
resource_pool
```

The replay reducer applies that payment idempotently while marking the reaction used. Retried or duplicate accepted facts carrying the same spend identifier cannot subtract a slot twice. The live browser mirrors the same selected payment for immediate presentation and is reconciled to replay state on echo or refresh.

### Shield after a natural 20

Shield remains available because its +5 AC may protect against later attacks before the start of the caster's next turn. It is no longer presented as though it could prevent the triggering critical hit.

The critical prompt now says that the natural 20 still hits, labels the button **Cast for later attacks**, and preserves the hit in resolution.

### Enemy-defense redaction

Exact enemy AC is retained internally for authoritative resolution and staff diagnostics, but player presentation now omits it from:

- Roll Review before attacking an enemy;
- player-view reaction evidence when the target is hostile;
- player-facing copies of event payloads;
- local player-presentation Shield narration.

Players still see their attack total and the resulting hit or miss, allowing ordinary table inference without direct disclosure. A defending player may see their own AC and Shield forecast.

## Files changed

- `FORGE_PROTOCOL.md`
- `forge/forge-kit-derive.js`
- `forge/forge-replay.js`
- `forge/topography-test-mock.html`
- affected cache/contract smokes
- `forge/tests/smoke-phase2-reaction-hidden-info-hardening.js`

## Automated validation

Focused hardening suite: **14/14**.

Relevant suites remain green, including:

- final trust: **18/18**;
- correctness Wave 4: **17/17**;
- correctness Wave 3: **31/31**;
- Phase 2b.1 field round: **30/30**;
- replay: **35/35**;
- kit derivation: **341/341**;
- table correctness: **31/31**;
- Phase 1.5d: **20/20**;
- Phase 1.5f: **49/49**;
- Phase 1.5g: **76/76**.

Comparable whole Forge battery:

- final trust baseline: **43 pass, 7 inherited failures, 1 inherited timeout**;
- this patch plus its new suite: **44 pass, 7 inherited failures, 1 inherited timeout**.

No previously passing comparable suite regressed.

## Browser checklist

1. Exhaust Líadan's 1st-level slots while retaining a 2nd-level slot.
2. Begin her next turn and confirm her reaction refreshes.
3. Trigger a successful enemy attack and confirm Silvery Barbs is offered using a 2nd-level slot.
4. Accept it, refresh both devices, and confirm exactly one 2nd-level slot was spent.
5. Trigger a natural 20 against a Shield user.
6. Confirm the prompt states that the critical still hits and the action button reads **Cast for later attacks**.
7. Accept Shield and confirm the critical lands while later attacks use +5 AC.
8. Attack an enemy as a player and confirm Roll Review, reaction evidence, and feed never display the enemy's exact AC.
9. Confirm staff view may still inspect exact defense where needed.

A clean result closes the final multiplayer hardening gate and allows the bounded `/forge` promotion/cleanup milestone.
