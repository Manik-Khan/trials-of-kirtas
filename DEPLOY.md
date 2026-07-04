# DEPLOY — the shelf build (chronicle shelf · look persistence · journal reskin)

**SQL: none.** Ink + paper ride the existing `profiles.appearance` jsonb and
the deployed `set_my_appearance` RPC — nothing to run.

Preview first if you like: open `journal-preview.html` (standalone, sample
data, nothing persists) straight from disk.

## Files → destinations (zip mirrors the repo layout)

| File in zip | Repo destination | What it is |
|---|---|---|
| `journal.html` | `/journal.html` | new shell: shelf fonts + fresh `?v=` stamps |
| `journal-assets/journal.js` | `/journal-assets/journal.js` | built bundle |
| `journal-assets/journal.css` | `/journal-assets/journal.css` | built styles |
| `journal/index.html` | `/journal/index.html` | Vite entry (fonts added) |
| `journal/src/App.jsx` | same path | sh-scope host, look state, strip + switcher |
| `journal/src/ChronicleView.jsx` | same path | the shelf render |
| `journal/src/JournalView.jsx` | same path | vault switcher, badges, eyebrow, rail foot |
| `journal/src/styles.css` | same path | the shelf-register stylesheet |
| `journal/src/data/backend.js` | same path | boots myLook + commentCounts + viewSeatKey |
| `journal/src/data/supabase-adapter.js` | same path | `loadMyAppearance` / `saveMyLook` / `loadOpenCommentCounts` |
| `journal/src/shelf/shelfTheme.js` | same path (new dir) | inks/papers, axis-independent vars |
| `journal/src/shelf/shelfModel.js` | same path | chapters→volumes, accordion reducer |
| `journal/smoke-shelf.mjs` | same path | pure-core smoke (37) |
| `journal/smoke-skin.mjs` | same path | jsdom render smoke (25) |
| `journal/.smoke-entry.jsx` | same path | esbuild entry the render smoke bundles from |

Deploy order doesn't matter beyond the usual: the three root files
(`journal.html` + both `journal-assets/*`) should land in the same push so
the stamps match the bundle.

## Validation run (all green before this handover)

- `smoke-journal` 81/81 · `smoke-org` 14/14 · `smoke-comments` 26/26 ·
  `smoke-book` 15/15 · `smoke-alias` 14/14 (untouched suites still pass)
- `smoke-shelf` 37/37 (volume order, NEW tag, Prologue, accordion reducer,
  key boundaries, axis independence per ink and per paper)
- `smoke-skin` 25/25 (real App mounted in jsdom, sample mode: scope paints
  before surfaces, 6+6 dots, ink swap never writes `--sh-paper` in the live
  DOM and vice versa, vault rail renders, accordion single-open, Esc,
  boundary buttons)
- `vite build` clean; `node --check` on all plain-JS modules.

To re-run the render smoke after future edits:
`npx esbuild .smoke-entry.jsx --bundle --format=esm --platform=browser --jsx=automatic --outfile=.smoke-app.mjs` then `node smoke-skin.mjs`.
(`.smoke-app.mjs` is generated — don't commit it.)

## Judgment calls to know about (all reversible)

1. **Tokens are namespaced `--sh-*`, scoped to `.sh-scope`.** theme.css owns
   `--ink` (the dark site background) and the `--font-*` names — putting the
   mock's `:root` vars live would have repainted the nav. Never touched.
2. **The ink/paper switcher lives in a slim top strip** beside the
   Journal/Chronicle tabs, not fixed in the top-right corner — the site nav
   owns that corner on the deployed page.
3. **Seat dots navigate** (`journal.html?character=…`; your own dot goes to
   the bare URL). Vault scope is a boot-time decision in the adapter —
   in-place vault swapping is its own increment if wanted.
4. **The volume intro line is derived**: the first Narrator entry of the
   session, clamped (~200 chars), else the first entry. Real rows carry no
   intro field; this reads as the DM's scene-set.
5. **Thread-chip dimming from the old book render did not carry over** —
   it isn't in the approved mock. Easy to return inside the panel head if
   missed. The TOC is gone too: the shelf IS the TOC.
6. **Comment badges are a boot-time snapshot** (one cheap query); they don't
   live-refresh yet.
7. The narrator's golden-box treatment is retired: on the shelf the
   Narrator is a seat like the others (per the mock), painted through
   `accents.js` as always.
