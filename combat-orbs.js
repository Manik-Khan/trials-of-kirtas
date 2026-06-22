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
  var activeC = null;           // its combatant row  — so a realtime row update can re-bloom
  var activeHost = null;        // its host           —   the open ring in place
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

  // ── orb display size (global preference; applies to every token) ──
  var SIZE_DEF = { orb: 0.5, sheet: 1.0 };   // orb = fraction of disc; sheet = multiple of orb
  var _size = null;                          // in-memory cache — live even if localStorage is blocked
  function sizePrefs() {
    if (_size) return _size;
    _size = { orb: SIZE_DEF.orb, sheet: SIZE_DEF.sheet };
    try {
      var raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('tok.orbSize') : null;
      if (raw) { var p = JSON.parse(raw); _size = { orb: +p.orb || SIZE_DEF.orb, sheet: +p.sheet || SIZE_DEF.sheet }; }
    } catch (e) {}
    return _size;
  }
  function setSizePref(patch) {
    _size = Object.assign(sizePrefs(), patch);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('tok.orbSize', JSON.stringify(_size)); } catch (e) {}
    return _size;
  }

  // ====================== rendering ======================
  function bloom(c, tokenEl, host, ch) {
    // only one ring at a time — strip any other token's layer (a new selection,
    // or a stray ring left behind from a previous one)
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.torb-layer').forEach(function (l) { if (l.parentNode !== tokenEl) l.remove(); });
    }
    var layer = tokenEl.querySelector('.torb-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'torb-layer'; tokenEl.appendChild(layer); }
    layerEl = layer; layer.innerHTML = '';
    // centre the ring on the disc (not the whole token box, which includes the
    // name + condition badges below). offsetParent is the positioned .token.
    var disc = tokenEl.querySelector('.token-disc, .token-cutout') || tokenEl;
    layer.style.left = (disc.offsetLeft + disc.offsetWidth / 2) + 'px';
    layer.style.top = (disc.offsetTop + disc.offsetHeight / 2) + 'px';
    var ids = loadoutFor(c, ch).filter(function (id) { return !!defFor(id, ch); });
    ids.forEach(function (id, i) {
      var orb = renderOrb(id, c, ch, host);
      layer.appendChild(orb);
      (function (o, k) { requestAnimationFrame(function () { setTimeout(function () { o.classList.add('in'); }, k * 28); }); })(orb, i);
    });
    layoutLayer(layer, disc);
  }

  // size + place the orbs in a layer, from the disc size and the global size prefs.
  // Reused for live resize when the size sliders move (no re-render).
  function layoutLayer(layer, disc) {
    var D = (disc && disc.offsetWidth) || 48, sp = sizePrefs();
    var orbD = Math.max(14, Math.min(D * sp.orb, 64));                 // configurable fraction of the disc
    var sheetD = Math.max(14, Math.min(orbD * sp.sheet, orbD * 1.6));  // sheet orb relative to the others
    layer.style.setProperty('--torb-d', orbD + 'px');
    layer.style.setProperty('--torb-sheet-d', sheetD + 'px');
    var orbs = layer.querySelectorAll('.torb'), N = orbs.length, Rmax = Math.max(orbD, sheetD);
    var Rmin = D * 0.5 + Rmax * 0.5 + Math.max(2, D * 0.06);             // sit just outside the disc edge
    var Rfit = N > 1 ? (Rmax * 1.22) / (2 * Math.sin(Math.PI / N)) : 0;  // …but spread enough not to overlap
    var R = Math.max(Rmin, Rfit), start = -90, i;
    for (i = 0; i < N; i++) {
      var ang = (start + i * (360 / N)) * Math.PI / 180;
      orbs[i].style.left = (Math.cos(ang) * R) + 'px';
      orbs[i].style.top = (Math.sin(ang) * R) + 'px';
    }
  }

  function renderOrb(id, c, ch, host) {
    var d = defFor(id, ch), orb = document.createElement('div');
    // NB: 'sheet' as a bare class collides with the .sheet character-sheet-panel
    // rule in sheet-mount.css (loaded by combat.html), which injects 64px of
    // padding + a hue-rotate straight into the orb. The sheet orb is styled via
    // .primary, so don't emit the colliding kind class for it.
    var kindCls = (d.kind === 'sheet') ? '' : d.kind;
    orb.className = ('torb ' + kindCls + (id === 'sheet' ? ' primary' : '')).replace(/\s+/g, ' ').trim();
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
    activeC = c; activeHost = host;
    var key = c.source_key;
    var ch = key ? CHAR_CACHE[key] : null;
    bloom(c, tokenEl, host, ch);                        // render now with what we have
    if (key && !ch) ensureChar(key, host).then(function (rec) {   // PC not cached → load, then re-bloom
      if (rec && tokenEl.querySelector('.torb-layer') && tokenEl.classList.contains('selected')) bloom(c, tokenEl, host, rec);
    });
  }
  function hide() {
    if (typeof document !== 'undefined') {
      var ls = document.querySelectorAll('.torb-layer');
      for (var i = 0; i < ls.length; i++) ls[i].remove();
    }
    layerEl = null;
    if (activeTok) { activeTok.style.zIndex = ''; activeTok = null; }
    activeC = null; activeHost = null;
    closePop();
  }

  // ====================== config UI (rendered into the right-click menu) ======================
  function configHtml(c, host) {
    var ch = c.source_key ? CHAR_CACHE[c.source_key] : null;
    var loadout = loadoutFor(c, ch);
    var rows = loadout.map(function (id, idx) {
      var d = defFor(id, ch); if (!d) return '';
      var rc = d.rc || '#c79a4a';
      return '<div class="torb-row" data-idx="' + idx + '" data-id="' + esc(id) + '">' +
        '<span class="torb-grip" title="Drag to reorder" aria-label="Drag to reorder">\u283F</span>' +
        '<span class="torb-sw" style="background:' + rc + '"></span>' +
        '<span class="torb-nm">' + esc(d.label) + '</span>' +
        (id === 'sheet' ? '<span class="torb-rmpad"></span>' : '<button class="torb-rm" title="Remove">\u2715</button>') +
        '</div>';
    }).join('');
    var avail = STATIC_ADDABLE.concat(Object.keys(resourceDefs(ch))).filter(function (id) { return loadout.indexOf(id) === -1; });
    var opts = avail.length
      ? avail.map(function (id) { var d = defFor(id, ch); return '<button data-add="' + id + '">' + esc(d.label) + '</button>'; }).join('')
      : '<button disabled>all added</button>';
    // ── custom resources: existing list + the add form ──
    var RD = window.ResourceDerive && window.ResourceDerive._fn;
    var cres = (ch && ch.structural && ch.structural.customResources) || [];
    var cresRows = cres.map(function (cr) {
      var mx = RD ? RD.resolveMax(cr.max, ch.structural) : ((cr.max && cr.max.value) || cr.max || 0);
      var rt = RD ? RD.rechargeText(cr.recharge) : (cr.recharge || 'long rest');
      return '<div class="torb-crow"><span class="torb-sw" style="background:#e7c279"></span>' +
        '<span class="torb-nm">' + esc(cr.label) + '</span>' +
        '<span class="torb-cmeta">' + mx + ' \u00B7 ' + esc(rt) + '</span>' +
        '<button class="torb-cdel" data-cdel="' + esc(cr.id) + '" title="Delete resource">\u2715</button></div>';
    }).join('');
    var abilOpts = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(function (a) { return '<option value="' + a + '">' + a.toUpperCase() + '</option>'; }).join('');
    var cresBlock = '<div class="torb-cres"><div class="torb-cres-t">Custom resources</div>' + cresRows +
      '<button class="torb-cres-add" data-cres-toggle>+ New resource</button>' +
      '<div class="torb-cres-form" hidden>' +
        '<input type="text" data-cres-name placeholder="Name (e.g. Channel Divinity)" maxlength="40">' +
        '<div class="torb-cres-row"><select data-cres-mtype><option value="fixed">Fixed</option><option value="pb">Prof. bonus</option><option value="level">Level</option><option value="mod">Ability mod</option></select>' +
        '<input type="number" data-cres-mfixed min="1" max="20" value="1"><select data-cres-mability hidden>' + abilOpts + '</select></div>' +
        '<div class="torb-cres-row"><select data-cres-recharge><option value="long">Long rest</option><option value="short">Short rest</option><option value="short-long">Short or long</option></select>' +
        '<button class="torb-cres-create" data-cres-create>Add</button></div>' +
      '</div></div>';
    var sz = sizePrefs();
    var sizeBlock = '<div class="torb-size"><div class="torb-size-t">Display size</div>' +
      '<div class="torb-size-row"><label>Orb</label><input type="range" data-size="orb" min="30" max="78" value="' + Math.round(sz.orb * 100) + '"><span class="torb-size-v" data-size-v="orb">' + Math.round(sz.orb * 100) + '%</span></div>' +
      '<div class="torb-size-row"><label>Sheet</label><input type="range" data-size="sheet" min="70" max="160" value="' + Math.round(sz.sheet * 100) + '"><span class="torb-size-v" data-size-v="sheet">' + Math.round(sz.sheet * 100) + '%</span></div>' +
      '</div>';
    return '<div class="torb-cfg">' + rows +
      '<button class="torb-add" data-torb-toggle>+ Add orb</button><div class="torb-menu">' + opts + '</div>' +
      cresBlock + sizeBlock + '</div>';
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
    // drag-to-reorder via the grip — pointer move/up bound to DOCUMENT so tracking never
    // drops when the cursor leaves the small handle (works with mouse and touch).
    (function wireDragSort() {
      var dragging = null, onMove = null, onUp = null;
      function rowsArr() { return Array.prototype.slice.call(box.querySelectorAll('.torb-row')); }
      function finish() {
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('pointercancel', onUp, true);
        if (dragging) dragging.classList.remove('dragging');
        var was = dragging; dragging = null; onMove = onUp = null;
        if (was) {
          var ids = rowsArr().map(function (r) { return r.dataset.id; });   // adopt the new DOM order
          loadout.length = 0; Array.prototype.push.apply(loadout, ids);
          commit();                                                          // persist + re-bloom the ring
        }
      }
      box.querySelectorAll('.torb-grip').forEach(function (grip) {
        grip.addEventListener('pointerdown', function (e) {
          if (e.button != null && e.button > 0) return;                      // primary button / touch only
          e.preventDefault(); e.stopPropagation();
          var row = grip.closest('.torb-row'); if (!row) return;
          dragging = row; row.classList.add('dragging');
          onMove = function (ev) {
            if (!dragging) return;
            if (ev.cancelable) ev.preventDefault();
            var rows = rowsArr(), y = ev.clientY, placed = false;
            for (var i = 0; i < rows.length; i++) {
              var r = rows[i]; if (r === dragging) continue;
              var rect = r.getBoundingClientRect();
              if (y < rect.top + rect.height / 2) {
                if (r.previousElementSibling !== dragging) box.insertBefore(dragging, r);
                placed = true; break;
              }
            }
            if (!placed) { var add = box.querySelector('.torb-add'); if (add && add.previousElementSibling !== dragging) box.insertBefore(dragging, add); }
          };
          onUp = finish;
          document.addEventListener('pointermove', onMove, true);
          document.addEventListener('pointerup', onUp, true);
          document.addEventListener('pointercancel', onUp, true);
        });
      });
    })();
    box.querySelectorAll('.torb-rm').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); loadout.splice(+b.closest('.torb-row').dataset.idx, 1); commit(); });
    });
    var toggle = box.querySelector('[data-torb-toggle]'), menu = box.querySelector('.torb-menu');
    if (toggle) toggle.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('open'); });
    box.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); loadout.push(b.dataset.add); commit(); });
    });
    // ── custom resources ──
    var cToggle = box.querySelector('[data-cres-toggle]'), cForm = box.querySelector('.torb-cres-form');
    if (cToggle && cForm) cToggle.addEventListener('click', function (e) { e.stopPropagation(); cForm.hidden = !cForm.hidden; });
    var mtypeSel = box.querySelector('[data-cres-mtype]');
    if (mtypeSel) mtypeSel.addEventListener('change', function () {
      var mf = box.querySelector('[data-cres-mfixed]'), ma = box.querySelector('[data-cres-mability]');
      if (mf) mf.hidden = mtypeSel.value !== 'fixed';
      if (ma) ma.hidden = mtypeSel.value !== 'mod';
    });
    var cCreate = box.querySelector('[data-cres-create]');
    if (cCreate) cCreate.addEventListener('click', function (e) {
      e.stopPropagation(); if (!ch) return;
      var nmEl = box.querySelector('[data-cres-name]'), name = (nmEl.value || '').trim(); if (!name) { nmEl.focus(); return; }
      var mt = box.querySelector('[data-cres-mtype]').value, max;
      if (mt === 'fixed') max = { type: 'fixed', value: Math.max(1, parseInt(box.querySelector('[data-cres-mfixed]').value, 10) || 1) };
      else if (mt === 'mod') max = { type: 'mod', ability: box.querySelector('[data-cres-mability]').value };
      else max = { type: mt };
      var recharge = box.querySelector('[data-cres-recharge]').value;
      var base = 'cr_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24), used = (ch.structural && ch.structural.customResources || []).map(function (x) { return x.id; }), id = base, n = 2;
      while (used.indexOf(id) !== -1) id = base + '_' + (n++);
      (ch.structural || (ch.structural = {})).customResources = (ch.structural.customResources || []).concat([{ id: id, label: name, max: max, recharge: recharge }]);
      if (loadout.indexOf(id) === -1) loadout.push(id);   // surface it as an orb right away
      commit();
    });
    box.querySelectorAll('[data-cdel]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation(); if (!ch) return; var id = b.dataset.cdel;
        ch.structural.customResources = (ch.structural.customResources || []).filter(function (x) { return x.id !== id; });
        var li = loadout.indexOf(id); if (li !== -1) loadout.splice(li, 1);
        commit();
      });
    });
    // ── display-size sliders (global; live-resize the ring without re-rendering) ──
    box.querySelectorAll('[data-size]').forEach(function (sl) {
      sl.addEventListener('input', function (e) {
        e.stopPropagation();
        var which = sl.dataset.size, val = Math.max(0.1, (+sl.value) / 100);
        setSizePref(which === 'orb' ? { orb: val } : { sheet: val });
        var vEl = box.querySelector('[data-size-v="' + which + '"]'); if (vEl) vEl.textContent = sl.value + '%';
        var tEl = host.tokenEl ? host.tokenEl(c.id) : null, lyr = tEl && tEl.querySelector('.torb-layer');
        if (lyr) layoutLayer(lyr, tEl.querySelector('.token-disc, .token-cutout') || tEl);
      });
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
    // Ingest an external characters-row change (realtime). If the row's vitals /
    // structural differ from the cached record we update it and re-bloom the open
    // ring for that key. A self-echo (orb already wrote the new value optimistically,
    // so cache === row) compares equal and no-ops — no animation replay, no flicker.
    applyRow: function (key, row) {
      if (!key || !row) return;
      var rec = CHAR_CACHE[key]; if (!rec) return;          // nothing cached → nothing open for it
      var vNew = JSON.stringify(row.vitals != null ? row.vitals : null);
      var vOld = JSON.stringify(rec.vitals != null ? rec.vitals : null);
      var sNew = JSON.stringify(row.structural != null ? row.structural : null);
      var sOld = JSON.stringify(rec.structural != null ? rec.structural : null);
      if (vNew === vOld && sNew === sOld) return;            // redundant / self echo → no-op
      if (row.vitals !== undefined) rec.vitals = row.vitals;
      if (row.structural !== undefined) rec.structural = row.structural;
      if (activeTok && activeC && activeC.source_key === key && activeTok.querySelector('.torb-layer')) {
        bloom(activeC, activeTok, activeHost || {}, rec);    // re-render the live ring from fresh data
      }
    },
    _invalidate: function (key) { if (key) delete CHAR_CACHE[key]; else CHAR_CACHE = {}; }
  };
})();
