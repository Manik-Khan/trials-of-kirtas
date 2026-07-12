# CONTEXT_Forge update · 2026-07-12d session (round-3 fix plan v2 — ALL bites shipped)

**Merge into CONTEXT_Forge.md. Supersedes the "next session — build order" framing in `CONTEXT_Forge-update-2026-07-12c.md`: every item in plan v2 §H (A+B+C · E · D step 1 · G · F) shipped this session in one pass (`forge-round3-fixes.zip`, uploaded). What remains is the browser eyeball (plan §I checklist) and the sequenced tail (D step 2 ruling → arc E foes → concentration arc).**

---

## What shipped (in-repo via forge-round3-fixes.zip)

| File | Change | Smokes |
|---|---|---|
| `forge/forge-kit-derive.js` | §A `spellGroupsFrom(structural)` normalizer (both shapes; `'cantrip(s)'→0`, `'N'/'levelN'→N`; `castingTime→time`, `concentration→conc`, range into `_src`); DC/attack chain now `spellcasting.saveDC → combat.spellSaveDC → guess` (Vesperian's EK DC 12 needs the middle rung); cast mod backs out of the stored attack bonus (−PB). §B: the SPELL_COMBAT **label lookup decides the kind** — `damage-only` re-kind reverted; heals project to `heal`, buff-riders (`Hex (damage)`) and unknowns grey with reasons; `utility`/`damage` sheet rows greyed drawer notes; attack-cantrips always trust the sheet's attack roll. §C `dedupeTabs`: normalized-label dedupe, derived tile wins (classFeature 4 · spell tile 3 · assembled 2 · sheet 1; greyed never wins), loser folds into `_folded`, missing dmg adopted from the folded row (Second Wind 1d10+3). Greyed tiles excluded from flatActions (attacks+spells too — they weren't). Hellish Rebuke added to REACTION_SPELLS; reaction-by-name when a row has no casting time (Caim's shape). §G: 5etools type codes mapped (`P/SC/WD/RD`, pipe-suffix stripped). hp fallback reads `combat.hpMax` (live key; `maxHp` was fixture-only). Exports: `spellGroupsFrom`, `wrapStarterKit`. | 323 green |
| `weapon-actions.js` | `knownSpellList` legacy branch accepts bare `'1'/'2'` keys (`/^(?:level)?(\d)$/i`) — the **second Fact-1 consumer**, found by code read: three of four PCs' spells never reached `buildSpellAttacks` | covered in 323 |
| `forge/topography-test-mock.html` | §E1 `startCombat()` → `loadLiveStats().then(startCombatNow)`; roster placement via `kitFor` (hp/maxHp aware); `kitFor` starter branch returns `ForgeKitDerive.wrapStarterKit(...)` — tabs always exist. §E2 `tileFlat(...,noDepth)`: every drawHi target tint paints `depthTest:false` renderOrder 4 (movement cyan stays depth-tested — terrain tiles must vanish behind hills). §E3 **hover tile**: rAF-throttled pointermove raycast, one glowing cell (soft green; unit under cursor + pending action → green/red by side+reach validity, downed allies count for heals); clears on drag/leave/combat-end. §D step 1: `explainBlock` → the feed — *"No line of sight — pine at (14,9), 20 ft (5 terrain + 15 occluder), 7/8 corners blocked"* — named from `F.props` at the blocking cell, once per attacker/target/geometry (`__losExplained`, reset per fight); the 8-line console breakdown stays. §F heal-the-downed: `alliesForHeal` (no alive filter), `downedUnitAt`, `validTargets` heal branch; combatClick admits the `_ves` corpse sprite (`spriteUnitAny`) AND a sprite-less downed unit's bare cell while a heal is pending; local `doHeal` revives (hp floored at 0 first, token force-rebuilt, "back on their feet"); session hp-echo revive widened to force-rebuild so a corpse-pose sprite stands back up | starter-kits 20 · module `node --check` |
| `forge/tests/smoke-kit-derive.js` | +66: **the four live JSONs are first-class fixtures loaded from disk** (top-level `combat` block maps to vitals); per-PC known answers (below); greyed-or-resolvable invariant asserted on live kits AND live flatActions; dedupe counts (one Sling/Dagger/Longsword/Second Wind/EB); itemTiles code-path + live-empty pins; `spellGroupsFrom`/`wrapStarterKit` export checks; `assembleActions` drives the live kits via dynamic `import()` | 323 |
| `forge/tests/smoke-starter-kits.js` | +4: kitFor wrap scenario (real ForgeKitDerive injected → `fallback:"starter"`, tabs present, raw kit never mutated); no-derive fallback re-pinned | 20 |
| `forge/tests/smoke-spell-icons.js` / `smoke-feed-render.js` / `smoke-kit-derive.js` | **baseline repair** — the in-repo copies required `./module.js` from `forge/tests/` (a zip-layout artifact); paths fixed to `../` / `../../`. These three suites could not run from the repo as uploaded | — |

All suites green at handover: kit-derive **323** · spell-icons 43 · feed-render 66 · starter-kits **20** · protocol 56 · replay 35 · silvery-barbs 13. (`smoke-glow-color.mjs` reads an uncommitted `topo-work.html` scratch file and errors in-repo — pre-existing, untouched.)

## Plan-doc corrections (the fixture-shape rule, applied to the plan itself)

Plan v2 §A/§I carried two known answers the live JSONs contradict: **Líadan's DC is 12, not 13** (`combat.spellSaveDC:12`; CHA +2, PB +2) and **Healing Word is 1d4+2, not 1d4+3** (cast mod = spellAttackBonus 4 − PB 2). The smokes pin the JSON-derived values. Cosmere 13/+5 and Caim's CHA-based 11 were right.

## One in-code ruling for M to ratify or flip

**Derived representation wins the dedupe everywhere** — including two cases the plan didn't name: the sheet's Eldritch Blast row folds into the derived EB *spell tile* (one EB, spells tab, attack +5), and the greyed "Weapon cantrip — use from the Attacks tab" pointer tiles (BB/GFB) fold into the real attacks-tab rows, so the Spells tab no longer lists them at all. Consistent, duplicate-free, and the folded sources ride in `_folded` for the drawer — but if M wants the greyed pointers back as spell-list documentation, it's one rule flip in `_dedupeScore` (let greyed spells-tab tiles opt out of losing). Table-read it.

## §G items — diagnosis closed

The empty Items tab was **correct behavior**: nobody carries a potion/scroll/oil. The real latent bug: live inventories use 5etools type *codes* (`M/R/G/LA/P/SC…`), which the word-keyed whitelist would never match — the first looted potion (type `"P"`) would have stayed invisible. Codes now map; the live-empty state is pinned by smoke so a loot drop is the only thing that changes it.

## §F heal-the-downed — status

The **fact layer already worked**: `forge-replay.js` un-downs on any heal that lifts hp above 0, and the existing replay smoke pins exactly M's ruling (up at healed HP, downed cleared). This session added the UI that made it reachable: downed allies join the heal target pool and glow green, their cell or corpse sprite takes the click, and both the sandbox and the session echo stand the token back up (the `_ves` corpse-pose case included — the old revive branch required the sprite to be *gone*).

## Next session — build order

1. **Browser eyeball, plan §I:** Healing Word paints allies green over the ink; hover glow tracks the cursor and flips red on invalid targets; local sandbox bar populated pre-session; a blocked shortbow shot names its blocker in the feed; heal a downed ally end-to-end (both local and session).
2. **§D step 2:** M table-reads one real refusal line → rules on tree occlusion (trees cap at three-quarters / lower pine occ / as-is) → geometry smoke pins the ruling.
3. **Arc E foes** (promotable on M's word) → **concentration arc** (mock-gated), per the standing order.
4. Ratify or flip the dedupe ruling above.

## Known gaps / carry-forward (unchanged)

Supabase feed insert (top since bite 2) · universal-action fact publishing (protocol bite) · appearance prefs §6.5 · manual resource adjust · gear-manager picker migration · Resources tab read-only v1 · spell-icons glyphs pending M's curation pass · picker search + glyph growth · `smoke-glow-color.mjs`'s missing `topo-work.html`.

## Working-rules confirmations

- **The fixture-shape rule cuts both ways:** it caught the plan doc's own known answers (DC 13 → 12). Numbers in a plan are hypotheses until diffed against the JSONs.
- **Fact 1 had a second consumer** (`knownSpellList`) that only a read of the actual source found — the headless repro scoped the bug to `spellTiles`, the code read found the sibling.
- **Repo-as-uploaded must run its own smokes:** three suites had broken require paths from the zip layout and had never been executed in place. Baseline before surgery, always.
