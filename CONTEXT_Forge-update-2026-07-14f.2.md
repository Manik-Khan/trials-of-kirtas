# CONTEXT Forge update · 2026-07-14f.2

Field correction to Phase 2f.1. Forward generator work remains paused until the canonical damage release gate passes.

## Root cause

Phase 2f.1 repaired presentation but did not yet replace the source of the bad damage payload. The screenshots accurately exposed final combat actions containing the wrong modifiers:

- Vesperian Booming Blade/Longsword: `1d8+4`, omitting Dueling.
- Cosmere Eldritch Blast: `1d10+0`, omitting Agonizing Blast.

The earlier Dueling repair depended too heavily on generated IDs. The real browser dedupe can preserve a saved legacy ID while `_src` contains a live derived weapon action; legacy-only actions can also lack an explicit ability field. Formatting that payload more clearly could not correct the roll.

## Canonical correction

New `forge/forge-action-damage.js` owns final-action repair and component rolling.

- It traverses the final `kit.actions` and tab arrays that `buildUnit()` actually consumes.
- Live weapon actions use their explicit ability and item bonus.
- Legacy weapon/cantrip actions recover their attack ability from complete hit modifier minus PB/item attack bonus.
- Dueling sets eligible one-handed melee weapon damage to ability + item bonus +2.
- Agonizing Blast sets Eldritch Blast damage to CHA modifier.
- Repairs are idempotent.
- Criticals double component dice and add flat modifiers once.
- Local and shared foe critical paths now pass their real critical verdict rather than forced `false`.

`forge/forge-feed-render.js` now uses the existing site's Battle HUD convention as the canonical Forge presentation:

`Dmg: [rolls] +mod = total type`

`forge/forge-damage-evidence.js` is reduced to protocol transport/fallback compatibility. It no longer owns the main presentation.

## Grounded known-answer cases

The regression suite freezes current character-record semantics:

- Vesperian DEX +4, PB +2, Dueling, saved legacy IDs → Booming Blade and one-handed Longsword `1d8+6`; two-handed `1d10+4`.
- Cosmere CHA +3, PB +2, Agonizing Blast, saved Eldritch Blast hit +5/dmg 0 → `1d10+3`.
- Vesperian crit example `[4][5] +6 = 15`; modifier appears once.

## Validation

328 runnable checks green across ten accumulated suites. The changed runtime modules and executable production scripts parse.

## Release gate

Only attacks created after f.2 count. Do not resume forward generator work until a live browser shows:

- Vesperian normal damage with actual die +6;
- Vesperian critical with two dice +6 once;
- Cosmere Eldritch Blast with actual d10 +3;
- replay/refresh preserving the same component results.
