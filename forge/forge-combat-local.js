/* forge-combat-local.js
   Guarded local-fight seam for Forge Combat. Real character rows are projected
   onto the accepted Blueprint field; combat state never mutates the Blueprint. */
(function (root, factory) {
  var Deploy = typeof module !== "undefined" && module.exports ? require("./forge-deployment.js") : root.ForgeDeployment;
  var TG = typeof module !== "undefined" && module.exports ? require("./tactics-geometry.js") : root.TacticsGeo;
  var Combat = typeof module !== "undefined" && module.exports ? require("./forge-combat-rules.js") : root.ForgeCombatRules;
  var CharacterCombat = typeof module !== "undefined" && module.exports ? require("../character-combat.js") : root.CharacterCombat;
  var api = factory(Deploy, TG, Combat, CharacterCombat);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeCombatLocal = api;
})(typeof window !== "undefined" ? window : globalThis, function (Deploy, TG, Combat, CharacterCombat) {
  "use strict";

  var VERSION = 1;
  var TRAINING_FOES = Object.freeze([
    Object.freeze({ unit: "reliquary-guard-1", name: "Reliquary Guard 1", side: "foe", hp: 14, hpMax: 14, ac: 13, speed: 30, initMod: 2,
      action: Object.freeze({ id: "guard-spear", kind: "attack", label: "Spear", rng: 1, hit: 4, dmg: "1d6+2", damage: 5 }) }),
    Object.freeze({ unit: "reliquary-guard-2", name: "Reliquary Guard 2", side: "foe", hp: 14, hpMax: 14, ac: 13, speed: 30, initMod: 1,
      action: Object.freeze({ id: "guard-spear", kind: "attack", label: "Spear", rng: 1, hit: 4, dmg: "1d6+2", damage: 5 }) }),
    Object.freeze({ unit: "reliquary-guard-3", name: "Reliquary Guard 3", side: "foe", hp: 14, hpMax: 14, ac: 13, speed: 30, initMod: 0,
      action: Object.freeze({ id: "guard-spear", kind: "attack", label: "Spear", rng: 1, hit: 4, dmg: "1d6+2", damage: 5 }) })
  ]);

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function key(c, r) { return c + "," + r; }
  function hash32(value) {
    var text = String(value), hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function finite(value, fallback) { value = Number(value); return Number.isFinite(value) ? value : fallback; }
  function damageExpression(action) {
    var dice = String(action && action.dmgDice || "").trim(), mod = finite(action && action.dmgMod, 0);
    if (!/^\d+d\d+$/i.test(dice)) return "";
    return dice + (mod > 0 ? "+" + mod : mod < 0 ? String(mod) : "");
  }
  function averageDamage(expression) {
    var total = 0;
    String(expression || "").replace(/([+-]?\s*\d+d\d+|[+-]?\s*\d+)/gi, function (part) {
      var sign = /^\s*-/.test(part) ? -1 : 1, clean = part.replace(/[+\-\s]/g, ""), dice = clean.match(/^(\d+)d(\d+)$/i);
      total += sign * (dice ? Number(dice[1]) * (Number(dice[2]) + 1) / 2 : Number(clean));
      return part;
    });
    return Math.max(1, Math.floor(total));
  }
  function rangeFromText(value) {
    var match = String(value || "").match(/(\d+)\s*(?:ft|feet|foot)/i);
    return match ? Math.max(1, Math.floor(Number(match[1]) / 5)) : 0;
  }
  function actionRange(action) {
    var explicit = finite(action && (action.rng != null ? action.rng : action.rangeSquares), 0);
    if (explicit > 0) return explicit;
    var textRange = rangeFromText(action && (action.range || action.note));
    if (textRange) return textRange;
    var label = String(action && action.label || "").toLowerCase();
    if (/eldritch blast|fire bolt/.test(label)) return 24;
    if (/ray of frost|vicious mockery|sacred flame/.test(label)) return 12;
    if (/shortbow|longbow|light crossbow/.test(label)) return 16;
    if (/sling/.test(label)) return 6;
    if (/dagger|dart|handaxe|javelin/.test(label)) return 4;
    if (/booming blade|green-flame blade/.test(label)) return 1;
    return action && action.type === "attack-cantrip" ? 12 : 1;
  }
  function basicAction(row) {
    var actions = row && row.structural && Array.isArray(row.structural.actions) ? row.structural.actions : [];
    var candidates = actions.filter(function (action) {
      return action && (action.type === "attack" || action.type === "attack-cantrip") && Number.isFinite(Number(action.hitMod)) && damageExpression(action);
    }).map(function (action) {
      var dmg = damageExpression(action);
      return {
        id: String(action.id || action.label || "basic-attack"), kind: "attack", label: String(action.label || "Attack"),
        rng: actionRange(action), hit: Number(action.hitMod), dmg: dmg, damage: averageDamage(dmg), damageType: String(action.dmgType || "")
      };
    });
    candidates.sort(function (a, b) { return b.rng - a.rng; });
    return candidates[0] || null;
  }
  function projectCharacter(row, suppliedCharacterCombat) {
    var projector = suppliedCharacterCombat || CharacterCombat;
    if (!row || !row.key) return { ok: false, key: "", name: "Unknown character", reason: "Character identity is missing." };
    var name = String(row.name || row.structural && row.structural.name || row.key);
    if (!row.structural || !row.structural.combat) return { ok: false, key: row.key, name: name, reason: "No combat sheet is available." };
    var action = basicAction(row);
    if (!action) return { ok: false, key: row.key, name: name, reason: "No usable attack is recorded on the combat sheet." };
    try {
      if (!projector || typeof projector.derive !== "function") throw new Error("Shared character combat projection is unavailable.");
      var facts = projector.derive(row);
      return { ok: true, key: row.key, name: name, unit: {
        unit: row.key, name: name, side: "pc", hp: facts.hp, hpMax: facts.maxHp, ac: facts.ac,
        speed: facts.speed, initMod: facts.init, fly: facts.fly, climb: facts.climb, action: action,
        sourceUpdatedAt: facts.sourceUpdatedAt, source: facts.source
      } };
    } catch (error) {
      return { ok: false, key: row.key, name: name, reason: error && error.message || "Combat values could not be derived." };
    }
  }
  function placementComponents(map) {
    var blocked = Deploy.deploymentBlocked(map), unseen = {}, components = [], c, r;
    for (r = 0; r < map.rows; r++) for (c = 0; c < map.cols; c++) {
      if (!map.wall[r * map.cols + c] && !blocked[key(c, r)]) unseen[key(c, r)] = { c: c, r: r };
    }
    while (Object.keys(unseen).length) {
      var firstKey = Object.keys(unseen)[0], queue = [unseen[firstKey]], cells = []; delete unseen[firstKey];
      while (queue.length) {
        var at = queue.shift(); cells.push(at);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (step) {
          var nextKey = key(at.c + step[0], at.r + step[1]);
          if (!unseen[nextKey]) return;
          queue.push(unseen[nextKey]); delete unseen[nextKey];
        });
      }
      components.push(cells);
    }
    return components.sort(function (a, b) { return b.length - a.length; });
  }
  function defaultAnchors(map, count) {
    var component = placementComponents(map)[0] || [];
    if (component.length < count) return null;
    var sorted = component.slice().sort(function (a, b) { return a.c + a.r - b.c - b.r; });
    return { party: sorted[Math.floor(sorted.length * 0.08)] || sorted[0], enemy: sorted[Math.floor(sorted.length * 0.88)] || sorted[sorted.length - 1] };
  }
  function deployCombatants(map, party, foes, authoredGroups) {
    party = party || []; foes = foes || copy(TRAINING_FOES);
    var anchors = defaultAnchors(map, party.length + foes.length);
    if (!anchors) return { ok: false, errors: ["The map has too little connected open ground for these combatants."] };
    var groups = Array.isArray(authoredGroups) ? copy(authoredGroups) : [];
    var partySource = groups.find(function (group) { return group.id === "party-main" || group.role === "party"; }) || {};
    var enemySource = groups.find(function (group) { return group.id === "enemy-main" || group.role === "enemy"; }) || {};
    groups = [
      { id: partySource.id || "party-main", label: partySource.label || "Main Party", role: "party", controllerPolicy: "unit-owners",
        unitIds: party.map(function (unit) { return unit.unit; }), anchor: partySource.anchor || anchors.party,
        formationSeed: finite(partySource.formationSeed != null ? partySource.formationSeed : partySource.seed, 41) },
      { id: enemySource.id || "enemy-main", label: enemySource.label || "Reliquary Guard", role: "enemy", controllerPolicy: "overseer",
        unitIds: foes.map(function (unit) { return unit.unit; }), anchor: enemySource.anchor || anchors.enemy,
        formationSeed: finite(enemySource.formationSeed != null ? enemySource.formationSeed : enemySource.seed, 97) }
    ];
    var draft = Deploy.planDraft(map, groups), record = Deploy.deploymentRecord(groups, draft);
    return { ok: draft.ok, draft: draft, record: record, groups: groups, errors: draft.errors || [] };
  }
  function createFight(map, deployment, party, foes, identity) {
    if (!deployment || !deployment.record || !deployment.record.resolved) throw new Error("Resolved deployment is required.");
    party = party || []; foes = foes || copy(TRAINING_FOES);
    var definitions = party.concat(foes), byId = {}, roster = definitions.map(function (unit) {
      byId[unit.unit] = unit;
      return { unit: unit.unit, name: unit.name, kind: unit.side === "foe" ? "foe" : "pc" };
    });
    var units = Deploy.applyToRoster(roster, deployment.record).map(function (row) {
      var source = byId[row.unit], initiative = 1 + hash32(row.unit + "|initiative") % 20 + finite(source.initMod, 0);
      return Object.assign(copy(source), { c: row.pos.c, r: row.pos.r, initiative: initiative, alive: true, moved: false, acted: false });
    }).sort(function (a, b) { return b.initiative - a.initiative || finite(b.initMod, 0) - finite(a.initMod, 0); });
    return { version: VERSION, localOnly: true, identity: copy(identity || {}), map: copy(map), units: units, turn: 0, round: 1, eventIndex: 0,
      log: ["Initiative: " + units.map(function (unit) { return unit.name + " " + unit.initiative; }).join(" · ")] };
  }
  function activeUnit(fight) { return fight && fight.units.length ? fight.units[fight.turn % fight.units.length] : null; }
  function occupied(fight, except) {
    return new Set(fight.units.filter(function (unit) { return unit.alive && unit.unit !== except; }).map(function (unit) { return key(unit.c, unit.r); }));
  }
  function reachableForActive(fight) {
    var active = activeUnit(fight);
    return active && active.alive && !active.moved
      ? TG.movementReach(fight.map, active, occupied(fight, active.unit), Math.floor(finite(active.speed, 30) / 5)) : {};
  }
  function moveActive(fight, c, r) {
    var next = copy(fight), active = activeUnit(next), reachable = reachableForActive(next), destination = reachable[key(c, r)];
    if (!active || active.moved || !destination) return { ok: false, fight: fight, message: active && active.moved ? "This combatant has already moved this turn." : "That square is not reachable this turn." };
    var path = TG.pathTo(reachable, active, c, r), cost = finite(destination.d, path.length) * 5;
    active.c = c; active.r = r; active.moved = true;
    next.log.push(active.name + " moved " + cost + " ft to " + key(c, r) + ".");
    return { ok: true, fight: next, path: path, message: next.log[next.log.length - 1] };
  }
  function resolveAttack(fight, targetId) {
    var next = copy(fight), attacker = activeUnit(next), target = next.units.find(function (unit) { return unit.unit === targetId; });
    if (!attacker || !target || !target.alive || attacker.side === target.side || attacker.acted) return { ok: false, fight: fight, message: "Choose a living opponent for the active combatant." };
    var action = attacker.action;
    if (!action || !Combat.requireDamage(action).ok) return { ok: false, fight: fight, message: attacker.name + " has no usable attack." };
    var rangeFt = finite(action.rng, 1) * 5, distanceFt = TG.range3d(next.map, attacker, target);
    if (!TG.inRange(next.map, attacker, target, rangeFt)) return { ok: false, fight: fight, message: target.name + " is beyond " + action.label + "’s " + rangeFt + "-ft range." };
    var sight = TG.losVerdict(next.map, attacker, target);
    if (!sight.canTarget) return { ok: false, fight: fight, message: target.name + " has total cover." };
    var hostileAdjacent = next.units.some(function (unit) { return unit.alive && unit.side !== attacker.side && TG.chebyshev(attacker, unit) <= 1; });
    var sources = Combat.attackRollSources({ attacker: attacker, target: target, action: action, distanceFt: distanceFt, hostileAdjacent: hostileAdjacent, flankingMode: "advantage", flanked: false });
    var first = 1 + hash32(attacker.unit + "|" + target.unit + "|" + next.eventIndex + "|a") % 20;
    var second = 1 + hash32(attacker.unit + "|" + target.unit + "|" + next.eventIndex + "|b") % 20;
    var die = sources.advantage ? Math.max(first, second) : sources.disadvantage ? Math.min(first, second) : first;
    var total = die + finite(action.hit, 0) + finite(sources.attackBonus, 0), defense = target.ac + (Number.isFinite(sight.acBonus) ? sight.acBonus : 0);
    var hit = die === 20 || die !== 1 && total >= defense, damage = hit ? action.damage * (die === 20 ? 2 : 1) : 0;
    target.hp = Math.max(0, target.hp - damage); target.alive = target.hp > 0; attacker.acted = true; next.eventIndex++;
    var message = attacker.name + " used " + action.label + ": " + die + " + " + action.hit + " vs AC " + defense
      + (hit ? " — " + damage + " damage to " + target.name + "." : " — miss.") + (sight.cover === "none" ? "" : " Cover: " + sight.cover + ".");
    next.log.push(message);
    return { ok: true, fight: next, hit: hit, damage: damage, sight: sight, sources: sources, message: message };
  }
  function endTurn(fight) {
    var next = copy(fight), prior = activeUnit(next), guard = 0;
    if (!next.units.some(function (unit) { return unit.alive && unit.side === "pc"; }) || !next.units.some(function (unit) { return unit.alive && unit.side === "foe"; })) return next;
    do {
      next.turn = (next.turn + 1) % next.units.length;
      if (next.turn === 0) next.round++;
      guard++;
    } while (!activeUnit(next).alive && guard <= next.units.length);
    var active = activeUnit(next); active.moved = false; active.acted = false;
    next.log.push((prior ? prior.name + " ended the turn. " : "") + "Round " + next.round + ": " + active.name + " is active.");
    return next;
  }
  function spawns(fight) {
    return (fight && fight.units || []).filter(function (unit) { return unit.alive; }).map(function (unit) {
      return { c: unit.c, r: unit.r, side: unit.side, key: unit.unit };
    });
  }

  return Object.freeze({
    VERSION: VERSION, TRAINING_FOES: TRAINING_FOES, damageExpression: damageExpression, averageDamage: averageDamage,
    actionRange: actionRange, basicAction: basicAction, projectCharacter: projectCharacter, placementComponents: placementComponents,
    deployCombatants: deployCombatants, createFight: createFight, activeUnit: activeUnit, reachableForActive: reachableForActive,
    moveActive: moveActive, resolveAttack: resolveAttack, endTurn: endTurn, spawns: spawns
  });
});
