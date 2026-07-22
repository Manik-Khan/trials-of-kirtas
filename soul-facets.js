// soul-facets.js
// Pure character-progression helpers. A Facet is an immutable mechanical snapshot
// stored inside structural.soulFacets; Journal prose is deliberately excluded.

function copy(value, fallback) {
  if (value == null) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function classesOf(structural) {
  structural = structural || {};
  if (Array.isArray(structural.classes) && structural.classes.length) {
    return structural.classes.map(function (c) {
      return { name: c.name || c.n || 'Class', level: Number(c.level) || 1, subclass: c.subclass || null, starting: !!c.starting };
    });
  }
  var label = String(structural.classLabel || '').trim();
  if (!label) return [];
  return label.split(/\s*\/\s*/).map(function (part) {
    var m = part.match(/^(.*?)\s+(\d+)$/);
    return { name: (m && m[1]) || part, level: Number(m && m[2]) || 1, subclass: null, starting: false };
  });
}

function levelOf(structural) {
  structural = structural || {};
  var classes = classesOf(structural);
  if (classes.length) return classes.reduce(function (n, c) { return n + c.level; }, 0);
  return Number(structural.level) || 1;
}

function classSummary(structural) {
  var classes = classesOf(structural);
  return classes.length ? classes.map(function (c) { return c.name + ' ' + c.level; }).join(' / ') : 'Unbound class';
}

function mechanicalSnapshot(character) {
  character = character || {};
  var structural = copy(character.structural, {});
  delete structural.soulFacets;
  delete structural.soulLineage;
  return {
    schema: 1,
    structural: structural,
    vitals: copy(character.vitals, {}),
    inventory: copy(character.inventory, []),
    equipment: copy(character.equipment, {}),
    currency: copy(character.currency, {})
  };
}

function hashSnapshot(snapshot) {
  var text = JSON.stringify(snapshot), hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function snapshotCounts(structural) {
  structural = structural || {};
  var spellGroups = (structural.spellcasting && structural.spellcasting.groups) || [];
  var spells = spellGroups.reduce(function (n, g) { return n + ((g && g.spells) || []).length; }, 0);
  return { features: (structural.features || []).length + (structural.customFeatures || []).length, spells: spells };
}

function appendFacet(character, meta) {
  character = character || {};
  meta = meta || {};
  var structural = copy(character.structural, {});
  var store = structural.soulFacets || {};
  var items = Array.isArray(store.items) ? copy(store.items, []) : [];
  var snapshot = mechanicalSnapshot(character);
  var signature = hashSnapshot(snapshot);
  var latest = items.length ? items[items.length - 1] : null;
  if (latest && latest.signature === signature) {
    return { structural: structural, facet: latest, appended: false };
  }
  var createdAt = meta.createdAt || new Date().toISOString();
  var level = levelOf(snapshot.structural);
  var facet = {
    id: 'facet-' + level + '-' + createdAt.replace(/[^0-9]/g, '').slice(0, 14),
    level: level,
    classSummary: classSummary(snapshot.structural),
    createdAt: createdAt,
    reason: meta.reason || 'level-up',
    label: meta.label || null,
    counts: snapshotCounts(snapshot.structural),
    signature: signature,
    snapshot: snapshot
  };
  structural.soulFacets = { schema: 1, items: items.concat([facet]).slice(-40) };
  return { structural: structural, facet: facet, appended: true };
}

function facetsOf(character) {
  var store = character && character.structural && character.structural.soulFacets;
  return store && Array.isArray(store.items) ? copy(store.items, []) : [];
}

function lineageOf(character) {
  character = character || {};
  var structural = character.structural || {};
  var cfg = structural.soulLineage || {};
  var fragments = Array.isArray(cfg.fragments) ? copy(cfg.fragments, []) : [];
  var key = character.key || cfg.currentKey || 'current';
  if (!fragments.some(function (f) { return f && f.characterKey === key; })) {
    fragments.unshift({
      id: 'fragment-' + key,
      characterKey: key,
      name: structural.name || character.name || key,
      campaign: cfg.currentCampaign || 'Trials of Kirtas',
      status: 'active',
      current: true
    });
  }
  fragments.forEach(function (f) { f.current = f.characterKey === key || !!f.current; });
  return {
    name: cfg.name || 'Greater Soul',
    fragments: fragments,
    refractions: Array.isArray(cfg.refractions) ? copy(cfg.refractions, []) : []
  };
}

var SoulFacets = { classesOf: classesOf, levelOf: levelOf, classSummary: classSummary, mechanicalSnapshot: mechanicalSnapshot, appendFacet: appendFacet, facetsOf: facetsOf, lineageOf: lineageOf };
if (typeof window !== 'undefined') window.SoulFacets = SoulFacets;
if (typeof module !== 'undefined' && module.exports) module.exports = SoulFacets;

export { classesOf, levelOf, classSummary, mechanicalSnapshot, appendFacet, facetsOf, lineageOf };
