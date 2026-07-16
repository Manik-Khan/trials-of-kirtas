# Forge initiative authority cleanup · 2026-07-16

## Field defect

Líadan's initiative roll displayed:

```text
DEX +1 · Jack of All Trades +1 · Other sheet bonuses -1
```

The negative modifier was artificial. The component profile correctly totaled +2, while the live unit still carried an older +1 cached/fallback initiative value. `forge-initiative.js` treated that stale unit value as authoritative and inserted a negative remainder to make the arithmetic match it.

## Corrections

### Canonical static authority

`forge-initiative.js` now prefers `initiativeProfile.modifier` whenever the component profile provides it. `unit.initMod` remains only a legacy fallback when no profile total exists.

This prevents a stale live-unit value from manufacturing a negative `Other sheet bonuses` component.

### Derived kit consistency

`forge-kit-derive.js` now returns the initiative profile's corrected modifier as `kit.init`. Recognized features such as Jack of All Trades can repair an omitted cached total without surfacing an alarming false mismatch warning.

Líadan's expected static evidence is now:

```text
DEX +1 · Jack of All Trades +1
```

### Fallback data

Both embedded fallback records now use Líadan's correct +2 initiative:

- `STARTER_KITS.liadan`;
- the party staging card.

### Bright modal evidence

The initiative modal now:

- previews the complete evidence immediately while the network publication is in flight;
- gives the evidence line a clearer bright-panel treatment;
- remains the primary readable surface while the rest of the battlefield is dimmed.

The authoritative initiative event still persists the complete evidence in replay and the feed. The old extra local `clog()` narration was removed so each initiative roll appears only once in permanent history.

### Cache invalidation

- `forge-initiative.js?v=fi2`
- `forge-kit-derive.js?v=b8`

## Focused field checklist

1. Open initiative on both browsers.
2. Roll Líadan digitally.
3. Confirm the modal immediately shows the d20 and both +1 components.
4. Confirm the total is `d20 + 2`.
5. Confirm there is no negative remainder and no sheet-mismatch warning.
6. Refresh both browsers and confirm identical evidence.
7. Confirm the permanent feed contains one initiative fact, not duplicate local and replay rows.
8. Enter a manual final total and confirm it remains clearly labeled as an opaque manual total.

## Validation

Focused initiative-authority suite: **14/14**.

Updated regression suites:

- Kit derivation: **341/341**;
- Final trust: **18/18**;
- Promotion/visibility: **17/17**;
- Reaction/hidden information: **14/14**;
- Phase 2b.1 field contract: **30/30**.

Whole Forge battery comparison:

- previous promoted baseline: **45 pass, 7 inherited failures, 1 inherited timeout**;
- current build: **46 pass, 7 inherited failures, 1 inherited timeout**.

No previously passing suite regressed.

## Next active Phase 2 slice

After the focused browser check, continue structural bridge completion, then doors. Do not reopen the finished promotion or AC-redaction slices without a new demonstrated contradiction.
