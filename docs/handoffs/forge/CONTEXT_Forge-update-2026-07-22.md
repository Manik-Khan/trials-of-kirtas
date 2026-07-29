# CONTEXT Forge update · 2026-07-22

Supersedes `CONTEXT_Forge-update-2026-07-16c.md` as the current concise Forge authority. Read with `CONTEXT.md`, `CONTEXT_Forge.md`, and `forge/FORGE_TEMPLE_TERRACES_1.md`.

Reconciled **July 23, 2026** against the current `main`/`origin/main` source and
the character-sheet progression/rail field pass. The dated validation paragraphs
below preserve the order in which slices landed; later focused results supersede
earlier inherited-red statements for the same suite. Source merged to Git is not
by itself proof of a signed-in Netlify field pass.

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

`forge-foe-ai.js?v=fai3` now distinguishes a legal shot from a tactically sound
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

## Encounter Read Workshop integration · 2026-07-22

The approved `_edits/mock-forge-encounter-read.html` is now integrated into the
canonical Workshop. `forge-encounter-read.js?v=fread1` is the pure dual-export
authority; `forge/index.html` is only its live-data and presentation adapter.
The read uses the selected combat-ready party's actual levels and current/max HP,
the authored foe roster's real stat-block CR, standard adjusted-XP thresholds,
enemy/party action count, map elevation, and Encounter Region activation state.

Opening wave and Full roster are separate views. Explicitly waiting Temple groups
are omitted from the opening estimate even while their deployment is still a draft;
the session path remains stricter and saves/applies encounter-region fields only
after deployment resolves. Warnings narrate the meaningful context the numbers do
not: action advantage, held waves, party HP readiness, elevation, and missing CR.
There is no named “lazy line” and no rehearsal simulator in this phase.

Creature suggestions reuse the existing Bestiary. Related enemies derive from the
selected roster's creature-family metadata (for example goblin, hobgoblin, bugbear,
and worg relationships), while Any creature samples several nearby CR bands. Every
group shows the calculated effect of adding one creature before `+ Add`; the full
Bestiary remains the complete search door. Suggestions do not silently add foes.

Focused validation is **31/31 green** for the pure calculator and production
contract. Local browser checks covered real party levels/HP, related and Any creature
lists, explicit add-to-roster recalculation, full-Bestiary narration, and the Temple
opening/full split. A clean fresh-tab run reported no browser errors.

## Workshop workflow correction · 2026-07-22

The approved `_edits/mock-forge-workshop-flow.html` is now integrated into the
canonical Workshop without changing the generator, deployment, Encounter Read,
or combat authorities. The pre-session panel is organized as **Encounter →
Battlefield → Deployment → Advanced**, with a persistent party/enemy/threat/map
summary.

Encounter Read, creature suggestions, and the full Bestiary are available before a
replacement map is generated. Battlefield recipe changes now become visibly pending;
biome, archetype, rooms, loops, decor, and seed do not replace the current field until
**Generate map** is pressed. The base foe count remains an encounter edit and
recalculates immediately.

Deployment no longer disappears on an unsupported field. It explains that the
current map lacks authored regions and offers a Temple Terraces shortcut which
selects, but does not silently generate, that recipe. Once Temple is generated the
same step reveals the existing exact group/flag/activation authoring. Camera,
rendering, vertical diagnostics, architecture, experimental imports, and roadmap
cards are collapsed under Advanced. Shared Table mode retains its narrower combat
settings path.

Validation is **20/20** for the new workflow contract and **30/30** for the
updated unified-panel contract. The focused Workshop/generator/deployment matrix
is **326/326** green; the four canonical engine/geometry/cover/flora suites add
**116/116**. The real browser pass covered the initial Encounter Read,
pending Temple selection without map replacement, explicit Temple generation,
Temple deployment reveal, unsupported-map deployment narration, the Temple
shortcut, collapsed Advanced tools, and the 390px layout with no new console
error.

## Generated-field startup correction · 2026-07-28

The live `/forge/` and `/forge/index.html` routes were correctly serving the same
document, and party confirmation correctly restored all five selected heroes. The
remaining “broken world” report was the startup height source: production still
booted `mode='traced'`, immediately rebuilt the Chen Yue reference prototype, and
then mislabeled that submerged experimental field as the current generated map.

The Forge now boots the existing generated-tiers path with seed controls active.
The Chen Yue traced art remains available among the existing experimental height
sources; it is no longer the battlefield a normal Workshop or new table inherits.
Changing a recipe still marks it pending, and **Generate map** still performs the
explicit replacement.

## Saved-session bootstrap correction · 2026-07-28

The supplied live session
`b3bbb4c8-b062-48ad-b4bb-791dd60c21b3` isolated the remaining broken-world
report. The saved row never reached snapshot restoration. Because session
identity is available before the initial field paint, Table mode exposed the
architecture audit during that paint; `rawCombatMapFromF()` then called
`TG.makeMap` before the later tactical block had assigned `TG`. The resulting
startup exception left the party handshake waiting until its six-second timeout
and exposed only the placeholder world.

`architectureAudit()` now remains inert until `TacticsGeo.makeMap` exists. Once
geometry is initialized, the same function resumes the canonical audit against
the restored combat map; snapshot, architecture, discovery, and replay authority
are unchanged. The extracted production-function regression proves both the
pre-geometry no-op and post-geometry audit path. The focused architecture suite
is **29/29** and the complete Forge smoke battery is **77/77 scripts**. The exact
signed-in session URL remains the post-deploy browser gate.

## Map-first encounter and placement correction · 2026-07-22

The approved `_edits/mock-forge-workshop-builder.html` is now integrated into
the canonical Workshop. The core order is **Map → Encounter → Placement**, with
Settings continuously reachable from the same top-left Forge menu. The Map step
opens first. Recipe changes remain pending until **Generate map** is pressed.

There is no implicit base-goblin encounter. Every enemy is chosen for this
encounter from the existing Bestiary or saved shelf, and newly chosen enemies
join the existing Enemy placement group without disturbing a deliberate manual
unassignment. Encounter Read authority entered this phase at version 2; the
current composition correction is version 3
(`forge-encounter-read.js?v=fread3`). Easy, Medium, Hard, and Deadly targets
expose their standard adjusted-XP bands as a visible budget. The roster
suggestion uses actual Bestiary CR and the same count multiplier; in Related
mode, an existing creature family narrows the candidates. Suggestions remain
editable, and Any creature plus the full Bestiary remain available.

Deployment authority is version 3 (`forge-deployment.js?v=fd3`). The existing
group cards, membership menus, Party/Ally/Enemy roles, controller policy, map
flags, deterministic formation seeds, manual pins, reseed, split, delete, and
unassigned list are unchanged. Authored intent regions remain strict when a map
provides them. A map with no authored regions now derives a connected walkable
placement area from the exact flag cell; it does not invent a starting region.
Local combat and shared staging consume the same exact deployment record on
every generated map, while version 1 and 2 saved records remain readable.

Encounter activation is optional metadata on a flag, not a required placement
step. Flags are active at initiative by default. **Automate this flag** reveals
the supported activation controls only when checked: region-aware maps may use
party entry or DM activation; regionless maps expose DM activation. The
encounter-region authority and saved record remain separate from positional
deployment.

Focused validation is **321 checks green** across deployment, Encounter Read,
Workshop flow, unified panel, Temple, encounter regions, engine, map bridge,
tactical geometry, line of sight/cover, placement, and flora. The real local
Forge browser pass proved Map-first entry, Medium→Hard budget switching, a
four-creature Hard roster suggestion, automatic assignment into the existing
Enemy group, optional automation disclosure, and a regionless party flag
resolving 4/4 positions on connected walkable ground. No new runtime error
appeared after the corrected reload.

## Explicit party authority correction · 2026-07-22

The live Workshop field report exposed two independent party sources. Encounter
Read treated every `characters` table row as the party, including delete-marked
and out-of-folder rows, while the cinematic selector still rendered a static
six-character mock. Its **Enter the Forge** door also called the old re-forge
path, which regenerated the map and could enter an empty combat preview instead
of returning to Workshop authoring.

`forge-party-selection.js?v=fps1` is now the pure selection authority. The local
selector loads current `CharacterData` rows and the shared roster layout, removes
delete-marked and duplicate keys, and offers only active members of the folder
named `Campaign Characters`, `Player Characters`, `Player`, or `Players`.
Missing folder/layout access fails closed with a narrated empty selector; it
never falls back to every database row or the old static roster. **Select all
party** means all eligible rows in that folder.

The selected keys are now the sole PC input to `buildRoster()`, Encounter Read,
CR thresholds, Workshop summary, and deployment reconciliation. An empty
selection remains zero heroes. Confirming the party returns directly to the
Encounter step on the current map, refreshes the existing placement groups and
flags, and does not call the old `__enterForge`/map-regeneration path.

Focused party/Workshop/Encounter/deployment validation is **183 checks green**.
All **56** currently green Forge suites remain green. The wider battery still
contains 15 inherited/stale red suites (cache-stamp contracts, extracted harness
dependencies, and the known boulder-cover expectation); none touches the party
authority files. The unsigned localhost browser proved the new fail-closed
state and removal of the static roster, but cannot read the private
`roster_layout` row. The signed-in live folder/selection round trip is therefore
the remaining field gate.

## Story-shaped roster composition correction · 2026-07-23

The first live target-roster field pass exposed that the version-2 adapter did
not compose encounters. It tested one Bestiary row at a time against counts 1
through 12, then chose the numerically closest result. Seven Apes was therefore
the expected output of the code even though it was a poor encounter suggestion.

`forge-encounter-read.js?v=fread3` now owns roster composition as a pure,
known-answer function. The XP wallet remains a guardrail, not the source of the
story. Automatic suggestions evaluate explicit encounter concepts:

- one higher-CR leader with a lower-CR retinue;
- a two-role team of related creature types;
- a solo threat;
- a capped one-stat-block squad only when no mixed concept is a better fit.

The composer infers readable combat roles (leader, controller, artillery,
skirmisher, defender, or bruiser) from the actual 5etools stat block. Explicit
families such as goblinoid, gnoll, undead, demon, primate, and canine outrank
broad type or habitat matches. Generic humanoid tags such as `any race` are not
story relationships. Existing authored creatures are preserved as story roots,
and completion adds only compatible reinforcements. Automatic compositions cap
the whole encounter at six creatures and any one repeated stat block at four;
the UI reports the concept, roles, relationship, adjusted XP, and whether the
result actually lands inside the requested band.

The four-level-party known answer replaces the former seven-Ape result with one
Bugbear Chief and three Goblins at 1,700 adjusted XP. A real 450-monster Monster
Manual pass completed in 96–145 ms and produced coherent family concepts across
Easy, Medium, Hard, and Deadly. Encounter Read validation is **41/41 green**.
The role vocabulary and encounter-concept approach are attributed in source to
*The Lazy GM's 5e Monster Builder Resource Document* by Teos Abadía, Scott
Fitzgerald Gray, and Michael E. Shea (CC BY 4.0).

## Character-sheet source alignment · 2026-07-23

The Caim/Cosmere field reports exposed an identity and projection split, not a
second party-authority design. `forge-party-selection.js?v=fps1` still owns the
exact selected subset. Forge now resolves those selected keys against the
current live `CharacterData` rows before `buildRoster()` and kit derivation.

The current contracts are:

- `character-sheet-projection.js?v=cp1` owns the effective structural read.
  Modern `structural.spellcasting` wins over a stale legacy
  `structural.spells`; durable spell/feature corrections apply once there.
- `forge-kit-derive.js?v=b12` consumes that projection. A modern Zariel Tiefling
  no longer regains hard-coded Hellish Rebuke after the authoritative list
  removes it. Genuine old rows can still use the legacy fallback.
- Cosmere's current Supabase key is `cosmererunestar-ae1a`; `cosmere` is a
  compatibility identity only. Existing sessions using the retired key resolve
  to the current row, while new tables await live character identity and save
  the current key. Shield remains valid through his Sorcerer multiclass
  provenance, not Hexblade.
- The nightly character export writes the canonical current-key backup and
  refreshes stable compatibility aliases with an explicit `sourceKey`. JSON
  backups are not a competing runtime source.
- Modern Soul Shards reforges remove carried-forward `structural.spells`;
  `schema_delta_character_spell_source_cleanup.sql` is the matching one-time
  cleanup for already-saved modern rows.

Relevant source-alignment, sheet, reforge, Forge identity/derivation, exporter,
and canonical Forge smokes total **748 known-answer checks green**. All touched
JavaScript passed `node --check`. The older jsdom sheet-mount smoke is unavailable
in this checkout because `jsdom` is not installed. Local Forge loaded; local
Party redirected to login, so signed-in deployed verification remains the field
gate.

## Character presentation and derivation follow-up · 2026-07-23

The combat-feed identity leak was a module boundary, not a character rename.
`CB` is intentionally scoped inside the Forge module, while the classic
table-correctness helper attempted to read `window.CB` and therefore fell back
to raw keys. The production surface now publishes only a narrow display-name
resolver; table correctness also consults the saved roster during cold session
mount. `cosmererunestar-ae1a` and `foe-picked-*` remain protocol/database keys,
while the feed renders **Cosmere Runestar** and the creature's authored name.

The source audit also found that `weapon-actions.js` correctly derived
Agonizing Blast's Charisma modifier, but the final Forge dedupe allowed the
generic Spells-tab Eldritch Blast tile to discard that exact assembled action
math. The surviving tile now retains the assembled attack-cantrip hit, damage,
damage-stack, and critical-dice fields. Cosmere's level-4 known answer remains
`1d10+3`. A live-row derivation exception now remains a narrated disabled error
kit instead of silently dropping into a familiar starter kit.

Focused identity/source validation is green: table correctness **35/35**,
starter/live-source selection **28/28**, Agonizing Blast **8/8**, canonical
projection **12/12**, and Forge kit derivation **346/346**. The canonical engine,
map bridge, tactical geometry, line of sight/cover, placement, and flora suites
add **151/151**. All touched JavaScript passed `node --check`; inline production
scripts parse and `git diff --check` is clean. The signed-in live-row/browser
round remains the deployment field gate, and the older sheet-mount smoke still
cannot run because `jsdom` is absent.

## Character progression and rail reconciliation · 2026-07-23

The approved Soul Facets sheet mock has been built on the real full and mounted
v11 sheets. This does **not** create a new Forge character authority:

- `sheet-progression.js?v=facets1` exposes **Level Up**, **Facets of the
  Shard**, and **Enter the Shift** on both sheet surfaces.
- Level Up enters the existing Shard Reforger with the same character key and
  one selected class. A successful save advances that class once and updates
  the existing `characters` row.
- `soul-facets.js?v=facets1` stores the prior mechanical form in
  `structural.soulFacets`. Facets exclude prose, prior Facets, and Soul Lineage;
  identical forms deduplicate and retention is capped at the latest 40.
- `structural.soulLineage` can display the current Soul Fragment plus optional
  Fragments and Refractions. It and Facets are read-only today: restore,
  cross-campaign linking, Shift authoring, and unlock rules are not built.
- Durable corrections, Soul Lineage, appearance, authored actions, and other
  non-generated sheet work survive the Level Up/Reforge merge. Modern
  spellcasting still removes the retired `structural.spells` field.
- A new Forge encounter reads the same current character row through
  `CharacterSheetProjection` and therefore sees the new level. Facet/Lineage
  metadata is inert to kit derivation. An active fight does not silently import
  a mid-fight level; its event log remains authoritative.
- No progression SQL is required. Facets and Lineage live in the existing
  structural JSON. The separate one-time spell-source cleanup SQL below is
  still required for old modern rows.

The rail changes are adjacent site work, not Forge protocol work. The Characters
tab now scrolls independently on iPad and offers either a mounted sheet or the
full sheet page. The rail Feed is the in-the-moment table composer/log, distinct
from the full `chronicle.html` Feed page; its session chip displays the current
session but does not switch it. Staff **+ New Section** writes a joint Chronicle
section in that current session.

Focused progression/rail validation is **245/245**: Facets 17, Level Up 10,
Shards Forge 18, reforge preservation 20, sheet mount 30, sheet attacks 49,
Characters tab 26, sheet corrections 16, and rail 59. The sheet-mount result
used a temporary jsdom dependency; the root project still does not declare
jsdom, so that smoke is not portable from a clean checkout without supplying
it. The browser field harness covered full/mounted drawers, multiclass choice,
Lineage presentation, iPad-contained mounting, and a real Rapier result card.

The July 24 candidate closes the merge-audit label defect:
`forge/index.html` LoS refusal narration and its two diagnostic fixtures now
say **12 body samples**, matching canonical geometry.

## Signed-in character-source field pass · 2026-07-23

The deployed Party and Forge pages carry the expected source-alignment stamps:
Party imports `sheet-mount.js?v=src1`; Forge loads
`character-sheet-projection.js?v=cp1`, `forge-kit-derive.js?v=b12`, and
`forge-party-selection.js?v=fps1`.

The live Forge selector showed exactly Caim, Chonkalius, Cosmere Runestar,
Líadan Luchóg, and Vesperian Vale. It excluded the unfiled Wiz and the
delete-marked duplicate visible elsewhere in the signed-in rail. This clears
the initial player-folder eligibility check; the select/change/reopen subset
round trip remains open.

The signed-in Party/full-sheet comparison confirmed Caim at 40-ft movement with
Searing Smite and no Hellish Rebuke. Branding Smite is correctly absent at his
current level 4; Zariel Tiefling grants it at level 5. The earlier checklist
expectation that level-4 Caim should already show Branding Smite was wrong.

The field pass exposed one presentation defect: Party serialized the raw
5etools casting-time record as `[object Object]`, although the full sheet already
rendered `1 bonus action`. The deployed Party correction now runs the same
string/array normalization for its row and detail views; the signed-in live row
was verified as `Searing Smite · 1 bonus action`.

M ran `schema_delta_character_spell_source_cleanup.sql` once on July 23. The
nightly exporter has not run since that cleanup: the repository's
`data/characters/caim.json` and `cosmere.json` backups still contain retired
spell data, `cosmere.json` does not record `sourceKey`, and the canonical
`cosmererunestar-ae1a.json` is absent. Export convergence remains open.

A follow-up source/live audit separated implementation from field proof.
Vesperian's full and mounted sheets already render
**AC 19 · Mage Armor + Shield**. Mage Armor state/AC, old-session `cosmere`
resolution, new-roster current-key persistence, and exporter alias generation
are implemented and green. Party's top-level Vesperian card had shown
AC `—` because it called `toRenderShape()` before the mounted-sheet dependency
loader installed `ArmorAC` and `EquipSlots`. The deployed Party correction
loads both cache-stamped authorities before its module projection, and the live
card is now verified at AC 19.

The signed-in Forge subset round trip is also verified. The selector exposed
only Caim, Chonkalius, Cosmere Runestar, Líadan Luchóg, and Vesperian Vale. A
Caim/Cosmere/Vesperian subset produced a 3-hero summary, CR benchmark 3, and
exactly those three in Main Party. Reopening **Choose party** and changing to
Chonkalius/Líadan updated the summary and benchmark to 2 and removed the prior
three from placement while preserving the Chen Yue map and both group seeds.
No table was created or saved.

That pass exposed one remaining chooser-only presentation defect: the initial
Forge card read cached `structural.combat.ac`, so Vesperian displayed AC `—`
even though the live combat authority derived 19. The local Forge correction
now projects chooser AC through `CharacterCombat`, the same authority used by
the combat kit. Deployment verification remains.

## Combat field-report correction candidate · 2026-07-24

Baseline was `4342cf0` on `main`, clean and equal to `origin/main`. The only
change since the recorded `79fd7f9` checkpoint was the character-source/handoff
alignment commit already described above; no other project owned or dirtied the
Forge files in this slice.

The signed-in character read showed that the screenshot's `24` for Caim and
`20` for Cosmere were **current HP**, not level or maximum HP. The current rows
are Caim level 4, 37 max HP, AC 17, initiative +4 and Cosmere level 4, 30 max
HP, AC 13, initiative +2. The candidate makes the strip say `current / max` and
routes current character keys through the legacy presentation aliases so
Cosmere's authored sprite/portrait/color survives the rename.

The same candidate:

- resolves a targeted spell against an already-highlighted legal target; Hex
  now spends/applies on that first action and narrates the target as “hexed”;
- carries target saving-throw evidence into the feed and names the full attack
  context for Silvery Barbs;
- applies War Caster advantage to concentration checks;
- marks enemy tactical reasoning as staff-only evidence;
- requires the overseer to rule contested cover from Staff View;
- animates shared movement to the opportunity trigger cell before the prompt,
  then resumes only the unplayed route;
- penalizes movement through hostile reach, prefers defensive cover when no
  attack is legal, and lets ranged foes search reachable firing origins while
  canonical geometry remains the legality gate;
- exposes the editable Encounter roster beside the difficulty read rather than
  hiding it in the Bestiary; and
- replaces the stale 8-corner diagnostic label with 12 body samples.

M approved `_edits/mock-forge-reaction-choices.html`. The candidate now offers
War Caster's ordinary weapon plus eligible at-will single-target attack
cantrips. Booming Blade applies a replayable mark after a hit and rolls its
movement rider only when the marked target later moves willingly. Repelling
Blast offers 0/5/10 feet directly away from the caster, shortens at walls or
occupied cells, replays/animates as forced movement, and never opens an
opportunity prompt.

The pillar report also had a concrete WYSIWYG mismatch: the visible cylinder
base used a 0.40-cell radius while combat cover used 0.29/0.31. The candidate
uses the visible 0.40 footprint; the real cover authority now proves a directly
aligned full-height pillar grants cover.

Open field gates:

1. If the original fight row/URL is available, replay it to distinguish its
   exact saved cells from the screenshot impression; independently confirm the
   corrected pillar footprint on the deployed field.
2. Inspect/replay that same fight to determine whether Caim's Ki was legitimately
   depleted by the prior campaign fight or absent from the serialized state.
3. Run a signed-in two-device round covering opportunity timing, War Caster
   Booming Blade, Repelling Blast, Silvery Barbs
   context/feed, Player View tactic privacy, and staff-only cover rulings.
4. Confirm each difficulty button immediately updates the visible editable
   roster before placement.
5. **Approved and integrated as a production candidate.** Field-test staged
   TEST creation/reopen, preset values in combat, and no character-sheet
   writeback.

Candidate validation is **74/74 Forge suites, 2,328/2,328 known-answer checks**.
It includes the canonical engine, map bridge, tactics geometry, LoS/cover,
placement, and flora smokes plus derivation, feed, reaction/privacy, foe AI,
cover contest, field-report, replay, board, and protocol contracts. Every
touched JavaScript file passed `node --check`; seven affected root
weapon/spell-action suites remain at **124/124**; the two directly affected
root suites were rerun at **56/56**. Both classic inline scripts and the
production module script parsed successfully. The unsigned local Forge booted
without a new console error.

## Disposable Test Fight production candidate · 2026-07-24

The missing-Ki report exposed two valid but incompatible use cases. Campaign
combat should continue from the character's current live HP, resources, and
effects. Difficulty testing needs a copy that can be freely depleted, healed,
or discarded without changing that campaign state.

M approved `_edits/mock-forge-test-fight.html`. The production setup keeps Health
(Full/Current/50%/25%/Custom), Resources (Full/Current/Empty/Custom), and Effects
(Clear/Current) as independent axes, so “full health, empty resources” is a
first-class test. Each character preview makes the copied HP and every limited
pool explicit. TEST identity and “no sheet write-back” are visible before the
table is created.

The production invariant is stronger than a visual badge:

- `forge/forge-test-fight.js` owns config normalization and the pure roster
  transformation.
- The selected config persists as `map.testFight` in the existing JSONB map;
  no SQL or schema change is required.
- Start fight first reads the same current sheets Campaign uses, then applies
  presets only to the TEST roster snapshot.
- Full/current/half/quarter/custom HP and full/current/empty/custom limited
  resources are independent.
- Clear removes copied conditions/concentration. Current copies sheet condition
  labels and its concentration record without inventing targets absent from the
  sheet.
- TEST sessions are labeled in the staged list and session badge and are
  refused at enqueue, drain, and timer-start sheet-mirror boundaries.
- Campaign mode carries no TEST flag and retains the existing live/current
  behavior and normal sheet writeback.

Approved-mock browser validation proved:

- Full health + Empty resources keeps Caim at 37/37 HP with Ki 0/4.
- Campaign mode hides the preset controls and explicitly says normal sheet
  mirroring.
- Returning to Test Fight restores the isolated preset and its no-write-back
  summary.

Production field gates still required:

- Create and reopen a signed-in staged TEST table; confirm its TEST label and
  saved presets survive the round trip.
- Start Full health + Empty resources and confirm Caim is 37/37 with Ki 0/4
  using the current live sheet maxima.
- Damage, heal, spend, restore, rewind, and end the TEST fight; confirm no
  character HP, `pipState`, conditions, or concentration changed.
- Create an ordinary Campaign table immediately afterward and confirm current
  HP/resources plus normal HP writeback are unchanged.

## Shared character capability foundation + first resolver slice · 2026-07-24

M approved `_edits/mock-forge-shared-capability-contract.html`. The approved
architecture is now integrated as the character foundation.
`forge/forge-capabilities.js?v=fc2` defines the versioned
`forge-capability/v1` contract; `forge-kit-derive.js?v=b17` attaches the
normalized ledger and audit to each successfully derived character kit, and
`buildUnit()` retains both on the combat unit.

The contract records status, verification gate, action economy, targeting,
roll, cost, effects, trigger, duration, tags, automation state, source
provenance, and authorized consumers. The source adapter accounts for every
authored feature, spell, and resource. Unsupported rules remain visible as
`held`, `missing`, or `reference`, while only `executable` records may enter an
execution consumer. This prevents both silent feature loss and prose-only
monster rules becoming fake attacks.

The current exported character mirrors derive:

- Caim: 32 capabilities;
- Cosmere: 40;
- Líadan: 38; and
- Vesperian: 27.

All four report zero unaccounted source records and zero invalid capabilities.
Ki and `Ki Points` fold into one resource-backed, field-gated capability.
Repelling Blast and Silvery Barbs are executable with their open field-proof
marker. `forge-capability-resolver.js?v=fcrs1` now makes Caim's fire resistance,
Vesperian's necrotic resistance, Cosmere's Starlight Step, and Vesperian's
Blessing of the Raven Queen executable. Damage defenses resolve the typed
components before final HP, concentration, feed evidence, and replay. Blessing
adds all-damage resistance through the start of Vesperian's next turn. Both
teleports spend their real long-rest pool, select only visible unoccupied cells
within 30 feet, and replay without movement spend or opportunity attacks.

Hand of Harm, Absorb Elements, Aid, Spare the Dying, and the Green-Flame Blade
secondary rider remain held. Senses, Feather Fall, Deflect Missiles, Creation
riders, and Weapon Bond remain explicitly missing. Post-hit/reaction riders are
the next character-first slice. Only after those character rules use the shared resolver should
`monster-actor.js` project Babau/Manes defenses, spells, Multiattack, and
special actions into the same contract.

Validation is **649/649** focused known answers. Every touched JavaScript file
passes `node --check`, and the production module block passes Node's module
syntax gate. The unsigned real Forge browser boot loaded every new cache stamp
with HTTP 200, reached Workshop, and produced no new script error. The expected
protected-roster permission refusal prevents local combat entry, so live
teleport/resistance, two-device replay, and reconnect remain field gates.

## Required field checklist

### July 25 trust correction + July 27 live battlefield editing mock

Baseline: clean `823f84d` on `main`, equal to `origin/main`. The character
capability, Test Fight, reaction, and source-alignment commits since the
recorded `79fd7f9` checkpoint were treated as dependencies; no other session
owned or dirtied the touched files.

The July 27 production slice started from clean `3435dee`, equal to
`origin/main`; the prior trust/mock slice was the only commit since `823f84d`.
This slice owns the architecture authority/replay/board adapter, the Forge
surface and focused smokes, the approved mock, protocol, and these context
records.

The local production candidate now:

- uses the shared `CharacterCombat` projection at fight start for both current
  and maximum HP, including the live `combat.maxHp` spelling;
- persists feed channel and `visibility:"staff"` in `forge-hud.js`'s feed
  model so repainting cannot disclose an older tactic row; and
- lets enemy groups inherit the encounter authority's waiting default. Authored
  region maps use entry activation, ordinary maps use DM activation, and an
  unchecked automation control records an explicit active-at-start override.

M approved `_edits/mock-forge-live-battlefield-editing.html`. Production now
keeps draft geometry staff-local, stores normalized quarter turns only on
doorways and low walls, rotates them by repeated left-click, removes authored
objects by right-click, and publishes the complete record as one overseer-only
`edit.architecture_state`. Replay stores that exact record; the board verb
rebuilds rendering, movement, sight, and cover together. Reconnect, late join,
restore, and rewind therefore share one authority. Mass-build follows the
rotated low-wall anchor axis while earlier cells retain their own orientation.
Spell-created walls and illusions should later add
source/duration/concentration/expiry metadata to that seam.

Validation: **333/333** focused known-answer checks and every touched JavaScript
file passes `node --check`. The real production Temple canvas passed low-wall
and doorway placement, repeated-click 90-degree rotation, and right-click
removal with no new script error. Signed-in two-device publish, reconnect, and
rewind proof remains open.

### July 27 session-creation regression correction

Baseline: clean `45cadea` on `main`, equal to `origin/main`. The intervening
`c122ca5` live-battlefield-editing slice and its architecture replay/cache-stamp
changes are dependencies. This correction owns only the Forge session-start
seam, its focused smokes, stale cache-stamp expectations, and this handoff; it
does not change the generator, discovery rules, character records, protocol,
or architecture authority.

The field report combined two session-creation failures into one visual symptom:

- the standalone Forge declared character auth ready before Supabase had
  restored the persisted token, so an RLS-protected party read could settle as
  an empty success; the empty cache was then treated as permanent even after
  the player explicitly selected visible character cards;
- the map-first Workshop allowed **Roll Initiative / Save for later** while no
  battlefield existed, or while a changed seed/recipe was still pending. That
  could persist a recipe without the exact render snapshot or pair a new seed
  label with the prior rendered field.

An empty shared roster gives Player View no discovery sources. Discovery then
correctly hides every unexplored terrain instance, but the decorative water
plane is not terrain discovery geometry, so the result looks like a broken
all-water world. The generator was not producing the same flooded map for
different seeds.

Production now waits for Supabase session restoration before the canonical
character read, retries an empty/missing party cache when an explicit selection
exists, and refuses to create a table unless every selected PC resolves to a
live row. The table doors remain visibly gated until a battlefield has been
generated and all pending seed/recipe changes have been applied. Session
creation also requires the exact `mapSnapshot.meta.renderField` payload.
Historical empty-party rows stop before rendering with a narrated instruction
to recreate the fight instead of opening the blank Player View.

Validation: the production module block passes Node's module syntax gate; every
touched JavaScript file passes `node --check`; **77/77 Forge smoke scripts**
pass. Focused results include **33/33** starter/party-cache checks, **30/30**
Workshop-flow checks, **27/27** snapshot-authority checks, **10/10** party
selection checks, and **54/54** discovery checks. The stale flora and runtime
cache-stamp smoke expectations left by `c122ca5` were aligned with the current
`architectureAvailable`, `forge-replay.js?v=fb19`, and
`forge-board.js?v=fb11` authorities.

Remaining field gate: on the signed-in working copy, select at least one party
member, confirm the table doors say **Generate required**, generate two distinct
seeds, and create one staged fight from each. Each row must retain the selected
PCs and its own exact rendered layout; entering Player View must show terrain
from a party sight source rather than the water-only failure. The in-app browser
security policy blocked direct `file://` access during this correction, and the
deployed site does not yet contain the candidate, so this gate is not claimed.

After this correction began, `origin/main` advanced from `45cadea` to
`227a91e`. The sole incoming change adds `bardic-host-clock-wave1.2.html`; it
does not overlap the Forge-owned files above and is not a dependency of this
candidate. The working branch remains at the inspected `45cadea` baseline; no
pull, merge, commit, or push was performed.

## Character-resource and attack-shape correction · 2026-07-28

Baseline: clean `e03930e` on `main`, equal to `origin/main`. The generated-field
and saved-session bootstrap corrections above are dependencies. This slice owns
only shared character resource derivation, weapon/spell action projection,
Forge kit assembly, their focused smokes, cache stamps, and this handoff.

The live Forge did not load `resource-derive.js`, so current character rows with
modern class data but no legacy `classFeatures` resource copy could enter combat
without Ki or Bardic Inspiration. Forge now loads the shared authority before
kit derivation and fills missing shared pool IDs without replacing explicit or
custom resources.
Barbarian Rage is now part of that shared resource authority; Chonkalius can
receive the level-4 three-use pool. This adds the counter only: the usable Rage
action, Rage state/riders, and Path of Wild Magic surge table remain held work.

Thrown melee weapons now keep their melee action and gain a distinct ranged
action. Javelin therefore projects both melee and `Javelin (Thrown) 30/120`.
Eldritch Blast now projects separate one-die strikes at levels 5, 11, and 17
instead of one multiplied damage expression. Each successful strike reaches the
existing per-hit Repelling Blast choice. At Cosmere's current level 4, the
cantrip still has one beam by rule.

The field reports also establish three unresolved boundaries:

- The supplied screenshot renders Caim as `28/37`; it does not expose the
  reported `37/24` surface. The exact saved-session URL and surface are required
  before changing current/max HP authority.
- The LoS evidence reports one tree cell blocking all 12 body samples. Existing
  known-answer geometry proves a narrow trunk is not automatically total cover,
  but the exact saved map is required to distinguish a legitimately aligned
  trunk/terrain block from a render-to-geometry mismatch.
- `monster-actor.js` parses full stat-block reference material, but only ordinary
  attack entries become executable actions. Multiattack, spells, traits, bonus
  actions, reactions, and legendary actions are still reference-only, and the
  foe AI deliberately selects one executable action. Babau remains the complex
  acceptance case and Manes the simple control for the next behavior adapter.

Generator verification separated two systems that had been conflated. Legacy
seeds 7 and 8 produced different live maps and names. Temple seeds 7 and 8
produced the same authored `Temple Terraces` route summary; Temple is a fixed
intent grammar with shallow variants, not the legacy random generator. A
generator redesign or neutral room/corridor import therefore needs its own
mock-first architecture slice rather than an RNG patch.

Validation: every touched JavaScript/ES module passes `node --check`; the focused
Forge/root suites pass **591/591 checks**. A real local browser boot fetched
`resource-derive.js?v=fr1`, `forge-kit-derive.js?v=b17`, and
`weapon-actions.js?v=fg2h`, opened Workshop, demonstrated different legacy seed
7/8 maps, and reproduced the same Temple seed 7/8 route summary. The broader
DOM sheet-resource smoke could not start because `jsdom` is absent from the
repository/runtime; the real resource authority is instead loaded directly by
the 352-check Forge kit suite.

Remaining field gates: verify Caim's Ki, Líadan's Bardic Inspiration,
Chonkalius's Rage counter, Javelin (Thrown), and multi-beam Repelling Blast in a
fresh signed-in test fight; provide the exact saved-fight URL for the reported
HP and LoS cases; then build usable Rage/Wild Magic and the monster behavior
adapter as separate production slices.

## Approved Forge Blueprint / Diorama vertical proof · 2026-07-28

Baseline: clean `140122b` on `main`, equal to `origin/main`. The committed
character-resource and attack-shape correction is the only new Forge dependency
since `e03930e`. No uncommitted files or overlapping project ownership were
present when this contract was recorded.

M approved the low-poly modular direction demonstrated in the visual
exploration. The next session is a **real standalone vertical proof**, not a
production renderer port and not a beautification pass on the current cube
generator.

### Ownership

The slice owns only new proof files:

- `_edits/mock-forge-blueprint-diorama.html`;
- optional companion CSS/JS/fixture files sharing
  `mock-forge-blueprint-diorama` in their name; and
- one focused Blueprint/compiler known-answer smoke if the compiler is kept in
  an importable companion module.

It may add a tightly scoped local proof-asset directory only after recording
every asset's source, author, license, and required attribution. Public-repo
assets must be CC0 or CC-BY. The slice does **not** own or edit
`forge/index.html`, generator/deployment/map-bridge/tactics-geometry modules,
the event protocol/replay/board, character/monster authorities, shared theme
tokens, or deployed cache stamps.

### Build order

1. Define the smallest `forge-blueprint/v1` inside the proof: grid and metadata;
   room/space polygons and corridors; walls/openings; doors/windows/stairs;
   elevation/material zones; discovery/encounter regions; props; and lights.
2. Define a modular-kit manifest with footprint, connector faces, legal
   quarter-turn rotation, height, cover, opacity, theme, and variants.
3. Implement a compiler export to the existing tactical field shape
   `{cols, rows, h, wall, occ, coverShape, spawns, props, meta}`. It is an
   adapter to the current authority, not a parallel combat geometry engine.
4. Build a code-native or clearly licensed **Ruined Abbey** kit: floors,
   straight/corner/ruined/low walls, doorway/arch/window, stairs,
   pillar/broken pillar, rubble, crates/barrels, brazier, pool/channel, decals,
   and a restrained stone/wood/metal palette.
5. Render the same Blueprint as top-down Scrawl and 2.5D/3D diorama. Provide
   processional abbey, loop/hub vault, and branching warren fixtures so
   structural variety is visible without changing the document contract.
6. Prove local authoring: place/erase/quarter-turn walls, low walls, and doors;
   change an elevation/material zone; rebuild only the affected chunk.
7. Prove table readability: unexplored rooms are flat neutral-grey footprints,
   discovery raises and colors the modules, nearby walls cut away/fade, and
   cells/minis/doors/stairs/cover remain legible.
8. Add Basic/Balanced/Cinematic switches and visible draw-call, triangle,
   texture, and frame-time evidence. Batch/instance repeated modules, keep
   Balanced to one or two atlases and one shadow-casting directional light,
   and stop the render loop when the scene is idle.

### Exit gates

The slice is ready for M's review only when:

- one Blueprint—not duplicated hand-authored data—drives both views;
- all three fixtures are connected, traversable, and topologically distinct;
- quarter-turn rotation, local chunk rebuild, discovery transition, and
  cutaway readability work in the actual mock;
- a focused smoke proves compiler determinism, connectivity, rotations,
  occupancy, and cover output using the real exported functions;
- each touched JavaScript file passes `node --check`;
- the proof records asset provenance and measured results on M's laptop; and
- M approves the rendered target.

Do not begin the full Scrawl editor, graph-first generator, production renderer
flag, multiplayer/replay integration, spell-created geometry, or live combat
changes within this slice. After approval, promote the settled Blueprint and
compiler, build editor and generator producers, then integrate the diorama
behind an explicit flag while retaining the current renderer.

This visual proof does not close the signed-in Forge field gates. Caim/Líadan/
Chonkalius resources, exact saved-session HP and LoS cases, monster
Multiattack/spells/traits, architecture publish/reconnect/rewind, and the
two-device combat checklist remain separate work.

1. **Passed July 23.** The live selector showed only the five active
   player-folder characters; deleted, test, and out-of-folder rows were absent.
2. **Passed July 23.** A strict subset produced matching summary, CR wallet, and
   Main Party placement membership on the current map.
3. **Passed July 23.** Reopening and changing the subset removed deselected
   characters from CR and placement while preserving the map and group seeds.
4. On the live signed-in site, open a Temple Table with at least Party and Enemy flags.
5. Confirm the staged row retains exact group roles, controller policies, and positions.
6. Roll Initiative and confirm every unit appears on its authored cell on two devices.
7. Reconnect both devices and confirm the same positions reconstruct from the saved row/replay state.
8. Save for later, reopen, and repeat the exact-position check.
9. Save/reload a legacy encounter and confirm historical placement remains unchanged.
10. Compare Volcanic construction once a Workshop Volcanic selector is exposed; the renderer profile exists, but the current biome control does not expose it.
11. On a normal Temple URL with no architecture flag, save one optional-bypass wall, reconnect,
   and confirm its 10-ft movement/sight authority and closed connector restore.
12. In Player View, confirm visible cells restore color across terrace boundaries,
   out-of-sight cells remain grey, and no terrain disappears.
13. Confirm any foe Staff View permits a PC to target is visible to that PC in
    Player View, while a foe behind total cover remains hidden.
14. Compare laptop heat/fan behavior in default Balanced against High Fidelity.
15. On the live signed-in Workshop, open Related enemies, add one suggestion, then
    open the full Bestiary and confirm both doors use the shared authored roster.
16. Generate an ordinary non-region map, place Party and Enemy flags, save, reopen,
    and confirm the exact version-3 positions survive on two devices.
17. Use each Easy/Medium/Hard/Deadly target once and confirm the suggested roster,
    encounter concept, editable picked list, related-family filter, role labels,
    and adjusted-XP wallet agree; no automatic roster may exceed four copies of
    one stat block or six total creatures.
18. On signed-in Party, confirm Caim shows 40-ft movement and Searing Smite, with
    no Hellish Rebuke or level-5 Branding Smite; reopen his mounted sheet and
    confirm the already-open tab refreshes to the same result. After deploying
    the Party casting-time correction, confirm Searing Smite says
    `1 bonus action`, never `[object Object]`. Vesperian's full and mounted
    sheets are already verified at `AC 19 · Mage Armor + Shield`; after deploying
    the Party dependency correction, confirm his Party card also shows 19. No
    recast is required.
19. Reopen an old Forge session that names `cosmere`; confirm it resolves to
    `cosmererunestar-ae1a`, derives the intact Warlock 3 / Sorcerer 1 sheet, and
    keeps Shield with Sorcerer provenance.
20. Create a new table with Cosmere selected and confirm the saved roster uses
    `cosmererunestar-ae1a`, not the retired alias.
21. Run the one-time structural spell cleanup, then run or await the character
    exporter and confirm both the canonical current-key JSON and `cosmere.json`
    contain the current spellcasting data, with the alias recording `sourceKey`.
22. On a disposable signed-in character, compare the full and mounted progression
    drawers, Level Up one chosen class, and confirm the key is unchanged, the
    prior form appears once in Facets, corrections/Lineage survive, and a new
    Forge encounter sees the new level. Confirm an already-active encounter does
    not change underneath its event log.

## Immediate execution order

1. Resynchronize from `AGENTS.md`, `CONTEXT.md`, `CONTEXT_Forge.md`, this
   handoff, current `HEAD`, and the working tree.
2. Build only the approved standalone Blueprint/Diorama vertical proof in the
   ownership boundary above.
3. Run its syntax and known-answer gates, then measure Basic/Balanced/Cinematic
   on M's actual laptop.
4. Stop for M's visual/interaction approval. Do not promote proof code into
   production during the same slice.
5. After approval, record the settled Blueprint/compiler contract here before
   assigning production editor, generator, or renderer ownership.

The signed-in field checklist, character post-hit/reaction riders, and monster
behavior adapter remain a separate queue. They may run in another task only
with explicit non-overlapping file ownership; their results do not authorize
that task to absorb the proof or edit its files. Do not build
`bridge-crossing`, re-enable random legacy bridge selection, or promote Temple
while this visual architecture is being settled.

## Deployment discipline

M reviews, commits, and pushes. Codex does not push. Current slice stamps:
`forge-deployment.js?v=fd3`, `forge-generator-foundation.js?v=g2g1`,
`forge-temple-terraces.js?v=tt1`, `forge-engine.js?v=fe10`,
`forge-render-power.js?v=frp1`, `forge-architecture.js?v=fa6`, and
`forge-discovery.js?v=fd7`, `forge-capabilities.js?v=fc2`,
`forge-capability-resolver.js?v=fcrs1`, `forge-kit-derive.js?v=b17`,
`forge-foe-ai.js?v=fai3`, `forge-feed-render.js?v=ffr6`,
`forge-hud.js?v=b7`, `forge-test-fight.js?v=tf1`, and
`monster-actor.js?v=ma2`. Encounter activation adds
`forge-encounter-regions.js?v=fer1` and bumps `forge-protocol.js?v=fpr2`,
`forge-replay.js?v=fb19`, `forge-effects.js?v=fe7`,
`forge-pipeline.js?v=fb9`, `forge-board.js?v=fb11`, and
`forge-table-correctness.js?v=fg12`. Encounter Read adds
`forge-encounter-read.js?v=fread3`. Explicit local party authority adds
`forge-party-selection.js?v=fps1`. Character-source alignment adds root
`character-sheet-projection.js?v=cp1`, `sheet-mount.js?v=src1`, and
`combat-sheet-float.js?v=src1`, plus
`schema_delta_character_spell_source_cleanup.sql` and the character-exporter
update. Character progression adds `soul-facets.js?v=facets1`,
`sheet-progression.js?v=facets1`, and `sheet-progression.css?v=facets1`; it
requires no additional SQL. The July 28 character-resource and attack-shape
slice adds root `resource-derive.js?v=fr1`, bumps
`forge-kit-derive.js?v=b17`, and bumps the module import to
`weapon-actions.js?v=fg2h`; it requires no SQL.
