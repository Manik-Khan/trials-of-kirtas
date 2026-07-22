// sheet-corrections.js
// Durable, player-authored exceptions for character-sheet automation.
//
// The Forge owns generated fields such as structural.features/spellcasting. Manual
// additions and suppressions live beside those fields in structural.corrections, so
// a reforge's top-level merge preserves them. The render layer applies corrections
// to a clone; it never rewrites generated data. History is append-only.

function clone(x) { return JSON.parse(JSON.stringify(x == null ? {} : x)); }
function normName(x) { return String(x == null ? '' : x).trim().toLowerCase(); }

export function correctionLedger(structural) {
  var raw = structural && structural.corrections;
  return {
    version: 2,
    active: Array.isArray(raw && raw.active) ? raw.active.slice() : [],
    history: Array.isArray(raw && raw.history) ? raw.history.slice() : []
  };
}

export function correctionSummary(structural) {
  var ledger = correctionLedger(structural), active = ledger.active.filter(Boolean);
  return {
    active: active.length,
    unreviewed: active.filter(function (c) { return c.status === 'unreviewed'; }).length,
    confirmed: active.filter(function (c) { return c.status === 'confirmed'; }).length,
    history: ledger.history.length
  };
}

function correctionAction(c) { return (c && c.action) || 'add'; }
function sameTarget(c, kind, action, name, source) {
  if (!c || c.kind !== kind || correctionAction(c) !== action || normName(c.name) !== normName(name)) return false;
  return !source || !c.source || normName(c.source) === normName(source);
}

function pushCorrection(structural, correction, eventKind, detail) {
  var ledger = correctionLedger(structural);
  if (ledger.active.some(function (c) { return sameTarget(c, correction.kind, correction.action, correction.name, correction.source); })) return structural;
  ledger.active.push(correction);
  ledger.history.push(historyEvent(eventKind, correction, detail, correction.createdAt));
  structural.corrections = ledger;
  return structural;
}

function historyEvent(kind, correction, detail, at) {
  return {
    id: 'ev_' + Math.random().toString(36).slice(2, 9),
    kind: kind,
    correctionId: correction.id,
    subject: correction.name,
    actor: correction.actor || 'Character editor',
    detail: detail || '',
    at: at || new Date().toISOString()
  };
}

export function addSpellCorrection(structural, input, at) {
  structural = clone(structural || {}); input = input || {};
  var ledger = correctionLedger(structural), name = String(input.name || '').trim();
  if (!name) return structural;
  var existing = ledger.active.filter(function (c) { return c && c.kind === 'spell' && normName(c.name) === normName(name); })[0];
  if (existing) return structural;
  var correction = {
    id: 'corr_' + Math.random().toString(36).slice(2, 9),
    kind: 'spell',
    action: 'add',
    name: name,
    level: Math.max(0, Math.min(9, parseInt(input.level, 10) || 0)),
    source: String(input.source || 'Manual').trim() || 'Manual',
    reason: String(input.reason || 'Other').trim() || 'Other',
    note: String(input.note || '').trim(),
    actor: String(input.actor || 'Character editor').trim() || 'Character editor',
    status: input.status === 'confirmed' ? 'confirmed' : 'unreviewed',
    validator: clone(input.validator || { result: 'unverified', sources: [] }),
    spell: clone(input.spell || {}),
    createdAt: at || new Date().toISOString()
  };
  return pushCorrection(structural, correction, 'added',
    'Before: absent. After: active manual spell. Reason: ' + correction.reason + (correction.note ? '. Note: ' + correction.note : ''));
}

export function addFeatureCorrection(structural, input, at) {
  structural = clone(structural || {}); input = input || {};
  var name = String(input.name || '').trim(); if (!name) return structural;
  var correction = {
    id: 'corr_' + Math.random().toString(36).slice(2, 9),
    kind: 'feature', action: 'add', name: name,
    source: String(input.source || 'Manual').trim() || 'Manual',
    desc: String(input.desc || '').trim(), reason: String(input.reason || 'Other').trim() || 'Other',
    note: String(input.note || '').trim(), actor: String(input.actor || 'Character editor').trim() || 'Character editor',
    status: input.status === 'confirmed' ? 'confirmed' : 'unreviewed',
    validator: clone(input.validator || { result: 'unverified', sources: [] }),
    createdAt: at || new Date().toISOString()
  };
  return pushCorrection(structural, correction, 'added',
    'Before: absent. After: active manual feature. Reason: ' + correction.reason + (correction.note ? '. Note: ' + correction.note : ''));
}

export function addSuppressionCorrection(structural, input, at) {
  structural = clone(structural || {}); input = input || {};
  var kind = input.kind === 'feature' ? 'feature' : 'spell', name = String(input.name || '').trim();
  if (!name) return structural;
  var correction = {
    id: 'corr_' + Math.random().toString(36).slice(2, 9),
    kind: kind, action: 'suppress', name: name,
    source: String(input.source || '').trim(), reason: String(input.reason || 'Other').trim() || 'Other',
    note: String(input.note || '').trim(), actor: String(input.actor || 'Character editor').trim() || 'Character editor',
    status: 'confirmed',
    validator: clone(input.validator || { result: 'generated', rulesVersion: 'Saved character build' }),
    createdAt: at || new Date().toISOString()
  };
  return pushCorrection(structural, correction, 'suppressed',
    'Before: generated ' + kind + ' visible. After: hidden from the sheet. Reason: ' + correction.reason + (correction.note ? '. Note: ' + correction.note : ''));
}

export function closeCorrection(structural, id, kind, detail, at) {
  structural = clone(structural || {});
  var ledger = correctionLedger(structural), found = null;
  ledger.active = ledger.active.filter(function (c) { if (c && c.id === id) { found = c; return false; } return true; });
  if (found) ledger.history.push(historyEvent(kind || 'removed', found, detail || (kind === 'resolved' ? 'Converted to generated data.' : (kind === 'restored' ? 'Generated entry restored to the sheet.' : 'Manual correction removed.')), at));
  structural.corrections = ledger;
  return structural;
}

export function classNamesOf(structural) {
  structural = structural || {};
  var names = [];
  (structural.classes || []).forEach(function (c) { if (c && c.name && names.indexOf(c.name) < 0) names.push(c.name); });
  if (!names.length) String(structural.classLabel || '').split('/').forEach(function (part) {
    var m = String(part).trim().match(/^(.+?)\s+\d+$/); var n = m ? m[1].trim() : String(part).trim();
    if (n && names.indexOf(n) < 0) names.push(n);
  });
  return names;
}

export function spellExists(spellcasting, name) {
  var want = normName(name), found = false;
  ((spellcasting && spellcasting.groups) || []).forEach(function (g) {
    (g.spells || []).forEach(function (sp) { if (normName(sp && sp.name) === want) found = true; });
  });
  return found;
}

export function applySpellCorrections(spellcasting, structural) {
  var out = clone(spellcasting || {}), ledger = correctionLedger(structural), added = [], suppressed = [];
  out.groups = Array.isArray(out.groups) ? out.groups : [];
  var hides = ledger.active.filter(function (c) { return c && c.kind === 'spell' && correctionAction(c) === 'suppress'; });
  out.groups.forEach(function (g) {
    g.spells = (g.spells || []).filter(function (sp) {
      var hit = hides.filter(function (c) { return sameTarget(c, 'spell', 'suppress', sp && sp.name, sp && sp.source); })[0];
      if (hit) suppressed.push(hit.id);
      return !hit;
    });
  });
  out.groups = out.groups.filter(function (g) { return (g.spells || []).length; });
  ledger.active.forEach(function (c) {
    if (!c || c.kind !== 'spell' || correctionAction(c) !== 'add' || !c.name || spellExists(out, c.name)) return;
    var level = Math.max(0, Math.min(9, parseInt(c.level, 10) || 0));
    var group = out.groups.filter(function (g) { return parseInt(g.level, 10) === level; })[0];
    if (!group) {
      var ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
      group = { heading: level === 0 ? 'Cantrips · At Will' : ((ord[level] || (level + 'th')) + ' Level'), level: level, spells: [] };
      out.groups.push(group);
    }
    var meta = c.spell || {};
    group.spells.push({
      name: c.name,
      origin: 'manual',
      source: c.source || 'Manual',
      time: meta.time || meta.castingTime || '',
      level: level,
      conc: !!meta.concentration,
      ritual: !!meta.ritual,
      correctionId: c.id,
      correctionStatus: c.status || 'unreviewed'
    });
    added.push(c.id);
  });
  out.groups.sort(function (a, b) { return (parseInt(a.level, 10) || 0) - (parseInt(b.level, 10) || 0); });
  out.correctionSummary = correctionSummary(structural);
  out.correctionIdsRendered = added;
  out.correctionIdsSuppressed = suppressed;
  return out;
}

export function applyFeatureCorrections(features, structural) {
  var out = clone(Array.isArray(features) ? features : []), ledger = correctionLedger(structural), suppressed = [];
  var hides = ledger.active.filter(function (c) { return c && c.kind === 'feature' && correctionAction(c) === 'suppress'; });
  out = out.filter(function (f) {
    var hit = hides.filter(function (c) { return sameTarget(c, 'feature', 'suppress', f && f.name, f && f.source); })[0];
    if (hit) suppressed.push(hit.id);
    return !hit;
  });
  ledger.active.forEach(function (c) {
    if (!c || c.kind !== 'feature' || correctionAction(c) !== 'add' || !c.name) return;
    if (out.some(function (f) { return normName(f && f.name) === normName(c.name); })) return;
    out.push({
      name: c.name, desc: c.desc || c.note || '', source: 'custom:' + (c.source || 'Manual'),
      correctionId: c.id, correctionStatus: c.status || 'unreviewed'
    });
  });
  return { features: out, correctionIdsSuppressed: suppressed };
}
