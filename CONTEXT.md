# CONTEXT.md — Trials of Kirtas
*Updated 2026-07-03, end of the July 3 EVENING session (the shelf arc). Upload this at the top of the next session.*

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
  columns immediately.
- SQL deltas are idempotent, `GRANT`ed to `authenticated`, staff-gated via
  `is_staff()`, and where feasible **validated on a local Postgres 16** before
  handover.

## ⚠ Theme status — RESOLVED for chronicle + journal (July 3 evening)

The expedition landed. **The shelf aesthetic is approved and locked for the
chronicle and the journal**: one worn paper + grain/mottle overlays, SIX INKS
+ SIX PAPERS as two independent per-reader axes, Anton (display) /
DM Serif Display (poster) / EB Garamond (body) / Archivo (utility),
hairline rules, Miranda accordion mechanics. M's words: "this is really
really special" / "blown away." Site-wide adoption beyond these two surfaces
is a separate, still-open call — do not repaint other pages on this
authority. The old "Phantom theme" note stands: it was a test theme, never
canon.

**The two approved mocks (the north star — build from these):**
- `mock-chronicle-shelf-2.html` — the CHRONICLE. Sessions as vertical book
  spines, chronological L→R, name-first hierarchy (session NAME giant
  vertical, "Session N" small). Miranda accordion: click a spine → volume
  expands IN PLACE, shelf stays standing both sides, panel scrolls
  internally (entries oldest→newest — the reading-direction problem
  dissolves). Boxed tags / centered poster title / serif intro in the panel
  head; prev/next volume footers; Esc + ←/→; single volume open at a time;
  hover peek card on closed spines; intro spine at far left.
- `mock-journal-vault.html` — the JOURNAL. **Obsidian bones, shelf skin**
  (the vault-shelf accordion draft was REJECTED for the journal — story
  wants drama, tools want at-a-glance; see pinned lesson). Persistent left
  tree rail (sections + pages + comment badges + active bar), seat-dot vault
  switcher (own = editable-in-place, foreign = read-only everywhere),
  write-immediately pages (no edit mode), backlinks footer, `+ New page`
  per section. Honors pinned behaviors: plain-click pagelinks in read-only,
  ⌘/Ctrl-click while editing, dead links no-op, comments are rows ABOUT the
  page with owner Accept/Edit-then-accept/Dismiss, atomic attribution chips.

**Decisions locked with the mocks:**
- **Ink + paper are PER-READER** — persist both into `profiles.appearance`
  via `set_my_appearance` (replace-not-merge, full object) alongside the
  seat accent. Nobody's choice repaints anyone else.
- **Axes are independent and smoke-asserted:** ink swaps never write
  `--paper`; paper swaps never write `--ink`/`--accent`. The six papers are
  desaturated complements/neighbors of the ink hues — every ink legible on
  every paper (36 combos).
- Chronicle shelf replaces the *reading* layer only; writing stays in
  chronicle.html until increment 3.

## Architecture spine (stable)

- **Stack:** vanilla JS/HTML/CSS + Supabase (Postgres/Realtime/RLS) + Netlify
  + GitHub. One walled corner: `journal/` (React + Vite + TipTap) → builds to
  `journal-assets/journal.js|css`, loaded by root `journal.html` with `?v=`
  cache-bust stamps.
- **Feed is one live stream** (`feed` table); the chronicle/book is a
  **reading layer** over it. Combat/Chronicle are channel filters. The shelf
  is the book's new render — `bookModel.js` chapters map onto volumes,
  entries onto the panel.
- **Profiles:** `profiles.user_id` is the auth UID (not `profiles.id`).
  Appearance persists in `profiles.appearance` jsonb via `set_my_appearance`
  RPC (**replace-not-merge**). ⚠ Repo copy of that RPC filters
  `where id = auth.uid()` while the deployed one works — reconcile someday.
- **Party seats:** cosmere (ianakira) · liadan (nazanroseaktas) ·
  caim (jayvanmidde) · vesperian (thebraveruby) · DM/narrator (hagakuredisc).
- **Seat colors are never stored in content.** Content stores seat KEYS;
  paint resolves at render via `journal/src/comments/accents.js`. The mocks'
  baked seat hexes are placeholders — the build resolves through accents.js.

## Journal (the walled corner) — current state

- **Pages:** party-readable, author-only-edit (`journal_pages` RLS).
  `?character=<key>` renders any seat's vault read-only. Slug = the
  `[[wikilink]]` target and is **stable**: rename is title-only
  (`renamePage`); `savePage`'s title path re-slugs and must never be used for
  rename (smoke-pinned).
- **Organization (deployed):** drag-reorder (`sort_order`, nulls-last),
  drop-on-section move, ⋯ menu rename/delete; foreign pages read-only with
  staff delete. Curation queue (staff): Canonize, Edit, Merge (rewrite
  preview + "also correct chat" checkbox), Discard.
  ⚠ Drag-reorder + ⋯ menu are NOT represented in the vault mock — they
  survive the reskin unchanged; skin them onto tree rows during the build.
- **Entities:** `entities` + tooltips canon, merged in `entityStore`.
  `canonize_entity` / `merge_entity` SECURITY DEFINER RPCs (staff-gated,
  USER token). `entity_aliases` read at typing time in the journal's `@`
  pool (deployed July 3). ⚠ The RAIL composer (`mention-composer.js`)
  still does NOT consult aliases — small standalone patch when wanted.
- **Comments (deployed):** `journal_comments` — rows ABOUT a page. STRICT
  quote+context anchors; ambiguity orphans, never guesses. Highlights are
  ProseMirror decorations. Owner: Accept / Edit-then-accept / Dismiss;
  commenter: Withdraw. Accept inserts the atomic `attribution` node. Comment
  rows keep the author's words forever (trigger, validated on local PG).
- **Editor config:** ONE `editorProps` key only (duplicate-key clobber
  lesson). **PageLinks:** `[[` pool takes the INJECTED active vault; chips
  navigate plain-click read-only, ⌘/Ctrl-click editing; dead links no-op.

## The book (journal's Chronicle tab) — current state

- `bookModel.js` (pure): feed rows → chapters. **Deployed order verified
  live July 3** ✓ (freshest-first chapters; narrative order within).
  Session-repair re-stamp verified ✓ — the book shows a proper Session 2
  chapter ("The Journey Into Kirtas").
- The shelf render replaces the current book render (increment 1.5, next
  build). Chapter freshest-first becomes shelf-order-chronological with the
  NEW tag on the latest — the accordion makes stack order a non-issue.
- **Naming:** seat map leads (character name displays, hover reveals player
  alias). TODO(multi-campaign): seat maps → profiles.
- **NOT YET:** medallion portraits (slot into spine feet + entry bylines),
  threads-as-replies, the composer, realtime refresh.

## chronicle.html (legacy, patched, awaiting retirement)

- July 3 patch set deployed ✓ (write-first `bumpSessionTo` with `.select()`
  row-count check, staff-only 20h prompt, session out of draft save/restore,
  clipboard-pipeline loads, chip guard). `session-repair.sql` run ✓ and the
  re-stamp verified ✓. Writing continues here until increment 3.

## Pinned lessons (July 3, both sessions)

1. **Supabase `.update()` under RLS returns NO error on a blocked write — it
   matches 0 rows.** Append `.select()` and check row count.
2. **Postgres `regexp_replace`: bare `&` is LITERAL; `\&` is the WHOLE
   MATCH.** Only backslashes need doubling.
3. **Duplicate keys in a JS object literal silently clobber.** Grep first.
4. **Indirect `eval()` scopes top-level `let`/`const` to the eval call.**
   Harnesses inject stubs as a real `<script>` under
   `runScripts:'dangerously'`.
5. **Pure cores for headless smokes** — testable logic lives JSX-free.
6. **`sh` has no brace expansion.** Explicit paths; verify the zip listing.
7. **Local Postgres validation of SQL deltas is worth the setup.**
8. Stub the PUBLISHER'S contract in harnesses.
9. **(new) Same skin, different bones.** The accordion that made the
   chronicle sing was wrong for the journal — a story rewards ceremony; a
   tool rewards zero clicks between thought and page. Reuse the material
   (paper/grain/inks/type), not the mechanics, when the surface's JOB
   differs. The vault-shelf journal draft is the cautionary artifact.
10. **(new) Two-axis theming needs the independence invariant IN THE
    SMOKES:** ink swaps never write `--paper`, paper swaps never write
    `--ink`/`--accent`. Asserted in all three shelf-family mocks; carry the
    assertion into the live build. (Amends the one-paper Kazuki rule:
    paper is now a user axis, but the axes never cross.)
11. **(new) jsdom has no `matchMedia`** — guard
    `typeof matchMedia === 'function'` in inline page scripts that harnesses
    will load.

## Theme expedition — CLOSED (superseded by the approved pair)

The four July 3 daytime studies (`mock-broadsheet`, `mock-gazette`,
`mock-journal-gazette-2`, `mock-journal-gazette-3`) fed the winner and are
retired as candidates. Lineage for the record: Miranda boldness + accordion
(from the /work page M sent), gazette-3's corrected Kazuki behavior (constant
paper, inks recolor type) now extended to the two-axis system. The
intermediate drafts this session: `mock-chronicle-index.html` (horizontal
Miranda index — superseded), `mock-chronicle-shelf.html` (spines with wipe
transition — superseded by the accordion), `mock-journal-shelf.html`
(journal as vault-shelf — REJECTED, kept as lesson 9's artifact).

## THE MAP — next session's moves, in order

1. **Build: the chronicle shelf over real data.** Read the journal app
   source + `bookModel.js` + Chronicle tab render AS THEY ARE first. Port
   the approved shelf mock onto the real render: chapters → volumes,
   entries → panel, seat paint through `accents.js`, session titles from
   the seat/session data. Reading layer only; CSS-first, no behavior
   changes to the model. jsdom smokes carry over the mock's assertions
   (accordion single-open, order, boundaries, axis independence).
2. **Ink + paper persistence** — extend the appearance jsonb payload with
   the two choices via `set_my_appearance` (full merged object). No SQL
   needed. Boot path paints before first render to avoid a flash.
3. **Journal reskin** — the vault mock's CSS onto the real journal
   (tree rail, seat-dot switcher, page surface). TipTap slides under the
   new skin; drag-reorder and ⋯ menu re-skinned in place, not rebuilt.
4. **Medallion portraits** (THE MAP's old #1, now better-slotted): recon
   the portrait source (characters table / party wiring / Cloudinary URLs),
   pipe into spine feet + entry bylines + book medallions.
5. **Threads + composer INTO the panel** (increment 2, mock first): replies
   as first-class threads; the locked minimal composer (bold, italic, H2,
   quote, `@`, `[[`) at the foot of an open volume. Donor organs:
   `docToFeedBody` + the journal composer.
6. **Increment 3 — Quill retirement:** chronicle.html's drawer stands down;
   the shelf panel becomes the writing surface.
7. **Rail alias wiring** (small, standalone): `mention-composer.js`
   consults `entity_aliases`.
8. **Parked, unscheduled:** Shared Quest Hub; site-wide adoption of the
   shelf aesthetic (separate decision); reconcile committed
   `set_my_appearance`; folder rename/delete/reorder; book realtime
   refresh; orphan-comment "send to my journal"; real ink hexes eyedropped
   from kazukinoda.com if M wants fidelity (current six are C's picks in
   his register).

## Deploy ledger

**Daytime session (all verified live):** chronicle patch set ✓ → org arc ✓ →
comments arc ✓ → pagelink fix ✓ → book arc inc. 1 ✓ → alias wiring ✓ →
book fixes ✓ → book ordering ✓ (verified live, evening) →
session-repair.sql ✓ (re-stamp verified in the book, evening).

**Evening session (mocks only — nothing deployed):** approved:
`mock-chronicle-shelf-2.html` (26-assertion smoke family, 21/21) and
`mock-journal-vault.html` (27/27). Superseded/rejected drafts kept for
lineage: `mock-chronicle-index.html` (15/15), `mock-chronicle-shelf.html`
(20/20), `mock-journal-shelf.html` (26/26). All self-contained, baked data.
