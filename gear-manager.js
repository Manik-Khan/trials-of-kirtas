// gear-manager.js — the integrated inventory manifest for the v11 sheet.
//
// Renders the ONE manifest below the equip paper-doll as the full gear manager:
// List <-> Grid, worn-first with slot tags, bags that expand in place, and an
// item DETAIL that expands in place (stats grid + 5etools rules text + flavor).
// Reads the CharacterData-shaped inventory + currency. The equip/unequip/attune
// controls keep the existing .eq-pill + data-eq/data-un/data-at contract, so
// sheet-actions.js still drives them and the .can-edit gate still applies.
//
// INCREMENT 1 = render spine + read interactions (view toggle, bag/detail
// expand). Writes (edit form, lock, editable currency/flavor, drag, 5etools
// add) arrive in later increments and will hang off the same host.
//
// Self-contained: dual-mode export (window/globalThis/module) + self-injected
// CSS. The sheet self-loads it via sheet-mount.js's ensureDeps; when it is
// absent, renderEquipment falls back to its flat manifest, so nothing breaks.
(function () {
  'use strict';

  var DMG = { B: 'bludgeoning', P: 'piercing', S: 'slashing', A: 'acid', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic', I: 'poison', Y: 'psychic', R: 'radiant', T: 'thunder' };

  function esc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function num(x) { var n = parseFloat(x); return isNaN(n) ? 0 : n; }
  function keyOf(it, i) { return (it && it.id) ? ('id:' + it.id) : ('ix:' + i); }
  function qtyOf(it) { return (it && it.qty && it.qty > 1) ? it.qty : 1; }

  // Fallback glyphs, used only when item-icons.js (window.ItemIcons) is absent.
  var IC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h9l4 4v14H6z"/><path d="M9 8h7M9 12h7M9 16h5"/></svg>';
  var BAGIC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 7V6a4 4 0 018 0v1M4 7h16l-1.4 13H5.4z"/></svg>';

  // Per-item icon: prefer the curated game-icons set (iconFor honours a custom
  // it.icon, else detects by category); degrade to the fallback glyph if absent.
  function iconHtml(it) {
    if (typeof window !== 'undefined' && window.ItemIcons) {
      try { return window.ItemIcons.iconSvg(window.ItemIcons.iconFor(it), 18); } catch (e) {}
    }
    return (it && it.isContainer) ? BAGIC : IC;
  }

  // Lock glyphs — the pill (toggle) and the always-on row/tile indicator.
  var LOCKG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  var UNLOCKG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 017.5-2.2"/></svg>';
  var COGG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M3 12h2M19 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4"/></svg>';

  // ── carry weight: every item counts, bag contents included (they're items) ──
  function totalWeight(inv) {
    var w = 0;
    for (var i = 0; i < inv.length; i++) { var it = inv[i]; if (it) w += num(it.weight) * qtyOf(it); }
    return Math.round(w * 100) / 100;
  }

  // ── the expandable DETAIL: stats grid + properties + rules text + flavor ──
  function statRows(it) {
    var r = [];
    if (it.price) r.push(['Price', it.price]);
    if (it.dmg1 && it.dmgType) r.push(['Damage', it.dmg1 + ' ' + (DMG[it.dmgType] || it.dmgType) + (it.dmg2 ? ' / ' + it.dmg2 : '')]);
    if (it.dmgBonus) r.push(['Bonus', it.dmgBonus]);
    if (it.extraDmg && it.extraDmg.dice) r.push(['Extra', it.extraDmg.dice + ' ' + (DMG[it.extraDmg.type] || it.extraDmg.type || '')]);
    if (it.range) r.push(['Range', it.range + ' ft']);
    if (it.ac != null) r.push(['AC', it.ac]);
    if (it.strength) r.push(['Str req', it.strength]);
    if (it.stealth) r.push(['Stealth', 'Disadvantage']);
    if (it.weight) r.push(['Weight', it.weight + ' lb']);
    if (qtyOf(it) > 1) r.push(['Qty', it.qty]);
    if (it.reqAttune) r.push(['Attune', it.reqAttune === true ? 'required' : it.reqAttune]);
    if (it.attackStat) r.push(['Attack', it.attackStat]);
    if (it.alias) r.push(['Base item', it.alias]);
    if (it.sourceFull || it.source) r.push(['Source', it.sourceFull || it.source]);
    return r;
  }
  // body of the detail (no wrapper, no Edit button) — shared by the inventory
  // detail AND the 5etools add-search result detail.
  function detailBody(it) {
    var cat = (it.weaponCat || it.typeLabel) ? '<div class="gm-d-cat">' + esc(it.weaponCat || it.typeLabel) + '</div>' : '';
    var rar = (it.rarity && it.rarity !== 'None') ? '<div class="gm-d-rar">' + esc(it.rarity) + '</div>' : '';
    var stats = statRows(it);
    var statsHtml = stats.length ? '<div class="gm-d-stats">' + stats.map(function (s) {
      return '<div class="gm-d-stat"><span>' + esc(s[0]) + '</span><span>' + esc(String(s[1])) + '</span></div>';
    }).join('') + '</div>' : '';
    var props = Array.isArray(it.properties) ? it.properties : [];
    var propsHtml = props.length ? '<div class="gm-d-sec">Properties</div>' + props.map(function (p) {
      var nm = p && p.name ? p.name : p; var desc = p && p.desc ? '<span class="gm-d-pd"> ' + esc(p.desc) + '</span>' : '';
      return '<div class="gm-d-prop"><b>' + esc(nm) + '.</b>' + desc + '</div>';
    }).join('') : '';
    var entries = Array.isArray(it.entries) ? it.entries.filter(function (e) { return typeof e === 'string'; }) : [];
    var desc = entries.length ? '<div class="gm-d-sec">Description</div><div class="gm-d-desc">' + entries.map(function (e) { return '<p>' + esc(e) + '</p>'; }).join('') + '</div>' : '';
    var flavor = it.flavor ? '<div class="gm-d-sec">Flavor / Notes</div><div class="gm-d-flavor">' + esc(it.flavor) + '</div>' : '';
    var notes = it.notes ? '<div class="gm-d-sec">Notes</div><div class="gm-d-flavor">' + esc(it.notes) + '</div>' : '';
    var body = cat + rar + statsHtml + propsHtml + desc + flavor + notes;
    return body || '<div class="gm-d-empty">No further detail.</div>';
  }
  function detailHtml(it, k) {
    var edit = (k != null) ? '<div class="gm-d-edit"><button class="gm-d-editbtn" data-editopen="' + esc(k) + '">Edit item</button></div>' : '';
    return '<div class="gm-detail">' + detailBody(it) + edit + '</div>';
  }

  // ── 5etools "+ Add item" surface (Inc 3). GearManager owns the render of the
  // search panel + results (from a search-state held on box.__gmState.search);
  // sheet-actions.js owns the debounced items2 fetch + add/explode/enrich. The
  // results paint into [data-addresults] so the [data-addsearch] input is never
  // rebuilt mid-type (focus holds), mirroring the coin-input / edit-form model. ──
  var RARITY_COL = { 'None': '#9a9a9a', 'Common': '#9a9a9a', 'Uncommon': '#4a9a4a', 'Rare': '#4a6aaa', 'Very Rare': '#7a4aaa', 'Legendary': '#b8952a', 'Artifact': '#c8432a' };
  function rarCol(r) { return RARITY_COL[r] || '#9a9a9a'; }
  var MAGIC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>';
  function searchResultsHtml(st) {
    var s = (st && st.search) || {};
    var q = (s.q || '').trim();
    if (q.length < 2) return '<div class="gm-add-hint">Type at least 2 characters to search the compendium\u2026</div>';
    if (s.loading) return '<div class="gm-add-state">Searching\u2026</div>';
    if (s.error) return '<div class="gm-add-state err">' + esc(s.error) + '</div>';
    var res = Array.isArray(s.results) ? s.results : [];
    if (!res.length) return '<div class="gm-add-state">No items found for \u201C' + esc(q) + '\u201D.</div>';
    return res.map(function (it, i) {
      var open = s.open === i, added = !!it.__added;
      var col = rarCol(it.rarity);
      var rar = (it.rarity && it.rarity !== 'None') ? '<span class="gm-ares-rar" style="color:' + col + ';border-color:' + col + '">' + esc(it.rarity) + '</span>' : '';
      var isPack = Array.isArray(it.packContents) && it.packContents.length > 0;
      var detail = open ? ('<div class="gm-ares-detail">' + detailBody(it)
        + '<div class="gm-add-foot"><button class="gm-add-confirm" data-additem="' + i + '"><span class="plus">+</span>' + (added ? 'Added \u2713' : 'Add to inventory') + '</button>'
        + (isPack ? '<span class="gm-add-pack-note">Unpacks into a bag with its ' + it.packContents.length + ' contents</span>' : '') + '</div></div>') : '';
      return '<div class="gm-ares' + (open ? ' open' : '') + (added ? ' added' : '') + '">'
        + '<div class="gm-ares-row" data-addresult="' + i + '">'
          + '<span class="gm-ares-car">\u25B8</span>'
          + '<span class="gm-ares-ic">' + iconHtml(it) + '</span>'
          + '<span class="gm-ares-nm">' + esc(it.name || 'Item') + '</span>' + rar
          + '<span class="gm-ares-meta">' + esc(it.detail || it.typeLabel || '') + '</span>'
          + '<button class="gm-ares-quick" data-additem="' + i + '">' + (added ? '\u2713' : '+\u2009Add') + '</button>'
        + '</div>' + detail + '</div>';
    }).join('');
  }
  function addPanelHtml(st) {
    if (!st || !st.adding) return '';
    var q = (st.search && st.search.q) || '';
    return '<div class="gm-add">'
      + '<div class="gm-add-search"><span class="mag">' + MAGIC + '</span>'
        + '<input type="text" data-addsearch autocomplete="off" placeholder="Search items \u2014 longsword, potion, backpack\u2026" value="' + esc(q) + '"></div>'
      + '<div class="gm-add-results" data-addresults>' + searchResultsHtml(st) + '</div>'
    + '</div>';
  }

  // ── edit form + icon picker (ported from the approved mock; the picker reads
  // ItemIcons.CATEGORIES). The form renders from a draft held in box.__gmState;
  // sheet-actions.js owns the draft, the field writes, and Save/Cancel. ──
  var RARITIES = ['None', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
  function II() { return (typeof window !== 'undefined' ? window : globalThis).ItemIcons || null; }
  function pickerCatFor(it) {
    var ii = II(); if (!ii) return null;
    try { return ii.detectCategory(it); } catch (e) { return (ii.CATEGORIES && ii.CATEGORIES[0]) ? ii.CATEGORIES[0].id : null; }
  }
  function curIconId(it) { var ii = II(); if (!ii) return null; try { return ii.iconFor(it); } catch (e) { return null; } }
  function pickerHtml(it, st) {
    var ii = II(); if (!ii || !ii.CATEGORIES) return '';
    var cat = st.pickerCat || pickerCatFor(it), cur = curIconId(it);
    var tabs = ii.CATEGORIES.map(function (c) {
      return '<button class="ge-pk-tab' + (c.id === cat ? ' on' : '') + '" data-pkcat="' + esc(c.id) + '">' + esc(c.label) + '</button>';
    }).join('');
    var grp = null; for (var i = 0; i < ii.CATEGORIES.length; i++) { if (ii.CATEGORIES[i].id === cat) { grp = ii.CATEGORIES[i]; break; } }
    if (!grp) grp = ii.CATEGORIES[0];
    var cells = grp.icons.map(function (ic) {
      return '<button class="ge-pk-cell' + (ic === cur ? ' sel' : '') + '" data-pkpick="' + esc(ic) + '" title="' + esc(ic) + '">' + ii.iconSvg(ic, 24) + '</button>';
    }).join('');
    return '<div class="ge-picker"><div class="ge-pk-tabs">' + tabs + '</div><div class="ge-pk-grid">' + cells + '</div></div>';
  }
  // Combat fields apply only to weapons. 5etools tags weapons type 'M'/'R' and carries a
  // weaponCat / typeLabel containing "weapon" — gate on either (no weapons-table import needed).
  function isWeaponItem(it) {
    if (!it) return false;
    var t = String(it.type || '').toUpperCase();
    if (t === 'M' || t === 'R') return true;
    return /weapon/i.test(String(it.typeLabel || '')) || /weapon/i.test(String(it.weaponCat || ''));
  }
  var EDIT_ABILS = [['auto', 'Auto \u2014 from weapon & class'], ['str', 'Strength'], ['dex', 'Dexterity'], ['con', 'Constitution'], ['int', 'Intelligence'], ['wis', 'Wisdom'], ['cha', 'Charisma']];
  // The weapon-combat block: magic to-hit/damage bonuses, an extra-damage rider, and a pinned
  // attack ability. buildWeaponActions already reads item.atkBonus / dmgBonus / extraDmg / attackAbil.
  function combatSectionHtml(it) {
    var ex = it.extraDmg || {}, pinned = String(it.attackAbil || 'auto').toLowerCase();
    if (!pinned) pinned = 'auto';
    var abilOpts = EDIT_ABILS.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === pinned ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('');
    return '<div class="ge-combat">'
      + '<div class="ge-combat-h">Combat<span class="ln"></span></div>'
      + '<div class="ge-combat-sub">Leave bonuses at 0 for a mundane weapon. A +1 weapon \u2192 set both to 1; a flame tongue \u2192 add an extra-damage rider. Ability stays Auto (finesse \u2192 Dex, Hexblade \u2192 Cha\u2026); pin it for a specific weapon. These flow into the attack automatically.</div>'
      + '<div class="ge-fields">'
        + '<div class="ge-f"><label>Bonus to hit</label><input type="number" step="1" data-ef="atkBonus" value="' + (+it.atkBonus || 0) + '"></div>'
        + '<div class="ge-f"><label>Bonus to damage</label><input type="number" step="1" data-ef="dmgBonus" value="' + (+it.dmgBonus || 0) + '"></div>'
        + '<div class="ge-f wide"><label>Extra damage (rider)</label><div class="ge-two"><input type="text" data-ef="exDice" value="' + esc(ex.dice || '') + '" placeholder="1d6"><input type="text" data-ef="exType" value="' + esc(ex.type || '') + '" placeholder="Fire"></div></div>'
        + '<div class="ge-f wide"><label>Attack ability</label><select data-ef="attackAbil">' + abilOpts + '</select></div>'
      + '</div>'
    + '</div>';
  }
  function editFormHtml(it, st, inv) {
    var ii = II();
    var iconRow = ii
      ? '<div class="ge-iconrow"><div class="ge-swatch">' + ii.iconSvg(curIconId(it), 34) + '</div>'
        + '<div class="ge-iconmeta"><div class="lbl">Icon</div>'
        + '<button class="ge-changeicon' + (st.picker ? ' on' : '') + '" data-pktoggle="1">' + (st.picker ? 'Done choosing' : 'Change icon') + '</button></div></div>'
      : '';
    var picker = st.picker ? pickerHtml(it, st) : '';
    return '<div class="gm-edit">'
      + '<div class="ge-head"><span>Edit item</span><span class="nm">' + esc(it.name || 'Item') + '</span></div>'
      + iconRow + picker
      + '<div class="ge-fields">'
        + '<div class="ge-f wide"><label>Name</label><input data-ef="name" value="' + esc(it.name || '') + '"></div>'
        + '<div class="ge-f"><label>Quantity</label><input type="number" min="1" data-ef="qty" value="' + (it.qty || 1) + '"></div>'
        + '<div class="ge-f"><label>Weight (lb)</label><input type="number" min="0" step="0.1" data-ef="weight" value="' + (it.weight || 0) + '"></div>'
        + '<div class="ge-f"><label>Rarity</label><select data-ef="rarity">' + RARITIES.map(function (r) { return '<option' + (r === (it.rarity || 'None') ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>'
        + '<div class="ge-f"><label>Attunement</label><div class="ge-toggle' + (it.reqAttune ? ' on' : '') + '" data-eftoggle="reqAttune"><span class="box"></span><span>Requires attunement</span></div></div>'
        + '<div class="ge-f"><label>Container</label><div class="ge-toggle' + (it.isContainer ? ' on' : '') + '" data-eftoggle="isContainer"><span class="box"></span><span>Holds other items</span></div></div>'
        + '<div class="ge-f wide"><label>Flavor / Notes</label><textarea data-ef="flavor" placeholder="A line of description, history, or a table note\u2026">' + esc(it.flavor || '') + '</textarea></div>'
      + '</div>'
      + (isWeaponItem(it) ? combatSectionHtml(it) : '')
      + editFootHtml(it, st, inv)
    + '</div>';
  }
  // childcount for the spill warning; container delete/un-container moves these to the top level
  function kidCount(inv, it) { return (inv && it && it.id != null) ? childrenOf(inv, it.id).length : 0; }
  // the editor footer is normally Delete · Cancel · Save, but swaps to an inline confirm strip
  // when st.confirm is armed ('delete' from the Delete button, 'uncontain' from un-ticking
  // Container on a non-empty bag). The confirm's Yes routes by st.confirm in sheet-actions.
  function editFootHtml(it, st, inv) {
    var conf = st && st.confirm, n = kidCount(inv, it);
    if (conf === 'delete') {
      var dm = (it.isContainer && n > 0)
        ? 'Delete <b>' + esc(it.name || 'this') + '</b>? Its ' + n + ' item' + (n > 1 ? 's' : '') + ' move to your inventory.'
        : 'Delete <b>' + esc(it.name || 'this item') + '</b>? This can\u2019t be undone.';
      return '<div class="ge-confirm"><div class="ge-cmsg">' + dm + '</div>'
        + '<div class="ge-cbtns"><button class="ge-btn" data-conf-no="1">Keep</button>'
        + '<button class="ge-btn del" data-conf-yes="1">Delete</button></div></div>';
    }
    if (conf === 'uncontain') {
      return '<div class="ge-confirm"><div class="ge-cmsg">No longer a container? Its ' + n + ' item' + (n > 1 ? 's' : '') + ' move to your inventory.</div>'
        + '<div class="ge-cbtns"><button class="ge-btn" data-conf-no="1">Keep as container</button>'
        + '<button class="ge-btn del" data-conf-yes="1">Spill &amp; convert</button></div></div>';
    }
    return '<div class="ge-foot"><button class="ge-btn danger" data-edel="1">Delete</button>'
      + '<button class="ge-btn" data-ecancel="1">Cancel</button>'
      + '<button class="ge-btn primary" data-esave="1">Save changes</button></div>';
  }

  // ── equip / attune controls — same contract sheet-actions.js already binds ──
  function controls(it, idx, worn, ES, capFull) {
    var lock = '<button class="eq-pill icon lock' + (it.locked ? ' on' : '') + '" data-lock="' + idx + '" title="' + (it.locked ? 'Locked \u2014 tap to unlock' : 'Lock this row') + '">' + (it.locked ? LOCKG : UNLOCKG) + '</button>';
    if (!ES) return lock;
    var att = '';
    if (it.reqAttune) {
      if (it.attuned) att = '<button class="eq-pill on" data-at="' + idx + '" title="Attuned \u2014 tap to release">\u2726 Attuned</button>';
      else if (capFull) att = '<button class="eq-pill capped" data-at="' + idx + '" title="Attunement limit reached">\u2726 Attune</button>';
      else att = '<button class="eq-pill" data-at="' + idx + '">\u2726 Attune</button>';
    }
    var eq = worn
      ? '<button class="eq-pill x" data-un="' + esc(it.slot) + '">Unequip</button>'
      : (ES.canEquip(it) ? '<button class="eq-pill" data-eq="' + idx + '">Equip</button>' : '');
    return eq + att + lock;
  }

  function slotLabel(ES, key) { var m = ES ? ES.SLOTS.filter(function (x) { return x.key === key; })[0] : null; return m ? m.label : key; }

  // ── a single LIST row (+ its detail / children when open) ──
  function rowHtml(it, idx, inv, ES, st, capFull) {
    var isBag = !!it.isContainer, worn = !!it.slot, k = keyOf(it, idx), open = !!st.open[k];
    var caret = isBag
      ? '<span class="gm-exp' + (open ? ' open' : '') + '" data-tog="' + esc(k) + '">\u25B8</span>'
      : '<span class="gm-caret' + (open ? ' open' : '') + '">\u25B8</span>';
    var star = it.attuned ? '<span class="gm-star">\u2726</span>' : '';
    var mid = worn
      ? '<span class="inv-tag">' + esc(slotLabel(ES, it.slot)) + '</span>'
      : '<span class="gm-d">' + esc(it.detail || it.typeLabel || it.rarity || '') + '</span>';
    var qty = qtyOf(it) > 1 ? '<span class="gm-q">\u00D7' + it.qty + '</span>' : '';
    var count = isBag ? '<span class="gm-q">\u00b7 ' + childrenOf(inv, it.id).length + ' items</span>' : '';
    var ctl = '<span class="gm-ctl">' + controls(it, idx, worn, ES, capFull) + '</span>';
    var row = '<div class="gm-row' + (worn ? ' worn' : '') + (it.attuned ? ' attuned' : '') + (it.locked ? ' locked' : '') + '" data-row="' + esc(k) + '"' + (isBag ? '' : ' data-detail="' + esc(k) + '"') + '>'
      + '<span class="gm-grip" data-grip="' + esc(k) + '">\u283F</span>' + caret
      + '<span class="gm-ic">' + iconHtml(it) + '</span>'
      + '<span class="gm-n">' + esc(it.name || 'Item') + '</span>' + star + (it.locked ? '<span class="gm-lockg">' + LOCKG + '</span>' : '') + count + qty + mid + ctl + (isBag ? '<button class="gm-cog" data-editopen="' + esc(k) + '" title="Edit / delete this bag">' + COGG + '</button>' : '') + (isBag ? '<span class="bagdrop-hint">file here</span>' : '') + '</div>';
    var below = '';
    if (st.editing === k) {
      below = editFormHtml(st.draft || it, st, inv);
    } else if (open) {
      if (isBag) {
        var kids = childrenOf(inv, it.id);
        below = '<div class="gm-children">' + (kids.length
          ? kids.map(function (c) { return rowHtml(c.it, c.i, inv, ES, st, capFull); }).join('')
          : '<div class="gm-bag-empty">Empty</div>') + '</div>';
      } else {
        below = detailHtml(it, k);
      }
    }
    return '<div class="gm-item">' + row + below + '</div>';
  }

  function childrenOf(inv, bagId) {
    var out = [];
    for (var i = 0; i < inv.length; i++) { if (inv[i] && (inv[i].containerId || null) === (bagId || null)) out.push({ it: inv[i], i: i }); }
    return out;
  }

  function listHtml(inv, ES, st, capFull) {
    var order = {}; if (ES) ES.SLOTS.forEach(function (s, i) { order[s.key] = i; });
    var top = childrenOf(inv, null);
    if (ES) top.sort(function (a, b) {
      var aw = a.it.slot ? 0 : 1, bw = b.it.slot ? 0 : 1;
      if (aw !== bw) return aw - bw;
      if (a.it.slot && b.it.slot) return (order[a.it.slot] || 0) - (order[b.it.slot] || 0);
      return a.i - b.i;
    });
    if (!top.length) return '<div class="gm-row" style="opacity:.5"><span class="gm-n">No equipment yet</span></div>';
    var dividerDone = false, html = '';
    top.forEach(function (r) {
      if (ES && !r.it.slot && !dividerDone) { dividerDone = true; html += '<div class="inv-div">Carried</div>'; }
      html += rowHtml(r.it, r.i, inv, ES, st, capFull);
    });
    return html;
  }

  // ── GRID: tiles, with a full-width detail that drops in under the clicked row ──
  function gridHtml(inv, ES, st, capFull) {
    var order = {}; if (ES) ES.SLOTS.forEach(function (s, i) { order[s.key] = i; });
    var top = childrenOf(inv, null);
    if (ES) top.sort(function (a, b) {
      var aw = a.it.slot ? 0 : 1, bw = b.it.slot ? 0 : 1;
      if (aw !== bw) return aw - bw;
      if (a.it.slot && b.it.slot) return (order[a.it.slot] || 0) - (order[b.it.slot] || 0);
      return a.i - b.i;
    });
    var COLS = 4, openKey = null;
    // openKey must be a TOP-LEVEL item: a bag and a child within it can both be
    // open in st.open, but only the top-level one drops a full-width detail here
    // (the child then expands inside that detail via rowHtml's own open check).
    var topKeys = Object.create(null);
    top.forEach(function (r) { topKeys[keyOf(r.it, r.i)] = true; });
    Object.keys(st.open).forEach(function (kk) { if (st.open[kk] && topKeys[kk]) openKey = kk; });
    var cells = top.map(function (r) {
      var it = r.it, isBag = !!it.isContainer, k = keyOf(it, r.i), worn = !!it.slot;
      var tag = worn ? '<span class="gm-ttag">' + esc(slotLabel(ES, it.slot)) + '</span>' : '';
      var att = it.attuned ? '<span class="gm-tatt">\u2726</span>' : '';
      var lk = it.locked ? '<span class="gm-tlock">' + LOCKG + '</span>' : '';
      var qty = qtyOf(it) > 1 ? '<span class="gm-tqty">\u00D7' + it.qty + '</span>' : '';
      var meta = isBag ? (childrenOf(inv, it.id).length + ' items') : (it.weaponCat || it.typeLabel || (it.weight ? it.weight + ' lb' : ''));
      return '<div class="gm-tile' + (worn ? ' worn' : '') + (isBag ? ' bag' : '') + (it.locked ? ' locked' : '') + (openKey === k ? ' sel' : '') + '" data-tile="' + esc(k) + '">'
        + '<span class="gm-tgrip" data-grip="' + esc(k) + '">\u283F</span>'
        + (isBag ? '<button class="gm-cog" data-editopen="' + esc(k) + '" title="Edit / delete this bag">' + COGG + '</button>' : '')
        + tag + att + lk + qty + '<span class="gm-ti">' + iconHtml(it) + '</span>'
        + '<span class="gm-tn">' + esc(it.name || 'Item') + '</span><span class="gm-tm">' + esc(meta) + '</span></div>';
    });
    // inject the open item's detail as a full-width row after its grid row
    if (openKey != null) {
      var oi = top.map(function (r) { return keyOf(r.it, r.i); }).indexOf(openKey);
      if (oi >= 0) {
        var item = top[oi].it;
        var detail = (st.editing === openKey)
          ? editFormHtml(st.draft || item, st, inv)
          : (item.isContainer
              ? '<div class="gm-children">' + (childrenOf(inv, item.id).length
                  ? childrenOf(inv, item.id).map(function (c) { return rowHtml(c.it, c.i, inv, ES, st, capFull); }).join('')
                  : '<div class="gm-bag-empty">Empty</div>') + '</div>'
              : detailHtml(item, openKey));
        var endOfRow = (Math.floor(oi / COLS) + 1) * COLS;
        if (endOfRow > cells.length) endOfRow = cells.length;
        cells.splice(endOfRow, 0, '<div class="gm-grid-detail">' + detail + '</div>');
      }
    }
    return '<div class="gm-grid">' + cells.join('') + '</div>';
  }

  // ── money model (5e 2014, electrum kept) — pure, shared by the footer +
  // the loot splitter. Internally everything is copper; coins consolidate with a
  // greedy round-down that KEEPS ep (50cp) since it only ever reduces coin count. ──
  var COIN_RATE = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
  var COIN_ORDER = ['pp', 'gp', 'ep', 'sp', 'cp'];
  var COIN_LEGEND = { pp: '1 pp = 10 gp = 1000 cp', gp: '1 gp = 2 ep = 10 sp = 100 cp', ep: '1 ep = 5 sp = 50 cp', sp: '1 sp = 10 cp', cp: '1 cp = base unit' };
  function coinCopper(o) { o = o || {}; return COIN_ORDER.reduce(function (s, k) { return s + (parseInt(o[k], 10) || 0) * COIN_RATE[k]; }, 0); }
  function coinConsolidate(c) { var out = {}; COIN_ORDER.forEach(function (k) { out[k] = Math.floor(c / COIN_RATE[k]); c -= out[k] * COIN_RATE[k]; }); return out; }
  function coinGp(c) { return (c / 100).toFixed(2).replace(/\.?0+$/, ''); }
  function worthStr(cur) { return coinGp(coinCopper(cur)); }
  function splitShare(loot, ways, convert) {
    ways = Math.max(1, ways | 0);
    var total = coinCopper(loot);
    if (convert) {   // "money-changer" — pool to copper + consolidate to optimal coins (MAY mint higher denominations not in the pile)
      var per = Math.floor(total / ways), rem = total - per * ways;
      return { share: coinConsolidate(per), per: per, rem: rem, remCoins: coinConsolidate(rem), total: total, ways: ways, convert: true };
    }
    // default — divide each coin type on its own; never invents a denomination that wasn't in the pile (no real-time conversion)
    var share = {}, remCoins = {};
    COIN_ORDER.forEach(function (k) { var n = parseInt(loot[k], 10) || 0; share[k] = Math.floor(n / ways); remCoins[k] = n - share[k] * ways; });
    return { share: share, per: coinCopper(share), rem: coinCopper(remCoins), remCoins: remCoins, total: total, ways: ways, convert: false };
  }
  function coinLineHtml(o) {
    var p = []; COIN_ORDER.forEach(function (k) { if (o[k] > 0) p.push('<span class="cl-c">' + o[k] + '<span class="cl-u">' + k + '</span></span>'); });
    return p.length ? p.join('<span class="cl-dot">\u00b7</span>') : '<span class="cl-c">0<span class="cl-u">cp</span></span>';
  }
  function splitOutHtml(loot, ways, names, convert) {
    var r = splitShare(loot, ways, convert);
    var rem = (r.rem > 0)
      ? '<div class="gm-sp-rem">leftover ' + coinLineHtml(r.remCoins) + ' \u2014 to the pot or one player</div>'
      : '<div class="gm-sp-rem even">splits evenly \u2014 nothing left over</div>';
    var chips = '';
    for (var i = 0; i < r.ways; i++) { var nm = (names && names[i]) ? names[i] : ('Share ' + (i + 1)); chips += '<span class="gm-sp-chip">' + esc(nm) + '</span>'; }
    return '<div class="gm-sp-each">each share</div>'
      + '<div class="gm-sp-coins">' + coinLineHtml(r.share) + '</div>'
      + '<div class="gm-sp-worth">each \u2248 <b>' + coinGp(r.per) + '</b> gp \u00b7 ' + r.ways + ' ways \u00b7 pile \u2248 ' + coinGp(r.total) + ' gp</div>'
      + rem
      + '<div class="gm-sp-names">' + chips + '</div>'
      + '<div class="gm-sp-take"><button class="gm-sp-takebtn" data-takemine="1">Take my share</button></div>';
  }

  function currencyHtml(cur) {
    return '<div class="gm-currency">' + COIN_ORDER.map(function (k) {
      var v = cur[k] || 0;
      return '<div class="gm-coin ' + k + '"><span class="v">' + v + '</span>'
        + '<div class="gm-coin-step">'
          + '<button class="gm-cs" data-cstep="-1" data-coin="' + k + '" tabindex="-1" type="button">\u2212</button>'
          + '<input type="number" min="0" data-coin="' + k + '" value="' + v + '">'
          + '<button class="gm-cs" data-cstep="1" data-coin="' + k + '" tabindex="-1" type="button">+</button>'
        + '</div>'
        + '<span class="k">' + k + '</span>'
        + '<div class="gm-coin-leg">' + COIN_LEGEND[k] + '</div>'
      + '</div>';
    }).join('') + '</div>';
  }

  // the footer: the coin row (+ steppers + worth + hover legend) and the loot
  // Split panel. Split state lives on st.split; the controller owns the math's
  // side effects (persist, take-my-share) and repaints [data-splitout] with live
  // party names — here we render the shell + a names-less initial breakdown.
  function currencyFootHtml(cur, st) {
    var sp = st.split || (st.split = { open: false, loot: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, ways: 4, convert: false });
    var loot = sp.loot || (sp.loot = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
    var ways = sp.ways || 4;
    var lootInputs = COIN_ORDER.map(function (k) {
      return '<div class="gm-sl"><input type="number" min="0" data-loot="' + k + '" value="' + (loot[k] || 0) + '"><span>' + k + '</span></div>';
    }).join('');
    return '<div class="gm-currency-foot">'
      + currencyHtml(cur)
      + '<div class="gm-cur-tools">'
        + '<button class="gm-split-btn' + (sp.open ? ' on' : '') + '" data-splittoggle="1" type="button">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M8 7l8 4M8 17l8-4"/></svg>'
          + 'Split loot</button>'
        + '<span class="gm-cur-worth">Total \u2248 <b data-worth>' + worthStr(cur) + '</b> gp</span>'
      + '</div>'
      + '<div class="gm-split' + (sp.open ? ' open' : '') + '" data-splitpanel>'
        + '<div class="gm-split-h"><span>Split the pile</span><a data-usemine="1">use my coins \u2198</a></div>'
        + '<div class="gm-split-loot">' + lootInputs + '</div>'
        + '<div class="gm-split-ways"><span class="lab">ways</span><div class="gm-ways"><button data-waysdn="1" tabindex="-1" type="button">\u2212</button><span class="n" data-waysn>' + ways + '</span><button data-waysup="1" tabindex="-1" type="button">+</button></div></div>'
        + '<label class="gm-sp-conv"><input type="checkbox" data-convert' + (sp.convert ? ' checked' : '') + '> convert to best coins (money-changer)</label>'
        + '<div class="gm-split-out" data-splitout>' + splitOutHtml(loot, ways, null, sp.convert) + '</div>'
      + '</div>'
    + '</div>';
  }

  function render(box, ctx) {
    if (!box) return;
    box.__gmCtx = ctx;
    var st = box.__gmState || (box.__gmState = { view: 'list', open: Object.create(null), editing: null, picker: false, pickerCat: null, draft: null, adding: false, search: null, split: null });
    var inv = Array.isArray(ctx.inventory) ? ctx.inventory : [];
    var cur = ctx.currency || {};
    var ES = ctx.ES || null;
    var attunedN = inv.filter(function (it) { return it && it.attuned; }).length;
    var capFull = attunedN >= 3;
    var tw = totalWeight(inv);
    var cap = ctx.strScore ? ctx.strScore * 15 : 0;
    var pct = cap ? Math.min(100, Math.round((tw / cap) * 100)) : 0;
    var carryRight = cap ? ('<b>' + tw + '</b> / ' + cap + ' lb') : ('<b>' + tw + '</b> lb');
    var bar = cap ? '<div class="gm-carry-wrap"><div class="gm-carry-bar" style="width:' + pct + '%"></div></div>' : '';
    var count = inv.length + ' item' + (inv.length === 1 ? '' : 's') + (attunedN ? ' \u00b7 ' + attunedN + ' attuned' : '');

    box.classList.add('gm');
    box.innerHTML =
      '<div class="gm-toolbar">'
        + '<span class="gm-count">' + count + '</span><span class="gm-sp"></span>'
        + '<button class="gm-add-btn' + (st.adding ? ' on' : '') + '" data-addtoggle="1"><span class="plus">+</span>' + (st.adding ? 'Done' : 'Add Item') + '</button>'
        + '<div class="gm-view">'
          + '<button class="gm-vb' + (st.view === 'list' ? ' on' : '') + '" data-view="list">List</button>'
          + '<button class="gm-vb' + (st.view === 'grid' ? ' on' : '') + '" data-view="grid">Grid</button>'
        + '</div>'
      + '</div>'
      + addPanelHtml(st)
      + '<div class="gm-meta">'
        + '<div class="gm-carry"><div class="gm-carry-face"><span>Carry</span><span>' + carryRight + '</span></div>' + bar + '</div>'
      + '</div>'
      + (st.view === 'grid' ? gridHtml(inv, ES, st, capFull) : listHtml(inv, ES, st, capFull))
      + currencyFootHtml(cur, st);
  }

  // one-time event delegation: view toggle + bag/detail expand. (Equip lives in
  // sheet-actions.js; its data-eq/-un/-at handlers fire on the same host.)
  function bind(box) {
    if (!box || box.__gmBound) return;
    box.__gmBound = true;
    box.addEventListener('click', function (e) {
      var ctx = box.__gmCtx; if (!ctx) return;
      var st = box.__gmState;
      var vb = e.target.closest ? e.target.closest('[data-view]') : null;
      if (vb && box.contains(vb)) { st.view = vb.getAttribute('data-view'); render(box, ctx); return; }
      // ignore clicks on the equip/attune pills (sheet-actions owns those)
      if (e.target.closest && e.target.closest('.eq-pill')) return;
      var tile = e.target.closest ? e.target.closest('[data-tile]') : null;
      if (tile && box.contains(tile)) {
        var tk = tile.getAttribute('data-tile'); var was = !!st.open[tk];
        st.open = Object.create(null); if (!was) st.open[tk] = true; render(box, ctx); return;
      }
      var row = e.target.closest ? e.target.closest('[data-row]') : null;
      if (row && box.contains(row)) {
        var rk = row.getAttribute('data-row');
        // bag rows toggle their subtree; non-bag rows toggle their detail
        st.open[rk] = !st.open[rk]; render(box, ctx); return;
      }
    });
  }

  // ── self-injected CSS (dark sheet aesthetic; reuses .eq-pill/.inv-tag/.inv-div) ──
  function injectCss(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null); if (!doc || doc.getElementById('tok-gm-css')) return;
    var s = doc.createElement('style'); s.id = 'tok-gm-css'; s.textContent =
      '.tok-sheet .gm{display:block}' +
      '.tok-sheet .gm-toolbar{display:flex;align-items:center;gap:10px;margin:0 0 11px}' +
      '.tok-sheet .gm-count{font:500 10px/1 "Oswald",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8d8675}' +
      '.tok-sheet .gm-sp{flex:1}' +
      '.tok-sheet .gm-view{display:flex;border:1px solid rgba(199,154,74,.45);border-radius:3px;overflow:hidden}' +
      '.tok-sheet .gm-vb{font:500 10px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8d8675;background:transparent;border:0;padding:5px 12px;cursor:pointer}' +
      '.tok-sheet .gm-vb+ .gm-vb{border-left:1px solid rgba(199,154,74,.45)}' +
      '.tok-sheet .gm-vb:hover{color:#f9f3e6}' +
      '.tok-sheet .gm-vb.on{background:rgba(199,154,74,.20);color:#e7c279}' +
      '.tok-sheet .gm-meta{display:flex;align-items:stretch;gap:16px;margin:0 0 12px;flex-wrap:wrap}' +
      '.tok-sheet .gm-carry{flex:1 1 240px;min-width:200px}' +
      '.tok-sheet .gm-carry-face{display:flex;justify-content:space-between;font:400 10px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8d8675;margin:0 0 5px}' +
      '.tok-sheet .gm-carry-face b{color:#f9f3e6;font-weight:600}' +
      '.tok-sheet .gm-carry-wrap{height:6px;border-radius:4px;background:rgba(236,226,205,.10);overflow:hidden}' +
      '.tok-sheet .gm-carry-bar{height:100%;background:linear-gradient(90deg,#c79a4a,#e7c279);border-radius:4px}' +
      '.tok-sheet .gm-currency{display:flex;gap:10px;align-items:center}' +
      '.tok-sheet .gm-coin{display:flex;flex-direction:column;align-items:center;gap:1px}' +
      '.tok-sheet .gm-coin .v{font-family:"EB Garamond",serif;font-size:16px;color:#f9f3e6}' +
      '.tok-sheet .gm-coin .k{font:500 8.5px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8d8675}' +
      '.tok-sheet .gm-coin.gp .v{color:#e7c279}.tok-sheet .gm-coin.gp .k{color:#c79a4a}' +
      '.tok-sheet .gm-coin input{display:none}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-coin .v{display:none}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-coin input{display:block;width:42px;text-align:center;background:rgba(236,226,205,.06);border:1px solid rgba(236,226,205,.13);border-bottom:1px solid rgba(199,154,74,.5);border-radius:3px;color:#f9f3e6;font-family:"EB Garamond",serif;font-size:15px;padding:2px 0}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-coin.gp input{color:#e7c279}' +
      '.tok-sheet .gm-coin input::-webkit-outer-spin-button,.tok-sheet .gm-coin input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}' +
      '.tok-sheet .gm-coin input:focus{outline:none;border-bottom-color:#e7c279;background:rgba(199,154,74,.10)}' +
      '.tok-sheet .gm-currency-foot{display:flex;flex-direction:column;align-items:center;margin:18px 0 2px;padding-top:14px;border-top:1px solid rgba(236,226,205,.10)}' +
      '.tok-sheet .eq-pill.icon{padding:4px 6px;line-height:0}' +
      '.tok-sheet .eq-pill.lock{color:#8d8675;border-color:rgba(141,134,117,.4);background:transparent}' +
      '.tok-sheet .eq-pill.lock:hover{color:#e7c279;border-color:rgba(199,154,74,.5)}' +
      '.tok-sheet .eq-pill.lock.on{color:#e7c279;border-color:rgba(199,154,74,.55);background:rgba(199,154,74,.12)}' +
      '.tok-sheet .gm-lockg{color:rgba(199,154,74,.55);display:inline-flex;flex-shrink:0}' +
      '.tok-sheet .gm-row.locked .gm-grip{color:transparent !important;cursor:default}' +
      '.tok-sheet .gm-tlock{position:absolute;bottom:6px;left:7px;color:rgba(199,154,74,.6);display:inline-flex}' +
      '.tok-sheet .gm-row{display:flex;align-items:center;gap:9px;padding:8px 4px;border-bottom:1px solid rgba(236,226,205,.08);cursor:pointer}' +
      '.tok-sheet .gm-row:hover{background:rgba(199,154,74,.05)}' +
      '.tok-sheet .gm-grip{width:10px;color:rgba(199,154,74,.22);font-size:12px;flex-shrink:0;cursor:grab;touch-action:none}' +
      '.tok-sheet [data-sec="inventory"]:not(.can-edit) .gm-grip{display:none}' +
      '.tok-sheet .gm-row:hover .gm-grip{color:rgba(199,154,74,.5)}' +
      '.tok-sheet .gm-caret,.tok-sheet .gm-exp{width:11px;flex-shrink:0;color:rgba(199,154,74,.55);font-size:11px;transition:transform .15s;display:inline-block}' +
      '.tok-sheet .gm-caret.open,.tok-sheet .gm-exp.open{transform:rotate(90deg);color:#e7c279}' +
      '.tok-sheet .gm-ic{width:18px;color:rgba(199,154,74,.5);flex-shrink:0;display:inline-flex}' +
      '.tok-sheet .gm-n{font-family:"EB Garamond",serif;font-size:16px;color:#f9f3e6}' +
      '.tok-sheet .gm-row.worn .gm-n{color:#e7c279;font-weight:500}' +
      '.tok-sheet .gm-star{color:#e7c279;font-size:12px;flex-shrink:0}' +
      '.tok-sheet .gm-q{font:400 10px/1 "Oswald",sans-serif;letter-spacing:.05em;color:#8d8675;flex-shrink:0}' +
      '.tok-sheet .gm-d{margin-left:auto;font-family:"EB Garamond",serif;font-style:italic;font-size:12.5px;color:#8d8675;white-space:nowrap}' +
      '.tok-sheet .gm-row .inv-tag{margin-left:auto}' +
      '.tok-sheet .gm-ctl{display:inline-flex;gap:5px;flex-shrink:0;margin-left:8px}' +
      '.tok-sheet .gm-children{padding:1px 0 5px 26px}' +
      '.tok-sheet .gm-children .gm-item .gm-row{border-bottom:1px solid rgba(236,226,205,.05)}' +
      '.tok-sheet .gm-bag-empty{font-family:"EB Garamond",serif;font-style:italic;font-size:12.5px;color:#8d8675;padding:5px 6px}' +
      '.tok-sheet .gm-detail{background:rgba(6,14,13,.5);border-top:1px solid rgba(199,154,74,.3);border-left:2px solid rgba(199,154,74,.4);padding:11px 15px 13px 28px}' +
      '.tok-sheet .gm-d-cat{font:500 9.5px/1.3 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8d8675;margin:0 0 3px}' +
      '.tok-sheet .gm-d-rar{display:inline-block;font:500 8.5px/1 "Oswald",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#e7c279;border:1px solid rgba(199,154,74,.5);border-radius:2px;padding:2px 6px;margin:0 0 9px}' +
      '.tok-sheet .gm-d-stats{display:flex;flex-wrap:wrap;gap:5px 7px;margin:0 0 10px}' +
      '.tok-sheet .gm-d-stat{display:flex;gap:6px;align-items:baseline;background:rgba(236,226,205,.05);border:1px solid rgba(236,226,205,.10);border-radius:3px;padding:2px 8px}' +
      '.tok-sheet .gm-d-stat span:first-child{font:500 8.5px/1 "Oswald",sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8d8675}' +
      '.tok-sheet .gm-d-stat span:last-child{font-family:"EB Garamond",serif;font-size:14px;color:#f9f3e6}' +
      '.tok-sheet .gm-d-sec{font:500 9px/1 "Oswald",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#c79a4a;margin:10px 0 4px}' +
      '.tok-sheet .gm-d-prop{margin:0 0 3px}.tok-sheet .gm-d-prop b{font:600 11px/1.3 "Oswald",sans-serif;letter-spacing:.03em;color:#e7c279}' +
      '.tok-sheet .gm-d-pd{font-family:"EB Garamond",serif;font-size:13px;color:#c2b99f}' +
      '.tok-sheet .gm-d-desc{font-family:"EB Garamond",serif;font-size:14.5px;color:#ece2cd;line-height:1.5}.tok-sheet .gm-d-desc p{margin:0 0 7px}' +
      '.tok-sheet .gm-d-flavor{font-family:"EB Garamond",serif;font-style:italic;font-size:13.5px;color:#c2b99f;line-height:1.45}' +
      '.tok-sheet .gm-d-empty{font-family:"EB Garamond",serif;font-style:italic;font-size:13px;color:#8d8675}' +
      '.tok-sheet .gm-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}' +
      '.tok-sheet .gm-tile{position:relative;border:1px solid rgba(236,226,205,.13);border-radius:4px;padding:12px 7px 9px;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(6,14,13,.5);cursor:pointer;min-height:90px;justify-content:center}' +
      '.tok-sheet .gm-tile:hover{border-color:rgba(199,154,74,.45);background:rgba(199,154,74,.07)}' +
      '.tok-sheet .gm-tile.worn{background:linear-gradient(170deg,rgba(199,154,74,.14),rgba(199,154,74,.04));border-color:rgba(199,154,74,.45)}' +
      '.tok-sheet .gm-tile.sel{border-color:#e7c279;box-shadow:0 0 0 1px #e7c279}' +
      '.tok-sheet .gm-ti{color:rgba(199,154,74,.7)}.tok-sheet .gm-tile.bag .gm-ti{color:#e7c279}' +
      '.tok-sheet .gm-tn{font-family:"EB Garamond",serif;font-size:13.5px;line-height:1.1;text-align:center;color:#f9f3e6}' +
      '.tok-sheet .gm-tm{font:500 8.5px/1.2 "Oswald",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#8d8675;text-align:center}' +
      '.tok-sheet .gm-ttag{position:absolute;top:5px;left:5px;font:500 7.5px/1 "Oswald",sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#e7c279;background:rgba(199,154,74,.16);border-radius:2px;padding:1px 4px}' +
      '.tok-sheet .gm-tatt{position:absolute;top:5px;right:6px;color:#e7c279;font-size:11px}' +
      '.tok-sheet .gm-tqty{position:absolute;bottom:6px;right:7px;font:500 9px/1 "Oswald",sans-serif;color:#8d8675}' +
      '.tok-sheet .gm-grid-detail{grid-column:1 / -1;background:rgba(6,14,13,.5);border:1px solid rgba(199,154,74,.4);border-left:2px solid #e7c279;border-radius:4px;padding:4px 6px}' +
      '.tok-sheet .gm-grid-detail .gm-detail{border:0;padding:9px 12px 11px}' +
      '.tok-sheet .gm-grid-detail .gm-edit{border:0;padding:11px 13px 12px}' +
      '.tok-sheet .gm-d-edit{margin-top:11px;padding-top:9px;border-top:1px solid rgba(236,226,205,.08)}' +
      '.tok-sheet [data-sec="inventory"]:not(.can-edit) .gm-d-edit{display:none}' +
      '.tok-sheet .gm-d-editbtn{font:600 9px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e7c279;background:transparent;border:1px solid rgba(199,154,74,.45);border-radius:999px;padding:6px 13px;cursor:pointer}' +
      '.tok-sheet .gm-d-editbtn:hover{background:rgba(199,154,74,.14)}' +
      '.tok-sheet .gm-edit{background:rgba(6,14,13,.62);border-top:1px solid #e7c279;border-left:2px solid #e7c279;padding:13px 15px 14px 28px}' +
      '.tok-sheet .ge-head{font:500 10px/1 "Oswald",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e7c279;margin:0 0 11px;display:flex;justify-content:space-between;align-items:center}' +
      '.tok-sheet .ge-head .nm{color:#f9f3e6;font-weight:600;text-transform:none;letter-spacing:0;font-family:"EB Garamond",serif;font-size:15px}' +
      '.tok-sheet .ge-iconrow{display:flex;gap:13px;align-items:center;margin:0 0 12px}' +
      '.tok-sheet .ge-swatch{width:54px;height:54px;flex-shrink:0;border:1px solid rgba(199,154,74,.45);border-radius:4px;background:rgba(6,14,13,.6);display:flex;align-items:center;justify-content:center;color:#e7c279}' +
      '.tok-sheet .ge-iconmeta{flex:1}' +
      '.tok-sheet .ge-iconmeta .lbl{font:500 8.5px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8d8675;margin:0 0 4px}' +
      '.tok-sheet .ge-changeicon{font:500 9px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e7c279;background:transparent;border:1px solid rgba(199,154,74,.45);border-radius:3px;padding:5px 11px;cursor:pointer}' +
      '.tok-sheet .ge-changeicon:hover{background:rgba(199,154,74,.16)}' +
      '.tok-sheet .ge-changeicon.on{background:rgba(199,154,74,.20);color:#e7c279}' +
      '.tok-sheet .ge-picker{margin:0 0 13px;border:1px solid rgba(236,226,205,.13);border-radius:4px;background:rgba(6,14,13,.4);padding:9px 9px 10px}' +
      '.tok-sheet .ge-pk-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:8px;margin:0 0 8px;border-bottom:1px solid rgba(236,226,205,.13);scrollbar-width:thin}' +
      '.tok-sheet .ge-pk-tab{font:500 9px/1 "Oswald",sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8d8675;background:transparent;border:1px solid transparent;border-radius:3px;padding:5px 9px;cursor:pointer;white-space:nowrap;flex-shrink:0}' +
      '.tok-sheet .ge-pk-tab:hover{color:#c2b99f}' +
      '.tok-sheet .ge-pk-tab.on{color:#e7c279;border-color:rgba(199,154,74,.45);background:rgba(199,154,74,.12)}' +
      '.tok-sheet .ge-pk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
      '.tok-sheet .ge-pk-cell{aspect-ratio:1;border:1px solid rgba(236,226,205,.13);border-radius:3px;background:rgba(236,226,205,.03);display:flex;align-items:center;justify-content:center;color:rgba(199,154,74,.78);cursor:pointer;transition:background .12s,border-color .12s}' +
      '.tok-sheet .ge-pk-cell:hover{background:rgba(199,154,74,.12);color:#e7c279;border-color:rgba(199,154,74,.45)}' +
      '.tok-sheet .ge-pk-cell.sel{border-color:#e7c279;box-shadow:inset 0 0 0 1px #e7c279;color:#e7c279}' +
      '.tok-sheet .ge-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px 11px;margin:0 0 12px}' +
      '.tok-sheet .ge-f{display:flex;flex-direction:column;gap:4px}' +
      '.tok-sheet .ge-f.wide{grid-column:1 / -1}' +
      '.tok-sheet .ge-f label{font:500 8.5px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8d8675}' +
      '.tok-sheet .ge-f input,.tok-sheet .ge-f select,.tok-sheet .ge-f textarea{background:rgba(236,226,205,.06);border:1px solid rgba(236,226,205,.13);border-bottom:1px solid rgba(199,154,74,.45);border-radius:3px;color:#f9f3e6;font-family:"EB Garamond",serif;font-size:14.5px;padding:6px 8px;width:100%;box-sizing:border-box}' +
      '.tok-sheet .ge-f input:focus,.tok-sheet .ge-f select:focus,.tok-sheet .ge-f textarea:focus{outline:none;border-bottom-color:#e7c279;background:rgba(199,154,74,.08)}' +
      '.tok-sheet .ge-f select{appearance:none;cursor:pointer}' +
      '.tok-sheet .ge-f textarea{font-style:italic;resize:vertical;min-height:54px;line-height:1.4}' +
      '.tok-sheet .ge-f input[type=number]{-moz-appearance:textfield}' +
      '.tok-sheet .ge-f input[type=number]::-webkit-outer-spin-button,.tok-sheet .ge-f input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}' +
      '.tok-sheet .ge-combat{margin:0 0 12px}' +
      '.tok-sheet .ge-combat-h{display:flex;align-items:center;gap:9px;font:600 9px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#c79a4a;margin:2px 0 5px}' +
      '.tok-sheet .ge-combat-h .ln{flex:1;height:1px;background:linear-gradient(90deg,rgba(84,160,151,.3),transparent)}' +
      '.tok-sheet .ge-combat-sub{font:italic 11.5px/1.4 "EB Garamond",serif;color:#8d8675;margin:0 0 9px}' +
      '.tok-sheet .ge-combat .ge-fields{margin:0}' +
      '.tok-sheet .ge-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.tok-sheet .ge-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;padding-top:18px}' +
      '.tok-sheet .ge-toggle .box{width:16px;height:16px;border:1.5px solid rgba(199,154,74,.45);transform:rotate(45deg);flex-shrink:0;transition:background .15s}' +
      '.tok-sheet .ge-toggle.on .box{background:#e7c279;border-color:#e7c279}' +
      '.tok-sheet .ge-toggle span{font-family:"EB Garamond",serif;font-size:13.5px;color:#c2b99f}' +
      '.tok-sheet .ge-foot{display:flex;align-items:center;justify-content:flex-end;gap:9px;border-top:1px solid rgba(236,226,205,.13);padding-top:11px}' +
      '.tok-sheet .ge-btn{font:600 9.5px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:8px 16px;cursor:pointer;border:1px solid rgba(199,154,74,.45);background:transparent;color:#c2b99f}' +
      '.tok-sheet .ge-btn:hover{color:#f9f3e6}' +
      '.tok-sheet .ge-btn.primary{background:#c79a4a;border-color:#c79a4a;color:#241c11}' +
      '.tok-sheet .ge-btn.primary:hover{background:#e7c279}' +
      '.tok-sheet .ge-btn.danger{border-color:rgba(207,59,44,.5);color:#e0584a;margin-right:auto}' +
      '.tok-sheet .ge-btn.danger:hover{color:#f9f3e6;border-color:#e0584a;background:rgba(207,59,44,.12)}' +
      '.tok-sheet .ge-btn.del{border-color:#cf3b2c;background:#cf3b2c;color:#f9f3e6}' +
      '.tok-sheet .ge-btn.del:hover{background:#e0584a;border-color:#e0584a}' +
      '.tok-sheet .ge-confirm{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid rgba(207,59,44,.3);padding-top:11px}' +
      '.tok-sheet .ge-cmsg{flex:1 1 200px;font-family:"EB Garamond",serif;font-size:13px;color:#c2b99f;min-width:180px}' +
      '.tok-sheet .ge-cmsg b{color:#f9f3e6;font-weight:600}' +
      '.tok-sheet .ge-cbtns{display:flex;gap:9px;margin-left:auto}' +
      '.tok-sheet .gm-cog{border:1px solid transparent;background:transparent;color:#8d8675;border-radius:50%;width:24px;height:24px;display:none;align-items:center;justify-content:center;cursor:pointer;padding:0;flex:0 0 auto}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-cog{display:inline-flex}' +
      '.tok-sheet .gm-cog:hover{color:#e7c279;border-color:rgba(199,154,74,.4);background:rgba(231,194,121,.07)}' +
      '.tok-sheet .gm-tile .gm-cog{position:absolute;top:3px;right:3px;z-index:3}' +
      '.tok-sheet [data-equip]{position:relative}' +
      '.tok-sheet .gm-row.dragging{background:rgba(199,154,74,.10);box-shadow:0 6px 18px rgba(0,0,0,.4);z-index:5;cursor:grabbing}' +
      '.tok-sheet .gm-row.bagdrop{background:rgba(85,196,192,.12);box-shadow:inset 0 0 0 1px #55c4c0}' +
      '.tok-sheet .bagdrop-hint{font:500 8px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#55c4c0;margin-left:8px;display:none}' +
      '.tok-sheet .gm-row.bagdrop .bagdrop-hint{display:inline}' +
      '.tok-sheet .drop-line{position:absolute;left:4px;right:4px;height:2px;background:#e7c279;box-shadow:0 0 8px rgba(231,194,121,.6);pointer-events:none;z-index:6}' +
      '.tok-sheet .gm-tgrip{position:absolute;top:2px;left:50%;transform:translateX(-50%);font-size:10px;line-height:1;color:transparent;cursor:grab;touch-action:none;z-index:3;padding:2px 6px}' +
      '.tok-sheet .gm-tile:hover .gm-tgrip{color:rgba(199,154,74,.55)}' +
      '.tok-sheet [data-sec="inventory"]:not(.can-edit) .gm-tgrip{display:none}' +
      '.tok-sheet .gm-tile.locked .gm-tgrip{display:none}' +
      '.tok-sheet .gm-tile.dragging{opacity:.45}' +
      '.tok-sheet .gm-tile.bagdrop{box-shadow:inset 0 0 0 2px #55c4c0;background:rgba(85,196,192,.12)}' +
      '.tok-sheet .gm-tile.insert-before::after{content:\'\';position:absolute;left:-5px;top:10%;bottom:10%;width:2px;background:#e7c279;box-shadow:0 0 8px rgba(231,194,121,.6)}' +
      /* ── Add Item surface (Inc 3) ── */
      '.tok-sheet .gm-add-btn{display:inline-flex;align-items:center;gap:5px;font:600 10px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e7c279;background:transparent;border:1px solid rgba(199,154,74,.45);border-radius:3px;padding:5px 11px;cursor:pointer}' +
      '.tok-sheet .gm-add-btn:hover{background:rgba(199,154,74,.14)}' +
      '.tok-sheet .gm-add-btn.on{background:rgba(199,154,74,.20);color:#e7c279;border-color:rgba(199,154,74,.7)}' +
      '.tok-sheet .gm-add-btn .plus{font-size:13px;line-height:0}' +
      '.tok-sheet [data-sec="inventory"]:not(.can-edit) .gm-add-btn{display:none}' +
      '.tok-sheet .gm-add{margin:0 0 14px;border:1px solid rgba(199,154,74,.4);border-left:2px solid #e7c279;border-radius:4px;background:rgba(6,14,13,.55);padding:12px 13px 13px}' +
      '.tok-sheet .gm-add-search{position:relative;margin:0 0 10px}' +
      '.tok-sheet .gm-add-search input{width:100%;box-sizing:border-box;background:rgba(236,226,205,.06);border:1px solid rgba(236,226,205,.13);border-bottom:1px solid rgba(199,154,74,.5);border-radius:3px;color:#f9f3e6;font-family:"EB Garamond",serif;font-size:15.5px;padding:9px 11px 9px 32px}' +
      '.tok-sheet .gm-add-search input:focus{outline:none;border-bottom-color:#e7c279;background:rgba(199,154,74,.08)}' +
      '.tok-sheet .gm-add-search input::placeholder{color:#6f7a6e}' +
      '.tok-sheet .gm-add-search .mag{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:rgba(199,154,74,.6);pointer-events:none;display:inline-flex}' +
      '.tok-sheet .gm-add-state{font-family:"EB Garamond",serif;font-style:italic;font-size:13.5px;color:#8d8675;padding:6px 4px}' +
      '.tok-sheet .gm-add-state.err{color:#e0a07a;font-style:normal}' +
      '.tok-sheet .gm-add-hint{font:400 11px/1.4 "Oswald",sans-serif;letter-spacing:.04em;color:#6f7a6e;padding:2px 4px}' +
      '.tok-sheet .gm-ares{border-bottom:1px solid rgba(236,226,205,.07)}' +
      '.tok-sheet .gm-ares:last-child{border-bottom:0}' +
      '.tok-sheet .gm-ares-row{display:flex;align-items:center;gap:9px;padding:8px 3px;cursor:pointer}' +
      '.tok-sheet .gm-ares-row:hover{background:rgba(199,154,74,.05)}' +
      '.tok-sheet .gm-ares-car{width:11px;flex-shrink:0;color:rgba(199,154,74,.5);font-size:11px;transition:transform .15s;display:inline-block}' +
      '.tok-sheet .gm-ares.open .gm-ares-car{transform:rotate(90deg);color:#e7c279}' +
      '.tok-sheet .gm-ares-ic{width:18px;flex-shrink:0;color:rgba(199,154,74,.5);display:inline-flex}' +
      '.tok-sheet .gm-ares-nm{font-family:"EB Garamond",serif;font-size:15.5px;color:#f9f3e6}' +
      '.tok-sheet .gm-ares-rar{font:500 7.5px/1 "Oswald",sans-serif;letter-spacing:.07em;text-transform:uppercase;border:1px solid;border-radius:2px;padding:2px 5px;flex-shrink:0}' +
      '.tok-sheet .gm-ares-meta{margin-left:auto;font-family:"EB Garamond",serif;font-style:italic;font-size:12px;color:#8d8675;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44%}' +
      '.tok-sheet .gm-ares-quick{flex-shrink:0;font:600 8.5px/1 "Oswald",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#8d8675;background:transparent;border:1px solid rgba(141,134,117,.4);border-radius:999px;padding:4px 9px;cursor:pointer;opacity:1;transition:opacity .12s}' +
      '.tok-sheet .gm-ares-quick:hover{color:#e7c279;border-color:rgba(199,154,74,.55)}' +
      '@media (hover:hover){.tok-sheet .gm-ares-quick{opacity:0}.tok-sheet .gm-ares-row:hover .gm-ares-quick{opacity:1}}' +
      '.tok-sheet .gm-ares.added .gm-ares-quick,.tok-sheet .gm-ares.added .gm-add-confirm{color:#7bc47b;border-color:rgba(123,196,123,.5);background:transparent;opacity:1}' +
      '.tok-sheet .gm-ares-detail{background:rgba(6,14,13,.4);border-left:2px solid rgba(199,154,74,.35);padding:9px 13px 12px 26px}' +
      '.tok-sheet .gm-add-foot{margin-top:11px;display:flex;align-items:center;gap:11px;flex-wrap:wrap}' +
      '.tok-sheet .gm-add-confirm{font:600 9.5px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#241c11;background:#c79a4a;border:1px solid #c79a4a;border-radius:999px;padding:8px 16px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}' +
      '.tok-sheet .gm-add-confirm:hover{background:#e7c279}' +
      '.tok-sheet .gm-add-confirm .plus{font-size:13px;line-height:0}' +
      '.tok-sheet .gm-add-pack-note{font-family:"EB Garamond",serif;font-style:italic;font-size:12px;color:#55c4c0}' +
      /* ── Currency footer: steppers · legend · loot Split · worth ── */
      '.tok-sheet .gm-coin{position:relative}' +
      '.tok-sheet .gm-coin-step{display:none;align-items:stretch}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-coin-step{display:flex}' +
      '.tok-sheet .gm-cs{width:19px;border:1px solid rgba(236,226,205,.16);background:rgba(236,226,205,.05);color:#8d8675;font:400 14px/1 "Oswald",sans-serif;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:center;padding:0;-webkit-tap-highlight-color:transparent}' +
      '.tok-sheet .gm-cs:first-child{border-radius:3px 0 0 3px;border-right:0}' +
      '.tok-sheet .gm-cs:last-child{border-radius:0 3px 3px 0;border-left:0}' +
      '.tok-sheet .gm-cs:hover{color:#e7c279;background:rgba(199,154,74,.14);border-color:rgba(199,154,74,.45)}' +
      '.tok-sheet .gm-cs:active{background:rgba(199,154,74,.26)}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-coin-step input{width:38px;border-radius:0}' +
      '.tok-sheet .gm-coin.gm-coin-flash input{animation:gmcoinflash .7s ease}' +
      '@keyframes gmcoinflash{0%{background:rgba(231,194,121,.42)}100%{background:rgba(236,226,205,.06)}}' +
      '.tok-sheet .gm-coin-leg{position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%) translateY(3px);background:#0c1817;border:1px solid rgba(199,154,74,.4);border-radius:4px;padding:6px 9px;white-space:nowrap;font:400 11px/1.2 "Oswald",sans-serif;letter-spacing:.03em;color:#ece2cd;box-shadow:0 10px 26px -12px rgba(0,0,0,.85);opacity:0;pointer-events:none;transition:opacity .14s, transform .14s;z-index:5}' +
      '.tok-sheet .gm-coin:hover .gm-coin-leg{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.tok-sheet .gm-cur-tools{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center;margin:13px 0 0}' +
      '.tok-sheet .gm-split-btn{display:none;align-items:center;gap:6px;font:600 9.5px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#55c4c0;background:transparent;border:1px solid rgba(85,196,192,.4);border-radius:3px;padding:7px 13px;cursor:pointer}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-split-btn{display:inline-flex}' +
      '.tok-sheet .gm-split-btn:hover{background:rgba(85,196,192,.13);border-color:rgba(85,196,192,.7)}' +
      '.tok-sheet .gm-split-btn.on{background:rgba(85,196,192,.18);border-color:rgba(85,196,192,.8)}' +
      '.tok-sheet .gm-split-btn svg{width:14px;height:14px}' +
      '.tok-sheet .gm-cur-worth{font-family:"EB Garamond",serif;font-size:14px;font-style:italic;color:#8d8675}' +
      '.tok-sheet .gm-cur-worth b{color:#f9f3e6;font-style:normal;font-weight:600}' +
      '.tok-sheet .gm-split{display:none;width:100%;max-width:430px;margin:12px auto 2px;border:1px solid rgba(85,196,192,.3);border-left:2px solid #55c4c0;border-radius:5px;background:rgba(6,16,14,.6);padding:14px 15px 15px}' +
      '.tok-sheet [data-sec="inventory"].can-edit .gm-split.open{display:block}' +
      '.tok-sheet .gm-split-h{font:600 9px/1 "Oswald",sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#55c4c0;margin:0 0 11px;display:flex;justify-content:space-between;align-items:center}' +
      '.tok-sheet .gm-split-h a{font:400 9px/1 "Oswald",sans-serif;letter-spacing:.1em;color:#c79a4a;cursor:pointer;text-transform:none}' +
      '.tok-sheet .gm-split-h a:hover{color:#e7c279}' +
      '.tok-sheet .gm-split-loot{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:0 0 12px}' +
      '.tok-sheet .gm-sl{display:flex;flex-direction:column;align-items:center;gap:3px}' +
      '.tok-sheet .gm-sl input{width:42px;text-align:center;background:rgba(236,226,205,.06);border:1px solid rgba(236,226,205,.13);border-bottom:1px solid rgba(85,196,192,.45);border-radius:3px;color:#f9f3e6;font-family:"EB Garamond",serif;font-size:14px;padding:3px 0}' +
      '.tok-sheet .gm-sl input::-webkit-outer-spin-button,.tok-sheet .gm-sl input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}' +
      '.tok-sheet .gm-sl input{-moz-appearance:textfield}' +
      '.tok-sheet .gm-sl input:focus{outline:none;border-bottom-color:#55c4c0}' +
      '.tok-sheet .gm-sl span{font:500 7.5px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8d8675}' +
      '.tok-sheet .gm-split-ways{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 12px}' +
      '.tok-sheet .gm-sp-conv{display:flex;align-items:center;justify-content:center;gap:6px;font:400 9px/1.3 "Oswald",sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8d8675;cursor:pointer;user-select:none;margin:0 0 12px;text-align:center}' +
      '.tok-sheet .gm-sp-conv input{accent-color:#c79a4a;width:13px;height:13px;cursor:pointer;flex-shrink:0}' +
      '.tok-sheet .gm-split-ways .lab{font:400 9.5px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8d8675}' +
      '.tok-sheet .gm-ways{display:flex;align-items:stretch}' +
      '.tok-sheet .gm-ways button{width:22px;border:1px solid rgba(236,226,205,.16);background:rgba(236,226,205,.05);color:#ece2cd;font:400 15px/1 "Oswald",sans-serif;cursor:pointer}' +
      '.tok-sheet .gm-ways button:first-child{border-radius:3px 0 0 3px;border-right:0}' +
      '.tok-sheet .gm-ways button:last-child{border-radius:0 3px 3px 0;border-left:0}' +
      '.tok-sheet .gm-ways button:hover{color:#55c4c0;border-color:rgba(85,196,192,.5)}' +
      '.tok-sheet .gm-ways .n{min-width:30px;display:flex;align-items:center;justify-content:center;font-family:"EB Garamond",serif;font-size:17px;color:#f9f3e6;border-top:1px solid rgba(236,226,205,.13);border-bottom:1px solid rgba(236,226,205,.13);background:rgba(236,226,205,.04)}' +
      '.tok-sheet .gm-split-out{border-top:1px solid rgba(236,226,205,.10);padding-top:12px;text-align:center}' +
      '.tok-sheet .gm-sp-each{font:400 8.5px/1 "Oswald",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8d8675;margin:0 0 6px}' +
      '.tok-sheet .gm-sp-coins{font-family:"Playfair Display",serif;font-size:19px;color:#f9f3e6;letter-spacing:.4px;line-height:1.3}' +
      '.tok-sheet .cl-c{white-space:nowrap}.tok-sheet .cl-u{font-size:11px;color:#c79a4a;font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.06em;margin-left:1px}.tok-sheet .cl-dot{color:rgba(141,134,117,.5);margin:0 7px}' +
      '.tok-sheet .gm-sp-worth{font-family:"EB Garamond",serif;font-style:italic;font-size:13px;color:#8d8675;margin:5px 0 0}.tok-sheet .gm-sp-worth b{color:#f9f3e6;font-style:normal;font-weight:600}' +
      '.tok-sheet .gm-sp-rem{margin:11px 0 0;font:400 11px/1.3 "Oswald",sans-serif;letter-spacing:.04em;color:#e7c279;padding:7px 9px;background:rgba(199,154,74,.08);border-radius:4px;display:inline-block}' +
      '.tok-sheet .gm-sp-rem.even{color:#55c4c0;background:rgba(85,196,192,.08)}' +
      '.tok-sheet .gm-sp-rem .cl-u{color:#c79a4a}' +
      '.tok-sheet .gm-sp-names{display:flex;gap:5px;justify-content:center;flex-wrap:wrap;margin:12px 0 0}' +
      '.tok-sheet .gm-sp-chip{font:500 9px/1 "Oswald",sans-serif;letter-spacing:.06em;color:#ece2cd;border:1px solid rgba(236,226,205,.13);border-radius:999px;padding:4px 9px}' +
      '.tok-sheet .gm-sp-take{margin:13px 0 0}' +
      '.tok-sheet .gm-sp-takebtn{font:600 9px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#241c11;background:#c79a4a;border:1px solid #c79a4a;border-radius:999px;padding:7px 15px;cursor:pointer}' +
      '.tok-sheet .gm-sp-takebtn:hover{background:#e7c279}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  var GM = { render: render, bind: bind, injectCss: injectCss, totalWeight: totalWeight, detailHtml: detailHtml, editFormHtml: editFormHtml, isWeaponItem: isWeaponItem, searchResultsHtml: searchResultsHtml, splitOutHtml: splitOutHtml, splitShare: splitShare, worthStr: worthStr, VERSION: 'gm-1' };
  if (typeof window !== 'undefined') { window.GearManager = GM; try { injectCss(window.document); } catch (e) {} }
  if (typeof globalThis !== 'undefined') globalThis.GearManager = GM;
  if (typeof module !== 'undefined' && module.exports) module.exports = GM;
})();
