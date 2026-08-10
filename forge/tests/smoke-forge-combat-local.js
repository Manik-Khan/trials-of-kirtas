const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const forgeDir = path.join(root, "forge");
const BP = require(path.join(forgeDir, "forge-blueprint.js"));
const Fight = require(path.join(forgeDir, "forge-combat-local.js"));
const Shared = require(path.join(forgeDir, "forge-combat-shared.js"));
const vesperian = require(path.join(root, "data", "characters", "vesperian.json"));
const cosmere = require(path.join(root, "data", "characters", "cosmere.json"));
const combatHtml = fs.readFileSync(path.join(forgeDir, "combat.html"), "utf8");
const combatJs = fs.readFileSync(path.join(forgeDir, "combat.js"), "utf8");

let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}

const projectedVesperian = Fight.projectCharacter(vesperian);
const projectedCosmere = Fight.projectCharacter(cosmere);
ok("real character rows project current combat facts",
  projectedVesperian.ok && projectedVesperian.unit.name === "Vesperian Vale"
  && projectedVesperian.unit.hp === 31 && projectedVesperian.unit.ac === 18
  && projectedVesperian.unit.speed === 30);
ok("a named recorded attack enters the local fight",
  projectedCosmere.ok && projectedCosmere.unit.action.label === "Eldritch Blast"
  && projectedCosmere.unit.action.hit === 5 && projectedCosmere.unit.action.dmg === "1d10"
  && projectedCosmere.unit.action.rng === 24);
ok("missing combat data is visible and fail-closed",
  Fight.projectCharacter({ key: "unfinished", name: "Unfinished", structural: {} }).ok === false
  && /combat sheet/i.test(Fight.projectCharacter({ key: "unfinished", name: "Unfinished", structural: {} }).reason));

const blueprint = BP.withSource(BP.FIXTURES.processional, "fixture", { fixtureKey: "processional" });
const originalBlueprint = BP.stableStringify(blueprint);
const map = BP.compile(blueprint, {});
const pcs = blueprint.spawns.filter((spawn) => spawn.side === "pc");
const foes = blueprint.spawns.filter((spawn) => spawn.side === "foe");
const deployment = Fight.deployCombatants(map, [projectedVesperian.unit, projectedCosmere.unit], null, [
  { id: "party-main", label: "Main Party", role: "party", anchor: pcs[0], seed: 3 },
  { id: "enemy-main", label: "Reliquary Guard", role: "enemy", anchor: foes[0], seed: 7 }
]);
ok("real party and training foes resolve through production deployment", deployment.ok && Object.keys(deployment.draft.positions).length === 5);
ok("deployment never stacks combatants", new Set(Object.values(deployment.draft.positions).map((at) => at.c + "," + at.r)).size === 5);

const identity = { blueprintId: blueprint.id, fingerprint: BP.fingerprint(blueprint), structuralFingerprint: BP.structuralFingerprint(blueprint) };
let fight = Fight.createFight(map, deployment, [projectedVesperian.unit, projectedCosmere.unit], null, identity);
ok("fight retains the exact accepted Blueprint receipt",
  fight.identity.blueprintId === map.meta.blueprintId && fight.identity.fingerprint === map.meta.blueprintFingerprint);
ok("fight creation does not mutate the authored Blueprint", BP.stableStringify(blueprint) === originalBlueprint);
ok("runtime spawns mirror live positions without becoming Blueprint spawns",
  Fight.spawns(fight).length === fight.units.length && BP.stableStringify(blueprint) === originalBlueprint);

const reachable = Fight.reachableForActive(fight);
const destination = Object.keys(reachable)[0].split(",").map(Number);
const moved = Fight.moveActive(fight, destination[0], destination[1]);
ok("active movement uses the production height-aware reach field", moved.ok && moved.path.length >= 1 && /moved/.test(moved.message));
ok("local movement still leaves the Blueprint untouched", BP.stableStringify(blueprint) === originalBlueprint);

const openMap = {
  cols: 8, rows: 8,
  h: new Array(64).fill(0), wall: new Array(64).fill(false), occ: new Array(64).fill(0),
  coverShape: new Array(64).fill(null), spawns: [], props: [], connectors: [], meta: {}
};
const duelDeployment = Fight.deployCombatants(openMap, [projectedCosmere.unit], [Fight.TRAINING_FOES[0]], [
  { id: "party-main", role: "party", anchor: { c: 1, r: 1 }, seed: 3 },
  { id: "enemy-main", role: "enemy", anchor: { c: 5, r: 1 }, seed: 7 }
]);
let duel = Fight.createFight(openMap, duelDeployment, [projectedCosmere.unit], [Fight.TRAINING_FOES[0]], identity);
duel.turn = duel.units.findIndex((unit) => unit.unit === "cosmere");
const sharedAttack = Shared.prepareAttack(duel, "reliquary-guard-1", 42);
ok("shared attack adapter carries the locally resolved roll and damage as replay facts",
  sharedAttack.ok && sharedAttack.declared.roll === sharedAttack.resolved.roll
  && sharedAttack.resolved.target === "reliquary-guard-1" && sharedAttack.resolved.base_seq === 42);
ok("shared controls distinguish the active unit’s controller from a spectator",
  Shared.canControl({ overseer: false, units: ["cosmere"] }, "cosmere")
  && !Shared.canControl({ overseer: false, units: ["vesperian"] }, "cosmere")
  && Shared.canControl({ overseer: true, units: [] }, "reliquary-guard-1"));
const attack = Fight.resolveAttack(duel, "reliquary-guard-1");
ok("a real named attack resolves through range, sight, cover, and combat rules",
  attack.ok && Number.isInteger(attack.roll) && Number.isFinite(attack.total) && Number.isFinite(attack.defense)
  && /Eldritch Blast/.test(attack.message) && attack.fight.units.find((unit) => unit.unit === "cosmere").acted);
ok("end turn advances the local initiative loop", Fight.activeUnit(Fight.endTurn(attack.fight)).unit !== "cosmere");

ok("Combat exposes roster, placement, and local fight controls",
  ["combatRoster", "prepareLocalCombat", "combatAttack", "combatEndTurn", "combatFightLog"]
    .every((id) => combatHtml.includes('id="' + id + '"')));
ok("browser integration never writes character sheets",
  combatJs.includes("CharacterData.loadParty()") && combatJs.includes("CharacterData.loadLayout()")
  && !combatJs.includes("CharacterData.save("));
ok("shared candidate publishes the local action loop through the existing session/event spine",
  combatJs.includes('.from("forge_sessions")') && combatJs.includes('ForgeProtocol.makeEvent("__session", "restore"')
  && combatJs.includes("session.pipe.move") && combatJs.includes("session.pipe.attack") && combatJs.includes("session.pipe.endTurn")
  && combatJs.includes("Live shared combat") && !combatJs.includes("Shared combat actions remain locked"));
ok("runtime tokens are rendered separately from authored Blueprint spawns",
  combatJs.includes("function runtimeSpawns()") && combatJs.includes("state.fight ? LocalCombat.spawns(state.fight)"));

console.log("\n" + passed + " Forge Combat local-fight checks passed");
