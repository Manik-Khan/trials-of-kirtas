# DEPLOY — the Settings arc (July 3, built from the approved mock)

The ◐ Settings flyout, live: themes demote to presets, the ⚙ cog retires
into it, the palette expands both polarities with the 2.0 contrast floor,
per-page looks, and per-player saved presets. **SQL: none** — everything
rides `profiles.appearance` + `set_my_appearance` (the column is jsonb;
`pageLooks` and `lookPresets` are just new keys).

## Files (GitHub web upload, bare names)

| file | destination | what |
|---|---|---|
| `settings-flyout.js` | repo root | **NEW** — the unified ◐ flyout (look, floor, scope, presets, seat accent, the absorbed cog). nav.js injects it post-auth. |
| `nav.js` | repo root | theme dropdown + THEMES + ⚙ cog RETIRED; `data-theme` pinned to `phantom`; ◐ → `TokSettings.toggle`; injects settings-flyout.js; `__downloadCharacterJSON` exposed on window (the flyout calls it) |
| `battle.js` | repo root | mobile Battle section retargets `#tokset-extra` (dropdown gone); listens for `tok:settings-ready` |
| `journal.html` | repo root | fresh `?v=` stamp |
| `journal-assets/journal.js` | `journal-assets/` | built bundle (contains this arc AND the shelf-fixes arc) |
| `journal-assets/journal.css` | `journal-assets/` | built styles |
| `journal/src/shelf/shelfTheme.js` | same path | catalog → 10 inks / 10 papers (polarity flags), FLOOR 2.0, contrast + nudge + `resolveLookFor` (per-page, pure) |
| `journal/src/App.jsx` | same path | `tok:look` listener; polarity attr on the scope; the interim strip switcher stands down when site chrome exists (kept for standalone previews) |
| `journal/src/data/backend.js` | same path | boot resolves the journal page's effective look (default + override) for the flash-free first paint |
| `journal/src/styles.css` | same path | dark-polarity grain/mottle flip (`multiply` dies on dark paper → `screen`) |
| `journal/smoke-shelf.mjs` | same path | +11 assertions (catalog, floor, nudge, per-page resolution) |
| `journal/smoke-skin.mjs` | same path | +5 (polarity, `tok:look` repaint, switcher stand-down) |
| `smoke-settings-flyout.mjs` | repo root | **NEW** — the flyout under jsdom + the SYNC GUARD (rendered dots must match shelfTheme.js, in order). Successor to the cog smoke. |
| `mock-settings-flyout.html` | repo root | the approved mock (26/26), kept for lineage |

**DELETE from the repo:** `smoke-nav-cog-flyout.mjs` — retired with the cog
it smoked (deliberate, the smoke-world-marks precedent).

## The shape of the thing

- **profiles.appearance stays flat and grows:** `{ ink, paper, accent, …,
  pageLooks: {page:{ink,paper}}, lookPresets: [{name,ink,paper}] }`. All
  writes are the replace-not-merge idiom (read current → merge → write the
  WHOLE object) so the cog's backgrounds/effects keys survive untouched —
  smoke-asserted.
- **`tok:look`** is the contract: the flyout resolves the current page's
  effective look and dispatches on boot + every change; the journal's scope
  just paints what it's told. A localStorage mirror (`tok-look-cache`)
  paints before the profile round-trip and carries signed-out sessions.
- **The contrast floor is 2.0** (M), computed per pairing at render — Rose
  clears Bone at 2.01:1. A paper switch that strands the held ink nudges to
  the highest-contrast ink with a toast (my extension to the locked
  direction; delete `nearestLegibleInk` usage in the paper handler to
  revert to dim-only).
- **Themes are archives now:** Parchment / Elysian / Disco / Phantom /
  Phantom Night live as preset chips. `localStorage['kirtas-theme']` is
  ignored; the SITE rides Phantom as its pinned base until the site-wide
  color re-plumb arc maps the player's look onto theme.css tokens
  (theme.css's `[data-theme]` blocks stay in place as archives — untouched).
- **The cog's territory:** the flyout's Sheet section shows on pages that
  wired appearance (or on sheet-v2), hosts `#appearance-drawer`, and calls
  the SAME `AppearanceUI.mount()` — the appearance engine is untouched.

## Validation (all green at handover)

smoke-journal 81 · smoke-org 14 · smoke-comments 26 · smoke-book 15 ·
smoke-alias 14 · **smoke-shelf 62** (was 44) · **smoke-skin 36** (was 31) ·
**smoke-settings-flyout 28** (new). Mock 26/26. Vite build clean.
`journal-preview.html` regenerated. `node --check` on nav.js /
settings-flyout.js / battle.js / all touched modules.

## Eyeball list, in order

1. Any page: ◐ opens the flyout; no theme dropdown, no ⚙.
2. Pick a dark paper — the ink auto-nudges if stranded, the toast says so.
3. Save a look under a name; reload; it's still there (profile-persisted).
4. "Only on Journal" + a different ink → journal repaints, party doesn't.
5. journal.html: the top-strip switcher is GONE (the flyout owns it);
   `journal-preview.html` standalone still shows it.
6. sheet-v2: Download character + Sheet appearance both work from the
   flyout's Sheet section.
7. Mobile: the Battle section appears at the flyout's foot.
