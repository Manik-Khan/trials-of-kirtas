// combat-orbs.js
// ---------------------------------------------------------------------------
// Configurable radial token orbs for combat.html (Phase 1). On selectToken the
// ring blooms around the token; the centre orb opens the floating sheet
// (CombatSheets.open), HP runs a ± stepper through the live combat backend, AC /
// Speed / Init / Conditions are glance info, and resource orbs read/write the
// SAME vitals.pipState the sheet uses — one source of truth, so an orb and the
// floated sheet never disagree.
//
// Per-token loadout lives in the character's structural.orbConfig (no migration);
// absent → a sensible class default. The add/remove/reorder UI is rendered into
// the existing right-click menu's "Token Orbs" expander via configHtml/wireConfig.
//
// combat.html drives it through window.CombatOrbs with a small host:
//   show(c, tokenEl, host) / hide()
//   configHtml(c, host) / wireConfig(rootEl, c, host)   (for openCtxMenu)
// host = { staff(), canEdit(c), openSheet(c), hpSave(c, hp), characterData, toast(m) }
//
// Phase 2 (flagged, not here): macros, Ki/Bardic/Superiority, monster legendaries.
// ---------------------------------------------------------------------------
(function () {
  'use strict';
  if (window.CombatOrbs) return;

  var CHAR_CACHE = {};          // source_key -> character record (loadout + pipState + classFeatures)
  var LOADING = {};             // source_key -> in-flight load promise (dedupe)
  var layerEl = null;           // the active .torb-layer (one at a time)
  var activeTok = null;         // token element currently lifted for its orbs
  var popEl = null;

  // ── static orb kinds (info orbs read the combatant row `c`) ──
  var KIND = {
    sheet: { kind: 'sheet', ic: '\uD83D\uDCCB', label: 'Sheet' },
    hp:    { kind: 'hp', label: 'HP' },
    ac:    { kind: 'info', ic: '\uD83D\uDEE1', label: 'AC', val: function (c) { return c.ac != null ? c.ac : '\u2014'; } },
    spd:   { kind: 'info', ic: '\uD83C\uDFC3', label: 'Speed', val: function (c, ch) { return speedOf(ch); } },
    ini:   { kind: 'info', ic: '\u2694', label: 'Init', val: function (c) { return sgn(c.initiative); } },
    conds: { kind: 'conds', ic: '\u2691', label: 'Conditions' }
  };
  var STATIC_ADDABLE = ['hp', 'ac', 'spd', 'ini', 'conds'];

  function sgn(n) { if (n == null || n === '') return '\u2014'; n = Number(n) || 0; return (n >= 0 ? '+' : '\u2212') + Math.abs(n); }
  function speedOf(ch) { var s = ch && ch.structural; if (!s) return '\u2014'; var v = (s.combat && s.combat.speed) != null ? s.combat.speed : s.speed; return v != null ? v + 'ft' : '\u2014'; }

  // ── resource orbs, derived from the character's classFeatures (same model the
  //    sheet uses). id == the vitals.pipState key. pipState stores SPENT count;
  //    current = max - spent. ──
  function resourceDefs(ch) {
    var s = (ch && ch.structural) || {}, cf = s.classFeatures || {}, out = {};
    if (cf.pactSlots) out.pactSlots = { kind: 'res', label: 'Pact Slots', tag: 'Pact', rc: '#e7c279', max: cf.pactSlots.max || 0 };
    if (cf.spellSlots) Object.keys(cf.spellSlots).forEach(function (L) { var m = (cf.spellSlots[L] || {}).max || 0; if (m > 0) out['spell_' + L] = { kind: 'res', label: 'Spell Slots \u00B7 L' + L, tag: 'Sl' + L, rc: '#e7c279', max: m }; });
    if (cf.sorcererSlots) Object.keys(cf.sorcererSlots).forEach(function (L) { var m = (cf.sorcererSlots[L] || {}).max || 0; if (m > 0) out['sorc_' + L] = { kind: 'res', label: 'Sorcerer Slots \u00B7 L' + L, tag: 'So' + L, rc: '#55c4c0', max: m }; });
    if (cf.sorceryPoints) out.sorcery = { kind: 'res', label: 'Sorcery Points', tag: 'Sorc', rc: '#55c4c0', max: cf.sorceryPoints.max || 0 };
    // derived class + racial resources (Ki / Bardic / Superiority / Starlight Step) —
    // computed from class/level/abilities/race, same source the sheet's Resources section uses
    if (window.ResourceDerive) {
      window.ResourceDerive.derive(s).forEach(function (r) {
        out[r.id] = { kind: 'res', label: r.label, tag: r.tag, rc: (r.tone === 'subclass' ? '#55c4c0' : '#e7c279'), max: r.max };
      });
    }
    return out;
  }
  function defFor(id, ch) { return KIND[id] || (id === 'sheet' ? KIND.sheet : resourceDefs(ch)[id]) || null; }

  // ── loadout: structural.orbConfig if present, else a class default ──
  function defaultLoadout(c, ch) {
    var base = ['sheet', 'hp', 'ac', 'conds'];
    var res = Object.keys(resourceDefs(ch));            // all the character's pools
    return base.concat(res);
  }
  function loadoutFor(c, ch) {
    var cfg = ch && ch.structural && ch.structural.orbConfig;
    if (Array.isArray(cfg) && cfg.length) return cfg.slice();
    return defaultLoadout(c, ch);
  }

  // ── pip state helpers (read/write the character's vitals.pipState) ──
  function spent(ch, id) { var v = (ch && ch.vitals) || {}, p = v.pipState || {}; return p[id] || 0; }
  function curOf(ch, id) { var d = resourceDefs(ch)[id]; if (!d) return [0, 0]; return [Math.max(0, d.max - spent(ch, id)), d.max]; }

  // ====================== rendering ======================
  function bloom(c, tokenEl, host, ch) {
    var layer = tokenEl.querySelector('.torb-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'torb-layer'; tokenEl.appendChild(layer); }
    layerEl = layer; layer.innerHTML = '';
    // centre the ring on the disc (not the whole token box, which includes the
    // name + condition badges below). offsetParent is the positioned .token.
    var disc = tokenEl.querySelector('.token-disc, .token-cutout') || tokenEl;
    layer.style.left = (disc.offsetLeft + disc.offsetWidth / 2) + 'px';
    layer.style.top = (disc.offsetTop + disc.offsetHeight / 2) + 'px';
    var ids = loadoutFor(c, ch).filter(function (id) { return !!defFor(id, ch); });
    var N = ids.length, R = 64, start = -90;
    ids.forEach(function (id, i) {
      var ang = (start + i * (360 / N)) * Math.PI / 180;
      var orb = renderOrb(id, c, ch, host);
      orb.style.left = (Math.cos(ang) * R) + 'px';
      orb.style.top = (Math.sin(ang) * R) + 'px';
      layer.appendChild(orb);
      (function (o, k) { requestAnimationFrame(function () { setTimeout(function () { o.classList.add('in'); }, k * 28); }); })(orb, i);
    });
  }

  function renderOrb(id, c, ch, host) {
    var d = defFor(id, ch), orb = document.createElement('div');
    orb.className = 'torb ' + d.kind + (id === 'sheet' ? ' primary' : '');
    var body = '';
    if (d.kind === 'sheet') body = '<span class="ic">\uD83D\uDCCB</span>';
    else if (d.kind === 'hp') body = '<span class="vl">' + (c.hp != null ? c.hp : '\u2014') + '</span><span class="tag">/' + (c.max_hp != null ? c.max_hp : '\u2014') + '</span>';
    else if (d.kind === 'info') body = '<span class="ic">' + d.ic + '</span><span class="vl">' + d.val(c, ch) + '</span>';
    else if (d.kind === 'conds') { var n = Array.isArray(c.conditions) ? c.conditions.length : 0; body = '<span class="ic">\u2691</span>' + (n ? '<span class="vl">' + n + '</span>' : ''); }
    else if (d.kind === 'res') { var cm = curOf(ch, id); orb.style.setProperty('--rc', d.rc || '#e7c279'); body = '<span class="tag">' + d.tag + '</span>' + pipsHtml(cm[0], cm[1], d.rc); }
    orb.innerHTML = body + '<span class="lb">' + d.label + '</span>';
    orb.addEventListener('click', function (e) { e.stopPropagation(); onOrb(e, id, c, ch, host, orb, tokenElOf(orb)); });
    return orb;
  }
  function pipsHtml(cur, max, rc) {
    if (max > 6) return '<span class="vl" style="color:' + (rc || '#e7c279') + '">' + cur + '/' + max + '</span>';
    var s = '<span class="pips">'; for (var i = 0; i < max; i++) s += '<i class="' + (i < cur ? 'on' : '') + '"></i>'; return s + '</span>';
  }
  function tokenElOf(node) { return node.closest('.token'); }

  // ====================== interactions ======================
  function onOrb(e, id, c, ch, host, orb, tokenEl) {
    closePop();
    var d = defFor(id, ch);
    if (d.kind === 'sheet') { if (host.openSheet) host.openSheet(c); }
    else if (d.kind === 'hp') { hpStepper(c, host, orb, tokenEl); }
    else if (d.kind === 'res') { spendResource(id, c, ch, host, tokenEl, !!(e && e.shiftKey)); }
    else if (d.kind === 'conds') { if (host.toast) host.toast(Array.isArray(c.conditions) && c.conditions.length ? 'Conditions: ' + c.conditions.join(', ') : 'No conditions \u00B7 set via right-click'); }
    else if (d.kind === 'info') { if (host.toast) host.toast(d.label + ': ' + d.val(c, ch)); }
  }

  function hpStepper(c, host, orb, tokenEl) {
    if (host.canEdit && !host.canEdit(c)) { if (host.toast) host.toast('View only'); return; }
    var pop = mkPop();
    pop.innerHTML = '<h5>' + esc(c.name || 'Token') + ' \u00B7 HP</h5><div class="torb-step">' +
      '<button data-d="-1">\u2212</button><div class="hpv"><span class="cur">' + (c.hp != null ? c.hp : 0) + '</span> <small>/ ' + (c.max_hp != null ? c.max_hp : '\u2014') + '</small></div><button data-d="1">+</button></div>';
    place(pop, orb, tokenEl);
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      var step = (b.dataset.d === '1' ? 1 : -1) * (e.shiftKey ? 5 : 1);
      var max = c.max_hp != null ? c.max_hp : 999;
      var next = Math.max(0, Math.min(max, (c.hp || 0) + step));
      c.hp = next; pop.querySelector('.cur').textContent = next;
      var v = tokenEl.querySelector('.torb.hp .vl'); if (v) v.textContent = next;
      if (host.hpSave) host.hpSave(c, next);
    });
  }

  function spendResource(id, c, ch, host, tokenEl, restore) {
    if (host.canEdit && !host.canEdit(c)) { if (host.toast) host.toast('View only'); return; }
    var d = resourceDefs(ch)[id]; if (!d || !ch) return;
    var v = ch.vitals || (ch.vitals = {}); var p = v.pipState || (v.pipState = {});
    var sp = p[id] || 0;
    sp = restore ? Math.max(0, sp - 1) : Math.min(d.max, sp + 1);
    p[id] = sp;
    var cm = [Math.max(0, d.max - sp), d.max];
    bloom(c, tokenEl, host, ch);                        // re-render so pip counts refresh in place
    // persist the FULL vitals (merge) — same path the sheet uses, so the orb and
    // the floated sheet read one source of truth
    if (host.characterData && c.source_key) {
      host.characterData.save(c.source_key, { vitals: v }).catch(function (e) { console.warn('[orbs] resource save:', e && e.message); });
    }
    if (host.toast) host.toast(d.label + ': ' + cm[0] + '/' + cm[1]);
  }

  // ====================== public: show / hide ======================
  // Load a PC's character record once (dedupes concurrent calls). Resource orbs
  // and the config both need classFeatures + vitals.pipState + structural.orbConfig.
  function ensureChar(key, host) {
    if (!key) return Promise.resolve(null);
    if (CHAR_CACHE[key]) return Promise.resolve(CHAR_CACHE[key]);
    if (LOADING[key]) return LOADING[key];
    if (!host || !host.characterData) return Promise.resolve(null);
    LOADING[key] = host.characterData.loadCharacter(key).then(function (rec) {
      delete LOADING[key]; if (rec) CHAR_CACHE[key] = rec; return rec || null;
    }).catch(function () { delete LOADING[key]; return null; });
    return LOADING[key];
  }

  function show(c, tokenEl, host) {
    host = host || {};
    if (!c || !tokenEl) return;
    if (activeTok && activeTok !== tokenEl) activeTok.style.zIndex = '';
    activeTok = tokenEl; tokenEl.style.zIndex = 200;    // lift above neighbours + HUD (under modals at 1000)
    var key = c.source_key;
    var ch = key ? CHAR_CACHE[key] : null;
    bloom(c, tokenEl, host, ch);                        // render now with what we have
    if (key && !ch) ensureChar(key, host).then(function (rec) {   // PC not cached → load, then re-bloom
      if (rec && tokenEl.querySelector('.torb-layer') && tokenEl.classList.contains('selected')) bloom(c, tokenEl, host, rec);
    });
  }
  function hide() {
    if (layerEl) { layerEl.innerHTML = ''; layerEl = null; }
    if (activeTok) { activeTok.style.zIndex = ''; activeTok = null; }
    closePop();
  }

  // ====================== config UI (rendered into the right-click menu) ======================
  function configHtml(c, host) {
    var ch = c.source_key ? CHAR_CACHE[c.source_key] : null;
    var loadout = loadoutFor(c, ch);
    var rows = loadout.map(function (id, idx) {
      var d = defFor(id, ch); if (!d) return '';
      var rc = d.rc || '#c79a4a';
      return '<div class="torb-row" data-idx="' + idx + '">' +
        '<span class="torb-sw" style="background:' + rc + '"></span>' +
        '<span class="torb-nm">' + esc(d.label) + '</span>' +
        '<button class="torb-mv" data-mv="-1" title="Up">\u25B2</button>' +
        '<button class="torb-mv" data-mv="1" title="Down">\u25BC</button>' +
        (id === 'sheet' ? '<span class="torb-rmpad"></span>' : '<button class="torb-rm" title="Remove">\u2715</button>') +
        '</div>';
    }).join('');
    var avail = STATIC_ADDABLE.concat(Object.keys(resourceDefs(ch))).filter(function (id) { return loadout.indexOf(id) === -1; });
    var opts = avail.length
      ? avail.map(function (id) { var d = defFor(id, ch); return '<button data-add="' + id + '">' + esc(d.label) + '</button>'; }).join('')
      : '<button disabled>all added</button>';
    return '<div class="torb-cfg">' + rows +
      '<button class="torb-add" data-torb-toggle>+ Add orb</button><div class="torb-menu">' + opts + '</div></div>';
  }

  function wireConfig(rootEl, c, host) {
    var box = rootEl.querySelector('.torb-cfg'); if (!box) return;
    // If the PC's record hasn't loaded yet, the config shows static orbs only;
    // load it and re-render the section in place once it arrives.
    if (c.source_key && !CHAR_CACHE[c.source_key]) {
      ensureChar(c.source_key, host).then(function (rec) {
        if (!rec) return; var fresh = rootEl.querySelector('.torb-cfg');
        if (fresh) { fresh.outerHTML = configHtml(c, host); wireConfig(rootEl, c, host); }
      });
    }
    var ch = c.source_key ? CHAR_CACHE[c.source_key] : null;
    var loadout = loadoutFor(c, ch);
    function commit() {
      if (ch) { (ch.structural || (ch.structural = {})).orbConfig = loadout.slice(); }
      if (c.source_key && host.characterData && ch) {
        host.characterData.save(c.source_key, { structural: ch.structural }).catch(function (e) { console.warn('[orbs] config save:', e && e.message); });
      }
      var tEl = host.tokenEl ? host.tokenEl(c.id) : null;
      if (tEl && tEl.querySelector('.torb-layer')) bloom(c, tEl, host, ch);
      // re-render the menu section in place
      box.outerHTML = configHtml(c, host);
      wireConfig(rootEl, c, host);
    }
    box.querySelectorAll('.torb-mv').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation(); var i = +b.closest('.torb-row').dataset.idx, j = i + (+b.dataset.mv);
        if (j < 0 || j >= loadout.length) return; var t = loadout[i]; loadout[i] = loadout[j]; loadout[j] = t; commit();
      });
    });
    box.querySelectorAll('.torb-rm').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); loadout.splice(+b.closest('.torb-row').dataset.idx, 1); commit(); });
    });
    var toggle = box.querySelector('[data-torb-toggle]'), menu = box.querySelector('.torb-menu');
    if (toggle) toggle.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('open'); });
    box.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); loadout.push(b.dataset.add); commit(); });
    });
  }

  // ====================== popovers ======================
  function mkPop() { var p = document.createElement('div'); p.className = 'torb-pop'; return p; }
  function place(pop, anchor, tokenEl) {
    closePop(); popEl = pop;
    var ax = parseFloat(anchor.style.left) || 0, ay = parseFloat(anchor.style.top) || 0;
    pop.style.left = ax + 'px';
    pop.style.top = (ay + 30) + 'px';
    (tokenEl.querySelector('.torb-layer') || tokenEl).appendChild(pop);
    requestAnimationFrame(function () { pop.classList.add('in'); });
  }
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }

  function esc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  window.CombatOrbs = {
    show: show, hide: hide, configHtml: configHtml, wireConfig: wireConfig,
    _invalidate: function (key) { if (key) delete CHAR_CACHE[key]; else CHAR_CACHE = {}; }
  };
})();
