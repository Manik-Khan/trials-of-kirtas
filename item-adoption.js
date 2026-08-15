/* item-adoption.js — staff-only bridge from one existing inventory row to the
 * durable item history tables. The risky production path is inert unless the
 * host URL carries ?itemHistory=1; Supabase's adopt_inventory_item RPC remains
 * the final staff/concurrency authority.
 *
 * Plain script + CommonJS dual export: window.ItemAdoption / module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ItemAdoption = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 'ia-1';
  var RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isStaff(profile) { return !!(profile && (profile.role === 'dm' || profile.role === 'overseer')); }
  function isEnabled(search) {
    try { return new URLSearchParams(search == null ? '' : String(search)).get('itemHistory') === '1'; }
    catch (_) { return false; }
  }
  function normalizeRarity(value) {
    var wanted = text(value).toLowerCase();
    for (var i = 0; i < RARITIES.length; i++) if (RARITIES[i].toLowerCase() === wanted) return RARITIES[i];
    return 'Uncommon';
  }
  function mechanics(value) {
    var description = text(value);
    return description ? { description: description } : {};
  }

  function buildPayload(input) {
    input = input || {};
    var item = clone(input.item || {});
    var identification = input.identification === 'identified' ? 'identified' : 'unidentified';
    var publicName = text(input.publicName || item.name);
    var trueName = text(input.trueName || item.name || publicName);
    var rarity = normalizeRarity(input.rarity || item.rarity);
    if (identification === 'identified') publicName = trueName;
    if (!text(input.characterKey)) throw new Error('The bearer character is required.');
    if (!Number.isInteger(input.inventoryIndex) || input.inventoryIndex < 0) throw new Error('A valid inventory position is required.');
    if (!publicName) throw new Error('The public item name is required.');
    if (!trueName) throw new Error('The staff-only true name is required.');

    var publicItem = {
      displayName: publicName,
      publicDescription: text(input.publicDescription),
      identification: identification,
      inventoryFields: {}
    };
    if (identification === 'identified') {
      publicItem.rarity = rarity;
      publicItem.mechanics = mechanics(input.rules);
    }
    var secret = {
      trueName: trueName,
      rarity: rarity,
      publicDescription: text(input.publicDescription),
      mechanics: mechanics(input.rules),
      lore: text(input.lore)
    };
    var context = {
      sessionId: text(input.sessionId) || null,
      locationId: text(input.locationId) || null,
      encounterId: text(input.encounterId) || null,
      battleMapId: text(input.battleMapId) || null,
      recoverySummary: text(input.recoverySummary) || ('Recovered ' + publicName + '.'),
      assignmentSummary: text(input.assignmentSummary) || ('Entrusted ' + publicName + ' to ' + text(input.characterName || input.characterKey) + '.')
    };
    return {
      p_character_key: text(input.characterKey),
      p_inventory_index: input.inventoryIndex,
      p_expected_item: item,
      p_public: publicItem,
      p_secret: secret,
      p_context: context,
      p_item_id: null
    };
  }

  async function adopt(sb, input) {
    if (!sb || typeof sb.rpc !== 'function') throw new Error('Item history is unavailable on this page.');
    var payload = buildPayload(input);
    var result = await sb.rpc('adopt_inventory_item', payload);
    if (result && result.error) throw new Error(result.error.message || 'The item history could not be created.');
    if (!result || !result.data || result.data.ok !== true) throw new Error('The item history did not return a confirmation.');
    return result.data;
  }

  async function loadContextOptions(sb) {
    var out = { currentSession: null, sessions: [], locations: [] };
    if (!sb || typeof sb.from !== 'function') return out;
    var requests = [
      sb.from('campaign').select('current_session').eq('id', 1).maybeSingle(),
      sb.from('session_titles').select('session,title').order('session', { ascending: false }),
      sb.from('entities').select('id,name,curated').eq('type', 'location').eq('curated', true).order('name')
    ];
    var settled = await Promise.allSettled(requests);
    var campaign = settled[0].status === 'fulfilled' ? settled[0].value : null;
    var sessions = settled[1].status === 'fulfilled' ? settled[1].value : null;
    var locations = settled[2].status === 'fulfilled' ? settled[2].value : null;
    if (campaign && !campaign.error && campaign.data && campaign.data.current_session != null) out.currentSession = String(campaign.data.current_session);
    if (sessions && !sessions.error) out.sessions = (sessions.data || []).map(function (row) { return { id: String(row.session), label: 'Session ' + row.session + (row.title ? ' · ' + row.title : '') }; });
    if (out.currentSession && !out.sessions.some(function (row) { return row.id === out.currentSession; })) out.sessions.unshift({ id: out.currentSession, label: 'Session ' + out.currentSession + ' · Current session' });
    if (locations && !locations.error) out.locations = (locations.data || []).map(function (row) { return { id: String(row.id), label: row.name || row.id }; });
    return out;
  }

  function optionHtml(rows, emptyLabel, selected) {
    var html = '<option value="">' + esc(emptyLabel) + '</option>';
    (rows || []).forEach(function (row) { html += '<option value="' + esc(row.id) + '"' + (String(row.id) === String(selected || '') ? ' selected' : '') + '>' + esc(row.label) + '</option>'; });
    return html;
  }

  function injectCss(doc) {
    if (!doc || doc.getElementById('tok-ia-css')) return;
    var style = doc.createElement('style');
    style.id = 'tok-ia-css';
    style.textContent = `
      .tok-ia-overlay{position:fixed;inset:0;z-index:10040;background:rgba(3,8,7,.84);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}
      .tok-ia-dialog{width:min(760px,100%);max-height:min(760px,calc(100vh - 40px));overflow:auto;background:#14231f;border:1px solid rgba(199,154,74,.66);box-shadow:0 24px 70px rgba(0,0,0,.68);color:#ece2cd}
      .tok-ia-head{display:flex;gap:18px;align-items:flex-start;padding:18px 19px 14px;background:#0d1815;border-bottom:1px solid rgba(236,226,205,.13)}
      .tok-ia-head>div{flex:1}.tok-ia-head h2{margin:0;color:#f3e8d1;font:500 25px/1.1 "Playfair Display",Georgia,serif}.tok-ia-head p{margin:5px 0 0;color:#a9a08d;font:14px/1.25 "EB Garamond",Georgia,serif}
      .tok-ia-close{width:34px;height:34px;border:1px solid rgba(236,226,205,.22);background:transparent;color:#a9a08d;font-size:20px;cursor:pointer}.tok-ia-close:hover{color:#f3e8d1;border-color:rgba(199,154,74,.7)}
      .tok-ia-progress{display:grid;grid-template-columns:repeat(4,1fr);background:#101c18;border-bottom:1px solid rgba(236,226,205,.13)}
      .tok-ia-progress button{min-height:51px;padding:8px 10px;border:0;border-right:1px solid rgba(236,226,205,.1);background:transparent;color:#777568;font:600 9px/1.2 "Oswald",Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}.tok-ia-progress button[aria-pressed="true"]{color:#f3e8d1;background:rgba(199,154,74,.12)}
      .tok-ia-progress i{display:inline-grid;place-items:center;width:21px;height:21px;margin-right:7px;border:1px solid currentColor;border-radius:50%;font-style:normal}.tok-ia-progress button[aria-pressed="true"] i{color:#17201c;background:#c79a4a;border-color:#c79a4a}
      .tok-ia-body{padding:22px 19px 24px}.tok-ia-panel[hidden]{display:none}.tok-ia-panel h3{margin:0;color:#f3e8d1;font:500 21px/1.15 "Playfair Display",Georgia,serif}.tok-ia-copy{margin:5px 0 16px;color:#9e9583;font:14px/1.35 "EB Garamond",Georgia,serif}
      .tok-ia-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:17px}.tok-ia-mode{padding:12px;text-align:left;border:1px solid rgba(236,226,205,.22);background:#101b18;color:#a89f8e;cursor:pointer}.tok-ia-mode[aria-pressed="true"]{border-color:#c79a4a;background:rgba(199,154,74,.1);color:#f3e8d1}.tok-ia-mode b,.tok-ia-mode span{display:block}.tok-ia-mode b{font:500 15px "EB Garamond",Georgia,serif}.tok-ia-mode span{margin-top:3px;color:#8f8879;font:12px/1.3 "EB Garamond",Georgia,serif}
      .tok-ia-fields{display:grid;grid-template-columns:1fr 1fr;gap:13px 11px}.tok-ia-field{display:block;min-width:0}.tok-ia-field.wide{grid-column:1/-1}.tok-ia-field>span{display:block;margin:0 0 6px;color:#9e9583;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}
      .tok-ia-field input,.tok-ia-field select,.tok-ia-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(236,226,205,.25);border-radius:0;background:#0d1815;color:#eee4d0;padding:10px 11px;font:15px/1.25 "EB Garamond",Georgia,serif}.tok-ia-field textarea{min-height:76px;resize:vertical}.tok-ia-field input:focus,.tok-ia-field select:focus,.tok-ia-field textarea:focus{outline:none;border-color:#c79a4a}.tok-ia-field select:disabled{opacity:.5}
      .tok-ia-secret{padding:14px;border-left:2px solid #9272ab;background:rgba(146,114,171,.08);transition:opacity .15s,filter .15s}.tok-ia-secret.player{opacity:.2;filter:blur(3px);pointer-events:none}.tok-ia-secret-label{margin:0 0 11px;color:#b79acb;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase}
      .tok-ia-origin-note{margin-top:13px;padding:9px 11px;border-left:2px solid #55c4c0;background:rgba(85,196,192,.08);color:#9eab9f;font:12px/1.4 "EB Garamond",Georgia,serif}
      .tok-ia-review{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tok-ia-review>div{padding:11px;border:1px solid rgba(236,226,205,.13);background:#101b18}.tok-ia-review>div.wide{grid-column:1/-1}.tok-ia-review span,.tok-ia-review b{display:block}.tok-ia-review .label{margin-bottom:5px;color:#8f8879;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.13em;text-transform:uppercase}.tok-ia-review b{color:#f3e8d1;font:500 15px "EB Garamond",Georgia,serif}.tok-ia-review .sub{margin-top:3px;color:#9e9583;font:12px/1.35 "EB Garamond",Georgia,serif}
      .tok-ia-events{margin-left:7px;padding-left:17px;border-left:1px solid #595448}.tok-ia-event{position:relative;padding:1px 0 10px}.tok-ia-event:last-child{padding-bottom:0}.tok-ia-event:before{content:"";position:absolute;left:-21px;top:7px;width:7px;height:7px;border-radius:50%;background:#c79a4a}
      .tok-ia-actions{position:sticky;bottom:0;display:flex;align-items:center;gap:12px;padding:12px 19px;background:#0d1815;border-top:1px solid rgba(236,226,205,.13)}.tok-ia-preview{display:flex;align-items:center;gap:7px;color:#9e9583;font:500 9px "Oswald",Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.tok-ia-preview input{accent-color:#c79a4a}.tok-ia-buttons{display:flex;gap:8px;margin-left:auto}.tok-ia-action{min-height:39px;padding:0 14px;border:1px solid rgba(236,226,205,.22);background:#15221e;color:#b7ae9c;font:600 9px "Oswald",Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}.tok-ia-action.primary{background:#c79a4a;border-color:#e7c279;color:#17201c}.tok-ia-action:disabled{opacity:.45;cursor:default}.tok-ia-status{min-height:18px;padding:0 19px 10px;background:#0d1815;color:#e0a07a;font:12px/1.3 "EB Garamond",Georgia,serif}.tok-ia-status:empty{display:none}
      .tok-ia-success{padding:31px 22px 28px;text-align:center}.tok-ia-success[hidden]{display:none}.tok-ia-success-mark{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:#74b77c;color:#17201c;font-size:25px}.tok-ia-success h3{margin:0;color:#f3e8d1;font:500 23px "Playfair Display",Georgia,serif}.tok-ia-success p{max-width:480px;margin:8px auto 17px;color:#a49b88;font:14px/1.4 "EB Garamond",Georgia,serif}
      .tok-sheet .gm-history-start,.tok-sheet .gm-history-active{display:flex;align-items:center;gap:10px;margin-top:13px;padding-top:11px;border-top:1px solid rgba(236,226,205,.10)}
      .tok-sheet .gm-history-start button{flex:0 0 auto;border:1px solid rgba(199,154,74,.55);background:rgba(199,154,74,.10);color:#e7c279;border-radius:3px;padding:7px 11px;font:600 9px/1 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}.tok-sheet .gm-history-start button:hover{background:rgba(199,154,74,.2)}.tok-sheet .gm-history-start button:disabled{border-color:rgba(141,134,117,.3);background:transparent;color:#6f6a5c;cursor:not-allowed}
      .tok-sheet .gm-history-start>span,.tok-sheet .gm-history-active small{color:#8d8675;font:400 12px/1.3 "EB Garamond",serif}.tok-sheet .gm-history-active .dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#74b77c;box-shadow:0 0 10px rgba(116,183,124,.4)}.tok-sheet .gm-history-active b,.tok-sheet .gm-history-active small{display:block}.tok-sheet .gm-history-active b{color:#8acb91;font:600 9px/1.2 "Oswald",sans-serif;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px}.tok-sheet .gm-history-message{color:#e0a07a!important}
      @media(max-width:620px){.tok-ia-overlay{align-items:flex-end;padding:0}.tok-ia-dialog{width:100%;max-height:92vh;border-left:0;border-right:0;border-bottom:0}.tok-ia-head{padding:14px 13px 11px}.tok-ia-head h2{font-size:20px}.tok-ia-progress button{padding:6px 3px;font-size:7px}.tok-ia-progress i{display:grid;margin:0 auto 4px}.tok-ia-body{padding:15px 13px 19px}.tok-ia-fields,.tok-ia-review{grid-template-columns:1fr}.tok-ia-field.wide,.tok-ia-review>div.wide{grid-column:auto}.tok-ia-actions{padding:10px 12px}.tok-ia-preview{font-size:8px}.tok-ia-action{padding:0 11px}}
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function open(options) {
    options = options || {};
    var doc = options.document || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.createElement) throw new Error('The item-history dialog needs a document.');
    injectCss(doc);
    var item = clone(options.item || {});
    var itemName = text(item.name) || 'Item';
    var knownRarity = normalizeRarity(item.rarity);
    var initialRules = Array.isArray(item.entries) ? item.entries.filter(function (entry) { return typeof entry === 'string'; }).join('\n\n') : '';
    var initialDescription = text(item.flavor || item.publicDescription || '');
    var state = { step: 0, identification: 'unidentified', busy: false, options: { currentSession: null, sessions: [], locations: [] } };
    var overlay = doc.createElement('div');
    overlay.className = 'tok-ia-overlay';
    overlay.innerHTML = '<section class="tok-ia-dialog" role="dialog" aria-modal="true" aria-labelledby="tok-ia-title">'
      + '<header class="tok-ia-head"><div><h2 id="tok-ia-title">Begin item history</h2><p>' + esc(itemName) + ' · ' + esc(options.characterName || options.characterKey) + '\'s inventory</p></div><button class="tok-ia-close" type="button" aria-label="Close">×</button></header>'
      + '<nav class="tok-ia-progress" aria-label="Adoption steps"><button type="button" data-ia-step="0" aria-pressed="true"><i>1</i>Public face</button><button type="button" data-ia-step="1" aria-pressed="false"><i>2</i>Secret</button><button type="button" data-ia-step="2" aria-pressed="false"><i>3</i>Origin</button><button type="button" data-ia-step="3" aria-pressed="false"><i>4</i>Review</button></nav>'
      + '<div data-ia-flow><div class="tok-ia-body">'
        + '<section class="tok-ia-panel" data-ia-panel="0"><h3>What does the party know?</h3><p class="tok-ia-copy">This is what players see on sheets and in references.</p><div class="tok-ia-modes"><button class="tok-ia-mode" type="button" data-ia-identification="unidentified" aria-pressed="true"><b>Unidentified</b><span>Smoke conceals rarity and rules.</span></button><button class="tok-ia-mode" type="button" data-ia-identification="identified" aria-pressed="false"><b>Identified</b><span>Publish the known item now.</span></button></div><div class="tok-ia-fields"><label class="tok-ia-field"><span>Public name</span><input data-ia-field="publicName" value="' + esc(itemName) + '"></label><label class="tok-ia-field"><span>Known rarity</span><select data-ia-field="publicRarity" disabled>' + RARITIES.map(function (rarity) { return '<option' + (rarity === knownRarity ? ' selected' : '') + '>' + rarity + '</option>'; }).join('') + '</select></label><label class="tok-ia-field wide"><span>Visible description</span><textarea data-ia-field="publicDescription">' + esc(initialDescription) + '</textarea></label></div></section>'
        + '<section class="tok-ia-panel" data-ia-panel="1" hidden><h3>What remains behind the screen?</h3><p class="tok-ia-copy" data-ia-secret-copy>Only staff can read this until the item is identified.</p><div class="tok-ia-secret" data-ia-secret><div class="tok-ia-secret-label">Staff-only truth</div><div class="tok-ia-fields"><label class="tok-ia-field"><span>True name</span><input data-ia-field="trueName" value="' + esc(itemName) + '"></label><label class="tok-ia-field"><span>Rarity</span><select data-ia-field="rarity">' + RARITIES.map(function (rarity) { return '<option' + (rarity === knownRarity ? ' selected' : '') + '>' + rarity + '</option>'; }).join('') + '</select></label><label class="tok-ia-field wide"><span>Rules revealed on identification</span><textarea data-ia-field="rules">' + esc(initialRules) + '</textarea></label><label class="tok-ia-field wide"><span>Private lore</span><textarea data-ia-field="lore">' + esc(item.notes || '') + '</textarea></label></div></div></section>'
        + '<section class="tok-ia-panel" data-ia-panel="2" hidden><h3>Where did it enter the story?</h3><p class="tok-ia-copy">These links can surface in Chronicle and the Party\'s Path later.</p><div class="tok-ia-fields"><label class="tok-ia-field"><span>Session</span><select data-ia-field="sessionId"><option value="">Loading sessions…</option></select></label><label class="tok-ia-field"><span>Location</span><select data-ia-field="locationId"><option value="">Loading locations…</option></select></label><label class="tok-ia-field"><span>Encounter reference</span><input data-ia-field="encounterId" placeholder="Optional"></label><label class="tok-ia-field"><span>Battle map reference</span><input data-ia-field="battleMapId" placeholder="Optional"></label><label class="tok-ia-field wide"><span>Recovery story</span><textarea data-ia-field="recoverySummary">Recovered ' + esc(itemName) + '.</textarea></label></div><div class="tok-ia-origin-note">The durable links are stored now. Choosing an exact World-map moment remains an intentional later step.</div></section>'
        + '<section class="tok-ia-panel" data-ia-panel="3" hidden><h3>Create one permanent campaign object</h3><p class="tok-ia-copy">Nothing else in the inventory is automatically tracked.</p><div class="tok-ia-review"><div><span class="label">Party sees</span><b data-ia-review="public"></b><span class="sub" data-ia-review="state"></span></div><div><span class="label">Staff knows</span><b data-ia-review="secret"></b><span class="sub" data-ia-review="rarity"></span></div><div><span class="label">Recovered</span><b data-ia-review="location"></b><span class="sub" data-ia-review="session"></span></div><div><span class="label">Initial bearer</span><b>' + esc(options.characterName || options.characterKey) + '</b><span class="sub">The selected inventory row receives the permanent identity.</span></div><div class="wide"><span class="label">Object history begins with</span><div class="tok-ia-events"><div class="tok-ia-event"><b data-ia-review="recovery"></b><span class="sub" data-ia-review="eventPlace"></span></div><div class="tok-ia-event"><b>Entrusted to ' + esc(options.characterName || options.characterKey) + '</b><span class="sub">Party decision · same permanent item</span></div></div></div></div></section>'
      + '</div><footer class="tok-ia-actions"><label class="tok-ia-preview"><input data-ia-preview type="checkbox">Preview player view</label><div class="tok-ia-buttons"><button class="tok-ia-action" data-ia-back type="button" disabled>Back</button><button class="tok-ia-action primary" data-ia-next type="button">Continue</button></div></footer><div class="tok-ia-status" data-ia-status role="status" aria-live="polite"></div></div>'
      + '<section class="tok-ia-success" data-ia-success hidden><div class="tok-ia-success-mark">✓</div><h3 data-ia-success-name></h3><p>Recovery and initial assignment are recorded. Hidden truth remains staff-only until identification.</p><button class="tok-ia-action primary" data-ia-finish type="button">Return to item</button></section>'
      + '</section>';
    (doc.body || doc.documentElement).appendChild(overlay);

    function one(selector) { return overlay.querySelector(selector); }
    function value(name) { var el = one('[data-ia-field="' + name + '"]'); return el ? text(el.value) : ''; }
    function status(message) { one('[data-ia-status]').textContent = message || ''; }
    function close() {
      if (state.busy) return;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      doc.removeEventListener('keydown', onKey);
    }
    function onKey(event) { if (event.key === 'Escape') close(); }
    function selectedLabel(name, fallback) { var el = one('[data-ia-field="' + name + '"]'); return el && el.selectedIndex >= 0 ? text(el.options[el.selectedIndex].textContent) || fallback : fallback; }
    function updateReview() {
      var identified = state.identification === 'identified';
      var publicName = value('publicName') || itemName;
      var trueName = value('trueName') || publicName;
      var rarity = value('rarity') || knownRarity;
      one('[data-ia-review="public"]').textContent = identified ? trueName : publicName;
      one('[data-ia-review="state"]').textContent = identified ? rarity + ' · published rules' : 'Unidentified · smoky treatment';
      one('[data-ia-review="secret"]').textContent = trueName;
      one('[data-ia-review="rarity"]').textContent = identified ? rarity + ' · private lore retained' : rarity + ' · private until revealed';
      one('[data-ia-review="location"]').textContent = selectedLabel('locationId', 'No linked location');
      one('[data-ia-review="session"]').textContent = selectedLabel('sessionId', 'No linked session');
      one('[data-ia-review="recovery"]').textContent = value('recoverySummary') || ('Recovered ' + publicName + '.');
      one('[data-ia-review="eventPlace"]').textContent = selectedLabel('locationId', 'Unplaced') + ' · ' + selectedLabel('sessionId', 'Unlinked session');
    }
    function validateStep() {
      if (state.step === 0 && !value('publicName')) return 'Give the party-facing item a name.';
      if (state.step === 1 && !value('trueName')) return 'Add the staff-only true name.';
      return '';
    }
    function showStep(step) {
      state.step = Math.max(0, Math.min(3, Number(step) || 0));
      overlay.querySelectorAll('[data-ia-panel]').forEach(function (panel) { panel.hidden = Number(panel.getAttribute('data-ia-panel')) !== state.step; });
      overlay.querySelectorAll('[data-ia-step]').forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.getAttribute('data-ia-step')) === state.step)); });
      one('[data-ia-back]').disabled = state.step === 0;
      one('[data-ia-next]').textContent = state.step === 3 ? 'Begin history' : 'Continue';
      status(''); if (state.step === 3) updateReview();
    }
    function setIdentification(mode) {
      state.identification = mode === 'identified' ? 'identified' : 'unidentified';
      overlay.querySelectorAll('[data-ia-identification]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-ia-identification') === state.identification)); });
      one('[data-ia-field="publicRarity"]').disabled = state.identification !== 'identified';
      one('[data-ia-secret-copy]').textContent = state.identification === 'identified' ? 'Known item details become public; private lore stays behind the screen.' : 'Only staff can read this until the item is identified.';
      updateReview();
    }
    function input() {
      return {
        item: item,
        characterKey: options.characterKey,
        characterName: options.characterName,
        inventoryIndex: options.inventoryIndex,
        identification: state.identification,
        publicName: value('publicName'),
        publicDescription: value('publicDescription'),
        trueName: value('trueName'),
        rarity: value('rarity'),
        rules: value('rules'), lore: value('lore'),
        sessionId: value('sessionId'), locationId: value('locationId'),
        encounterId: value('encounterId'), battleMapId: value('battleMapId'),
        recoverySummary: value('recoverySummary')
      };
    }
    async function complete() {
      var message = validateStep(); if (message) { status(message); return; }
      state.busy = true; status('Creating the permanent item and its first two history moments…');
      var next = one('[data-ia-next]'); next.disabled = true;
      try {
        var result = await adopt(options.supabase, input());
        one('[data-ia-flow]').hidden = true;
        one('[data-ia-success]').hidden = false;
        one('.tok-ia-close').hidden = true;
        var shownName = state.identification === 'identified' ? value('trueName') : value('publicName');
        one('[data-ia-success-name]').textContent = shownName + ' is now tracked';
        if (typeof options.onSuccess === 'function') await options.onSuccess(result);
      } catch (error) {
        state.busy = false; next.disabled = false;
        status((error && error.message) || 'The item history could not be created.');
      }
    }

    one('.tok-ia-close').addEventListener('click', close);
    one('[data-ia-finish]').addEventListener('click', function () { state.busy = false; if (typeof options.onFinish === 'function') options.onFinish(); else close(); });
    one('[data-ia-back]').addEventListener('click', function () { showStep(state.step - 1); });
    one('[data-ia-next]').addEventListener('click', function () { var message = validateStep(); if (message) { status(message); return; } if (state.step === 3) complete(); else showStep(state.step + 1); });
    overlay.querySelectorAll('[data-ia-step]').forEach(function (button) { button.addEventListener('click', function () { if (!state.busy) showStep(button.getAttribute('data-ia-step')); }); });
    overlay.querySelectorAll('[data-ia-identification]').forEach(function (button) { button.addEventListener('click', function () { setIdentification(button.getAttribute('data-ia-identification')); }); });
    one('[data-ia-preview]').addEventListener('change', function (event) { one('[data-ia-secret]').classList.toggle('player', !!event.target.checked); });
    overlay.addEventListener('input', updateReview);
    overlay.addEventListener('change', function (event) {
      if (state.identification === 'identified') {
        if (event.target === one('[data-ia-field="publicRarity"]')) one('[data-ia-field="rarity"]').value = event.target.value;
        else if (event.target === one('[data-ia-field="rarity"]')) one('[data-ia-field="publicRarity"]').value = event.target.value;
      }
      updateReview();
    });
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    doc.addEventListener('keydown', onKey);

    var ready = Promise.resolve(options.contextOptions || loadContextOptions(options.supabase)).then(function (loaded) {
      state.options = loaded || state.options;
      one('[data-ia-field="sessionId"]').innerHTML = optionHtml(state.options.sessions, 'No linked session', state.options.currentSession);
      one('[data-ia-field="locationId"]').innerHTML = optionHtml(state.options.locations, 'No linked location', null);
      updateReview();
      return state.options;
    }).catch(function () {
      one('[data-ia-field="sessionId"]').innerHTML = optionHtml([], 'Sessions unavailable', null);
      one('[data-ia-field="locationId"]').innerHTML = optionHtml([], 'Locations unavailable', null);
      return state.options;
    });
    showStep(0);
    return { element: overlay, ready: ready, close: close, input: input };
  }

  function itemByKey(inventory, renderKey) {
    inventory = Array.isArray(inventory) ? inventory : [];
    if (String(renderKey).indexOf('id:') === 0) {
      var id = String(renderKey).slice(3);
      for (var i = 0; i < inventory.length; i++) if (inventory[i] && String(inventory[i].id) === id) return { item: inventory[i], index: i };
      return null;
    }
    if (String(renderKey).indexOf('ix:') === 0) {
      var index = parseInt(String(renderKey).slice(3), 10);
      return Number.isInteger(index) && inventory[index] ? { item: inventory[index], index: index } : null;
    }
    return null;
  }

  async function mount(options) {
    options = options || {};
    var doc = options.document || (typeof document !== 'undefined' ? document : null);
    var hostRoot = options.root || doc;
    var view = doc && doc.defaultView;
    var search = options.search != null ? options.search : (view && view.location ? view.location.search : '');
    if (!doc || !hostRoot || !isEnabled(search)) return { active: false };
    var tok = options.tok || (view && view.__tok) || (typeof window !== 'undefined' ? window.__tok : null);
    var profile = options.profile || null;
    try { if (!profile && tok && tok.ready) profile = await tok.ready; else if (!profile && tok) profile = tok.profile; } catch (_) {}
    if (!isStaff(profile)) return { active: false };
    var characterData = options.characterData || (view && view.CharacterData) || (typeof window !== 'undefined' ? window.CharacterData : null);
    var supabase = options.supabase || (tok && tok.sb);
    if (!characterData || typeof characterData.loadCharacter !== 'function' || !supabase) return { active: false };
    injectCss(doc);
    var sheet = hostRoot.querySelector ? hostRoot.querySelector('.tok-sheet') : null;
    var box = hostRoot.querySelector ? hostRoot.querySelector('[data-equip]') : null;
    if (!sheet || !box) return { active: false };
    sheet.classList.add('item-history-staff');

    function current(renderKey) { return itemByKey((box.__gmCtx && box.__gmCtx.inventory) || [], renderKey); }
    function historyHtml(item, renderKey) {
      if (item.instanceId) return '<div class="gm-history-active" data-item-history-action><span class="dot"></span><span><b>History active</b><small>This item keeps its identity when renamed or transferred.</small></span></div>';
      var stacked = Number(item.qty || 1) !== 1;
      return '<div class="gm-history-start" data-item-history-action><button type="button" data-item-adopt="' + esc(renderKey) + '"' + (stacked ? ' disabled title="Split this stack to one item first"' : '') + '>Begin item history</button><span>' + (stacked ? 'Split this stack to one item before tracking it.' : 'Create a permanent campaign object from this item.') + '</span></div>';
    }
    function decorate() {
      var details = hostRoot.querySelectorAll ? hostRoot.querySelectorAll('.gm-detail') : [];
      details.forEach(function (detail) {
        if (detail.querySelector('[data-item-history-action]')) return;
        var edit = detail.querySelector('[data-editopen]'); if (!edit) return;
        var renderKey = edit.getAttribute('data-editopen');
        var found = current(renderKey); if (!found) return;
        var wrap = doc.createElement('div'); wrap.innerHTML = historyHtml(found.item, renderKey);
        detail.insertBefore(wrap.firstChild, edit.parentNode || null);
      });
    }
    function narrate(button, message) {
      var action = button && button.closest ? button.closest('[data-item-history-action]') : null;
      var note = action && action.querySelector('span');
      if (note) { note.textContent = message; note.classList.add('gm-history-message'); }
    }
    async function onClick(event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-item-adopt]') : null;
      if (!button || !hostRoot.contains(button) || button.disabled) return;
      event.preventDefault(); event.stopPropagation();
      var renderKey = button.getAttribute('data-item-adopt');
      button.disabled = true; narrate(button, 'Checking the current inventory…');
      try {
        var character = await characterData.loadCharacter(options.characterKey);
        var fresh = itemByKey((character && character.inventory) || [], renderKey);
        if (!fresh) throw new Error('That inventory item changed. Refresh and try again.');
        if (fresh.item.instanceId) throw new Error('This item already has an active history.');
        if (Number(fresh.item.qty || 1) !== 1) throw new Error('Split this stack to one item before tracking it.');
        open({
          document: doc,
          supabase: supabase,
          item: fresh.item,
          inventoryIndex: fresh.index,
          characterKey: options.characterKey,
          characterName: text(options.characterName || character.name || options.characterKey),
          contextOptions: options.contextOptions,
          onSuccess: options.onSuccess,
          onFinish: function () {
            if (typeof options.onFinish === 'function') options.onFinish();
            else if (view && view.location && typeof view.location.reload === 'function') view.location.reload();
          }
        });
        button.disabled = false; narrate(button, 'Create a permanent campaign object from this item.');
      } catch (error) {
        button.disabled = false; narrate(button, (error && error.message) || 'Item history is unavailable.');
      }
    }
    hostRoot.addEventListener('click', onClick, true);
    var Observer = (view && view.MutationObserver) || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    var observer = Observer ? new Observer(decorate) : null;
    if (observer) observer.observe(box, { childList: true, subtree: true });
    decorate();
    return { active: true, decorate: decorate, destroy: function () { hostRoot.removeEventListener('click', onClick, true); if (observer) observer.disconnect(); sheet.classList.remove('item-history-staff'); } };
  }

  return { VERSION: VERSION, RARITIES: RARITIES.slice(), isEnabled: isEnabled, isStaff: isStaff, buildPayload: buildPayload, adopt: adopt, loadContextOptions: loadContextOptions, injectCss: injectCss, open: open, mount: mount, itemByKey: itemByKey };
});
