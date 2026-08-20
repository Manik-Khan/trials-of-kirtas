# Durable item system handoff — current through 2026-08-19

Status: **identity/schema, staff adoption, and server-side transfer are applied;
the real full-sheet adoption flow and tracked-item reader are field-visible on
the normal sheet, with `?itemHistory=0` retained as the rollback switch. The
mounted/rail sheet remains untouched. The next Gear/import presentation and
Loot Workshop work remain standalone, no-dependency mocks. The first guarded
campaign-moment reader is local but its SQL is unapplied and its World /
Chronicle field path is not yet proven. No production Loot Workshop or Forge
runtime wiring is approved.**

This document is the current item-system authority. Read it with `AGENTS.md`
and `CONTEXT.md` before touching Gear, inventory imports, item SQL, Chronicle
links, or World-map item projection.

Current working baseline: local `main` and `origin/main` at `893e1d2`
(`updated level up and spells`). The approved August 19 map-history mock begins
from a clean tree and intentionally leaves four uncommitted files:
`CONTEXT.md`, this handoff,
`_edits/mock-campaign-connections-map-history.html`, and
`tests/smoke/smoke-campaign-connections-map-history-mock.mjs`. The prior item
checkpoint was local `bab024a` (`loot workskop`); the original handoff
checkpoint was `cc388e1` (`items and ownership`). The later committed Level Up
wave does not change item, Chronicle, World, or map dependencies. M deploys
manually. Codex never pushes and commits only when M explicitly asks.

## 1. Executive verdict

The notable-item architecture is now real rather than a standalone concept.

- A notable object has one permanent identity independent of inventory index,
  bearer, or mutable name.
- Party-readable current state, staff-only unrevealed truth, and append-only
  history are separate database records.
- Staff can intentionally adopt one existing quantity-one Gear row through the
  real full character sheet.
- Campaign members can open a tracked-item record in the full-sheet reader;
  staff receive the separate secret projection, can preview the party view, and
  receive the approved narrow management controls.
- A tracked item can already be transferred atomically on the server without
  losing its identity or historical bearer chain; the production reader now
  provides the narrated transfer control, pending a signed-in field pass.
- Imported and ordinary inventory rows remain ordinary until staff deliberately
  adopt them. Never automatically turn every generic weapon into a campaign
  object.

M applied the three SQL deltas successfully, deployed the flagged UI, and
field-proved adoption by turning Cosmere Runestar's longsword into **The
Hexblade**. The acquisition-language correction was then deployed at `cc388e1`.

The August 17 field pass then proved the normal full-sheet path with an imported
Skyblinder Staff: staff could begin its permanent history, move it through
unidentified and identified states, and open its record. That pass also exposed
the next honest Gear gaps: imports cannot begin unidentified, the ordinary Gear
detail does not surface the description, the closed row does not carry rarity
color or a history marker, and the mounted sheet still has no item-history
bridge. `_edits/mock-item-import-history-gear.html` is the approved presentation
mock for those gaps; it is not production Gear.

## 2. Durable contract

### Current public truth: `public.item_instances`

`item_instances.id` is the permanent identity. A character inventory row mirrors
it as `instanceId`; `display_name` and the inventory-facing `name` may change
without changing the object.

The public row owns identification state, known rarity/mechanics, custody,
location, equipment slot, and attunement. A held item has one
`current_bearer_key` and no current map location. Non-held items have no bearer.

### Staff-only truth: `public.item_secrets`

Unidentified true name, definition key, rarity, mechanics, public description,
and lore live separately. Authenticated campaign members may read public items
and history; only staff may read secrets. Direct client writes are revoked.

### Immutable history: `public.item_events`

Events are append-only. The mutation trigger rejects UPDATE and DELETE even if
a privileged caller makes a mistake. Current event vocabulary:

`recovered`, `assigned`, `identified`, `renamed`, `transferred`, `transformed`,
`lost`, `destroyed`.

Each event has explicit optional link homes for:

- session;
- location;
- Chronicle moment;
- encounter;
- Journal page;
- feed post; and
- battle map.

This is the connective seam that later supports item history, Chronicle
references, the Party's Path, quest evidence, and evolving-item awakenings.

## 3. Applied server operations

### `adopt_inventory_item`

Staff-only and transactional. It:

1. locks the selected character row;
2. compares the fresh inventory row with the client's exact expected JSON;
3. rejects missing, changed, already tracked, or stacked rows;
4. creates the public item and optional secret;
5. stamps `instanceId`, identification, name, and rarity into the exact inventory
   row;
6. appends origin plus initial-possession events with supplied campaign links;
   and
7. commits everything together or nothing at all.

### `transfer_item`

Available to approved campaign members and transactional. It:

1. locks canonical item custody and both character rows in stable order;
2. rejects a stale source bearer, malformed/archived characters, duplicates,
   same-character transfers, and non-held items;
3. refuses to move a non-empty container;
4. removes the one matching `instanceId` row from the source inventory;
5. appends it to the destination with stable UI identity and cleared
   slot/attunement/container state;
6. updates canonical custody; and
7. appends a linked `transferred` event atomically.

The SQL file headers still say `NOT YET APPLIED` because they record their
pre-application preparation state. The migrations are now applied live. Do not
rewrite applied migration files merely to update those comments; record later
schema changes in new append-only deltas.

## 4. Real Gear adoption flow

The deployed `sheet-v2.html` loads the staff adoption bridge behind
`?itemHistory=1`. The August 16 local promotion loads
`item-adoption.js?v=ia3` on the normal full sheet, with `?itemHistory=0` as an
explicit rollback switch. Staff controls still mount only for a `dm` or
`overseer`, and the mounted/rail sheet remains outside this slice.

Staff open an ordinary Gear item and choose **Begin item history**. Before the
RPC, the bridge reloads the current character and resolves the exact fresh
inventory row. Quantity must be one. A stacked item narrates that it must be
split first.

The four steps are:

1. party-facing name, description, identified/unidentified state, and known
   rarity;
2. true name, rarity, rules, and private lore;
3. acquisition truth plus optional session/location/encounter/battle-map links;
4. review of public truth, secret truth, origin, first bearer, and the first two
   history summaries.

Acquisition is intentional, not inferred. Available origins:

- backstory possession;
- found during play;
- gift or reward;
- inherited;
- crafted or created; and
- other origin.

Both generated history sentences remain editable. Backstory possession clears
the automatically suggested current session and location. For The Hexblade the
correct preview is:

> The Hexblade entered the campaign as part of Cosmere Runestar's backstory.

> Cosmere Runestar began the campaign carrying The Hexblade.

The earlier `Party decision` caption was hard-coded review text and was not
stored verbatim. The first live Hexblade adoption may retain the generic stored
summary `Entrusted The Hexblade to Cosmere Runestar.` History is append-only;
do not silently mutate that event. A later staff history-authoring/correction
event should clarify it transparently if M wants the historical display exact.

After success the dialog requires **Return to item**, which reloads the sheet
before an older in-memory inventory controller can overwrite the RPC result.

## 5. Field evidence

Live field result:

- full-sheet URL with a real character key and `itemHistory=1` loaded Gear;
- M adopted Cosmere's longsword as The Hexblade;
- the permanent tracked identity appeared successfully;
- the acquisition wording issue was reported from real use and corrected;
- corrected desktop and 390×844 mobile flows completed identified backstory
  adoption with no browser warnings/errors;
- the deployed reader opened The Hexblade and displayed its public Overview and
  history in M's signed-in full sheet; and
- M approved promoting the reader and adoption bridge to the normal full-sheet
  URL after reporting that the History tab's unexplained event count should be
  removed.

Current focused known answers at `cc388e1`:

```text
smoke-item-provenance-sql:  28 passed, 0 failed
smoke-item-adoption-sql:    27 passed, 0 failed
smoke-item-adoption-ui:     28 passed, 0 failed
smoke-item-provenance:      37 passed, 0 failed
smoke-item-transfer-sql:    25 passed, 0 failed
TOTAL:                     145 passed, 0 failed
```

### August 16 tracked-item reader, management, and promotion candidate

M approved `_edits/mock-item-history-management.html`. The smallest production
reader lives in `item-history.js`; the August 19 connected-history candidate is
cache-stamped as `item-history.js?v=ih10` and mounts on the normal full sheet by
default. It:

- claims tracked Gear details before the adoption bridge decorates ordinary
  items;
- reads `item_instances`, oldest-first `item_events`, and character display names
  for members;
- requests `item_secrets` only after the local profile resolves to `dm` or
  `overseer`, while database RLS remains final authority;
- gives staff a player-preview lens that removes the secret panel;
- presents unidentified items with smoke, no public rarity, and no public
  mechanics;
- presents identified rarity/mechanics from the public row;
- displays custody by character name, keeps equipment as a quiet custody detail,
  and gives attunement its own explicit marker;
- uses the current public item name as the Overview heading instead of permission
  or form language; and
- gives staff narrow identification, public rename, attunement-requirement, and
  real transfer actions.

The approved refinement adds the append-only
`schema_delta_item_attunement.sql`; its live application state still needs an
explicit field confirmation. It adds `requires_attunement`, backfills existing
tracked Gear truth, and provides two transactional RPCs. Staff use
`set_item_attunement_requirement`; turning the rule off clears active
attunement in both the durable row and bearer inventory. A campaign member's
Gear Attune/Release control uses `set_item_attuned`, which
locks the current bearer, enforces the three-item cap, and updates both records
together. The full-sheet root explicitly activates the promoted item
experience. The mounted-sheet root does not, and `?itemHistory=0` disables the
promoted path for rollback.

The second append-only delta is `schema_delta_item_management.sql`; its live
application state likewise needs explicit confirmation. `identify_item`
publishes the prepared
secret name/rarity/description/rules into public truth, updates the held Gear
row, and appends an `identified` event in one transaction. `rename_item` updates
the public and held-inventory names while preserving identity and appending a
`renamed` event. The production transfer confirmation calls the already-applied
`transfer_item` RPC with stale-bearer protection and a real destination
character key. None of these actions updates or deletes an existing history
event.

The production-module harness passed desktop and 390×844 mobile browser checks.
A player received no secret panel or audience controls; staff saw the separate
secret; identified and unidentified states rendered correctly; mobile had no
horizontal overflow and retained 44–48 px controls; no browser warning/error
was reported. After promotion, the no-flag URL opened the tracked reader and
staff adoption bridge, the tab read exactly **History**, and
`?itemHistory=0` removed both bridges. The current item-focused known answers
are **245/245**: 145 original schema/adoption/transfer/provenance checks, 31
approved-mock checks, 36 reader/management checks, 18 atomic-attunement checks,
and 15 identification/rename SQL checks. The production harness was rechecked
at 1440×900 and 390×844; custody
showed `Cosmere Runestar`, mobile had no horizontal overflow, and the management
controls retained 48px touch targets. Identification showed the prepared public
reveal and confirmation; rename preserved a separate history summary; transfer
offered the human destination `Líadan Luchóg` and narrated cleared bearer state.
The repository still does not provide
`jsdom`, so its older optional Gear DOM smoke could not start; the real browser
harness is the visual gate used here.

Remaining field gates: confirm the live application state of
`schema_delta_item_attunement.sql` and `schema_delta_item_management.sql`; deploy
the promoted cache-stamped files; exercise a separate required item through
Attune/Release; identify and rename a safe tracked test item; and transfer it
between two test bearers on desktop and mobile. Confirm both sheets refresh and
the new history moments appear oldest-first. The reader is field-visible, but
the complete management pass is not yet field-proven against live rows.

Re-run all nine item smokes plus `node --check` on every touched JS/MJS file. A
green smoke does not replace real desktop/mobile browser verification for Gear
UI.

### August 17–18 Loot Workshop mock checkpoint

M approved a staff-facing **Loot Workshop** direction, but only as the
standalone `_edits/mock-loot-workshop.html`. It has no dependencies, database
writes, production imports, or live Forge/World/Chronicle/Gear connections.

The current interaction begins with a one-time **Greetings, DM** setup for
rules edition, approved source books, and default party behavior. Those mock
preferences live only in browser `localStorage` and can be changed later. The
ordinary workflow then asks one question at a time:

1. what the loot is for;
2. how much the party deserves, revealing only the controls relevant to that
   choice;
3. what the private editable bundle contains;
4. whether to attach that bundle to a later fight, location, or trigger; and
5. whether to keep it planned, mark it ready, introduce it in the world, or
   award it.

Encounter loot can look up a deliberately small mock monster catalogue, build
a roster, adjust quantities and a leader, and read party-relative difficulty.
It may instead begin with a desired reward or accept known CRs manually. The
current calculations reuse the shape of the real Forge Encounter Read helpers,
but the mock does not create a Forge fight. Reward-first language explicitly
states that 5e does not prescribe one mandatory encounter CR for a particular
magic item.

Rolling creates a private editable bundle automatically. Ordinary currency and
valuables remain ordinary inventory. A notable magic item may be introduced
identified or unidentified and is the only kind of result intended to enter the
durable-item path. The latest correction preserves both names across repeated
state changes: **Smoky glass vial → Potion of Climbing → Smoky glass vial**.
M field-confirmed that round trip.

Current evidence:

```text
smoke-loot-workshop-mock: 140 passed, 0 failed
smoke-encounter-read:       41 passed, 0 failed
```

Desktop and mobile browser passes covered onboarding, saved mock preferences,
edition filtering, encounter/reward paths, progressive disclosure, and the
identification round trip. The real production boundary remains closed. Before
production, M must approve the final language and interaction, the project must
choose the authoritative licensed treasure-table data and exact 2014/2024 book
coverage, and a separate durable roster/bundle contract must be designed for
any future Forge or World attachment.

### August 19 campaign connections + map-history direction — approved

M directed the roadmap forward from item history into map history and the
connections among sections. The first slice remains mock-first:
`_edits/mock-campaign-connections-map-history.html` is standalone, has no
dependencies, performs no reads or writes, and does not alter production World,
Chronicle, Gear, Forge, or SQL.

M approved the mock's interaction and language on August 19. It settles these
presentation rules:

- one recorded campaign moment is the fact; World, Chronicle, Item History,
  and Encounter are projections that open the same identity;
- current item custody/location is current truth, not a rewrite of the place
  where an earlier item event occurred;
- `entities.id`/Living Codex location keys remain the World link authority;
  a nested place uses its top-level parent's continent pin rather than creating
  a second pin;
- approximate knowledge renders as a `?` region. Staff exact truth is a
  separate layer and cannot leak into the player projection;
- co-located moments cluster at one map home;
- an unlocated event remains valid item history but receives no guessed World
  pin, and every unavailable connection narrates why;
- personal World marks in `data/map-pins.json` are excluded from permanent
  history because they are mutable/deletable presentation marks; and
- the existing item-event fields remain the source link vocabulary:
  session, location, moment, encounter, Journal page, feed post, and battle
  map. The shared `momentId` joins projections without consumer-
  specific shadow IDs.

At mock approval, one contract gate remained intentionally unresolved. Legacy
Combat identifies a
battle map through `scenes.key`/`encounters.map_ref`, while the current Forge
identifies a shared table through `forge_sessions.id` and stores its exact map
document inside that row. The guarded SQL candidate below now chooses typed
`scenes.id` or `forge_sessions.id` references; the mock's readable battle-map
label remains presentation only.

Evidence: `smoke-campaign-connections-map-history-mock` passes **64/64**.
Desktop and 390×844 browser passes covered player/staff audience changes,
cross-section selection, filters, approximate truth, location clustering, and
an unlinked Hexblade event. Mobile measured no horizontal overflow and 62px
connection targets. No browser warning/error was reported. M first approved
this interaction/language direction, then separately authorized the guarded
local production build described below.

M then authorized the first production build. The local guarded candidate uses
`campaign-moments.js` as the shared `tok-campaign-moment/v1` reader and
`schema_delta_campaign_moments.sql` as the unapplied database contract. World
loads Party's Path only through `?path=1`, while `?campaignLinks=1` carries the
same `moment` identity into Chronicle and the full-sheet item reader. The SQL
stores either `scene_id → scenes.id` or `forge_session_id → forge_sessions.id`;
it cannot persist a friendly battle-map label as identity. Public moments and
`campaign_moment_secrets` have separate RLS, so approximate party knowledge and
staff exact coordinates are different database projections.

The build remains local and read-only. No sample production moment is seeded,
the migration is not applied, and Forge runtime files are untouched. Current
evidence is **34/34** campaign-moment checks, **279/279** affected runnable item
checks, **11/11** Living Codex checks, and **36/36** relevant unchanged Forge
checks. The real item-history harness passes at 1280×720 and 390×844 with no
horizontal overflow, visible cross-section links, and 44px mobile link targets.
The Chronicle and sheet DOM smokes cannot start because `jsdom` is absent; the
unapplied World/Chronicle data path still requires an authenticated field pass.

## 6. File ownership map

- `item-provenance.js` — pure durable identity/event/replay contract; no page
  wiring.
- `schema_delta_item_provenance.sql` — tables, constraints, indexes, RLS,
  grants, and append-only event trigger; applied live.
- `schema_delta_item_adoption.sql` — atomic staff adoption RPC; applied live.
- `schema_delta_item_transfer.sql` — atomic member transfer RPC; applied live.
- `schema_delta_item_attunement.sql` — explicit durable requirement plus atomic
  staff rule and bearer Attune/Release RPCs; committed, live application state
  to confirm.
- `schema_delta_item_management.sql` — atomic staff identification and rename
  RPCs with append-only events; committed, live application state to confirm.
- `item-adoption.js` — full-sheet staff adoption client and dialog; promoted by
  default locally with `?itemHistory=0` rollback.
- `item-history.js` — tracked-item reader plus staff attunement-rule
  control and guarded campaign-moment links; public/history for members,
  separate secrets only for staff; full sheet only.
- `campaign-moments.js` — guarded shared moment reader, location-parent
  projection, clustering, path ordering, and cross-section URL authority.
- `schema_delta_campaign_moments.sql` — unapplied typed moment/map contract and
  separate staff-only exact truth; no seed data.
- `world.html` — guarded `?path=1` Party's Path production candidate.
- `chronicle.html` — guarded `?campaignLinks=1` feed-entry connection candidate.
- `sheet-v2.html` — current full-sheet include/mount seam; loads the shared
  campaign reader before item history.
- `gear-manager.js` — existing inventory renderer/editor; do not refactor it to
  solve item history unless the approved mock proves that seam is required.
- `tests/fixtures/item-adoption-harness.html` — standalone production-module
  browser harness.
- `tests/fixtures/item-history-harness.html` — in-memory production-reader
  browser harness for audience, state, chronology, desktop, and touch proof.
- `tests/smoke/smoke-item-*.mjs` — item schema/client/transition gates.
- `_edits/mock-item-import-history-gear.html` — approved standalone Gear/import
  presentation; no production wiring.
- `_edits/mock-loot-workshop.html` — current standalone Loot Workshop approval
  surface; no production wiring.
- `tests/smoke/smoke-loot-workshop-mock.mjs` — structural and interaction
  known-answer gate for the Loot Workshop mock.
- `_edits/mock-campaign-connections-map-history.html` — approved standalone
  campaign-moment, Party's Path, and cross-section navigation direction; no
  production data or wiring.
- `tests/smoke/smoke-campaign-connections-map-history-mock.mjs` — approved-mock
  identity/link/location/audience/responsive contract gate.
- `tests/smoke/smoke-campaign-moments.mjs` — production schema/reader/World/
  Chronicle known-answer gate.
- `netlify/functions/items2.js` — existing importer endpoint; it does not create
  durable item instances automatically.

## 7. What is not built or not yet field-proven

- The adoption and reader bridges still do not mount into the rail/mounted
  sheet.
- Smoky unidentified styling exists in the reader and tracked-detail opener,
  but is not applied to the closed Gear list/grid tile.
- Identification, rename, required-attunement, and transfer management are not
  yet signed-in field-proven as one complete live workflow.
- Import can populate ordinary inventory and an existing row can be adopted
  afterward, but import itself cannot begin unidentified and the approved Gear
  presentation improvements remain mock-only.
- Loot Workshop setup, rolling, bundle editing, attachments, and release are
  mock-only. No authoritative treasure-table dataset or production persistence
  contract has been approved.
- Item events are not yet live-projected into Chronicle, World, NPCs,
  encounters, or battle-map UI. A guarded local World/Chronicle/item read
  candidate exists, but its SQL and real rows are not live.
- The local schema now settles canonical battle-map identity as one nullable
  typed reference to either `scenes.id` or `forge_sessions.id`; live application
  and real-row verification remain open.
- No campaign-moment authoring UI or client write path is approved. The first
  field row must be inserted deliberately only after every linked real identity
  is checked.
- Quests and objective evidence do not exist.
- Evolving-item deeds/unlocks do not exist. Manual `transformed` history is only
  a contract capability today.

Do not describe any of these as absent without grepping again; this list records
the state at the August 18 checkpoint, not an eternal claim.

## 8. Approved build order

### A. Finish the item workflow

Keep the field-proven full-sheet path stable with `?itemHistory=0` available for
rollback. Separately port it to the mounted/rail sheet only after the remaining
full-sheet management gates pass. Preserve staff authority and deliberate
one-item adoption.

### B. Complete item management

Complete the approved Gear/import presentation: visible description, rarity
color, closed-row history marker, and an explicit unidentified import path.
Keep history viewing, identification, renaming, attunement, and real transfer
controls safe and append-only. Never make every imported sword a campaign
object.

Only after M separately approves the Loot Workshop for production, settle its
licensed rules-data authority and durable bundle/roster contract. Do not treat
the current mock catalogue or illustrative rolls as game authority.

### C. Connect campaign entities

Establish stable links among items, sessions, Chronicle moments, NPCs,
encounters, battle maps, and locations. Reuse the event link fields already in
the database; do not create consumer-specific shadow IDs.

### D. Build the Party's Path

Project confirmed locations, approximate `?` regions, session events,
discoveries, battles, acquired treasure, and NPC meetings onto World. Preserve
desktop mouse/keyboard exploration and mobile touch exploration.

### E. Introduce the quest foundation

Staff-created quests need quest giver, multi-step objectives/deeds, public
hints, secret truth, approximate or confirmed map destination,
Chronicle/session evidence, completion state, and rewards.

### F. Add evolving items

The richer transformation loop is:

**Complete deeds → attach campaign evidence → unlock an ability or new form →
record the awakening in item history.**

Identity persists through every awakening, rename, and transfer.

## 9. Exact next slice for a fresh session

M explicitly advanced the roadmap on August 19 into map history and the
connections among sections. The guarded local read slice exists, but live SQL
application and promotion remain closed.

1. Synchronize against `AGENTS.md`, `CONTEXT.md`, this handoff, current `HEAD`,
   working tree, and changes since `893e1d2`.
2. Review and apply `schema_delta_campaign_moments.sql` after confirming its
   prerequisite tables are live. Do not seed its illustrative mock IDs.
3. Resolve one safe real moment's feed, Journal, encounter, Living Codex
   location, item-event, and typed scene-or-Forge identities before inserting
   that first field row.
4. Exercise `world.html?path=1`, the linked Chronicle entry, and the linked
   full-sheet item history as player and staff on desktop and mobile. Confirm
   approximate truth, staff exact truth, clustering, deep links, and narrated
   missing links against that one real fact.
5. Preserve Living Codex location identity, nested-parent projection,
   approximate-versus-confirmed truth, and database-enforced staff secrets.
   Personal GitHub-backed World marks remain outside permanent history.
6. Keep the read slice guarded until the authenticated field pass succeeds.
   Do not add authoring UI, client writes, quests, or evolving-item automation
   during that proof.
7. Carry the existing item gates independently: confirm management SQL live
   state; field-test Attune/Release, identify, rename, and transfer; complete
   the approved Gear/import presentation; and keep mounted-sheet rollout as a
   separate boundary.
8. Preserve the Loot Workshop's approved standalone interaction and 140/140
   smoke. Its licensed data and bundle/roster persistence boundary remain
   separate from campaign-moment production work.

The presentation and local read contract are settled: one fact, honest links,
no guessed map truth, and typed battle-map identity. The next decision is
whether the authenticated one-row field pass is trustworthy enough to promote
the guarded readers; local build approval does not make the unapplied SQL live.
