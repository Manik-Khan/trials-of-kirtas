# 2026-07-12 · Forge combat wiring, icons search & concentration — fix plan

**Status: DIAGNOSED, awaiting M's review before build (Brainstorming.md step 8 / mock→approve→build). Nine review findings from the 2026-07-12 table test, traced to root causes against the live repo + shipped bites 1–6. Read top to bottom.**

---

## 0 · The one-line diagnosis for each finding

| # | Finding | Root cause | Fix arc |
|---|---|---|---|
| 1 | Attacks read "X: action used", nothing resolves | `canUse` rejection — action already spent this turn; feed fills with rejections because **nothing else ever resolves** (see #2) | A |
| 2 | Target spells don't cast | `spellTiles` emits `kind:"spell"` — the pipeline resolves only `attack/save/heal/buff/buffAlly/selfheal/surge`. Derived spells are unresolvable by construction | **A (the big one)** |
| 3 | Heal/ally highlights don't paint | Same root: `drawHi`/`validTargets` branch on pipeline kinds; `kind:"spell"` matches nothing → no pending paint, ever | A |
| 4 | Need more icons + search | spell-icons v1 shipped 106 glyphs, picker has no filter | B |
| 5 | Lazy spell text + feat info empty | The mock loads **zero** references to `soul-shards-data.js` → `window.SoulShardsData` undefined → drawer's loader silently falls to "unavailable". Feats: drawer reads `tile.desc`; live features may carry 5etools `entries` instead | C |
| 6 | Guidance/conc spells not tracked; want purple orb on sprite | **No general concentration system exists.** Only the Ready-hold machinery knows the word | D (design) |
| 7 | Warn before overwriting concentration | Same — needs the tracker from #6 first | D (design) |
| 8 | Spell duration timers / in-game clock | New subsystem (rounds = 6 s in combat; out-of-combat time is DM-advanced) | D (design) |
| 9 | Foe stats + actions in the HUD for the DM | The plumbing half-exists: `foeKitFromStatblock` already carries the full parsed 5etools action list onto the unit as `u.mActions`, with an in-repo TODO reading "full foe action HUD — only .atk drives play today" | E |

Finding #1 decomposed: the rejections themselves are `canUse` working correctly — the turn's action was genuinely spent (a board-click attack, or a universal action: **Dash/Dodge/etc. set `usedAction` locally, the known bite-2 session-mode gap**). What made it *feel* broken is that with #2, spells can never resolve, attack rolls weren't visibly landing in the feed, and every subsequent tap narrated a rejection. Fix A dissolves the cluster.

---

## A · Spell combat wiring (findings 1–3) — the critical arc

**Why it broke:** STARTER_KITS hand-tuned every spell's pipeline shape (`Healing Word → {kind:"heal", dmg:"1d4+3", rng:12}`, `Hex → {kind:"buff"}`, `Eldritch Blast → {kind:"attack", hit, dmg}`). The derivation layer replaced the hand-tuning with a flat `kind:"spell"` and left `dmg:null, rng:null` ("pipeline reads the statblock" — a comment describing a consumer that doesn't exist). Three sub-bugs ride along:

1. `attack-cantrip` rows (Fire Bolt, EB — from `buildSpellAttacks`) reach `attackTiles`, which computes to-hit from `ability + prof`; those rows carry `hitMod`/`dmgMod` directly. Wrong numbers.
2. `damage-only` rows (save cantrips — Toll the Dead, Sacred Flame) land in the actions tab as `kind:"damage"` — also unresolvable. They are **save** spells: need `kind:"save"` + `dc` + `saveAbility` + dmg.
3. Non-damaging spells (Healing Word, Cure Wounds, Bless, Hex, Guidance…) have no combat projection at all.

**The fix — a `SPELL_COMBAT` projection table in forge-kit-derive.js:**

- `spellTiles` maps each spell name → pipeline shape: `{kind, dmg (level-scaled where relevant), rng (squares), saveAbility, healAbilityMod}`. Known-spell coverage: the four PCs' full current lists first, then the common 5e set. DC/to-hit already derive from `structural.spellcasting`.
- `attackTiles` learns the `attack-cantrip`/`damage-only` row shapes: `hitMod`→`hit` directly, `dmgMod`+`dmgDice`, `critDice` carried for the crit path; `damage-only` rows re-kind to `save` with the DC parsed from the type label weapon-actions already writes (or better: taken from `structural.combat.spellSaveDC`).
- **Unmapped spells render greyed, not dead** (detail-on-demand rule): tile paints with a `greyReason: "Not yet castable in the Forge — rules text in the drawer"` so the drawer explains instead of a silent no-op. No spell ever *looks* clickable and does nothing.
- **Heal highlight goes green** (M's call): `drawHi` gains a third tint — allies-for-heal paint green; buffAlly keeps gold; attack/save keep red. One color constant + the existing `validTargets` split.
- Verify vs. the session pipeline: `netHeal`/`netSave`/`netBuff` already exist (Task 7b) — derived kinds flow into the same doors STARTER_KITS kinds did. No protocol change.

**Smokes:** per-PC known-answer projections (Healing Word → heal/1d4+3/12 sq; Toll the Dead → save/wis/DC13; EB → attack with hitMod-derived to-hit); greyed-fallback invariant (every spells-tab tile has a resolvable kind OR `greyed:true`); attack-cantrip hit math.

## B · Icon library growth + picker search (finding 4)

- spell-icons grows toward ~200 glyphs (fills the thinner categories: illusion, nature, necrotic; adds a **conditions** group for the concentration arc's future needs).
- icon-picker gains a search input pinned above the grid: filters both registries live by glyph name substring, category headers collapse when empty. `{search:true}` opt so the sheet editor host can opt out if space is tight.
- Existing no-collision smoke grows with the set; picker jsdom smoke gains a filter case.

## C · Drawer text population (finding 5)

- **One-line fix first:** add `<script src="../soul-shards-data.js?v=b4">` to the mock. The drawer's loader was written against the verified `loadSpellMeta(names,{detail:true})` shape and `window.SoulShardsData` export — both confirmed in-repo; only the tag is missing.
- **Feats:** generalize the drawer's entries renderer — `tile.desc` (string) OR `tile._src.entries` (5etools array) both render; `featTiles` starts carrying `_src` so the drawer can reach the feature's entries. Same `{@tag}` stripping already written.
- Browser-verify: a spell drawer shows real rules text on second open instantly (cache), a feat drawer shows the feature prose.

## D · Concentration + in-game clock (findings 6–8) — **design sketch, needs M's approval**

This is a new subsystem with protocol implications (concentration is table-visible state → must be a published fact, not a local flag). Proposed shape, not yet build-ready:

- **The tracker:** `u.concentrating = {spell, sinceRound, durationRounds|durationText}` — set when a `conc:true` tile resolves, cleared on: recast (with warning, #7), damage-save failure (CON save DC 10 or half damage — hooks the existing damage path), incapacitation, voluntary drop (drawer action), duration expiry.
- **The warning (#7):** casting a `conc:true` tile while `u.concentrating` → confirm overlay reusing the `promptGeneric` machinery: "This ends *Guidance*. Cast anyway?"
- **The orb (#6):** the sprite badge system (verdict badges) gains a persistent purple pulsing badge anchored by the head while concentrating. Session mode: rides the published fact so every device paints it.
- **The clock (#8):** combat rounds are 6 s — the replay log already counts rounds, so in-combat durations tick free. Out of combat: a DM-driven clock chip (advance 1 min / 10 min / 1 hr / long rest) living in the overseer panel; durations like Mage Armor (8 h) count down against it. The clock is a session-row fact.
- **Not designing yet:** which spells auto-attach effects on expiry, non-conc durations (Mage Armor is *not* concentration — the clock covers it, the orb doesn't).

A static mock of the orb + clock chip goes to M before any of D is built.

## E · Foe HUD for the DM (finding 9)

The adapter work is done — `MonsterActor.toCharacter` parses the 5etools statblock, `foeKitFromStatblock` carries `u.mActions` (full action list) and `.atk` (what the AI swings with) onto every foe, with the in-repo TODO naming this exact feature. What ships:

- `renderTop` for foes: AC / Spd / stats from the unit (already carried), plus the statblock's save/skill line in the tooltip.
- `renderShelf` for foes (overseer only): the ▶ Run button stays; **beside it, tiles from `u.mActions`** so the DM can hand-pick an action instead of letting the AI choose. Tiles resolve through the same selectAction/pending path — foe attacks already flow through `doAttack`/`netAttack`.
- Multiattack renders as its component attacks (the adapter already splits them); non-attack actions (breath weapons → save kind) map through the same SPELL_COMBAT-style projection as arc A.
- Claim-gated: only the overseer (or a player the DM handed the foe to) sees foe tiles.

## F · Build order (bites within the fix session)

1. **C1** — soul-shards-data script tag + feat entries in drawer (smallest, unblocks review of everything else's drawers).
2. **A** — SPELL_COMBAT projection + attack-cantrip/save re-kind + greyed fallback + green heal highlight. Smoked per-PC. *This is the riskiest piece and goes first among the big ones.*
3. **B** — picker search + glyph growth.
4. **E** — foe tiles + stats.
5. **D** — mock of orb + clock → M approves → tracker → warning → orb → clock, each smoked.

Universal-action fact publishing (the session-mode desync that helped trigger #1's confusion) stays the top protocol carry-forward — named here so nobody re-derives it, still its own bite.

## G · Validation

- All existing suites stay green (starter-kits 16 / replay 35 / protocol 56 / kit-derive 167 / feed-render 66 / spell-icons 43).
- New: SPELL_COMBAT known-answers ×4 PCs; greyed-invariant; attack-cantrip hit math; picker filter jsdom; foe mActions tile projection against a real statblock fixture (goblin + a multiattack block).
- Browser eyeball: Healing Word paints green allies and heals on tap; Toll the Dead paints red, rolls the save, damages; EB rolls with the right to-hit; an unmapped spell greys with a drawer explanation; feat drawer shows prose; picker search filters; a goblin's turn shows its statblock actions to the DM.

---

*Out of scope, carried by name: Supabase feed insert (top carry-forward since bite 2); appearance prefs (§6.5); manual resource adjust; gear-manager picker migration; universal-action fact publishing (protocol bite).*
