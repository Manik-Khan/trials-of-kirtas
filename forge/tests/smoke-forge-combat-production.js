const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const forgeDir = path.join(__dirname, "..");
const BP = require(path.join(forgeDir, "forge-blueprint.js"));
const combatHtml = fs.readFileSync(path.join(forgeDir, "combat.html"), "utf8");
const combatJs = fs.readFileSync(path.join(forgeDir, "combat.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(forgeDir, "index.html"), "utf8");

let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}

ok("production Blueprint exports the approved schema", BP.SCHEMA === "forge-blueprint/v1");
ok("production Combat loads cache-stamped production assets",
  combatHtml.includes('href="combat.css?v=fc4"')
  && combatHtml.includes('src="forge-blueprint.js?v=bp6"')
  && combatHtml.includes('src="forge-buildings.js?v=fbld2"')
  && combatHtml.includes('src="combat.js?v=fc9"')
  && combatHtml.includes('src="forge-combat-local.js?v=fcl1"')
  && combatHtml.includes('src="forge-combat-snapshot.js?v=fcs1"')
  && !combatHtml.includes("_edits/") && !combatHtml.includes("mock-forge"));
ok("production renderer consumes the production Blueprint authority",
  combatJs.includes("const BP = window.ForgeBlueprint;")
  && !combatJs.includes("ForgeBlueprintProof"));
ok("Combat keeps the approved Artwork, Board, and Blueprint views",
  ["artwork", "board", "blueprint"].every((view) => combatHtml.includes('data-view="' + view + '"')));
ok("Combat keeps the approved Shape, Look, Objects, and Areas authoring contexts",
  ["layout", "appearance", "objects", "areas"].every((tab) => combatHtml.includes('data-map-tab="' + tab + '"')));
ok("Combat identifies exact restore as ready while shared writes remain gated",
  combatHtml.includes("Forge Combat field test")
  && combatHtml.includes("Exact local persistence and the shared restore candidate are ready")
  && combatHtml.includes("Shared combat writes remain locked until the two-device reconnect gate passes"));
ok("the visible workflow names Map, Characters, and Combat",
  [">Map</button>", ">Characters</button>", ">Combat</button>"].every((label) => combatHtml.includes(label))
  && combatHtml.includes("Choose characters →"));
ok("Map exposes one confirmed replacement flow with all four source choices",
  combatHtml.includes('id="openMapCreation"')
  && ["generate", "template", "import", "blank"].every((method) => combatHtml.includes('data-creation-method="' + method + '"'))
  && combatHtml.includes('id="confirmMapChoice" disabled'));
ok("generation offers three structural directions and exact-map staging",
  combatJs.includes("[0, 1, 2].map((candidate)")
  && combatJs.includes("new Set(fingerprints).size !== 3")
  && combatJs.includes("stageCreation(creation.candidates[0]"));
ok("real image import leaves Combat through a stored exact return handoff",
  combatJs.includes('window.location.href = "import.html#return="')
  && combatJs.includes("BP.createHandoff(state.blueprint"));

const seededA = BP.produceSeeded({ seed: 1847, topology: "auto" });
const seededB = BP.produceSeeded({ seed: 1847, topology: "auto" });
const handoff = BP.createHandoff(seededA, { armed: false, tool: "select" });
const received = BP.decodeHandoff(BP.encodeHandoff(handoff));
const field = BP.compile(received.handoff.blueprint, {});

ok("production graph-first generation remains deterministic",
  BP.stableStringify(seededA) === BP.stableStringify(seededB)
  && seededA.source.generator === "graph-first/v1");
ok("encoded handoff preserves the exact Blueprint document",
  received.ok
  && received.handoff.blueprintId === seededA.id
  && received.handoff.fingerprint === BP.fingerprint(seededA)
  && BP.stableStringify(received.handoff.blueprint) === BP.stableStringify(seededA));
ok("compiler emits the current tactical field contract",
  ["cols", "rows", "h", "wall", "occ", "coverShape", "spawns", "props", "meta"]
    .every((key) => field[key] != null));
ok("compiled tactical field retains Blueprint identity and fingerprint",
  field.meta.blueprintId === received.handoff.blueprintId
  && field.meta.blueprintFingerprint === received.handoff.fingerprint);
ok("compiled field is valid and connected",
  BP.validateMap(field).ok && BP.connectivity(field).ok);

const routeScriptMatch = indexHtml.match(/<title>The Forge[^]*?<script>([^]*?)<\/script>\s*<!-- Phase 2f\.4/);
ok("Forge entry contains the Combat router", !!routeScriptMatch);
function route(search, hash) {
  let destination = null;
  vm.runInNewContext(routeScriptMatch[1], {
    URLSearchParams,
    window: {
      location: {
        search,
        hash: hash || "",
        replace(value) { destination = value; }
      }
    }
  });
  return destination;
}
ok("the normal Forge entry opens Combat", route("", "") === "combat.html");
ok("combat flag enters Forge Combat", route("?combat=1", "") === "combat.html");
ok("Combat routing preserves an exact Blueprint handoff hash",
  route("?combat=1", "#handoff=exact") === "combat.html#handoff=exact");
ok("live multiplayer sessions stay on the existing Forge",
  route("?combat=1&session=room-1", "") === null);
ok("explicit legacy requests stay on the existing Workshop",
  route("?combat=1&legacy=1", "") === null);
ok("Workshop developer views stay on the existing renderer",
  route("?surfaces=1", "") === null);

console.log("\n" + passed + " Forge Combat production checks passed");
