/* character-readiness.js — character-sheet -> Forge onboarding contract.
 *
 * Soul Shards stamps the grants it actually assembled. Forge compares that
 * manifest with the effective sheet projection, exact equipment, generated
 * attacks, and the capability ledger. Missing grants and unresolved choices
 * block entry; unsupported combat rules remain visible as explicit manual
 * references instead of silently disappearing.
 *
 * Pure + dual-export: window.CharacterReadiness / module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CharacterReadiness = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var SCHEMA = "character-readiness/v1";
  var MANIFEST_SCHEMA = "character-entitlements/v1";
  var POLEARM_WEAPONS = ["glaive", "halberd", "quarterstaff", "spear"];
  var WEAPON_OPTIONS = {
    weaponSimpleMelee: ["Club", "Dagger", "Greatclub", "Handaxe", "Javelin", "Light Hammer", "Mace", "Quarterstaff", "Sickle", "Spear"],
    weaponSimpleRanged: ["Light Crossbow", "Dart", "Shortbow", "Sling"],
    weaponMartialMelee: ["Battleaxe", "Flail", "Glaive", "Greataxe", "Greatsword", "Halberd", "Lance", "Longsword", "Maul", "Morningstar", "Pike", "Rapier", "Scimitar", "Shortsword", "Trident", "War Pick", "Warhammer", "Whip"],
    weaponMartialRanged: ["Blowgun", "Hand Crossbow", "Heavy Crossbow", "Longbow"]
  };
  var ITEM_OPTIONS = {
    armor: ["Padded Armor", "Leather Armor", "Studded Leather Armor", "Hide Armor", "Chain Shirt", "Scale Mail", "Breastplate", "Half Plate", "Ring Mail", "Chain Mail", "Splint Armor", "Plate Armor", "Shield"],
    instrumentMusical: ["Bagpipes", "Drum", "Dulcimer", "Flute", "Horn", "Lute", "Lyre", "Pan Flute", "Shawm", "Viol"],
    focusSpellcasting: ["Arcane Focus", "Druidic Focus", "Holy Symbol"],
    setGaming: ["Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set"],
    toolArtisan: ["Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools", "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies", "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools"]
  };

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function norm(value) { return text(value).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]+/g, " ").trim(); }
  function slug(value) { return norm(value).replace(/\s+/g, "-") || "record"; }
  function uniqueRows(rows, keyFn) {
    var seen = Object.create(null), out = [];
    (rows || []).forEach(function (row) {
      var key = keyFn(row);
      if (key && !seen[key]) { seen[key] = true; out.push(row); }
    });
    return out;
  }
  function featureRows(structural) {
    return uniqueRows([].concat(structural && structural.features || [], structural && structural.customFeatures || []).map(function (raw) {
      if (typeof raw === "string") return { name: raw, source: "feature", desc: "" };
      raw = raw || {};
      return { name: text(raw.name), source: text(raw.source) || "feature", desc: text(raw.desc || raw.note) };
    }).filter(function (row) { return row.name; }), function (row) { return norm(row.name); });
  }
  function featureMap(structural) {
    var out = Object.create(null);
    featureRows(structural).forEach(function (row) { out[norm(row.name)] = row; });
    return out;
  }
  function grant(name, source, expectedAt, desc) {
    return {
      id: "feature-" + slug(name),
      kind: "feature",
      name: text(name),
      source: text(source) || "feature",
      expectedAt: text(expectedAt) || null,
      desc: text(desc)
    };
  }

  function createManifest(input) {
    input = input || {};
    var structural = input.structural || input;
    var expectedAt = input.expectedAt || {};
    var grants = (input.grants || featureRows(structural)).map(function (row) {
      row = row || {};
      return grant(
        row.name || row.label,
        row.source,
        row.expectedAt || expectedAt[norm(row.name || row.label)],
        row.desc
      );
    }).filter(function (row) { return row.name; });
    return {
      schema: MANIFEST_SCHEMA,
      version: 1,
      source: input.source || "soul-shards",
      signature: {
        classLabel: text(structural.classLabel),
        subclass: text(structural.subclass),
        race: text(structural.race),
        level: Number(structural.level || 0)
      },
      grants: uniqueRows(grants, function (row) { return row.kind + ":" + norm(row.name); })
    };
  }

  function legacyManifest(structural) {
    structural = structural || {};
    var rows = featureRows(structural).map(function (row) {
      return grant(row.name, row.source, null, row.desc);
    });
    var classLine = norm(structural.classLabel);
    var subclass = norm(structural.subclass);
    var race = norm(structural.race);
    function add(name, source, at) { rows.push(grant(name, source, at)); }
    if (/\bbarbarian\b/.test(classLine)) {
      var levelMatch = classLine.match(/\bbarbarian\s+(\d+)/), level = levelMatch ? Number(levelMatch[1]) : Number(structural.level || 0);
      if (level >= 1) { add("Rage", "class:Barbarian", "Barbarian 1"); add("Unarmored Defense", "class:Barbarian", "Barbarian 1"); }
      if (level >= 2) { add("Danger Sense", "class:Barbarian", "Barbarian 2"); add("Reckless Attack", "class:Barbarian", "Barbarian 2"); }
      if (level >= 3 && /wild magic/.test(subclass)) {
        add("Magic Awareness", "subclass:Path of Wild Magic", "Barbarian 3");
        add("Wild Surge", "subclass:Path of Wild Magic", "Barbarian 3");
      }
    }
    if (/half orc/.test(race)) {
      add("Darkvision", "race:Half-Orc", "Half-Orc");
      add("Menacing", "race:Half-Orc", "Half-Orc");
      add("Relentless Endurance", "race:Half-Orc", "Half-Orc");
      add("Savage Attacks", "race:Half-Orc", "Half-Orc");
    }
    var buildFeats = structural._build && structural._build.feats;
    (buildFeats || []).forEach(function (row) { add(row && row.name || row, "feat:Feat", "chosen feat"); });
    return {
      schema: MANIFEST_SCHEMA,
      version: 1,
      source: "legacy-inference",
      signature: {
        classLabel: text(structural.classLabel),
        subclass: text(structural.subclass),
        race: text(structural.race),
        level: Number(structural.level || 0)
      },
      grants: uniqueRows(rows, function (row) { return row.kind + ":" + norm(row.name); })
    };
  }

  function unresolvedCategory(item) {
    if (item && item.category) return text(item.category);
    var name = norm(item && item.name);
    if (/martial melee/.test(name)) return "weaponMartialMelee";
    if (/martial ranged/.test(name)) return "weaponMartialRanged";
    if (/simple melee/.test(name)) return "weaponSimpleMelee";
    if (/simple ranged/.test(name)) return "weaponSimpleRanged";
    if (/martial weapon/.test(name)) return "weaponMartial";
    if (/simple weapon/.test(name)) return "weaponSimple";
    if (/\bweapon\b/.test(name)) return "weapon";
    if (/\barmor\b/.test(name)) return "armor";
    if (/musical instrument/.test(name)) return "instrumentMusical";
    if (/spellcasting focus/.test(name)) return "focusSpellcasting";
    if (/gaming set/.test(name)) return "setGaming";
    if (/artisan s tools|artisan tools/.test(name)) return "toolArtisan";
    return null;
  }
  function isUnresolvedItem(item) {
    var name = text(item && item.name);
    return !!(item && item.unresolved) || /\byour choice\b/i.test(name) || /^any .*(?:weapon|armor|instrument|focus|tools?|set)\b/i.test(name);
  }
  function weaponOptions(category) {
    var simple = WEAPON_OPTIONS.weaponSimpleMelee.concat(WEAPON_OPTIONS.weaponSimpleRanged);
    var martial = WEAPON_OPTIONS.weaponMartialMelee.concat(WEAPON_OPTIONS.weaponMartialRanged);
    if (WEAPON_OPTIONS[category]) return WEAPON_OPTIONS[category].slice();
    if (category === "weaponSimple") return simple;
    if (category === "weaponMartial") return martial;
    if (category === "weapon") return simple.concat(martial);
    if (ITEM_OPTIONS[category]) return ITEM_OPTIONS[category].slice();
    return [];
  }
  function normalizedInventoryNames(character) {
    return (character && character.inventory || []).map(function (item) {
      return norm(item && item.name).replace(/\byour choice\b/g, "").trim();
    });
  }
  function capabilitiesByLabel(kit) {
    var out = Object.create(null);
    (kit && kit.capabilities || []).forEach(function (cap) { if (cap && cap.label) out[norm(cap.label)] = cap; });
    return out;
  }
  function attackRows(kit) {
    var rows = kit && kit.tabs && kit.tabs.attacks;
    if (!Array.isArray(rows)) rows = kit && kit.actions || [];
    return (rows || []).filter(function (row) {
      return row && !row.greyed && (row.kind === "attack" || row.tab === "attacks");
    });
  }
  function finding(id, kind, title, detail, severity, data) {
    return {
      id: id,
      kind: kind,
      title: title,
      detail: detail,
      severity: severity,
      data: data || null
    };
  }
  function manualCapability(cap) {
    if (!cap || cap.status === "executable") return false;
    if (cap.status === "held" || cap.status === "missing") return true;
    return cap.status === "reference" && ["actions", "reactions", "riders", "resources", "movement", "defenses"].indexOf(cap.group) >= 0;
  }

  function audit(character, kit, opts) {
    character = character || {}; kit = kit || {}; opts = opts || {};
    var structural = opts.structural || character.structural || {};
    var manifest = structural.entitlements && structural.entitlements.schema === MANIFEST_SCHEMA
      ? clone(structural.entitlements) : legacyManifest(structural);
    var inferred = manifest.source === "legacy-inference";
    var present = featureMap(structural);
    var caps = capabilitiesByLabel(kit);
    var blockers = [], warnings = [], manual = [];

    var identityReady = !!(character.key && (character.name || structural.name) && structural.classLabel);
    var statsReady = [kit.maxHp, kit.ac, kit.speed].every(function (v) { return v != null && isFinite(Number(v)); });
    var attacks = attackRows(kit);
    if (!identityReady) blockers.push(finding("identity-incomplete", "source", "Character identity is incomplete", "A saved key, name, and class line are required.", "blocked"));
    if (!statsReady) blockers.push(finding("stats-incomplete", "source", "Combat stats are incomplete", "Maximum HP, AC, and speed must resolve through the shared character authority.", "blocked"));
    if (!attacks.length) blockers.push(finding("attack-missing", "kit", "No real basic attack compiled", "Choose or equip a recognized weapon, spell attack, or authored combat action.", "blocked"));

    var expectedRows = (manifest.grants || []).map(function (row) {
      var sourceRow = present[norm(row.name)] || null;
      var cap = caps[norm(row.name)] || null;
      if (!sourceRow) {
        blockers.push(finding(
          "grant-" + slug(row.name), "grant", row.name + " is missing from the sheet",
          (row.expectedAt ? "Expected at " + row.expectedAt + ". " : "") + "Restore the saved grant, then recompile the Forge kit.",
          "blocked", { grant: row }
        ));
      } else if (manualCapability(cap)) {
        manual.push(finding(
          "manual-" + slug(row.name), "manual", row.name + " requires manual handling",
          cap && cap.automation && cap.automation.reason
            ? cap.automation.reason
            : "The feature remains available as a reference card, but its combat rule is not automated yet.",
          "manual", { grant: row, capability: cap }
        ));
      }
      return {
        name: row.name,
        source: row.source,
        expectedAt: row.expectedAt || null,
        present: !!sourceRow,
        capabilityStatus: cap ? cap.status : "reference"
      };
    });

    var unresolved = (character.inventory || []).map(function (item, index) {
      return { item: item, index: index };
    }).filter(function (row) { return isUnresolvedItem(row.item); });
    unresolved.forEach(function (row) {
      var category = unresolvedCategory(row.item), options = weaponOptions(category);
      blockers.push(finding(
        "choice-" + row.index, "choice", "Finish equipment choice: " + text(row.item.name),
        options.length ? "Choose the exact item so sheet and Forge rules can compile." : "Replace the placeholder with the exact item.",
        "blocked", { index: row.index, category: category, options: options }
      ));
    });

    var hasPolearmMaster = !!present["polearm master"];
    var inventoryNames = normalizedInventoryNames(character);
    var qualifyingPolearms = POLEARM_WEAPONS.filter(function (name) {
      return inventoryNames.some(function (itemName) { return itemName === name || itemName.indexOf(name + " ") === 0; });
    });
    if (hasPolearmMaster && !qualifyingPolearms.length && !unresolved.length) {
      warnings.push(finding(
        "polearm-master-equipment", "equipment", "Polearm Master has no qualifying weapon",
        "Equip a glaive, halberd, quarterstaff, or spear to make the feat usable.",
        "warning", { options: POLEARM_WEAPONS.slice() }
      ));
    }
    if (inferred) warnings.push(finding(
      "legacy-manifest", "manifest", "This character predates automatic onboarding",
      "Its current sheet was inferred. Reforge or level up once to save a complete entitlement manifest.",
      "review"
    ));

    manual = uniqueRows(manual, function (row) { return row.id; });
    var status = blockers.length ? "blocked" : manual.length ? "manual" : warnings.length ? "review" : "ready";
    return {
      schema: SCHEMA,
      version: VERSION,
      characterKey: character.key || kit.key || null,
      name: character.name || structural.name || kit.name || "Unnamed character",
      status: status,
      canEnter: status !== "blocked",
      manifest: manifest,
      inferredManifest: inferred,
      expected: expectedRows,
      blockers: blockers,
      warnings: warnings,
      manual: manual,
      attacks: attacks.map(function (row) { return { id: row.id || null, label: row.label || "Attack" }; }),
      counts: {
        blockers: blockers.length,
        missingGrants: blockers.filter(function (row) { return row.kind === "grant"; }).length,
        unresolvedChoices: blockers.filter(function (row) { return row.kind === "choice"; }).length,
        manual: manual.length,
        warnings: warnings.length
      },
      equipment: {
        polearmMaster: hasPolearmMaster,
        qualifyingPolearms: qualifyingPolearms
      }
    };
  }

  function repairMissingFeatures(character, report) {
    character = clone(character || {});
    var structural = character.structural || {};
    var ledger = structural.corrections || {}, active = (ledger.active || []).slice(), history = (ledger.history || []).slice();
    (report && report.blockers || []).filter(function (row) { return row.kind === "grant" && row.data && row.data.grant; }).forEach(function (row) {
      var g = row.data.grant, id = "readiness-" + slug(g.name);
      if (active.some(function (c) { return c && c.id === id; })) return;
      active.push({
        id: id, kind: "feature", action: "add", name: g.name, source: g.source || "Readiness restore",
        desc: g.desc || "", status: "confirmed", reason: "Restored from the saved character entitlement manifest"
      });
      history.push({ kind: "added", subject: g.name, correctionId: id, source: "character-readiness" });
    });
    var next = clone(structural);
    next.corrections = { version: 2, active: active, history: history };
    return { structural: next };
  }

  function replaceEquipmentChoice(character, index, selectedName) {
    character = character || {};
    var inventory = clone(character.inventory || []);
    index = Number(index);
    if (!inventory[index] || !isUnresolvedItem(inventory[index])) return null;
    var category = unresolvedCategory(inventory[index]), options = weaponOptions(category);
    if (options.length && options.map(norm).indexOf(norm(selectedName)) < 0) return null;
    inventory[index] = Object.assign({}, inventory[index], { name: text(selectedName), startingChoice: category || null });
    delete inventory[index].category;
    delete inventory[index].unresolved;
    return { inventory: inventory };
  }

  function decorateKit(kit, report) {
    if (!kit || !report) return kit;
    kit.readiness = report;
    var manualByName = Object.create(null);
    (report.manual || []).forEach(function (row) {
      if (row.data && row.data.grant) manualByName[norm(row.data.grant.name)] = row;
    });
    (kit.tabs && kit.tabs.feats || []).forEach(function (tile) {
      var row = manualByName[norm(tile && tile.label)];
      if (!row) return;
      tile.manual = true;
      tile.readinessStatus = "manual";
      tile.greyReason = row.detail;
    });
    return kit;
  }

  return Object.freeze({
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    MANIFEST_SCHEMA: MANIFEST_SCHEMA,
    POLEARM_WEAPONS: POLEARM_WEAPONS.slice(),
    WEAPON_OPTIONS: clone(WEAPON_OPTIONS),
    ITEM_OPTIONS: clone(ITEM_OPTIONS),
    createManifest: createManifest,
    legacyManifest: legacyManifest,
    audit: audit,
    repairMissingFeatures: repairMissingFeatures,
    replaceEquipmentChoice: replaceEquipmentChoice,
    equipmentOptions: weaponOptions,
    equipmentCategory: unresolvedCategory,
    decorateKit: decorateKit,
    isUnresolvedItem: isUnresolvedItem,
    norm: norm
  });
});
