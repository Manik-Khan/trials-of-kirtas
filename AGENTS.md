# AGENTS.md — Trials of Kirtas

Custom D&D 5e virtual tabletop. Live: **trials-of-kirtas.netlify.app** ·
Repo: `Manik-Khan/trials-of-kirtas` (public).
Stack: vanilla JS/HTML/CSS + Supabase + Netlify + GitHub. Walled React/Vite/TipTap
corner at `journal/`. three.js battle mocks under `forge/`.

The maintainer is **M** (Manik). Codex assists; **M deploys by hand.**

---

## 🔴 HARD RULES — non-negotiable

1. **Never `git push`.** Pushing `main` deploys the live site via Netlify — that
   button is M's alone. Since 2026-07-10 M commits and pushes himself (web upload
   retired); Codex may `git commit` **only when M explicitly asks**, staging
   files by name (never sweep in `.Codex/` — it's gitignored; keep it so).
   Otherwise Codex's job still ends at validated files + a one-line deploy note.
2. **Read the actual repo source before editing any file.** A plausible hypothesis
   is not a diagnosis. Most wasted motion in this project's history came from
   theorizing instead of reading. Open the file; grep the callers; then edit.
3. **Validate before claiming anything works:**
   - `node --check` on **every** `.js`/`.mjs` file you touch or create.
   - Run the relevant **`forge/tests/`** smokes (and any other affected smoke) and
     paste the pass count. A headless test that passes while the browser stays
     broken is **not** proof — extract the real functions and run them on the real
     field (see the context docs).
   - Never say "done / fixed / passing" without the command output in hand.
4. **Never modify `theme.css` variables to fix a page-local issue.** Theme custom
   properties are global. A per-page problem gets a per-page fix (clear the override
   chip / scope the rule), never a change to the shared token.
5. **Surgical edits only.** Smallest diff that solves the problem. New/risky paths
   go behind a flag (e.g. `?engine=wa`) so the working path is untouched. Match the
   surrounding code's style, naming, and comment density. Don't refactor unbidden.
6. **Mock-first for anything visual or architectural.** Standalone, no-deps, renders
   on its own → M approves → then build. Never ship UX straight to a real page.

---

## Canonical docs — read before touching a subsystem

These are the source of truth. Do not summarize from memory; open them.

- **`CONTEXT.md`** — the whole project. Shipped work, the unresolved Bardic Radio
  sync problem, stable ToK systems, working rules. Start here.
- **`CONTEXT_Forge.md`** — the Battle Forge subsystem. **Read before touching the
  Forge.** §0 protocol, §2 file map, §3 port manifest (the actual to-do list with
  source line numbers), §4 settled geometry, §5 known bugs.
- **`docs/handoffs/forge/CONTEXT_Forge-update-2026-07-16c.md`** — the current
  concise Forge field authority and execution order.
- **`FORGE_GAME_MODE.md`** — the Forge multiplayer game-mode design (event protocol,
  client roles, build order). The forward plan.
- **`FORGE_PROTOCOL.md`** — the event protocol deep-design (schema, 17-kind event
  vocabulary, reaction pipeline, rewind/retcon/GOD MODE, test plan). Spec for build step 4.
- **`forge/README.md`** — the map subsystem's own README (pipeline, module globals).
- **`archive/context/sheet/CONTEXT-sheet-and-appearance.md`**,
  **`docs/guides/DEPLOY-*.md`**, **`docs/guides/TOOLTIP-GUIDE.md`** — narrower
  references.

When a claim contradicts one of these, the doc wins until argued otherwise.

---

## 🔴 Never claim something is missing without grepping for it

The single most expensive failure in this project's history. "X doesn't exist" is a
claim about the **repo**, not about your context window. Grep across the source and
all four Forge mocks **first**. M is entitled to ask "did you grep that?" and the
answer must already be yes. (See `CONTEXT_Forge.md` §0.)

Corollary: "present in the repo" ≠ "current." `main` has run behind M's working copy
before. If you're about to edit a file, having read the repo copy isn't enough —
work from the file M is actually looking at.

---

## Validation — how

`node` runs the test harness. All `forge/` runtime modules are dual-export
(browser `window.*` **and** Node `module.exports`), so the same code runs in both.

```
node --check <file>.js                         # syntax gate on everything you touch
node forge/tests/smoke-los-cover.js            # Forge known-answer smoke
node tests/smoke/smoke-sheet-mount.mjs         # root-application known-answer smoke
```

Forge smokes (all known-answer, extract the real functions): `smoke-forge-engine.js`,
`smoke-map-bridge.mjs`, `smoke-tactics-geometry.mjs`, `smoke-los-cover.js`,
`smoke-placement.js`, `smoke-flora.js`. `tests/smoke/` covers the sheet, gear,
shards, rail, appearance, Chronicle, and other root-application systems.

For `.jsx` (the `journal/` React app), **the Vite build IS the check** — run it in
`journal/`. `@babel/parser` also validates syntax.

> ⚠ `node` is not always on this shell's `PATH`. If `node`/`npm` are absent, **say
> so and stop** — do not declare work validated when you couldn't run the checks.
> Surface the gap; don't skip the rule.

---

## Deploy protocol

- Codex produces **bare-filename files** (or a folder-structured zip for nested
  paths) plus a **one-line deploy note** (which file → which destination, and any
  SQL). M uploads via GitHub web.
- **Cache-stamp every module include and bump on change** — `?v=<token>` (e.g.
  `?v=sf1`). Non-negotiable on iOS: a stale cache masquerades as a bug. Bump the
  stamp constant whenever the underlying file changes.
- SQL / schema changes are append-only files under the repo (see root `README.md`);
  never rewrite an applied migration.

---

## Layout & footguns

- **Flat root.** Most JS/CSS/HTML lives at the repo root and loads via plain
  `<script src>` / ESM imports. `netlify/functions/` holds serverless endpoints
  (`time.js` is the sync clock; `audio-proxy.js`, `members.js`, etc.).
- **`forge/`** — the battle-map subsystem + four three.js mocks + `forge/tests/`.
  `topography-test-mock.html` is on three r185 (ESM import map); the other three
  mocks stay on r128 (reference sources, not surfaces).
- **`journal/`** — walled Vite + React + TipTap app; built bundle lives in
  `journal-assets/`. Treat it as its own project with its own build.
- **`_edits/`** — scratch / historical mocks. Not the live surfaces.
- ⚠ **`weapon-actions.js`** (no space) is the real module, imported by
  `sheet-mount.js`. **`weapon-actions .js`** (with a space in the name) is a stray —
  don't edit it, don't reference it, don't assume it's live.
- ⚠ **`tactics-geometry.js` is inlined in TWO mocks** (`battle-tactics-geo-mock.html`
  and `topography-test-mock.html`) in addition to `forge/tactics-geometry.js`. Three
  copies, kept **code-identical** (comments stripped). Change one → change all three.
- ⚠ The word **"bridge"**: `map-bridge.js` bridges the generator to the **map
  document**, NOT to the combat system. "Port the battle mock" means the combat
  system in `CONTEXT_Forge.md` §3, not the map bridge.

---

## Working posture

- Failures must **narrate** — disabled/greyed UI reads as broken; say why.
- Don't add machinery ahead of data. When M says the simple version is enough,
  field-test the simple version first. **M's field reports are ground truth.**
- Characters with no combat sheet are **greyed out, never silently dropped**.
- `scrollIntoView` is banned in the Chronicle shelf (it scrolls the page, not the
  container) — move `.scrollLeft` / `.scrollTop` by computed offset instead.
- Personal/adjacent projects (sarod, AACM, Obsidian Codex, etc.) are **separate** —
  never pull them into ToK work.
