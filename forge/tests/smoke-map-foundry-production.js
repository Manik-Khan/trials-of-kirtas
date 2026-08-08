const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const forgeDir = path.join(__dirname, "..");
const BP = require(path.join(forgeDir, "forge-blueprint.js"));
const foundryHtml = fs.readFileSync(path.join(forgeDir, "map-foundry.html"), "utf8");
const foundryJs = fs.readFileSync(path.join(forgeDir, "map-foundry.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(forgeDir, "index.html"), "utf8");

let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}

ok("production Blueprint exports the approved schema", BP.SCHEMA === "forge-blueprint/v1");
ok("production Foundry loads only production-local assets",
  foundryHtml.includes('href="map-foundry.css?v=mf1"')
  && foundryHtml.includes('src="forge-blueprint.js?v=bp1"')
  && foundryHtml.includes('src="map-foundry.js?v=mf1"')
  && !foundryHtml.includes("_edits/") && !foundryHtml.includes("mock-forge"));
ok("production renderer consumes the production Blueprint authority",
  foundryJs.includes("const BP = window.ForgeBlueprint;")
  && !foundryJs.includes("ForgeBlueprintProof"));
ok("Foundry keeps the approved Artwork, Board, and Blueprint views",
  ["artwork", "board", "blueprint"].every((view) => foundryHtml.includes('data-view="' + view + '"')));
ok("Foundry keeps the approved Shape, Look, Objects, and Areas authoring contexts",
  ["layout", "appearance", "objects", "areas"].every((tab) => foundryHtml.includes('data-map-tab="' + tab + '"')));
ok("Foundry identifies itself as guarded until fight and reconnect pass",
  foundryHtml.includes("Guarded production candidate")
  && foundryHtml.includes("Fight and reconnect remain field gates"));

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
ok("Forge entry contains the guarded Foundry router", !!routeScriptMatch);
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
ok("foundry flag enters the production Map Foundry",
  route("?foundry=1", "") === "map-foundry.html");
ok("Foundry routing preserves an exact Blueprint handoff hash",
  route("?foundry=1", "#handoff=exact") === "map-foundry.html#handoff=exact");
ok("live multiplayer sessions stay on the existing Forge",
  route("?foundry=1&session=room-1", "") === null);
ok("explicit legacy requests stay on the existing Workshop",
  route("?foundry=1&legacy=1", "") === null);

console.log("\n" + passed + " production Map Foundry checks passed");
