const assert = require("assert");
const fs = require("fs");
const path = require("path");
const BP = require("../../_edits/mock-forge-blueprint-diorama-core.js");

const html = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-blueprint-diorama-creation.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-blueprint-diorama-creation.js"), "utf8");
let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}

ok("creation proof keeps the approved forge-blueprint/v1 authority", BP.SCHEMA === "forge-blueprint/v1");
ok("Generate, Templates, Import, and Blank are equally visible starting doors",
  ["generate", "template", "import", "blank"].every((method) => html.includes('data-method="' + method + '"')));
ok("every starting door owns one contextual guide panel",
  ["generate", "template", "import", "blank"].every((method) => html.includes('data-method-panel="' + method + '"')));
ok("the flow visibly converges Start, Directions, Blueprint, and Build",
  ["source", "directions", "blueprint", "build"].every((step) => html.includes('data-journey="' + step + '"')));
ok("beginner generation offers explicit saved notes, encounter shape, and table size",
  /id="generationBrief"/.test(html) && /data-choice-group="shape"/.test(html) && /data-choice-group="size"/.test(html));
ok("generation never implies that local prose changes the produced structure",
  /does not affect generation/.test(html) && !/id="refineRequest"/.test(html)
  && /Create three new directions/.test(html) && !/Refined around/.test(js));
ok("advanced generation remains optional and exposes independent layout and decoration intent",
  /class="advanced"/.test(html) && /id="layoutSeed"/.test(html) && /id="separateDecorSeed"/.test(html));
const controls = { seed: 1847, topology: "surprise", size: "medium", density: 6, verticality: "meaningful" };
const generated = [0, 1, 2].map((candidate) => BP.produceSeeded({ ...controls, candidate }));
ok("generation uses the graph-first producer rather than a topology fixture",
  generated.every((blueprint) => blueprint.source.generator === "graph-first-proof/v1"
    && !blueprint.source.fixtureKey && blueprint.graph.nodes.length === blueprint.spaces.length));
ok("generation produces three pairwise-distinct structural candidates",
  new Set(generated.map(BP.structuralFingerprint)).size === 3);
ok("every offered candidate compiles to one valid connected tactical field",
  generated.every((blueprint) => {
    const field = BP.compile(blueprint, {});
    return BP.validateMap(field).ok && BP.connectivity(field).ok;
  }));
const replay = BP.produceSeeded({ ...controls, candidate: 1 });
ok("the same seed and controls reproduce byte-identical canonical Blueprint output",
  BP.stableStringify(replay) === BP.stableStringify(generated[1])
  && BP.fingerprint(replay) === BP.fingerprint(generated[1]));
const varied = new Set(Array.from({ length: 12 }, (_, seed) => BP.structuralFingerprint(BP.produceSeeded({
  ...controls, seed: seed + 20, candidate: 0
}))));
ok("repeated seeds produce meaningfully more than the three authored Templates", varied.size > 3);
ok("size and density controls change the generated document",
  BP.produceSeeded({ ...controls, size: "large", density: 9 }).grid.cols === 36
  && BP.produceSeeded({ ...controls, density: 9 }).spaces.length === 9);
ok("candidate preservation is explicit rather than a hidden regeneration rule",
  /state\.lockedBlueprint/.test(js) && /next\[0\] = copy\(state\.lockedBlueprint\)/.test(js));
ok("templates are editable Blueprint copies rather than a second map format",
  Object.keys(BP.FIXTURES).every((key) => BP.withSource(BP.FIXTURES[key], "fixture", { fixtureKey: key }).schema === BP.SCHEMA));
const imported = BP.produceImportedSample();
ok("assisted import carries its source, rights, underlay, and visible review findings",
  imported.source.kind === "imported" && imported.source.sourceRights && imported.source.underlay && imported.source.review.length === 4);
ok("import review never accepts uncertain findings silently",
  imported.source.review.every((finding) => !finding.accepted)
  && /filter\(function \(finding\) \{ return finding\.confidence >= \.75; \}\)/.test(js));
ok("each import finding can be accepted explicitly through the real proof authority",
  imported.source.review.every((finding) => BP.acceptImportFinding(imported, finding.id).source.review.find((item) => item.id === finding.id).accepted));
ok("Combat-compatible grid calibration remains the import alignment contract",
  /BP\.normalizeGridCalibration/.test(js) && ["importCellPx", "importOriginX", "importOriginY"].every((id) => html.includes('id="' + id + '"')));
ok("Import is visibly a future workflow preview rather than a claimed image analyzer",
  /Image loading and tracing are not built yet/.test(html) && !/<input[^>]+type="file"/i.test(html));
const reviewedImport = BP.acceptImportFinding(imported, "all");
const importedHandoff = BP.createHandoff(reviewedImport, { armed: false, tool: "select" });
const importedRoundTrip = BP.decodeHandoff(BP.encodeHandoff(importedHandoff));
ok("an already-reviewed imported fixture can use the exact generic handoff seam",
  importedRoundTrip.ok && importedRoundTrip.handoff.fingerprint === BP.fingerprint(reviewedImport));
const blank = BP.produceBlank();
ok("Blank begins with zero rooms and narrates the first-room gate",
  blank.source.kind === "blank" && blank.spaces.length === 0 && blank.corridors.length === 0
  && BP.connectivity(BP.compile(blank, {})).reason === "first room required");
const firstRoom = BP.addRoom(blank, { c: 3, r: 3 }, { c: 8, r: 8 });
ok("drawing the first room turns Blank into a valid connected field",
  firstRoom.spaces.length === 1 && BP.validateMap(BP.compile(firstRoom, {})).ok
  && BP.connectivity(BP.compile(firstRoom, {})).ok);
const blankHandoff = BP.createHandoff(blank, { armed: true, tool: "room" });
const blankRoundTrip = BP.decodeHandoff(BP.encodeHandoff(blankHandoff));
ok("Blank handoff preserves zero rooms and arms the Room brush",
  blankRoundTrip.ok && blankRoundTrip.handoff.blueprint.spaces.length === 0
  && blankRoundTrip.handoff.build.armed && blankRoundTrip.handoff.build.tool === "room");
const selectedHandoff = BP.createHandoff(generated[2], { armed: false, tool: "select" });
const selectedRoundTrip = BP.decodeHandoff(BP.encodeHandoff(selectedHandoff));
ok("selected Blueprint identity and fingerprint survive the real handoff",
  selectedRoundTrip.ok && selectedRoundTrip.handoff.blueprintId === generated[2].id
  && selectedRoundTrip.handoff.fingerprint === BP.fingerprint(generated[2])
  && BP.stableStringify(selectedRoundTrip.handoff.blueprint) === BP.stableStringify(generated[2]));
ok("the creation surface navigates with the encoded exact handoff",
  /mock-forge-blueprint-diorama\.html#handoff=/.test(js) && /BP\.createHandoff/.test(js) && /BP\.encodeHandoff/.test(js));
ok("the mock narrates its production boundary",
  /standalone proof stops at the handoff/.test(html));
ok("all creation-flow assets carry current cache stamps",
  html.includes("mock-forge-blueprint-diorama-creation.css?v=cf3")
  && html.includes("mock-forge-blueprint-diorama-creation.js?v=cf4")
  && html.includes("mock-forge-blueprint-diorama-core.js?v=bp18"));

console.log("\n" + passed + " Forge map-creation checks passed");
