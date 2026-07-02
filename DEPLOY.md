# Organization arc — deploy manifest

Everything under `org-arc/` mirrors the repo layout. Upload each file to the
same path in `Manik-Khan/trials-of-kirtas`.

## Order of operations
1. **Run the SQL first** (Supabase SQL editor):
   `journal/sql/schema_delta_journal_org.sql`
   — adds `journal_pages.sort_order`, `entity_aliases`, `canonize_entity()`,
   `merge_entity()`. Idempotent. Validated on a local Postgres 16
   (T1–T5: canonize resolve-flip · merge with ref-collision dedupe · label
   escaping incl. `&`/`<`/`>` · guards · re-run safety).
2. **Then the files** (the UI calls the RPCs; without the SQL, curation
   actions error visibly but nothing breaks):
   - `journal.html`                        (root — new ?v= cache-bust stamp)
   - `journal-assets/journal.js`           (root — rebuilt bundle)
   - `journal-assets/journal.css`          (root — rebuilt bundle)
   - `journal/src/App.jsx`
   - `journal/src/JournalView.jsx`
   - `journal/src/CurationQueue.jsx`       (new)
   - `journal/src/styles.css`
   - `journal/src/data/supabase-adapter.js`
   - `journal/src/data/live-vault.js`
   - `journal/src/data/vault.js`
   - `journal/src/data/backend.js`
   - `journal/smoke-org.mjs`               (new harness)
   - `journal/smoke-journal.mjs`           (stub fix: chainable .order)
3. Hard-refresh after deploy (the browser caches .js).

## What shipped
- Tree organization (own vault): ⋮⋮ drag-reorder within a section, drop on a
  section name to move, ⋯ menu with Rename / Delete. Rename is TITLE-ONLY —
  the slug ([[wikilink]] target) never changes, so backlinks hold. Foreign
  rows (All view / others' pages): read-only, staff see Delete only.
- Curation queue (staff, bottom of the journal): Canonize (resolve-flip —
  every dashed chip lights solid in docs, html caches, AND feed bodies),
  Edit name/descr, Merge into canon (rewrite preview + the "also correct
  chat messages" checkbox — off by default, chat is a record), Discard.
  Players keep the informational "New to the world" list.
- merge_entity leaves the old key in entity_aliases; note the aliases table
  is not yet consulted at typing time — wiring the composer/suggestion pool
  to resolve aliases is a small follow-up increment.

## Validation
- smoke-org.mjs: 14/14 (vault sort/rename/delete/reorder + adapter
  contracts: renamePage never re-slugs; RPC params exact)
- smoke-journal.mjs: 81/81 (regression; stub now models supabase-js's
  chainable .order — stub the publisher's contract)
- SQL: T1–T5 green on local Postgres 16
- vite build clean; journal-preview.html regenerated (open it standalone to
  eyeball the tree + queue with sample data; sample mode fakes the RPCs)

## Not built (logged for future arcs)
- Shared Quest Hub (party-shared quest section, distinct from personal
  "Quests" folders) — M's note this session.
- entity_aliases consulted at typing time (see above).
- Folder rename/delete/reorder (sections are still just text values).
