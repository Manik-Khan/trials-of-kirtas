# Forge Stage Ownership 1

Status: Phase 2d canonical contract.

The active legacy grammar now runs as:

`layout → height → semantics → decor → foes`

Each stage owns one deterministic seed from the versioned parameter record.
The root seed derives defaults, but runtime code must consume the named stage
seed rather than reopening one shared random stream.

## Isolation rules

- Changing `height` cannot change layout, semantics, decor, or foes.
- Changing `decor` cannot change layout, height, semantics, or foes.
- Changing `foes` changes only party/foe placement.
- Changing `semantics` may relabel rooms and semantic props, but cannot rewrite
  layout, heights, or spawn placement.
- Changing `layout` may change every downstream result because downstream
  stages consume the resulting topology; it is the sole topology owner.

Every generated map records stage seeds, per-stage attempt counts, and
fingerprints in `meta.stageOwnership`.

## Retry rule

A failed layout advances only the layout attempt seed. A failed spawn placement
advances only the foes attempt seed. No whole-pipeline root-seed increment is
allowed in the staged profile.

## Compatibility

Version-1 parameter records predate stage ownership. When no saved snapshot is
available, they continue to use the `legacy-dungeon` monolithic profile.
New version-2 records use `stage-owned-legacy`.

`mapSnapshot` remains authoritative regardless of recipe profile.

## Archetypes

Stage ownership does not claim that Canyon, Bridge Crossing, Valley, or other
recorded archetypes have new terrain grammar yet. They continue to use the
legacy room-and-corridor layout until the archetype-terrain slice.
