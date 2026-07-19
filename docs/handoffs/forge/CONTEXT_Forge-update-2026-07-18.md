# CONTEXT Forge update · 2026-07-18

Supersedes `CONTEXT_Forge-update-2026-07-16c.md` as the current concise Forge authority. Read with `CONTEXT.md`, `CONTEXT_Forge.md`, and `forge/FORGE_TEMPLE_TERRACES_1.md`.

## Current field verdict

Temple Terraces is implemented as the first intent-owned Forge archetype and remains deliberately labeled **preview** while its shared-table/reconnect field pass is outstanding.

Implemented in this slice:

- generator `2.1.0-temple.1` and profile `intentional-archetype`;
- deterministic axial, switchback, and ring Temple variants;
- broad approach/lower/upper/summit regions at 0/5/10/15 feet;
- required primary ascent and optional nonduplicate secondary route;
- multi-point stairs cut through declared retaining-wall gaps;
- exact connector-purpose, region, route, construction-profile, and stage-fingerprint records;
- Temple/Druidic/Tundra/Volcanic/Cavern/Grass/Swamp construction materials;
- real engine, renderer, Vertical Geometry diagnostics, snapshot, and cache-stamped production integration;
- no Temple bridges and no automatic combatant placement;
- approved DM deployment cards for any number of Party, Ally/NPC, and Enemy groups;
- DM-authored regional flags, deterministic per-group formations, per-unit manual pins, split groups, and local reseeding;
- exact versioned deployment persistence in the map envelope and staged roster;
- exact authored placement at local combat and shared-session start, with the legacy placement path retained for old rows;
- one narrated preview gate while any active group is unresolved;
- staged legacy generation no longer samples decorative 5-ft connectors or selects structural bridges;
- bridge identity/movement/cover/state/replay/audit and explicit selection remain intact for a future bridge-owned archetype.

The approved browser mock preceded implementation. The integrated Workshop was then field-tested in the browser: two groups resolved all 9/9 combatants, Vesperian was manually pinned and survived a party-only reseed, and local combat placed Vesperian in `approach` with five goblins in `summit-sanctuary`. The shared-table/reconnect checklist below remains required before promotion.

## Exact preview boundary

Temple still returns `spawns: []`; terrain generation never places combatants. `forge-deployment.js` resolves only DM-authored groups against the accepted map's intent regions. `templeDeploymentPending()` refuses encounter-promotion doors until every active group has a legal flag and every assigned combatant has one exact non-overlapping cell.

Deployment records are versioned and preserve groups, roles, controller policies, flags, formation seeds, manual pins, and resolved positions. Fresh Temple local combat and shared-session start consume those exact positions. Historical rows without a deployment record keep the established one-time compatibility placement.

Old records remain safe:

- explicit historical generator profiles are retained;
- version-1 snapshot-less recipes keep monolithic legacy regeneration;
- exact map snapshots remain authoritative;
- Temple intent, construction profile, and connector purpose round-trip through snapshots.

## Validation

Focused results:

- Temple Terraces: **37/37**;
- deployment groups: **16/16**;
- parameter/archetype record: **46/46**;
- stage ownership: **36/36**;
- elevations/connectors: **40/40**;
- structural bridge completion: **37/37**;
- bridge/damage: **40/40**;
- snapshot authority: **27/27**;
- unified Forge panel: **22/22**;
- map bridge: **16/16**;
- tactics geometry: **26/26**;
- line of sight/cover: **50/50**;
- placement: **19/19**.

An additional matrix validated **2,520** pure Temple scenes across 120 roots,
all seven construction themes, and 40/44/52-cell map sizes.

The Forge engine remains at its inherited **13/14** result with only `flat mode is level ground` red. Flora remains the inherited extracted-harness failure `Forge stage-owned engine did not load`.

The July 16 handoff recorded 47 passing suites, 7 inherited failures, and 1 timeout. A fresh measurement of the actual base revision on 2026-07-18 produced **49 pass / 8 fail / 0 timeout / 57 total**. The additional inherited red is `smoke-phase2b1-field-round.js`; the prior placement timeout completed green in this environment.

The Temple candidate produces **50 pass / 8 fail / 0 timeout / 58 total**. Its red suite names are identical to the freshly measured base:

- `smoke-cover-contest.js`;
- `smoke-flora.js`;
- `smoke-forge-engine.js`;
- `smoke-phase2b1-field-round.js`;
- `smoke-pick-unit.js`;
- `smoke-tiers-rebase.js`;
- `smoke-token-rig-contract.js`;
- `smoke-unit-art.js`.

No new whole-battery failure remains.

## Evening field report · 2026-07-18

M's Temple Terraces play pass established five concrete facts:

- Dash plus Step of the Wind correctly gave Caim 120 feet of total movement;
- Vesperian's Second Wind incorrectly rolled 0 because the derived class-feature
  tile could reach combat without its own damage formula;
- the Temple wall contract is already 10.5 feet, but the upper defensive edge
  reads as a short wall rather than a consequential 10-foot ascent;
- discovery currently removes undiscovered terrain/object instances, producing
  cyan cutouts and irregular object-shaped holes instead of readable fog;
- seeded maps need a small authored-block layer so a DM can close an unwanted
  bypass without changing the generator seed.

Second Wind now owns `1d10 + fighter level` directly on the derived feature tile,
with explicit sheet text taking precedence. The Vesperian fixture proves `1d10+4`
without a separate action row; the cache stamp is `forge-kit-derive.js?v=b9`.

The approved mock is now implemented by default on every Temple battlefield.
`forge-architecture.js?v=fa4` owns one exact,
snapshot-safe record of wall, parapet, gate, and erase blocks. Ten-foot walls
block movement and sight; five-foot parapets carry their own cover height; gates
remain passable. The required ascent is audited before local combat, Save for
later, or a shared Table can open. Sealing an optional stair explicitly closes
that connector, while the primary ascent remains immutable.

The same Temple path replaces cell removal with region-grey discovery. The
current region is fully colored, entered regions become grey
memory, and unentered regions remain darker grey; terrain, walls, props, and
architectural blocks stay physically present. Workshop exposes the same real
render path through **Preview region fog** and **Advance region**, so it can be
field-checked before a shared session.

The thermal pass is also active. `forge-render-power.js?v=frp1` makes Balanced
the default: 1.25 pixel-density ceiling, 1024px shadows, no ambient idle motion,
one-frame invalidation, and a real hidden-tab pause. High Fidelity preserves the
earlier 1.75 ceiling, 2048px shadows, ambient motion, and continuous rendering as
an explicit local choice. The canonical browser pass confirmed both quality
controls, idle scheduling, region advance, optional-bypass sealing, and reset.

## Midnight field correction · 2026-07-19

The first live save exposed a repaint omission: the exact snapshot retained the
architecture record, but session boot did not restore that record before
`renderField()`, so authored meshes disappeared on reopen. Session boot now
re-seats the version-2 record before rendering. Version-1 records migrate in
memory. Architecture height is absolute and idempotent, so a restored snapshot
cannot apply the same raise twice.

The wall tool now works on seeded Temple retaining-wall cells. An open cell gets
a 10-ft wall; a seeded retaining wall gets a 10-ft upward extension and absolute
movement/sight authority at its new total height. Water and void remain invalid,
and seeded walls cannot silently become gates or short parapets.

Region grey is presentation, never creature authority. A whole occupied region
still restores full colour, but any cell visible through canonical line of sight
also restores colour across a region boundary. Enemies through an open doorway
therefore appear before the party enters their room; walls still hide them.

The 12:45 AM live field pass proved the preview query itself was a product bug:
normal Temple URLs omitted the builder and fell back to the legacy terrain-removal
fog, recreating the blank cyan void. Architecture and region-grey discovery now
activate from Temple intent alone, including historical Temple sessions with no
architecture record. The ordinary `/forge/` browser path, with no architecture
parameter, shows the builder and retains the complete grey battlefield.

Correction validation: architecture **33/33**, performance/architecture
integration **20/20**, promotion visibility **17/17**, and discovery **48/48**.
The focused gate is **20/22 suites green, 916 checks green**. Its two red suites
are the unchanged inherited `flat mode is level ground` engine case and the
older Phase 2b.1 authoring-preview ordering assertion.

## Required field checklist

1. On the live signed-in site, open a Temple Table with at least Party and Enemy flags.
2. Confirm the staged row retains exact group roles, controller policies, and positions.
3. Roll Initiative and confirm every unit appears on its authored cell on two devices.
4. Reconnect both devices and confirm the same positions reconstruct from the saved row/replay state.
5. Save for later, reopen, and repeat the exact-position check.
6. Save/reload a legacy encounter and confirm historical placement remains unchanged.
7. Compare Volcanic construction once a Workshop Volcanic selector is exposed; the renderer profile exists, but the current biome control does not expose it.
8. On a normal Temple URL with no architecture flag, save one optional-bypass wall, reconnect,
   and confirm its 10-ft movement/sight authority and closed connector restore.
9. In Player View, move from approach through each Temple region and confirm the
   whole current region restores color while every other region remains present.
10. Compare laptop heat/fan behavior in default Balanced against High Fidelity.

## Immediate execution order

1. Run the signed-in shared-table/reconnect deployment and architecture checklist.
2. Compare Balanced and High Fidelity on M's actual laptop during a full round.
3. Remove the architecture flag only after saved-block and region-fog reconnects pass.
4. Promote Temple from `preview` to `active` only after those checks pass.
5. Expose/settle the Volcanic Workshop construction control.
6. Build `bridge-crossing` on the same intent contract.

Do not begin `bridge-crossing` by re-enabling random legacy bridge selection. Purpose and archetype ownership come first.

## Deployment discipline

M reviews, commits, and pushes. Codex does not push. Current slice stamps:
`forge-deployment.js?v=fd1`, `forge-generator-foundation.js?v=g2g1`,
`forge-temple-terraces.js?v=tt1`, `forge-engine.js?v=fe10`,
`forge-render-power.js?v=frp1`, `forge-architecture.js?v=fa4`, and
`forge-kit-derive.js?v=b9`.
