# Forge Parameter Record 1

Status: canonical Phase 2c save contract  
Schema: `forge-map-parameters`  
Version: `1`

This record freezes the inputs and intent used to create a Battle Forge map. It is separate from `mapSnapshot`:

- `mapSnapshot` is the authoritative battlefield for a saved session.
- the parameter record explains how that battlefield was requested and supplies the deterministic inputs used by generator tooling, staged-fight summaries, legacy recipe fallback, debugging, and future selective regeneration.

A present valid snapshot always wins over regeneration.

## Shape

```js
{
  schema: "forge-map-parameters",
  version: 1,
  generatorVersion: "2.0.0-params.1",

  seed: 42,
  theme: "temple",

  // Requested map family.
  archetype: "bridge-crossing",

  // The grammar that actually produced this Phase 2c map.
  // Non-legacy archetypes are recorded intent until stage ownership lands.
  generatorProfile: "legacy-dungeon",

  stageSeeds: {
    layout: 0,
    height: 0,
    semantics: 0,
    decor: 0,
    foes: 0
  },

  stages: {
    layout: {
      roomCount: 8,
      loopChance: 0.2
    },
    height: {
      mode: "tiered",
      verticalityFt: 5
    },
    semantics: {},
    decor: {
      density: 0.7
    },
    foes: {
      party: 4,
      count: 5
    }
  },

  rules: {
    poolBlocks: false,
    waterBlocks: true
  },

  runtime: {
    retries: 24
  }
}
```

## Authority and compatibility

1. When `parameters` is present and valid, it owns recipe reads. Stale top-level compatibility fields do not override it.
2. New encounter envelopes also retain top-level `seed`, `theme`, `sliders`, `archetype`, and `stageSeeds` so current readers and existing database rows do not require a migration.
3. An older envelope with only those top-level fields is normalized into a version-1 record in memory.
4. An unknown archetype or unsupported parameter-record version stops loudly.
5. Values are canonicalized to safe bounds before saving.
6. The record is JSON-only and deterministic across browser and Node.

## Archetype status in Phase 2c

`legacy-dungeon` is the only active grammar in this slice. The following keys are valid recorded intent for the upcoming stage-owned generator work:

- `valley`
- `canyon`
- `central-hill`
- `ring`
- `split-plateau`
- `bridge-crossing`
- `island-chain`
- `courtyard`
- `cavern-chambers`
- `temple-terraces`
- `ridge`
- `basin`

The UI marks these as **recorded**. Selecting one must not secretly alter geometry before its implementation exists. The saved record therefore keeps:

```js
archetype: "canyon",
generatorProfile: "legacy-dungeon"
```

That distinction is deliberate and test-frozen.

## Next migration

Phase 2d makes `layout`, `height`, `semantics`, `decor`, and `foes` consume their named stage seeds. At that point implemented archetypes may select an active generator profile, and retry/repair can restart only the failed stage without perturbing the others.
