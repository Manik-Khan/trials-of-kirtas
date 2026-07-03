# CONTEXT.md — Trials of Kirtas
*Updated 2026-07-03, end of the July 3 session. Upload this at the top of the next session.*

---

## The working contract (unchanged, load-bearing)

- **Read repo source before editing.** Never edit from memory of a file.
- **Mock → approve → build** for anything UX-bearing. Mocks are self-contained
  HTML with baked data; nothing persists.
- **`node --check` + jsdom smokes before handover.** Pure cores get their own
  harnesses; counts are honest (no placeholder tests).
- **Surgical edits only.** Never change a shared variable for a per-page issue.
- **M deploys manually** (GitHub web upload + Supabase SQL editor). C never
  commits or pushes. Multi-file handovers ship as a **zip mirroring the repo
  layout** with a per-file destination table in `DEPLOY.md`.
- **SQL before files** when a deploy has both — the client queries the new
  columns immediately (the July 3 `sort_order` error was this, caught by the
  error message doing its job).
- SQL deltas are idempotent, `GRANT`ed to `authenticated`, staff-gated via
  `is_staff()`, and where feasible **validated on a local Postgres 16** before
  handover (this caught a real corruption bug — see pinned lessons).

## ⚠ Theme status — READ THIS, it keeps regressing

**The "Phantom theme" was an early TEST theme, not the site's identity.** It
kept re-entering context docs as if canonical; it is not. **The site currently
has no chosen theme** — M is actively searching. Four aesthetic studies from
July 3 are staged as candidates (see "Theme expedition" below). Do not treat
dark-parchment/gold as load-bearing; do treat `theme.css` variables as the
mechanism any chosen theme will flow through.

---

## Architecture spine (stable)

- **Stack:** vanilla JS/HTML/CSS + Supabase (Postgres/Realtime/RLS) + Netlify
  + GitHub. One walled corner: `journal/` (React + Vite + TipTap), which
  builds to `journal/dist` → committed at repo root as `journal-assets/journal.js|css`,
  loaded by root `journal.html` with `?v=` cache-bust stamps.
- **Feed is one live stream** (`feed` table); the chronicle/book is a
  **reading layer** over it. Combat/Chronicle are channel filters.
- **Profiles:** `profiles.user_id` is the auth UID (not `profiles.id`).
  Appearance persists in `profiles.appearance` jsonb via `set_my_appearance`
  RPC (**replace-not-merge** — always send the full merged object).
  ⚠ Repo copy of that RPC filters `where id = auth.uid()` while the deployed
  one evidently works — repo file may be stale; verified accent saves persist
  live (July 3), so deployed ≠ committed. Reconcile the committed file someday.
- **Party seats:** cosmere (ianakira) · liadan (nazanroseaktas) ·
  caim (jayvanmidde) · vesperian (thebraveruby) · DM/narrator (hagakuredisc).
- **Seat colors are never stored in content.** Content stores seat KEYS
  (`data-attrib="caim"`, `data-seat`, `actor_key`); paint resolves at render
  via `journal/src/comments/accents.js`: chosen accent
  (`profiles.appearance.accent`) → fallback palette → stable hash. Changing an
  accent repaints all history by construction.

## Journal (the walled corner) — current state

- **Pages:** party-readable, author-only-edit (`journal_pages` RLS).
  `?character=<key>` renders any seat's vault read-only. Slug = the
  `[[wikilink]]` target and is **stable**: rename is title-only
  (`renamePage`); `savePage`'s title path re-slugs and must never be used for
  rename (smoke-pinned).
- **Organization (deployed):** drag-reorder (`sort_order`, nulls-last),
  drop-on-section move, ⋯ menu rename/delete; foreign pages read-only with
  staff delete. Curation queue (staff): Canonize (resolve-flip), Edit, Merge
  (rewrite preview + "also correct chat" checkbox, off by default), Discard.
- **Entities:** `entities` table + tooltips canon, merged in `entityStore`.
  `canonize_entity` / `merge_entity` SECURITY DEFINER RPCs (staff-gated,
  called with the USER token — service role has no `auth.uid()`).
  `entity_aliases` (typo → canon) is **written by merge and now READ at
  typing time** in the journal's `@` pool (deployed July 3): typing a retired
  key surfaces canon, inserts the canon chip, and can never re-seed the stub.
  ⚠ The RAIL composer (`mention-composer.js`, chronicle-side) does NOT
  consult aliases yet — small standalone patch when wanted.
- **Comments (deployed):** `journal_comments` — rows ABOUT a page, never
  writes TO it. Quote+prefix/suffix anchors; STRICT matching (exact context →
  unique quote → orphan to "Since edited"; ambiguity orphans, never guesses;
  anchors are content-addressed, so retyping the words re-anchors).
  Highlights are ProseMirror decorations (never serialized). Owner: Accept /
  Edit-then-accept / Dismiss; commenter: Withdraw. Accept inserts the atomic
  `attribution` node (delete/move whole, never edit inside). **The comment
  row keeps the author's original words forever — a trigger blocks anyone
  but the author from editing them** (validated on local PG). Dismissed
  comments leave the rail; only OPEN comments orphan.
- **Editor config:** ONE `editorProps` key only — `attributes.class` +
  `handleClick` merged. A duplicate key silently clobbered the styling class
  on July 3 (default blue focus ring, bullets outside the box).
- **PageLinks:** `[[` pool + create path take the INJECTED active vault
  (a static sample-vault import once leaked Session-12 fixtures into live).
  Chips navigate: plain click in read-only; Cmd/Ctrl+click while editing.
  Dead links no-op.

## The book (journal's Chronicle tab) — current state

- `bookModel.js` (pure): feed rows → chapters. Chapters **freshest-first**
  (Session 4 opens the book, Prologue closes it); entries within a chapter
  in narrative order (oldest→newest) — flip on request. Hidden rows and
  non-chronicle channels excluded. `meta.written_at` PLACES late shares at
  their proper time; >1 day gap earns the ⏱ badge. 📄 badge from
  `meta.fromJournal`.
- **Naming:** old drawer rows stored the CLASS in `meta.character`
  ('Fighter') — the seat map now leads: character name displays, hover
  reveals the PLAYER ALIAS, seat-accent medallion badge shows the initial.
  TODO(multi-campaign): seat maps → profiles.
- **Images:** clamp 420px cover-fit + click-to-lightbox (Esc/click closes).
- **NOT YET:** medallion **portraits** (needs an image source read —
  characters table? Cloudinary tokens? next session), threads-as-replies,
  the composer, realtime refresh of the book.
- Writing still happens in `chronicle.html` + journal shares until
  increments 2–3.

## chronicle.html (legacy, patched, awaiting retirement)

- July 3 patch set deployed: write-first `bumpSessionTo` with `.select()`
  row-count verification, staff-only 20h prompt, session dropped from draft
  save/restore (+ realtime repaint guard), clipboard-pipeline loads for
  editEntry/restoreDraft, chip guard on edit (delete-and-repost for
  chip-bearing rows).
- `session-repair.sql` run July 3 — campaign truth restored; verify the
  phantom-Session-2 re-stamp landed (the book's Session 2 chapter is the
  tell).

## Pinned lessons (new this session, in addition to the standing set)

1. **Supabase `.update()` under RLS returns NO error on a blocked write — it
   matches 0 rows.** Append `.select()` and check row count; this is
   load-bearing, not defensive.
2. **Postgres `regexp_replace` replacement: bare `&` is LITERAL; `\&` is the
   WHOLE MATCH** (Oracle's convention is the reverse). Escaping `&` as `\&`
   corrupted merged chips until local-PG validation caught it. Only
   backslashes need doubling.
3. **Duplicate keys in a JS object literal silently clobber** — the later
   `editorProps` erased `attributes.class`. Grep before adding a key that
   might already exist.
4. **Indirect `eval()` scopes top-level `let`/`const` to the eval call** —
   invisible to later probes. jsdom harnesses inject stubs as a real
   `<script>` before the inline one under `runScripts:'dangerously'`.
5. **Pure cores for headless smokes** (`match.js` discipline): any logic that
   must be testable lives in a JSX-free module (`pagelink-core.js`,
   `resolveMentionInsert`, `anchor.js`, `bookModel.js`).
6. **`sh` has no brace expansion** — `mkdir -p a/{b,c}` makes a literal dir
   and downstream `cp`s fail half-silently. Explicit paths in staging
   commands; verify the zip listing.
7. **Local Postgres validation of SQL deltas is worth the setup** — it caught
   lesson 2 and proved the comments history-guard trigger.
8. Stub the PUBLISHER'S contract in harnesses (supabase-js `.order()` chains).

## Theme expedition (July 3, parked by M — "scratch for now")

Four staged studies, all self-contained mocks with baked Session-4 data:
- `mock-broadsheet.html` — the Kirtas Chronicle as a two-ink newspaper
  (Miranda-inspired; M: loved the idea, too busy).
- `mock-gazette.html` — broadsheet × Noda restraint; engraved SVG plates as
  image slots; 6 paper+ink palettes.
- `mock-journal-gazette-2.html` — bold duotone rooms, visible grain, border
  vocabulary, vivid seat layer, writing affordances.
- `mock-journal-gazette-3.html` — **the corrected one**: ONE constant worn
  paper, SIX INKS that recolor type only (the actual Kazuki behavior),
  Miranda boldness (900-weight display, 5px rules, giant folio, rotated
  stamps). Harness asserts no palette touches `--paper`.
Prompting lesson recorded: after two corrections on the same axis, ASK —
don't iterate inside an assumed frame. Invariants ("the background never
changes") beat descriptions of change.

## THE MAP — next session's moves, in order

1. **Medallion portraits** (small): find the portrait source (read
   `characters` table / party page wiring / Cloudinary token URLs in repo),
   pipe into the book's medallion + potentially journal bylines. This is the
   one visible gap M named.
2. **Book increment 2 — threads + composer (mock first):** replies as
   first-class threads; the minimal rich composer (the locked set: bold,
   italic, H2, quote, `@`, `[[`) moving INTO the book. Design-bearing →
   self-contained mock → approval → build. The rail's `docToFeedBody` and
   the journal composer are the donor organs.
3. **Book increment 3 — Quill retirement:** chronicle.html's drawer stands
   down; the book becomes the writing surface too. The July 3 chronicle
   patch becomes an epitaph.
4. **Rail alias wiring** (small, standalone): `mention-composer.js` consults
   `entity_aliases` like the journal pool now does.
5. **Parked, unscheduled:** Shared Quest Hub (party-shared quest section,
   distinct from personal "Quests" folders — same party-readable pattern);
   theme decision (studies above); reconcile the committed
   `set_my_appearance` with the deployed one; folder rename/delete/reorder;
   book realtime refresh; orphan-comment "send to my journal" action.

## Deploy ledger (July 3 session, all verified live unless noted)

chronicle patch set ✓ → org arc (SQL + files) ✓ → comments arc ✓ →
pagelink fix ✓ → book arc inc. 1 ✓ → alias wiring ✓ → book fixes
(editorProps / names / lightbox) ✓ → book ordering (staged, deploy pending
at time of writing) → session-repair.sql run ✓ (verify the re-stamp).
Accent persistence verified live ✓ (deployed set_my_appearance is sound).
