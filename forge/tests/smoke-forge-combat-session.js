const path = require("path");
const root = path.join(__dirname, "..");
const BP = require(path.join(root, "forge-blueprint.js"));
const Local = require(path.join(root, "forge-combat-local.js"));
const FP = require(path.join(root, "forge-protocol.js"));
const FB = require(path.join(root, "forge-bus.js"));
const Pipeline = require(path.join(root, "forge-pipeline.js"));
const Snapshot = require(path.join(root, "forge-combat-snapshot.js"));

let pass = 0;
function ok(label, value) { if (!value) throw new Error("FAIL: " + label); pass++; console.log("PASS", label); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

(async function () {
  const blueprint = BP.withSource(BP.FIXTURES.vault, "fixture", { fixtureKey: "vault" });
  const map = BP.compile(blueprint, {});
  const party = [{ unit: "vesperian", name: "Vesperian", side: "pc", hp: 24, hpMax: 31, ac: 19, speed: 30, initMod: 3,
    action: { id: "longbow", label: "Longbow", rng: 30, hit: 7, dmg: "1d8+3", damage: 7 } }];
  const deployment = Local.deployCombatants(map, party, [Local.TRAINING_FOES[0]], []);
  const fight = Local.createFight(map, deployment, party, [Local.TRAINING_FOES[0]], {
    blueprintId: blueprint.id, fingerprint: BP.fingerprint(blueprint), structuralFingerprint: BP.structuralFingerprint(blueprint)
  });
  fight.round = 3;
  fight.turn = 1;
  fight.units[1].moved = true;
  const saved = Snapshot.create({ blueprint, groups: deployment.groups, deployment: deployment.record, selectedPartyKeys: ["vesperian"], fight });
  const roster = Snapshot.roster(saved);

  const bus = FB.makeMemoryBus({ status: "active", overseer: "dm", controllers: { player: ["vesperian"] } });
  const dmConn = bus.connect("dm"), playerConn = bus.connect("player");
  const dm = Pipeline.makePipeline({ conn: dmConn, roster, me: { actor: "dm", units: [], overseer: true } });
  const player = Pipeline.makePipeline({ conn: playerConn, roster, me: { actor: "player", units: ["vesperian"], overseer: false } });
  const started = await dmConn.publish(FP.makeEvent("__session", "session_started", {}));
  const restored = await dmConn.publish(FP.makeEvent("__session", "restore", { to_seq: started.seq, snapshot: Snapshot.replayBaseline(saved) }));
  ok("overseer seeds the existing event spine with start and exact restore facts", started.ok && restored.ok && restored.seq > started.seq);
  ok("two connected clients land on byte-identical replay state", same(dm.state(), player.state()));
  ok("both clients retain the saved round and active seat", dm.state().turnsEnded === (fight.round - 1) * fight.units.length + fight.turn && dm.activeUnit() === fight.units[fight.turn].unit);
  ok("both clients retain exact saved HP and positions", dm.state().units.vesperian.hp === fight.units.find((unit) => unit.unit === "vesperian").hp && same(dm.state().units, player.state().units));

  const lateConn = bus.connect("player");
  const late = Pipeline.makePipeline({ conn: lateConn, roster, me: { actor: "player", units: ["vesperian"], overseer: false } });
  await late.catchUp();
  ok("a reconnecting device rebuilds the same event state", same(late.state(), dm.state()));
  const dmFight = Snapshot.fightFromReplay(saved, dm.state()), lateFight = Snapshot.fightFromReplay(saved, late.state());
  ok("renderer runtime reconstructed after reconnect is exact", same(dmFight, lateFight) && dmFight.round === fight.round && dmFight.turn === fight.turn);
  ok("the restored fight still carries the exact authored field fingerprint", Snapshot.fieldFingerprint(dmFight.map) === saved.authored.fieldFingerprint);
  ok("the shared candidate remains a restore proof, not a second Blueprint author", BP.fingerprint(dmFight.map.meta ? saved.authored.blueprint : {}) === saved.authored.blueprintFingerprint);

  console.log("\n" + pass + " Forge Combat shared-restore checks green");
})().catch((error) => { console.error(error); process.exitCode = 1; });
