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
ok("beginner generation asks for a brief, encounter shape, and table size",
  /id="generationBrief"/.test(html) && /data-choice-group="shape"/.test(html) && /data-choice-group="size"/.test(html));
ok("advanced generation remains optional and exposes independent layout and decoration intent",
  /class="advanced"/.test(html) && /id="layoutSeed"/.test(html) && /id="separateDecorSeed"/.test(html));
ok("generation produces three structurally distinct real Blueprint candidates",
  ["processional", "vault", "warren"].every((topology, index) => {
    const blueprint = BP.produceSeeded({ seed: 1847 + index, topology });
    return blueprint.schema === BP.SCHEMA && BP.validateMap(BP.compile(blueprint, {})).ok;
  }));
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
const blank = BP.produceBlank();
ok("blank creation still opens a valid connected Blueprint",
  blank.source.kind === "blank" && BP.validateMap(BP.compile(blank, {})).ok && BP.connectivity(BP.compile(blank, {})).ok);
ok("the handoff promises editability without navigating into production",
  /Shape remains editable/.test(html) && /3D uses the same rooms/.test(html) && !/window\.location|location\.href/.test(js));
ok("the mock narrates its production boundary",
  /standalone proof stops at the handoff/.test(html) && /Production integration remains outside this mock/.test(js));
ok("all creation-flow assets carry current cache stamps",
  (html.match(/\?v=cf1/g) || []).length === 2 && html.includes("mock-forge-blueprint-diorama-core.js?v=bp13"));

console.log("\n" + passed + " Map Foundry creation-flow checks passed");
