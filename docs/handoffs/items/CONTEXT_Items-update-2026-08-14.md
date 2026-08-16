# Durable item system handoff — current through 2026-08-14

Status: **identity/schema, staff adoption, and server-side transfer are applied;
the first real full-sheet adoption flow is field-proven behind a flag. The next
slice is tracked-item detail/history and management.**

This document is the current item-system authority. Read it with `AGENTS.md`
and `CONTEXT.md` before touching Gear, inventory imports, item SQL, Chronicle
links, or World-map item projection.

Baseline when this handoff was written: clean `main` at `cc388e1`
(`items and ownership`), matching `origin/main`. M deploys manually. Codex never
pushes and commits only when M explicitly asks.

## 1. Executive verdict

The notable-item architecture is now real rather than a standalone concept.

- A notable object has one permanent identity independent of inventory index,
  bearer, or mutable name.
- Party-readable current state, staff-only unrevealed truth, and append-only
  history are separate database records.
- Staff can intentionally adopt one existing quantity-one Gear row through the
  real full character sheet.
- A tracked item can already be transferred atomically on the server without
  losing its identity or historical bearer chain, although no production
  transfer button exists yet.
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

`sheet-v2.html` loads `item-adoption.js?v=ia2`. The bridge is inert unless the
URL includes `?itemHistory=1`, and it mounts only for a `dm` or `overseer`.

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
- the default URL without `itemHistory=1` remained inert.

Current focused known answers at `cc388e1`:

```text
smoke-item-provenance-sql:  28 passed, 0 failed
smoke-item-adoption-sql:    27 passed, 0 failed
smoke-item-adoption-ui:     28 passed, 0 failed
smoke-item-provenance:      37 passed, 0 failed
smoke-item-transfer-sql:    25 passed, 0 failed
TOTAL:                     145 passed, 0 failed
```

Re-run all five plus `node --check` on every touched JS/MJS file. A green smoke
does not replace real desktop/mobile browser verification for Gear UI.

## 6. File ownership map

- `item-provenance.js` — pure durable identity/event/replay contract; no page
  wiring.
- `schema_delta_item_provenance.sql` — tables, constraints, indexes, RLS,
  grants, and append-only event trigger; applied live.
- `schema_delta_item_adoption.sql` — atomic staff adoption RPC; applied live.
- `schema_delta_item_transfer.sql` — atomic member transfer RPC; applied live.
- `item-adoption.js` — flagged real-sheet staff adoption client and dialog.
- `sheet-v2.html` — current full-sheet include/mount seam.
- `gear-manager.js` — existing inventory renderer/editor; do not refactor it to
  solve item history unless the approved mock proves that seam is required.
- `tests/fixtures/item-adoption-harness.html` — standalone production-module
  browser harness.
- `tests/smoke/smoke-item-*.mjs` — item schema/client/transition gates.
- `netlify/functions/items2.js` — existing importer endpoint; it does not create
  durable item instances automatically.

## 7. What is not built

- The adoption bridge is not enabled by default and does not mount into the
  rail/mounted sheet.
- A tracked item currently shows only a small **History active** state in Gear;
  there is no real item-history reader.
- Smoky unidentified styling is not yet applied to the tracked Gear card/detail.
- Identification and rename exist in the pure contract but have no narrow live
  RPC or production UI.
- The transfer RPC exists, but there is no destination picker, confirmation,
  failure narration, or post-transfer refresh in Gear.
- Import can populate ordinary inventory, but it has no deliberate adopt-this-
  import action.
- Item events are not yet projected into Chronicle, World, NPCs, encounters, or
  battle-map UI.
- Quests and objective evidence do not exist.
- Evolving-item deeds/unlocks do not exist. Manual `transformed` history is only
  a contract capability today.

Do not describe any of these as absent without grepping again; this list records
the state at `cc388e1`, not an eternal claim.

## 8. Approved build order

### A. Finish the item workflow

Promote the field-proven full-sheet adoption flow deliberately. Decide whether
the next field candidate removes `?itemHistory=1`, and separately port it to the
mounted/rail sheet only after the full-sheet behavior remains stable. Preserve
staff authority and deliberate one-item adoption.

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
3. Mock the tracked-item detail/history experience first. It should make public
   versus staff-only truth, smoky unidentified state, event chronology, and the
   available identify/rename/transfer actions legible on desktop and touch.
4. M approves the standalone mock.
5. Build the smallest flagged production reader for `item_instances`,
   `item_events`, and staff-visible `item_secrets`.
6. Add narrow append-only SQL operations for identification/rename only when
   their approved UI requires them; never direct-write history tables.
7. Wire the already-applied `transfer_item` RPC through a narrated confirmation
   flow and verify both bearer sheets after transfer.
8. Field-test the complete tracked-item workflow before crossing into entity
   links or World.

The immediate product question is no longer whether permanent item identity is
plausible. It is how the real Gear detail makes that identity and history feel
special, clear, and safe to manage.
