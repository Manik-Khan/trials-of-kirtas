# Protocol-to-Board (Bite 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marry the field-verified Forge event protocol to the 3D topo board: two devices render the identical dungeon from a `forge_sessions` row and play a full turn loop (initiative, moves, attacks, prompts) through `forge_events`, with claims, staged fights, live sheets, bestiary foes, and mid-fight reinforcements. Spec: `FORGE_BOARD.md`.

**Architecture:** Marry-in-place. `forge/topography-test-mock.html` stays THE surface; its stale inlined generator is replaced by canonical `forge-engine/forge-dungeon/map-bridge`; one new dual-export module `forge/forge-board.js` translates events⇄board; Supabase enters only through the existing `forge-bus`/`forge-pipeline`. The log wins, always: local taps publish; the board mutates on the echo.

**Tech Stack:** vanilla JS/HTML/CSS, three.js r185 (ESM import map — untouched), Supabase (Postgres + RLS + realtime), Node smokes (`forge/tests/`), dual-export UMD modules.

## Global Constraints

- **NEVER `git push`.** M pushes (push = live deploy). **Commit only if M explicitly asks** — every task therefore ends in a VALIDATE checkpoint (commands + expected output), not a commit. Hand M a one-line deploy note per task instead.
- `node --check` every `.js`/`.mjs` you touch or create; run the affected `forge/tests/` smokes and paste the pass count. If `node` is missing from PATH try `/opt/homebrew/bin/node`; if still absent, SAY SO AND STOP.
- All existing suites must stay green: engine 14 · bridge 16 · geometry 26 · los-cover 27 (= 83) + placement 19 + flora + 70 protocol smokes.
- **Surgical edits.** New/risky paths behind the `?session=` URL flag; the local single-device sandbox must keep working identically with no session param.
- **Never touch `forge/tactics-geometry.js`** (it has two inlined twins; out of scope).
- **Cache stamps:** every `<script src>` added or whose file changes gets `?v=fb1`; bump the token on every subsequent change to that file.
- **Mock-first for anything visual:** each new UI face gets a standalone approval pause with M before wiring (marked ⏸ in tasks).
- SQL is append-only migration files; never rewrite `schema_delta_forge.sql`.
- Failures narrate: disabled/greyed UI states its reason; no silent drops.
- The mock's module block is ESM: top-level `var` is NOT global. Anything the classic party-select block needs must be explicitly `window.`-exported (see `topo:ready` pattern at `forge/topography-test-mock.html:3496-3512`).
- Docs that this plan changes at the end (Task 17): `FORGE_PROTOCOL.md`, `CONTEXT_Forge.md`, `FORGE_GAME_MODE.md`.

## File Structure

| File | Role | Fate |
|---|---|---|
| `forge/topography-test-mock.html` | THE surface (3,516 lines) | rebased generator; multiplayer boot behind `?session=`; new panels |
| `forge/forge-board.js` | **NEW** — event⇄board translator, claim rule, mirror plan (pure, dual-export) | created |
| `forge/forge-replay.js` | reducer | gains `edit.add_unit` |
| `forge/tests/smoke-tiers-rebase.js` | **NEW** — extraction smoke for the rebased field builder | created |
| `forge/tests/smoke-forge-board.js` | **NEW** — known-answer verbs/claim/mirror smoke | created |
| `forge/tests/smoke-protocol.js` | protocol suite (70 green) | gains add_unit cases |
| `schema_delta_forge_board.sql` | **NEW** — claim RPC + session visibility | created |
| `party.html` | character viewer | untouched (filter is battle-select only) |
| `monster-actor.js`, `combat.html` (bestiary picker, `saved_monsters`) | foe source | read/reused, not modified |
| `FORGE_BOARD.md` | spec | gains the field checklist appendix (Task 17) |

**Read before starting any task:** `FORGE_BOARD.md` (spec), `CONTEXT_Forge.md` §0/§2/§4, `CLAUDE.md`.

---

### Task 1: Rebase the field builder onto the canonical generator (deterministic)

Closes `CONTEXT_Forge.md` §5.5. After this task the tiers mode runs `ForgeDungeon.generateDungeon` with the seven canonical biomes, wall occluders come from `MapBridge.wallFeetFor()`, and the whole field build is **seed-deterministic** (two devices must grow identical flora — flora carries occluder heights, so `Math.random()` here would desync cover verdicts across devices).

**Files:**
- Modify: `forge/topography-test-mock.html` (script includes near line 14; `WALL_FT` at ~1497; `buildTiersField` at ~1756-1822; inlined generator ~581-735+)
- Test: `forge/tests/smoke-tiers-rebase.js` (new)

**Interfaces:**
- Consumes: `ForgeDungeon.generateDungeon({seed,roomCount,loopChance,decorDensity,themeKey})` → `{valid,W,H,grid,roomId,rooms,maxDepth,props,spawns,name,...}`; `MapBridge.wallFeetFor(themeKey)`; `MapBridge.CELL` (`VOID:0,FLOOR:1,WALL:2,POOL:3`).
- Produces: `buildTiersField(seed, params)` — `params={themeKey,roomCount,loopChance,decorDensity}` (all optional, defaults `{BIOME,8,0.2,0.7}`) → field `{W,H,height,type,foot,props,occ,name}`; deterministic per `(seed,params)`. `window.__buildTiersField` exported for the smoke. Task 7 passes session-row params into it.

- [ ] **Step 1: Write the failing extraction smoke.** Mirror the extraction approach of `forge/tests/smoke-placement.js` (read it first — it pulls real function source out of the mock's HTML and runs it in Node). Create `forge/tests/smoke-tiers-rebase.js`:

```js
/* smoke-tiers-rebase.js — the tiers field builder runs the CANONICAL generator,
   deterministically. Extracts the real buildTiersField from the mock (repo rule:
   real functions on the real field). */
const fs = require("fs"), path = require("path");
const FD = require("../forge-dungeon.js");
const MB = require("../map-bridge.js");
const html = fs.readFileSync(path.join(__dirname, "..", "topography-test-mock.html"), "utf8");

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("  FAIL " + name); } }

// 1. the stale inlined generator is GONE
ok("no inlined THEMES with stale keys", !/themeKey:'verdant'/.test(html) && !/'ancient'\s*:/.test(html));
ok("mock includes canonical scripts",
   /forge-dungeon\.js\?v=/.test(html) && /map-bridge\.js\?v=/.test(html) && /forge-engine\.js\?v=/.test(html));

// 2. extract the real buildTiersField (marker comments added in Step 3)
const m = html.match(/\/\*BTF-START\*\/([\s\S]*?)\/\*BTF-END\*\//);
ok("buildTiersField extractable", !!m);
if (m) {
  const T_WATER = 0, T_GRASS = 1, T_STONE = 2, T_PLAZA = 3, T_ROCK = 4;
  const documentStub = { getElementById: () => ({ textContent: "", style: {} }) };
  const fn = new Function(
    "window", "document", "ForgeDungeon", "MapBridge",
    "T_WATER", "T_GRASS", "T_STONE", "T_PLAZA", "T_ROCK", "BIOME", "flora", "mulberry32",
    m[1] + "\nreturn buildTiersField;"
  );
  const flora = () => ({ kinds: ["tree", "rock"], pal: {}, density: 1 });
  const mulberry32 = a => { a = a >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const build = fn({}, documentStub, FD, MB, T_WATER, T_GRASS, T_STONE, T_PLAZA, T_ROCK, "grass", flora, mulberry32);

  for (const theme of FD.THEME_KEYS) {
    const a = build(1234, { themeKey: theme }), b = build(1234, { themeKey: theme });
    ok(theme + ": deterministic height", Buffer.from(a.height.buffer).equals(Buffer.from(b.height.buffer)));
    ok(theme + ": deterministic occ",    Buffer.from(a.occ.buffer).equals(Buffer.from(b.occ.buffer)));
    ok(theme + ": deterministic props",  JSON.stringify(a.props) === JSON.stringify(b.props));
    const wf = MB.wallFeetFor(theme);
    let occOk = true;
    for (let i = 0; i < a.W * a.H; i++) if (a.type[i] === T_ROCK && a.occ[i] !== wf) { occOk = false; break; }
    ok(theme + ": rock occ == wallFeetFor(" + theme + ")=" + wf, occOk);
  }
  const c = build(99, {}), d = build(100, {});
  ok("different seeds differ", !Buffer.from(c.height.buffer).equals(Buffer.from(d.height.buffer)));
}
console.log("smoke-tiers-rebase: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it — must FAIL.** `node forge/tests/smoke-tiers-rebase.js` → FAIL on "no inlined THEMES with stale keys" (the mock still has `themeKey:'verdant'` at ~1758).

- [ ] **Step 3: Rebase the mock.** In `forge/topography-test-mock.html`:
  1. After the existing `<script type="importmap">` block (~line 20), add classic includes (they are UMD `window.*` modules, safe as plain scripts, and must load before the module block):
```html
<script src="forge-dungeon.js?v=fb1"></script>
<script src="map-bridge.js?v=fb1"></script>
<script src="forge-engine.js?v=fb1"></script>
```
  2. Change `const WALL_FT = 7` (~1497) to `let WALL_FT = 7;` (it is reassigned per forge below; grep every other `WALL_FT` use first and confirm nothing caches it at load time).
  3. Replace `buildTiersField` (~1756-1822) with the canonical-generator version, wrapped in extraction markers. Keep the existing tier/relax/tree logic byte-for-byte where noted; the diff is the generator call, the rng, and WALL_FT:
```js
/*BTF-START*/
function buildTiersField(seed, params){
  window.performance||(window.performance={now:()=>Date.now()});
  params = params || {};
  const themeKey = (params.themeKey && ForgeDungeon.THEME_KEYS.indexOf(params.themeKey)>=0)
                   ? params.themeKey
                   : (ForgeDungeon.THEME_KEYS.indexOf(BIOME)>=0 ? BIOME : 'grass');
  const D = ForgeDungeon.generateDungeon({
    seed: seed>>>0,
    roomCount:   params.roomCount   != null ? params.roomCount   : 8,
    loopChance:  params.loopChance  != null ? params.loopChance  : 0.2,
    decorDensity:params.decorDensity!= null ? params.decorDensity: 0.7,
    themeKey
  });
  WALL_FT = MapBridge.wallFeetFor(themeKey);
  const rng = mulberry32((seed>>>0) ^ 0x51ab3d);   // deterministic scatter — two devices must agree
  const W=D.W,H=D.H;
  /* …the existing body from `const height=new Float32Array` (old ~1760) through
     the occ loop (old ~1819) stays EXACTLY as it is, with only these edits:
       - const FLOOR=1,WALL=2,POOL=3;  →  const FLOOR=MapBridge.CELL.FLOOR, WALL=MapBridge.CELL.WALL, POOL=MapBridge.CELL.POOL;
       - every `Math.random()` inside this function (tree loop, old 1802/1811/1812/1813) → `rng()`
       - the final wall-occ line keeps: if(type[i]===T_ROCK) occ[i]=WALL_FT;  (WALL_FT now theme-true) */
  document.getElementById('dungeonName').textContent=D.name;
  return {W,H,height,type,foot,props,occ,name:D.name};
}
/*BTF-END*/
window.__buildTiersField = buildTiersField;
```
  4. Delete the inlined stale generator: from the extraction header comment (~573, "threejs-procedural-dungeon") through the end of the inlined `generateDungeon` function — locate the exact end with `grep -n "function buildTracedField\|function generateDungeon" forge/topography-test-mock.html` and verify the block boundaries by reading them before deleting. **Keep `mulberry32` (~581)** — the seeded scatter above uses it. Delete the inlined `const THEMES` (613-679) with it.
  5. `rebuild()` (~2215) call site: `F=buildTiersField(parseInt(document.getElementById('seed').value)||7)` stays valid (params optional).

- [ ] **Step 4: Validate.**
```
node --check forge/forge-dungeon.js forge/map-bridge.js forge/forge-engine.js   # untouched, sanity
node forge/tests/smoke-tiers-rebase.js      # expected: all pass, 0 failed
node forge/tests/smoke-placement.js         # expected: 19 green (extraction still finds its functions)
node forge/tests/smoke-flora.js             # expected: green
```
Browser eyeball (M): forge a few seeds per biome chip; biome chip now changes the DUNGEON on next forge (walls, species), not just paint — the existing "re-forge to reseed the flora" narration (~2241) already says so. ⏸ **Checkpoint: M eyeballs + commits.**

---

### Task 2: Honest forge knobs (local-only UI)

The session row's `map.sliders` must be the generator's real inputs. This task adds those controls to the mock's panel, still single-device.

**Files:**
- Modify: `forge/topography-test-mock.html` (control panel HTML ~457-525; slider wiring ~2268-2279; `rebuild()` ~2212)

**Interfaces:**
- Produces: `window.__forgeParams()` → `{seed, theme, sliders:{roomCount, loopChance, decorDensity, verticality, foes}}` — the exact object Task 11 writes into `forge_sessions.map`. `rebuild()` consumes it for the tiers path.

- [ ] **Step 1: ⏸ Mock-first.** Screenshot/standalone render of the extended panel for M: below the existing seed group add a "DUNGEON" group — Rooms (range 4-16, default 8), Loops (0-100%, default 20), Decor (0-100%, default 70), Foes (1-8, default 5). Theme stays the existing biome chip row (it now IS the generator theme after Task 1). Existing camera knobs (Height exaggeration/Grid/Prop size) stay where they are — label the group "CAMERA (local)". Get M's yes before wiring.
- [ ] **Step 2: Add the controls** (match the existing `.imgonly`-style row markup at 486-520 exactly; ids `rooms`,`loops`,`decor`,`foes`, each with `<span id="...Val">`).
- [ ] **Step 3: Wire them.** Follow the `res/levels/water` pattern (~2269): update the Val label on input; re-`rebuild()` on change when `mode==='tiers'`. Implement and export:
```js
function forgeParams(){
  return { seed: parseInt(document.getElementById('seed').value)||7,
           theme: BIOME,
           sliders: { roomCount:+document.getElementById('rooms').value,
                      loopChance:(+document.getElementById('loops').value)/100,
                      decorDensity:(+document.getElementById('decor').value)/100,
                      verticality:5,
                      foes:+document.getElementById('foes').value } };
}
window.__forgeParams = forgeParams;
```
In `rebuild()`, the tiers branch becomes: `const fp=forgeParams(); F=buildTiersField(fp.seed, {themeKey:fp.theme, roomCount:fp.sliders.roomCount, loopChance:fp.sliders.loopChance, decorDensity:fp.sliders.decorDensity});`
- [ ] **Step 4: Validate.** `node forge/tests/smoke-tiers-rebase.js` still green; browser: sliders regenerate the dungeon; camera sliders still live-update without regenerating. ⏸ **Checkpoint: M eyeballs + commits.**

---

### Task 3: Protocol extension — `edit.add_unit`

**Files:**
- Modify: `forge/forge-replay.js:123-130` (the `edit` case)
- Test: `forge/tests/smoke-protocol.js` (read its case pattern first; append cases at the end following it)

**Interfaces:**
- Produces: an `edit` change entry `{add_unit:{unit,name?,side?,pos:{c,r},hp,maxHp?,reacts?,statblock?}}` creates the unit in `state.units` (extra fields `name`,`statblock` ride along for the board). Duplicate/malformed → warn + ignore (narrated, never throws). Tasks 6 and 15 consume this.

- [ ] **Step 1: Write failing cases** in `forge/tests/smoke-protocol.js` (adapt assertion helpers to the file's own style — read it first):
```js
// ── edit.add_unit (FORGE_BOARD.md §6) ──
(function(){
  var roster=[{unit:"caim",side:"pc",pos:{c:1,r:1},hp:24}];
  var rows=[
    {seq:1,kind:"session_started",unit:"__session",payload:{}},
    {seq:2,kind:"edit",unit:"__session",payload:{changes:[{add_unit:{unit:"gob9",name:"Goblin 9",side:"foe",pos:{c:5,r:5},hp:7,statblock:{name:"Goblin"}}}]}},
    {seq:3,kind:"attack_resolved",unit:"caim",payload:{target:"gob9",hit:true,dmg:3}}
  ];
  var st=FR.replayLog(roster,rows);
  ok("add_unit creates the unit", !!st.units.gob9);
  ok("added unit takes damage", st.units.gob9.hp===4);
  ok("added unit carries statblock", st.units.gob9.statblock && st.units.gob9.statblock.name==="Goblin");
  // duplicate is inert
  var st2=FR.replayLog(roster, rows.concat([{seq:4,kind:"edit",unit:"__session",payload:{changes:[{add_unit:{unit:"gob9",pos:{c:0,r:0},hp:99}}]}}]));
  ok("duplicate add_unit ignored", st2.units.gob9.hp===4);
  // arrival then restore behind it: snapshot had no gob9 → gob9 gone after restore
  var snap=FR.replayLog(roster, rows.slice(0,1));
  var st3=FR.replayLog(roster, rows.concat([{seq:5,kind:"restore",unit:"__session",payload:{to_seq:1,snapshot:FR.snapshot(snap)}}]));
  ok("restore behind arrival erases it", !st3.units.gob9);
})();
```
- [ ] **Step 2: Run — FAIL** (`node forge/tests/smoke-protocol.js`): gob9 undefined.
- [ ] **Step 3: Implement** — in `forge-replay.js`, at the top of the `edit` case's `forEach` (before `var t = state.units[ch.unit]`):
```js
if (ch.add_unit) {
  var au = ch.add_unit;
  if (!au.unit || !au.pos || au.hp == null || state.units[au.unit]) {
    console.warn("[forge-replay] add_unit ignored: " +
      (au.unit && state.units[au.unit] ? "duplicate unit " + au.unit : "missing unit/pos/hp"));
    return;
  }
  state.units[au.unit] = {
    side: au.side || "foe", pos: { c: au.pos.c, r: au.pos.r },
    hp: au.hp, maxHp: (au.maxHp != null ? au.maxHp : au.hp),
    conditions: [], reacts: (au.reacts || []).slice(),
    reactionUsed: false, downed: false,
    name: au.name || au.unit, statblock: au.statblock || null
  };
  return;
}
```
- [ ] **Step 4: Validate.** `node --check forge/forge-replay.js` · `node forge/tests/smoke-protocol.js` → 70 + 5 new, 0 failed. **Checkpoint: M commits.**

---

### Task 4: Claim SQL — `schema_delta_forge_board.sql`

**Files:**
- Create: `schema_delta_forge_board.sql`

**Interfaces:**
- Produces: RPC `forge_claim_unit(p_session uuid, p_unit text)` returns jsonb `{ok:bool, why?:text}`; widened `forge_sessions_select`. Task 12 calls it via `sb.rpc('forge_claim_unit', {p_session, p_unit})`.

- [ ] **Step 1: Write the migration:**
```sql
-- schema_delta_forge_board.sql — FORGE_BOARD.md §3: players claim their own
-- unit. forge_sessions_overseer_write stays overseer-only; this RPC is the one
-- narrow door. Also: members must SEE forming fights to claim into them —
-- the old select policy required already-being-in-controllers (chicken/egg).
-- Idempotent and safe to re-run. Append-only: never edit schema_delta_forge.sql.

-- 1. visibility: any signed-in member sees sessions (this Supabase is the
--    campaign's members only; events stay gated by their own policy)
drop policy if exists forge_sessions_select on public.forge_sessions;
create policy forge_sessions_select on public.forge_sessions
  for select to authenticated using (true);

-- 2. the claim door. SECURITY DEFINER: bypasses forge_sessions_overseer_write
--    for exactly this shape of write and nothing else.
create or replace function public.forge_claim_unit(p_session uuid, p_unit text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.forge_sessions;
  uid text := auth.uid()::text;
  in_roster boolean;
  claimed_by text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'why', 'not signed in'); end if;
  select * into s from public.forge_sessions where id = p_session for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'no such fight'); end if;
  if s.status = 'ended' then return jsonb_build_object('ok', false, 'why', 'fight is over'); end if;
  select exists (select 1 from jsonb_array_elements(s.roster) r
                 where r->>'unit' = p_unit and coalesce(r->>'kind','pc') = 'pc') into in_roster;
  if not in_roster then return jsonb_build_object('ok', false, 'why', 'not a claimable character in this fight'); end if;
  select k into claimed_by from jsonb_each(s.controllers) as e(k, v)
    where v ? p_unit limit 1;
  if claimed_by is not null and claimed_by <> uid then
    return jsonb_build_object('ok', false, 'why', 'already claimed');
  end if;
  update public.forge_sessions
     set controllers = jsonb_set(controllers, array[uid],
                        coalesce(controllers->uid, '[]'::jsonb) ||
                        case when coalesce(controllers->uid, '[]'::jsonb) ? p_unit
                             then '[]'::jsonb else to_jsonb(array[p_unit]) end)
   where id = p_session;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.forge_claim_unit(uuid, text) to authenticated;
```
- [ ] **Step 2: Validate.** No local Postgres — validation is by review + the harness RLS checklist step (Task 17). Cross-check the jsonb shapes against `schema_delta_forge.sql:11-13` (`controllers = {auth_uid:[unit,...]}`). Deploy note for M: "run `schema_delta_forge_board.sql` in the Supabase SQL editor (idempotent)." **Checkpoint: M applies + commits.**

---

### Task 5: `forge/forge-board.js` — the translator (pure core)

**Files:**
- Create: `forge/forge-board.js`
- Test: `forge/tests/smoke-forge-board.js` (new)

**Interfaces:**
- Consumes: `ForgeReplay` state shape (`units{unit:{pos,hp,maxHp,downed,conditions,side,name?,statblock?}}, status, initiative, turnsEnded, pendingPrompt, chat, lastSeq`), `ForgeReplay.activeUnit/round`.
- Produces (window.ForgeBoard / module.exports):
  - `verbsFor(row, before, after)` → array of board verbs. Verb vocabulary (Tasks 7-10 implement handlers): `{t:'status',status}` · `{t:'walk',unit,path,to:{c,r}}` · `{t:'jump',unit,to:{c,r}}` · `{t:'hp',unit,hp,maxHp,downed,delta}` · `{t:'spawn',unit,u}` (u = the state unit) · `{t:'despawn',unit}` · `{t:'turn',unit,round}` · `{t:'prompt',prompt}` · `{t:'prompt_clear'}` · `{t:'chat',unit,text}` · `{t:'resync'}` (restore/override — board re-reads whole state).
  - `controls(me, unit)` → bool (me = `{actor, units:[...], overseer}`).
  - `canClaim(sessionRow, uid, unit)` → `{ok, why?}` — JS twin of the SQL rule (UI greying; SQL enforces).
  - `mirrorPlan(before, after, myUnits, rosterByUnit)` → `[{key, vitals:{hp}}]` — sheet writes owed after a state change (Task 13 executes them; `rosterByUnit[unit].sheet_ref` is the charKey).

- [ ] **Step 1: Write the failing smoke** `forge/tests/smoke-forge-board.js` (known-answer; drives rows through `ForgeReplay` and asserts exact verbs):
```js
const FR = require("../forge-replay.js");
const FB = require("../forge-board.js");
let pass=0, fail=0;
function ok(n,c){ if(c){pass++;} else {fail++; console.log("  FAIL "+n);} }
function snap(s){ return JSON.parse(JSON.stringify(s)); }
const roster=[{unit:"caim",side:"pc",pos:{c:1,r:1},hp:24},{unit:"gob1",side:"foe",pos:{c:5,r:5},hp:7}];
function run(rows){ // replay collecting verbs per row
  let st=FR.initialState(roster), out=[];
  rows.forEach(r=>{ const before=snap(st);
    if(r.kind==="override"||r.kind==="restore"){ st=FR.replayLog(roster,rows.filter(x=>x.seq<=r.seq)); }
    else FR.applyEvent(st,r,null);
    out.push(FB.verbsFor(r,before,st)); });
  return {st,verbs:out};
}
const rows=[
  {seq:1,kind:"session_started",unit:"__session",payload:{}},
  {seq:2,kind:"initiative_set",unit:"__session",payload:{order:["caim","gob1"]}},
  {seq:3,kind:"move_declared",unit:"caim",payload:{path:[{c:1,r:1},{c:2,r:1},{c:3,r:1}]}},
  {seq:4,kind:"move_resolved",unit:"caim",payload:{final_cell:{c:3,r:1}}},
  {seq:5,kind:"attack_declared",unit:"caim",payload:{target:"gob1",roll:18}},
  {seq:6,kind:"prompt",unit:"caim",payload:{to:"gob1",react:"shield",timeout:20}},
  {seq:7,kind:"prompt_answered",unit:"gob1",payload:{prompt_seq:6,use:false}},
  {seq:8,kind:"attack_resolved",unit:"caim",payload:{target:"gob1",hit:true,dmg:3}},
  {seq:9,kind:"turn_ended",unit:"caim",payload:{}},
  {seq:10,kind:"edit",unit:"__session",payload:{changes:[{add_unit:{unit:"gob2",side:"foe",pos:{c:6,r:6},hp:7}}]}},
];
const {st,verbs}=run(rows);
ok("session_started → status verb", verbs[0].some(v=>v.t==="status"&&v.status==="active"));
ok("initiative_set → turn verb for caim", verbs[1].some(v=>v.t==="turn"&&v.unit==="caim"&&v.round===1));
ok("move_declared → no movement verb yet", !verbs[2].some(v=>v.t==="walk"||v.t==="jump"));
ok("move_resolved → walk with declared path", verbs[3].some(v=>v.t==="walk"&&v.unit==="caim"&&v.path.length===3&&v.to.c===3));
ok("prompt → prompt verb", verbs[5].some(v=>v.t==="prompt"&&v.prompt.to==="gob1"));
ok("answer → prompt_clear", verbs[6].some(v=>v.t==="prompt_clear"));
ok("attack_resolved → hp verb delta -3", verbs[7].some(v=>v.t==="hp"&&v.unit==="gob1"&&v.hp===4&&v.delta===-3));
ok("turn_ended → turn verb gob1", verbs[8].some(v=>v.t==="turn"&&v.unit==="gob1"));
ok("add_unit → spawn verb", verbs[9].some(v=>v.t==="spawn"&&v.unit==="gob2"));
// restore → resync
const rows2=rows.concat([{seq:11,kind:"restore",unit:"__session",payload:{to_seq:2,snapshot:FR.snapshot(FR.replayLog(roster,rows.slice(0,2)))}}]);
ok("restore → resync verb", run(rows2).verbs[10].some(v=>v.t==="resync"));
// controls / canClaim / mirrorPlan
ok("controls: own unit", FB.controls({actor:"u1",units:["caim"],overseer:false},"caim"));
ok("controls: overseer any", FB.controls({actor:"u9",units:[],overseer:true},"gob1"));
ok("controls: not yours", !FB.controls({actor:"u1",units:["caim"],overseer:false},"gob1"));
const sess={status:"staging",roster:[{unit:"caim",kind:"pc"},{unit:"gob1",kind:"foe"}],controllers:{u2:["cosmere"]}};
ok("canClaim ok", FB.canClaim(sess,"u1","caim").ok);
ok("canClaim: foes unclaimable", !FB.canClaim(sess,"u1","gob1").ok);
ok("canClaim: taken", !FB.canClaim({...sess,controllers:{u2:["caim"]}},"u1","caim").ok);
ok("canClaim: ended", !FB.canClaim({...sess,status:"ended"},"u1","caim").ok);
// mirrorPlan: hp changed on MY unit only, absolute value
const b4={units:{caim:{hp:24},gob1:{hp:7}}}, af={units:{caim:{hp:20},gob1:{hp:4}}};
const plan=FB.mirrorPlan(b4,af,["caim"],{caim:{sheet_ref:"caim"},gob1:{}});
ok("mirrorPlan: one write, my unit, absolute", plan.length===1&&plan[0].key==="caim"&&plan[0].vitals.hp===20);
console.log("smoke-forge-board: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
```
- [ ] **Step 2: Run — FAIL** (`node forge/tests/smoke-forge-board.js` → cannot find `../forge-board.js`).
- [ ] **Step 3: Implement `forge/forge-board.js`** (dual-export UMD, same wrapper as `forge-replay.js:8-13`, requiring `./forge-replay.js`):
```js
/* ── forge-board.js ───────────────────────────────────────────────────
   Battle Forge event→BOARD translator (FORGE_BOARD.md §2). Pure: takes an
   event row plus the replayed state before/after it and names the board
   verbs — walk this path, set this HP, open this prompt. The renderer
   implements the verbs; this module never touches the DOM or three.js.
   Also: the claim rule's JS twin (UI greying; SQL enforces) and the
   sheet-mirror plan (absolute values — rewinds just re-set).
   Dual export: browser (window.ForgeBoard) + node.                       */
(function (root, factory) {
  var FR = (typeof require !== "undefined") ? require("./forge-replay.js") : root.ForgeReplay;
  var api = factory(FR);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeBoard = api;
})(typeof self !== "undefined" ? self : this, function (FR) {

  function controls(me, unit) { return !!me.overseer || (me.units || []).indexOf(unit) >= 0; }

  function canClaim(session, uid, unit) {
    if (!session) return { ok: false, why: "no fight" };
    if (session.status === "ended") return { ok: false, why: "fight is over" };
    var row = (session.roster || []).filter(function (r) { return r.unit === unit; })[0];
    if (!row) return { ok: false, why: "not in this fight" };
    if ((row.kind || "pc") !== "pc") return { ok: false, why: "foes are the DM's" };
    var ctl = session.controllers || {};
    var owner = Object.keys(ctl).filter(function (k) { return (ctl[k] || []).indexOf(unit) >= 0; })[0];
    if (owner && owner !== uid) return { ok: false, why: "already claimed" };
    return { ok: true };
  }

  /* diff units before→after: positions and hp. Robust to any kind. */
  function unitDiffs(before, after) {
    var verbs = [];
    Object.keys(after.units || {}).forEach(function (k) {
      var a = after.units[k], b = (before.units || {})[k];
      if (!b) { verbs.push({ t: "spawn", unit: k, u: a }); return; }
      if (a.hp !== b.hp) verbs.push({ t: "hp", unit: k, hp: a.hp, maxHp: a.maxHp, downed: a.downed, delta: a.hp - b.hp });
      if (a.pos.c !== b.pos.c || a.pos.r !== b.pos.r) verbs.push({ t: "jump", unit: k, to: { c: a.pos.c, r: a.pos.r } });
    });
    Object.keys(before.units || {}).forEach(function (k) {
      if (!(after.units || {})[k]) verbs.push({ t: "despawn", unit: k });
    });
    return verbs;
  }

  function turnVerb(before, after) {
    var was = FR.activeUnit(before), is = FR.activeUnit(after);
    if (is && is !== was) return [{ t: "turn", unit: is, round: FR.round(after) }];
    return [];
  }

  function verbsFor(row, before, after) {
    var verbs = [];
    switch (row.kind) {
      case "restore": case "override":
        return [{ t: "resync" }];
      case "session_started": case "session_ended":
        verbs.push({ t: "status", status: after.status });
        verbs = verbs.concat(turnVerb(before, after));
        break;
      case "initiative_set": case "turn_ended":
        verbs = verbs.concat(turnVerb(before, after));
        break;
      case "move_resolved": {
        var mv = after.units[row.unit], p = row.payload || {};
        var path = (before.pendingAction && before.pendingAction.unit === row.unit && before.pendingAction.path) || null;
        if (mv) verbs.push(path ? { t: "walk", unit: row.unit, path: path, to: { c: mv.pos.c, r: mv.pos.r } }
                                : { t: "jump", unit: row.unit, to: { c: mv.pos.c, r: mv.pos.r } });
        verbs = verbs.concat(unitDiffs(before, after).filter(function (v) { return !(v.t === "jump" && v.unit === row.unit); }));
        break;
      }
      case "prompt":
        verbs.push({ t: "prompt", prompt: after.pendingPrompt });
        break;
      case "prompt_answered":
        if (before.pendingPrompt && !after.pendingPrompt) verbs.push({ t: "prompt_clear" });
        verbs = verbs.concat(unitDiffs(before, after));
        break;
      case "chat":
        verbs.push({ t: "chat", unit: row.unit, text: (row.payload || {}).text });
        break;
      default:   // attack_resolved, ability_used, edit, initiative_rolled, declares…
        verbs = verbs.concat(unitDiffs(before, after));
        break;
    }
    return verbs;
  }

  /* Sheet mirror (FORGE_BOARD.md §5): my units only, absolute hp. */
  function mirrorPlan(before, after, myUnits, rosterByUnit) {
    var out = [];
    (myUnits || []).forEach(function (u) {
      var a = (after.units || {})[u], b = (before.units || {})[u];
      var ref = rosterByUnit && rosterByUnit[u] && rosterByUnit[u].sheet_ref;
      if (a && b && ref && a.hp !== b.hp) out.push({ key: ref, vitals: { hp: a.hp } });
    });
    return out;
  }

  return { verbsFor: verbsFor, controls: controls, canClaim: canClaim, mirrorPlan: mirrorPlan };
});
```
- [ ] **Step 4: Validate.** `node --check forge/forge-board.js` · `node forge/tests/smoke-forge-board.js` → all pass, 0 failed · re-run `node forge/tests/smoke-protocol.js` (untouched, sanity). **Checkpoint: M commits.**

---

### Task 6: Multiplayer boot — session row → identical board (view-sync stage)

The mock learns `?session=<uuid>`: fetch the row, build the SAME dungeon from `row.map`, place tokens at replayed positions, and apply translator verbs as events arrive. **No local actions yet** — this stage is field-verifiable by driving events from the protocol harness in a second window while the board watches.

**Files:**
- Modify: `forge/topography-test-mock.html` — script includes; a new `bootSession()` in the module block; `startCombat` split (see below)

**Interfaces:**
- Consumes: Task 1 `buildTiersField(seed, params)`; Task 5 `ForgeBoard.verbsFor`; `ForgeBus.makeSupabaseBus({sb,sessionId}).connect()`; `ForgePipeline.makePipeline({conn,roster,me,reactions,onPrompt,onEvent,onPromptFallback})` + `catchUp()` (bootstrap exactly as `forge/protocol-harness-mock.html:88-110` — read it first); session row `{map:{seed,theme,sliders}, roster:[{unit,kind,sheet_ref?,statblock?,pos?,hp?,...}], controllers, overseer, status}`.
- Produces: `window.__forgeSession = {pipe, row, me}` (debug + later tasks); verb handlers `applyVerb(v)` mapping onto existing board functions — `walkPath(u,path,done)` (~3165), `positionToken(u)`, `setHudHp`-equivalent (locate the HP paint in `renderHud`), `clog(html)` for chat/narration.

- [ ] **Step 1: Add includes** after the Task 1 script tags:
```html
<script src="forge-protocol.js?v=fb1"></script>
<script src="forge-replay.js?v=fb1"></script>
<script src="forge-bus.js?v=fb1"></script>
<script src="forge-pipeline.js?v=fb1"></script>
<script src="forge-board.js?v=fb1"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```
(Same supabase CDN as the harness — copy its exact URL and the `SUPA_URL/SUPA_KEY` constants + `?url=&key=` override pattern, harness lines 50-52.)
- [ ] **Step 2: Boot branch.** In the module block, after `topo:ready` dispatch (~3355):
```js
const SESSION_ID = new URLSearchParams(location.search).get('session');
if (SESSION_ID) bootSession(SESSION_ID).catch(e => {
  clog('<b style="color:#c0553f">Could not join the fight:</b> ' + (e.message || e));
});
async function bootSession(sid){
  const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  const { data:{ user } } = await sb.auth.getUser();
  if (!user) { clog('<b>Sign in to join the fight.</b>'); return; }
  const { data: row, error } = await sb.from('forge_sessions').select('*').eq('id', sid).single();
  if (error || !row) throw new Error(error ? error.message : 'no such session');
  // identical dungeon from the row — never from local UI
  document.getElementById('partySelect').classList.add('gone');
  mode = 'tiers'; BIOME = row.map.theme;
  F = buildTiersField(row.map.seed, Object.assign({ themeKey: row.map.theme }, row.map.sliders));
  if (!F.occ) F.occ = EMPTY_OCC(F.W * F.H);
  applyLook(); renderField();
  const me = { actor: user.id, units: (row.controllers[user.id] || []), overseer: row.overseer === user.id };
  const conn = window.ForgeBus.makeSupabaseBus({ sb, sessionId: sid }).connect();
  const pipe = window.ForgePipeline.makePipeline({
    conn, roster: row.roster, me,
    reactions: () => [],                     // Task 8 fills this
    onPrompt: () => {}, onPromptFallback: () => {},   // Task 9 fills these
    onEvent: (r, st) => { const before = lastState; lastState = window.ForgeReplay.snapshot(st);
      window.ForgeBoard.verbsFor(r, before, st).forEach(applyVerb); }
  });
  let lastState = window.ForgeReplay.snapshot(pipe.state());
  await pipe.catchUp();
  lastState = window.ForgeReplay.snapshot(pipe.state());
  spawnFromState(pipe.state(), row);
  window.__forgeSession = { pipe, row, me, sb };
  setInterval(() => pipe.checkTimeouts(), 1000);
  clog('<b>Joined fight ' + sid.slice(0, 8) + '</b> as ' + (me.overseer ? 'overseer' : me.units.join(', ') || 'spectator'));
}
```
- [ ] **Step 3: `spawnFromState(state, row)` + `applyVerb(v)`.** Reuse the token machinery from `startCombat` (~2793-2826) — extract its unit-building into a helper both paths share (surgical: move, don't duplicate). Units come from `state.units` (pos/hp) + roster kit fields; NO local initiative roll, NO local placement (positions are facts from the log/roster). `applyVerb`:
```js
function unitByKey(k){ return CB.units.filter(u=>u.unit===k)[0]; }
function applyVerb(v){
  const u = v.unit && unitByKey(v.unit);
  switch(v.t){
    case 'walk':   if(u){ CB_ANIM=true; walkPath(u, v.path.map(p=>({c:p.c,r:p.r})), ()=>{ CB_ANIM=false; }); } break;
    case 'jump':   if(u){ u.c=v.to.c; u.r=v.to.r; positionToken(u); } break;
    case 'hp':     if(u){ u.hp=v.hp; u.alive=!v.downed; renderHud(); if(!u.alive) killToken(u); } break;
    case 'spawn':  spawnUnitFromState(v.unit, v.u); break;
    case 'despawn':if(u){ killToken(u); CB.units=CB.units.filter(x=>x!==u); } break;
    case 'turn':   setActiveFromLog(v.unit, v.round); break;   // Task 8 fleshes the HUD side
    case 'status': if(v.status==='ended') clog('<b>Fight over.</b>'); break;
    case 'chat':   clog('<i>'+escapeHtml(v.unit)+':</i> '+escapeHtml(v.text)); break;
    case 'prompt': case 'prompt_clear': break;                 // Task 9
    case 'resync': resyncFromState(window.__forgeSession.pipe.state()); break;
  }
}
function resyncFromState(st){ CB.units.forEach(u=>{ const s=st.units[u.unit]; if(!s){ killToken(u); return; }
  u.c=s.pos.c; u.r=s.pos.r; u.hp=s.hp; u.alive=!s.downed; positionToken(u); }); renderHud(); }
```
(`killToken`, `positionToken`, `walkPath`, `renderHud`, `clog` all exist — grep each before use and match their real signatures; `u.unit` is the roster unit id, added to the shared unit builder.)
- [ ] **Step 4: Validate — the first two-window moment.** `node --check` on the HTML's extracted JS is impossible — instead: `node forge/tests/smoke-tiers-rebase.js` (extraction unaffected) and manual: window A = `protocol-harness-mock.html?session=<id>` (overseer), window B = `topography-test-mock.html?session=<id>`. Harness publishes `edit` moves / attack_resolved → the BOARD's tokens jump and HP drops. Same seed row opened twice → identical dungeon (compare `dungeonName` + eyeball). No session param → the local sandbox behaves exactly as before (regression eyeball). ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 7: Local actions → pipeline + turn gating

Board taps publish events; the board mutates on the echo (delete the direct-mutation path when a session is live). Action buttons appear only for `ForgeBoard.controls(me, activeUnit)`.

**Files:**
- Modify: `forge/topography-test-mock.html` — move commit path (`moveUnitTo` ~3182, its click caller), attack path (`doAttack` ~3085), `endTurn` (~3200), HUD render (`renderHud` — grep it), `nextTurn` (~2862)

**Interfaces:**
- Consumes: `pipe.move(unit, path, resolveFacts)`, `pipe.attack(unit, facts, resolveFacts)`, `pipe.endTurn(unit)` (signatures at `forge-pipeline.js:120-132`); existing rules math in `resolveStrike`/`pipelineHit` (~3026-3085) — **the engine already on the device computes the facts; the pipeline ferries them** (spec: rules never re-run in replay).
- Produces: `netMove(u,path)`, `netAttack(u,action,target)`, `netEndTurn()` used by the existing click handlers when `window.__forgeSession` exists; `setActiveFromLog(unit, round)` drives `CB.ti`/`CB.st` from the log instead of local `nextTurn()`.

- [ ] **Step 1:** In the move click path: when in a session, do NOT mutate — compute legality exactly as today (`TG.pathTo`, budget), then:
```js
netMove(u, path){ const fin = path[path.length-1];
  window.__forgeSession.pipe.move(u.unit, path, () => ({ final_cell: { c: fin.c, r: fin.r } }))
    .then(r => { if (r && r.ok === false) clog('<b style="color:#c0553f">Couldn\'t reach the table — try that again.</b> <i>(' + (r.why || 'publish failed') + ')</i>'); });
}
```
The echo produces the `walk` verb which animates every screen, including this one. **Every publish path (move, attack, endTurn, answerPrompt) gets the same `.then` failure narration — nothing on any screen moved (the tap never rendered locally), and the player is told, per spec §8.**
- [ ] **Step 2:** Attack: today `doAttack` rolls, runs `pipelineHit`, applies damage locally. In a session, split: roll + hit math local (unchanged functions), then `pipe.attack(u.unit, {target:t.unit, roll, adv, mode}, answers => ({hit, dmg, effects}))` — the local apply is removed; the `hp` verb applies it on echo. Reaction candidates move to Task 8's `reactions()` — for THIS task pass `reactions: () => []` still.
- [ ] **Step 3:** Turn gating: `renderHud` renders action buttons only when `!window.__forgeSession || ForgeBoard.controls(me, activeUnitId())`; otherwise a narrated banner `"<name>'s turn — <player> is acting"`. `setActiveFromLog` sets `CB.ti` to the order index of the log's active unit, rebuilds `CB.st` (move budget etc.) exactly as `nextTurn` does (share the code — extract `beginTurn(u)` from `nextTurn` ~2866-2875 and call it from both). End Turn button → `pipe.endTurn(myActiveUnit)`.
- [ ] **Step 4: Validate.** Two browsers, both on the BOARD now: A moves/attacks on A's turn → B sees it; B's buttons are hidden off-turn with the banner; refresh mid-fight → both land identically (`window.__forgeSession.pipe.state()` JSON-equal). Local sandbox unchanged without `?session=`. ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 8: Reactions over the wire on the board

**Files:**
- Modify: `forge/topography-test-mock.html` — `reactions()` callback in `bootSession`; the reaction steps builder (`pipelineHit` ~3026-3031, `preDmg` ~3047)

**Interfaces:**
- Consumes: pipeline `reactions(state, declaredRow, answers)` → `[{to, react, context}]` candidates (called repeatedly until empty; the pipeline's `asked` map stops re-asks — `forge-pipeline.js:78-91`); the mock's existing priority logic (Silvery Barbs → Shield → Hellish Rebuke) in `pipelineHit`.
- Produces: `reactionCandidates(state, declaredRow, answers)` in the mock — ports `pipelineHit`'s candidate selection to read from replayed `state` + roster kits instead of `CB`: for an `attack_declared` row, allies-in-range with `silveryBarbs` unspent; the target with `shield`; after a hit, the target's `hellishRebuke`. Resource checks read the same kit data Task 16 wires.

- [ ] **Step 1:** Implement `reactionCandidates` beside `pipelineHit`, reusing its range/eligibility checks (call the same helpers; do not fork the math). Wire it: `reactions: reactionCandidates` in `bootSession`.
- [ ] **Step 2:** `resolveFacts(answers)` in `netAttack` honors answers: a used Shield (+5 AC) re-evaluates the local hit exactly as the local pipeline did; Silvery Barbs reroll; Rebuke damage lands in `effects` (shapes per `FORGE_PROTOCOL.md` §4 and the existing local implementations).
- [ ] **Step 3: Validate.** Two boards: A attacks B's Cosmere with Shield available → B gets asked (crude `confirm()` is fine UNTIL Task 9), answer changes the outcome on both screens; a declined `(unit,reaction)` is not re-asked (watch the log). `node forge/tests/smoke-protocol.js` still green. ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 9: Prompt UX routed per spec

**Files:**
- Modify: `forge/topography-test-mock.html` — replace the Task 8 `confirm()`: `onPrompt`, `onPromptFallback`, `prompt`/`prompt_clear` verbs; new modal + waiting banner markup next to the existing `#cbReactUse/#cbReactSkip` block (~561, wired ~3365)

**Interfaces:**
- Consumes: `onPrompt(row)` fires only on devices controlling `payload.to` (`forge-pipeline.js:38`); `pipe.answerPrompt(unit, promptSeq, use, extra)`; `pipe.checkTimeouts()` → calls `onPromptFallback(p)` on the overseer device after `timeout` (pipeline:154-162); `pendingPrompt.created_at` for countdown resume.
- Produces: `showPromptModal(prompt)` (big YES/NO + live countdown from `created_at`, answers via `answerPrompt`); `showWaitingBanner(prompt)` for everyone else ("waiting on Cosmere — Shield?" + countdown); both cleared by the `prompt_clear` verb. Overseer fallback opens the same modal flagged "answering as Cosmere (timed out)".

- [ ] **Step 1: ⏸ Mock-first** — static screenshot of modal + banner for M (styles matched to the existing HUD chrome).
- [ ] **Step 2: Implement.** Countdown = `timeout*1000 - (Date.now() - new Date(prompt.created_at).getTime())`, floored at 0 — a refreshed device resumes mid-count (spec §8). On a device that controls the prompted unit AND is not the asker, `onPrompt` opens the modal; the `prompt` verb shows the banner elsewhere. `prompt_clear` closes both.
- [ ] **Step 3: Validate.** Three-window field check: asker A, prompted B, overseer C. B gets the modal ONLY; A and C see the banner; B answers → resolves everywhere. Repeat with B's tab closed → after 20 s C's fallback modal appears, C answers as the unit. Refresh B mid-prompt → modal comes back with the shrunken countdown. ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 10: Initiative flow + overseer toolbar

**Files:**
- Modify: `forge/topography-test-mock.html` — initiative UI + overseer toolbar; `startCombat`'s local `d(20)` roll (~2822-2824) becomes log-driven in sessions

**Interfaces:**
- Consumes: `pipe.rollInitiative(unit, roll)`, `pipe.setInitiative(order)`, `pipe.start()`, `pipe.end()`, `pipe.override(seq, correction)`, `pipe.restoreTo(seq)`, `pipe.edit(changes)` (pipeline:131-150); `state.rolls` accumulates `initiative_rolled`.
- Produces: session fights begin in an "initiative lobby" HUD state: each controller sees a ROLL button per unclaimed-by-log unit of theirs (`d20a` + init mod, publishes the total); the overseer panel lists rolls as they land, rolls-for-absent buttons, and CONFIRM ORDER (pre-sorted by roll desc, one tap → `setInitiative`). Overseer toolbar v1: Force End Turn (`pipe.endTurn(activeUnitId())` — actor stamp shows it) · Correct last (`override` on the last resolved event, minimal payload editor) · Rewind (pick a `turn` boundary from the log → `restoreTo`) · GOD MODE (drag = `edit` pos; HP stepper = `edit` hp) · End fight.

- [ ] **Step 1: ⏸ Mock-first** — initiative lobby + toolbar screenshot for M.
- [ ] **Step 2: Implement** (the `turn` verb + `setActiveFromLog` from Task 7 already drive the order once `initiative_set` lands; GOD-MODE drag reuses the existing placement click-picking — grep `placedGroup` handlers).
- [ ] **Step 3: Validate.** Field: full fight start on two boards — roll on each device, confirm order on overseer, first turn begins for the right unit everywhere; rewind to round start → both boards resync (the `resync` verb); GOD-MODE HP edit shows everywhere. ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 11: Session lifecycle — Open the table / Save for later / staged list / Start fight

**Files:**
- Modify: `forge/topography-test-mock.html` — forge panel gains the lifecycle buttons; staged-fights list (overseer only)

**Interfaces:**
- Consumes: Task 2 `__forgeParams()`; `sb.from('forge_sessions').insert({overseer:uid, map, roster, controllers:{}, status:'staging'}).select('id').single()` (exact shape: harness 78-83); Task 14's `buildRoster()` for the roster payload; `CharacterData.loadParty()` + `loadCharacter` for vitals at Start.
- Produces: **Open the table** → insert row (status `staging`) → navigate self to `?session=<id>` as overseer. **Save for later** → same insert, stay put, toast the id. **Staged fights** list (overseer): `select id,map,status,created_at where status='staging'` → open (navigate) / abandon (`update {status:'ended'}`). **Start fight** (overseer, in-session, staging only): snapshot vitals into roster (`update roster` — each pc row gains `{hp: vitals.hp ?? structural.combat.hp, maxHp: structural.combat.hpMax + (vitals.hpBonus||0), pos}` — positions computed ONCE here by the overseer device using the existing `clusterAround`/`foeAnchor` placement against the generated field, so placement randomness lives outside the log) → `update {status:'active'}` → `pipe.start()` → initiative lobby.

- [ ] **Step 1: ⏸ Mock-first** — lifecycle buttons + staged list look.
- [ ] **Step 2: Implement.** Vitals read per `character-data.js`: current hp `c.vitals.hp` (fallback `c.structural.combat.hp`), max `c.structural.combat.hpMax + (c.vitals.hpBonus||0)` (the exact expressions at `character-data.js:296-297`).
- [ ] **Step 3: Validate.** Field: forge → Open the table → second device joins by URL → Start fight → initiative lobby on both. Save for later → row visible in staged list after reload → open works. Abandon narrates. **Wounded party check:** set a PC's sheet HP low, start a fight → the board shows the wounded value. ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 12: Claim screen — folder-filtered arcade select, wired to the RPC

**Files:**
- Modify: `forge/topography-test-mock.html` — the classic party-select block (~3390-3513)

**Interfaces:**
- Consumes: session row roster + `controllers`; `ForgeBoard.canClaim`; `sb.rpc('forge_claim_unit', {p_session, p_unit})` (Task 4); `CharacterData.loadLayout()` → `{folders:[{id,name}], members:{charKey:folderId}}` (`character-data.js:191-206`); the existing card renderer `build()` (~3436) and `ready()` (~3416).
- Produces: when `?session=` is present and the fight is `staging`/`active`, the select renders **session roster ∩ the folder named `Campaign Characters`** (case-insensitive match on `folders[].name`; if no such folder exists, show ALL roster PCs and narrate "no Campaign Characters folder — showing everyone"). Claimed cards show the claimer's badge and grey the tap; unclaimed → tap calls the RPC, re-fetches the row, enters the board with `me.units` updated. Folder members without a combat sheet keep the existing greyed "NO COMBAT SHEET" treatment (never dropped). The mock login-chip row (`buildLogin` ~3427) is hidden in session mode — identity is `sb.auth`, not a chip.

- [ ] **Step 1: ⏸ Mock-first** — claimed/unclaimed/greyed card states for M.
- [ ] **Step 2: Implement.** The classic block reaches session data via a `window.__forgeStaging = {row, sb, uid}` handshake set by `bootSession` before the select is dismissed (mirror the `topo:ready` deferral pattern — the module block is deferred, the select must wait for the handshake exactly as it waits for `CHAR`, ~3496-3512). On claim success also `pipe.catchUp()` is NOT needed (controllers is row data, not events) — re-select the row instead. After the fight starts, an unclaimed PC's card (and its board nameplate) says **“run by the DM”** — the overseer controls it via the existing overseer clause; empty seats never block (spec §3).
- [ ] **Step 3: Validate.** Field: two devices claim different PCs (cards update on refresh); both tap the same PC near-simultaneously → one wins, the other sees "already claimed" narrated; Chonkalius/The Wiz absent (not in folder); a folder PC without a sheet is greyed with the reason; `party.html` untouched (open it, everyone still there). ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 13: Sheet mirror — the combat IS the sheet

**Files:**
- Modify: `forge/topography-test-mock.html` — `onEvent` in `bootSession` grows the mirror call

**Interfaces:**
- Consumes: `ForgeBoard.mirrorPlan(before, after, myUnits, rosterByUnit)` (Task 5); `CharacterData.save(key, {vitals})` — vitals patch shape per `character-data.js` (`vitals.hp` absolute; merge, don't clobber: read `loadCharacter(key)` once at boot, keep its vitals object, patch `.hp`).
- Produces: after every applied event, each device writes `vitals.hp` for units it controls (overseer covers unclaimed PCs: `myUnits` = my units, plus for the overseer every roster pc unit not present in any `controllers` list). Failures narrate + retry: on `save` rejection, queue the LATEST value per key, retry every 5 s, show a small "sheet catching up" chip; never block the fight.

- [ ] **Step 1:** Implement `runMirror(before, after)` with the latest-value retry queue (a `Map key→vitals`, one `setInterval(5000)` drain).
- [ ] **Step 2: Validate.** Field: damage Cosmere on the board → her `party.html`/sheet page shows the new HP within a second (realtime or on refresh, matching how sheets already sync); rewind past the damage → sheet returns to the pre-damage value (absolute re-set, nothing double-subtracted); kill the network briefly → chip appears, reconnect → value lands. `node forge/tests/smoke-forge-board.js` mirror cases still green. ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 14: Foes — shelf + books into the roster

**Files:**
- Modify: `forge/topography-test-mock.html` — forge panel foe picker; `buildRoster()`
- Read (not modified): `combat.html:3166-3280` (bestiary picker + `saved_monsters` shelf patterns), `monster-actor.js` (`MonsterActor.toCharacter(combatantRow)` — it expects `{id, name, statblock}`-shaped input; read its header contract at `monster-actor.js:1-30`)

**Interfaces:**
- Consumes: `sb.from('saved_monsters').select('id,name,statblock,tags').order('name')` (exact query: `combat.html:3610`); the 5etools JSON files list (`combat.html:3174-3176`); `MonsterActor.toCharacter` → `{name, combat:{ac,hp,hpMax,speed,initiative}, actions:[...]}`.
- Produces: `buildRoster()` → `[{unit, kind:'pc', sheet_ref:key} ...party] ++ [{unit:'foe-'+slug+'-'+n, kind:'foe', name, statblock} ...picked]` — statblocks SNAPSHOTTED into the row (spec §6). Party units = the Campaign Characters folder's sheet-ready members. The unit-builder from Task 6 turns a foe roster row into a board unit via `MonsterActor.toCharacter({id:unit, name, statblock})` (+ `ac/hp/speed` onto the token). ★ on a fight foe → insert into `saved_monsters` (upsert by name, same shape combat.html writes — read its save handler at ~3632 first).

- [ ] **Step 1: ⏸ Mock-first** — foe picker row in the forge panel (search box + shelf chips + count stepper) for M.
- [ ] **Step 2: Implement picker + `buildRoster()`** (used by Task 11's inserts). Foe spawn positions: Start-fight placement (Task 11) already covers all roster units.
- [ ] **Step 3: Validate.** Field: forge a fight with 2 shelf goblins + 1 book monster → both devices render them with real AC/HP; the overseer's foe turn uses the parsed attacks; an exotic statblock degrades to a readable note (monster-actor's graceful path), never a broken button; ★ a tweaked goblin → it appears on combat.html's shelf. ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 15: Reinforcements — Add foe mid-fight

**Files:**
- Modify: `forge/topography-test-mock.html` — overseer toolbar "Add foe"

**Interfaces:**
- Consumes: Task 14 picker; `pipe.edit([{add_unit:{unit,name,side:'foe',pos,hp,maxHp,statblock}}])`; Task 3's replay handling → Task 5's `spawn` verb → Task 6's `spawnUnitFromState`.
- Produces: overseer taps Add foe → picker → taps a walkable cell (reuse the placement click-picking) → `edit` publishes; every device spawns the token. Follow-up narration prompts the overseer: "slot it into initiative" → opens the Task 10 order editor pre-filled (new unit appended; overseer drags/confirms → `setInitiative` with the full new order).

- [ ] **Step 1: Implement** (all pieces exist; this is wiring).
- [ ] **Step 2: Validate.** Field: round 2, add a goblin from the shelf → appears on both boards at the tapped cell; re-confirm initiative including it; it takes a turn; refresh a device → the arrival replays (self-contained event). Rewind to round 1 → it vanishes on both (Task 3's smoke proved the reducer; this proves the board). ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 16: Starter action bars from live sheets

**Files:**
- Modify: `forge/topography-test-mock.html` — `CHAR` (~2636-2661) becomes derived-at-boot in session mode

**Interfaces:**
- Consumes: `CharacterData.loadCharacter(key)` → `{structural, vitals}`; the existing `CHAR` kit shape (actions array with `{label,kind,rng,hit,dmg,...}`, `react`, `res`) — the board's action HUD keeps eating exactly this shape.
- Produces: `STARTER_KITS` — the current hand-tuned `CHAR` table renamed, minus hp/ac/speed/init (those four now read live per fight from the sheet: ac/speed/init from `structural.combat`, hp per Task 11's snapshot). In session mode `CHAR[key] = Object.assign({}, STARTER_KITS[key], liveStats)`; sandbox mode keeps the old numbers as fallback when no sheet loads (narrated). A folder PC with a sheet but no `STARTER_KITS` entry gets `{actions:[basic weapon from structural if derivable, Dash, Dodge], react:null}` and a narrated "starter kit — full actions come with the derivation layer".

- [ ] **Step 1: Implement** (verify `structural.combat` field names by reading one live character via `CharacterData.loadCharacter` in the console first — grep `structural.combat` across `sheet-mount.js`/`characters.js` for the canonical names; do NOT guess).
- [ ] **Step 2: Validate.** Field: Cosmere's board AC/HP match her sheet page exactly; change her sheet AC, re-forge → board follows. Damage → Task 13 mirror → sheet page agrees. No-sheet character stays greyed in the select (Task 12). ⏸ **Checkpoint: M field-checks + commits.**

---

### Task 17: Docs + the two-device field checklist

**Files:**
- Modify: `FORGE_PROTOCOL.md` (§2 payload note: `edit` may carry `add_unit` — full snapshot inline, replay-self-contained; §8 decision row), `FORGE_GAME_MODE.md` (step 6 marked in progress/done with pointer to `FORGE_BOARD.md`), `CONTEXT_Forge.md` (§2 file-map rows for `forge-board.js` + new smokes; §5.5 marked fixed; §8 refreshed), `FORGE_BOARD.md` (append "Field checklist" as run)

**Interfaces:** none — prose.

- [ ] **Step 1:** Write the checklist into `FORGE_BOARD.md` as an appendix, exactly the spec §9.6 list, as checkboxes M ticks at the table.
- [ ] **Step 2:** Update the four docs (keep each edit to the sections named above; these docs are canonical — wrong claims cost future sessions).
- [ ] **Step 3: Final validation sweep** — run and paste ALL counts:
```
node --check forge/forge-board.js forge/forge-replay.js
node forge/tests/smoke-forge-engine.js && node forge/tests/smoke-map-bridge.mjs
node forge/tests/smoke-tactics-geometry.mjs && node forge/tests/smoke-los-cover.js
node forge/tests/smoke-placement.js && node forge/tests/smoke-flora.js
node forge/tests/smoke-protocol.js && node forge/tests/smoke-tiers-rebase.js
node forge/tests/smoke-forge-board.js
```
Expected: every suite green, totals ≥ 83 + 19 + flora + 75 + rebase + board. **Checkpoint: M runs the field checklist at the table; his report is ground truth.**

---

## Task ordering & dependencies

1 → 2 → (3, 4, 5 in any order) → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → (14 → 15) → 16 → 17.
Tasks 3-5 are pure/headless and can be built while M is away; every task from 6 on ends in a two-device field check that needs M.
