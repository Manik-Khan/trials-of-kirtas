# Durable item system handoff — current through 2026-08-16

Status: **identity/schema, staff adoption, and server-side transfer are applied;
the first real full-sheet adoption flow and tracked-item reader are deployed and
field-visible behind a flag. A validated local promotion now enables both on the
normal full sheet by default, with `?itemHistory=0` retained as the rollback
switch. The mounted/rail sheet remains untouched.**

This document is the current item-system authority. Read it with `AGENTS.md`
and `CONTEXT.md` before touching Gear, inventory imports, item SQL, Chronicle
links, or World-map item projection.

Current working baseline: clean `main` at `438fcc5` (`item history updates`),
matching `origin/main`, before the uncommitted August 16 promotion slice. The
original handoff checkpoint was `cc388e1` (`items and ownership`). M deploys
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
reader lives in `item-history.js`; the August 16 local promotion is cache-stamped
as `item-history.js?v=ih9` and mounts on the normal full sheet by default. It:

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
  control; public/history for members, separate secrets only for staff; full
  sheet only.
- `sheet-v2.html` — current full-sheet include/mount seam.
- `gear-manager.js` — existing inventory renderer/editor; do not refactor it to
  solve item history unless the approved mock proves that seam is required.
- `tests/fixtures/item-adoption-harness.html` — standalone production-module
  browser harness.
- `tests/fixtures/item-history-harness.html` — in-memory production-reader
  browser harness for audience, state, chronology, desktop, and touch proof.
- `tests/smoke/smoke-item-*.mjs` — item schema/client/transition gates.
- `netlify/functions/items2.js` — existing importer endpoint; it does not create
  durable item instances automatically.

## 7. What is not built or not yet field-proven

- The local default-on promotion is not yet deployed. The adoption and reader
  bridges still do not mount into the rail/mounted sheet.
- Smoky unidentified styling exists in the reader and tracked-detail opener,
  but is not applied to the closed Gear list/grid tile.
- Identification, rename, required-attunement, and transfer management are not
  yet signed-in field-proven as one complete live workflow.
- Import can populate ordinary inventory, but it has no deliberate adopt-this-
  import action.
- Item events are not yet projected into Chronicle, World, NPCs, encounters, or
  battle-map UI.
- Quests and objective evidence do not exist.
- Evolving-item deeds/unlocks do not exist. Manual `transformed` history is only
  a contract capability today.

Do not describe any of these as absent without grepping again; this list records
the state at the August 16 promotion candidate, not an eternal claim.

## 8. Approved build order

### A. Finish the item workflow

Deploy and field-test the approved default-on full-sheet promotion with
`?itemHistory=0` available for rollback. Separately port it to the mounted/rail
sheet only after the full-sheet behavior remains stable. Preserve staff
authority and deliberate one-item adoption.

### B. Complete item management

Add tracked-item presentation, rarity color, smoky unidentified treatment,
history viewing, identification, renaming, and the real transfer control.
Connect imports so an imported row can be deliberately adopted without making
every imported sword a campaign object.

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

Stay inside **items**. Do not start Chronicle, World, quests, or evolving-item
automation yet.

1. Synchronize against `AGENTS.md`, `CONTEXT.md`, this handoff, current `HEAD`,
   working tree, and changes since `cc388e1`.
2. Grep the real full-sheet and mounted-sheet Gear callers before claiming a
   seam is missing.
3. ~~Mock the tracked-item detail/history experience first.~~ M approved the
   standalone mock.
4. ~~Build and field-display the smallest flagged production reader for
   `item_instances`, `item_events`, and staff-visible `item_secrets`.~~ Complete.
5. ~~Promote the reader and deliberate staff adoption bridge to the normal full
   sheet while preserving a rollback switch and leaving mounted Gear alone.~~
   Validated local candidate complete; deploy and field-test it.
6. Confirm the live state of `schema_delta_item_attunement.sql`, then exercise
   Attune/Release against a separate required item in staff and player sessions
   on desktop and mobile.
7. ~~Add narrow append-only SQL operations for identification/rename; never
   direct-write history tables.~~ Local candidate complete; confirm live SQL
   state and field-test.
8. ~~Wire the already-applied `transfer_item` RPC through a narrated
   confirmation flow.~~ Local candidate complete; verify both bearer sheets
   after a field transfer.
9. Field-test the complete tracked-item workflow before crossing into entity
   links or World.

The immediate product question is no longer whether permanent item identity is
plausible. It is how the real Gear detail makes that identity and history feel
special, clear, and safe to manage.
