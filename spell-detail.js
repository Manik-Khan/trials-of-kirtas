// spell-detail.js
// Renders the on-demand spell detail (from loadSpellMeta({detail:true})) into the sheet's
// description drawer: the full 5etools `entries` faithfully (paragraphs, lists, named
// sub-entries, tables, inline {@tags}), the four-stat meta grid, a richer attack/save +
// damage breakout line, and the "At higher levels" callout. Pure + DOM-free, so it smokes
// headlessly. The interactive Cast block is added by sheet-actions (it owns slot state).

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

var SCHOOL = { A: 'abjuration', C: 'conjuration', D: 'divination', E: 'enchantment', V: 'evocation', I: 'illusion', N: 'necromancy', T: 'transmutation', P: 'psionic' };
var ORD = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
export function ordinal(n) { return ORD[n] != null ? ORD[n] : (n + 'th'); }

// ── inline 5etools tag formatting: "{@damage 1d10} fire" → bolded dice, etc. ──
export function fmtText(str) {
  if (str == null) return '';
  var out = '', s = String(str), re = /\{@(\w+)\s*([^}]*)\}/g, last = 0, m;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index));
    out += renderTag(m[1].toLowerCase(), m[2]);
    last = m.index + m[0].length;
  }
  out += esc(s.slice(last));
  return out;
}
function renderTag(tag, body) {
  var p = String(body).split('|');
  switch (tag) {
    case 'h': return '<b>Hit:</b> ';
    case 'damage': case 'dice': return '<b class="sd-dice">' + esc(p[0]) + '</b>';
    case 'scaledamage': return '<b class="sd-dice">' + esc(p[0]) + '</b>';   // base|range|step → show base
    case 'dc': return '<b>DC ' + esc(p[0]) + '</b>';
    case 'hit': case 'atk': return '<b>' + (/^-/.test(p[0]) ? '' : '+') + esc(p[0]) + '</b>';
    case 'chance': return esc(p[0]) + '%';
    case 'recharge': return '(Recharge ' + esc(p[0] || '6') + ')';
    case 'spell': case 'item': case 'creature': case 'filter': case 'class': case 'feat':
      return '<i class="sd-ref">' + esc(p[2] || p[0]) + '</i>';
    case 'condition': case 'status': case 'skill': case 'action': case 'sense': case 'quickref':
      return '<span class="sd-kw">' + esc(p[2] || p[0]) + '</span>';
    case 'b': case 'bold': return '<b>' + fmtText(p[0]) + '</b>';
    case 'i': case 'italic': return '<i>' + fmtText(p[0]) + '</i>';
    case 'note': return '<i class="sd-note">' + esc(p[0]) + '</i>';
    default: return esc(p[2] || p[0]);
  }
}

// ── entries → HTML (recursive: strings, lists, named sub-entries, tables, insets, quotes) ──
export function renderEntries(entries) {
  if (!entries || !entries.length) return '';
  return entries.map(renderEntry).join('');
}
function renderEntry(e) {
  if (e == null) return '';
  if (typeof e === 'string') return '<p>' + fmtText(e) + '</p>';
  switch (e.type) {
    case 'entries': case 'section': {
      var head = e.name ? '<div class="sd-subh">' + esc(e.name) + '</div>' : '';
      return '<div class="sd-sub">' + head + renderEntries(e.entries) + '</div>';
    }
    case 'list': {
      var items = (e.items || []).map(function (it) {
        if (typeof it === 'string') return '<li>' + fmtText(it) + '</li>';
        if (it && it.type === 'item') {
          var nm = it.name ? '<b>' + esc(it.name) + '</b> ' : '';
          return '<li>' + nm + (it.entry ? fmtText(it.entry) : renderEntries(it.entries)) + '</li>';
        }
        return '<li>' + renderEntry(it) + '</li>';
      }).join('');
      return '<ul class="sd-list">' + items + '</ul>';
    }
    case 'table': {
      var cap2 = e.caption ? '<caption>' + esc(e.caption) + '</caption>' : '';
      var head = (e.colLabels && e.colLabels.length) ? '<thead><tr>' + e.colLabels.map(function (c) { return '<th>' + fmtText(c) + '</th>'; }).join('') + '</tr></thead>' : '';
      var rows = (e.rows || []).map(function (r) {
        return '<tr>' + (r || []).map(function (cell) { return '<td>' + (typeof cell === 'string' ? fmtText(cell) : renderEntry(cell)) + '</td>'; }).join('') + '</tr>';
      }).join('');
      return '<table class="sd-table">' + cap2 + head + '<tbody>' + rows + '</tbody></table>';
    }
    case 'inset': case 'insetReadaloud': {
      var nm2 = e.name ? '<div class="sd-subh">' + esc(e.name) + '</div>' : '';
      return '<div class="sd-inset">' + nm2 + renderEntries(e.entries) + '</div>';
    }
    case 'quote': {
      var by = e.by ? '<div class="sd-by">\u2014 ' + esc(e.by) + '</div>' : '';
      return '<blockquote class="sd-quote">' + renderEntries(e.entries) + by + '</blockquote>';
    }
    default:
      return e.entries ? renderEntries(e.entries) : (e.entry ? '<p>' + fmtText(e.entry) + '</p>' : '');
  }
}

// ── the four 5etools structured fields → human-readable strings ──
export function fmtTime(time) {
  var t = (time && time[0]) || null; if (!t) return '\u2014';
  var unit = t.unit === 'bonus' ? 'bonus action' : (t.unit === 'action' ? 'action' : t.unit);
  var s = (t.number != null ? t.number + ' ' : '') + unit + (t.number > 1 && !/action/.test(unit) ? 's' : '');
  if (t.condition) s += ', ' + t.condition;
  return s;
}
export function fmtRange(range) {
  if (!range) return '\u2014';
  var t = range.type, d = range.distance || {};
  if (t === 'special' || d.type === 'special') return 'Special';
  var SHAPES = { radius: 1, sphere: 1, cone: 1, line: 1, cube: 1, hemisphere: 1, cylinder: 1 };
  if (SHAPES[t]) {
    var unit = d.type === 'feet' ? 'foot' : (d.type || 'foot');     // "10-foot radius"
    return 'Self (' + (d.amount != null ? d.amount + '-' + unit + ' ' : '') + t + ')';
  }
  if (d.type === 'self') return 'Self';
  if (d.type === 'touch') return 'Touch';
  if (d.type === 'sight') return 'Sight';
  if (d.type === 'unlimited') return 'Unlimited';
  if (d.amount != null) return d.amount + ' ' + (d.type || 'feet');
  return cap(t || '\u2014');
}
export function fmtComponents(c) {
  if (!c) return '\u2014';
  var parts = [];
  if (c.v) parts.push('V');
  if (c.s) parts.push('S');
  if (c.m) { var mt = (typeof c.m === 'string') ? c.m : (c.m && c.m.text); parts.push('M' + (mt ? ' (' + mt + ')' : '')); }
  return parts.join(', ') || '\u2014';
}
export function fmtDuration(duration) {
  var d = (duration && duration[0]) || null; if (!d) return '\u2014';
  if (d.type === 'instant') return 'Instantaneous';
  if (d.type === 'permanent') return 'Until dispelled' + ((d.ends || []).indexOf('trigger') >= 0 ? ' or triggered' : '');
  if (d.type === 'special') return 'Special';
  if (d.type === 'timed') {
    var dd = d.duration || {}, amt = dd.amount != null ? dd.amount : 1, unit = dd.type || 'round';
    var span = amt + ' ' + unit + (amt > 1 ? 's' : '');
    return d.concentration ? ('Concentration, up to ' + span) : ('Up to ' + span);
  }
  return cap(d.type || '\u2014');
}

// ── school / level line + flags ──
export function schoolLine(detail) {
  detail = detail || {};
  var sch = SCHOOL[detail.school] || (detail.school || '');
  var lvl = detail.level || 0;
  var label = lvl === 0 ? (cap(sch) + ' cantrip') : (ordinal(lvl) + '-level ' + sch);
  var flags = '';
  if (detail.concentration) flags += '<span class="sd-flag">Concentration</span>';
  if (detail.ritual) flags += '<span class="sd-flag rit">Ritual</span>';
  return '<div class="sd-school">' + esc(label) + flags + '</div>';
}

// ── richer breakout: "Ranged spell attack \u00b7 1d10 fire" / "DEX save \u00b7 2d10 fire" ──
var ABBR = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
function firstDamageDice(entries) {
  var found = null;
  (function walk(arr) {
    (arr || []).forEach(function (e) {
      if (found) return;
      if (typeof e === 'string') { var m = /\{@(?:damage|scaledamage)\s+([^|}]+)/.exec(e); if (m) found = m[1].trim(); }
      else if (e && e.entries) walk(e.entries);
      else if (e && e.items) walk(e.items);
    });
  })(entries);
  return found;
}
export function effectLine(detail) {
  detail = detail || {};
  var mech = null;
  if (detail.spellAttack && detail.spellAttack.length) {
    mech = (detail.spellAttack[0] === 'M' ? 'Melee' : (detail.spellAttack[0] === 'R' ? 'Ranged' : '')) ;
    mech = (mech ? mech + ' ' : '') + 'spell attack';
  } else if (detail.savingThrow && detail.savingThrow.length) {
    mech = (ABBR[detail.savingThrow[0]] || cap(detail.savingThrow[0])) + ' save';
  }
  var dice = firstDamageDice(detail.entries);
  var dmgType = (detail.damageInflict && detail.damageInflict.length) ? detail.damageInflict.join(', ') : '';
  var dmg = dice ? (dice + (dmgType ? ' ' + dmgType : '')) : (dmgType ? cap(dmgType) + ' damage' : '');
  if (!mech && !dmg) return '';
  var bits = [];
  if (mech) bits.push('<span class="sd-mech">' + esc(mech) + '</span>');
  if (dmg) bits.push('<span class="sd-dmg">' + esc(dmg) + '</span>');
  return '<div class="sd-effect">' + bits.join('<span class="sd-dot">\u00b7</span>') + '</div>';
}

// ── the full read content of the drawer (everything except the interactive Cast block) ──
export function spellDetailHTML(detail) {
  detail = detail || {};
  var higher = '';
  if (detail.entriesHigherLevel && detail.entriesHigherLevel.length) {
    // 5etools nests it as [{type:'entries', name:'At Higher Levels', entries:[...]}]
    var hl = detail.entriesHigherLevel, body = (hl[0] && hl[0].entries) ? renderEntries(hl[0].entries) : renderEntries(hl);
    var nm = (hl[0] && hl[0].name) ? hl[0].name : 'At higher levels';
    higher = '<div class="sd-higher"><div class="sd-hk">' + esc(nm) + '</div><div class="sd-hv">' + body + '</div></div>';
  }
  return schoolLine(detail)
    + effectLine(detail)
    + '<div class="sd-meta">'
      + '<div><div class="sd-k">Casting time</div><div class="sd-v">' + esc(fmtTime(detail.time)) + '</div></div>'
      + '<div><div class="sd-k">Range</div><div class="sd-v">' + esc(fmtRange(detail.range)) + '</div></div>'
      + '<div><div class="sd-k">Components</div><div class="sd-v">' + esc(fmtComponents(detail.components)) + '</div></div>'
      + '<div><div class="sd-k">Duration</div><div class="sd-v">' + esc(fmtDuration(detail.duration)) + '</div></div>'
    + '</div>'
    + '<div class="sd-body">' + renderEntries(detail.entries) + higher + '</div>';
}

// a one-line summary for the cast feed post (concise — the full text lives in the drawer)
export function feedSummary(detail) {
  detail = detail || {};
  var sch = SCHOOL[detail.school] || detail.school || '';
  var lvl = detail.level || 0;
  var head = lvl === 0 ? (cap(sch) + ' cantrip') : (ordinal(lvl) + '-level ' + sch);
  var mech = null;
  if (detail.spellAttack && detail.spellAttack.length) mech = (detail.spellAttack[0] === 'M' ? 'melee' : 'ranged') + ' spell attack';
  else if (detail.savingThrow && detail.savingThrow.length) mech = (ABBR[detail.savingThrow[0]] || cap(detail.savingThrow[0])) + ' save';
  var dice = firstDamageDice(detail.entries);
  var dmgType = (detail.damageInflict && detail.damageInflict.length) ? detail.damageInflict[0] : '';
  var bits = [head];
  if (mech) bits.push(mech);
  if (dice) bits.push(dice + (dmgType ? ' ' + dmgType : ''));
  return bits.join(' \u00b7 ');
}
