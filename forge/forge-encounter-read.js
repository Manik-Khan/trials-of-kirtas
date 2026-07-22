/* Forge Encounter Read authority · version 1
   Pure encounter arithmetic and roster-derived creature relationships.
   The Workshop owns presentation; this module owns the repeatable facts. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeEncounterRead = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = 1;
  var LEVEL_THRESHOLDS = [
    null,
    [25,50,75,100],[50,100,150,200],[75,150,225,400],[125,250,375,500],
    [250,500,750,1100],[300,600,900,1400],[350,750,1100,1700],[450,900,1400,2100],
    [550,1100,1600,2400],[600,1200,1900,2800],[800,1600,2400,3600],
    [1000,2000,3000,4500],[1100,2200,3400,5100],[1250,2500,3800,5700],
    [1400,2800,4300,6400],[1600,3200,4800,7200],[2000,3900,5900,8800],
    [2100,4200,6300,9500],[2400,4900,7300,10900],[2800,5700,8500,12700]
  ];
  var XP_BY_CR = Object.freeze({
    "0":10,"0.125":25,"0.25":50,"0.5":100,"1":200,"2":450,"3":700,"4":1100,
    "5":1800,"6":2300,"7":2900,"8":3900,"9":5000,"10":5900,"11":7200,"12":8400,
    "13":10000,"14":11500,"15":13000,"16":15000,"17":18000,"18":20000,"19":22000,
    "20":25000,"21":33000,"22":41000,"23":50000,"24":62000,"25":75000,"26":90000,
    "27":105000,"28":120000,"29":135000,"30":155000
  });
  var RELATION_PATTERNS = [
    { key:"goblinoid", re:/goblin|hobgoblin|bugbear|nilbog|barghest|worg/i },
    { key:"orc", re:/\borc\b|orog|tanarukk|worg|ogre/i },
    { key:"kobold", re:/kobold/i },
    { key:"gnoll", re:/gnoll|hyena/i },
    { key:"drow", re:/\bdrow\b|drider/i },
    { key:"duergar", re:/duergar/i },
    { key:"yuan-ti", re:/yuan[- ]ti/i },
    { key:"undead", re:/skeleton|zombie|wight|wraith|ghoul|vampire|lich|mummy/i }
  ];

  function number(value, fallback) { value = Number(value); return Number.isFinite(value) ? value : fallback; }
  function round(value) { return Math.round(value * 100) / 100; }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function unique(values) { return values.filter(function (value, index) { return value && values.indexOf(value) === index; }); }

  function levelOf(row) {
    row = row || {}; var structural = row.structural || row;
    var direct = number(row.level, NaN); if (!Number.isFinite(direct)) direct = number(structural.level, NaN);
    if (Number.isFinite(direct) && direct > 0) return Math.max(1, Math.min(20, Math.floor(direct)));
    var classes = structural.classes || row.classes;
    if (Array.isArray(classes) && classes.length) {
      var total = classes.reduce(function (sum, cls) { return sum + Math.max(0, number(cls && cls.level, 0)); }, 0);
      if (total) return Math.max(1, Math.min(20, Math.floor(total)));
    }
    var matches = text(structural.classLabel || row.classLabel).match(/\b(\d{1,2})\b/g) || [];
    var parsed = matches.reduce(function (sum, value) { return sum + number(value, 0); }, 0);
    return parsed ? Math.max(1, Math.min(20, Math.floor(parsed))) : null;
  }

  function crNumber(raw) {
    if (raw && typeof raw === "object") raw = raw.cr != null ? raw.cr : raw.value;
    if (typeof raw === "number") return raw >= 0 ? raw : null;
    var value = text(raw); if (!value || value === "—") return null;
    var fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(value);
    if (fraction) return number(fraction[1], 0) / Math.max(1, number(fraction[2], 1));
    var parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  function crLabel(raw) {
    var cr = crNumber(raw); if (cr == null) return "—";
    if (cr === 0.125) return "1/8"; if (cr === 0.25) return "1/4"; if (cr === 0.5) return "1/2";
    return String(cr);
  }
  function xpForCr(raw) { var cr = crNumber(raw); return cr == null ? null : (XP_BY_CR[String(cr)] == null ? null : XP_BY_CR[String(cr)]); }

  function partyThresholds(party) {
    var totals = [0,0,0,0], levels = [];
    (party || []).forEach(function (row) {
      var level = levelOf(row); if (!level) return; levels.push(level);
      LEVEL_THRESHOLDS[level].forEach(function (value, index) { totals[index] += value; });
    });
    return { easy:totals[0], medium:totals[1], hard:totals[2], deadly:totals[3], levels:levels };
  }
  function crBenchmark(party) {
    var levels = partyThresholds(party).levels;
    return round(levels.reduce(function (sum, level) { return sum + level / (level < 5 ? 4 : 2); }, 0));
  }
  function singleMonsterBenchmark(party) {
    var levels = partyThresholds(party).levels; if (!levels.length) return 0;
    var average = levels.reduce(function (sum, level) { return sum + level; }, 0) / levels.length;
    return round(average < 5 ? average : average * 1.5);
  }
  function encounterMultiplier(monsterCount, partyCount) {
    var index = monsterCount <= 1 ? 0 : monsterCount === 2 ? 1 : monsterCount <= 6 ? 2 : monsterCount <= 10 ? 3 : monsterCount <= 14 ? 4 : 5;
    if (partyCount > 0 && partyCount < 3) index = Math.min(5, index + 1);
    else if (partyCount > 5) index = Math.max(0, index - 1);
    return [1,1.5,2,2.5,3,4][index];
  }
  function difficultyFor(adjustedXp, thresholds) {
    if (!adjustedXp) return "None";
    if (adjustedXp >= thresholds.deadly) return "Deadly";
    if (adjustedXp >= thresholds.hard) return "Hard";
    if (adjustedXp >= thresholds.medium) return "Medium";
    if (adjustedXp >= thresholds.easy) return "Easy";
    return "Below easy";
  }
  function enemyCr(row) { return crNumber(row && (row.cr != null ? row.cr : row.statblock && row.statblock.cr)); }
  function sideRead(rows, thresholds, partyCount) {
    var known = [], unknown = [];
    (rows || []).forEach(function (row) { var cr = enemyCr(row), xp = xpForCr(cr); if (cr == null || xp == null) unknown.push(row); else known.push({row:row,cr:cr,xp:xp}); });
    var baseXp = known.reduce(function (sum, entry) { return sum + entry.xp; }, 0);
    var multiplier = encounterMultiplier((rows || []).length, partyCount), adjustedXp = Math.round(baseXp * multiplier);
    return {
      count:(rows || []).length, knownCount:known.length, unknownCount:unknown.length,
      totalCr:round(known.reduce(function (sum, entry) { return sum + entry.cr; }, 0)),
      highestCr:round(known.reduce(function (highest, entry) { return Math.max(highest, entry.cr); }, 0)),
      baseXp:baseXp, multiplier:multiplier, adjustedXp:adjustedXp,
      difficulty:difficultyFor(adjustedXp, thresholds), unknown:unknown.slice()
    };
  }
  function elevationAt(map, row) {
    var pos = row && row.pos; if (!map || !pos || !Array.isArray(map.h) || !map.cols) return null;
    var index = Number(pos.r) * Number(map.cols) + Number(pos.c), value = Number(map.h[index]);
    return Number.isFinite(value) ? value : null;
  }
  function averageElevation(map, rows) {
    var values = (rows || []).map(function (row) { return elevationAt(map, row); }).filter(function (value) { return value != null; });
    return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : null;
  }
  function hpReadiness(party) {
    var ratios = (party || []).map(function (row) { var hp=number(row.currentHp,NaN),max=number(row.maxHp,NaN);return Number.isFinite(hp)&&max>0?Math.max(0,hp/max):null; }).filter(function (value) { return value != null; });
    if (!ratios.length) return null; var average = ratios.reduce(function (sum, value) { return sum + value; }, 0) / ratios.length;
    return { ratio:average, label:average < .5 ? "depleted" : average < .8 ? "worn" : "fresh" };
  }
  function contextWarnings(party, enemies, opening, full, map) {
    var out = [], partyCount = (party || []).length;
    if (opening.count > partyCount) out.push({tone:"harder",key:"actions",title:"Enemies win the opening action count",copy:opening.count+" active enemy turns against "+partyCount+" party turns."});
    if (full.count > opening.count) out.push({tone:"easier",key:"waves",title:(full.count-opening.count)+" enemies begin outside the opening wave",copy:"Encounter Regions holds their initiative seats until their authored activation."});
    var readiness = hpReadiness(party);
    if (readiness && readiness.label === "fresh") out.push({tone:"easier",key:"fresh",title:"The party begins near full health",copy:"Current party hit points average "+Math.round(readiness.ratio*100)+"% of maximum."});
    if (readiness && readiness.label !== "fresh") out.push({tone:"harder",key:"worn",title:readiness.label === "depleted" ? "The party is badly depleted" : "The party is worn down",copy:"Current party hit points average "+Math.round(readiness.ratio*100)+"% of maximum."});
    var partyElevation = averageElevation(map, party), enemyElevation = averageElevation(map, enemies);
    if (partyElevation != null && enemyElevation != null && enemyElevation-partyElevation >= 5) out.push({tone:"harder",key:"elevation",title:"Enemies begin above the party",copy:"Enemy deployment averages "+Math.round(enemyElevation-partyElevation)+" feet higher."});
    if (partyElevation != null && enemyElevation != null && partyElevation-enemyElevation >= 5) out.push({tone:"easier",key:"elevation",title:"The party begins above the enemies",copy:"Party deployment averages "+Math.round(partyElevation-enemyElevation)+" feet higher."});
    if (full.unknownCount) out.push({tone:"neutral",key:"unknown",title:full.unknownCount+" creature CR "+(full.unknownCount===1?"is":"are")+" unknown",copy:"The numerical read excludes those creatures until their stat blocks provide CR."});
    return out;
  }
  function analyze(input) {
    input = input || {}; var party = (input.party || []).filter(function (row) { return !!levelOf(row); }), enemies = input.enemies || [];
    var thresholds = partyThresholds(party), active = enemies.filter(function (row) { return row.active !== false; });
    var opening = sideRead(active, thresholds, party.length), full = sideRead(enemies, thresholds, party.length);
    return {
      version:VERSION, party:{count:party.length,totalLevels:thresholds.levels.reduce(function(sum,level){return sum+level;},0),levels:thresholds.levels,thresholds:thresholds,crBenchmark:crBenchmark(party),singleMonsterBenchmark:singleMonsterBenchmark(party)},
      opening:opening, full:full, warnings:contextWarnings(party,enemies,opening,full,input.map)
    };
  }

  function typeTags(raw) {
    raw = raw && (raw.statblock || raw.raw || raw) || {}; var type = raw.type, tags=[];
    if (type && typeof type === "object") tags = type.tags || [];
    return tags.map(function (tag) { return text(typeof tag === "string" ? tag : tag && (tag.tag || tag.prefix)); }).filter(Boolean).map(function (tag) { return tag.toLowerCase(); });
  }
  function relationKeys(creature) {
    var raw = creature && (creature.statblock || creature.raw || creature) || {}, name = text(creature && creature.name || raw.name).toLowerCase();
    var keys = typeTags(raw).filter(function (tag) { return tag !== "human"; });
    RELATION_PATTERNS.forEach(function (entry) { if (entry.re.test(name)) keys.push(entry.key); });
    return unique(keys);
  }
  function relatedCreatures(selected, catalogue, options) {
    options = options || {}; var selectedNames = (selected || []).map(function (row) { return text(row.name || row.statblock && row.statblock.name).toLowerCase(); }).filter(Boolean);
    var sourceKeys = unique([].concat.apply([], (selected || []).map(relationKeys)));
    var rows = (catalogue || []).map(function (entry) {
      var raw = entry.raw || entry.statblock || entry, name = text(entry.name || raw.name), keys = relationKeys({name:name,raw:raw});
      var shared = keys.filter(function (key) { return sourceKeys.indexOf(key) >= 0; });
      return {name:name,raw:raw,cr:crNumber(raw.cr),crLabel:crLabel(raw.cr),xp:xpForCr(raw.cr),relatedKeys:shared,score:shared.length};
    }).filter(function (entry) { return entry.name && selectedNames.indexOf(entry.name.toLowerCase()) < 0 && entry.score > 0 && entry.cr != null; });
    rows.sort(function (a,b) { return b.score-a.score || a.cr-b.cr || a.name.localeCompare(b.name); });
    return rows.slice(0, Math.max(1, number(options.limit, 24)));
  }
  function impactWithCreature(side, partyCount, rawCr) {
    var xp = xpForCr(rawCr); if (xp == null) return null;
    var baseXp = number(side && side.baseXp, 0) + xp, count = number(side && side.count, 0) + 1;
    var adjustedXp = Math.round(baseXp * encounterMultiplier(count, partyCount));
    return {baseXp:baseXp,count:count,adjustedXp:adjustedXp};
  }

  return Object.freeze({
    VERSION:VERSION, LEVEL_THRESHOLDS:LEVEL_THRESHOLDS, XP_BY_CR:XP_BY_CR,
    levelOf:levelOf, crNumber:crNumber, crLabel:crLabel, xpForCr:xpForCr,
    partyThresholds:partyThresholds, crBenchmark:crBenchmark, singleMonsterBenchmark:singleMonsterBenchmark,
    encounterMultiplier:encounterMultiplier, difficultyFor:difficultyFor, sideRead:sideRead, analyze:analyze,
    relationKeys:relationKeys, relatedCreatures:relatedCreatures, impactWithCreature:impactWithCreature
  });
});
