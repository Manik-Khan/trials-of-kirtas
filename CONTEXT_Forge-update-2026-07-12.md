# CONTEXT_Forge update · 2026-07-12 session (Bite 2 build + review round 1)

**Merge this into CONTEXT_Forge.md. It supersedes any "bite 2 pending" framing — bite 2's core shipped this session and survived one visual review round with two fixes.**

---

## What shipped (all in-repo pending M's upload)

| File | State | Smokes |
|---|---|---|
| `forge/forge-kit-derive.js` | NEW — the derivation module (spec §6.1) | 110 green |
| `forge/forge-feed-render.js` | NEW — shared feed-row body renderer (spec §3/§6.3) | 66 green |
| `forge/forge-hud.js` | NEW — self-contained BG3 bar + feed panel renderer | jsdom-free; browser-verified by M |
| `forge/topography-test-mock.html` | EDITED — 7 surgical edits, flag-guarded | existing suites untouched: starter-kits 16, replay 35, protocol 56 |
| `forge/tests/smoke-kit-derive.js` | NEW | — |
| `forge/tests/smoke-feed-render.js` | NEW | — |

**Screenshot-verified working at the table** (M, 2026-07-12 ~1am): bar renders bottom-center with chip · AC/Spd/Init · economy pips · Fighter Slots/Second Wind/Action Surge pips · move bar; tabs row with End Turn; Game Feed bottom-right carrying rolls, initiative, narration.

## The three new modules, one line each

- **forge-kit-derive.js** — `ForgeKitDerive.derive(charData, {assembledActions, starterKits})` projects a `characters` row into a ForgeKit: same shape `buildUnit`/`canUse`/`reactReady` consume, extended with `tabs` (attacks/spells/items/feats/actions/bonus), `pools` (resource display), `react` (Shield/SB/Hellish Rebuke detection from spell `time` fields + race), `spellcasting` info. UMD, pure, no DOM.
- **forge-feed-render.js** — `ForgeFeedRender.rollBody(fact, ctx)` / `abilityBody` → row HTML per spec §3 anatomy: head line (actor → target · action · verdict badge), d20 math (kept/dropped struck-through, mod tags: ⇑adv·reason ⇓dis cover-word 🙏bless ✦guidance silvery-barbs), damage total with expandable per-die detail, saves show DC, **no "AC" substring ever** (`assertNoAC` enforced across the suite). Owns its CSS.
- **forge-hud.js** — injects its own CSS/HTML on first call; `window.renderForgeBar(state)` paints from a snapshot; interactions dispatch `forge:*` CustomEvents (`selectAction`, `endTurn`, `runFoe`, `universalAction`, `toggleSight`, `toggleContest`, `tabChange`); `window.addForgeRow(html)` receives feed rows.

## The 7 mock edits (all preserve `/*SK-START*/`…`/*SK-END*/` markers — the smoke harness regex needs them verbatim)

1. Three `<script src>` tags after forge-board.js (`forge-kit-derive.js?v=b2`, `forge-feed-render.js?v=b2`, `forge-hud.js?v=b2`).
2. `import { assembleActions } from '../weapon-actions.js';` in the module block.
3. SK block replaced: `loadLiveStats()` now loads party → runs `assembleActions(inventory, structural)` per PC → `ForgeKitDerive.derive()` → caches. `kitFor(key)` priority: derived kit → `STARTER_KITS` → `GENERIC_PC_KIT`. `liveStatsFor` returns null for derived keys (stats already live in the kit). **`USE_FORGE_BAR = true` flag** — false restores cbPanel/cbLog instantly.
4. `renderHud()` tail: hides cbPanel/cbLog and calls `renderForgeBar(state-snapshot)` when flagged on.
5. `forge:*` event bridges near the window exports (selectAction, endTurn→cbEnd.click(), runFoe, sight/contest toggles, universalAction handler for Dash/Disengage/Dodge/Help local flags; Ready delegates to cbReady).
6. `clog()` also mirrors into the feed via `addForgeRow` (try/catch, non-fatal).
7. Inline SVG sprite block before `#combatHud` — **scheduled for deletion next session** (see decisions).

## Review round 1 — two findings, both fixed

- **Icons rendered giant** — generated `<svg>` lacked `viewBox`; paths painted at natural size. Fix: `viewBox="0 0 24 24"` on every tile SVG. *Lesson: an SVG `<use>` without a viewBox on the host element has no coordinate mapping — always set it.*
- **Second Wind / Action Surge missing as actions** — derive produced them as resource *pips* only. Fix: `CLASS_FEATURE_ACTIONS` table in forge-kit-derive.js detects actionable features from `structural.features` by name-match and projects tiles: Second Wind (bonus, cost `secondWind:1`), Action Surge (**free**, cost `actionSurge:1`), Flurry of Blows / Patient Defense / Step of the Wind (bonus, `ki:1`), Hands of Healing (action, `ki:1`), Hexblade's Curse (bonus).

## Decisions ratified this session (M's calls)

1. **Bonus tab widens to bonus + free** — "everything that doesn't eat your action." Fixes Action Surge's absence from the Bonus tab (it's RAW-free, and the tab was a strict `bonus:true` filter). **One-line filter change, not yet implemented** — first thing next session.
2. **Icon system replaced, not extended.** The hand-drawn sprite symbols were placeholder-quality duplicates of `item-icons.js` (`window.ItemIcons`: 257 curated game-icons.net glyphs, 512 viewBox, `currentColor`, `iconFor(item)` already honoring `item.icon`, `iconSvg(id,size)`, `CATEGORIES` powering gear-manager's existing picker). Next arc adopts ItemIcons + a new sibling `spell-icons.js`. The inline sprite block in the mock gets deleted.
3. **Icon storage contract:** owned rows (inventory items, custom action-editor rows) carry `icon` inline — items already do; derived rows (spells, class features, regenerated on level-up by Soul Shards) use a `structural.iconOverrides` map keyed by stable tile id, surviving re-derivation. Resolution order everywhere: inline `icon` → `iconOverrides[tileId]` → keyword seed → category default → letter tile. Writes ride `CharacterData.save` copy-merge, controlling device only.
4. **Picker in both places, storage in one.** Shared `icon-picker.js` widget (ported from gear-manager's proven pattern) hosted in the sheet action editor (deliberate curation) and the forge detail drawer (mid-fight fixes). Same field, same save path — cannot diverge. Gear-manager keeps its inline picker for now.
5. **Resources get a real surface.** Full param passthrough (`recharge`, `die`, `tag`, `origin`, `source`, `custom` — resource-derive.js already emits all of it; the derive module currently drops most). Top row: economy + move always, ≤3 prioritized pip groups, `+N` overflow chip. New **⬡ Resources tab**: scrollable cards (label, pips, die badge, origin tone, recharge), tap-to-expand detail. Visibility surface, not a spend surface (spend stays on action costs).
6. **Detail drawer** (long-press / right-click any tile): name, cost line, full description, Change-icon, Hide. Spell text lazy-loaded — **verify `loadSpellMeta` shape in soul-shards-data.js against the repo before building** (house rule).

## Known gaps / not yet built (carry-forward)

- **Supabase feed insert** (spec §3: acting device writes the `feed` row at fact-resolution; Chronicle bucketing) — the feed panel is currently a local `clog` mirror only. Original spec §6.3's second half.
- Universal actions are **local-only** (narration + flags); no published facts in session mode. Multi-device rooms will desync on Dash/Dodge/etc. — needs its own protocol-reviewed bite.
- Ready via the bar delegates to cbReady (still disabled in sessions, pre-existing).
- Appearance prefs (Battle-dark / Forge-parchment skin toggle, icons-vs-icons+labels) — spec §6.5, unbuilt. Parchment skin CSS exists in forge-hud.js behind `body.fg-parch`, untested.
- Damage-stack tap-expand: CSS (`.ffr-dmg-wrap.expanded`) exists; the tap handler wiring in the feed panel needs verification.
- Grapple/Shove greyed (contested checks are their own future bite). cbPanel/cbLog hidden, not removed.

## Working-rules confirmations from this session

- The starter-kits smoke extracts by literal `/*SK-START*/` — decorating the marker comment broke extraction once; keep markers bare and put prose on the next line.
- `node --check` chokes on `...` inside block comments in some phrasings — write "SK-START to SK-END" not "/*SK-START*/ ... /*SK-END*/" in comments.
- Module-block syntax validated by extracting to a `.mjs` and `node --check`-ing it; repo suites run against the edited mock in a mirrored dir layout (`forge/` + `forge/tests/`).
