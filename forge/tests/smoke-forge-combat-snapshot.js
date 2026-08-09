const path = require("path");
const root = path.join(__dirname, "..");
const BP = require(path.join(root, "forge-blueprint.js"));
const Local = require(path.join(root, "forge-combat-local.js"));
const Snapshot = require(path.join(root, "forge-combat-snapshot.js"));

let pass = 0;
function ok(label, value) { if (!value) throw new Error("FAIL: " + label); pass++; console.log("PASS", label); }
function throws(label, fn, pattern) {
  let error = null; try { fn(); } catch (caught) { error = caught; }
  ok(label, error && pattern.test(error.message));
}

const blueprint = BP.withSource(BP.FIXTURES.processional, "fixture", { fixtureKey: "processional" });
const edits = BP.editCell({}, 8, 10, "lowWall", 0, "n");
const map = BP.compile(blueprint, edits);
const party = [{ unit: "caim", name: "Caim", side: "pc", hp: 31, hpMax: 37, ac: 17, speed: 40, initMod: 4,
  action: { id: "shortbow", label: "Shortbow", rng: 16, hit: 6, dmg: "1d6+4", damage: 7 } }];
const deployment = Local.deployCombatants(map, party, Local.TRAINING_FOES, []);
let fight = Local.createFight(map, deployment, party, Local.TRAINING_FOES, {
  blueprintId: blueprint.id, fingerprint: BP.fingerprint(blueprint), structuralFingerprint: BP.structuralFingerprint(blueprint)
});
fight.units[0].hp -= 3;
fight.units[0].moved = true;

const saved = Snapshot.create({
  savedAt: "2026-08-08T12:00:00.000Z", blueprint, edits,
  renderer: { view: "blueprint", quality: "cinematic" },
  groups: deployment.groups, deployment: deployment.record,
  discovered: ["gate", "nave"], calibration: { cellPx: 28, originX: 2, originY: 3 }, gridVisible: false,
  selectedPartyKeys: ["caim"], fight
});
ok("snapshot is explicitly versioned", saved.schema === "forge-combat-snapshot/v1" && saved.version === 1);
ok("exact Blueprint and both authored fingerprints are stored", saved.authored.blueprint.id === blueprint.id && saved.authored.blueprintFingerprint === BP.fingerprint(blueprint) && saved.authored.fieldFingerprint.startsWith("field-"));
ok("renderer choice round-trips", Snapshot.restore(saved).renderer.view === "blueprint" && Snapshot.restore(saved).renderer.quality === "cinematic");
ok("deployment groups and exact positions round-trip", Snapshot.restore(saved).deployment.positions.caim.c === deployment.record.positions.caim.c && Snapshot.restore(saved).groups.length === 2);
ok("local combat HP, movement, round, and log round-trip", Snapshot.restore(saved).fight.units[0].hp === fight.units[0].hp && Snapshot.restore(saved).fight.units[0].moved && Snapshot.restore(saved).fight.round === fight.round && Snapshot.restore(saved).fight.log.join("|") === fight.log.join("|"));
ok("restored tactical map is recompiled from authored state", Snapshot.restore(saved).fight.map.meta.blueprintFingerprint === BP.fingerprint(blueprint) && Snapshot.restore(saved).fight.map.wall[10 * map.cols + 8] === map.wall[10 * map.cols + 8]);

const again = Snapshot.restore(saved);
again.blueprint.name = "Mutated"; again.fight.units[0].hp = 0; again.groups[0].label = "Mutated";
ok("every restore is mutation-isolated", Snapshot.restore(saved).blueprint.name !== "Mutated" && Snapshot.restore(saved).fight.units[0].hp !== 0 && Snapshot.restore(saved).groups[0].label !== "Mutated");

const baseline = Snapshot.replayBaseline(saved);
ok("shared baseline carries exact HP and positions", baseline.units.caim.hp === fight.units.find((unit) => unit.unit === "caim").hp && baseline.units.caim.pos.c === fight.units.find((unit) => unit.unit === "caim").c);
ok("shared baseline retains round, active seat, and spent local economy", baseline.turnsEnded === (fight.round - 1) * fight.units.length + fight.turn && baseline.economy.movedFt === (fight.units[fight.turn].moved ? fight.units[fight.turn].speed : 0));
const replayedFight = Snapshot.fightFromReplay(saved, baseline);
ok("replay reconstructs the same fight state", replayedFight.round === fight.round && replayedFight.turn === fight.turn && replayedFight.units[replayedFight.turn].unit === fight.units[fight.turn].unit);

const sessionMap = Snapshot.toSessionMap(saved);
ok("Blueprint sessions carry the same exact snapshot", Snapshot.readSessionMap(sessionMap).kind === "blueprint" && Snapshot.readSessionMap(sessionMap).snapshot.authored.fieldFingerprint === saved.authored.fieldFingerprint);
ok("legacy saved rows remain on the explicit compatibility path", Snapshot.readSessionMap({ seed: 7, mapSnapshot: { cols: 2 } }).kind === "legacy");
ok("session roster uses the saved runtime rather than character refetch", Snapshot.roster(saved).find((row) => row.unit === "caim").hp === fight.units.find((unit) => unit.unit === "caim").hp);

const corruptBlueprint = JSON.parse(JSON.stringify(saved)); corruptBlueprint.authored.blueprint.name = "Tampered";
throws("Blueprint corruption stops loudly", () => Snapshot.restore(corruptBlueprint), /Blueprint fingerprint mismatch/);
const corruptField = JSON.parse(JSON.stringify(saved)); corruptField.authored.edits["8,10,N"].kind = "wall";
throws("Build-edit corruption stops loudly", () => Snapshot.restore(corruptField), /tactical field fingerprint mismatch/);
const unknown = JSON.parse(JSON.stringify(saved)); unknown.version = 2;
throws("unknown snapshot versions stop loudly", () => Snapshot.restore(unknown), /Unknown Forge Combat snapshot version/);

console.log("\n" + pass + " Forge Combat snapshot checks green");
