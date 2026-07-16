# CONTEXT Forge update · 2026-07-16b

Supersedes `CONTEXT_Forge-update-2026-07-16a.md` for the current concise field authority.

## Field verdict

The July 16 browser round signs off player-side enemy AC redaction.

The remaining initiative defect was not a real negative modifier on Líadan. Her canonical initiative components were:

- Dexterity +1;
- Jack of All Trades +1;
- total static initiative modifier +2.

A stale live/fallback `initMod: 1` was being reconciled against the correct +2 component profile. The evidence layer manufactured `Other sheet bonuses -1` to force those components back down to the stale number.

## Initiative authority correction

- `initiativeProfile.modifier` is the canonical static initiative authority when a component profile exists.
- Derived Forge kits expose the profile modifier as `kit.init` rather than retaining a stale cached sheet total.
- Recognized features such as Jack of All Trades repair an omitted cached total without presenting a false player-facing warning.
- Líadan's fallback combat kit and party staging record now both use +2 initiative.
- The initiative modal previews full evidence immediately while publication is in flight.
- Initiative math remains permanently recorded by the authoritative event/feed, but the local client no longer adds a duplicate narration row.
- Cache stamps were bumped for both initiative authority and kit derivation.

Expected Líadan evidence:

```text
D20 12 · DEX +1 · Jack of All Trades +1 · = 14
```

There must be no `Other sheet bonuses -1` and no warning that the sheet omitted Jack of All Trades.

## Promotion and next active work

The canonical `/forge/` surface, Workshop/Table identity, Planned tab, prototype retirement, and old-route redirect remain current.

After the focused two-browser initiative verification, resume active Phase 2 with structural bridge completion:

1. field-verify bridge generation visibility and counts;
2. verify deterministic bridge identity across save, refresh, and both clients;
3. validate rail cover and movement;
4. verify open, closed, and broken state authority;
5. then begin doors.
