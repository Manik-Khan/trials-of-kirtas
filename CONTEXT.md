# Trials of Kirtas — CONTEXT

Custom D&D 5e virtual tabletop. Live: **trials-of-kirtas.netlify.app**
Repo: `Manik-Khan/trials-of-kirtas` · vanilla JS/HTML/CSS + Supabase + Netlify + GitHub.
Walled React/Vite/TipTap corner at `journal/`.

Updated: **August 8, 2026 (production Forge Blueprint → Build → Combat,
implemented local map-import workflow, field-approved portal-owned stair architecture,
Living Codex discovery/curation and NPC/World projection, approved
reaction/cover integration, disposable Test Fight production candidate,
shared character capability contract, and the first typed-defense/teleport
resolver slice, character-sheet source/progression alignment, the first
July 25 trust corrections, the July 27 staff live-battlefield-editing
production candidate, and the first isolated multi-surface bridge/underpass proof).**
Supersedes the earlier July 16 project handoff. The current Forge
execution state lives in `docs/handoffs/forge/`. Reconciled sources include
`CONTEXT_Forge.md`, the July 22 handoff, `FORGE_PROTOCOL.md`, `FORGE_BOARD.md`,
and `FORGE_COVER_CONTEST.md`.

**Companion docs: `CONTEXT_Forge.md` and
`docs/handoffs/forge/CONTEXT_Forge-update-2026-07-22.md` — read both before touching the Forge.** The canonical subsystem doc carries the port
manifest (what the combat system consists of, and which parts exist where), the settled geometry
decisions, and the open bugs. This doc is the project; that one is the subsystem.

**Deploy rule (changed 2026-07-10): M commits and pushes himself** (`git push` = Netlify live
deploy). Codex commits **only when M explicitly asks**, staging files by name, and **never
pushes**. Otherwise Codex's job ends at validated files + a one-line deploy note.
Cache-stamp every module include (`?v=`) — non-negotiable on iOS.

---

## 🟡 Forge Blueprint/Diorama + map creation + Combat — July 28–August 8

M approved replacing the next “more random cubes” step with a neutral
`forge-blueprint/v1` architecture. Drawing, local import/tracing, and the
graph-first generator now produce the same document; top-down Blueprint and the
low-poly modular Board consume it. The existing tactical field remains
movement/LoS/cover authority, with Blueprint compiling to its current shape.

The isolated Ruined Abbey proof is now implemented and visually approved as the
direction: one Blueprint drives top-down artwork/board/Blueprint views and a
modular diorama; Build keeps Shape, Look, Objects, and Areas within reach; local
room/passage/wall/ledge/door/object/area editing, authoring visibility,
cutaway, discovery, grid, undo/redo, and quality evidence share that document.

M also approved the streamlined Forge map-creation UX as its own opening
section. `_edits/mock-forge-blueprint-diorama-creation.html` presents Generate,
Templates, Import, and Blank as four equal doors that converge on
`forge-blueprint/v1` before Build.

A validated local proof candidate now closes the three functional gaps from
that review. Generate uses a deterministic graph-first proof producer with
real size/topology/density/verticality controls, pairwise-distinct candidate
structures, connectivity auditing, and exact seed replay. The selected
Blueprint reaches Build with the same identity and fingerprint. Blank carries
zero rooms into Build with Room armed; the browser field run drew the first
room, narrated the connected field, and undid back to zero rooms without
leaving the flow.

**Forge map creation and local import:** production Combat now opens one
confirmed replacement flow with Generate, Templates, Import, and Blank.
Generate produces three structurally distinct deterministic candidates; a
selected candidate, Template, or genuinely empty Blank map does not replace the
current battlefield until the DM presses Use this map. Import opens
`forge/import.html`. It reads a real user-selected
JPEG/PNG/WebP entirely in the browser, proposes grid/scale, materials,
and broad structural evidence, then lets the DM calibrate or omit the grid and
author structures with Pointer/Brush/Lasso/Eraser/Pan. Only those confirmed
marks become a `forge-blueprint/v1` handoff. The licensed source image is not
copied into the repository or embedded in the Blueprint; Combat restores only
a private downsampled session underlay. Cancelling import returns the exact
current Blueprint and Build edits.

**Portal-owned generated connections — field approved August 8:** the first
Seed 1847 correction proved height-aware movement but still placed stairs after
the room plan, so steps could appear in open rooms, terminate at walls, or miss
the platform entrance. Production generation now makes every graph edge own one
first-class connection: two unused room-perimeter portals, routed corridor
segments, a reserved straight stair runway where elevation changes, and explicit
low/high landings. Room walls are derived around those portals. A layout with no
legal portal/runway is deterministically rejected and regenerated; the visible
post-layout repair loop is gone. Blueprint draws the same routes, stair treads,
and landing heights consumed by Board, movement, walls, props, and tokens through
the compiled `map.h` authority. M regenerated and field-approved the production
result. Existing saved Blueprints remain exact historical documents; generate a
new map to receive the new connection architecture.

The two July 30 field maps proved intentionally different paths. Auto found a
confident but wrong two-square harmonic on the gridded city source; the new
Combat-style one-square drag established the correct 70-source-pixel phase and
46×72 grid, then carried that explicit DM calibration into Build. The
ungridded camp used a DM-selected 35×63 scale and proposed a wetland/overgrown
battlefield with water preserved visually but separately blocked for tactics.
This is a color/texture/line interpretation proof, not semantic vision: roofs,
tents, stages, walls, trees, and ruins are not yet reconstructed as reliable
modular objects.

The promoted Structure Review workflow preserves the approved isolated proof:
local evidence supplies broad area hints only. A compact
Pointer/Brush/Lasso/Eraser/Pan toolbar owns the
drawing flow. Brush drags straight grid-aligned rectangles; Lasso follows
irregular artwork. Right-click anywhere on the map opens a progressive tool
menu, then shows only drawing facts, eraser size, selection deletion, or zoom
guidance for the active tool. Each Brush or Lasso gesture immediately saves one
independent object; no separate footprint or Save clicks remain. Height is part
of the armed drawing, the current height follows the gesture, and saved artwork
labels repeat it. Eraser paints 1×1, 3×3, or 5×5 grid stamps with Undo. Pointer
selects whole authored surfaces for Delete/Backspace. V/B/L/E/H/Z shortcuts,
brackets for eraser size, and F-to-fit keep markup over the artwork.
Kinds include building, roof/deck, bridge, water, tent, tree, stairs/ramp, and
wall, with explicit kits such as timber or masonry buildings, market stalls,
pavilions, stone or timber bridges, and stone steps. Saved structures have a
persistent selectable list; touching or overlapping authored layers no longer
erase or merge each other. The large property inspector and primary Color-assist
controls were removed. Only DM-authored structures rise in the code-native
preview; automatic broad-area hints remain flat artwork evidence instead of
becoming false towers. Clicking a preview structure opens an immediate
−5/current/+5 height control with no Apply step. The underlying receipt still
retains walkability, access, support, and separate ground/raised-surface facts.
This is intentional DM-authored review authority, not semantic certainty.
Walkable roofs, decks, stairs, and bridges enter the current tactical height
field, but simultaneous roof/street or bridge/ground occupancy in one column
still belongs to the versioned multi-surface combat seam.

Grid calibration is now part of that same proof. The generated overlay can be
hidden, artwork can be zoomed and panned, drawing one printed square establishes
local scale and phase, and a second distant-intersection check corrects
accumulated drift. The resulting projection explicitly covers every artwork
edge, including partial cells, instead of stopping at the last complete square.

Approved Structure Review marks can now enter a second isolated proof at
`_edits/mock-forge-image-combat-handoff.html`. Each authored footprint samples
its own source pixels and carries that palette forward; color remains appearance
evidence while the DM-authored type remains rules authority. The adapter emits
the current readable Forge map shape, uses `forge-deployment.js` to place a
three-character party and three foes, and exercises current tactical movement,
range, height, line of sight, cover, and combat-roll helpers in a disposable
local fight. Automatic broad-area hints never become blockers. Raised bridges
remain one effective surface per square; simultaneous bridge/underpass
occupancy is still deferred to the later `surfaceId` contract.

That missing seam now has its own isolated candidate at
`_edits/mock-forge-multi-surface-occupancy.html`. A grid coordinate identifies
a scene column while stable walk-surface IDs identify ground, a 20-ft bridge
deck, or its 15/10/5-ft stair path. Creature position is explicitly
`{c,r,surfaceId,elevationFt}` and occupancy keys include the surface, so Mira
and Vale can legally share cell `5,4` at 0 and 20 feet while same-surface
stacking is rejected. Ground movement continues beneath the deck; stairs and a
20-ft climb are explicit connector transitions; ordinary climbing costs 40 ft
while a climbing speed costs 20 ft. Height-aware sight keeps the underpass open
and lets the physical deck block a shot through it. A versioned snapshot
round-trip preserves exact surface IDs rather than inferring a floor.

The real browser pass descended a sentry from deck to ground through the stair
surfaces for a 25-ft move, reloaded four exact surface positions, and checked
both clear underpass sight and total deck occlusion with no browser warnings or
errors. The focused contract passes **36/36**. This remains a standalone
contract/interaction proof.

The first guarded production compatibility slice now lives in
`forge/forge-surfaces.js` and loads from `forge/index.html` as
`forge-surfaces.js?v=fs1`. It is inert on the default URL. With `?surfaces=1`,
the real combat map compiles a versioned `forge-walk-surfaces/v1` receipt:
current maps synthesize `surface-ground`, structural bridges retain stable deck
IDs, and legacy `{c,r}` positions continue to prefer an open bridge deck.
Ground beneath an elevated deck is exposed only when the connector explicitly
sets `supportsUnderpass:true`; the adapter never invents an underpass from
color, height, or bridge appearance. The Workshop narrates surface, bridge, and
underpass counts. The new authority passes **46/46** focused checks and the
flagged browser path showed its receipt while the default path remained
unchanged. Combatants, occupancy, movement, deployment, tactics geometry, and
protocol/replay have not yet been migrated to the new position shape.

The historical focused proofs remain green. The subsequent production
connection promotion passed **309/309** relevant Forge known answers across
map creation, production/local Combat, Blueprint/Diorama, portal architecture,
tactics, LoS/cover, map bridge, and engine suites. A 900-map deterministic
generation sweep produced no invalid, disconnected, exhausted, or
height-disagreeing field. M's August 8 Forge field replay approved the result.
Exact ownership and evidence are in `CONTEXT_Forge.md` and the current Forge
handoff. The first exact persistence candidate now saves and reopens one
versioned Blueprint/renderer/deployment/local-fight snapshot, attaches that
same snapshot to the existing session event log through its full-state restore
fact, and keeps shared combat writes locked. Signed-in two-device reconnect is
the remaining promotion gate.

---

## 🟡 Living Codex — Chronicle discoveries reach NPCs and World · August 8

The Chronicle and Journal now share one discovery seam instead of treating
typed names as page-local decoration. Root `living-codex.js?v=lc1` merges live,
non-deleted `characters` rows, the established `tooltips.js` NPC/location canon,
and Supabase `entities` plus `entity_aliases`. Player characters are a separate
mention type and are removed from the NPC pool; they never require staff
canonization and never become duplicate NPC entities.

Quill Chronicle composition, the TipTap Journal mention menu, and the shared
Feed rail now offer Characters, NPCs, and Locations. Choosing an explicit
Create NPC or Create location row inserts an unresolved chip and remembers one
uncurated shared entity after the post succeeds; plain typed text creates
nothing. Every picker row carries a written Player, NPC, or Location badge;
unknown names use explicit New NPC / New location actions instead of relying
on color or icons alone. The staff-only
Journal **New to the world** queue can edit, canonize, merge, or discard those
discoveries. Canonize resolves matching chips everywhere. Merge rewrites
structured mention nodes, cached page HTML, and refs, leaves an alias for future
typing, and changes Chronicle chat only when staff explicitly chooses that
historical correction. Ordinary prose is never rewritten.

Locations acquire an explicit home during curation. A nested place appears
inside its parent and does not receive a continent pin. A confirmed top-level
place enters the staff-only World's **Unmapped** list; staff selects it, clicks
the map, and confirms the shared pin. Placed discoveries join the ordinary
World filters and detail panels, while `npcs.html` subscribes to newly confirmed
NPCs. `entities` realtime updates repaint both pages.

`journal/sql/schema_delta_living_codex.sql` is the append-only, run-once schema
delta. It adds role, parent, map coordinate/category/shape/state fields, enables
entity realtime, and repairs old unresolved NPC chips that exactly match a live
character into character references across Journal, refs, and Chronicle feed.
It deliberately avoids ambiguous first-name matching. Deploying the
cache-stamped Living Codex pages and running that SQL on the live Supabase
project remain operational gates unless M has already completed them; source
commit alone is not a signed-in field pass. Current known answers are **11/11**
Living Codex, **17/17** Journal book projection, and **14/14** alias behavior.

---

## 🟡 Forge July 25 trust correction + July 27 live editing production candidate

The next local candidate fixes three field-trust failures without changing the
event protocol:

- fight start reads current and maximum HP from the shared `CharacterCombat`
  projection, so a live `combat.maxHp` row cannot become `30 / 1`;
- the HUD feed model retains channel and staff-only visibility metadata across
  every repaint, so later public rows cannot make prior enemy reasoning visible
  in Player View; and
- enemy deployment groups now wait by default. Region maps use their authored
  entry trigger; ordinary maps wait for DM activation. Explicitly disabling
  automation remains an active-at-start override.

M approved `_edits/mock-forge-live-battlefield-editing.html`; its interaction
contract is now wired into the production Forge candidate. Staff drafts remain
local until Publish, so players and combat rules continue using the last
published battlefield. Only directional
objects rotate: repeated left-clicks turn doorways and low walls 90 degrees, while
right-click drafts removal for any authored object. A rotated line anchor moves
the mass-build continuation onto its new axis without rotating prior cells.
Publish emits one overseer-only replayed `edit.architecture_state` containing the
complete normalized architecture record. Rendering, movement, sight, cover,
reconnect, and rewind consume that same fact. The event shape is intended to
become the shared seam for later spell-created geometry carrying source,
duration, concentration, and expiry.

Focused production validation is **333/333** known answers. A real-browser
Temple round proved low-wall and doorway placement, repeated-click rotation,
and right-click removal on the actual Forge canvas with no new script error.
Signed-in/two-device publish, reconnect, and rewind proof remains required.

---

## 🟡 Shared Forge capability contract + first resolver slice — July 24

M approved `_edits/mock-forge-shared-capability-contract.html`. The first
production foundation is integrated. `forge/forge-capabilities.js?v=fc2` now projects each real character sheet into
one versioned `forge-capability/v1` ledger before
`forge-kit-derive.js?v=b17` finishes the combat kit. Actions, spells, resources,
features, passives, reactions, riders, movement, senses, and defenses share the
same fields for status, action economy, targeting, roll, cost, effects,
triggers, tags, automation, source provenance, and consumers.

Unsupported rules cannot silently disappear or become fake actions. They remain
explicitly `held`, `missing`, or `reference`; only `executable` capabilities
may enter an execution consumer. The real JSON mirrors currently produce Caim
32, Cosmere 40, Líadan 38, and Vesperian 27 normalized capabilities with zero
unaccounted source rows or invalid records. Ki/`Ki Points` normalize to one
resource-backed capability. Repelling Blast and Silvery Barbs are executable
but retain their signed-in field-proof marker. `forge-capability-resolver.js?v=fcrs1`
now consumes executable resistance/immunity/vulnerability tags before HP,
concentration, feed evidence, and replay facts. Caim's Hellish Resistance and
Vesperian's Necrotic Resistance are executable; Blessing of the Raven Queen
adds replayed all-damage resistance through the start of Vesperian's next turn.
Cosmere's Starlight Step and Vesperian's Blessing are executable 30-ft bonus
action teleports with their real limited-use pools, visible/unoccupied
destination checks, no movement spend, and no opportunity attack.

Hand of Harm, Absorb Elements, Aid, Spare the Dying, and Green-Flame Blade's
secondary rider remain held; senses, Feather Fall, Deflect Missiles, Creation
riders, and Weapon Bond remain visibly missing. The next character-first slice
is the held post-hit/reaction riders, then the same contract can project monster
defenses, spellcasting, and Multiattack. Validation is **649/649** focused
known answers plus a real local Forge browser boot with every fresh module
returning 200 and no new script error. The protected local roster correctly
refused entry, so live teleport/resistance play remains a signed-in field gate.

---

## 🟡 Forge field-report correction candidate — July 24

The July 24 screenshots did not show a reverted live Caim sheet. A signed-in
read of the current character rows showed Caim at level 4, **37 max HP**, AC 17,
initiative +4, and Cosmere at level 4, **30 max HP**, AC 13, initiative +2. The
initiative strip displayed current HP only (`24` and `20`), which made those
values look like stale maxima. The integrated correction displays `current / max`.
`data/characters/caim.json` and `cosmere.json` remain stale exporter mirrors,
but they are not Forge runtime authority.

That integrated correction also:

- resolves current Supabase character keys back through legacy presentation
  aliases for sprites, portraits, token art, initials, and seat colors;
- accepts an already-highlighted legal target when a targeted spell is chosen,
  so Hex spends its Pact slot and applies on the first cast attempt; Hex now
  narrates “is hexed,” not “is warded”;
- includes the saving throw die, modifier, total, and DC in spell-save feed
  facts, and names attacker, target, and attack mode in Silvery Barbs prompts
  and feed evidence;
- gives War Caster concentration checks advantage and names both dice in the
  feed;
- makes automatic foe tactics staff-only, routes cover contests to the DM only
  in Staff View, and keeps Player View waiting for the DM's ruling;
- animates movement to the actual opportunity-attack trigger cell before
  presenting the reaction, resumes the remaining route afterward, and penalizes
  automatic paths that cross a hostile reach;
- lets ranged foes search reachable firing positions against all living
  battlefield opponents while still requiring canonical geometry to approve
  each shot; no-shot movement now prefers safer/covered cells;
- keeps the editable enemy roster visible directly in Encounter Read, before
  the collapsible creature-suggestion list; and
- corrects the retired “8 corners” diagnostic to the canonical 12 body samples.

M approved `_edits/mock-forge-reaction-choices.html`; both choices are now in
the uncommitted production candidate. War Caster opportunity attacks offer the
ordinary weapon or an eligible at-will single-target attack cantrip. Booming
Blade marks the target and applies its movement rider only when the target later
moves willingly. Repelling Blast offers no push, 5 feet, or 10 feet along the
caster-to-target line, stops at the last legal cell, replays/animates as forced
movement, and does not trigger opportunity attacks.

The pillar discrepancy was real: the rendered stone base used a 0.40-cell
radius while attack cover used a smaller 0.29/0.31-cell footprint. The candidate
now uses the visible 0.40 footprint; an aligned full-height pillar grants cover
in the real geometry smoke. The original fight row/URL would still distinguish
that historical shot's exact camera impression from its saved cells.

Caim's missing Ki may have been legitimate current campaign state after the
last session, rather than an absent pool. Campaign combat continues from live
HP/resources. M approved `_edits/mock-forge-test-fight.html`; the production
candidate now creates a disposable TEST snapshot with independent Health
(full/current/50%/25%/custom), Resources (full/current/empty/custom), and
Effects (clear/current) controls. The selected config persists in the existing
map JSON, is applied only to the roster snapshot at Start fight, labels staged
and active TEST sessions, and refuses every combat-to-character mirror. No SQL
or schema change is required. Campaign sessions carry no TEST flag and retain
their existing live/current and writeback behavior.

After deployment, run a signed-in two-device OA/Silvery Barbs/cover-privacy
round and confirm each difficulty button updates the visible editable roster
before placement. For Test Fight, create and reopen a staged TEST row, confirm
Full HP + Empty resources in combat, damage and restore resources, and verify
the real character sheets never change. The full Forge battery now passes
**74/74 suites and 2,328/2,328 known-answer checks** (the previous 73/2,311
plus the 17-check Test Fight contract). The two directly affected root
weapon/spell-action suites add **56/56**.

---

## 🟡 Character-sheet source alignment — merged July 23; signed-in field gate remains

The live field reports were one source-authority bug expressed several ways:
Caim's full mounted sheet and Party disagreed about Hellish Rebuke, Cosmere's
renamed character row could not reliably reach Forge, and a familiar backup
filename could outlive the live row that replaced it.

The source contract is now explicit:

- The Supabase `characters` row is live truth. `sheet-v2.html` and the right-rail
  mounted sheet remain the canonical full-sheet surface.
- `character-sheet-projection.js?v=cp1` is the shared read projection.
  `structural.spellcasting` is authoritative whenever it is a modern object;
  retired `structural.spells` is only a fallback for genuinely old/null rows.
  Durable spell/feature additions and suppressions are applied by the same
  projection before Party, the mounted sheet, or Forge derives anything.
- `party.html` now imports the full sheet's `toRenderShape()` instead of
  maintaining a second spell path. Character realtime refreshes replace the
  full row, not only vitals. Reopening an already-mounted sheet refreshes it.
- A modern Soul Shards reforge deletes carried-forward `structural.spells`.
  `schema_delta_character_spell_source_cleanup.sql` performs the matching
  one-time cleanup for existing modern rows without changing any other
  structural field.
- Forge's cinematic selector remains the sole authority for **which** selected
  PCs enter an encounter. Its selected legacy identities are resolved against
  the current live rows before `buildRoster()` and derivation. New sessions
  persist current keys; existing sessions may still use compatibility aliases.
- Character keys remain protocol/database identity only. Forge presentation
  resolves combatants through the mounted unit or saved roster name, so the
  feed renders **Cosmere Runestar**, **Vesperian Vale**, and creature display
  names rather than keys such as `cosmererunestar-ae1a` or `foe-picked-*`.
- Cosmere's current live key is `cosmererunestar-ae1a`. `cosmere` is a retired
  compatibility identity, not a second live sheet. His currently saved Shield
  spell has Sorcerer multiclass provenance; Shield is also a Hexblade expanded-
  list option, but it remains a normal pick rather than an automatic grant.
- `data/characters/<current-key>.json` is a versioned backup, not runtime
  authority. The exporter now also refreshes familiar compatibility files such
  as `cosmere.json`; an alias payload records `sourceKey` so it cannot masquerade
  as the canonical row.

The player escape hatch is deliberately soft, not a rules lock.
`sheet-actions.js` can add a missing spell or feature, hide a generated
spell/feature, ask for a reason and player note, show the validator's finding,
and save the decision in `structural.corrections`. Active corrections survive a
reforge; the audit separates active/unreviewed decisions from append-only
history and allows restore, remove, or resolve-to-generated. A spell-list miss
warns and asks for explanation but still permits the addition. Manual feature
addition is the current path for a missing class/subclass/species/feat benefit;
it is **not yet a catalog-backed feat picker**.

The sheet's direct math paths are also explicit:

- `ArmorAC.deriveAC()` treats Mage Armor as a saved active effect and chooses the
  best valid base calculation before shields. Casting spends a slot and repaints
  AC; dismissal, long rest, or equipping body armor ends the effect.
- `ArmorAC.deriveSpeed()` applies level-scaled Monk Unarmored Movement from base
  speed while unarmored and without a shield. Monk 3 with base speed 30 renders
  40, and the legacy already-stored 40 path is guarded against becoming 50.
- The assembled sheet action owns exact attack-cantrip math after Forge folds
  duplicate shelf representations. This preserves Agonizing Blast's Charisma
  modifier on Cosmere's Eldritch Blast; a derivation exception now stays a loud
  disabled error kit instead of silently becoming a starter kit.

This slice is merged to `main`/`origin/main`. Relevant source-alignment, sheet,
reforge, AC, Forge derivation/identity, exporter, and canonical Forge smokes
total **748 known-answer checks green**; all touched JavaScript passed
`node --check`, and `git diff --check` was clean. The later progression pass ran
`smoke-sheet-mount.mjs` **30/30** with a temporary jsdom dependency, but the
root project still does not declare jsdom, so a clean checkout cannot run that
suite without supplying it. A deployed signed-in Party/mounted-sheet/old-session
field pass remains required. Run the cleanup SQL once after deployment, then
run or wait for the character exporter so canonical and compatibility JSON
mirrors converge.

The first signed-in July 23 pass confirmed the deployed projection stamps and
Caim's 40-ft speed, Searing Smite, and removal of Hellish Rebuke on both Party
and the full sheet. Branding Smite is a level-5 Zariel Tiefling grant and is
correctly absent from level-4 Caim; the earlier Forge checklist expectation was
corrected. Party exposed a narrower presentation bug by printing the raw
casting-time structure as `[object Object]`; the deployed correction now formats
it as `1 bonus action` in both the row and detail, verified live. The live Forge
selector also filtered the signed-in roster to the five
active player-folder characters, excluding the unfiled and delete-marked rows;
the strict-subset round trip is now verified. Caim, Cosmere, and Vesperian
produced a 3-hero summary, CR benchmark 3, and exactly those three in Main
Party. Reopening and changing to Chonkalius and Líadan updated the summary and
benchmark to 2 and removed the prior three from placement without changing the
map or group seeds. M ran the one-time structural spell cleanup SQL on July 23.
The nightly exporter has not run since that cleanup:
`caim.json`/`cosmere.json` remain stale and the canonical
`cosmererunestar-ae1a.json` is not present. Export convergence and the remaining
signed-in checks are still open.

A follow-up source/live audit confirmed Vesperian's full and mounted sheets
already render **AC 19 · Mage Armor + Shield**, and the underlying state,
projection, old-Cosmere resolution, and new-roster identity paths are built and
green. Party's top-level card had rendered AC `—`: it called
`toRenderShape()` before the mounted-sheet dependency loader had installed
`ArmorAC` and `EquipSlots`. The deployed Party correction loads those two
cache-stamped authorities before its module projection, and the live card is
now verified at AC 19. The same field pass found the Forge's initial party
chooser still reading the cached `structural.combat.ac`, so Vesperian displayed
AC `—` there even though the combat kit derived 19. The local Forge correction
now sends chooser cards through the shared `CharacterCombat` authority; its
deployed browser check remains. This is not a missing Mage Armor mechanic.

### August 5 follow-up — Cosmere attachment + Reforge proficiencies/spells

The July audit left three compatibility seams locally corrected but not yet
deployed. `sheet-mount.js?v=src3` renders all five saved proficiency categories
(skills, languages, tools, weapons, armor), rather than only languages. The
Reforge Proficiencies step now consumes the derive's existing feature-grant
scanner, so Hex Warrior visibly contributes Medium armor, Shield, and Martial
weapons before save. The Spells step now consumes subclass
`additionalSpells.expanded` per caster; Hexblade Shield/Wrathful Smite and later
expanded options are pickable under Warlock with subclass provenance and still
count against normal known/prepared limits.

The identity failure was database-side: `characters.key` had been opened, but
both `profiles.character_key` and `set_membership()` still admitted only the four
retired static keys. `schema_delta_profile_character_keys_open.sql` drops the
profile check, validates assignments against current non-deleted character rows,
and idempotently reattaches `ianakira@gmail.com` to
`cosmererunestar-ae1a`. Navigation, the character badge, and `CharacterData`
also accept the retired `cosmere` alias during transition while linking/fetching
the current key. The remaining field gates are: run that SQL once, deploy the
cache-stamped files, sign in as Cosmere, confirm the badge attachment, and open
Reforge to confirm the Hexblade rows and expanded spells against the live save.

### August 5 follow-up — Ves languages, trait stability, elf Trance mock

Vesperian's displayed STR +1 and CON +5 are saving throws, not ability-score
bonuses: Fighter grants STR/CON save proficiency, so the sheet adds PB +2 to
STR -1 and CON +3. The production save strip is mathematically correct; a clear
"Saving Throws" caption now sits immediately beneath it so the totals cannot be
mistaken for a second row of ability modifiers.

Vesperian's saved Reforge snapshot genuinely carried no language or tool picks.
The Proficiencies step showed the customized Dimir Operative grants at 0/1 for
Languages and 0/1 for Tools. The data layer also missed the book-wide MPMM/AAG
language rule because those individual race records omit it; normalized modern
races now regain Common + one chosen language. Subrace language/tool/weapon/armor
grants now survive normalization and reach the picker, and Forge refuses to
write while any visible proficiency choice remains unfinished. Ves must still
choose the two unknown languages (one Shadar-Kai, one customized background) and
one customized-background tool; unchecking background customization makes the
Dimir tool the fixed Disguise Kit instead.

Intermittent racial-trait loss had a concrete write-path cause: `raceForBuild()`
converted a failed rules-data fetch into `race:null`, allowing a reforge to save
without racial traits. A selected-race fetch now fails loudly and aborts the
write. Nested feature/trait entries are recursively flattened and 5etools tags
removed, so list-backed details (such as Eladrin seasons) reach the sheet instead
of disappearing from the description. `_edits/mock-sheet-elf-rest-proficiencies.html`
is the standalone approval gate for temporary Trance selections: MPMM
Shadar-Kai/Eladrin/Sea Elf get two weapon-or-tool picks, AAG Astral Elf gets one
skill plus one weapon-or-tool pick, and PHB Elf gets no temporary-proficiency
prompt. Live long-rest wiring remains intentionally unported until M approves
the mock.

---

## 🟢 Character-sheet progression and rail field pass — July 22–23

This is a separate layer from the source-projection correction above. The source
projection decides what the current character means to the sheet, Party, and
Forge. Progression changes that same current `characters` row and preserves the
prior mechanical form as history; it does not create a second character source.

### Level Up, Facets of the Shard, and Soul Lineage

- The approved `_edits/mock-sheet-soul-facets.html` was ported to the real full
  and mounted v11 sheets through `sheet-progression.js` /
  `sheet-progression.css`. Both surfaces expose **Level Up**, **Facets of the
  Shard**, and **Enter the Shift**.
- **Level Up** routes to
  `shards.html?mode=level-up&character=<key>&class=<class>`. It loads the
  character's saved `_build`, advances exactly the selected class by one level,
  remains pinned to the existing character key, and finishes through the normal
  Shard Reforger review/save path. Level 20 refuses. A legacy character without
  a lossless `_build` reconstructs what it can and narrates that abilities and
  spell choices need confirmation.
- Immediately before a successful Level Up write, `soul-facets.js` snapshots
  the prior form into `structural.soulFacets`. A snapshot contains structural
  rules, vitals, inventory, equipment, and currency; it deliberately excludes
  notes, biography/Journal prose, Soul Lineage, and prior Facets. Identical
  snapshots deduplicate and history is capped at the latest **40** forms.
- Reforge/Level Up merges generated fields into the existing structural object,
  so durable `structural.corrections`, `structural.soulLineage`, appearance,
  authored actions, and other non-generated sheet work survive. Modern
  `structural.spellcasting` still removes the retired `structural.spells` field
  per the source-alignment contract.
- **Facets are currently read-only history.** The stored payload can support a
  later restore/rollback design, but no restore control or write path is built.
- **Soul Lineage is currently a read-only projection.** It always derives the
  current Soul Fragment and can display optional
  `structural.soulLineage.fragments` and `.refractions`. Cross-campaign linking,
  Shift authoring, and Refraction unlock rules are not built yet. The Second
  Reality data shown in the field harness is illustrative, not live character
  data.
- No schema migration is required: both records live inside the existing
  `characters.structural` JSON. The tradeoff is row growth; the 40-Facet cap
  prevents unbounded history, but restoration and retention policy should be
  settled before the cap is ever approached.

Forge compatibility is intentionally simple. A **new** fight resolves the same
current character row and derives its newly leveled effective structural through
`CharacterSheetProjection`; `soulFacets` and `soulLineage` are inert metadata to
Forge. An already-active fight remains event-log authoritative and does not
import a mid-fight level automatically.

### Right rail and Chronicle clarification

- The rail's **Characters** tab now owns its own touch-scrolling list on iPad.
  Every visible character action offers both the floating mounted sheet and the
  full `sheet-v2.html?character=<key>` page; the sheet float's add button opens
  the same two-destination picker. This does not change the account's represented
  character.
- The right-rail **Feed** is the in-the-moment table composer/log. Its Combat and
  Chronicle channels are not the nav **Feed** page (`chronicle.html`). Plain
  Chronicle writing is joint campaign record; personal writing remains in the
  Journal.
- Staff can insert **+ New Section** from the rail's Chronicle channel. The
  displayed session chip is informational, not a session switcher; the row is
  stamped to the campaign's current session with `meta.section` and no encounter.
  The full Feed page retains the actual session controls.

Session validation: Soul Facets **17/17**, Level Up **10/10**, Shards Forge
**18/18**, reforge preservation **20/20**, sheet mount **30/30**, sheet attacks
**49/49**, Characters tab **26/26**, sheet corrections **16/16**, and rail
**59/59** — **245/245 focused checks**. The real browser field harness verified
the full and mounted drawers, multiclass choice, Soul Lineage presentation,
iPad-contained mounted layout, and a real on-sheet Rapier result card.

---

## 🟢 JUST SHIPPED — the Chronicle book (July 8)

The new React Chronicle book replaced the old page as the site's **Chronicle**. It was already
built and feed-wired but unreachable — nothing linked `journal.html`. This session made it live,
folded in the old chronicle's look, and wired it into nav.

### The shape (settled with M via 5 approved mocks)

- **`chronicle.html` = the write surface. The book = the read surface.** Both ride the same
  `feed` table (`channel='chronicle'`). They are not competing systems.
- **Live.** `ChronicleView` subscribes to `feed` realtime (INSERT/UPDATE/DELETE on the chronicle
  channel, INSERT/UPDATE on combat). The story emerges at the table; edits and deletes reflect.
- **Combat is inline, where it happened.** Each fight weaves into the session's narrative at its
  own timestamp, collapsed. It opens to **Round 1 / Round 2 / …**, all rolls in full, each round
  independently collapsible.
- **The Index is the far-left spine.** Clicking it opens a **slim overlay** (~380px) — it does
  NOT push the open session away. Search + Sessions/Authors/Tags/NPCs facets → compact results
  that jump you into the book. Sticky-left; wheel scrolls the shelf; **⟵ Start** returns you.
- **Sections** — a chronicle row with `meta.section:"The Parlay"` renders as an in-stream heading
  and appears in that session's outline strip, alongside its combats.

### Nav (the A/B call, resolved toward A)

| label | path | what it is |
|---|---|---|
| **Chronicle** | `journal.html?view=chronicle` | the new book (deep-links the Chronicle tab) |
| **Feed** | `chronicle.html` | live posting / DM console — where you actually write |
| **Journal** | `journal.html` | the vault |

`nav.js` active-highlighting is now **`?view=`-aware**, since Chronicle and Journal share
`journal.html`. `chronicle.html` was kept (as "Feed") on purpose: the book is read-only until
TipTap replaces Quill as the chronicle composer.

### How rounds are derived (non-obvious — don't re-derive it)

Roll rows carry **no round of their own**. The round signal comes from the `turn` /
`combat_start` events `logEvent()` writes (`result:{type:'turn', round:N}`), which are
non-hidden. `buildFights()` walks each encounter's stream in time order, tracks the current
round from those markers, and buckets rolls under it. Hidden replay rows (moves, `combat_start`)
never reach a player's book. Combat rolls were **already** being archived by `feed-bridge.js`
(session + `encounter_id` stamped, from any page) — the book only had to read them.

### Deletion model

`feed` RLS: authors delete their own chronicle entries; **staff (dm/overseer) delete anything**;
combat rolls are **staff-delete-only** (immutable for players, so replay stays faithful).
The book reflects deletes live; an emptied round collapses.

### Editor: image-by-URL + the `/` menu (Journal / TipTap only)

- `@tiptap/extension-image@3.27.1` — **pinned exact**, because TipTap sub-packages pin
  `@tiptap/core` to an exact version and `^` triggers ERESOLVE. Configured `allowBase64:false`
  (URLs only, no upload); images get `.j-img`.
- **`/` command menu** (`editor/SlashCommand.js` + `SlashList.jsx`). Reuses `@tiptap/suggestion`
  — the same plugin driving `@` and `[[` — so no new dep, no parallel machinery. `SlashList`
  mirrors `MentionList` (same keys, same `.jm-dropdown` classes). Only fires at line start or
  after whitespace, so "and/or" never triggers. Adding a command = one entry in `COMMANDS`.
  Commands: `/image` (aliases pic, photo, url) `/h1 /h2 /h3 /quote /callout /code /divider
  /bullet /numbered /todo /mention /page`.
- **The Feed (`chronicle.html`) runs Quill, not TipTap** — no `/` menu there. Its image-by-URL
  already existed on the toolbar image button (`quill.getModule('toolbar').addHandler('image')`
  → prompt → `insertEmbed`). A Quill slash menu would be hand-rolled; it comes free if TipTap
  ever replaces Quill.

### Files touched (all validated, in the shipped zip)

`nav.js` · `chronicle.html` (staff **+ New Section** button, `newSection()`) ·
`journal.html` (cache stamp) · `journal-assets/journal.{js,css}` (rebuilt) ·
`journal/package.json` + lock · `journal/src/App.jsx` (`?view=chronicle`) ·
`ChronicleView.jsx` (realtime, FightBlock/rounds, IndexOverlay, sections, ⟵ Start) ·
`JournalView.jsx` (Image + SlashCommand) · `editor/Toolbar.jsx` · `editor/SlashCommand.js` (NEW) ·
`editor/SlashList.jsx` (NEW) · `data/supabase-adapter.js` (`subscribeChronicle`,
`loadChronicleCombat`) · `data/bookModel.js` (`buildFights`, `fightsBySession`, `facetCounts`,
`filterBookEntries`, `entryMatches`, `indexActive`, section/tags/mentions on entries) ·
`styles.css`.

Validation: vite build (IS the JSX check) · existing smokes green (book 15/15, journal 81/81,
shelf 62/62) · new known-answer smokes: realtime wiring + reducer 9/9, round bucketing 9/9,
facet/filter 11/11, slash menu 12/12, TipTap image functional 4/4.

### Open / next

- **Not eyeballed in a real browser yet** — logic and structure validated headlessly; the Index
  overlay + outline are a faithful port of an approved mock, but give them a look.
- `prompt()` is the input for both **+ New Section** and `/image` — functional, unstyled.
- **Sections need creating to exist.** The book reads/outlines them; until someone clicks
  **+ New Section** in Feed, no `meta.section` rows exist and the feature sits dormant.
- The real arc: **TipTap becomes the chronicle composer**, retiring Quill in `chronicle.html`.
  The book inherits it for free.

---

## 🟢 PROVEN IN FIELD — Bardic Radio host-clock prototypes (August 1–2)

The old server-clock Bardic path remains unresolved, but the architectural fork is no longer
waiting: M chose **host-as-clock**, and the standalone Wave 1, Wave 2, and Wave 3 prototypes passed
on a MacBook and iPhone. Two devices produced perceptually unified clicks, independently decoded
and played real music in sync, then preloaded and switched between two tracks with gapless hard
cuts and crossfades while preserving synchronization.

### The proven architecture

Three responsibilities stay separate:

1. **Audio bytes** — Cloudinary → each device directly. The host is not an audio pipe.
2. **Clock** — listeners repeatedly measure their offset against the **actual host** through
   Supabase Broadcast. Lowest-round-trip samples define the estimate; Netlify time is not in the
   proof path.
3. **Control** — the host broadcasts a command carrying a future host timestamp. Every device
   converts that timestamp into its own `AudioContext.currentTime` and schedules a decoded
   `AudioBufferSourceNode`. Packet arrival never means “play now.”

The current track continues while a future command is prepared, so advance notice is latency,
not silence. Reported `baseLatency` / `outputLatency` remain useful compensation and telemetry,
but the shared host clock is the primary mechanism.

### Field evidence

- **Wave 1.2.3 — clock/audio proof:** both devices explicitly verified their own audible local
  clicks before the room test. The listener collected stable host-offset samples; one captured
  run reported 37.0 ms best RTT, 0.3 ms offset jitter, and 40 valid samples. Three synchronized
  trials in different positions blended closely enough that M had to move his ear toward each
  device to confirm both were sounding.
- **Wave 2 — real-track proof:** both devices downloaded identical bytes for
  `1-07._Homecoming_to_Port_b9ez8w.mp3`, SHA-256 prefix `54a2c7a1`, 3.75 MB, decoded duration
  1:52.4. Playback was “super clean” and essentially unified throughout. Restart from 45 seconds
  and synchronized stop both worked perfectly in the field.
- **Wave 3 — track-switching proof:** Track B downloaded and decoded to matching hashes while A
  remained audible. The hard cut to B was unified and gapless and stayed in sync after one minute.
  A 300 ms crossfade was gapless but slightly abrupt; a 500 ms crossfade was smooth and unified.
  Prepared buffers were reused, synchronized stop worked, and an invalid inactive-track URL failed
  without disturbing the active synchronized track. Restoring Track A returned both devices to
  matching `READY`, and A played and stopped in sync.

Frozen known-good references:

- `prototypes/bardic-sync/frozen/bardic-host-clock-wave1.2.3.html`
- `prototypes/bardic-sync/frozen/bardic-real-track-wave2.html`
- `prototypes/bardic-sync/frozen/bardic-track-switch-wave3.html`
- `docs/handoffs/bardic/CONTEXT_Bardic-update-2026-08-01.md` — full protocol, debugging history,
  evidence, security rules, production boundary, and next gates.

Treat the three frozen pages as evidence, not production surfaces. **Do not modify a passing
proof; begin later experiments from copies.** No production Bardic file has been migrated to the
new clock yet.

### Operational rules learned during the proof

- Use a browser-safe Supabase publishable/legacy anon key only. Never commit a secret key,
  `service_role`, database password, JWT secret, or values copied from browser `localStorage`.
- Device status uses low-rate **Broadcast**, not Presence. A Presence-update feedback loop hit
  Supabase's rate limit and closed the channel; Wave 1.2.3 removed Presence entirely.
- A device is not ready because Web Audio scheduled something. It becomes `VERIFIED` only after
  the human confirms the local test was audible, and `READY` only after download, decode, and
  matching track fingerprint.
- The host schedules itself only after the Broadcast send is acknowledged. Closed/timed-out
  channels must never produce host-only playback.
- Track identity is the bytes/hash, not the display name. Keep current + pending (and at most one
  queued) decoded buffers rather than loading the whole library into memory.

### Next build: broader validation, then flagged production integration

Open gates are more than two devices, mixed browsers/hardware, longer-duration drift,
join-mid-track, reconnect, phone background/screen-lock behavior, and degraded networks. After
that matrix, integrate the host-clock/two-buffer path behind a new flag alongside the existing
`?engine=wa` route. Preserve the old production path for A/B comparison and rollback; do not
rewrite the clock again without measured evidence.

The standalone Wave 4 candidate now implements host playback anchors, late-listener joins, fresh
clock sampling after interruption, and narrated recovery states:

- `prototypes/bardic-sync/candidates/bardic-room-resilience-wave4.html`
- `prototypes/bardic-sync/candidates/README-wave4.md`
- `prototypes/bardic-sync/tests/smoke-bardic-wave4.mjs` — 50/50 automated checks.

Refresh-based late join, repeated manual/automatic recovery across both test tracks, and iPhone
lock-return recovery passed in the field on 2026-08-04. Leaving Safari or locking the phone stops
Web Audio; after the required user audio gesture, the phone automatically rejoins in sync. Wave 4
now requests a Screen Wake Lock to prevent normal inactivity sleep while the page remains visible,
but this cannot override manual locking or leaving Safari.

The resilience candidate no longer blocks a host track change on a sleeping or unready listener.
The verified host may switch using its local decoded bytes and publish the new anchor; lagging
listeners are explicitly marked to catch up. A returning listener now purges every current or armed
local source before scheduling the host's current track. This hardens an unreplicated field report
where one recovery briefly played both the previous and current tracks. The normal A→sleep→host B
switch→verify→B recovery otherwise passed in sync and must be repeated against this hardening.

It remains a candidate until wake-lock auto-sleep prevention, network interruption, and a true
three-device room pass. Frozen Waves 1–3 and production Bardic files remain untouched.

### RULED OUT (cost ~30 attempts — do NOT rebuild)

- `HTMLAudioElement` synchronization, continuous seeking, or seek-based relock.
- Acoustic room-correlation or one-shot microphone latency as the runtime clock.
- `playbackRate`, time stretching, or revival of `driftNudge()`.
- Trim/host-offset sliders as the primary timing mechanism.
- Independent host→Netlify and listener→Netlify clock estimates.

`bardic-echo.js` remains dormant legacy reference. The old production WA2/`clk2` path and
`webaudio-sync-proto.html` remain historical/feasibility context; they do not supersede the
field-tested standalone host-clock proofs above.

---

## 🟡 Battle Forge — current through Workshop, encounter composition, and source alignment

**Current authority:** `docs/handoffs/forge/CONTEXT_Forge-update-2026-07-22.md`
plus `CONTEXT_Forge.md`. The older July 13 material below is historical progression; where it
conflicts with the July 22 handoff, the current handoff wins.

### July 13h — geometry and fog calibration closes Phase 1.5

The field pass showed that the first cover model and first fog renderer were both too literal
about cells:

- eight head/feet cover rays made low lips count too heavily;
- every prop occupied a full five-foot solid regardless of its real width;
- overlapping fog boxes z-fought into triangle/checker patterns and their heights leaked hidden
  room and wall silhouettes.

Phase 1.5h replaces cover grading with twelve body samples across lower body, torso, and head;
keeps target-side attribution, dead ground, ledge peek, parapet lean, and Cover Contest; adds
sub-cell `coverShape[]`, living intervening-creature cover, and a staff cover-distribution audit.

Fog now uses per-instance discovery state plus one continuous unexplored veil. Unexplored
terrain instances are removed; explored terrain is dark remembered terrain; transient props,
decals, local lights, enemies, badges, and targeting require current visibility. The old
cell-volume fog is gone.

This sits on the complete Phase 1.5 stack built earlier that day: generator foundation,
3D/top-down camera, dual standee/token rigs and custom token art, Staff/Player View, feed/privacy
and table correctness, Sanctuary effect ledger, shared discovery and firing preview, Monk/Toll
the Dead corrections, explicit target→confirm flow, player move undo, flanking modes, source-aware
advantage/disadvantage, and Prone.

The cumulative Phase 1.5h bundle has **426 green checks**. Browser/WebGL and live two-device
field tests remain required. The standalone Blueprint/Diorama direction is now
approved. The next isolated Phase 2 proof is the real graph-first
Generate → Blueprint → Build slice and true Blank → Build entry described
above. Production promotion, snapshot/version integration, stable stage
sub-seeds, and the renderer flag remain later work described in
`CONTEXT_Forge.md`.

**`forge/README.md` + `CONTEXT_Forge.md` are canonical for this subsystem.** Read both.
For the cover-contest mechanism, `FORGE_COVER_CONTEST.md`; for the event protocol,
`FORGE_PROTOCOL.md`; for the board marriage, `FORGE_BOARD.md`.

Procedural battle-map generation + the seam that turns a generated map into a rules-enforced
encounter. **Optional layer that extends theatre-of-the-mind — never replaces it.**


### July 13 — visual pass, storybook backgrounds, and the next architecture

Sixth Forge session (full handoff:
`archive/context/forge/CONTEXT_Forge-update-2026-07-13a.md`). The topography
surface received a real art/feel pass: authored biome fog, scale-correct flora tied to
`PROP_FT`, lighter toon/AO/outline balance, cliff strata and decals, bounded magical
PointLights, combat-mode chrome, visible sight lines, verdict badges, hit flash, shake, idle
motion, damage/heal/miss/down floaters, and token nameplates.

Five browser-upload bundles were produced across the session: the first integrated visual pass;
Build A horizons/skies; Build B generator roadmap; Build A v2 parallax/landmark art; and Build A
v3 integration. M's real-browser A/B settled the art direction:

- **keep:** stronger storybook sky + painted biome horizon;
- **park:** extracted parallax and landmark cards — their generated source sheets carried a
  baked light checkerboard/matte instead of trustworthy alpha, producing white block masks;
- **next cleanup:** make parallax/landmarks opt-in or remove them from runtime until regenerated.

Background cards and tactical props are now explicitly different systems. A future playable
landmark must have a tile footprint, rotation/view art, movement consequence, and `occFt`, with
its rules emitted into `props`/`occ[]`; distant scenery has none of those.

The next approved architecture order is:

1. active-unit camera follow, selected-unit and attacker/target framing, terrain pan, recenter,
   overview, and player camera bounds;
2. party-shared three-state fog of war in **world/map space**, with enemies and interactions gated
   through `foeVisible()`;
3. Blueprint/Diorama vertical proof: neutral authored map document, Ruined
   Abbey modular kit, dual Scrawl/diorama views, three topology fixtures,
   editing/discovery/readability, and measured browser performance — direction
   approved July 28–30;
4. isolated graph-first creation proof: deterministically varied Generate
   layouts beyond the three Templates, exact Blueprint handoff into Build, and
   a truly Blank grid that can draw its first room with the approved tools;
5. after that proof, production Blueprint/compiler + editor + generator with
   versioned snapshots, stable stage sub-seeds, semantics, constrained
   elevations/connectors/spawns, validation/repair, and separate
   rules-relevant versus visual decoration;
6. production diorama behind an explicit renderer flag, followed later by
   spell-created terrain on the existing architecture-event seam.

### July 12 (late) — ledge firing, database character authority, and the ranged-weapon fix

Fifth Forge session of the day (full record:
`archive/context/forge/CONTEXT_Forge-update-2026-07-12g.md`). Three
things went live, each table-relevant:

- **Ledge firing (M's ruling 2026-07-12, now §4-settled in `CONTEXT_Forge.md`):** a shooter
  leans over an immediately adjacent, target-facing wall below their eye — shared cardinal
  edge required, diagonal never the ignored parapet, and the exception forgives **only the
  occluder, never the terrain berm beneath it**. The winning eye rides into `losRay`, so the
  drawn line is the line that authorized the shot. Eleven-case `smoke-ledge-fire.js` freezes it.
- **Database character authority:** new root `character-combat.js` — HP from `vitals`, AC and
  armor consequences recomputed through the sheet's own `ArmorAC` + `EquipSlots`. **Fail-closed**:
  a stale cached `structural.combat.ac` is never silently substituted; a projection failure
  becomes one loud per-character error kit and the rest of the party still derives. New-fight
  initialization only — active fights stay event-log authoritative until the mid-fight sync
  protocol fact is designed (deliberate boundary, unchanged).
- **The ranged-weapon fix:** the post-deploy ledge test failed with "out of reach" on every
  goblin — the **reach gate**, not geometry. `assembleActions` (built for the sheet's roller)
  never emitted weapon range, so every ranged weapon armed as melee and LoS was never consulted.
  One guarded line in `weapon-actions.js` (`deck()` carries range for ranged weapons) fixed it;
  M confirmed at the table. Refusal-triage rule pinned in `CONTEXT_Forge.md` §7: **"out of
  reach" / "out of range" / "no line" are three different gates — read the label first.**

Process notes that earned their pin: the 12f patch bundle's guards correctly **aborted** on
real main (fixture-verified regexes vs. actual repo formatting — anchors are now verified
against a fresh clone). The July 12 description of `data/characters/*.json` as a
"live-truth mirror" is superseded by the July 23 source contract above: Supabase
is live truth; the JSON files are nightly versioned backups and compatibility
mirrors.

### July 10–11 — the protocol spine, bite 1, and the field-day fix waves

**July 10:** the multiplayer event protocol shipped and was verified in two real browsers
(`FORGE_PROTOCOL.md`; four `forge-*.js` modules — vocabulary, reducer, bus, pipeline).
**July 11:** bite 1 — the protocol married to the real board (shared dungeon from the session
row, turn loop, claim screen, sheet stats, bestiary foes, sheet⇄fight mirror) — merged to
`main` and **field-tested by M at the table the same day**. His field reports drove two fix
waves, both committed and pushed by C **on M's explicit order each time** (`f28e0bb`,
`b1d7d72` — an exception to the deploy rule by direct instruction, not a new default):

- **LoS rulings settled** — *ledge peek* (standing at a lip you lean over it: lip-corner
  alternate eyes in `losVerdict`) and *cover grading by attribution-by-side* ("cover is what
  the TARGET hides behind"; shooter-side obstructions are a vantage problem, not AC). Both
  dated in `CONTEXT_Forge.md` §4; identical in all three `tactics-geometry` copies.
- **Action economy is a derived fact of the log** — facts carry their `slot`, the reducer
  derives per-turn movement/action/bonus. Fixes three field bugs at once: bonus actions ate
  the action, rewind restored position but not economy, refresh refunded movement.
- **Undo back in the combat HUD, session-aware** — overseer undo/turn-rewind publish protocol
  facts; a player can retract their own last move (compensating fact, no schema change).
- **Cover Contest built** per the approved `FORGE_COVER_CONTEST.md` spec + mock: player
  pre-roll "Contest cover" pauses the attack, the ruling menu opens on the DM's device only,
  the ruling lands in the log as a fact, the culprit cell lights on the board. Reason field
  optional and de-emphasized (M's call).
- **Player panel lock** — mode/biome/import chips can no longer regenerate a local map
  mid-fight; non-overseer devices lose the forge/dungeon knob sections entirely.
- **Move-tween guarantee** — `move_resolved` facts carry their own `path`, so a lost declare
  row degrades nothing.

**July 12 (staged, NOT committed — M deploys):** M's five-item legibility/rules field report;
items 1, 2, 4 built, **3+5 parked as the next session's brainstorm** (handoff written into
`CONTEXT_Forge.md` §8 — start there, mock-first):

- **Sprite legibility** — baked ink half-pixel outlines on every pixel sprite (M approved from
  a standalone mock), plus a side-colored glow system: friendly gold, foe red, always; explicit
  target red wins; the active unit glows on its turn (PC gold, foe red — "so we know which one
  is attacking"), foe glow gated on a `foeVisible()` seam for the not-yet-designed hidden system.
- **Movement telegraph contrast** — reach tiles brightened (teal@0.26 → cyan@0.42).
- **Silvery Barbs → full RAW, both paths** — 60 ft, keep-original-reroll-take-lower, offer gate
  keyed on the ATTACKER's side (own-side hits never prompt), and the advantage rider built as
  GENERAL plumbing (`advGrant` / `grantAdvantage()` / reducer `grant_advantage` effect on the
  existing `prompt_answered` fact — no new protocol kind, no schema) so **Help and familiars
  later are a one-line call**, per M. Full story: `CONTEXT_Forge.md` §5.21–22 + the approved
  spec `2026-07-11-silvery-barbs-raw-design.md`.

Forge smokes: **335 green** on `main` + this wave's 22 staged (SB 13, glow-color 9); replay
regression 35/35. Detail, per-bug history, and the three
defaults M may still redline live in `CONTEXT_Forge.md` (§4, §5, §8).

```
params ─▶ forge-engine ─▶ (map-bridge contract) ─▶ tactics-geometry ─▶ combat
             └─ uses forge-dungeon (generator core)
```

- **`forge-dungeon.js`** — generator core, extracted verbatim from
  `majidmanzarpour/threejs-procedural-dungeon`. **MIT attribution required everywhere it appears.**
  Its `THEMES` keys **are the biome names**: `grass druidic tundra swamp temple cavern volcanic`.
- **`forge-engine.js`** — `ForgeEngine.generate(params)` returns a finished, **verified** map.
- **`map-bridge.js`** — the seam → `{cols, rows, h[], wall[], occ[]}` + `spawns`, `props`, `meta`.
- **`tactics-geometry.js`** — combat rules (movement, cliffs, LoS, cover, ranges). Canonical.

### ⚠ The word "bridge" has cost this project real time

`map-bridge.js` bridges the generator to the **map document**. It does *not* bridge the generator
to the **combat system**. When M says "port the battle mock," he means the combat system:
flanking, opportunity attacks, hit flash, badges, damage floaters, Ready-an-action. That list
lives in `CONTEXT_Forge.md` §3 as a **port manifest with source line numbers**. Work the manifest.

### `occ[]` — the July 8 geometry fix (settled; do not relitigate)

Sight is **height, and only height**. Nothing is opaque by type. Every cell carries `occ[]`, an
occluder height in feet above its terrain, and `losVerdict` traces the 5e corner lines through 3D.

- **Distance** = Chebyshev hypotenuse: `max(horizontal_squares, vertical_tiers) × 5`.
  *Divergence:* canonical `TG.range3d` still uses Euclidean hypot. Unreconciled, deliberate.
- **A hole can never block** — its top is below the ray. Falls out; no clause enforces it.
- **Dead ground is a FEATURE.** From a plateau you cannot see the base of your own cliff. Walk to
  the ledge or Ready an action. Earlier attempts "over-blocked"; they were correct.
- **Standing back and standing high are opposite levers.** Backing off a wall raises the ray *at
  the wall* only when the target is above you. A flat ray cannot rise.
- **Cover is graded** — Phase 1.5h uses 12 inset body samples across lower body,
  torso, and head/shoulders: `0–5 none · 6–8 half (+2) · 9–11
  three-quarters (+5) · 12 total`. This supersedes the older 8-corner
  head/feet model recorded in earlier handoffs.
  **Two dated July-11 amendments** (M's table rulings — `CONTEXT_Forge.md` §4 is canonical):
  *ledge peek* (lip-corner alternate eyes) and *attribution by side* (only blockers at least
  as close to the target as to the attacker grade half/¾; total is unchanged).
- **Occluder heights come from the generator**, not thin air: `map-bridge.BIOME_WALL_UNITS`
  mirrors `SKINS.wallH` × 5 ft. Props: rock 4.5 · tree 5.5 · reed 3.5 · column 15. Moss, bones,
  cracks, banners occlude nothing.
- `forge/tests/smoke-los-cover.js` (50 known-answer cases in Phase 1.5h) encodes all of the above.

⚠ **Inline-copy sync rule:** `tactics-geometry.js` is inlined in **two** mocks —
`battle-tactics-geo-mock.html` **and** `topography-test-mock.html`. Three copies total, all
**code-identical** (comments stripped; the inlines carry an older header). Change one, change all three.

Tests (all in `forge/tests/`, **329 green as of July 11** — full per-file counts in
`CONTEXT_Forge.md` §2): engine 14 (frost→tundra fixed), bridge 16, geometry 26, los-cover 37,
placement 19, flora 22 (placement/flora extract the real functions from the mock), protocol 56,
replay 35, tiers-rebase 32, forge-board 20, starter-kits 16, bus-reconnect 12, cover-contest 24.
- **Flora:** `FLORA[biome]` — `kinds` at build time (a kind carries an occluder height), `pal` at render
  time (a biome chip retints instantly; species need a re-forge). Walls are hard: 0/19831 walkable cells
  are `T_ROCK`. Trees no longer plant against walls — they used to, 100% of the time, by construction.
- **Grid:** per-cap 1×1 instanced quad, live opacity slider, no rebuild.
- **Watch:** `applyLook()` must multiply every light by `LEGACY_PI`, or the mock renders π× dark.
- **Watch:** every upright `SpriteMaterial` needs `alphaTest: ALPHA_CUT`. `depthWrite` defaults true, so
  without it a transparent sprite writes depth over its whole quad and hides whatever stands behind it.

### The four mocks — which is which (none are superseded)

| file | what it holds |
|---|---|
| `topography-test-mock.html` | **THE surface.** Heightfield, LoS/cover, reactions, rewind, sight lines |
| `battle-tactics-geo-mock.html` | flat box-tile combat. **The port source for the combat system + feel layer** |
| `battle-forge-mock.html` | *"the dream one."* generator → tactics diorama. **Source of the pixel sprites + portraits** |
| `battle-forge-biome-mock.html` | **source of the biome art direction** — `SKINS`: `wallH`, fog, light rigs, particles |

The Forge was rebased from `battle-forge-mock.html` onto `topography-test-mock.html`. The rebase
carried the geometry across and **left the renderer and the combat system behind.** That is the
whole story of the missing sprites, the missing flanking, and the missing feel.

### Open

- **Bugs:** height slider and placement bunching remain fixed; sight-line depth hiding is now
  fixed (`depthTest:false`). Current art bug: generated parallax/landmark cards have baked
  checkerboard/matte masking and stay off.
- **Now ported:** DOM verdict badges, hit flash, camera shake, idle bob, floating combat text,
  nameplates, visible sight lines, and bounded magical PointLights.
- **Now ported:** flanking modes and opportunity attacks, including the shared
  move-reaction path.
- **Ready exists locally, not yet as shared protocol authority.** The local
  combat path can hold and release an attack; reconnect/replay-safe multiplayer
  Ready remains carried work. Post-processing still exists nowhere.
- **Architecture now present:** follow/focus/pair/free camera behavior,
  party-shared three-state discovery, generator foundation, Temple Terraces,
  and authored architecture blocks. The remaining backlog is broader
  archetypes/connectors, bridge-crossing, deeper tactical-prop contracts, and
  promotion field gates.
- ~~topo's inlined generator is stale~~ **fixed in bite 1** — the mock now runs canonical
  `ForgeEngine.generate()` (`CONTEXT_Forge.md` §5.5; `smoke-tiers-rebase.js` 32 green).
- ~~Agreed next build: wire Forge to load a generated map + character-select entrance~~ —
  **that was bite 1, shipped July 11** (see the July 10–11 section above). ~~Next: the bite-2
  spec~~ — **written and design-approved 2026-07-12: `2026-07-12-forge-bg3-hud-design.md`**, the
  full BG3 HUD pass (battle.js bar extended bottom-center off a sheet→actions derivation layer;
  the Chat Feed as the combat log, bottom-right; uniform full-math rolls, no AC ever). It absorbs
  the sheet→actions half of bite 2; the remaining feel-layer ports stay their own bite. Next
  session: M reviews the spec, then build in its §6 bite order. `CONTEXT_Forge.md` §8 carries
  the handoff; M's table eyeball of the July-12 glow/SB wave is still outstanding alongside it.

---

## Art, assets, licensing (Forge and site-wide)

- **three.js: `topography-test-mock.html` runs r185** (ESM + import map). The other three mocks
  stay on r128 — reference sources, not surfaces. three shipped no browser UMD build after ~r160,
  so a classic `<script src>` tag could never reach `EffectComposer`/`GTAOPass`/`N8AO` at any version.
- **Lights are ×π at r185.** r128 applied π in the shader (`irradiance *= PI`); r155 moved it to JS
  behind `useLegacyLights`; r165 deleted it. `topography-test-mock.html` restores it as `LEGACY_PI`
  on `amb/hemi/sun/rim` — same multiply, identical image. π does **not** cover PointLight/SpotLight.
- **Post-processing is still not wired.** Only `topography-test-mock.html` enables a shadow map.
- **Module gotcha:** topo's renderer block is now `type="module"` — deferred, and its top-level
  `var`s are not globals. It exports `window.CHAR` and fires `topo:ready`; the classic party-select
  block waits for that event. `n8ao` needs `three/examples/jsm/` mapped as well as `three/addons/`.
  Pins when post lands: `postprocessing@6.39.2` needs `three >=0.168 <0.186`; `n8ao@1.10.3` imports
  bare `postprocessing` even for `N8AOPass` alone.
- **The repo is PUBLIC. Assets must be CC0 or CC-BY. Nothing else.**
  - Good: **Kenney**, **Poly Haven**, **ambientCG**, **Quaternius**, **Kay Lousberg** (all CC0).
    Kenney plumbing already half-exists: `assets/library.json`, `CHEST_DEMO`.
  - **Never use ripped game assets.** Wind Waker JS ships Nintendo models/textures; its credits
    *thank* Nintendo, which is not a licence.
  - **Epic/Fab:** the 5%-over-$1M royalty is the **Unreal Engine** licence and is irrelevant —
    Epic's EULA states Fab assets "are not Licensed Technology." Fab's Standard License restricts
    sharing to collaborators via a **private repository**. Ours is public. Only Fab items under an
    explicit **Creative Commons** licence are usable.
- **The battle mock does not look better because of its renderer.** It has no shadows and no
  post-processing either. It looks better because things were *drawn* and things *move*. Feel is
  cheaper than art and buys more.
- **July 13 visual ruling:** use storybook sky + painted horizon. Parallax and landmark cards from
  the v2 generated atlases remain disabled until real-alpha replacements exist.
- **Background versus map props:** background art is visual-only. Tactical landmarks require
  footprint, movement/blocking, `occFt`, placement clearance, and directional/rotational art.
- M reviews, commits, and pushes himself. Codex leaves validated files in their repository
  paths and provides a one-line deploy note; it commits only when M explicitly requests it
  and never pushes.

---

## Firm working rules (enforced; keep enforcing)

- **🔴 NEVER claim something doesn't exist without searching for it.** This is the single most
  expensive failure in this project's history. In the July 8 Forge session Claude told M the
  pixel sprites "were never there" — they were sitting in `battle-forge-mock.html`, in the repo,
  named in this doc on the "Battle Theater arc" line. Claude also failed to open `CONTEXT.md`
  for four turns *while it was attached to the conversation*, then explained the omission as
  though the file hadn't been provided. It had.
  - Read **every** attached file, including ones whose contents aren't expanded inline. They are
    on disk at `/mnt/user-data/uploads/`.
  - The repo is **public**. Pull it:
    `curl https://raw.githubusercontent.com/Manik-Khan/trials-of-kirtas/main/<path>`
    (the GitHub tree API rate-limits from the sandbox; fetch files directly.)
  - "X doesn't exist" is a claim about **the repo**, not about your context window. Grep first.
  - **M is entitled to ask "did you grep that?" and the answer must be yes before the claim.**
- **Read the live repo source before editing.** Fetch if not provided
  (`raw.githubusercontent.com/Manik-Khan/trials-of-kirtas/main/...`). **A plausible hypothesis is
  not a diagnosis.** Most of the ~30 radio attempts' wasted motion came from theorizing instead
  of reading. (July 8: reading first is what revealed the book was already feed-wired and merely
  unlinked — the task was 1/10th the size it looked.)
- **A headless test that passes while the browser stays broken is not proof.** Extract the *real*
  functions and run them on the *real* generated field. The Forge burned a full session on
  synthetic geometry tests that passed 17/17 while every shot in the browser read "no line of
  sight." Instrument reality.
- **Mock → approve → build** for anything UX/architectural. Standalone, no-deps, renders on its
  own. Five mock rounds settled the Chronicle before a line of real code; M's field use killed
  the full-panel Index in one pass.
- **Validate before handover:** `node --check` on JS; for `.jsx`, the **vite build IS the check**
  (`@babel/parser` also works); jsdom smokes for wiring; headless known-answer smokes for logic.
- **Surgical, flag-guarded edits.** New paths behind flags (`?engine=wa`) so the working path is
  untouched and risk is zero when off. Optional callbacks keep older call sites compatible.
- **Don't add machinery ahead of data.** When M says the solution is simpler than the model,
  field-test the simple version first. M's field reports are ground truth.
- **Cache-stamp every module include; bump on change.** Stale iOS cache masquerades as bugs.
- **Failures must narrate** (disabled/greyed UI reads as broken).
- **Never change a theme CSS var to fix a per-page issue** (clear the override chip instead).
- **`scrollIntoView` is banned in the Chronicle shelf** — it scrolls the page, not the container.
  Move `.sh-shelf.scrollLeft` / the panel's own `scrollTop` by computed offset.
- Codex commits only when M explicitly requests it and never pushes; M deploys manually.

---

## Stable ToK systems

Roles: overseer / dm / player. Party: Cosmere Runestar
(`cosmererunestar-ae1a`; legacy alias `cosmere`; ianakira), Caim (jayvanmidde),
Líadan (nazanroseaktas), Vesperian Vale (thebraveruby, M's character). DM: hagakuredisc.
Supabase tables: `profiles`, `encounters`, `combatants`, `characters`, `journal_pages`,
`journal_refs`, `entities`, `entity_aliases`, `journal_comments`, `drawings`, `scenes`, `feed`,
`campaign` (one row, `current_session`), `session_titles`.

- **Character sheet v11** (`sheet-v2.html`/`sheet-mount.js`) — primary play surface; full rolling
  (`dice-engine.js`), gear manager, combat float, appearance system, rest/hit-dice.
  `character-sheet-projection.js` is the canonical effective-data read path for
  the full sheet, Party, and Forge; do not create another consumer-specific
  spell/feature projection. `sheet-progression.js` adds Level Up, read-only
  Facets of the Shard, and the read-only Soul Lineage drawer to both full and
  mounted sheets.
- **Soul Shards charactermancer** (`shards.html`, `soul-shards-*.js`) — full builder off the
  5etools 2014 JSON mirror; multiclass spellcasting, provenance-colored spell
  picker, existing-character Level Up, and pre-level mechanical Facet capture.
- **Chronicle book + TipTap journal** (walled `journal/` Vite+React) — see the top section.
  `tokMention`/`pageLink` nodes, backlinks, `/` menu, image-by-URL. Gotcha: `nav.js` publishes
  `characterKey` (camel) vs DB `character_key` (snake) — grep `profile.character_key` when
  touching identity.
- **Living Codex** (`living-codex.js`, Journal curation, `npcs.html`, `world.html`) — live
  characters, canon NPCs/locations, and play-created entities share one mention/alias seam.
  New entities remain unresolved until staff curation; top-level locations require explicit
  World pin placement. The append-only Living Codex SQL must run once before live use.
- **Feed** — the append-only spine. `channel` = `chronicle` | `combat`. `feed-bridge.js` posts
  every HUD roll (session + `encounter_id` stamped) from any page. `feed-render.js` draws rolls.
- **Combat/rail** — site-wide right rail (`rail.js`), `advance_turn()` RPC, monster integration,
  `combatants-backend.js` shared by `combat.html`/`party.html`. **The right edge belongs to the
  rail** — don't put page drawers there (this killed the first Index placement).
  The rail Characters list scrolls independently on touch and opens either the
  mounted sheet or full sheet page. Rail Chronicle posting is the table's
  in-the-moment joint feed; the Journal remains personal.
- **Theming** — CSS custom props from `look-derive.js`, settings flyout, per-page/per-player scope.
- **v11 visual language:** dark teal-green `#182826`, Playfair Display / Oswald / EB Garamond,
  hard edges, grain+vignette. Origin colors: gold=class, teal=subclass, red=race, purple=feat.

## Personal / adjacent (context, not ToK)

Hindustani sarod (Maihar gharana, AAK lineage). Obsidian "Codex" vault. AACM director (San
Rafael); PayPal→QuickBooks IIF converter; Supabase+Stripe lesson-scheduling app; Vilambit audio
practice tool; music archive (FileMaker→Postgres) scoped. **Separate projects — don't pull them
into ToK work.**
