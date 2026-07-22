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
- DM-authored regional flags, deterministic per-group formations, per-unit manual pins, explicit per-unit group menus, removable/split groups, and local reseeding;
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

The same Temple path replaces cell removal with geometry-preserving discovery.
Each cell follows canonical combat line of sight: visible cells are colored,
previously seen cells become grey memory, and unseen cells remain darker grey;
terrain, walls, props, and architectural blocks stay physically present.
Workshop exposes the same real sight calculation through **Preview sight fog**
and **Move preview eye**, so it can be field-checked before a shared session.

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

The wall tools now work on seeded Temple retaining-wall cells. An open cell gets
the selected block; a seeded retaining wall accepts either a 10-ft wall or 5-ft
parapet upward extension with absolute movement/sight authority at its new total
height. Water and void remain invalid, and seeded walls cannot become gates.

Geometry grey is presentation, never creature authority. Region and terrace
membership no longer participate. Creature disclosure now uses the same
`losVerdict` as attack targeting: if Staff View can legally target an enemy from
a player cell, Player View discloses it; total cover still hides it.

The 12:45 AM live field pass proved the preview query itself was a product bug:
normal Temple URLs omitted the builder and fell back to the legacy terrain-removal
fog, recreating the blank cyan void. Architecture and geometry-grey discovery now
activate from Temple intent alone, including historical Temple sessions with no
architecture record. The ordinary `/forge/` browser path, with no architecture
parameter, shows the builder and retains the complete grey battlefield.

The 9:05 AM field pass rejected region fog outright: it made nearby terrain grey
while distant terraces remained colored, and the earlier strict perception ray
could hide foes that combat already allowed players to attack. The live path now
uses per-cell discovery states only and discovery authority is `1.4.0`
(`forge-discovery.js?v=fd6`).

The 10:18 AM deployment pass rejected focus-dependent membership and the old
bestiary-replaces-fallback rule. Deployment authority v2 gives every assigned
or unassigned combatant an explicit group menu; moving a unit removes it from
its prior group, and removing a group leaves its units safely unassigned. Base
goblins now remain stable while bestiary picks are added with collision-free
IDs; the base count can be set to zero for a fully custom roster. The 10:22 AM
window test also proved the connected terrain mask was still an improper
creature gate. Terrain keeps that visual cleanup, while foes now use a direct
`losVerdict` from the current player sight source.

Correction validation: **450 checks green across 13 focused suites**. The real
Workshop render kept the whole Temple present, moved the colored sight footprint
cell-by-cell when the preview eye moved, and retained grey memory behind it.
The broader correctness-wave suite remains **30/31** on its unrelated inherited
reduced-motion marker string assertion.

## 11:25 AM field correction · reciprocal sight and foe-turn direction

The next live pass proved that the direct creature gate was still too binary.
It reused one boolean for both rendering and legal targeting, so a foe with a
one-way line on the player disappeared completely until the player crossed the
exact sampling boundary. Discovery authority is now `1.5.0`
(`forge-discovery.js?v=fd7`) and returns three creature states:

- **clear** — the player has canonical combat sight and may target the foe;
- **soft** — distant legal sight, or a reverse-only sightline where the foe can
  see the player; the token remains grey/subdued, but reverse-only sight does
  not manufacture a legal player shot;
- **hidden** — total cover in both directions.

Prep deletion is no longer a small link below the formation controls. Every
group card has an explicit **Delete** control in its header. Deleting a group
leaves its members under Unassigned; the final required group keeps a disabled
Delete control with a reason instead of silently removing the last assignment
destination. The real Workshop browser pass deleted the five-foe Enemies group
and preserved all five goblins under Unassigned.

The same field report exposed the exact Archer failure. `MonsterActor` already
parses every 5e.tools attack, including the longbow, but `foeKitFromStatblock()`
currently keeps only the first attack as `u.atk`. Archer stat blocks lead with a
melee attack, so `foeTurn()` advances instead of considering its ranged weapon.
The approved-next UX is staged in
`_edits/mock-forge-enemy-turn-control.html`: Automatic runs a narrated real-
stat-block choice on enemy turn start, including in Player View; Manual exposes
the foe's parsed actions and leaves movement, target, action, and End Turn to
the DM. Do not wire this control into production until M approves the mock.

This correction is **337/337 green across 10 focused suites**. The broader
correctness-wave suite remains at its inherited **30/31** reduced-motion marker
string assertion. Browser validation covered the real prep deletion flow and
both Automatic and Manual states of the standalone enemy-turn mock.

## Afternoon enemy-turn implementation · 2026-07-19

The approved Automatic/Manual enemy-turn mock is now integrated. The exact
Archer failure was an adapter loss, not missing bestiary data: `MonsterActor`
parsed Shortsword and Longbow, while the Forge retained only the first attack.
`monster-actor.js?v=ma2` now preserves every parsed attack and a normalized DM
reference record for creature profile, lore, senses, defenses, traits,
spellcasting, bonus actions, reactions, and legendary actions.

`forge-foe-ai.js?v=fai1` is a pure planner. It evaluates every parsed attack,
living player target, and legally reachable firing origin through the real
`reachOK()` geometry. Expected damage, cover, long-range disadvantage,
movement cost, and target wounds contribute to the choice. The feed narrates
weapon, range, cover, and movement before the ordinary attack/reaction
pipeline runs. A real Archer known answer selects Longbow at 55 feet instead
of advancing with Shortsword.

The Forge Table Settings now owns **Enemy turns: Automatic / Manual** as a
local DM preference. Automatic schedules on enemy turn start, including while
the DM is testing through Player View. Manual exposes the same Forge HUD used
by player characters: executable parsed attacks plus Info, Traits, Spells,
Bonus, and Other reference tabs; movement, target selection, action, and End
Turn remain under DM control. Player View continues to mask the active enemy
HUD intentionally.

Reference is not false automation. Attack entries with parseable hit and
damage mechanics are executable now. Multiattack prose, save abilities,
complex spellcasting, reactions, and legendary actions remain readable in the
drawer until each has a real rules projection. This preserves the full
statblock without inventing mechanics.

Goblin, goblin-archer, and chieftain sprites now select by statblock/name and
receive deterministic palette variants. Other monster types use their existing
resolved 5e.tools token as an upright 3D standee, with initials as the offline
fallback. `assets/CREDITS.md` records additional official CC0 character-pack
candidates; none were imported in this slice.

Validation for the new authority is **30/30** known answers across the foe AI,
MonsterActor, and real production adapter/HUD extraction. A focused 23-suite
matrix produced 19 green suites and four inherited reds: the two established
reduced-motion string assertions plus stale discovery/unit-art cache-marker
contracts. Core geometry remained 4/6 suites green, with only the documented
`flat mode is level ground` and extracted flora harness failures. The browser
pass loaded all three new cache stamps, ran multiple automatic goblin turns,
narrated tactical choices, paused correctly for Shield, held a foe in Manual,
and resumed Automatic without a reload.

Current field follow-up: run one live Archer and one spellcaster through Staff
View, confirm the Archer chooses Longbow in real terrain, inspect every reference
tab, then exercise Manual movement/attack/End Turn in a signed-in DM session.

## Late-afternoon field correction · death saves, party sight, and class resources

The next play pass exposed a shared cause behind the remaining visibility
unfairness: creature disclosure still asked only the current player's sight
source, while enemy planning considered the party. Player View now discloses a
foe when any conscious party member has clear or reciprocal combat sight. That
party disclosure affects recognition only; the current character's own sight
still decides whether their attack is legal.

Downed player characters now enter the 5e death-save loop instead of retaining
their normal HUD. Movement, attacks, spells, items, and self-healing are locked;
their turn offers one d20 death save. A natural 1 adds two failures, 10+ adds one
success, three successes stabilize, three failures mark the character dead, and
a natural 20 restores 1 HP. The counters are replayable, survive reconnect and
rewind, and stable/dead initiative seats skip normally.

Liadan's Bardic Inspiration pool and executable bonus-action tile are restored.
Hexblade's Curse is a persistent 30-ft curse with expanded critical range,
proficiency damage, and kill-healing. Hex retains its one-hour concentration
record and can move from a defeated target without another spell slot. GOD MODE
can now add or remove tracked resource uses or restore every tracked resource on
a combatant through the authoritative edit event.

Incomplete seeded Goblin records receive their canonical Scimitar and Shortbow
fallback, and Manual enemy control now remains visible while the DM tests through
Player View. HUD tiles dispatch the runtime action identity, and initiative-strip
targeting uses the real camera-pair helper. The browser pass selected a real
Goblin Shortbow, selected Caim from initiative, and reached the explicit attack
review without a fresh console error.

The requested hold-and-drag wall-line workflow is staged for approval in
`_edits/mock-forge-line-builder.html`. It edits seeded cells, previews each line,
repeats while an arrow is held, and commits a whole line as one undo operation.
It is intentionally not wired into production until the mock is approved.

Focused validation is green: death saves **16/16**, effects **44/44**, kit
derivation **346/346**, manual foe HUD **14/14**, table correctness **31/31**,
board **26/26**, engine **14/14**, map bridge **16/16**, tactics geometry
**26/26**, line of sight/cover **50/50**, placement **19/19**, and flora
**22/22**. The two stale harness expectations noted earlier were updated to the
current stage-owned engine and reduced-motion implementation; they now execute
the real production functions rather than failing on obsolete source strings.

## Positional enemy-planner pass · 2026-07-21

`forge-foe-ai.js?v=fai2` now distinguishes a legal shot from a tactically sound
firing position. Ranged choices value safe normal-range distance and elevation,
avoid squares threatened by a player, penalize cover and long-range disadvantage
more strongly, and keep an existing firing lane when movement would only expose
the attacker. Melee choices still close through the canonical movement and
diagonal-choke geometry.

Automatic planning receives only opponents the active foe can presently see
through terrain. It does not receive player spell lists, resource counts, or
hidden positions. A foe with executable attacks but no perceived opponent holds
position and says why; this is distinct from the existing fail-closed narration
for a stat block with no mechanically parsed attack. Automatic/Manual ownership
and the ordinary attack, reaction, and replay pipelines are unchanged.

Focused validation is **182/182 green** across foe AI/HUD, tactics geometry,
line of sight and cover, combat rules, and Fix Pack A. In the real local Forge,
three Goblins kept 50–60-foot firing lanes and used Shortbows through the full
attack/Shield/damage flow. The feed narrated the chosen range and reason, and no
new browser error appeared. A visible difficulty scale was deliberately not
added without an approved mock. Encounter-region activation remains the next
architectural phase.

## Encounter-region activation · 2026-07-22

The approved standalone mock at
`_edits/mock-forge-encounter-region-activation.html` is now implemented on the
shared Table path. `forge-encounter-regions.js?v=fer1` is the pure authority.
Deployment still owns exact positions; a separate `encounterRegions` record saved
with the session owns only when each group joins initiative. Defaults are party and
allies active at initiative, enemies activated when a conscious party unit first
enters their selected intent region. Each group can instead be authored as active at
initiative or DM-activated in the existing deployment card.

All combatants roll before round 1. Waiting groups remain on their authored cells and
keep those results, but do not receive initiative seats. Region entry, a legal hostile
action against a waiting member, or the overseer's Encounter regions control publishes
`encounter_region_activated`. Replay inserts the held seats without reordering existing
seats, resumes the same active creature, and preserves spent movement/action/bonus and
reaction state. Duplicate activation facts are inert; restore rewinds activation.
Historical rosters without encounter-group fields retain the old all-active behavior.

Activation and discovery are deliberately independent. Activating a hidden group does
not reveal it; seeing a group does not activate it. Player View receives the generic
“Another group joins the fight” system line, while Staff View names the group and cause.

Focused validation is **438/438 green** across encounter activation, protocol, replay,
board verbs, effects, deployment, initiative, engine, map bridge, tactical geometry,
line of sight/cover, placement, flora, and the current Phase 2 trust/privacy harnesses.
The local Temple Workshop rendered both activation modes with no browser errors. The
signed-in two-device Table remains the field gate because localhost has no site session.

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
9. In Player View, confirm visible cells restore color across terrace boundaries,
   out-of-sight cells remain grey, and no terrain disappears.
10. Confirm any foe Staff View permits a PC to target is visible to that PC in
    Player View, while a foe behind total cover remains hidden.
11. Compare laptop heat/fan behavior in default Balanced against High Fidelity.

## Immediate execution order

1. Run the signed-in two-device activation checklist: held rolls, region entry, hostile-action activation, DM activation, reconnect, and Player View narration.
2. Run the signed-in shared-table/reconnect deployment and architecture checklist.
3. Compare Balanced and High Fidelity on M's actual laptop during a full round.
4. Recheck saved-block and geometry-fog reconnects on the normal Temple URL.
5. Promote Temple from `preview` to `active` only after those checks pass.
6. Expose/settle the Volcanic Workshop construction control.
7. Build `bridge-crossing` on the same intent contract.

Do not begin `bridge-crossing` by re-enabling random legacy bridge selection. Purpose and archetype ownership come first.

## Deployment discipline

M reviews, commits, and pushes. Codex does not push. Current slice stamps:
`forge-deployment.js?v=fd2`, `forge-generator-foundation.js?v=g2g1`,
`forge-temple-terraces.js?v=tt1`, `forge-engine.js?v=fe10`,
`forge-render-power.js?v=frp1`, `forge-architecture.js?v=fa4`, and
`forge-discovery.js?v=fd7`, `forge-kit-derive.js?v=b9`,
`forge-foe-ai.js?v=fai2`, `forge-hud.js?v=b3`, and
`monster-actor.js?v=ma2`. Encounter activation adds
`forge-encounter-regions.js?v=fer1` and bumps `forge-protocol.js?v=fpr2`,
`forge-replay.js?v=fb15`, `forge-effects.js?v=fe6`,
`forge-pipeline.js?v=fb8`, and `forge-board.js?v=fb8`.
