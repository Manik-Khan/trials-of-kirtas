// sheet-progression.js — Level Up, Facets of the Shard, and Soul Lineage drawer.
import { classesOf, levelOf, classSummary, facetsOf, lineageOf } from './soul-facets.js?v=facets1';

function esc(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ensureCss(doc) {
  if (!doc || doc.querySelector('link[href*="sheet-progression.css"]')) return;
  var link = doc.createElement('link');
  link.rel = 'stylesheet'; link.href = 'sheet-progression.css?v=facets1';
  (doc.head || doc.documentElement).appendChild(link);
}

function dateLabel(value) {
  if (!value) return 'Earlier form';
  try { return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch (_) { return 'Earlier form'; }
}

function currentCard(character) {
  var s = character.structural || {}, counts = (s.spellcasting && s.spellcasting.groups) || [];
  var spellN = counts.reduce(function (n, g) { return n + ((g && g.spells) || []).length; }, 0);
  return '<article class="sfp-facet current"><span>Current form</span><h3>' + esc(classSummary(s)) + ' · Level ' + levelOf(s) + '</h3>'
    + '<p>' + (s.features || []).length + ' features · ' + spellN + ' recorded spells</p></article>';
}

function facetCard(facet) {
  var counts = facet.counts || {};
  return '<article class="sfp-facet"><span>Level ' + esc(facet.level) + '</span><h3>' + esc(facet.classSummary || 'Earlier form') + '</h3>'
    + '<p>' + (counts.features || 0) + ' features · ' + (counts.spells || 0) + ' recorded spells</p><time>' + esc(facet.label || dateLabel(facet.createdAt)) + '</time></article>';
}

function mountSheetProgression(options) {
  options = options || {};
  var root = options.root, character = options.character || {}, CD = options.characterData, key = options.key || character.key;
  if (!root || !character.structural) return null;
  var doc = root.ownerDocument || document;
  ensureCss(doc);
  var title = root.querySelector('.titleblock');
  if (!title || title.querySelector('[data-sfp-actions]')) return null;

  var actions = doc.createElement('div');
  actions.className = 'sfp-actions'; actions.setAttribute('data-sfp-actions', '');
  actions.innerHTML = '<button class="primary" type="button" data-sfp-open="level">Level Up</button>'
    + '<button type="button" data-sfp-open="facets">Facets of the Shard</button>'
    + '<button type="button" data-sfp-open="lineage">Enter the Shift</button>';
  title.appendChild(actions);

  var embedded = !!root.closest('.sf-scroll');
  var host = embedded ? root.closest('.sf-page') : doc.body;
  var veil = doc.createElement('div');
  veil.className = 'sfp-veil' + (embedded ? ' embedded' : '');
  veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = '<section class="sfp-drawer" role="dialog" aria-modal="true" aria-labelledby="sfp-title">'
    + '<header><span>Soul Shard · ' + esc(character.name || character.structural.name || key) + '</span><div><h2 id="sfp-title">Facets of the Shard</h2><button type="button" data-sfp-close aria-label="Close">×</button></div>'
    + '<p>Mechanical forms of this Soul Fragment. Journal writing remains in the Journal.</p></header>'
    + '<nav><button type="button" data-sfp-tab="facets">Facets</button><button type="button" data-sfp-tab="lineage">Soul Lineage</button><button type="button" data-sfp-tab="level">Level Up</button></nav>'
    + '<div class="sfp-panel" data-sfp-panel></div></section>';
  host.appendChild(veil);
  var panel = veil.querySelector('[data-sfp-panel]'), heading = veil.querySelector('#sfp-title');
  var state = { tab: 'facets', chosen: (classesOf(character.structural)[0] || {}).name || null, canEdit: null };

  function renderFacets() {
    var items = facetsOf(character).slice().reverse();
    panel.innerHTML = '<div class="sfp-note"><b>History, not a second journal.</b> Each completed Level Up preserves the prior mechanical form.</div>'
      + currentCard(character) + '<div class="sfp-timeline">' + (items.length ? items.map(facetCard).join('') : '<p class="sfp-empty">No earlier Facets yet. The current form will be preserved when this character completes Level Up.</p>') + '</div>'
      + '<a class="sfp-text-link" href="shards.html?reforge=' + encodeURIComponent(key) + '">Open Shard Reforger · advanced</a>';
  }

  function renderLineage() {
    var lineage = lineageOf(character), fragments = lineage.fragments;
    panel.innerHTML = '<div class="sfp-note"><b>The Shift</b> reveals known incarnations of the enduring soul and the Refractions carried between them.</div>'
      + '<div class="sfp-lineage"><div class="sfp-soul">' + esc(lineage.name) + '</div><div class="sfp-fragments">'
      + fragments.map(function (f) { return '<article class="sfp-fragment' + (f.current ? ' current' : '') + '"><h3>' + esc(f.name || 'Soul Fragment') + '</h3><p>' + esc(f.campaign || 'Unknown reality') + '</p><span>' + esc(f.current ? 'Current Soul Fragment' : (f.status || 'Known Fragment')) + '</span></article>'; }).join('')
      + '</div>' + (lineage.refractions.length ? '<div class="sfp-refractions"><b>Refractions</b>' + lineage.refractions.map(function (r) { return '<span>' + esc(r.name || r) + '</span>'; }).join('') + '</div>' : '<p class="sfp-empty">No Refractions or additional Soul Fragments have been linked yet.</p>') + '</div>';
  }

  function renderLevel() {
    var classes = classesOf(character.structural), hasBuild = !!character.structural._build, maxed = levelOf(character.structural) >= 20;
    panel.innerHTML = '<div class="sfp-note"><b>Level Up</b> advances the saved build without rebuilding the character from scratch.</div>'
      + '<h3 class="sfp-step-title">Choose the advancing class</h3><p class="sfp-step-copy">Current form: ' + esc(classSummary(character.structural)) + ' · Level ' + levelOf(character.structural) + '</p>'
      + '<div class="sfp-choices">' + classes.map(function (c) { return '<button type="button" class="sfp-choice' + (state.chosen === c.name ? ' on' : '') + '" data-sfp-class="' + esc(c.name) + '"' + (maxed ? ' disabled' : '') + '><span><b>' + esc(c.name) + '</b><small>' + esc(c.subclass || 'Advance this class') + '</small></span><em>' + c.level + ' → ' + (c.level + 1) + '</em></button>'; }).join('') + '</div>'
      + (!hasBuild ? '<div class="sfp-warn">This character predates lossless build data. Level Up can reconstruct it, but the Reforger will ask you to confirm abilities and spell choices once.</div>' : '')
      + (!classes.length ? '<div class="sfp-warn">No class structure is recorded for this character. Open the Shard Reforger to bind its build first.</div>' : '')
      + (maxed ? '<div class="sfp-warn">This character is already Level 20.</div>' : '')
      + '<div class="sfp-level-actions"><button type="button" data-sfp-cancel>Cancel</button><button class="next" type="button" data-sfp-continue' + ((!classes.length || maxed || state.canEdit === false) ? ' disabled' : '') + '>Continue Level Up</button></div>'
      + (state.canEdit === false ? '<p class="sfp-permission">Level Up is unavailable because this account cannot edit the character.</p>' : '');
  }

  function show(tab) {
    state.tab = tab;
    heading.textContent = tab === 'lineage' ? 'Soul Lineage' : tab === 'level' ? 'Level Up' : 'Facets of the Shard';
    veil.querySelectorAll('[data-sfp-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sfp-tab') === tab); });
    if (tab === 'lineage') renderLineage(); else if (tab === 'level') renderLevel(); else renderFacets();
  }
  function open(tab) { veil.classList.add('open'); veil.setAttribute('aria-hidden', 'false'); show(tab); }
  function close() { veil.classList.remove('open'); veil.setAttribute('aria-hidden', 'true'); }

  actions.addEventListener('click', function (e) { var b = e.target.closest('[data-sfp-open]'); if (b) open(b.getAttribute('data-sfp-open')); });
  veil.addEventListener('click', function (e) {
    if (e.target === veil || e.target.closest('[data-sfp-close]') || e.target.closest('[data-sfp-cancel]')) { close(); return; }
    var tab = e.target.closest('[data-sfp-tab]'); if (tab) { show(tab.getAttribute('data-sfp-tab')); return; }
    var choice = e.target.closest('[data-sfp-class]'); if (choice) { state.chosen = choice.getAttribute('data-sfp-class'); renderLevel(); return; }
    if (e.target.closest('[data-sfp-continue]') && state.chosen) {
      window.location.assign('shards.html?mode=level-up&character=' + encodeURIComponent(key) + '&class=' + encodeURIComponent(state.chosen));
    }
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && veil.classList.contains('open')) close(); });
  if (CD && CD.canEdit) Promise.resolve(CD.canEdit(key)).then(function (ok) { state.canEdit = !!ok; if (state.tab === 'level' && veil.classList.contains('open')) renderLevel(); }).catch(function () { state.canEdit = false; });
  return { open: open, close: close, element: veil };
}

export { mountSheetProgression };
