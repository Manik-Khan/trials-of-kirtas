/* Known-answer smoke for authored encounter-region activation.
   Run: node forge/tests/smoke-encounter-regions.js */
const FER = require("../forge-encounter-regions.js");
const FR = require("../forge-replay.js");
const FB = require("../forge-board.js");
const FX = require("../forge-effects.js");
const fs = require("fs");

let pass = 0, fail = 0;
const ok = (name, condition) => { condition ? pass++ : fail++; console.log((condition ? "✓ " : "✗ ") + name); };
const row = (seq, unit, kind, payload) => ({ seq, unit, kind, payload: payload || {}, created_at: seq * 1000 });

const map = { cols: 5, rows: 2, wall: Array(10).fill(0), meta: { intent: { regions: [
  { id: "approach", cells: [{ c: 0, r: 0 }, { c: 1, r: 0 }] },
  { id: "lower-court", cells: [{ c: 2, r: 0 }, { c: 3, r: 0 }] },
  { id: "summit-sanctuary", cells: [{ c: 4, r: 0 }, { c: 4, r: 1 }] }
] } } };
const deployment = { version: 2, resolved: true, groups: [
  { id: "party-main", label: "Main Party", role: "party", unitIds: ["caim", "liadan"], anchor: { c: 0, r: 0 } },
  { id: "summit-guard", label: "Summit Guard", role: "enemy", unitIds: ["guard-a", "guard-b"], anchor: { c: 4, r: 0 } }
] };

const defaults = FER.buildRecord(deployment, map, {});
ok("record resolves beside exact deployment", defaults.resolved === true);
ok("party is active at initiative by default", defaults.groups[0].mode === FER.MODES.ACTIVE);
ok("enemy waits for its authored home region by default", defaults.groups[1].mode === FER.MODES.ENTER && defaults.groups[1].triggerRegionId === "summit-sanctuary");

const record = FER.buildRecord(deployment, map, {
  "summit-guard": { mode: "enter", triggerRegionId: "lower-court" }
});
const baseRoster = [
  { unit: "caim", side: "pc", pos: { c: 0, r: 0 }, hp: 30 },
  { unit: "liadan", side: "pc", pos: { c: 1, r: 0 }, hp: 24 },
  { unit: "guard-a", side: "foe", pos: { c: 4, r: 0 }, hp: 12 },
  { unit: "guard-b", side: "foe", pos: { c: 4, r: 1 }, hp: 12 }
];
const roster = FER.applyToRoster(baseRoster, record);
ok("roster carries group identity without moving units", roster[2].encounterGroupId === "summit-guard" && roster[2].pos.c === 4);
ok("roster carries entry trigger separately from home", roster[2].encounterTriggerRegionId === "lower-court" && roster[2].encounterHomeRegionId === "summit-sanctuary");
ok("initial order includes only active-at-start groups", FER.initialInitiativeUnits(roster).join(",") === "caim,liadan");

let state = FR.initialState(roster);
ok("replay initializes authored group waiting state", state.encounterRegions.groups["summit-guard"].state === "waiting");
ok("wrong region does not trigger", FER.groupsTriggeredByEntry(state, "caim", "approach").length === 0);
ok("conscious party entry triggers the matching group", FER.groupsTriggeredByEntry(state, "caim", "lower-court")[0].id === "summit-guard");
state.units.caim.downed = true;
ok("downed party unit cannot trigger entry", FER.groupsTriggeredByEntry(state, "caim", "lower-court").length === 0);
state.units.caim.downed = false;
ok("legal hostile action finds a waiting target group", FER.hostileWaitingGroup(state, "caim", "guard-a").id === "summit-guard");
ok("friendly action does not activate a group", FER.hostileWaitingGroup(state, "guard-a", "guard-b") === null);

const setup = [
  row(1, "__session", "session_started"),
  row(2, "caim", "initiative_rolled", { roll: 17 }),
  row(3, "liadan", "initiative_rolled", { roll: 10 }),
  row(4, "guard-a", "initiative_rolled", { roll: 19 }),
  row(5, "guard-b", "initiative_rolled", { roll: 12 }),
  row(6, "__session", "initiative_set", { order: ["caim", "liadan"] }),
  row(7, "caim", "ability_used", { ability: "Dash", targets: ["caim"] })
];
state = FR.replayLog(roster, setup);
const waitingSnapshot = FR.snapshot(state);
const beforeEconomy = FR.turnEconomy(state);
const payload = FER.activationPayload(state, "summit-guard", "region-entry");
ok("held results insert without reordering existing seats", payload.order.join(",") === "guard-a,caim,guard-b,liadan");
ok("activation resumes the current creature", payload.resume_at === "caim" && payload.preserve_turn === true);
FR.applyEvent(state, row(8, "caim", "encounter_region_activated", payload), {});
ok("activation marks the group active", state.encounterRegions.groups["summit-guard"].state === "active");
ok("held initiative seats join immediately", state.initiative.join(",") === "guard-a,caim,guard-b,liadan");
ok("current turn is not restarted", FR.activeUnit(state) === "caim" && FR.round(state) === 1);
ok("spent turn economy is preserved", JSON.stringify(FR.turnEconomy(state)) === JSON.stringify(beforeEconomy));
const activeOrder = state.initiative.join(",");
FR.applyEvent(state, row(9, "caim", "encounter_region_activated", { group_id: "summit-guard", reason: "duplicate", order: ["guard-b"], resume_at: "guard-b", preserve_turn: true }), {});
ok("duplicate activation fact is inert", state.initiative.join(",") === activeOrder && state.encounterRegions.groups["summit-guard"].activatedSeq === 8);
FR.applyEvent(state, row(10, "__session", "restore", { to_seq: 7, snapshot: waitingSnapshot }), {});
ok("restore rewinds activation state and initiative seats", state.encounterRegions.groups["summit-guard"].state === "waiting" && state.initiative.join(",") === "caim,liadan");

const afterActivation = FR.replayLog(roster, setup.concat(row(8, "caim", "encounter_region_activated", payload)));
const activationVerbs = FB.verbsFor(row(8, "caim", "encounter_region_activated", payload), waitingSnapshot, afterActivation);
ok("board receives the expanded order even when the active turn is unchanged", activationVerbs.some(v => v.t === "order" && v.order.length === 4 && v.active === "caim"));
const effectState = FX.replay(setup.concat(row(8, "caim", "encounter_region_activated", payload)));
ok("effect durations see the expanded order without a false turn start", effectState.order.length === 4 && effectState.active === "caim" && effectState.starts.caim === 1);

const legacy = FR.initialState(baseRoster);
ok("legacy roster has no waiting layer", legacy.encounterRegions === null && FER.initialInitiativeUnits(baseRoster).length === 4);

const html = fs.readFileSync(require("path").join(__dirname, "../index.html"), "utf8");
ok("Forge loads the cache-stamped encounter authority", html.includes('forge-encounter-regions.js?v=fer1'));
ok("Workshop saves activation beside deployment", html.includes('envelope.encounterRegions=encounterRegions'));
ok("shared movement and hostile actions use the same activation publisher", html.includes("maybeActivateFromMove(r,st)") && html.includes("hostileWaitingGroup(sess.pipe.state(),u.unit,t.unit)"));
ok("overseer receives an explicit region control", html.includes('id="ovRegions"') && html.includes("publishEncounterActivation(b.dataset.regionActivate,'__session','dm')"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
