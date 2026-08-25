/* quests-tab.js — site-wide compact Quest rail projection.
 * Reads the same party-visible records as quests.html and registers through
 * TokRail's rider seam. Authoring remains in the Feed through /quest.
 */
(function () {
  'use strict';
  if (window.__tokQuestsTab) return;
  window.__tokQuestsTab = true;

  var STATE = { pane: null, quests: [], openId: '', filter: 'active', query: '', channel: null, loading: false };
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rich(value) {
    return window.QuestFeedCapture && window.QuestFeedCapture.descriptionHTML
      ? window.QuestFeedCapture.descriptionHTML(value)
      : esc(value);
  }
  function loadCss() {
    if (document.querySelector('link[href*="quests-tab.css"]')) return;
    var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'quests-tab.css?v=qt1';
    document.head.appendChild(link);
  }
  function loadScript(src, ready) {
    return new Promise(function (resolve, reject) {
      if (ready()) { resolve(); return; }
      var existing = document.querySelector('script[src*="' + src.split('?')[0] + '"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var script = document.createElement('script'); script.src = src;
      script.onload = resolve; script.onerror = function () { reject(new Error('load failed: ' + src)); };
      document.head.appendChild(script);
    });
  }
  function ensureReader() {
    return loadScript('quests.js?v=q3', function () { return !!window.Quests; });
  }
  function visibleQuests() {
    var query = STATE.query.toLowerCase();
    return STATE.quests.filter(function (quest) {
      if (STATE.filter === 'active' && quest.status !== 'active' && quest.status !== 'offered') return false;
      if (!query) return true;
      return [quest.title, quest.summary, quest.giverLabel, quest.destinationLabel]
        .some(function (value) { return String(value || '').toLowerCase().indexOf(query) >= 0; });
    });
  }
  function entity(label, id, type) {
    if (!label) return '';
    if (!id) return '<span>' + esc(label) + '</span>';
    return '<span class="' + type + '-link" data-' + type + '="' + esc(id) + '" tabindex="0">' + esc(label) + '</span>';
  }
  function card(quest) {
    var open = quest.id === STATE.openId;
    var objective = quest.objectives && quest.objectives[0];
    return '<article class="qtr-card' + (open ? ' is-open' : '') + '" data-qtr-id="' + esc(quest.id) + '">' +
      '<button type="button" class="qtr-summary" data-qtr-act="toggle"><span>' + esc(quest.status) + '</span><b>' + esc(quest.title) + '</b><small>' + esc(quest.destinationLabel || 'No location yet') + '</small><i>' + (open ? '−' : '+') + '</i></button>' +
      (open ? '<div class="qtr-details"><p>' + rich(quest.summary || 'No description recorded.') + '</p>' +
        '<dl>' + (quest.giverLabel ? '<dt>Quest Giver</dt><dd>' + entity(quest.giverLabel, quest.giverId, 'npc') + '</dd>' : '') +
        (quest.destinationLabel ? '<dt>Location</dt><dd>' + entity(quest.destinationLabel, quest.destinationLocationId, 'location') + '</dd>' : '') + '</dl>' +
        (objective ? '<div class="qtr-objective"><span>Objective</span><p>' + rich(objective.title) + '</p></div>' : '') +
        '<a href="quests.html?quest=' + encodeURIComponent(quest.id) + '">Open in Quest Hub →</a></div>' : '') + '</article>';
  }
  function render() {
    if (!STATE.pane) return;
    var rows = visibleQuests();
    STATE.pane.innerHTML = '<div class="qtr-head"><div><span>Campaign threads</span><h2>Quests</h2></div><a href="quests.html">Open Hub</a></div>' +
      '<div class="qtr-tools"><input data-qtr-search aria-label="Search quests" placeholder="Search quests, people, places…" value="' + esc(STATE.query) + '"><div><button data-qtr-filter="active" aria-pressed="' + (STATE.filter === 'active') + '">Active</button><button data-qtr-filter="all" aria-pressed="' + (STATE.filter === 'all') + '">All</button></div></div>' +
      '<div class="qtr-list">' + (rows.length ? rows.map(card).join('') : '<div class="qtr-empty">No matching quests yet.<br>Use <b>/quest</b> in the Feed to begin one.</div>') + '</div>';
    if (window.attachTooltips) { try { window.attachTooltips(STATE.pane); } catch (_) {} }
  }
  function refresh() {
    if (STATE.loading || !window.__tok || !window.__tok.sb) return;
    STATE.loading = true;
    ensureReader().then(function () { return window.Quests.load(window.__tok.sb, { staff: false }); })
      .then(function (result) {
        STATE.loading = false;
        STATE.quests = result && result.available ? result.quests : [];
        render();
      }).catch(function (error) {
        STATE.loading = false;
        if (STATE.pane) STATE.pane.innerHTML = '<div class="qtr-empty">Quests could not load.<br>' + esc(error && error.message || 'Reader unavailable') + '</div>';
      });
  }
  function mount(pane) {
    loadCss(); STATE.pane = pane;
    pane.innerHTML = '<div class="qtr-empty">Gathering shared quests…</div>';
    pane.addEventListener('input', function (event) {
      if (!event.target.matches('[data-qtr-search]')) return;
      STATE.query = event.target.value; render();
      var input = STATE.pane.querySelector('[data-qtr-search]'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
    pane.addEventListener('click', function (event) {
      var filter = event.target.closest('[data-qtr-filter]');
      if (filter) { STATE.filter = filter.getAttribute('data-qtr-filter'); render(); return; }
      var toggle = event.target.closest('[data-qtr-act="toggle"]');
      if (toggle) {
        var row = toggle.closest('[data-qtr-id]');
        STATE.openId = STATE.openId === row.getAttribute('data-qtr-id') ? '' : row.getAttribute('data-qtr-id');
        render();
      }
    });
    refresh();
    if (!STATE.channel && window.__tok.sb.channel) {
      STATE.channel = window.__tok.sb.channel('quest-rail-live');
      ['quests', 'quest_objectives'].forEach(function (table) {
        STATE.channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, refresh);
      });
      STATE.channel.subscribe();
    }
  }
  function register() {
    if (!window.TokRail || !window.TokRail.ready) return;
    window.TokRail.registerTab({
      id: 'quests', label: 'Quests', order: 20,
      icon: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 3.5h8l2 2v9H4z"/><path d="M7 7h4M7 10h4"/></svg>',
      onMount: mount, onShow: refresh,
    });
  }
  if (window.TokRail && window.TokRail.ready) register();
  else document.addEventListener('tok-rail:ready', register, { once: true });
})();
