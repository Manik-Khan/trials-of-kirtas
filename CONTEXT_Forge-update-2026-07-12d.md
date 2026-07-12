# CONTEXT_Forge update · 2026-07-12d session (round-3 plan v2 shipped + M's table catches: Disciple, slots, upcasting, domain spells)

**Merge into CONTEXT_Forge.md. Supersedes the "next session — build order" framing in `CONTEXT_Forge-update-2026-07-12c.md`: every item in plan v2 §H (A+B+C · E · D step 1 · G · F) shipped this session in one pass (`forge-round3-fixes.zip`, uploaded). What remains is the browser eyeball (plan §I checklist) and the sequenced tail (D step 2 ruling → arc E foes → concentration arc).**

---

## What shipped (in-repo via forge-round3-fixes.zip)

| File | Change | Smokes |
|---|---|---|
| `forge/forge-kit-derive.js` | §A `spellGroupsFrom(structural)` normalizer (both shapes; `'cantrip(s)'→0`, `'N'/'levelN'→N`; `castingTime→time`, `concentration→conc`, range into `_src`); DC/attack chain now `spellcasting.saveDC → combat.spellSaveDC → guess` (Vesperian's EK DC 12 needs the middle rung); cast mod backs out of the stored attack bonus (−PB). §B: the SPELL_COMBAT **label lookup decides the kind** — `damage-only` re-kind reverted; heals project to `heal`, buff-riders (`Hex (damage)`) and unknowns grey with reasons; `utility`/`damage` sheet rows greyed drawer notes; attack-cantrips always trust the sheet's attack roll. §C `dedupeTabs`: normalized-label dedupe, derived tile wins (classFeature 4 · spell tile 3 · assembled 2 · sheet 1; greyed never wins), loser folds into `_folded`, missing dmg adopted from the folded row (Second Wind 1d10+3). Greyed tiles excluded from flatActions (attacks+spells too — they weren't). Hellish Rebuke added to REACTION_SPELLS; reaction-by-name when a row has no casting time (Caim's shape). §G: 5etools type codes mapped (`P/SC/WD/RD`, pipe-suffix stripped). hp fallback reads `combat.hpMax` (live key; `maxHp` was fixture-only). Exports: `spellGroupsFrom`, `wrapStarterKit`. | 341 green |
| `weapon-actions.js` | `knownSpellList` legacy branch accepts bare `'1'/'2'` keys (`/^(?:level)?(\d)$/i`) — the **second Fact-1 consumer**, found by code read: three of four PCs' spells never reached `buildSpellAttacks` | covered in 323 |
| `forge/topography-test-mock.html` | §E1 `startCombat()` → `loadLiveStats().then(startCombatNow)`; roster placement via `kitFor` (hp/maxHp aware); `kitFor` starter branch returns `ForgeKitDerive.wrapStarterKit(...)` — tabs always exist. §E2 `tileFlat(...,noDepth)`: every drawHi target tint paints `depthTest:false` renderOrder 4 (movement cyan stays depth-tested — terrain tiles must vanish behind hills). §E3 **hover tile**: rAF-throttled pointermove raycast, one glowing cell (soft green; unit under cursor + pending action → green/red by side+reach validity, downed allies count for heals); clears on drag/leave/combat-end. §D step 1: `explainBlock` → the feed — *"No line of sight — pine at (14,9), 20 ft (5 terrain + 15 occluder), 7/8 corners blocked"* — named from `F.props` at the blocking cell, once per attacker/target/geometry (`__losExplained`, reset per fight); the 8-line console breakdown stays. §F heal-the-downed: `alliesForHeal` (no alive filter), `downedUnitAt`, `validTargets` heal branch; combatClick admits the `_ves` corpse sprite (`spriteUnitAny`) AND a sprite-less downed unit's bare cell while a heal is pending; local `doHeal` revives (hp floored at 0 first, token force-rebuilt, "back on their feet"); session hp-echo revive widened to force-rebuild so a corpse-pose sprite stands back up | starter-kits 20 · module `node --check` |
| `forge/tests/smoke-kit-derive.js` | +84: **the four live JSONs are first-class fixtures loaded from disk** (top-level `combat` block maps to vitals); per-PC known answers (below); greyed-or-resolvable invariant asserted on live kits AND live flatActions; dedupe counts (one Sling/Dagger/Longsword/Second Wind/EB); itemTiles code-path + live-empty pins; `spellGroupsFrom`/`wrapStarterKit` export checks; `assembleActions` drives the live kits via dynamic `import()`; Disciple of Life, legacy-ledger slots, upcastDmg known answers | 341 |
| `forge/tests/smoke-starter-kits.js` | +4: kitFor wrap scenario (real ForgeKitDerive injected → `fallback:"starter"`, tabs present, raw kit never mutated); no-derive fallback re-pinned | 20 |
| `forge/tests/smoke-spell-icons.js` / `smoke-feed-render.js` / `smoke-kit-derive.js` | **baseline repair** — the in-repo copies required `./module.js` from `forge/tests/` (a zip-layout artifact); paths fixed to `../` / `../../`. These three suites could not run from the repo as uploaded | — |

All suites green at handover: kit-derive **341** · spell-icons 43 · feed-render 66 · starter-kits **20** · protocol 56 · replay 35 · silvery-barbs 13. (`smoke-glow-color.mjs` reads an uncommitted `topo-work.html` scratch file and errors in-repo — pre-existing, untouched.)

## Plan-doc corrections (the fixture-shape rule, applied to the plan itself)

Plan v2 §A/§I carried two known answers the live JSONs contradict: **Líadan's DC is 12, not 13** (`combat.spellSaveDC:12`; CHA +2, PB +2) and the raw Healing Word mod is +2, not +3 (cast mod = spellAttackBonus 4 − PB 2; her CHA and WIS mods are both +2, so the casting-class choice doesn't move it). The smokes pin the JSON-derived values. Cosmere 13/+5 and Caim's CHA-based 11 were right.

**M's table catch, same session: Disciple of Life was missing from the derived heals.** It's on her live features (Life Domain), the hand-tuned STARTER_KITS entry already modeled it (`dmg:"1d4+2", disciple:3`), and `doHeal`/`netHeal` already roll `+(a.disciple||0)` — the derived tiles had dropped it. Fixed in `spellTiles`: heal tiles of 1st+ carry `disciple: 2+spellLevel` when the feature is present, `flatTile` passes it through. Healing Word now heals **1d4+2 +3**, Cure Wounds **1d8+2 +3** — smoked (327 green). Base-level casts only: **upcasting isn't modeled anywhere in the Forge** (tiles always cost their base-level slot, no upcast picker; Disciple would scale to +4 on a 2nd-level cast) — named as carry-forward, not half-fixed. The HUD tile shows the dice; the +3 rides separately like the starter kit did — surfacing "+3 Disciple of Life" in the tile/drawer is a small follow-up if M wants it visible.

## One in-code ruling for M to ratify or flip

**Derived representation wins the dedupe everywhere** — including two cases the plan didn't name: the sheet's Eldritch Blast row folds into the derived EB *spell tile* (one EB, spells tab, attack +5), and the greyed "Weapon cantrip — use from the Attacks tab" pointer tiles (BB/GFB) fold into the real attacks-tab rows, so the Spells tab no longer lists them at all. Consistent, duplicate-free, and the folded sources ride in `_folded` for the drawer — but if M wants the greyed pointers back as spell-list documentation, it's one rule flip in `_dedupeScore` (let greyed spells-tab tiles opt out of losing). Table-read it.

## §G items — diagnosis closed

The empty Items tab was **correct behavior**: nobody carries a potion/scroll/oil. The real latent bug: live inventories use 5etools type *codes* (`M/R/G/LA/P/SC…`), which the word-keyed whitelist would never match — the first looted potion (type `"P"`) would have stayed invisible. Codes now map; the live-empty state is pinned by smoke so a loot drop is the only thing that changes it.

## §F heal-the-downed — status

The **fact layer already worked**: `forge-replay.js` un-downs on any heal that lifts hp above 0, and the existing replay smoke pins exactly M's ruling (up at healed HP, downed cleared). This session added the UI that made it reachable: downed allies join the heal target pool and glow green, their cell or corpse sprite takes the click, and both the sandbox and the session echo stand the token back up (the `_ves` corpse-pose case included — the old revive branch required the sprite to be *gone*).

## Second wave, same session (M's catches while reviewing the Healing Word math)

**The slots discovery (table-blocking):** `kit.res` was `{}` for every live PC — slots live in the legacy `structural.classFeatures` ledger (`spellSlots {"1":{max:4},"2":{max:2}}`, named resources like `bardicInspiration {max:2}` + `bardicInspirationDie`), which `buildResPools` never read. Every spell tile derived this morning was uncastable ("no slot1"). Fixed: `buildResPools` falls back to the ledger when the forged shapes are absent — slot pools spend on the same `pipState.spell_N` keys the sheet's orbs use, pact + named resources ride too. Smoked on Líadan (slot1=4, slot2=2, BI d6 badge, pipState spend).

**Upcasting (M's ask), shipped v1:** derive half — `upcastDmg(dmg, per, steps)` (same-die folds into the leading term, mismatched die appends; smoked with known answers) + `per` scaling on the plain "+dice per slot level" spells in SPELL_COMBAT (heals, fireball-family, guiding bolt…); tiles/flat carry `upPer` + `level`. Mock half — tapping a leveled scaling spell with more than one castable slot level opens a slot chooser strip ("Cast Healing Word at: 1st ·4 2nd ·2 ✕"); the pick builds an **effective action** (cost `slot<L>`, dmg upcast, Disciple rebased to 2+L, label "(2nd)") that flows through the untouched pending/spend/publish doors — the fact's ability label carries the level to every device. When the base slot is dry but a higher one isn't, the cast auto-promotes with a feed note (RAW). Rays/darts/extra-targets don't upcast v1 (no `per`). READYING skips the chooser (auto-lowest). Chooser tears down on finishAction/fight reset/re-tap.

**Domain spells in Soul Shards (M: "I can fix that if her domain spells are in the shard forge"):** they're in now. `soul-shards-data` carries `subclass.additionalSpells` through `normalizeClass`; the Spells step expands `prepared` **gated by CLASS level** (the cleric level in a multiclass), renders a teal "Granted by Life Domain — always prepared" section, greys the granted names in pick pools ("domain — always prepared" tag), and emits them `origin:'subclass'` with **that class's ability** — so Cure Wounds attributes to the cleric/WIS side of the build, exactly the multiclass-ability question M raised. Free — never counts against picks; a hand-pick collision folds under the subclass attribution (mirrors the racial rule). Verified headlessly against the live 5etools Cleric data: cleric 1 → Bless + Cure Wounds; 3 → +Lesser Restoration/Spiritual Weapon. Warlock patron `expanded` lists are deliberately untouched (list expansions, not grants). **M re-forges Líadan when ready** — her current sheet's Bless/Cure Wounds are hand-entered and untagged.

**The WIS 13-vs-14 question:** the committed `data/characters/liadan.json` says **WIS 14 → +2** (internally consistent; `saves.wis.bonus:2` agrees). If M's live Supabase row says 13, the repo copy is stale — the smokes pin the repo fixtures, and the fixture-shape rule then applies to the repo copy itself: re-export or re-forge, and the known answers shift with it. Her CHA is also +2, so the per-class casting ability doesn't change the heal mod either way *today*.

## Next session — build order

1. **Browser eyeball, plan §I + second wave:** upcast chooser on Healing Word (1st/2nd), Disciple riding the roll, domain grant section in the Spells step, re-forge Líadan.
   Original §I list:  Healing Word paints allies green over the ink; hover glow tracks the cursor and flips red on invalid targets; local sandbox bar populated pre-session; a blocked shortbow shot names its blocker in the feed; heal a downed ally end-to-end (both local and session).
2. **§D step 2:** M table-reads one real refusal line → rules on tree occlusion (trees cap at three-quarters / lower pine occ / as-is) → geometry smoke pins the ruling.
3. **Arc E foes** (promotable on M's word) → **concentration arc** (mock-gated), per the standing order.
4. Ratify or flip the dedupe ruling above.

## Known gaps / carry-forward (unchanged)

Supabase feed insert (top since bite 2) · upcasting v2 (rays/darts/targets/Aid; Ready-at-level) · universal-action fact publishing (protocol bite) · appearance prefs §6.5 · manual resource adjust · gear-manager picker migration · Resources tab read-only v1 · spell-icons glyphs pending M's curation pass · picker search + glyph growth · `smoke-glow-color.mjs`'s missing `topo-work.html`.

## Working-rules confirmations

- **The fixture-shape rule cuts both ways:** it caught the plan doc's own known answers (DC 13 → 12). Numbers in a plan are hypotheses until diffed against the JSONs.
- **Fact 1 had a second consumer** (`knownSpellList`) that only a read of the actual source found — the headless repro scoped the bug to `spellTiles`, the code read found the sibling.
- **Repo-as-uploaded must run its own smokes:** three suites had broken require paths from the zip layout and had never been executed in place. Baseline before surgery, always.
