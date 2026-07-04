# CONTEXT.md — Trials of Kirtas
*Updated 2026-07-03, end of the July 3 NIGHT session (shelf DEPLOYED and
its four post-eyeball bugs FIXED — staged; the SETTINGS ARC mocked (26/26),
approved, and BUILT — staged: the ◐ flyout, themes→presets, floor 2.0,
per-page looks, per-player saved presets). Upload this at the top of the
next session.*

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

## ⚠ TWO ZIPS STAGED, DEPLOY IN ORDER (July 3 night)

**Zip 1 — `tok-shelf-fixes.zip` (SQL first: `schema_delta_session_titles.sql`).**
M deployed the shelf and eyeballed it; four real bugs, all fixed:
1. **The left-edge amputation (both tabs).** `scrollIntoView` walks every
   clipping ancestor and `overflow:hidden` boxes scroll programmatically
   with no user way back — opening a rightward volume shoved `.sh-scope`
   left and it STAYED, across tab switches. Fix: `overflow: clip` (cannot
   scroll, ever) on scope + view; all shelf travel is a contained
   `scrollTo` on `.sh-shelf` only. scrollIntoView is banned from the file.
2. **Dead travel.** Vertical wheel now drives the shelf horizontally (an
   open panel that can still scroll keeps the wheel); ←/→ travel the
   CLOSED shelf (previously dead — the "stuck"); keystrokes in fields are
   never hijacked.
3. **Spine bleed.** Long vertical-rl titles wrapped into extra columns
   across neighbors. Clamped at 44 chars in the model (`vol.spine`; the
   panel keeps full `vol.name`) + hard `overflow:hidden` spine box.
4. **Session titles were unownable** — "the first `meta.sessionTitle` any
   feed row carried." NEW `session_titles` table is canon (read: party,
   write: `is_staff()`, validated twice on local PG 16); row meta stays the
   fallback. Staff ✎ beside the panel title: inline rename, Enter saves,
   blank reverts. Adapter upsert checks row count (lesson 1).
   chronicle.html's sidebar + the nightly export still read row meta — by
   design, both retire with Quill.

**Zip 2 — the SETTINGS ARC (SQL: none — jsonb keys only).** Mock approved
(26/26, floor moved to 2.0 at M's call — Rose clears Bone at 2.01:1), then
built:
- **`settings-flyout.js` (NEW root module):** the ONE ◐ flyout. Look
  (ink/paper dot rows), Presets (yours + house + the five archived themes),
  Seat accent, Sheet (the absorbed cog: Download rows on sheet-v2 +
  `#appearance-drawer` hosting the UNCHANGED `AppearanceUI.mount()`), and a
  `#tokset-extra` slot (battle.js's mobile section). Painted with the
  player's own look. Builds eagerly (closed), announces
  `tok:settings-ready`.
- **The catalog expands both polarities:** 10 inks / 10 papers (4 dark:
  Charcoal, Slate, Pine, Walnut — each with a polarity flag; grain/mottle
  flip multiply→screen on dark). **Contrast floor 2.0**, computed per
  pairing, never curated — illegible inks dim/strike/disable with the ratio
  in the tooltip. A paper switch that strands the held ink auto-nudges to
  the highest-contrast ink with a toast (C's extension; dim-only revert is
  one deletion).
- **Per-page looks:** `appearance.pageLooks[page]` overrides the default;
  scope buttons Everywhere / Only-on-\<page\>; override chips clear with ×.
- **Per-player presets (M's ask):** `appearance.lookPresets` — save current
  look as a named chip, delete with ×. House chips: Dark Academia leads.
  Archives: Parchment / Elysian / Disco / Phantom / Phantom Night.
- **Themes RETIRED:** nav.js's dropdown + THEMES + `kirtas-theme` gone;
  `data-theme` pinned to `phantom` (the site's fixed base until the
  site-wide color re-plumb arc); theme.css `[data-theme]` blocks stay as
  archives, untouched. The ⚙ cog retired; its CSS removed;
  `__downloadCharacterJSON` survives on window.
- **`tok:look` is the contract:** the flyout resolves the page's effective
  look, dispatches on boot + change; the journal scope paints what it's
  told and stands its interim strip switcher down when site chrome exists
  (kept in standalone previews). `localStorage['tok-look-cache']` mirrors
  for first paint + signed-out.
- **Persistence:** the flat `profiles.appearance` grows `pageLooks` +
  `lookPresets`; every write is read→merge→write-WHOLE-object so the cog's
  background/effects keys survive (smoke-asserted).
- **The SYNC GUARD:** settings-flyout.js (classic script) mirrors the
  shelfTheme.js catalog; `smoke-settings-flyout.mjs` drives the rendered
  dots against the real module, in order — drift fails before it ships.

**Validation (all green):** smoke-journal 81 · smoke-org 14 ·
smoke-comments 26 · smoke-book 15 · smoke-alias 14 · **smoke-shelf 62** ·
**smoke-skin 36** · **smoke-settings-flyout 28** (successor —
`smoke-nav-cog-flyout.mjs` DELETED with the cog, the smoke-world-marks
precedent). Vite build clean; SQL delta run twice on local PG 16;
`journal-preview.html` regenerated. Note: `journal/.smoke-entry.jsx` had
never reached the repo (GitHub's web picker drops dotfiles) — recreated in
zip 1; M has since committed it.

## The shelf — LIVE (deployed July 3 night; zip 1 patches it)

Increments 1–3 shipped and are live: the chronicle shelf over real data
(`shelfModel.js` pure core — chronological L→R, NEW tag, Prologue,
single-open accordion; `bookModel.js` untouched), ink + paper persistence
(`shelfTheme.js` keys → hexes at render; adapter `loadMyAppearance` /
`saveMyLook` full-merge; no-flash boot paint; axis independence structural
+ DOM-asserted), and the journal vault reskin (TipTap, drag-reorder, ⋯
menu, comments rail, curation queue, outline, backlinks all slid under
unchanged — CSS-first).

**Deliberate deviations that remain true:** tokens are `--sh-*` scoped to
`.sh-scope` (lesson 13); thread-chip dimming and the old TOC did not carry
(the shelf IS the TOC). The interim top-strip switcher is retired by zip 2
(stands down when site chrome exists; survives in standalone previews).

## Theme status — the settings direction is BUILT (staged in zip 2)

The July 3 late DIRECTION stands and is now code (see the arc block above).
Still true and load-bearing:

- **Scope honesty (lesson 9):** the full shelf REGISTER stays page-by-page.
  The SITE-WIDE COLOR RE-PLUMB (theme.css color tokens driven by the
  player's look, every page following without redesign) is its own arc —
  NOT in this build. Until it lands, the site rides Phantom pinned.
- The two approved mocks (`mock-chronicle-shelf-2.html`,
  `mock-journal-vault.html`) plus `mock-settings-flyout.html` (26/26)
  arbitrate any dispute between code and intent.
- **M, post-build:** the flyout's ORGANIZATION may change once it's felt in
  the hand ("beyond a simple mock up") — expect a re-org pass, don't
  resist it.
- Ink + paper remain PER-READER, persisted as keys; axes independent and
  smoke-asserted (structurally + live DOM + now the flyout smoke).

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
  RPC (**replace-not-merge** — read current, merge keys, write the WHOLE
  object). Flat shape, grown by the settings arc: `{ ink, paper, accent,
  …cog keys…, pageLooks: {page:{ink,paper}}, lookPresets: [{name,ink,
  paper}] }`. ⚠ Repo copy of that RPC filters `where id = auth.uid()` while
  the deployed one works — reconcile someday.
- **The ◐ Settings flyout (`settings-flyout.js`, root)** is the ONE writer
  of the look; it resolves per-page (`resolveLookFor`) and dispatches
  `tok:look` — consumers paint what they're told. Its ink/paper catalog is
  a MIRROR of `journal/src/shelf/shelfTheme.js`, guarded by
  `smoke-settings-flyout.mjs`: change BOTH or the smoke fails.
- **`session_titles` (zip 1)** is the canonical per-session title table
  (staff-write); `meta.sessionTitle` on feed rows is the fallback only.
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
13. **A mock's `:root` variables are not deploy-ready.** theme.css
    already owned `--ink` and the `--font-*` names — landing the mock's
    tokens verbatim would have repainted the site nav. Namespace
    (`--sh-*`) and scope (`.sh-scope`) before any skin goes live.
14. **(new) `overflow: hidden` is programmatically scrollable;
    `overflow: clip` is not.** And `scrollIntoView` walks EVERY clipping
    ancestor — it can strand an ancestor at a scrollLeft the user cannot
    undo. Inside a clipped app shell: clip the shell, and scroll only the
    intended container with a contained `scrollTo`.
15. **(new) GitHub's web upload picker drops hidden dotfiles.** A `.foo`
    file in a zip handover silently never lands — use "Create new file"
    or drag it explicitly, and verify it's in the tree.
16. **(new) React root-attaches `wheel` as passive** — `preventDefault`
    in an `onWheel` prop is ignored. Attach a native listener via ref +
    `addEventListener(…, { passive: false })`. (jsdom also lacks
    `Element.scrollTo/scrollBy` — guard and fall back to `scrollLeft`.)

## THE MAP — next session's moves, in order

1. **M deploys zip 1 (shelf fixes — SQL FIRST) then zip 2 (settings) and
   eyeballs both** (each zip carries its own `DEPLOY.md` with the eyeball
   list). Fix Session 1's title while there: open it, ✎, type the real
   name. Delete `smoke-nav-cog-flyout.mjs` from the repo (retired).
2. **The flyout re-org pass, if M wants it** — M flagged the settings
   menu's ORGANIZATION may change once felt in the hand. Small CSS/markup
   moves inside settings-flyout.js; the machinery stays.
3. **The site-wide color re-plumb (its own arc, mock-first thinking):**
   map the player's look onto theme.css color tokens so EVERY page follows
   the ink/paper choice without redesign. Needs a per-token mapping and a
   dark-page audit; until it lands the site rides Phantom pinned. This is
   the arc that makes "Only on <page>" meaningful beyond journal/chronicle.
4. **Medallion portraits:** recon the portrait source (characters table /
   party wiring / Cloudinary URLs), pipe into spine feet + entry bylines +
   vault seat dots.
5. **Threads + composer INTO the panel** (increment 2 of the book plan,
   mock first): replies as first-class threads; the locked minimal composer
   (bold, italic, H2, quote, `@`, `[[`) at the foot of an open volume.
   Donor organs: `docToFeedBody` + the journal composer.
6. **Increment 3 — Quill retirement:** chronicle.html's drawer stands down;
   the shelf panel becomes the writing surface. (Session titles then write
   canon directly; the meta fallback fades.)
7. **Rail alias wiring** (small, standalone): `mention-composer.js`
   consults `entity_aliases`.
8. **Parked, unscheduled:** in-place vault switching (seat dots currently
   navigate); comment-badge live refresh; thread-chip dimming's return in
   the panel head if missed; Shared Quest Hub; per-page REGISTER adoption
   beyond chronicle + journal (page-by-page, each its own arc); reconcile
   committed `set_my_appearance`; folder rename/delete/reorder; book
   realtime refresh; orphan-comment "send to my journal"; real ink hexes
   eyedropped from kazukinoda.com if M wants fidelity; live accent refresh
   in the journal (accent picks currently repaint on next load); floor
   hard-vs-soft revisit if 2.0 feels wrong in play.

## Deploy ledger

**Daytime session (all verified live):** chronicle patch set ✓ → org arc ✓ →
comments arc ✓ → pagelink fix ✓ → book arc inc. 1 ✓ → alias wiring ✓ →
book fixes ✓ → book ordering ✓ → session-repair.sql ✓.

**Evening session (mocks):** approved `mock-chronicle-shelf-2.html` (21/21)
and `mock-journal-vault.html` (27/27); superseded drafts kept for lineage.

**Late session:** the shelf build zip — DEPLOYED by M ✓ (incl. the
recreated `.smoke-entry.jsx`).

**Night session (THIS handover — staged, NOT yet deployed):**
- **Zip 1** `tok-shelf-fixes.zip` — the four post-eyeball fixes + the
  `session_titles` delta (SQL FIRST). Smokes at zip time: shelf 44, skin 31.
- **Zip 2** the settings arc — `settings-flyout.js`, nav/battle edits,
  catalog expansion, journal listener. Smokes at handover: 81+14+26+15+14
  existing ✓, shelf 62 ✓, skin 36 ✓, settings-flyout 28 ✓ (cog smoke
  deleted). Approved `mock-settings-flyout.html` 26/26. Build clean.
  SQL: none.
