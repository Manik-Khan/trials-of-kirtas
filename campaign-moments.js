/* campaign-moments.js — shared campaign-history read contract.
 * One durable moment projects into World, Chronicle, Gear, Journal, and battle
 * surfaces. Public truth and staff-only exact truth are read separately.
 * Plain script + CommonJS dual export: window.CampaignMoments.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CampaignMoments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 'cm-2';
  var KINDS = ['journey', 'discovery', 'battle', 'treasure', 'npc'];

  function text(value) { return String(value == null ? '' : value).trim(); }
  function isStaff(profile) { return !!(profile && (profile.role === 'dm' || profile.role === 'overseer')); }
  function isEnabled(search) {
    try {
      var query = new URLSearchParams(search == null ? '' : String(search));
      return query.get('campaignLinks') === '1' || query.get('path') === '1' || !!query.get('moment');
    } catch (_) { return false; }
  }
  function dateValue(value) {
    var time = value ? Date.parse(value) : NaN;
    return isNaN(time) ? 0 : time;
  }
  function sortMoments(rows) {
    return (Array.isArray(rows) ? rows.slice() : []).sort(function (a, b) {
      return dateValue(a.occurredAt || a.occurred_at) - dateValue(b.occurredAt || b.occurred_at)
        || text(a.id).localeCompare(text(b.id));
    });
  }
  function normalizeMoment(row) {
    row = row || {};
    return {
      id: text(row.id),
      kind: KINDS.indexOf(row.kind) >= 0 ? row.kind : 'journey',
      also: Array.isArray(row.also) ? row.also.filter(function (kind) { return KINDS.indexOf(kind) >= 0; }) : [],
      title: text(row.title) || 'Recorded campaign moment',
      summary: text(row.summary),
      occurredAt: row.occurred_at || row.occurredAt || null,
      sessionId: row.session_id == null ? (row.sessionId == null ? null : String(row.sessionId)) : String(row.session_id),
      locationId: text(row.location_id || row.locationId) || null,
      mapPrecision: row.map_precision || row.mapPrecision || 'confirmed',
      partyPresent: row.party_present == null ? !!row.partyPresent : !!row.party_present,
      visibility: row.visibility || 'party',
      journalPageId: text(row.journal_page_id || row.journalPageId) || null,
      feedPostId: row.feed_post_id == null ? (row.feedPostId == null ? null : String(row.feedPostId)) : String(row.feed_post_id),
      encounterId: text(row.encounter_id || row.encounterId) || null,
      sceneId: text(row.scene_id || row.sceneId) || null,
      forgeSessionId: text(row.forge_session_id || row.forgeSessionId) || null,
      staffTruth: '', exactLocationId: null, exactMapX: null, exactMapY: null,
      items: []
    };
  }
  function normalizeSecret(row) {
    row = row || {};
    return {
      momentId: text(row.moment_id || row.momentId),
      staffTruth: text(row.staff_summary || row.staffTruth),
      exactLocationId: text(row.exact_location_id || row.exactLocationId) || null,
      exactMapX: row.exact_map_x == null ? null : Number(row.exact_map_x),
      exactMapY: row.exact_map_y == null ? null : Number(row.exact_map_y)
    };
  }
  function unavailableError(error) {
    return !!(error && /campaign_moments|relation|schema cache|does not exist/i.test(error.message || ''));
  }
  function resultError(result, fallback) {
    return result && result.error && result.error.message ? result.error.message : fallback;
  }

  async function load(sb, options) {
    options = options || {};
    if (!sb || typeof sb.from !== 'function') throw new Error('Campaign history is unavailable on this page.');
    var momentRequest = sb.from('campaign_moments')
      .select('id,kind,also,title,summary,occurred_at,session_id,location_id,map_precision,party_present,visibility,journal_page_id,feed_post_id,encounter_id,scene_id,forge_session_id')
      .order('occurred_at', { ascending: true }).order('id', { ascending: true });
    var secretRequest = options.staff
      ? sb.from('campaign_moment_secrets').select('moment_id,staff_summary,exact_location_id,exact_map_x,exact_map_y')
      : Promise.resolve({ data: [], error: null });
    var itemEventRequest = sb.from('item_events')
      .select('id,item_id,event_type,moment_id');
    var itemLinkRequest = sb.from('campaign_moment_item_events')
      .select('id,moment_id,item_event_id');
    var itemRequest = sb.from('item_instances')
      .select('id,display_name,current_bearer_key,status');
    var results = await Promise.all([momentRequest, secretRequest, itemEventRequest, itemLinkRequest, itemRequest]);
    if (results[0] && results[0].error) {
      if (unavailableError(results[0].error)) return { available: false, moments: [], error: 'Campaign history has not been installed yet.' };
      throw new Error(resultError(results[0], 'Campaign history could not be read.'));
    }
    var moments = sortMoments((results[0] && results[0].data || []).map(normalizeMoment));
    var byId = {};
    moments.forEach(function (moment) { byId[moment.id] = moment; });
    if (options.staff && results[1] && results[1].error) {
      moments.secretError = resultError(results[1], 'Staff-only campaign truth is unavailable.');
    } else {
      (results[1] && results[1].data || []).map(normalizeSecret).forEach(function (secret) {
        var moment = byId[secret.momentId];
        if (moment) Object.assign(moment, secret);
      });
    }
    var items = {};
    if (results[4] && !results[4].error) (results[4].data || []).forEach(function (row) { items[text(row.id)] = row; });
    var linkedMomentByEvent = {};
    if (results[3] && !results[3].error) (results[3].data || []).forEach(function (row) {
      linkedMomentByEvent[text(row.item_event_id)] = { id: text(row.id), momentId: text(row.moment_id) };
    });
    if (results[2] && !results[2].error) (results[2].data || []).forEach(function (row) {
      var legacyLink = linkedMomentByEvent[text(row.id)];
      var moment = byId[text(row.moment_id) || (legacyLink && legacyLink.momentId)];
      if (!moment) return;
      var item = items[text(row.item_id)] || {};
      moment.items.push({
        eventId: text(row.id), itemId: text(row.item_id), eventType: text(row.event_type),
        linkId: legacyLink ? legacyLink.id : null,
        name: text(item.display_name) || text(row.item_id), bearerKey: text(item.current_bearer_key) || null,
        status: text(item.status) || null
      });
    });
    return {
      available: true,
      moments: moments,
      error: '',
      itemError: results[2] && results[2].error ? resultError(results[2], 'Item links are unavailable.')
        : (results[3] && results[3].error ? resultError(results[3], 'Legacy item links are unavailable.')
          : (results[4] && results[4].error ? resultError(results[4], 'Item names are unavailable.') : '')),
      secretError: moments.secretError || ''
    };
  }

  function momentMatches(moment, filter) {
    return filter === 'all' || !filter || moment.kind === filter || (moment.also || []).indexOf(filter) >= 0;
  }
  function locationIndex(locations) {
    var out = {};
    (locations || []).forEach(function (location) {
      var id = text(location && (location.id || location.key));
      if (id && !out[id]) out[id] = location;
    });
    return out;
  }
  function locationCoords(location) {
    if (!location) return null;
    var x = location.mapX == null ? location.x : location.mapX;
    var y = location.mapY == null ? location.y : location.mapY;
    x = Number(x); y = Number(y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x: x, y: y } : null;
  }
  function mapLocationFor(moment, locations) {
    if (!moment || !moment.locationId) return null;
    var index = locationIndex(locations);
    var location = index[moment.locationId];
    var visited = {};
    while (location && (location.parentId || location.parent_id)) {
      var id = text(location.id || location.key);
      if (visited[id]) return null;
      visited[id] = true;
      location = index[text(location.parentId || location.parent_id)];
    }
    var coords = locationCoords(location);
    if (!location || !coords) return null;
    return {
      id: text(location.id || location.key), label: text(location.label || location.name || location.id || location.key),
      x: coords.x, y: coords.y, sourceLocationId: moment.locationId
    };
  }
  function mapClusters(moments, locations, filter) {
    var groups = {};
    sortMoments(moments).filter(function (moment) { return momentMatches(moment, filter || 'all'); }).forEach(function (moment) {
      var location = mapLocationFor(moment, locations);
      if (!location) return;
      if (!groups[location.id]) groups[location.id] = { location: location, moments: [] };
      groups[location.id].moments.push(moment);
    });
    return Object.keys(groups).map(function (id) { return groups[id]; });
  }
  function pathPoints(moments, locations) {
    var seen = {};
    var points = [];
    sortMoments(moments).forEach(function (moment) {
      if (!moment.partyPresent) return;
      var location = mapLocationFor(moment, locations);
      if (!location || seen[location.id]) return;
      seen[location.id] = true;
      points.push({ momentId: moment.id, locationId: location.id, x: location.x, y: location.y });
    });
    return points;
  }
  function queryUrl(path, values) {
    var query = [];
    Object.keys(values || {}).forEach(function (key) {
      if (values[key] != null && text(values[key])) query.push(encodeURIComponent(key) + '=' + encodeURIComponent(values[key]));
    });
    return path + (query.length ? '?' + query.join('&') : '');
  }
  function targets(moment) {
    moment = moment || {};
    var item = moment.items && moment.items[0];
    return {
      world: moment.locationId ? queryUrl('world.html', { campaignLinks: 1, moment: moment.id }) : null,
      chronicle: moment.feedPostId ? queryUrl('chronicle.html', { campaignLinks: 1, moment: moment.id }) : null,
      item: item && item.bearerKey ? queryUrl('sheet-v2.html', { character: item.bearerKey, campaignLinks: 1, item: item.itemId }) : null,
      encounter: moment.forgeSessionId ? queryUrl('forge/', { session: moment.forgeSessionId })
        : (moment.encounterId ? queryUrl('chronicle.html', { campaignLinks: 1, session: moment.sessionId, encounter: moment.encounterId }) : null),
      journal: null
    };
  }

  return {
    VERSION: VERSION, KINDS: KINDS, text: text, isStaff: isStaff, isEnabled: isEnabled,
    normalizeMoment: normalizeMoment, normalizeSecret: normalizeSecret, sortMoments: sortMoments,
    load: load, momentMatches: momentMatches, mapLocationFor: mapLocationFor,
    mapClusters: mapClusters, pathPoints: pathPoints, targets: targets, queryUrl: queryUrl
  };
});
