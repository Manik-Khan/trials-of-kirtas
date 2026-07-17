# 2026-07-12 · Forge BG3 HUD — design

**Status: design approved in session (M, 2026-07-12). Spec awaiting M's review gate — read this top to bottom before the build session starts. Approved mock: `forge-battlehud-extended-mock-v3.html` (round 3 of 3).**

Supersedes the "items 3+5 tracker roll-row port" framing: the brainstorm widened it, with M's approval, to the full combat HUD pass — and it absorbs **bite 2's sheet→actions derivation layer** (`FORGE_BOARD.md` §0's "bite 2 needs its own spec": this is that spec's UI half plus the derivation contract).

---

## 0 · What ships (one sentence each)

1. **The extended battle-HUD bar**, bottom-center of `forge/topography-test-mock.html`: battle.js's desktop-bar anatomy widened, its drawer unrolled into an inline icon-tile shelf filtered by category tabs.
2. **The Chat Feed as the combat log**, bottom-right: Supabase `feed` rows (rail idiom) carrying rich roll bodies — spelled dice, verdict badges, modifier tags.
3. **The derivation layer**: sheet-v2's sections (attacks, spells, items, feats, actions) projected from the `characters` row into the bar's tabs; `STARTER_KITS` demotes to fallback.
4. **Five universal actions** (Dash, Disengage, Dodge, Help, Ready) in the Actions tab; Grapple/Shove greyed + narrated (contested checks are their own bite).
5. **Retirement of `cbPanel` and `cbLog`** into the new surfaces, with every current affordance re-homed (inventory in §6).

Out of scope, named so nobody re-derives it: minimap; left-edge party HP frames (the strip carries HP); death saves; hidden foes (the `foeVisible` seam stands); contested checks; upcast slot picker (v1 casts at base level — party is L3–4, YAGNI); resource-persistence tightening (ki/slots stay client-local spend, today's behavior).

---

## 1 · Architecture (approved)

- **One truth, three consumers.** The `characters` row stays the single source: `structural` read, `vitals` via the existing copy-merge idiom. The forge HUD is a third projection of the sheet alongside sheet-v2 and party.html, served by the mock's already-authenticated client. No new state, no new tables.
- **battle.js is donor, not engine.** The bar reuses its anatomy/markup idioms (chip · AC/Spd/Init · res strip · category row) — but the forge does **not load battle.js**. Taps route through the forge pipeline (declare → publish → echo). The forge is authoritative for targeting, cover, verdicts, economy.
- **RS state is forge-local**: an `{advantage, disadvantage, bless, guidance}` object mirroring `getRS`'s shape, toggled from the Feed panel's mods row. Adv/dis merge into `advPreview`'s inputs at declare time; bless/guidance roll their d4 on the acting device and ride the fact as `payload.mods:[{k:'bless',v:3}]`. `validateEvent` requires only target+roll, and the reducer ignores unknown payload fields — **protocol impact: zero**, replay-deterministic (the d4 is a fact, never re-rolled).
- **The feed is display, the fact log is truth.** Feed rows are derived artifacts; replay never depends on them.

## 2 · The bar (approved, with M's two amendments)

**Top row** — absorbs battle.js's Info panel; "fundamentals in the HUD, no mid-turn sheet dive": character chip (portrait · name · HP) · AC / Spd / Init · economy pips (gold diamond action, teal triangle bonus) · class-resource pips (label + count derived from `res`) · move bar · condition chips · reaction indicator (ready/spent).

**Tabs are sources, corner marks are economy** (the teal bonus-corner means "bonus action" wherever the tile lives):

| Tab | Derives from | Publishes |
|---|---|---|
| ⚔ **Attacks** | sheet-v2 attack-editor entries (`structural` + overrides): to-hit, full damage stack | `attack_resolved`, unchanged |
| ✦ **Spells** | `structural.spellcasting` — known/prepared (not spellbook), cantrips first, grouped by level, slot pips per level, concentration badge (display only) | existing kinds; slot spend as `cost`, like ki |
| ◎ **Items** | gear-manager `inventory`, usable subset (type whitelist: potion/scroll/oil), count badges | `ability_used` + narration; potions ride `heal`. Consumption decrements via `CharacterData.save` **copy-merge**, controlling device only |
| ❖ **Feats** | origin-stamped `structural` features | nothing — read-only tiles opening a detail drawer (detail-on-demand). Toggleable passives: flagged later |
| ⚡ **Bonus** | *filter, not source* — every bonus-costed tile gathered from the other tabs | whatever the tile publishes |
| ◉ **Actions** *(renamed from Common, M's call)* | sheet-v2 **action-editor** custom rows + the universals | Dash = movement-budget fact; Disengage/Dodge = per-turn flags consumed by existing machinery (OA check, `advPreview`); Help = `grantAdvantage(ally,'help')` — §5.21's plumbing, one call, per M's own ruling; Ready = exists. Grapple/Shove greyed + narrated |

**Tiles**: icons-only by default (M's call — doubles shelf density for real spell lists). Per-player display pref "Icons / Icons + labels" and the **skin** (Battle dark / Forge parchment — M: "both, that's where we customize") ride `profiles.appearance` + page-local CSS vars. **Never touch `theme.css`.** Icon assignment is part of derivation: keyword map (name+kind → game-icons.net glyph, **CC-BY 3.0, attribution line in the repo**) → kind-generic fallback (sword/spark/flask/hand) → initial-letter tile. A custom action never renders blank. Tooltips (hover desktop / long-press touch) carry the full derivation: name, cost, to-hit, damage stack.

**Contextual strip** (thin, above the bar — re-homes `cbHint`): pending-action narration, target-range legend, **Contest cover** toggle when an attack is pending. **Turn gating unchanged**: non-controllers see the bar inert + narrated banner; on a foe turn the shelf region carries the overseer's ▶ Run-turn button. Overseer toolbar untouched (right-middle). Sight toggle re-homes to the orbit-btns cluster.

## 3 · The feed as the log (approved)

- **The acting device writes the feed row**, once, at fact-resolution time (same moment it publishes the resolved fact). Echo receivers never write. Fire-and-forget: on insert failure, narrate ("roll didn't reach the feed — it's still in the fight log") and continue; replay is unaffected.
- Row: `channel:'combat'`, `kind:'roll'`, actor from the unit's controller (foes post under the foe's name, staff-attributed, as combat.html monsters do), `encounter_id` + session from the forge session row → Chronicle bucketing works unchanged. Body HTML built by **one shared renderer** (also used for any local fallback paint).
- **Row anatomy** (M's refinement, this session): head line always visible — actor → target · action · **verdict badge** (HIT / MISS / ✶ CRIT / FAIL / SAVE) — and the d20 math line always visible (spelled dice, kept/dropped struck through, modifier tags: ⇑ adv·reason, ⇓ dis, cover *word*, 🙏 ✦, silvery-barbs). Multi-die damage stacks show the **total by default with press/tap to expand** every die (press, not hover-only — touch). Hover tooltips remain a desktop bonus.
- **Visibility: uniform, no AC ever.** Every device sees the same full math (M: Roll20/Foundry model). Saves show DC — the caster's own number. §5.19 stands.
- **Sandbox fights** (no `?session=`): feed writes gate on an active forge session; sandbox rolls stay local (approved).
- Feed panel (bottom-right): rail anatomy — Combat/Chronicle channels, **Adv/Dis/Bless/Guide mods row** (the roller panel's toggles, re-homed; the roller retires), rows with avatars, composer with dice button. Chat and rolls interleave in one stream; everything archives to the Chronicle for free.

## 4 · Error handling

No sheet → generic-kit fallback, narrated on the chip (Chonkalius rule: greyed, never dropped). Derivation failure on one section → that tab narrates and the rest render (never a blank bar). Feed insert failure → narrated, non-fatal. Icon miss → fallback chain (§2). RS toggles with no pending d20 context → inert-with-title, not hidden. Every disabled control states why.

## 5 · Validation (before handover, per house rules)

- `node --check` every script block; existing suite **stays 335 green untouched** — this pass adds no reducer/geometry changes beyond none.
- New known-answer smokes, real functions on real data: **derivation** (all four PCs' live-shaped `structural` → expected tabs/tiles/costs, incl. multiclass slots for Líadan and the no-sheet fallback); **feed-row builder** (facts → body HTML: verdicts, kept/dropped, mods, the SB row, no "AC" substring anywhere); **icon map** (hit, kind-fallback, letter-fallback); **RS merge** (bless d4 rides `payload.mods`, replay-deterministic).
- jsdom mount smoke: bar renders per tab, gating banner for non-controllers, contextual strip appears with a pending attack.
- Browser eyeball list for M at handover: both skins, both icon prefs, a real multi-strike attack's feed rows, the tap-expand on a 4d8, a session two-device round with chat interleaved.

## 6 · Build order (bites within the build session)

1. `forge/forge-kit-derive.js` — the derivation module, headless + smoked first (it's the riskiest and everything renders from it).
2. The bar UI on the mock (markup/CSS from v3), wired to derived tiles; `cbPanel` retires; contextual strip.
3. Feed panel + shared row renderer + acting-device insert; `cbLog` retires; roller toggles re-home.
4. Actions-tab rules: Dash / Disengage / Dodge / Help / Ready live; Grapple/Shove greyed.
5. Appearance prefs (skin, icon labels) via `profiles.appearance`.

Each bite lands with its smokes; single-device sandbox regression-gated at every step, as bite 1 was.

---

*Self-review done (no TBDs; renamed-tab consistency checked; §0's cuts match §2/§3; press-vs-hover made explicit; every §2 affordance from the retired panels has a named new home). M reviews this doc before any build code — Brainstorming.md step 8.*
