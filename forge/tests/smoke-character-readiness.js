/* smoke-character-readiness.js
   Known-answer contract for the standalone character-sheet -> Forge readiness mock. */
"use strict";

var readiness = require("../../_edits/mock-forge-character-readiness-core.js");
var passed = 0;
var failed = 0;

function check(condition, label) {
  if (condition) {
    passed++;
    console.log("PASS", label);
  } else {
    failed++;
    console.error("FAIL", label);
  }
}

function names(rows) {
  return rows.map(function (row) { return row.label; });
}

var chonk = readiness.FIXTURES.chonkalius;
var current = readiness.audit(chonk);

check(readiness.SCHEMA === "forge-readiness/v1", "schema is versioned");
check(current.schema === readiness.SCHEMA, "audit carries the schema");
check(current.characterId === "chonkalius-a35f", "current Chonkalius key survives projection");
check(current.status === "partial", "current Chonkalius requires review");
check(current.statusLabel === "Review required", "partial state narrates itself");
check(current.canEnterTable === false, "partial character cannot enter the table");
check(current.counts.sourceMissing === 2, "two Wild Magic grants are missing");
check(
  names(current.expectedRows.filter(function (row) { return !row.sourcePresent; })).join("|") === "Magic Awareness|Wild Surge",
  "missing source grants are Magic Awareness and Wild Surge"
);
check(current.counts.runtimeGaps === 9, "nine expected runtime rules are not playable");
check(current.counts.unresolvedChoices === 1, "one starting-equipment choice remains unresolved");
check(current.attacks.length === 4, "real current basic attacks survive the audit");
check(current.attacks[0].label === "Handaxe", "audit does not replace attacks with a template action");
check(current.resourceRows.length === 1 && current.resourceRows[0].max === 3, "Rage pool is preserved at 3");
check(current.resourceRows[0].actionReady === false, "Rage counter is not mistaken for playable Rage");
check(
  current.warnings.some(function (row) { return row.id === "resource-rage"; }),
  "counter-only Rage gets a narrated warning"
);
check(
  current.equipmentRows.length === 1 && current.equipmentRows[0].ok === false,
  "Polearm Master fails without a qualifying exact weapon"
);
check(
  current.warnings.some(function (row) { return row.id === "equipment-polearm"; }),
  "Polearm Master equipment failure is narrated"
);

var sourceOnly = readiness.applyResolution(chonk, "restore-wild-magic");
var sourceOnlyAudit = readiness.audit(sourceOnly);
check(sourceOnlyAudit.counts.sourceMissing === 0, "source repair restores both subclass grants");
check(sourceOnlyAudit.status === "partial", "source repair alone cannot claim readiness");
check(sourceOnlyAudit.canEnterTable === false, "source repair alone keeps the table locked");

var weaponOnly = readiness.applyResolution(chonk, "choose-glaive");
var weaponOnlyAudit = readiness.audit(weaponOnly);
check(weaponOnlyAudit.counts.unresolvedChoices === 0, "weapon choice becomes exact");
check(weaponOnlyAudit.equipmentRows[0].ok === true, "glaive satisfies Polearm Master equipment");
check(
  weaponOnlyAudit.attacks.some(function (attack) { return attack.label === "Glaive"; }),
  "resolved glaive becomes a real basic attack"
);
check(weaponOnlyAudit.status === "partial", "weapon repair alone cannot claim readiness");

var runtimeOnly = readiness.applyResolution(chonk, "install-chonk-rules");
var runtimeOnlyAudit = readiness.audit(runtimeOnly);
check(runtimeOnlyAudit.counts.runtimeGaps === 0, "rules package supplies every runtime disposition");
check(runtimeOnlyAudit.counts.sourceMissing === 2, "runtime rules do not invent missing sheet grants");
check(runtimeOnlyAudit.status === "partial", "runtime repair alone cannot claim readiness");

var readyChonk = readiness.applyAll(chonk);
var readyAudit = readiness.audit(readyChonk);
var preview = readiness.preview(readyChonk);
check(readyAudit.status === "ready", "complete Chonkalius target is ready");
check(readyAudit.canEnterTable === true, "complete target may enter the table");
check(readyAudit.counts.sourceMissing === 0, "complete target has no missing grants");
check(readyAudit.counts.runtimeGaps === 0, "complete target has no runtime gaps");
check(readyAudit.counts.unresolvedChoices === 0, "complete target has no unresolved choices");
check(readyAudit.blockers.length === 0 && readyAudit.warnings.length === 0, "complete target has no hidden admission findings");
check(readyAudit.manualCount === 1, "explicit manual mode is counted, not hidden");
check(readyAudit.resourceRows[0].actionReady === true, "Rage pool has a playable owner");
check(readyAudit.equipmentRows[0].matches[0] === "glaive", "Polearm Master records its qualifying weapon");
check(preview.attacks.some(function (row) { return row.label === "Glaive"; }), "Forge preview includes the glaive");
check(preview.bonus.some(function (row) { return row.label === "Rage"; }), "Forge preview includes Rage");
check(preview.bonus.some(function (row) { return row.label === "Wild Surge"; }), "Forge preview includes Wild Surge");
check(preview.bonus.some(function (row) { return row.label === "Polearm Master"; }), "Forge preview includes Polearm Master action branch");
check(preview.reactions.some(function (row) { return row.label === "Relentless Endurance"; }), "Forge preview includes Half-Orc reaction");
check(preview.manual.some(function (row) { return row.label === "Magic Awareness"; }), "manual Magic Awareness stays visible");
check(preview.locked.length === 0, "approved target preview has no locked rules");

var caim = readiness.audit(readiness.FIXTURES.caim);
check(caim.status === "partial", "current Caim remains reviewable");
check(caim.counts.sourceMissing === 0, "Caim source grants are intact");
check(caim.counts.runtimeGaps === 1, "Caim exposes one runtime gap");
check(
  caim.warnings.some(function (row) { return row.title.indexOf("Deflect Missiles") >= 0; }),
  "Caim names Deflect Missiles as the gap"
);

var vesperian = readiness.audit(readiness.FIXTURES.vesperian);
check(vesperian.status === "partial", "current Vesperian remains reviewable");
check(vesperian.counts.runtimeGaps === 1, "Vesperian exposes one runtime gap");
check(
  vesperian.warnings.some(function (row) { return row.title.indexOf("Weapon Bond") >= 0; }),
  "Vesperian names Weapon Bond as the gap"
);

var newcomer = readiness.audit(readiness.FIXTURES["new-arrival"]);
check(newcomer.status === "blocked", "incomplete newcomer is blocked");
check(newcomer.canEnterTable === false, "blocked newcomer cannot enter the table");
check(newcomer.blockers.some(function (row) { return row.id === "identity-incomplete"; }), "newcomer reports incomplete identity");
check(newcomer.blockers.some(function (row) { return row.id === "stats-incomplete"; }), "newcomer reports incomplete combat stats");
check(newcomer.blockers.some(function (row) { return row.id === "attack-missing"; }), "newcomer reports missing basic attack");
check(newcomer.blockers.some(function (row) { return row.id === "choice-weapon-choice"; }), "newcomer reports blocking equipment choice");

Object.keys(readiness.FIXTURES).forEach(function (key) {
  var status = readiness.audit(readiness.FIXTURES[key]).status;
  check(readiness.READY_STATUSES.indexOf(status) >= 0, key + " returns a declared readiness status");
});

console.log("\nCharacter readiness:", passed + " passed,", failed + " failed");
if (failed) process.exit(1);
