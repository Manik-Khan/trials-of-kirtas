# CONTEXT_Forge update · 2026-07-13e

Supersedes `CONTEXT_Forge-update-2026-07-13d.md` as the current short Forge handoff. Earlier geometry, camera, token-rig, character-authority and generator-foundation records remain authoritative for their own decisions.

## Phase 1.5e built

The exact Phase 1.5d production `topography-test-mock.html` that M field-tested was used as the base.

### Feed legibility

- The right-side Game Feed is now nearly opaque with restrained blur.
- `.fg-frow` is reset to a full-width block so outcome backgrounds no longer sit inside a narrow flex fragment.
- Mechanical results use clean system typography; narration remains italic but larger and higher contrast.
- Action/verdict leads, d20 math is secondary, and damage/healing is enlarged.
- Hit/miss/crit/save/heal/effect rows retain subtle color treatments.
- Geometry/occluder instrumentation is collapsed under **Geometry details**.
- Tapping the damage total expands/collapses supplied damage-stack detail.

### Persistent effect ledger

New pure UMD module: `forge/forge-effects.js` v1.0.0.

- Effects are additive operations inside existing `payload.effects`; no new protocol event kind or database migration.
- Effect state is reconstructed from the same append-only log on every echo and refresh.
- Restore branches, overrides, initiative reorders and deterministic source-turn duration are supported.
- The local sandbox uses event-shaped rows and local rewind snapshots carry them.

### Sanctuary complete

- Casts with the Phase 1.5d slot chooser and the caster's real save DC.
- Wards a chosen ally for ten caster turns.
- Gold status appears over the 3D standee or top-down token and on initiative.
- Hidden foes cannot be leaked by effect badges.
- Direct harmful attacks/spells require an attacker Wisdom save before the attack roll/effect resolves.
- Failure lets a player choose another target or lose the attack; foe AI chooses a legal alternative or loses it.
- AoE bypasses the incoming direct-target gate.
- The ward ends when its creature attacks, deals damage or casts a harmful spell affecting an enemy.
- Application, save, removal and expiration are readable shared feed facts.

## Validation

- effect ledger: 31 green
- Phase 1.5e integration contract: 25 green
- table correctness/feed: 28 green
- retained Phase 1.5d contract: 20 green
- token proxy: 7 green
- automatic art: 6 green
- **117 checks green total**
- four runtime JS files and all three executable inline HTML scripts parse.

The complete historical repo battery was not rerun because a full checkout was unavailable in the sandbox. Browser/WebGL and live two-device behavior still require M's field pass.

## Next order

1. Browser-eyeball Phase 1.5e, especially the bright-map feed, Sanctuary pass/fail, refresh and rewind.
2. Phase 1.5f: party-shared three-state world-space fog.
3. Direct-attack firing-position preview: green / yellow / orange / dark-hatched, with Cover Contest beside it.
4. Phase 2 terrain: active archetypes, elevations, connectors, semantic spawns/objectives, validation and repair.

## Deploy rule

M uploads, commits and pushes. Return repository-shaped files; do not push.
