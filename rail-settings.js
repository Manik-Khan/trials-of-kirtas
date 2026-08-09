/* ════════════════════════════════════════════════════════════════════
   RAIL-SETTINGS-V1 — device behavior for the universal right rail.

   The ◐ nav icon owns Appearance. This pane owns how Kirtas behaves on
   this browser: rail startup, feed presentation, roll cleanup, and shared
   UI accessibility. Preferences stay local; identity remains on the badge.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.TokPreferences) return;

  var KEY = 'tok.preferences.v1';
  var OPEN_KEY = 'tok.railSettings.open.v1';
  var FLOAT_KEY = 'tok.sheetFloat.v2';
  var DEFAULTS = {
    railOpen: 'remember',
    railTab: 'last',
    feedDensity: 'comfortable',
    clearAdvDis: false,
    clearBonuses: false,
    rollCards: 'full',
    motion: 'system',
    uiSize: 'standard',
    quietEffects: false,
  };
  var prefs = read();

  function copy(o) { return Object.assign({}, o); }
  function read() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return copy(DEFAULTS); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {}
  }
  function emit() {
    document.dispatchEvent(new CustomEvent('tok:preferences', { detail: copy(prefs) }));
  }
  function applyTargets() {
    var html = document.documentElement;
    html.setAttribute('data-tok-motion', prefs.motion);
    html.setAttribute('data-tok-ui-size', prefs.uiSize);
    html.setAttribute('data-tok-quiet-effects', prefs.quietEffects ? 'on' : 'off');
    var rail = document.getElementById('tok-rail');
    if (rail) {
      rail.classList.toggle('tr-feed-compact', prefs.feedDensity === 'compact');
      rail.classList.toggle('tr-roll-totals', prefs.rollCards === 'totals');
      rail.classList.toggle('tr-ui-large', prefs.uiSize === 'large');
      rail.classList.toggle('tr-quiet-effects', !!prefs.quietEffects);
    }
  }
  function set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return;
    prefs[key] = value;
    save(); applyTargets(); paint(); emit();
  }
  function reset() {
    prefs = copy(DEFAULTS);
    try { localStorage.removeItem(KEY); localStorage.removeItem(OPEN_KEY); } catch (e) {}
    applyTargets(); paint(); emit();
  }
  function consumeRoll() {
    var battle = window.__battle;
    if (!battle || typeof battle.getRS !== 'function' || typeof battle.toggleRS !== 'function') return;
    var rs = battle.getRS() || {};
    if (prefs.clearAdvDis) {
      if (rs.advantage) battle.toggleRS('advantage');
      else if (rs.disadvantage) battle.toggleRS('disadvantage');
    }
    if (prefs.clearBonuses) {
      if (rs.bless) battle.toggleRS('bless');
      if (rs.guidance) battle.toggleRS('guidance');
    }
  }

  window.TokPreferences = {
    get: function () { return copy(prefs); },
    set: set,
    reset: reset,
    consumeRoll: consumeRoll,
    apply: applyTargets,
  };

  function injectStyles() {
    if (document.getElementById('tok-rail-settings-styles')) return;
    var s = document.createElement('style');
    s.id = 'tok-rail-settings-styles';
    s.textContent = [
      '#tok-rail .tr-settings{height:100%;overflow-y:auto;padding:0 13px 24px;scrollbar-width:thin;scrollbar-color:rgba(199,154,74,.25) transparent}',
      '#tok-rail .tr-settings-head{padding:17px 2px 15px;border-bottom:1px solid var(--hair)}',
      '#tok-rail .tr-settings-head h2{margin:0;color:var(--cream-hi);font-family:"Playfair Display",Georgia,serif;font-size:23px;font-weight:500}',
      '#tok-rail .tr-settings-head p{margin:5px 0 0;color:var(--cream-fnt);font-size:12.5px;line-height:1.4}',
      '#tok-rail .tr-appearance-link{display:flex;align-items:center;gap:11px;width:100%;margin:12px 0;padding:11px 12px;border:1px solid var(--frame);background:rgba(199,154,74,.06);color:var(--cream);text-align:left;cursor:pointer}',
      '#tok-rail .tr-appearance-link:hover,#tok-rail .tr-appearance-link:focus-visible{border-color:var(--gold);outline:none}',
      '#tok-rail .tr-appearance-link .ico{display:flex;align-items:center;justify-content:center;width:29px;height:29px;border:1px solid var(--frame);border-radius:50%;color:var(--gold-br);font:18px/1 Georgia,serif;flex:none}',
      '#tok-rail .tr-appearance-link .copy{min-width:0;flex:1}',
      '#tok-rail .tr-appearance-link .k{display:block;color:var(--gold-br);font:600 8px/1.2 "Oswald",sans-serif;letter-spacing:.2em;text-transform:uppercase}',
      '#tok-rail .tr-appearance-link .v{display:block;margin-top:4px;color:var(--cream-dim);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#tok-rail .tr-appearance-link .car{color:var(--cream-fnt)}',
      '#tok-rail .tr-pref-sec{border-top:1px solid var(--hair)}',
      '#tok-rail .tr-pref-sec:last-of-type{border-bottom:1px solid var(--hair)}',
      '#tok-rail .tr-pref-sec summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 2px;list-style:none;color:var(--gold-br);font:600 9px/1.2 "Oswald",sans-serif;letter-spacing:.22em;text-transform:uppercase;cursor:pointer}',
      '#tok-rail .tr-pref-sec summary::-webkit-details-marker{display:none}',
      '#tok-rail .tr-pref-sec summary::after{content:"▸";color:var(--cream-fnt);font-size:11px;transition:transform .15s ease}',
      '#tok-rail .tr-pref-sec[open] summary::after{transform:rotate(90deg)}',
      '#tok-rail .tr-pref-body{padding:0 2px 14px}',
      '#tok-rail .tr-pref-row{padding:9px 0}',
      '#tok-rail .tr-pref-row+.tr-pref-row{border-top:1px solid rgba(236,226,205,.07)}',
      '#tok-rail .tr-pref-label{display:block;color:var(--cream);font-size:13px;line-height:1.3}',
      '#tok-rail .tr-pref-hint{display:block;margin-top:3px;color:var(--cream-fnt);font-size:11px;font-style:italic;line-height:1.35}',
      '#tok-rail .tr-pref-choices{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}',
      '#tok-rail .tr-pref-choice{padding:5px 8px;border:1px solid var(--hair);background:transparent;color:var(--cream-fnt);font:600 8.5px/1.2 "Oswald",sans-serif;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}',
      '#tok-rail .tr-pref-choice:hover,#tok-rail .tr-pref-choice:focus-visible{border-color:var(--frame-hi);color:var(--cream-dim);outline:none}',
      '#tok-rail .tr-pref-choice.on{border-color:var(--gold);background:rgba(231,194,121,.1);color:var(--gold-br)}',
      '#tok-rail .tr-pref-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:9px 0;border:0;background:transparent;color:var(--cream);text-align:left;cursor:pointer}',
      '#tok-rail .tr-pref-toggle+.tr-pref-toggle{border-top:1px solid rgba(236,226,205,.07)}',
      '#tok-rail .tr-pref-switch{position:relative;width:31px;height:17px;border:1px solid var(--frame);border-radius:10px;background:rgba(7,12,11,.45);flex:none}',
      '#tok-rail .tr-pref-switch::after{content:"";position:absolute;left:3px;top:3px;width:9px;height:9px;border-radius:50%;background:var(--cream-fnt);transition:transform .15s ease,background .15s ease}',
      '#tok-rail .tr-pref-toggle.on .tr-pref-switch{border-color:var(--gold)}',
      '#tok-rail .tr-pref-toggle.on .tr-pref-switch::after{transform:translateX(14px);background:var(--gold-br)}',
      '#tok-rail .tr-pref-action{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:9px 10px;border:1px solid var(--frame);background:transparent;color:var(--cream-dim);font-size:12px;cursor:pointer;text-align:left}',
      '#tok-rail .tr-pref-action:hover,#tok-rail .tr-pref-action:focus-visible{border-color:var(--gold);color:var(--cream-hi);outline:none}',
      '#tok-rail .tr-pref-action.danger{color:#e58a7e;border-color:rgba(224,88,74,.35)}',
      '#tok-rail .tr-pref-unavailable{padding:10px 11px;border:1px dashed var(--frame);color:var(--cream-fnt);font-size:11.5px;line-height:1.45}',
      '#tok-rail .tr-pref-unavailable strong{display:block;margin-bottom:3px;color:var(--cream-dim);font:600 8px/1.2 "Oswald",sans-serif;letter-spacing:.15em;text-transform:uppercase}',
      '#tok-rail .tr-pref-status{min-height:17px;margin:10px 2px 0;color:#7fd0a4;font:600 8.5px/1.3 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase}',
      '#tok-rail.tr-feed-compact .tr-feed{gap:5px;padding-top:3px}',
      '#tok-rail.tr-feed-compact .feed-av{width:22px;height:22px}',
      '#tok-rail.tr-feed-compact .feed-text{font-size:13px;line-height:1.25}',
      '#tok-rail.tr-feed-compact .feed-meta{font-size:8px}',
      '#tok-rail.tr-ui-large .feed-text,#tok-rail.tr-ui-large .tr-pref-label{font-size:17px}',
      '#tok-rail.tr-ui-large .tr-settings-head p,#tok-rail.tr-ui-large .tr-pref-hint{font-size:14px}',
      '#tok-rail.tr-ui-large .tr-pref-choice{font-size:10px;padding:7px 9px}',
      '#tok-rail.tr-quiet-effects{box-shadow:none}',
      '#tok-rail.tr-quiet-effects::after{display:none}',
      '#tok-rail.tr-quiet-effects .tr-section-veil{backdrop-filter:none}',
      'html[data-tok-motion="reduced"] #tok-rail,html[data-tok-motion="reduced"] #tok-rail *,html[data-tok-motion="reduced"] #tok-settings,html[data-tok-motion="reduced"] #tok-settings *,html[data-tok-motion="reduced"] #tok-badge-menu,html[data-tok-motion="reduced"] #tok-badge-menu *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}',
      '@media (prefers-reduced-motion:reduce){html[data-tok-motion="system"] #tok-rail,html[data-tok-motion="system"] #tok-rail *,html[data-tok-motion="system"] #tok-settings,html[data-tok-motion="system"] #tok-settings *,html[data-tok-motion="system"] #tok-badge-menu,html[data-tok-motion="system"] #tok-badge-menu *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}',
      'html[data-tok-ui-size="large"] #tok-settings .ts-title{font-size:17px}',
      'html[data-tok-ui-size="large"] #tok-settings .ts-lbl{font-size:11.5px}',
      'html[data-tok-ui-size="large"] #tok-settings .ts-note,html[data-tok-ui-size="large"] #tok-settings .ts-pointer{font-size:14px}',
      'html[data-tok-ui-size="large"] #tok-badge-menu .tb-name{font-size:17px}',
      'html[data-tok-ui-size="large"] #tok-badge-menu .tb-item{font-size:13px}',
    ].join('\n');
    document.head.appendChild(s);
  }

  var host = null, statusTimer = null, lastLook = null;
  function choice(key, value, label) {
    return '<button type="button" class="tr-pref-choice" data-pref="' + key + '" data-value="' + value + '">' + label + '</button>';
  }
  function group(label, hint, choices) {
    return '<div class="tr-pref-row"><span class="tr-pref-label">' + label + '</span>'
      + (hint ? '<span class="tr-pref-hint">' + hint + '</span>' : '')
      + '<div class="tr-pref-choices">' + choices + '</div></div>';
  }
  function toggle(key, label, hint) {
    return '<button type="button" class="tr-pref-toggle" data-toggle="' + key + '" aria-pressed="false"><span><span class="tr-pref-label">' + label + '</span>'
      + (hint ? '<span class="tr-pref-hint">' + hint + '</span>' : '')
      + '</span><span class="tr-pref-switch" aria-hidden="true"></span></button>';
  }
  function section(id, label, body) {
    return '<details class="tr-pref-sec" data-section="' + id + '"><summary>' + label + '</summary><div class="tr-pref-body">' + body + '</div></details>';
  }
  function buildHtml() {
    return '<div class="tr-settings">'
      + '<header class="tr-settings-head"><h2>Settings</h2><p>How Kirtas behaves for you on this device.</p></header>'
      + '<button type="button" class="tr-appearance-link" data-action="appearance"><span class="ico">◐</span><span class="copy"><span class="k">Appearance</span><span class="v" data-look-summary>Sumi on Bone · Manuscript</span></span><span class="car">▸</span></button>'
      + section('workspace', 'Workspace',
        group('When Kirtas opens', 'Applied the next time a page opens.',
          choice('railOpen', 'remember', 'Remember last') + choice('railOpen', 'closed', 'Start collapsed') + choice('railOpen', 'open', 'Start open'))
        + group('Default rail tab', 'Last used preserves the current rail behavior.',
          choice('railTab', 'last', 'Last used') + choice('railTab', 'feed', 'Feed') + choice('railTab', 'characters', 'Characters'))
        + group('Feed density', '', choice('feedDensity', 'comfortable', 'Comfort') + choice('feedDensity', 'compact', 'Compact'))
        + '<div class="tr-pref-row"><button type="button" class="tr-pref-action" data-action="reset-layout"><span>Reset floating-sheet layout</span><span>↺</span></button><span class="tr-pref-hint">Clears saved positions; open sheets move on their next reopen.</span></div>')
      + section('rolls', 'Rolls &amp; play',
        toggle('clearAdvDis', 'Clear Advantage / Disadvantage after each roll', 'Applies to shared battle and feed rollers.')
        + toggle('clearBonuses', 'Clear Bless / Guidance after each roll', 'Applies to shared battle and feed rollers.')
        + group('Rail roll cards', '', choice('rollCards', 'full', 'Full') + choice('rollCards', 'totals', 'Totals'))) 
      + section('accessibility', 'Accessibility',
        group('Motion', 'Controls shared rail, Appearance, and badge animation.', choice('motion', 'system', 'Follow device') + choice('motion', 'reduced', 'Reduced') + choice('motion', 'full', 'Full'))
        + group('Interface size', 'Enlarges shared controls and rail reading text.', choice('uiSize', 'standard', 'Standard') + choice('uiSize', 'large', 'Large'))
        + toggle('quietEffects', 'Quiet visual effects', 'Removes rail ornament, shadow, and blur.'))
      + section('alerts', 'Alerts', '<div class="tr-pref-unavailable"><strong>Not connected yet</strong>Your turn, mention, and Chronicle alerts need an event-routing layer. Nothing is being silently saved or promised here.</div>')
      + section('recovery', 'Reset &amp; recovery', '<button type="button" class="tr-pref-action danger" data-action="reset-preferences"><span>Reset device preferences</span><span>↺</span></button>')
      + '<div class="tr-pref-status" role="status" aria-live="polite"></div>'
      + '</div>';
  }
  function readOpen() {
    try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'); } catch (e) { return {}; }
  }
  function writeOpen() {
    if (!host) return;
    var state = {};
    host.querySelectorAll('.tr-pref-sec').forEach(function (d) { state[d.dataset.section] = d.open; });
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function say(message) {
    if (!host) return;
    var el = host.querySelector('.tr-pref-status');
    el.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.textContent = ''; }, 3200);
  }
  function lookSummary(detail) {
    var names = { sumi: 'Sumi', indigo: 'Indigo', forest: 'Forest', vermilion: 'Vermilion', sepia: 'Sepia', plum: 'Plum', rose: 'Rose', gold: 'Gold', glacier: 'Glacier', bonewhite: 'Bone' };
    var papers = { bone: 'Bone', celadon: 'Celadon', blush: 'Blush', mist: 'Mist', straw: 'Straw', lilac: 'Lilac', charcoal: 'Charcoal', slate: 'Slate', pine: 'Pine', walnut: 'Walnut' };
    var eff = detail && detail.effective;
    if (!eff) {
      try {
        var a = JSON.parse(localStorage.getItem('tok-look-cache') || '{}');
        eff = { ink: a.ink || 'sumi', paper: a.paper || 'bone', mode: a.pageMode || 'follow', wells: a.wells || 'inked', trim: a.trim || 'auto' };
      } catch (e) { eff = { ink: 'sumi', paper: 'bone', mode: 'follow', wells: 'inked', trim: 'auto' }; }
    }
    var finish = 'Custom';
    if (window.TokLook && typeof window.TokLook.matchFinish === 'function') {
      var matched = window.TokLook.matchFinish({ mode: eff.mode, wells: eff.wells, trim: eff.trim });
      var f = matched && window.TokLook.finishOf ? window.TokLook.finishOf(matched) : null;
      if (f) finish = f.name;
    }
    return (names[eff.ink] || eff.ink) + ' on ' + (papers[eff.paper] || eff.paper) + ' · ' + finish;
  }
  function paint() {
    if (!host) return;
    host.querySelectorAll('[data-pref]').forEach(function (b) {
      var on = prefs[b.dataset.pref] === b.dataset.value;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    });
    host.querySelectorAll('[data-toggle]').forEach(function (b) {
      var on = !!prefs[b.dataset.toggle];
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    });
    var summary = host.querySelector('[data-look-summary]');
    if (summary) summary.textContent = lookSummary(lastLook);
  }
  function mount() {
    var pane = document.querySelector('.tr-pane[data-rail-pane="settings"]');
    if (!pane || pane.querySelector('.tr-settings')) return;
    pane.innerHTML = buildHtml();
    host = pane.querySelector('.tr-settings');
    var openState = readOpen();
    host.querySelectorAll('.tr-pref-sec').forEach(function (d) {
      d.open = !!openState[d.dataset.section];
      d.addEventListener('toggle', writeOpen);
    });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pref) { set(b.dataset.pref, b.dataset.value); return; }
      if (b.dataset.toggle) { set(b.dataset.toggle, !prefs[b.dataset.toggle]); return; }
      if (b.dataset.action === 'appearance') {
        e.stopPropagation(); // do not let TokSettings' outside-click listener close the flyout we open
        if (window.TokRail) window.TokRail.close();
        if (window.TokSettings) window.TokSettings.open();
        else say('Appearance is still loading.');
        return;
      }
      if (b.dataset.action === 'reset-layout') {
        try { localStorage.removeItem(FLOAT_KEY); } catch (err) {}
        say('Floating-sheet layout cleared · applies on next reopen');
        return;
      }
      if (b.dataset.action === 'reset-preferences') {
        reset(); say('Device preferences reset');
      }
    });
    paint(); applyTargets();
  }

  injectStyles();
  applyTargets();
  document.addEventListener('tok-rail:ready', function () { mount(); applyTargets(); });
  document.addEventListener('tok:look', function (e) { lastLook = e.detail || null; paint(); });
  if (document.querySelector('.tr-pane[data-rail-pane="settings"]')) mount();
})();
