/* mock-forge-character-readiness-core.js
   Pure contract proof for character-sheet -> Forge onboarding.
   Standalone mock only; no production character or combat authority imports it.
   Dual export: window.MockForgeCharacterReadiness / module.exports. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MockForgeCharacterReadiness = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEMA = "forge-readiness/v1";
  var RUNTIME_STATUSES = ["executable", "manual", "held", "missing", "reference"];
  var READY_STATUSES = ["ready", "partial", "blocked"];

  function copy(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function text(value) {
    return String(value == null ? "" : value).trim();
  }
  function norm(value) {
    return text(value).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function slug(value) {
    return norm(value).replace(/\s+/g, "-") || "record";
  }
  function uniq(list) {
    var seen = Object.create(null), out = [];
    (list || []).forEach(function (value) {
      var key = text(value);
      if (key && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    });
    return out;
  }
  function featureNames(character) {
    return ((character && character.source && character.source.features) || []).map(function (feature) {
      return text(feature && feature.name || feature);
    }).filter(Boolean);
  }
  function hasFeature(character, expectation) {
    var names = featureNames(character).map(norm);
    var aliases = [expectation.label].concat(expectation.aliases || []).map(norm);
    return aliases.some(function (alias) { return names.indexOf(alias) >= 0; });
  }
  function capabilityFor(character, expectation) {
    var capabilities = (character && character.capabilities) || [];
    var wanted = norm(expectation.capabilityId || expectation.id || expectation.label);
    return capabilities.filter(function (capability) {
      return norm(capability.id) === wanted || norm(capability.label) === norm(expectation.label);
    })[0] || null;
  }
  function equippedWeaponKeys(character) {
    return ((character && character.source && character.source.inventory) || []).filter(function (item) {
      return item && item.weaponKey && item.equipped !== false;
    }).map(function (item) { return norm(item.weaponKey); });
  }
  function runtimeReady(status) {
    return status === "executable" || status === "manual";
  }
  function finding(id, kind, title, detail, severity, targetId) {
    return {
      id: id,
      kind: kind,
      title: title,
      detail: detail,
      severity: severity || "attention",
      targetId: targetId || null
    };
  }

  function audit(character) {
    character = copy(character || {});
    var source = character.source || {};
    var identity = source.identity || {};
    var stats = source.stats || {};
    var expectations = character.expectations || [];
    var expectedRows = expectations.map(function (expectation) {
      var present = hasFeature(character, expectation);
      var capability = capabilityFor(character, expectation);
      var runtimeStatus = capability ? capability.status : "missing";
      return {
        id: expectation.id || slug(expectation.label),
        label: expectation.label,
        group: expectation.group || "Feature",
        sourcePresent: present,
        sourceRequired: expectation.sourceRequired !== false,
        runtimeRequired: expectation.runtimeRequired !== false,
        runtimeStatus: runtimeStatus,
        capability: capability,
        expectedAt: expectation.expectedAt || null,
        note: expectation.note || null
      };
    });
    var unresolved = (source.inventory || []).filter(function (item) { return item && item.unresolved; });
    var equipmentRows = (character.equipmentRules || []).filter(function (rule) {
      return rule && hasFeature(character, { label: rule.feature, aliases: rule.featureAliases || [] });
    }).map(function (rule) {
      var keys = equippedWeaponKeys(character);
      var qualifies = (rule.qualifies || []).map(norm);
      var matches = keys.filter(function (key) { return qualifies.indexOf(key) >= 0; });
      return {
        id: rule.id,
        feature: rule.feature,
        label: rule.label,
        ok: matches.length > 0,
        matches: matches,
        qualifies: (rule.qualifies || []).slice(),
        detail: rule.detail || ""
      };
    });
    var resourceRows = (source.resources || []).map(function (resource) {
      var expectation = expectations.filter(function (row) {
        return norm(row.id) === norm(resource.capabilityId || resource.id);
      })[0] || { id: resource.capabilityId || resource.id, label: resource.label };
      var capability = capabilityFor(character, expectation);
      return {
        id: resource.id,
        label: resource.label,
        current: resource.current,
        max: resource.max,
        capabilityStatus: capability ? capability.status : "missing",
        actionReady: !!(capability && runtimeReady(capability.status))
      };
    });
    var attacks = (source.attacks || []).filter(function (attack) {
      return attack && attack.status !== "missing" && attack.status !== "held";
    });
    var blockers = [], warnings = [];

    if (!identity.name || !identity.key || !identity.classLine) {
      blockers.push(finding(
        "identity-incomplete", "source", "Character identity is incomplete",
        "A current key, display name, and class line are required before Forge can snapshot this character.",
        "blocked"
      ));
    }
    if (stats.hp == null || stats.maxHp == null || stats.ac == null || stats.speed == null) {
      blockers.push(finding(
        "stats-incomplete", "source", "Combat stats are incomplete",
        "HP, maximum HP, AC, and speed must resolve through the shared character authority.",
        "blocked"
      ));
    }
    if (!attacks.length) {
      blockers.push(finding(
        "attack-missing", "kit", "No executable basic attack",
        "The character cannot enter combat until at least one real weapon, spell attack, or authored basic action compiles.",
        "blocked"
      ));
    }
    unresolved.forEach(function (item) {
      warnings.push(finding(
        "choice-" + slug(item.id || item.name), "choice", "Finish: " + item.name,
        item.reason || "This starting-equipment placeholder must become one exact item before dependent feats can be checked.",
        item.blocks ? "blocked" : "attention",
        item.id
      ));
    });
    expectedRows.forEach(function (row) {
      if (row.sourceRequired && !row.sourcePresent) {
        warnings.push(finding(
          "source-" + row.id, "source", row.label + " is absent from the saved sheet",
          (row.expectedAt ? "Expected at " + row.expectedAt + ". " : "") +
            "The onboarding pass must restore or explicitly resolve the missing grant before Forge compilation.",
          "attention",
          row.id
        ));
      } else if (row.runtimeRequired && !runtimeReady(row.runtimeStatus)) {
        warnings.push(finding(
          "runtime-" + row.id, "runtime", row.label + " is not playable",
          row.capability && row.capability.reason
            ? row.capability.reason
            : "The source feature exists, but no executable or explicit manual-mode resolver owns it.",
          "attention",
          row.id
        ));
      }
    });
    equipmentRows.filter(function (row) { return !row.ok; }).forEach(function (row) {
      warnings.push(finding(
        "equipment-" + row.id, "choice", row.feature + " has no qualifying weapon",
        row.detail || ("Choose one of: " + row.qualifies.join(", ") + "."),
        "attention",
        row.id
      ));
    });
    resourceRows.filter(function (row) { return !row.actionReady; }).forEach(function (row) {
      warnings.push(finding(
        "resource-" + row.id, "runtime", row.label + " is only a counter",
        "The pool is present, but no playable capability spends it and applies the corresponding combat state.",
        "attention",
        row.id
      ));
    });

    var hardWarnings = warnings.filter(function (row) { return row.severity === "blocked"; });
    blockers = blockers.concat(hardWarnings);
    warnings = warnings.filter(function (row) { return row.severity !== "blocked"; });
    var status = blockers.length ? "blocked" : warnings.length ? "partial" : "ready";
    var runtimeCounts = { executable: 0, manual: 0, held: 0, missing: 0, reference: 0 };
    (character.capabilities || []).forEach(function (capability) {
      if (runtimeCounts[capability.status] != null) runtimeCounts[capability.status]++;
    });
    var sourceChecks = [
      {
        id: "identity",
        label: "Current character identity",
        status: identity.name && identity.key && identity.classLine ? "pass" : "fail",
        detail: identity.classLine || "Current key, name, and class are required."
      },
      {
        id: "stats",
        label: "Shared combat projection",
        status: stats.hp != null && stats.maxHp != null && stats.ac != null && stats.speed != null ? "pass" : "fail",
        detail: stats.hp != null
          ? stats.hp + " / " + stats.maxHp + " HP · AC " + stats.ac + " · " + stats.speed + " ft"
          : "HP, AC, and movement have not resolved."
      },
      {
        id: "grants",
        label: "Expected level grants",
        status: expectedRows.some(function (row) { return row.sourceRequired && !row.sourcePresent; }) ? "fail" : "pass",
        detail: expectedRows.filter(function (row) { return row.sourceRequired && row.sourcePresent; }).length +
          " of " + expectedRows.filter(function (row) { return row.sourceRequired; }).length + " present"
      },
      {
        id: "equipment",
        label: "Finished equipment choices",
        status: unresolved.length ? "warn" : "pass",
        detail: unresolved.length ? unresolved.length + " unresolved choice" + (unresolved.length === 1 ? "" : "s") : "Every combat item has an exact identity."
      },
      {
        id: "attack",
        label: "Executable basic attack",
        status: attacks.length ? "pass" : "fail",
        detail: attacks.length ? attacks.map(function (attack) { return attack.label; }).join(" · ") : "No attack compiled."
      }
    ];

    return {
      schema: SCHEMA,
      characterId: character.id || identity.key || null,
      name: character.name || identity.name || "Unnamed character",
      status: status,
      statusLabel: status === "ready" ? "Ready for Forge" : status === "partial" ? "Review required" : "Blocked",
      sourceChecks: sourceChecks,
      expectedRows: expectedRows,
      equipmentRows: equipmentRows,
      resourceRows: resourceRows,
      attacks: attacks,
      runtimeCounts: runtimeCounts,
      blockers: blockers,
      warnings: warnings,
      unresolvedCount: unresolved.length,
      missingSourceCount: expectedRows.filter(function (row) { return row.sourceRequired && !row.sourcePresent; }).length,
      runtimeGapCount: expectedRows.filter(function (row) { return row.runtimeRequired && !runtimeReady(row.runtimeStatus); }).length,
      counts: {
        sourceMissing: expectedRows.filter(function (row) { return row.sourceRequired && !row.sourcePresent; }).length,
        runtimeGaps: expectedRows.filter(function (row) { return row.runtimeRequired && !runtimeReady(row.runtimeStatus); }).length,
        unresolvedChoices: unresolved.length,
        blockers: blockers.length,
        warnings: warnings.length
      },
      canEnterTable: status === "ready",
      manualCount: runtimeCounts.manual
    };
  }

  function applyResolution(character, resolutionId) {
    var out = copy(character || {});
    var resolution = (out.resolutions || []).filter(function (row) { return row.id === resolutionId; })[0];
    if (!resolution) return out;
    var source = out.source || (out.source = {});
    source.features = source.features || [];
    source.inventory = source.inventory || [];
    source.attacks = source.attacks || [];
    out.capabilities = out.capabilities || [];

    (resolution.sourceAdditions || []).forEach(function (feature) {
      if (!feature || !feature.name) return;
      if (!source.features.some(function (row) { return norm(row && row.name || row) === norm(feature.name); })) {
        source.features.push(copy(feature));
      }
    });
    (resolution.itemReplacements || []).forEach(function (replacement) {
      var index = source.inventory.findIndex(function (item) { return item && item.id === replacement.id; });
      if (index >= 0) source.inventory[index] = copy(replacement.item);
    });
    (resolution.attackAdditions || []).forEach(function (attack) {
      if (!source.attacks.some(function (row) { return row.id === attack.id; })) source.attacks.push(copy(attack));
    });
    (resolution.capabilityUpdates || []).forEach(function (update) {
      var capability = out.capabilities.filter(function (row) { return row.id === update.id; })[0];
      if (!capability) {
        capability = { id: update.id, label: update.label || update.id };
        out.capabilities.push(capability);
      }
      Object.keys(update).forEach(function (key) {
        if (key !== "id") capability[key] = copy(update[key]);
      });
    });
    out.appliedResolutions = uniq((out.appliedResolutions || []).concat(resolutionId));
    return out;
  }
  function applyAll(character) {
    var out = copy(character || {});
    (out.resolutions || []).forEach(function (resolution) {
      out = applyResolution(out, resolution.id);
    });
    return out;
  }
  function preview(character) {
    var groups = { attacks: [], bonus: [], reactions: [], passives: [], manual: [], locked: [] };
    ((character && character.source && character.source.attacks) || []).forEach(function (attack) {
      groups.attacks.push({
        id: attack.id,
        label: attack.label,
        detail: attack.detail || "",
        status: attack.status || "executable",
        tone: attack.tone || "weapon"
      });
    });
    (character && character.capabilities || []).forEach(function (capability) {
      if (!capability.preview) return;
      var row = {
        id: capability.id,
        label: capability.label,
        detail: capability.preview.detail || capability.effects || "",
        status: capability.status,
        tone: capability.preview.tone || capability.group || "feature"
      };
      if (capability.status === "manual") groups.manual.push(row);
      else if (capability.status !== "executable") groups.locked.push(row);
      else {
        var group = capability.preview.group || "passives";
        (groups[group] || groups.passives).push(row);
      }
    });
    return groups;
  }

  function cap(id, label, status, group, reason, previewRecord) {
    return {
      id: id,
      label: label,
      status: status,
      group: group,
      reason: reason || null,
      preview: previewRecord || null
    };
  }
  function expect(id, label, group, expectedAt, runtimeRequired, aliases) {
    return {
      id: id,
      capabilityId: id,
      label: label,
      group: group,
      expectedAt: expectedAt,
      sourceRequired: true,
      runtimeRequired: runtimeRequired !== false,
      aliases: aliases || []
    };
  }
  function actor(id, name, badge, classLine, source, expectations, capabilities, equipmentRules, resolutions) {
    return {
      schema: SCHEMA,
      id: id,
      name: name,
      badge: badge,
      classLine: classLine,
      source: source,
      expectations: expectations,
      capabilities: capabilities,
      equipmentRules: equipmentRules || [],
      resolutions: resolutions || [],
      appliedResolutions: []
    };
  }

  var CHONKALIUS = actor(
    "chonkalius-a35f",
    "Chonkalius",
    "C",
    "Barbarian 4 · Path of Wild Magic · Half-Orc",
    {
      identity: {
        key: "chonkalius-a35f",
        name: "Chonkalius",
        classLine: "Barbarian 4 · Path of Wild Magic · Half-Orc"
      },
      stats: { hp: 44, maxHp: 44, ac: 12, speed: 30, initiative: 0 },
      features: [
        { name: "Rage", origin: "class" },
        { name: "Unarmored Defense", origin: "class" },
        { name: "Danger Sense", origin: "class" },
        { name: "Reckless Attack", origin: "class" },
        { name: "Primal Path", origin: "class" },
        { name: "Path of Wild Magic", origin: "subclass" },
        { name: "Polearm Master", origin: "feat" },
        { name: "Darkvision", origin: "race" },
        { name: "Menacing", origin: "race" },
        { name: "Relentless Endurance", origin: "race" },
        { name: "Savage Attacks", origin: "race" }
      ],
      inventory: [
        {
          id: "martial-choice",
          name: "any martial melee weapon (your choice)",
          unresolved: true,
          reason: "The character builder saved the option instead of the weapon Chonkalius chose."
        },
        { id: "handaxe", name: "Handaxe ×2", weaponKey: "handaxe", equipped: true },
        { id: "javelin", name: "Javelin ×4", weaponKey: "javelin", equipped: true },
        { id: "staff", name: "Staff", weaponKey: null, equipped: true }
      ],
      attacks: [
        { id: "handaxe", label: "Handaxe", detail: "+6 · 1d6+4 slashing · melee", status: "executable" },
        { id: "handaxe-thrown", label: "Handaxe (Thrown)", detail: "+6 · 1d6+4 · 20/60 ft", status: "executable" },
        { id: "javelin", label: "Javelin", detail: "+6 · 1d6+4 piercing · melee", status: "executable" },
        { id: "javelin-thrown", label: "Javelin (Thrown)", detail: "+6 · 1d6+4 · 30/120 ft", status: "executable" }
      ],
      resources: [
        { id: "rage", capabilityId: "rage", label: "Rage", current: 3, max: 3, recharge: "long rest" }
      ]
    },
    [
      expect("rage", "Rage", "Class", "Barbarian 1", true),
      expect("unarmored-defense", "Unarmored Defense", "Class", "Barbarian 1", true),
      expect("danger-sense", "Danger Sense", "Class", "Barbarian 2", true),
      expect("reckless-attack", "Reckless Attack", "Class", "Barbarian 2", true),
      expect("magic-awareness", "Magic Awareness", "Subclass", "Wild Magic 3", true),
      expect("wild-surge", "Wild Surge", "Subclass", "Wild Magic 3", true),
      expect("polearm-master", "Polearm Master", "Feat", "Level 4 feat", true),
      expect("darkvision", "Darkvision", "Species", "Half-Orc", true),
      expect("menacing", "Menacing", "Species", "Half-Orc", false),
      expect("relentless-endurance", "Relentless Endurance", "Species", "Half-Orc", true),
      expect("savage-attacks", "Savage Attacks", "Species", "Half-Orc", true)
    ],
    [
      cap("rage", "Rage", "missing", "Class", "The Rage pool exists, but there is no bonus action, Rage state, damage bonus, resistance, or duration resolver.", { group: "bonus", detail: "Bonus action · 3 / long rest", tone: "class" }),
      cap("unarmored-defense", "Unarmored Defense", "executable", "Class", null, { group: "passives", detail: "AC 12 · 10 + DEX + CON", tone: "class" }),
      cap("danger-sense", "Danger Sense", "reference", "Class", "Saving throws do not consume the visible-effect and condition gates.", { group: "passives", detail: "DEX saves vs visible effects", tone: "class" }),
      cap("reckless-attack", "Reckless Attack", "missing", "Class", "The first-attack choice and reciprocal advantage effect are not represented.", { group: "bonus", detail: "First STR melee attack choice", tone: "class" }),
      cap("magic-awareness", "Magic Awareness", "missing", "Subclass", "The expected source grant is absent from the saved sheet.", { group: "manual", detail: "Action · detect nearby magic", tone: "subclass" }),
      cap("wild-surge", "Wild Surge", "missing", "Subclass", "The expected source grant and eight-result rage table are absent.", { group: "bonus", detail: "Roll d8 when Rage begins", tone: "subclass" }),
      cap("polearm-master", "Polearm Master", "missing", "Feat", "No qualifying weapon is authored and neither feat branch has a resolver.", { group: "bonus", detail: "Bonus d4 attack · enter-reach reaction", tone: "feat" }),
      cap("darkvision", "Darkvision", "missing", "Species", "Forge visibility does not consume actor senses.", { group: "passives", detail: "Darkvision 60 ft", tone: "race" }),
      cap("menacing", "Menacing", "executable", "Species", null, { group: "passives", detail: "Intimidation proficiency already derived", tone: "race" }),
      cap("relentless-endurance", "Relentless Endurance", "missing", "Species", "The zero-HP replacement reaction and long-rest use are not represented.", { group: "reactions", detail: "Drop to 1 HP instead of 0 · 1 / long rest", tone: "race" }),
      cap("savage-attacks", "Savage Attacks", "missing", "Species", "Critical damage does not add the extra melee weapon die.", { group: "passives", detail: "One extra weapon die on melee critical", tone: "race" })
    ],
    [
      {
        id: "polearm",
        feature: "Polearm Master",
        label: "Qualifying polearm",
        qualifies: ["glaive", "halberd", "quarterstaff", "spear"],
        detail: "Polearm Master needs an exact glaive, halberd, quarterstaff, or spear—not an unresolved martial-weapon placeholder."
      }
    ],
    [
      {
        id: "restore-wild-magic",
        label: "Restore Wild Magic grants",
        summary: "Add the level-3 Magic Awareness and Wild Surge source rows from the authoritative subclass data.",
        kind: "source",
        sourceAdditions: [
          { name: "Magic Awareness", origin: "subclass" },
          { name: "Wild Surge", origin: "subclass" }
        ]
      },
      {
        id: "choose-glaive",
        label: "Choose the martial weapon",
        summary: "Resolve the saved placeholder to Chonkalius’s intended glaive so weapon and feat prerequisites become deterministic.",
        kind: "choice",
        itemReplacements: [
          { id: "martial-choice", item: { id: "glaive", name: "Glaive", weaponKey: "glaive", equipped: true } }
        ],
        attackAdditions: [
          { id: "glaive", label: "Glaive", detail: "+6 · 1d10+4 slashing · reach 10 ft", status: "executable" }
        ]
      },
      {
        id: "install-chonk-rules",
        label: "Apply the Chonkalius rules package",
        summary: "Prove the target contract for Rage, Wild Surge, Polearm Master, Barbarian choices, and Half-Orc combat traits.",
        kind: "runtime",
        capabilityUpdates: [
          { id: "rage", status: "executable", reason: null },
          { id: "danger-sense", status: "executable", reason: null },
          { id: "reckless-attack", status: "executable", reason: null },
          { id: "magic-awareness", status: "manual", reason: "Visible manual action until battlefield magic sensing has a spatial resolver." },
          { id: "wild-surge", status: "executable", reason: null },
          { id: "polearm-master", status: "executable", reason: null },
          { id: "darkvision", status: "executable", reason: null },
          { id: "relentless-endurance", status: "executable", reason: null },
          { id: "savage-attacks", status: "executable", reason: null }
        ]
      }
    ]
  );

  var CAIM = actor(
    "caim",
    "Caim",
    "C",
    "Monk 4 · Way of Mercy · Tiefling",
    {
      identity: { key: "caim", name: "Caim", classLine: "Monk 4 · Way of Mercy · Tiefling" },
      stats: { hp: 5, maxHp: 37, ac: 17, speed: 40, initiative: 4 },
      features: [
        { name: "Unarmored Defense" }, { name: "Ki" }, { name: "Flurry of Blows" },
        { name: "Patient Defense" }, { name: "Step of the Wind" }, { name: "Deflect Missiles" }
      ],
      inventory: [{ id: "shortsword", name: "Shortsword", weaponKey: "shortsword", equipped: true }],
      attacks: [{ id: "shortsword", label: "Shortsword", detail: "+6 · 1d6+4 piercing", status: "executable" }],
      resources: [{ id: "ki", capabilityId: "ki", label: "Ki", current: 4, max: 4 }]
    },
    [
      expect("unarmored-defense", "Unarmored Defense", "Class", "Monk 1", true),
      expect("ki", "Ki", "Class", "Monk 2", true),
      expect("flurry", "Flurry of Blows", "Class", "Monk 2", true),
      expect("patient", "Patient Defense", "Class", "Monk 2", true),
      expect("step", "Step of the Wind", "Class", "Monk 2", true),
      expect("deflect", "Deflect Missiles", "Class", "Monk 3", true)
    ],
    [
      cap("unarmored-defense", "Unarmored Defense", "executable", "Class", null, { group: "passives", detail: "Derived AC", tone: "class" }),
      cap("ki", "Ki", "executable", "Class", null, null),
      cap("flurry", "Flurry of Blows", "executable", "Class", null, { group: "bonus", detail: "1 Ki · two strikes", tone: "class" }),
      cap("patient", "Patient Defense", "executable", "Class", null, { group: "bonus", detail: "1 Ki · Dodge", tone: "class" }),
      cap("step", "Step of the Wind", "executable", "Class", null, { group: "bonus", detail: "1 Ki · Dash or Disengage", tone: "class" }),
      cap("deflect", "Deflect Missiles", "missing", "Class", "Incoming-hit reduction and the return-attack branch are not wired.", { group: "reactions", detail: "Reduce ranged weapon damage", tone: "class" })
    ]
  );

  var VESPERIAN = actor(
    "vesperian",
    "Vesperian Vale",
    "V",
    "Fighter 4 · Eldritch Knight · Shadar-Kai",
    {
      identity: { key: "vesperian", name: "Vesperian Vale", classLine: "Fighter 4 · Eldritch Knight · Shadar-Kai" },
      stats: { hp: 40, maxHp: 40, ac: 19, speed: 30, initiative: 4 },
      features: [
        { name: "Second Wind" }, { name: "Action Surge" }, { name: "Weapon Bond" },
        { name: "Blessing of the Raven Queen" }, { name: "Necrotic Resistance" }
      ],
      inventory: [{ id: "longsword", name: "Longsword", weaponKey: "longsword", equipped: true }],
      attacks: [{ id: "longsword", label: "Longsword", detail: "+6 · 1d8+4 slashing", status: "executable" }],
      resources: [
        { id: "second-wind", capabilityId: "second-wind", label: "Second Wind", current: 1, max: 1 },
        { id: "action-surge", capabilityId: "action-surge", label: "Action Surge", current: 1, max: 1 }
      ]
    },
    [
      expect("second-wind", "Second Wind", "Class", "Fighter 1", true),
      expect("action-surge", "Action Surge", "Class", "Fighter 2", true),
      expect("weapon-bond", "Weapon Bond", "Subclass", "Eldritch Knight 3", true),
      expect("raven-step", "Blessing of the Raven Queen", "Species", "Shadar-Kai", true),
      expect("necrotic-resistance", "Necrotic Resistance", "Species", "Shadar-Kai", true)
    ],
    [
      cap("second-wind", "Second Wind", "executable", "Class", null, { group: "bonus", detail: "1d10+4 healing", tone: "class" }),
      cap("action-surge", "Action Surge", "executable", "Class", null, { group: "bonus", detail: "Restore one action", tone: "class" }),
      cap("weapon-bond", "Weapon Bond", "missing", "Subclass", "Recall and disarm protection are not represented.", { group: "bonus", detail: "Recall bonded weapon", tone: "subclass" }),
      cap("raven-step", "Blessing of the Raven Queen", "executable", "Species", null, { group: "bonus", detail: "30-ft teleport + resistance", tone: "race" }),
      cap("necrotic-resistance", "Necrotic Resistance", "executable", "Species", null, { group: "passives", detail: "Necrotic resistance", tone: "race" })
    ]
  );

  var NEW_ARRIVAL = actor(
    "new-arrival",
    "New arrival",
    "?",
    "Draft character · onboarding incomplete",
    {
      identity: { key: null, name: "New arrival", classLine: null },
      stats: { hp: null, maxHp: null, ac: null, speed: null, initiative: null },
      features: [],
      inventory: [{ id: "weapon-choice", name: "choose a starting weapon", unresolved: true, blocks: true }],
      attacks: [],
      resources: []
    },
    [],
    []
  );

  var FIXTURES = {
    chonkalius: CHONKALIUS,
    caim: CAIM,
    vesperian: VESPERIAN,
    "new-arrival": NEW_ARRIVAL
  };

  return Object.freeze({
    SCHEMA: SCHEMA,
    RUNTIME_STATUSES: RUNTIME_STATUSES.slice(),
    READY_STATUSES: READY_STATUSES.slice(),
    FIXTURES: copy(FIXTURES),
    copy: copy,
    norm: norm,
    slug: slug,
    featureNames: featureNames,
    hasFeature: hasFeature,
    capabilityFor: capabilityFor,
    audit: audit,
    applyResolution: applyResolution,
    applyAll: applyAll,
    preview: preview
  });
});
