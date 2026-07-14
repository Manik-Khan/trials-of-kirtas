# Forge Parameter Record 2

Status: canonical recipe record (introduced Phase 2d; current generator Phase 2e).

Schema: `forge-map-parameters`  
Version: `2`

Version 2 activates true deterministic stage ownership while preserving the
Phase 2c archetype and save/load contract.

```js
{
  schema: "forge-map-parameters",
  version: 2,
  generatorVersion: "2.0.0-elevations.1",
  seed: 12345,
  theme: "cavern",
  archetype: "canyon",
  generatorProfile: "stage-owned-legacy",
  stageSeeds: {
    layout: 0,
    height: 0,
    semantics: 0,
    decor: 0,
    foes: 0
  },
  stages: {
    layout: { roomCount: 8, loopChance: 0.2 },
    height: { mode: "tiered", verticalityFt: 5 },
    semantics: {},
    decor: { density: 0.7 },
    foes: { party: 4, count: 5 }
  },
  rules: { poolBlocks: false, waterBlocks: true },
  runtime: { retries: 24 }
}
```

## Authority

`mapSnapshot` remains the authoritative battlefield. The parameter record is
its reproducible recipe and diagnostic history; it never overrides a valid
saved snapshot.

When no snapshot exists:

- version-2 records use `stage-owned-legacy`;
- version-1 records migrate in memory but retain `legacy-dungeon` unless they
  explicitly named another profile;
- unsupported future versions stop loudly.

## Archetypes

The requested archetype is recorded separately from the implemented generator
profile. Canyon, Bridge Crossing, Valley, and the other Phase 2c choices remain
recorded intent until their terrain grammars ship. Version 2 does not pretend
that selecting one has already changed the layout grammar.

## Compatibility projection

Session envelopes continue to publish top-level `seed`, `theme`, `sliders`,
`archetype`, and `stageSeeds` for old readers. When both shapes exist, the
versioned `parameters` record owns recipe reads.
