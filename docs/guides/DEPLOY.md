# DEPLOY — flyout hardening (July 3, post-live-eyeball)

The live flyout rendered broken (borderless, inflated type) while the mock
rendered perfectly in the same browser. Root difference: the mock
precomputed its mixed colors into variables; the live sheet inlined
`color-mix()` inside `border:` shorthands — where an unsupported/fragile
expression kills the WHOLE declaration — and its class-only selectors sat
exposed to page-rule specificity. Both failure classes are now removed
outright rather than patched. **SQL: none.**

| file | destination | what |
|---|---|---|
| `settings-flyout.js` | repo root | CSS armored: every selector prefixed `#tok-settings` (no page sheet can outrank it); ZERO `color-mix` — hairline/faint/soft/wash tones mixed in JS as `rgba()`/`rgb()` literals; explicit base font (Archivo 14px/1.4) pinned on the flyout; micro sizes normalized to the mock's scale. Sheet section now ALWAYS present: real controls where a page wired appearance, an honest pointer to sheet-v2 elsewhere (they're sheet-page settings). Dark-polarity text-shadow inside the flyout. |
| `nav.js` | repo root | `settings-flyout.js` now injected with a `?v=` stamp (`SETTINGS_V = 2`) — bump the constant on every future flyout change; the first deploy was un-stamped and browsers held the stale file. **Hard-refresh once after this deploy.** |
| `journal/src/styles.css` | same path | dark-paper legibility lift: soft text-shadow on the scope (reset on ink-chips carrying paper-colored text) — M's drop-shadow call |
| `journal.html` | repo root | fresh `?v=` stamp |
| `journal-assets/journal.js` / `.css` | `journal-assets/` | rebuilt bundle |
| `smoke-settings-flyout.mjs` | `tests/smoke/` | +4 assertions: no color-mix in the sheet, every rule ID-armored, derived tones are rgba/rgb literals, the Sheet pointer on unwired pages |

Validation: all suites green — 81 · 14 · 26 · 15 · 14 · shelf 62 · skin 36 ·
**settings-flyout 32** (was 28). Build clean.

Eyeball after deploy (hard-refresh first): scope buttons and preset chips
small and BORDERED; flyout 400px; on journal.html the Sheet section reads
"Backdrops, geometry & effects are sheet-page settings…" linking to the
sheet; on sheet-v2 the real Download + appearance rows; dark looks get a
soft letter edge in the journal.
