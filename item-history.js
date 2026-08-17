/* item-history.js — flagged Gear detail for durable campaign items.
 * Reads public item state + append-only events for campaign members and reads
 * item_secrets only for staff. Approved management writes route only through
 * narrow transactional RPCs; no campaign-entity projection lives here. Plain
 * script + CommonJS dual export: window.ItemHistory.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ItemHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 'ih-6';
  var EVENT_LABELS = {
    recovered: 'Recovered', assigned: 'Assigned', identified: 'Identified',
    renamed: 'Renamed', transferred: 'Transferred', transformed: 'Transformed',
    lost: 'Lost', destroyed: 'Destroyed'
  };
  var RARITY_CLASS = {
    Common: 'common', Uncommon: 'uncommon', Rare: 'rare',
    'Very Rare': 'very-rare', Legendary: 'legendary', Artifact: 'artifact'
  };

  function text(value) { return String(value == null ? '' : value).trim(); }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isStaff(profile) { return !!(profile && (profile.role === 'dm' || profile.role === 'overseer')); }
  function isEnabled(search) {
    try { return new URLSearchParams(search == null ? '' : String(search)).get('itemHistory') !== '0'; }
    catch (_) { return false; }
  }
  function errorMessage(result, fallback) { return result && result.error && result.error.message ? result.error.message : fallback; }
  function eventTime(row) {
    var value = text(row && row.occurred_at);
    var time = value ? Date.parse(value) : NaN;
    return isNaN(time) ? 0 : time;
  }
  function sortEvents(rows) {
    return (Array.isArray(rows) ? rows.slice() : []).sort(function (a, b) {
      return eventTime(a) - eventTime(b) || Number(a.sequence || 0) - Number(b.sequence || 0);
    });
  }
  function mechanicsText(value) {
    if (typeof value === 'string') return text(value);
    if (!value || typeof value !== 'object') return '';
    if (typeof value.description === 'string') return text(value.description);
    if (Array.isArray(value.entries)) return value.entries.filter(function (entry) { return typeof entry === 'string'; }).join('\n\n');
    return '';
  }
  function labelKey(value) {
    var out = text(value).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return out ? out.charAt(0).toUpperCase() + out.slice(1).toLowerCase() : '';
  }

  async function loadItem(sb, itemId, staff) {
    itemId = text(itemId);
    if (!sb || typeof sb.from !== 'function') throw new Error('Item history is unavailable on this page.');
    if (!itemId) throw new Error('A permanent item identity is required.');
    var publicRequest = sb.from('item_instances')
      .select('id,display_name,public_description,rarity,identification,mechanics,status,current_bearer_key,current_location_id,slot,requires_attunement,attuned,created_at')
      .eq('id', itemId).maybeSingle();
    var eventsRequest = sb.from('item_events')
      .select('sequence,id,event_type,occurred_at,actor_character_key,summary,data,session_id,location_id,encounter_id,battle_map_id')
      .eq('item_id', itemId).order('occurred_at', { ascending: true }).order('sequence', { ascending: true });
    var secretRequest = staff
      ? sb.from('item_secrets').select('item_id,true_name,definition_key,rarity,public_description,mechanics,lore').eq('item_id', itemId).maybeSingle()
      : Promise.resolve({ data: null, error: null });
    var charactersRequest = sb.from('characters').select('key,structural,delete_marked');
    var results = await Promise.all([publicRequest, eventsRequest, secretRequest, charactersRequest]);
    if (results[0] && results[0].error) throw new Error(errorMessage(results[0], 'The tracked item could not be read.'));
    if (!results[0] || !results[0].data) throw new Error('This tracked item no longer exists or is unavailable.');
    if (results[1] && results[1].error) throw new Error(errorMessage(results[1], 'The item history could not be read.'));
    var characterNames = {};
    (results[3] && !results[3].error && Array.isArray(results[3].data) ? results[3].data : []).forEach(function (row) {
      characterNames[text(row.key)] = text(row.structural && row.structural.name) || text(row.key);
    });
    return {
      item: results[0].data,
      events: sortEvents(results[1] && results[1].data),
      secret: results[2] && !results[2].error ? results[2].data : null,
      secretError: staff && results[2] && results[2].error ? errorMessage(results[2], 'Staff truth is unavailable.') : '',
      characterNames: characterNames,
      characters: results[3] && !results[3].error && Array.isArray(results[3].data) ? results[3].data : []
    };
  }

  async function setRequirement(sb, itemId, required) {
    if (!sb || typeof sb.rpc !== 'function') throw new Error('Item management is unavailable on this page.');
    var result = await sb.rpc('set_item_attunement_requirement', { p_item_id: text(itemId), p_requires_attunement: !!required });
    if (result && result.error) throw new Error(errorMessage(result, 'The attunement requirement could not be saved.'));
    if (!result || !result.data || !result.data.item) throw new Error('The server did not confirm the attunement requirement.');
    return result.data;
  }
  async function identifyItem(sb, itemId, summary) {
    if (!sb || typeof sb.rpc !== 'function') throw new Error('Item management is unavailable on this page.');
    var result = await sb.rpc('identify_item', { p_item_id: text(itemId), p_summary: text(summary) });
    if (result && result.error) throw new Error(errorMessage(result, 'The item could not be identified.'));
    if (!result || !result.data || !result.data.item || !result.data.event) throw new Error('The server did not confirm identification.');
    return result.data;
  }
  async function renameItem(sb, itemId, newName, summary) {
    if (!sb || typeof sb.rpc !== 'function') throw new Error('Item management is unavailable on this page.');
    var result = await sb.rpc('rename_item', { p_item_id: text(itemId), p_new_name: text(newName), p_summary: text(summary) });
    if (result && result.error) throw new Error(errorMessage(result, 'The item could not be renamed.'));
    if (!result || !result.data || !result.data.item || !result.data.event) throw new Error('The server did not confirm the new name.');
    return result.data;
  }
  async function transferItem(sb, itemId, fromKey, toKey, summary) {
    if (!sb || typeof sb.rpc !== 'function') throw new Error('Item management is unavailable on this page.');
    var result = await sb.rpc('transfer_item', { p_item_id: text(itemId), p_expected_from_character_key: text(fromKey), p_to_character_key: text(toKey), p_summary: text(summary) });
    if (result && result.error) throw new Error(errorMessage(result, 'The item could not be transferred.'));
    if (!result || !result.data || !result.data.item || !result.data.event) throw new Error('The server did not confirm the transfer.');
    return result.data;
  }

  function dateLabel(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return 'Date not recorded';
    try { return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date); }
    catch (_) { return date.toISOString().slice(0, 10); }
  }
  function eventMeta(row, options) {
    var parts = [dateLabel(row.occurred_at)];
    var actorKey = text(row.actor_character_key);
    if (actorKey && options.characterNames && text(options.characterNames[actorKey])) parts.push(text(options.characterNames[actorKey]));
    else if (actorKey === text(options.characterKey) && text(options.characterName)) parts.push(text(options.characterName));
    if (text(row.session_id)) parts.push('Session ' + text(row.session_id));
    if (text(row.location_id)) parts.push('Location linked');
    if (text(row.encounter_id)) parts.push('Encounter linked');
    if (text(row.battle_map_id)) parts.push('Battle map linked');
    return parts;
  }
  function eventsHtml(events, options) {
    if (!events.length) return '<div class="tok-ih-empty">No history moments are recorded yet.</div>';
    return events.map(function (row) {
      var summary = text(row.summary) || EVENT_LABELS[row.event_type] || 'Item history updated';
      var data = row && row.data && typeof row.data === 'object' ? row.data : {};
      var detail = text(data.note || data.description || '');
      return '<article class="tok-ih-event"><span class="tok-ih-event-kind">' + esc(EVENT_LABELS[row.event_type] || row.event_type || 'Event') + '</span><h4>' + esc(summary) + '</h4>'
        + (detail ? '<p>' + esc(detail) + '</p>' : '')
        + '<div class="tok-ih-event-meta">' + eventMeta(row, options || {}).map(function (part) { return '<span>' + esc(part) + '</span>'; }).join('<i>·</i>') + '</div></article>';
    }).join('');
  }
  function bearerLabel(item, options) {
    var key = text(item.current_bearer_key);
    if (!key) return item.status === 'destroyed' ? 'Destroyed' : (item.status === 'lost' ? 'No current bearer' : 'Unplaced');
    if (options.characterNames && text(options.characterNames[key])) return text(options.characterNames[key]);
    if (key === text(options.characterKey) && text(options.characterName)) return text(options.characterName);
    return key;
  }
  function attunementLabel(item, bearer) {
    if (!item.requires_attunement) return 'No attunement required';
    return item.attuned ? 'Attuned · ' + (text(bearer) || 'current bearer') : 'Requires attunement · not attuned';
  }
  function secretHtml(record) {
    if (record.secretError) return '<section class="tok-ih-secret error"><div class="tok-ih-secret-label">Staff-only truth unavailable</div><p>' + esc(record.secretError) + ' Refresh or confirm the current campaign role.</p></section>';
    if (!record.secret) return '<section class="tok-ih-secret"><div class="tok-ih-secret-label">Staff-only truth</div><p>No separate secret record exists for this tracked item.</p></section>';
    var secret = record.secret;
    var rules = mechanicsText(secret.mechanics);
    return '<section class="tok-ih-secret"><div class="tok-ih-secret-label">Staff-only truth</div>'
      + '<div class="tok-ih-secret-row"><span>True name</span><b>' + esc(secret.true_name || 'Unrecorded') + '</b></div>'
      + '<div class="tok-ih-secret-row"><span>True rarity</span><b>' + esc(secret.rarity || 'Unrecorded') + '</b></div>'
      + '<div class="tok-ih-secret-row"><span>Rules on identification</span><p>' + esc(rules || 'No hidden rules recorded.') + '</p></div>'
      + '<div class="tok-ih-secret-row"><span>Private lore</span><p>' + esc(secret.lore || 'No private lore recorded.') + '</p></div></section>';
  }

  function injectCss(doc) {
    if (!doc || doc.getElementById('tok-ih-css')) return;
    var style = doc.createElement('style');
    style.id = 'tok-ih-css';
    style.textContent = `
      .tok-sheet .gm-history-open{display:flex;align-items:center;gap:10px;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.tok-sheet .gm-history-open:hover b{color:#f3e8d1}.tok-sheet .gm-history-active.unidentified .dot{background:#aa8bc4;box-shadow:0 0 12px rgba(170,139,196,.55)}.tok-sheet .gm-history-active.unidentified b{color:#c2a8d7}.tok-sheet .gm-history-active .chev{margin-left:auto;color:#8d8675;font-size:16px}
      .tok-ih-overlay{position:fixed;inset:0;z-index:10045;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,8,7,.86);box-sizing:border-box;backdrop-filter:blur(3px)}.tok-ih-dialog{width:min(980px,100%);max-height:min(800px,calc(100vh - 40px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(199,154,74,.62);background:linear-gradient(145deg,#142620,#0b1714);box-shadow:0 28px 90px rgba(0,0,0,.72);color:#ece2cd}
      .tok-ih-head{display:flex;align-items:flex-start;gap:16px;padding:16px 18px 13px;border-bottom:1px solid rgba(236,226,205,.13);background:#0d1815}.tok-ih-head>div:first-child{flex:1}.tok-ih-kicker{color:#c79a4a;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.17em;text-transform:uppercase}.tok-ih-head h2{margin:5px 0 0;color:#f3e8d1;font:500 27px/1.05 "Playfair Display",Georgia,serif}.tok-ih-audience{display:flex;gap:6px;margin-left:auto}.tok-ih-audience button{min-height:42px;padding:0 12px;border:1px solid rgba(236,226,205,.18);background:transparent;color:#8d8675;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase;cursor:pointer}.tok-ih-audience button[aria-pressed="true"]{border-color:#c79a4a;background:rgba(199,154,74,.1);color:#e7c279}.tok-ih-close{flex:0 0 auto;width:42px;height:42px;border:1px solid rgba(236,226,205,.2);background:transparent;color:#a9a08d;font-size:20px;cursor:pointer}
      .tok-ih-scroll{min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}.tok-ih-hero{position:relative;display:grid;grid-template-columns:116px 1fr 215px;align-items:center;gap:21px;min-height:166px;padding:22px 25px;border-bottom:1px solid rgba(236,226,205,.13);overflow:hidden}.tok-ih-hero.unidentified{background:radial-gradient(circle at 10% 50%,rgba(154,119,182,.16),transparent 31%)}.tok-ih-sigil{position:relative;width:88px;height:88px;display:grid;place-items:center;margin:auto;border:1px solid rgba(170,139,196,.55);background:radial-gradient(circle,rgba(145,111,177,.27),rgba(11,24,21,.84) 65%);box-shadow:0 0 38px rgba(145,111,177,.2);transform:rotate(45deg)}.tok-ih-sigil:before,.tok-ih-sigil:after{content:"";position:absolute;border-radius:50%;filter:blur(10px);background:rgba(190,161,212,.13)}.tok-ih-sigil:before{width:76px;height:32px;transform:translate(-22px,13px)}.tok-ih-sigil:after{width:50px;height:52px;transform:translate(25px,-15px)}.tok-ih-sigil span{position:relative;z-index:1;color:#e7c279;font-size:31px;transform:rotate(-45deg)}.tok-ih-hero.identified .tok-ih-sigil{border-color:var(--tok-ih-rarity,#718ddb);box-shadow:0 0 38px color-mix(in srgb,var(--tok-ih-rarity,#718ddb) 25%,transparent)}.tok-ih-hero.identified .tok-ih-sigil:before,.tok-ih-hero.identified .tok-ih-sigil:after{opacity:.2}
      .tok-ih-identity{min-width:0}.tok-ih-state{color:#b79acb;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase}.tok-ih-hero.identified .tok-ih-state{color:var(--tok-ih-rarity,#9fb3ef)}.tok-ih-identity h3{margin:6px 0 5px;color:#f8efdc;font:500 clamp(30px,4vw,48px)/1 "Playfair Display",Georgia,serif}.tok-ih-identity p{max-width:590px;margin:0;color:#aaa18f;font:14px/1.42 "EB Garamond",Georgia,serif}.tok-ih-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}.tok-ih-badge{padding:5px 7px;border:1px solid rgba(236,226,205,.16);color:#999181;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.tok-ih-badge.rarity{border-color:var(--tok-ih-rarity,#a786d8);color:var(--tok-ih-rarity,#c3a9d7)}.tok-ih-custody{padding:12px 13px;border:1px solid rgba(236,226,205,.14);background:rgba(5,12,10,.28)}.tok-ih-custody span,.tok-ih-custody b{display:block}.tok-ih-custody span{color:#8d8675;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.tok-ih-custody b{margin:6px 0 3px;color:#f3e8d1;font:500 17px "EB Garamond",Georgia,serif}.tok-ih-custody em{display:block;margin-bottom:5px;color:#999181;font:11px/1.3 "EB Garamond",Georgia,serif}.tok-ih-custody small{display:block;overflow-wrap:anywhere;color:#7f796c;font:11px/1.35 ui-monospace,SFMono-Regular,monospace}
      .tok-ih-tabs{display:flex;border-bottom:1px solid rgba(236,226,205,.13)}.tok-ih-tabs button{min-height:50px;padding:0 19px;border:0;border-bottom:2px solid transparent;background:transparent;color:#807a6c;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}.tok-ih-tabs button[aria-selected="true"]{border-bottom-color:#e7c279;color:#e7c279}.tok-ih-body{display:grid;grid-template-columns:minmax(0,1fr) 320px}.tok-ih-main{min-width:0;padding:0 23px 27px;border-right:1px solid rgba(236,226,205,.13)}.tok-ih-panel{display:none;padding-top:20px}.tok-ih-panel.on{display:block}.tok-ih-label{color:#c79a4a;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase}.tok-ih-copy{margin:7px 0 18px;color:#d8cfbd;font:16px/1.5 "EB Garamond",Georgia,serif}.tok-ih-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.tok-ih-fact{min-height:74px;padding:11px;border:1px solid rgba(236,226,205,.13);background:rgba(5,12,10,.22)}.tok-ih-fact span,.tok-ih-fact b{display:block}.tok-ih-fact span{color:#817b6e;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase}.tok-ih-fact b{margin-top:7px;color:#efe5d1;font:500 14px/1.2 "EB Garamond",Georgia,serif}.tok-ih-rules{margin-top:15px;padding:14px 15px;border-left:2px solid var(--tok-ih-rarity,#a786d8);background:rgba(167,134,216,.06)}.tok-ih-rules h4{margin:0 0 5px;color:var(--tok-ih-rarity,#c3a9d7);font:500 17px "Playfair Display",Georgia,serif}.tok-ih-rules p{margin:0;color:#aaa18f;white-space:pre-line;font:13px/1.5 "EB Garamond",Georgia,serif}
      .tok-ih-history-head{display:flex;align-items:flex-end;gap:12px}.tok-ih-history-head h3{margin:4px 0 0;color:#f3e8d1;font:500 23px "Playfair Display",Georgia,serif}.tok-ih-order{margin-left:auto;color:#777265;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.tok-ih-timeline{position:relative;margin-top:18px;padding-left:29px}.tok-ih-timeline:before{content:"";position:absolute;left:9px;top:10px;bottom:15px;width:1px;background:linear-gradient(#c79a4a,rgba(199,154,74,.16))}.tok-ih-event{position:relative;margin-bottom:10px;padding:12px 13px;border:1px solid rgba(236,226,205,.13);background:rgba(5,12,10,.23)}.tok-ih-event:before{content:"";position:absolute;left:-24px;top:17px;width:8px;height:8px;border:1px solid #c79a4a;background:#12221d;transform:rotate(45deg)}.tok-ih-event-kind{color:#e7c279;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.13em;text-transform:uppercase}.tok-ih-event h4{margin:5px 0 0;color:#efe5d1;font:500 15px/1.25 "EB Garamond",Georgia,serif}.tok-ih-event p{margin:5px 0 0;color:#999181;font:12px/1.4 "EB Garamond",Georgia,serif}.tok-ih-event-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;color:#777265;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase}.tok-ih-event-meta i{font-style:normal}.tok-ih-empty{padding:18px;border:1px solid rgba(236,226,205,.13);color:#8d8675;font:13px "EB Garamond",Georgia,serif}
      .tok-ih-side{padding:20px}.tok-ih-secret{position:relative;padding:14px;border:1px solid rgba(167,134,216,.4);background:rgba(167,134,216,.07)}.tok-ih-secret.error{border-color:rgba(224,160,122,.45);background:rgba(224,160,122,.06)}.tok-ih-secret-label{margin-bottom:10px;color:#bfa5d4;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase}.tok-ih-secret-row{padding:9px 0;border-top:1px solid rgba(167,134,216,.15)}.tok-ih-secret-row span,.tok-ih-secret-row b{display:block}.tok-ih-secret-row span{color:#91859b;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.tok-ih-secret-row b{margin-top:4px;color:#d5c6e1;font:500 14px "EB Garamond",Georgia,serif}.tok-ih-secret-row p,.tok-ih-secret>p{margin:4px 0 0;color:#a99daf;white-space:pre-line;font:12px/1.42 "EB Garamond",Georgia,serif}.tok-ih-manage{margin-top:12px;padding:14px;border:1px solid rgba(236,226,205,.15)}.tok-ih-manage b,.tok-ih-manage small{display:block}.tok-ih-manage b{color:#efe5d1;font:500 15px "EB Garamond",Georgia,serif}.tok-ih-manage small{margin:5px 0 10px;color:#999181;font:12px/1.4 "EB Garamond",Georgia,serif}.tok-ih-manage button{width:100%;min-height:48px;border:1px solid rgba(199,154,74,.5);background:rgba(199,154,74,.08);color:#e7c279;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}.tok-ih-manage-msg{min-height:16px;margin-top:8px;color:#c7b999;font:11px/1.35 "EB Garamond",Georgia,serif}.tok-ih-player-note{padding:14px;border:1px solid rgba(85,196,192,.3);background:rgba(85,196,192,.05);color:#9da99f;font:13px/1.48 "EB Garamond",Georgia,serif}.tok-ih-player-note b{color:#68c7c1}.tok-ih-player .tok-ih-side{display:none}.tok-ih-player .tok-ih-body{grid-template-columns:1fr}.tok-ih-player .tok-ih-main{border-right:0}
      .tok-ih-manage>strong{display:block;margin-bottom:8px;color:#c79a4a;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.13em;text-transform:uppercase}.tok-ih-manage button{margin-top:6px;padding:7px 9px;text-align:left}.tok-ih-manage button:disabled{opacity:.45;cursor:not-allowed}.tok-ih-manage button small{display:block;margin:4px 0 0;color:#999181;font:11px/1.3 "EB Garamond",Georgia,serif;letter-spacing:0;text-transform:none}.tok-ih-action-veil{position:absolute;inset:0;z-index:4;display:grid;place-items:center;padding:18px;background:rgba(3,8,7,.9)}.tok-ih-action-veil[hidden]{display:none}.tok-ih-action-dialog{width:min(520px,100%);max-height:calc(100% - 20px);overflow:auto;padding:18px;border:1px solid rgba(199,154,74,.58);background:#10201b;box-shadow:0 20px 60px rgba(0,0,0,.55)}.tok-ih-action-dialog h3{margin:4px 0 8px;color:#f3e8d1;font:500 24px "Playfair Display",Georgia,serif}.tok-ih-action-dialog p{margin:0 0 12px;color:#aaa18f;font:13px/1.45 "EB Garamond",Georgia,serif}.tok-ih-action-field{display:block;margin-top:10px}.tok-ih-action-field span{display:block;margin-bottom:5px;color:#c79a4a;font:600 7px/1 "Oswald",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.tok-ih-action-field input,.tok-ih-action-field select,.tok-ih-action-field textarea{width:100%;min-height:48px;padding:9px;border:1px solid rgba(236,226,205,.2);background:#091410;color:#ece2cd;font:14px "EB Garamond",Georgia,serif;box-sizing:border-box}.tok-ih-action-field textarea{min-height:74px;resize:vertical}.tok-ih-action-check{display:flex;gap:9px;align-items:flex-start;margin-top:12px;color:#aaa18f;font:12px/1.4 "EB Garamond",Georgia,serif}.tok-ih-action-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.tok-ih-action-foot button{min-height:48px;padding:0 14px;border:1px solid rgba(236,226,205,.2);background:transparent;color:#aaa18f;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.tok-ih-action-foot button.primary{border-color:#c79a4a;background:rgba(199,154,74,.1);color:#e7c279}.tok-ih-action-error{min-height:18px;margin-top:8px;color:#e0a07a;font:12px/1.4 "EB Garamond",Georgia,serif}
      .tok-ih-foot{display:flex;justify-content:flex-end;padding:11px 18px calc(11px + env(safe-area-inset-bottom));border-top:1px solid rgba(236,226,205,.13);background:#0d1815}.tok-ih-foot button{min-height:42px;padding:0 15px;border:1px solid rgba(199,154,74,.5);background:rgba(199,154,74,.1);color:#e7c279;font:600 8px/1 "Oswald",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
      .tok-ih-rarity-common{--tok-ih-rarity:#aaa18f}.tok-ih-rarity-uncommon{--tok-ih-rarity:#68b878}.tok-ih-rarity-rare{--tok-ih-rarity:#8099dc}.tok-ih-rarity-very-rare{--tok-ih-rarity:#a786d8}.tok-ih-rarity-legendary{--tok-ih-rarity:#e2b955}.tok-ih-rarity-artifact{--tok-ih-rarity:#db6957}
      @media(max-width:700px){.tok-ih-overlay{align-items:flex-end;padding:0}.tok-ih-dialog{width:100%;max-height:92vh;border-left:0;border-right:0;border-bottom:0}.tok-ih-head{padding:13px 12px 10px}.tok-ih-head h2{font-size:22px}.tok-ih-audience button{min-height:44px;padding:0 9px}.tok-ih-close{width:44px;height:44px}.tok-ih-hero{grid-template-columns:72px 1fr;gap:13px;min-height:0;padding:18px 13px}.tok-ih-sigil{width:62px;height:62px}.tok-ih-sigil span{font-size:23px}.tok-ih-identity h3{font-size:29px}.tok-ih-custody{grid-column:1/-1}.tok-ih-body{grid-template-columns:1fr}.tok-ih-main{padding:0 13px 23px;border-right:0}.tok-ih-side{padding:16px 13px 22px;border-top:1px solid rgba(236,226,205,.13)}.tok-ih-facts{grid-template-columns:1fr}.tok-ih-tabs button{flex:1;min-height:48px;padding:0 8px}.tok-ih-history-head{align-items:flex-start;flex-direction:column}.tok-ih-order{margin-left:0}.tok-ih-player .tok-ih-side{display:none}.tok-ih-foot button{min-height:48px}}
      @media(max-width:470px){.tok-ih-kicker{font-size:7px}.tok-ih-head.staff{display:grid;grid-template-columns:minmax(0,1fr) 44px}.tok-ih-head.staff>div:first-child{grid-column:1;grid-row:1}.tok-ih-head.staff .tok-ih-audience{position:static;grid-column:1/-1;grid-row:2;display:grid;grid-template-columns:1fr 1fr;margin:8px 0 0}.tok-ih-head.staff .tok-ih-audience button{width:100%}.tok-ih-head.staff .tok-ih-close{grid-column:2;grid-row:1}.tok-ih-hero{grid-template-columns:61px 1fr}.tok-ih-sigil{width:53px;height:53px}.tok-ih-identity h3{font-size:26px}}
      @media(prefers-reduced-motion:reduce){.tok-ih-overlay{backdrop-filter:none}}
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function open(options) {
    options = options || {};
    var doc = options.document || (typeof document !== 'undefined' ? document : null);
    var record = options.record || {};
    var item = record.item || {};
    if (!doc || !doc.createElement) throw new Error('The item-history reader needs a document.');
    if (!text(item.id)) throw new Error('The item-history reader needs a tracked item.');
    injectCss(doc);
    var staff = !!options.staff;
    var identified = item.identification === 'identified';
    var rarity = identified ? text(item.rarity) : '';
    var rarityClass = RARITY_CLASS[rarity] || (identified ? 'common' : 'very-rare');
    var name = text(item.display_name) || 'Tracked item';
    var description = text(item.public_description) || (identified ? 'No public description recorded.' : 'Its nature has not yet been identified.');
    var rules = identified ? mechanicsText(item.mechanics) : '';
    options.characterNames = options.characterNames || record.characterNames || {};
    var bearer = bearerLabel(item, options);
    var attunement = attunementLabel(item, bearer);
    var equipment = item.slot ? 'Held · ' + labelKey(item.slot).toLowerCase() : (item.status === 'held' ? 'Held · carried' : labelKey(item.status));
    var overlay = doc.createElement('div');
    overlay.className = 'tok-ih-overlay';
    overlay.innerHTML = '<section class="tok-ih-dialog tok-ih-rarity-' + rarityClass + (staff ? '' : ' tok-ih-player') + '" role="dialog" aria-modal="true" aria-labelledby="tok-ih-title">'
      + '<header class="tok-ih-head' + (staff ? ' staff' : '') + '"><div><div class="tok-ih-kicker">Permanent campaign object</div><h2 id="tok-ih-title">Item history</h2></div>'
      + (staff ? '<div class="tok-ih-audience" aria-label="Preview audience"><button type="button" data-ih-view="staff" aria-pressed="true">Staff view</button><button type="button" data-ih-view="player" aria-pressed="false">Player view</button></div>' : '')
      + '<button class="tok-ih-close" type="button" aria-label="Close">×</button></header><div class="tok-ih-scroll">'
      + '<section class="tok-ih-hero ' + (identified ? 'identified' : 'unidentified') + '"><div class="tok-ih-sigil" aria-hidden="true"><span>✦</span></div><div class="tok-ih-identity"><div class="tok-ih-state">' + (identified ? 'Identified' : 'Unidentified · smoky truth') + ' · history active</div><h3>' + esc(name) + '</h3><p>' + esc(description) + '</p><div class="tok-ih-badges"><span class="tok-ih-badge rarity">' + esc(rarity || 'Rarity unrevealed') + '</span><span class="tok-ih-badge" data-ih-attunement>' + esc(attunement) + '</span></div></div><div class="tok-ih-custody"><span>Current bearer</span><b>' + esc(bearer) + '</b><em>' + esc(equipment) + '</em><small>' + esc(item.id) + ' · permanent identity</small></div></section>'
      + '<div class="tok-ih-body"><section class="tok-ih-main"><nav class="tok-ih-tabs" aria-label="Item detail sections"><button type="button" role="tab" data-ih-tab="overview" aria-selected="true">Overview</button><button type="button" role="tab" data-ih-tab="history" aria-selected="false">History</button></nav>'
      + '<section class="tok-ih-panel on" data-ih-panel="overview" role="tabpanel"><div class="tok-ih-label">' + esc(name) + '</div><p class="tok-ih-copy">' + esc(description) + '</p>'
      + '<div class="tok-ih-rules"><h4>' + (identified ? 'Known properties' : 'Properties unrevealed') + '</h4><p>' + esc(identified ? (rules || 'No public mechanics recorded.') : 'True rarity and mechanics remain outside the party-readable item until identification.') + '</p></div></section>'
      + '<section class="tok-ih-panel" data-ih-panel="history" role="tabpanel"><div class="tok-ih-history-head"><div><div class="tok-ih-label">Permanent campaign record</div><h3>Chronological history</h3></div><div class="tok-ih-order">Oldest first · append-only</div></div><div class="tok-ih-timeline">' + eventsHtml(record.events, options) + '</div></section></section>'
      + (staff ? '<aside class="tok-ih-side">' + secretHtml(record) + '<section class="tok-ih-manage"><strong>Staff management</strong><button type="button" data-ih-action="identify"' + (identified || !record.secret ? ' disabled' : '') + '>Identify item<small>' + (identified ? 'Already identified.' : 'Publish the prepared name, rarity, description, and rules.') + '</small></button><button type="button" data-ih-action="rename">Rename item<small>Keep its permanent identity and append a history moment.</small></button><button type="button" data-ih-requirement>' + (item.requires_attunement ? 'Does not require attunement' : 'Requires attunement') + '<small>Staff sets the rule; the bearer uses Gear to attune or release.</small></button><button type="button" data-ih-action="transfer"' + (item.status !== 'held' ? ' disabled' : '') + '>Transfer item<small>Move canonical custody and the real inventory row together.</small></button><div class="tok-ih-manage-msg" aria-live="polite"></div></section></aside>' : '') + '</div></div><footer class="tok-ih-foot"><button type="button" data-ih-done>Return to item</button></footer><div class="tok-ih-action-veil" hidden></div></section>';
    (doc.body || doc.documentElement).appendChild(overlay);
    var dialog = overlay.querySelector('.tok-ih-dialog');
    var closing = false;
    function close() {
      if (closing) return; closing = true;
      doc.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof options.onClose === 'function') options.onClose();
    }
    function onKey(event) { if (event.key === 'Escape') close(); }
    function setView(next) {
      var player = next === 'player';
      dialog.classList.toggle('tok-ih-player', player);
      overlay.querySelectorAll('[data-ih-view]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-ih-view') === next)); });
    }
    overlay.querySelectorAll('[data-ih-tab]').forEach(function (button) { button.addEventListener('click', function () {
      var tab = button.getAttribute('data-ih-tab');
      overlay.querySelectorAll('[data-ih-tab]').forEach(function (row) { row.setAttribute('aria-selected', String(row === button)); });
      overlay.querySelectorAll('[data-ih-panel]').forEach(function (panel) { panel.classList.toggle('on', panel.getAttribute('data-ih-panel') === tab); });
    }); });
    overlay.querySelectorAll('[data-ih-view]').forEach(function (button) { button.addEventListener('click', function () { setView(button.getAttribute('data-ih-view')); }); });
    var actionVeil = overlay.querySelector('.tok-ih-action-veil');
    function closeAction() { if (actionVeil) { actionVeil.hidden = true; actionVeil.innerHTML = ''; } }
    function destinationRows() {
      return (record.characters || []).filter(function (row) { return text(row.key) && text(row.key) !== text(item.current_bearer_key) && !row.delete_marked; });
    }
    function openAction(action) {
      if (!actionVeil) return;
      var body = '';
      if (action === 'identify') {
        body = '<p>This publishes the prepared true name, rarity, public description, and rules. Private lore stays staff-only.</p><div class="tok-ih-rules"><h4>Party will see</h4><p>' + esc((record.secret && record.secret.true_name) || 'Prepared item truth') + ' · ' + esc((record.secret && record.secret.rarity) || 'Rarity') + '</p></div><label class="tok-ih-action-field"><span>History summary</span><textarea data-ih-summary>' + esc(name + ' was identified as ' + ((record.secret && record.secret.true_name) || 'its true name') + '.') + '</textarea></label><label class="tok-ih-action-check"><input type="checkbox" data-ih-confirm><span>I understand this reveals the prepared public truth to every campaign member.</span></label>';
      } else if (action === 'rename') {
        body = '<p>The permanent identity, custody, secrets, and earlier history stay intact.</p><label class="tok-ih-action-field"><span>New public name</span><input data-ih-new-name value="' + esc(name) + '" autocomplete="off"></label><label class="tok-ih-action-field"><span>History summary</span><textarea data-ih-summary>' + esc(name + ' became known by a new name.') + '</textarea></label>';
      } else {
        var destinations = destinationRows();
        body = '<p>The tracked row leaves ' + esc(bearer) + ' and enters the destination inventory as the same item. Its equipped slot, attunement, and container placement clear.</p><label class="tok-ih-action-field"><span>New bearer</span><select data-ih-destination>' + destinations.map(function (row) { return '<option value="' + esc(row.key) + '">' + esc(text(row.structural && row.structural.name) || row.key) + '</option>'; }).join('') + '</select></label><label class="tok-ih-action-field"><span>History summary</span><textarea data-ih-summary>' + esc(bearer + ' entrusted ' + name + ' to ' + (destinations.length ? (text(destinations[0].structural && destinations[0].structural.name) || destinations[0].key) : 'another bearer') + '.') + '</textarea></label><label class="tok-ih-action-check"><input type="checkbox" data-ih-confirm><span>I understand this moves the real inventory row and canonical custody together.</span></label>';
      }
      actionVeil.innerHTML = '<section class="tok-ih-action-dialog" role="dialog" aria-modal="true"><div class="tok-ih-kicker">Staff item management</div><h3>' + (action === 'identify' ? 'Identify this item' : (action === 'rename' ? 'Rename this item' : 'Transfer this item')) + '</h3>' + body + '<div class="tok-ih-action-error" aria-live="polite"></div><div class="tok-ih-action-foot"><button type="button" data-ih-action-cancel>Cancel</button><button class="primary" type="button" data-ih-action-save>' + (action === 'identify' ? 'Reveal item' : (action === 'rename' ? 'Rename item' : 'Transfer item')) + '</button></div></section>';
      actionVeil.hidden = false;
      var cancel = actionVeil.querySelector('[data-ih-action-cancel]');
      var save = actionVeil.querySelector('[data-ih-action-save]');
      if (cancel) cancel.addEventListener('click', closeAction);
      if (save) save.addEventListener('click', async function () {
        var errorBox = actionVeil.querySelector('.tok-ih-action-error');
        var confirm = actionVeil.querySelector('[data-ih-confirm]');
        if (confirm && !confirm.checked) { errorBox.textContent = 'Confirm this permanent change first.'; return; }
        save.disabled = true; errorBox.textContent = 'Saving current truth and append-only history…';
        try {
          var summary = text((actionVeil.querySelector('[data-ih-summary]') || {}).value);
          var saved;
          if (action === 'identify') saved = await identifyItem(options.supabase, item.id, summary);
          else if (action === 'rename') {
            var newName = text((actionVeil.querySelector('[data-ih-new-name]') || {}).value);
            if (!newName || newName === name) throw new Error('Enter a different public item name.');
            saved = await renameItem(options.supabase, item.id, newName, summary);
          } else {
            var destination = text((actionVeil.querySelector('[data-ih-destination]') || {}).value);
            if (!destination) throw new Error('Choose a destination character.');
            saved = await transferItem(options.supabase, item.id, item.current_bearer_key, destination, summary);
          }
          if (typeof options.onManagedChange === 'function') options.onManagedChange(saved, action);
          close();
        } catch (error) { errorBox.textContent = (error && error.message) || 'The item change could not be saved.'; save.disabled = false; }
      });
    }
    overlay.querySelectorAll('[data-ih-action]').forEach(function (button) { button.addEventListener('click', function () { if (!button.disabled) openAction(button.getAttribute('data-ih-action')); }); });
    var requirementButton = overlay.querySelector('[data-ih-requirement]');
    if (requirementButton) requirementButton.addEventListener('click', async function () {
      var next = !item.requires_attunement;
      var message = overlay.querySelector('.tok-ih-manage-msg');
      requirementButton.disabled = true; if (message) message.textContent = 'Saving the attunement rule…';
      try {
        var saved = await setRequirement(options.supabase, item.id, next);
        Object.assign(item, saved.item); item.requires_attunement = !!item.requires_attunement;
        var label = attunementLabel(item, bearer);
        var badge = overlay.querySelector('[data-ih-attunement]'); if (badge) badge.textContent = label;
        requirementButton.childNodes[0].nodeValue = item.requires_attunement ? 'Does not require attunement' : 'Requires attunement';
        if (message) message.textContent = item.requires_attunement ? 'Requirement saved. The bearer now has the Gear control.' : 'No attunement required. Any active attunement was cleared.';
        if (typeof options.onRequirementChange === 'function') options.onRequirementChange(saved);
      } catch (error) { if (message) message.textContent = (error && error.message) || 'The attunement rule could not be saved.'; }
      finally { requirementButton.disabled = false; }
    });
    overlay.querySelector('.tok-ih-close').addEventListener('click', close);
    overlay.querySelector('[data-ih-done]').addEventListener('click', close);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    doc.addEventListener('keydown', onKey);
    return { element: overlay, close: close, setView: setView };
  }

  function itemByKey(inventory, renderKey) {
    inventory = Array.isArray(inventory) ? inventory : [];
    if (String(renderKey).indexOf('id:') === 0) {
      var id = String(renderKey).slice(3);
      for (var i = 0; i < inventory.length; i++) if (inventory[i] && String(inventory[i].id) === id) return inventory[i];
      return null;
    }
    if (String(renderKey).indexOf('ix:') === 0) return inventory[parseInt(String(renderKey).slice(3), 10)] || null;
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
    var sb = options.supabase || (tok && tok.sb);
    if (!sb || typeof sb.from !== 'function') return { active: false };
    injectCss(doc);
    var sheet = hostRoot.querySelector ? hostRoot.querySelector('.tok-sheet') : null;
    var box = hostRoot.querySelector ? hostRoot.querySelector('[data-equip]') : null;
    if (!sheet || !box) return { active: false };
    var staff = isStaff(profile);
    var nameField = sheet.querySelector ? sheet.querySelector('[data-f="name"]') : null;
    var characterName = text(options.characterName || (nameField && nameField.textContent));

    function decorate() {
      var inventory = (box.__gmCtx && box.__gmCtx.inventory) || [];
      var details = hostRoot.querySelectorAll ? hostRoot.querySelectorAll('.gm-detail') : [];
      details.forEach(function (detail) {
        if (detail.querySelector('[data-item-history-action]')) return;
        var edit = detail.querySelector('[data-editopen]'); if (!edit) return;
        var item = itemByKey(inventory, edit.getAttribute('data-editopen'));
        if (!item || !text(item.instanceId)) return;
        var unidentified = item.identification !== 'identified';
        var wrap = doc.createElement('div');
        wrap.innerHTML = '<div class="gm-history-active' + (unidentified ? ' unidentified' : '') + '" data-item-history-action><button class="gm-history-open" type="button" data-item-history-open="' + esc(item.instanceId) + '"><span class="dot"></span><span><b>' + (unidentified ? 'Unidentified history' : 'History active') + '</b><small>Open this item\'s permanent record.</small></span><span class="chev">›</span></button></div>';
        detail.insertBefore(wrap.firstChild, edit.parentNode || null);
      });
    }
    function narrate(button, message) {
      var row = button && button.closest ? button.closest('[data-item-history-action]') : null;
      var note = row && row.querySelector('small');
      if (note) { note.textContent = message; note.classList.add('gm-history-message'); }
    }
    async function onClick(event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-item-history-open]') : null;
      if (!button || !hostRoot.contains(button) || button.disabled) return;
      event.preventDefault(); event.stopPropagation();
      button.disabled = true; narrate(button, 'Opening the current item record…');
      try {
        var record = await loadItem(sb, button.getAttribute('data-item-history-open'), staff);
        var requirementChanged = false;
        open({ document: doc, record: record, staff: staff, supabase: sb, characterKey: options.characterKey, characterName: characterName, onRequirementChange: function () { requirementChanged = true; }, onManagedChange: function () { requirementChanged = true; }, onClose: function () {
          if (requirementChanged && view && view.location && view.location.reload) { view.location.reload(); return; }
          button.disabled = false; narrate(button, 'Open this item\'s permanent record.');
        } });
      } catch (error) {
        button.disabled = false;
        narrate(button, (error && error.message) || 'Item history is unavailable.');
      }
    }
    hostRoot.addEventListener('click', onClick, true);
    var Observer = (view && view.MutationObserver) || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    var observer = Observer ? new Observer(decorate) : null;
    if (observer) observer.observe(box, { childList: true, subtree: true });
    decorate();
    return { active: true, staff: staff, decorate: decorate, destroy: function () { hostRoot.removeEventListener('click', onClick, true); if (observer) observer.disconnect(); } };
  }

  return { VERSION: VERSION, isEnabled: isEnabled, isStaff: isStaff, mechanicsText: mechanicsText, labelKey: labelKey, attunementLabel: attunementLabel, sortEvents: sortEvents, loadItem: loadItem, setRequirement: setRequirement, identifyItem: identifyItem, renameItem: renameItem, transferItem: transferItem, injectCss: injectCss, open: open, mount: mount, itemByKey: itemByKey };
});
