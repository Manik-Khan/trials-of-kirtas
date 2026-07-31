#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Readiness = require("../../character-readiness.js");
const Projection = require("../../character-sheet-projection.js");
const Capabilities = require("../forge-capabilities.js");
const Kit = require("../forge-kit-derive.js");
const Derive = require("../../soul-shards-derive.js");
const UI = require("../forge-readiness-ui.js");
const root = path.resolve(__dirname, "..", "..");
let pass = 0, fail = 0;

function ok(label, condition) {
  if (condition) { pass++; console.log("ok " + pass + " - " + label); }
  else { fail++; console.error("not ok - " + label); }
}
function chonkFixture() {
  return {
    key: "chonkalius-a35f",
    name: "Chonkalius",
    structural: {
      name: "Chonkalius", classLabel: "Barbarian 4", subclass: "Path of Wild Magic",
      race: "Half-Orc", level: 4, proficiencyBonus: 2,
      abilities: {
        str: { score: 18, mod: 4 }, dex: { score: 14, mod: 2 }, con: { score: 16, mod: 3 },
        int: { score: 8, mod: -1 }, wis: { score: 10, mod: 0 }, cha: { score: 8, mod: -1 }
      },
      combat: { hp: 44, hpMax: 44, ac: 12, speed: 30, initiative: 2, hitDice: "4d12" },
      proficiencies: { weapons: ["Simple", "Martial"], armor: [] },
      features: [
        { name: "Rage", source: "class:Barbarian" },
        { name: "Unarmored Defense", source: "class:Barbarian" },
        { name: "Danger Sense", source: "class:Barbarian" },
        { name: "Reckless Attack", source: "class:Barbarian" },
        { name: "Path of Wild Magic", source: "subclass:Path of Wild Magic" },
        { name: "Polearm Master", source: "feat:Feat" },
        { name: "Darkvision", source: "race:Half-Orc" },
        { name: "Menacing", source: "race:Half-Orc" },
        { name: "Relentless Endurance", source: "race:Half-Orc" },
        { name: "Savage Attacks", source: "race:Half-Orc" }
      ],
      _build: { feats: [{ name: "Polearm Master" }] }
    },
    vitals: { hp: 44, pipState: {} },
    inventory: [
      { name: "any martial melee weapon (your choice)", qty: 1, category: "weaponMartialMelee", unresolved: true },
      { name: "Handaxe", qty: 2 },
      { name: "Javelin", qty: 4 }
    ]
  };
}

(async function () {
  const Weapons = await import(path.join(root, "weapon-actions.js"));
  const current = chonkFixture();
  const currentKit = Kit.derive(current, { assembledActions: Weapons.assembleActions(current.inventory, current.structural) });
  const report = currentKit.readiness;

  ok("readiness and manifest contracts are versioned",
    Readiness.VERSION === "1.0.0" && Readiness.SCHEMA === "character-readiness/v1" &&
    Readiness.MANIFEST_SCHEMA === "character-entitlements/v1");
  ok("legacy Chonkalius is blocked by the actual onboarding gaps", report.status === "blocked" && report.canEnter === false);
  ok("legacy inference catches both missing Wild Magic grants", report.counts.missingGrants === 2 &&
    report.blockers.some(row => /Magic Awareness/.test(row.title)) &&
    report.blockers.some(row => /Wild Surge/.test(row.title)));
  ok("unresolved martial weapon remains a narrated blocker", report.counts.unresolvedChoices === 1);
  ok("real Handaxe and Javelin attacks survive the audit", report.attacks.some(row => /Handaxe/.test(row.label)) && report.attacks.some(row => /Javelin/.test(row.label)));
  ok("Rage is executable from the compiled bonus-action tile",
    currentKit.capabilities.find(row => row.label === "Rage").status === "executable");
  ok("Polearm Master stays visible as a manual Feats reference",
    currentKit.tabs.feats.find(row => row.label === "Polearm Master").manual === true);
  const controlKit = Kit.derive(current, {
    assembledActions: Weapons.assembleActions(current.inventory, current.structural),
    readiness: false
  });
  ok("field gate off leaves the current Forge kit shape untouched",
    !controlKit.readiness && !controlKit.tabs.feats.find(row => row.label === "Polearm Master").manual);

  const featurePatch = Readiness.repairMissingFeatures(current, report);
  ok("repair uses durable confirmed feature corrections", featurePatch.structural.corrections.active.length === 2 &&
    featurePatch.structural.corrections.active.every(row => row.kind === "feature" && row.action === "add" && row.status === "confirmed"));
  ok("repair does not rewrite generated feature rows",
    JSON.stringify(featurePatch.structural.features) === JSON.stringify(current.structural.features));
  const projected = Projection.projectStructural(featurePatch.structural);
  ok("the canonical sheet projection sees both restored grants",
    projected.features.some(row => row.name === "Magic Awareness") && projected.features.some(row => row.name === "Wild Surge"));

  const gearPatch = Readiness.replaceEquipmentChoice(current, 0, "Glaive");
  ok("exact equipment repair replaces only the placeholder", gearPatch.inventory[0].name === "Glaive" &&
    gearPatch.inventory[1].name === "Handaxe" && !gearPatch.inventory[0].unresolved);
  ok("invalid category choices are rejected", Readiness.replaceEquipmentChoice(current, 0, "Longbow") === null);

  const repaired = Object.assign({}, current, {
    structural: featurePatch.structural,
    inventory: gearPatch.inventory
  });
  const repairedKit = Kit.derive(repaired, { assembledActions: Weapons.assembleActions(repaired.inventory, projected) });
  ok("repaired Chonkalius may enter with honest manual rules",
    repairedKit.readiness.status === "manual" && repairedKit.readiness.canEnter === true && repairedKit.readiness.counts.blockers === 0);
  ok("the exact glaive compiles as an attack and satisfies Polearm Master",
    repairedKit.readiness.attacks.some(row => row.label === "Glaive") &&
    repairedKit.readiness.equipment.qualifyingPolearms[0] === "glaive");
  ok("Wild Surge remains named for manual table-effect resolution after repair",
    !repairedKit.readiness.manual.some(row => /Rage requires/.test(row.title)) &&
    repairedKit.readiness.manual.some(row => /Wild Surge requires/.test(row.title)));

  const fakeEngine = {
    build: function (opts) {
      return {
        className: "Barbarian", level: opts.level, hd: 12, savingThrows: ["str", "con"],
        hp: { max: 35 }, spellcasting: null, pending: [],
        features: [
          { name: "Rage", origin: "class:Barbarian", level: 1, entries: ["rage"] },
          { name: "Magic Awareness", origin: "subclass:Path of Wild Magic", level: 3, entries: ["sense magic"] },
          { name: "Wild Surge", origin: "subclass:Path of Wild Magic", level: 3, entries: ["surge"] }
        ]
      };
    }
  };
  const fakeSpellcasting = {
    deriveSpellcasting: function () { return null; },
    deriveClasses: function (input) { return input.classes.map(row => ({ name: row.name, level: row.level })); }
  };
  const fresh = Derive.deriveStructural({
    name: "Future Barbarian",
    abilities: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 },
    classes: [{ model: { name: "Barbarian" }, level: 3, subclassShortName: "Wild Magic" }]
  }, { engine: fakeEngine, spellcasting: fakeSpellcasting, readiness: Readiness });
  ok("creation/reforge stamps the complete grant manifest automatically",
    fresh.structural.entitlements.schema === Readiness.MANIFEST_SCHEMA &&
    fresh.structural.entitlements.grants.length === 3);
  ok("manifest records when the engine granted a feature",
    fresh.structural.entitlements.grants.find(row => row.name === "Wild Surge").expectedAt === "Barbarian 3");
  const control = Derive.deriveStructural({
    name: "Control Barbarian", readinessEnabled: false,
    abilities: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 },
    classes: [{ model: { name: "Barbarian" }, level: 3, subclassShortName: "Wild Magic" }]
  }, { engine: fakeEngine, spellcasting: fakeSpellcasting, readiness: Readiness });
  ok("field gate off leaves the current structural write unchanged", !control.structural.entitlements);
  const damaged = JSON.parse(JSON.stringify(fresh.structural));
  damaged.features = damaged.features.filter(row => row.name !== "Wild Surge");
  const damagedReport = Readiness.audit(
    { key: "future", name: "Future Barbarian", structural: damaged, inventory: [{ name: "Greataxe" }] },
    { key: "future", name: "Future Barbarian", maxHp: 35, ac: 14, speed: 30, tabs: { attacks: [{ id: "axe", label: "Greataxe", kind: "attack", tab: "attacks" }] }, capabilities: [] },
    { structural: damaged }
  );
  ok("a future lost grant is detected from data, without a class-specific Forge patch",
    damagedReport.counts.missingGrants === 1 && /Wild Surge/.test(damagedReport.blockers[0].title));

  const modal = UI.sheetHtml(current, report);
  ok("repair sheet offers grant restoration, exact equipment, and reforge",
    modal.includes("data-fru-restore") && modal.includes('data-fru-choice="0"') &&
    modal.includes("shards.html?reforge=chonkalius-a35f&amp;readiness=1"));
  ok("readiness badge narrates blocked state", UI.badge(report).label === "NEEDS REPAIR");

  const forgeHtml = fs.readFileSync(path.join(root, "forge", "index.html"), "utf8");
  const shardsHtml = fs.readFileSync(path.join(root, "shards.html"), "utf8");
  ok("Forge loads readiness before capability and kit compilation",
    forgeHtml.indexOf("../character-readiness.js?v=cr1") < forgeHtml.indexOf("forge-capabilities.js?v=fc4") &&
    forgeHtml.indexOf("forge-capabilities.js?v=fc4") < forgeHtml.indexOf("forge-kit-derive.js?v=b19"));
  ok("production onboarding remains behind the readiness field gate",
    forgeHtml.includes('USE_CHARACTER_READINESS = new URLSearchParams(location.search).get("readiness") === "1"') &&
    forgeHtml.includes("readiness: USE_CHARACTER_READINESS"));
  ok("Soul Shards loads readiness before the manifest-producing derive",
    shardsHtml.indexOf("character-readiness.js?v=cr1") < shardsHtml.indexOf("soul-shards-derive.js?v=cr1"));
  ok("Soul Shards creation and reforge share the same readiness field gate",
    shardsHtml.includes("var CHARACTER_READINESS_ON") && shardsHtml.includes("readinessEnabled: CHARACTER_READINESS_ON"));
  ok("Soul Shards refuses to forge an unresolved exact weapon choice",
    shardsHtml.includes("Finish every exact starting-item choice in the Items step"));

  console.log("\n" + pass + " production readiness checks green" + (fail ? " · " + fail + " failed" : ""));
  process.exitCode = fail ? 1 : 0;
})().catch(function (err) { console.error(err); process.exit(1); });
