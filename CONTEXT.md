# CONTEXT.md — Trials of Kirtas
*Updated 2026-07-03, end of the July 3 LATE session (the shelf BUILD arc
staged for deploy + the SETTINGS DIRECTION decided: themes demote to
presets, ◐ becomes the one Settings flyout, per-page looks). Upload this at
the top of the next session.*

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

## ⚠ THE SHELF IS BUILT (July 3 late) — staged, awaiting M's deploy

Increments 1–3 of THE MAP are code, smoked, and zipped (`DEPLOY.md` has the
table). **SQL: none** — ink/paper ride the existing appearance column + RPC.

- **Increment 1 — the chronicle shelf over real data.** `ChronicleView.jsx`
  is now the shelf: `bookModel` chapters → volumes via a NEW pure core
  (`journal/src/shelf/shelfModel.js` — chronological L→R, NEW tag on the
  freshest, Prologue handling, single-open accordion as a smokable reducer,
  key boundaries). Reading layer only; `bookModel.js` untouched; seat paint
  through `accents.js`; entry provenance badges (from journal / shared later)
  and the image lightbox carried over. The volume INTRO is derived (first
  Narrator entry, clamped) — real rows have no intro field.
- **Increment 2 — ink + paper persistence.** `shelfTheme.js` (pure): six
  inks + six papers as KEYS, resolved to hexes at render (the seat-key
  philosophy). Adapter grew `loadMyAppearance` / `saveMyLook` (same
  full-merge → `set_my_appearance` idiom as `saveMyAccent`). Boot loads the
  look with everything else; App paints `--sh-*` inline on the scope BEFORE
  the surfaces render — no flash. Axis independence is STRUCTURAL
  (`inkVars` can't emit paper; `paperVars` can't emit ink/accent) and
  asserted twice: pure (per ink, per paper) and in the live jsdom DOM.
- **Increment 3 — the journal reskin.** Vault-mock skin over the REAL
  JournalView: rail brand, seat-dot vault switcher (dots NAVIGATE via
  `?character=` — vault scope is a boot decision; in-place swap is its own
  increment), open-comment badges on tree rows (boot-time snapshot via one
  cheap query), page eyebrow with Read-only pill, rail foot. TipTap,
  drag-reorder, ⋯ menu, comments rail, curation queue, outline, backlinks
  all slid under the new skin unchanged — CSS-first, exactly as planned.

**Deviations from the mocks, all deliberate (full list in DEPLOY.md):**
tokens are namespaced `--sh-*` scoped to `.sh-scope` (theme.css owns `--ink`
and the `--font-*` names — the mock's `:root` vars would have repainted the
nav); the ink/paper switcher lives in a slim top strip beside the
Journal/Chronicle tabs (the site nav owns the top-right corner); the old
book render's thread-chip dimming and TOC did not carry (not in the approved
mock — the shelf IS the TOC; dimming can return in the panel head if missed).

**Validation (all green at handover):** existing suites untouched and
passing — smoke-journal 81, smoke-org 14, smoke-comments 26, smoke-book 15,
smoke-alias 14. NEW: `smoke-shelf.mjs` 37 (pure cores + axis independence),
`smoke-skin.mjs` 25 (the REAL App mounted in jsdom, sample mode: paint
order, 6+6 dots, live-DOM axis independence, accordion single-open, Esc,
boundaries). Vite build clean. `journal-preview.html` regenerated for a
no-deploy visual check.

## Theme status — the shelf aesthetic is LIVE-BUILT for chronicle + journal

The July 3 evening approval stands and is now code.

**DECIDED (July 3 late, M): the site theme system stands down; looks take
over.** Direction locked in conversation, mock-first before any build:

- **Themes demote to PRESETS.** The `data-theme` system (◐ dropdown,
  localStorage `kirtas-theme`) retires; old themes go to the archives. A
  "theme" becomes a named ink+paper pairing chip in the picker (Dark
  Academia etc.) — tap sets both dots. Moods survive; parallel theme
  worlds in theme.css don't.
- **The palette expands, both polarities.** Dark papers (black paper /
  pink ink was M's example) are in. The `--sh-*` derivation is
  polarity-agnostic (color-mix percentages), but each paper needs a
  polarity flag: mottle/grain multiply blending dies on dark paper, and
  shadows need flipping. Axes stay fully free; a computed CONTRAST FLOOR
  dims illegible ink dots at render rather than curating pairs.
- **Per-page looks.** Appearance grows from one `{ink, paper}` to a
  default + per-page overrides (default cascades; override where you
  care). nav.js knows its page.
- **◐ absorbs the cog → one Settings flyout** with sections: Look (ink,
  paper, per-page scope, preset chips), seat accent, sheet settings.
  nav.js hosts, writes through `saveMyLook`, dispatches a `tok:look`
  event the journal app listens for (the `nav:ready` idiom). Signed-out
  fallback mirrors to localStorage (RPC needs auth).
- **Scope honesty (lesson 9 applies):** COLORS go site-wide by re-plumbing
  theme.css color tokens to the player's look — every page follows without
  redesign. The full shelf REGISTER (Anton/Archivo/Garamond, paper
  surfaces) stays page-by-page, each page's bones earning their own arc.
- The journal's top-strip ink/paper switcher is INTERIM — it retires into
  the Settings flyout when this lands.

Site-wide adoption of the full register beyond chronicle + journal remains
page-by-page — do not repaint other pages' bones on this authority. The two approved mocks
(`mock-chronicle-shelf-2.html`, `mock-journal-vault.html`) remain the north
star for any dispute between code and intent. The old "Phantom theme" note
stands: it was a test theme, never canon.

**Decisions locked with the mocks (all honored in the build):**
- **Ink + paper are PER-READER** — persisted as keys in
  `profiles.appearance` via `set_my_appearance` (replace-not-merge, full
  object) alongside the seat accent. Nobody's choice repaints anyone else.
- **Axes are independent and smoke-asserted** — now structurally, in
  `shelfTheme.js`, and verified in the rendered DOM.
- Chronicle shelf replaces the *reading* layer only; writing stays in
  chronicle.html until increment 3 (Quill retirement).

## Architecture spine (stable)

- **Stack:** vanilla JS/HTML/CSS + Supabase (Postgres/Realtime/RLS) + Netlify
  + GitHub. One walled corner: `journal/` (React + Vite + TipTap) → builds to
  `journal-assets/journal.js|css`, loaded by root `journal.html` with `?v=`
  cache-bust stamps.
- **Feed is one live stream** (`feed` table); the chronicle/book is a
  **reading layer** over it. The shelf is that layer's render —
  `bookModel.js` chapters map onto volumes, entries onto the panel.
- **Profiles:** `profiles.user_id` is the auth UID (not `profiles.id`).
  Appearance persists in `profiles.appearance` jsonb via `set_my_appearance`
  RPC (**replace-not-merge**). ⚠ Repo copy of that RPC filters
  `where id = auth.uid()` while the deployed one works — reconcile someday.
- **Party seats:** cosmere (ianakira) · liadan (nazanroseaktas) ·
  caim (jayvanmidde) · vesperian (thebraveruby) · DM/narrator (hagakuredisc).
- **Seat colors are never stored in content.** Content stores seat KEYS;
  paint resolves at render via `journal/src/comments/accents.js`. Same
  philosophy now covers the reading look: appearance stores ink/paper KEYS;
  `shelf/shelfTheme.js` resolves them at render.
- **Shelf tokens are namespaced `--sh-*` and scoped to `.sh-scope`** —
  theme.css tokens (`--ink`, `--font-*`) are a different world and are never
  written by the journal corner.

## Journal (the walled corner) — current state

- **Pages:** party-readable, author-only-edit (`journal_pages` RLS).
  `?character=<key>` renders any seat's vault read-only. Slug = the
  `[[wikilink]]` target and is **stable**: rename is title-only
  (`renamePage`); `savePage`'s title path re-slugs and must never be used for
  rename (smoke-pinned).
- **Skin:** the vault mock, live — persistent tree rail (brand, seat-dot
  vault switcher, sections + pages + comment badges + active accent bar,
  rail foot), paper page surface (poster title, eyebrow with Read-only pill,
  EB Garamond body). Drag-reorder + ⋯ menu survived the reskin in place.
- **Organization (deployed):** drag-reorder (`sort_order`, nulls-last),
  drop-on-section move, ⋯ menu rename/delete; foreign pages read-only with
  staff delete. Curation queue (staff): Canonize, Edit, Merge (rewrite
  preview + "also correct chat" checkbox), Discard.
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
  Tree badges show open counts (boot-time snapshot; no live refresh yet).
- **Editor config:** ONE `editorProps` key only (duplicate-key clobber
  lesson). **PageLinks:** `[[` pool takes the INJECTED active vault; chips
  navigate plain-click read-only, ⌘/Ctrl-click editing; dead links no-op.

## The book (journal's Chronicle tab) — current state

- `bookModel.js` (pure, UNTOUCHED by the build): feed rows → chapters,
  freshest-first, narrative order within. The shelf reverses to
  chronological L→R in `shelfModel.js`; the NEW tag rides the freshest
  volume — stack order is a non-issue, exactly as the accordion promised.
- **Naming:** seat map leads (character name displays, hover reveals player
  alias). TODO(multi-campaign): seat maps → profiles.
- **NOT YET:** medallion portraits (slot into spine feet + entry bylines),
  threads-as-replies, the composer, realtime refresh, comment-badge live
  refresh, in-place vault switching.

## chronicle.html (legacy, patched, awaiting retirement)

- July 3 patch set deployed ✓ (write-first `bumpSessionTo` with `.select()`
  row-count check, staff-only 20h prompt, session out of draft save/restore,
  clipboard-pipeline loads, chip guard). Writing continues here until
  increment 3 (the composer moves into the shelf panel).

## Pinned lessons (July 3, all sessions)

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
9. **Same skin, different bones.** The accordion that made the chronicle
   sing was wrong for the journal — a story rewards ceremony; a tool rewards
   zero clicks between thought and page. Reuse the material, not the
   mechanics, when the surface's JOB differs.
10. **Two-axis theming needs the independence invariant IN THE SMOKES:**
    ink swaps never write paper, paper swaps never write ink/accent. Now
    enforced structurally in `shelfTheme.js` AND asserted in the rendered
    DOM (`smoke-skin.mjs`).
11. **jsdom has no `matchMedia`** — guard
    `typeof matchMedia === 'function'` in inline page scripts that harnesses
    will load.
12. **(new) Node can't import `.jsx` — render smokes run against an esbuild
    bundle of the REAL sources** (`.smoke-entry.jsx` →
    `npx esbuild … --bundle --jsx=automatic → .smoke-app.mjs`, which is
    generated and never committed). One React instance must be shared:
    export React/act/createRoot from the same bundle as App.
13. **(new) A mock's `:root` variables are not deploy-ready.** theme.css
    already owned `--ink` and the `--font-*` names — landing the mock's
    tokens verbatim would have repainted the site nav. Namespace
    (`--sh-*`) and scope (`.sh-scope`) before any skin goes live.

## THE MAP — next session's moves, in order

1. **M deploys + eyeballs the shelf build** (zip staged; `DEPLOY.md` table;
   `journal-preview.html` for a no-deploy look). Anything off, the two
   approved mocks arbitrate.
2. **The Settings arc — mock first** (unified ◐ Settings flyout: expanded
   ink/paper palette with dark papers + polarity flag, contrast floor,
   per-page look control, preset chips incl. Dark Academia, seat accent +
   sheet settings folded in). Approve the mock, then build: nav.js rows →
   `saveMyLook` → `tok:look` event; retire `data-theme` + the interim
   journal strip switcher; archive old themes as presets. nav.js is shared
   chrome — full smoke treatment.
3. **Medallion portraits:** recon the portrait source (characters table /
   party wiring / Cloudinary URLs), pipe into spine feet + entry bylines +
   vault seat dots.
4. **Threads + composer INTO the panel** (increment 2 of the book plan,
   mock first): replies as first-class threads; the locked minimal composer
   (bold, italic, H2, quote, `@`, `[[`) at the foot of an open volume.
   Donor organs: `docToFeedBody` + the journal composer.
5. **Increment 3 — Quill retirement:** chronicle.html's drawer stands down;
   the shelf panel becomes the writing surface.
6. **Rail alias wiring** (small, standalone): `mention-composer.js`
   consults `entity_aliases`.
7. **Parked, unscheduled:** in-place vault switching (seat dots currently
   navigate); comment-badge live refresh; thread-chip dimming's return in
   the panel head if missed; Shared Quest Hub; per-page REGISTER adoption
   beyond chronicle + journal (page-by-page, each its own arc); reconcile
   committed
   `set_my_appearance`; folder rename/delete/reorder; book realtime
   refresh; orphan-comment "send to my journal"; real ink hexes eyedropped
   from kazukinoda.com if M wants fidelity (current six are C's picks in
   his register).

## Deploy ledger

**Daytime session (all verified live):** chronicle patch set ✓ → org arc ✓ →
comments arc ✓ → pagelink fix ✓ → book arc inc. 1 ✓ → alias wiring ✓ →
book fixes ✓ → book ordering ✓ → session-repair.sql ✓.

**Evening session (mocks):** approved `mock-chronicle-shelf-2.html` (21/21)
and `mock-journal-vault.html` (27/27); superseded drafts kept for lineage.

**Late session (THIS handover — staged, NOT yet deployed):** the shelf
build zip — chronicle shelf render + look persistence + journal reskin.
Smokes: 81+14+26+15+14 existing ✓, smoke-shelf 37 ✓, smoke-skin 25 ✓.
Build clean. SQL: none.
