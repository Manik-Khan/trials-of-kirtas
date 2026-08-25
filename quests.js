/* quests.js — shared Quest Log read contract.
 * Quests own giver, ordered objectives, completion, and rewards. Campaign
 * moments remain linked evidence; World and Chronicle stay projections.
 * Plain script + CommonJS dual export: window.Quests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Quests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 'q-3';
  var STATUSES = ['offered', 'active', 'completed', 'failed', 'archived'];
  var OBJECTIVE_STATES = ['locked', 'current', 'complete', 'failed'];
  var STATUS_ORDER = { active: 0, offered: 1, completed: 2, failed: 3, archived: 4 };

  function text(value) { return String(value == null ? '' : value).trim(); }
  function isStaff(profile) { return !!(profile && (profile.role === 'dm' || profile.role === 'overseer')); }
  function isEnabled(search) {
    try {
      var query = new URLSearchParams(search == null ? '' : String(search));
      return query.get('questLog') !== '0';
    } catch (_) { return true; }
  }
  function dateValue(value) {
    var time = value ? Date.parse(value) : NaN;
    return isNaN(time) ? 0 : time;
  }
  function sortQuests(rows) {
    return (Array.isArray(rows) ? rows.slice() : []).sort(function (a, b) {
      return (STATUS_ORDER[a.status] == null ? 99 : STATUS_ORDER[a.status])
        - (STATUS_ORDER[b.status] == null ? 99 : STATUS_ORDER[b.status])
        || dateValue(b.updatedAt || b.updated_at) - dateValue(a.updatedAt || a.updated_at)
        || text(a.title).localeCompare(text(b.title));
    });
  }
  function normalizeQuest(row) {
    row = row || {};
    var precision = row.destination_precision || row.destinationPrecision || 'unlocated';
    return {
      id: text(row.id),
      title: text(row.title) || 'Untitled quest',
      summary: text(row.summary),
      publicHint: text(row.public_hint || row.publicHint),
      status: STATUSES.indexOf(row.status) >= 0 ? row.status : 'offered',
      visibility: row.visibility || 'party',
      giverId: text(row.giver_id || row.giverId),
      giverLabel: text(row.giver_label || row.giverLabel) || text(row.giver_id || row.giverId),
      destinationLocationId: text(row.destination_location_id || row.destinationLocationId) || null,
      destinationLabel: text(row.destination_label || row.destinationLabel) || null,
      destinationPrecision: ['unlocated', 'approximate', 'confirmed'].indexOf(precision) >= 0 ? precision : 'unlocated',
      offeredAt: row.offered_at || row.offeredAt || null,
      completedAt: row.completed_at || row.completedAt || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      staffTruth: '', exactLocationId: null, exactLocationLabel: null,
      exactMapX: null, exactMapY: null, completionTruth: '', rewardTruth: '',
      objectives: [], rewards: []
    };
  }
  function normalizeSecret(row) {
    row = row || {};
    return {
      questId: text(row.quest_id || row.questId),
      staffTruth: text(row.staff_truth || row.staffTruth),
      exactLocationId: text(row.exact_location_id || row.exactLocationId) || null,
      exactLocationLabel: text(row.exact_location_label || row.exactLocationLabel) || null,
      exactMapX: row.exact_map_x == null ? null : Number(row.exact_map_x),
      exactMapY: row.exact_map_y == null ? null : Number(row.exact_map_y),
      completionTruth: text(row.completion_truth || row.completionTruth),
      rewardTruth: text(row.reward_truth || row.rewardTruth)
    };
  }
  function normalizeObjective(row) {
    row = row || {};
    return {
      id: text(row.id), questId: text(row.quest_id || row.questId),
      position: Number(row.position) || 0,
      title: text(row.title) || 'Untitled objective',
      publicHint: text(row.public_hint || row.publicHint),
      state: OBJECTIVE_STATES.indexOf(row.state) >= 0 ? row.state : 'locked',
      completedAt: row.completed_at || row.completedAt || null,
      evidence: []
    };
  }
  function normalizeEvidence(row) {
    row = row || {};
    return {
      id: text(row.id), objectiveId: text(row.objective_id || row.objectiveId),
      momentId: text(row.moment_id || row.momentId), note: text(row.note),
      attachedAt: row.attached_at || row.attachedAt || null
    };
  }
  function normalizeReward(row) {
    row = row || {};
    return {
      id: text(row.id), questId: text(row.quest_id || row.questId),
      position: Number(row.position) || 0, kind: text(row.kind) || 'other',
      label: text(row.label) || 'Unrecorded reward', detail: text(row.detail),
      state: text(row.state) || 'promised', visibility: row.visibility || 'party',
      awardedAt: row.awarded_at || row.awardedAt || null
    };
  }
  function unavailableError(error) {
    return !!(error && /quests|quest_|relation|schema cache|does not exist/i.test(error.message || ''));
  }
  function resultError(result, fallback) {
    return result && result.error && result.error.message ? result.error.message : fallback;
  }
  function byPosition(a, b) { return a.position - b.position || text(a.id).localeCompare(text(b.id)); }

  async function load(sb, options) {
    options = options || {};
    if (!sb || typeof sb.from !== 'function') throw new Error('The shared Quest Log is unavailable on this page.');
    var questRequest = sb.from('quests')
      .select('id,title,summary,public_hint,status,visibility,giver_id,giver_label,destination_location_id,destination_label,destination_precision,offered_at,completed_at,updated_at')
      .order('offered_at', { ascending: false }).order('id', { ascending: true });
    var secretRequest = options.staff
      ? sb.from('quest_secrets').select('quest_id,staff_truth,exact_location_id,exact_location_label,exact_map_x,exact_map_y,completion_truth,reward_truth')
      : Promise.resolve({ data: [], error: null });
    var objectiveRequest = sb.from('quest_objectives')
      .select('id,quest_id,position,title,public_hint,state,completed_at')
      .order('position', { ascending: true });
    var evidenceRequest = sb.from('quest_objective_evidence')
      .select('id,objective_id,moment_id,note,attached_at')
      .order('attached_at', { ascending: true });
    var rewardRequest = sb.from('quest_rewards')
      .select('id,quest_id,position,kind,label,detail,state,visibility,awarded_at')
      .order('position', { ascending: true });
    var results = await Promise.all([questRequest, secretRequest, objectiveRequest, evidenceRequest, rewardRequest]);
    if (results[0] && results[0].error) {
      if (unavailableError(results[0].error)) return { available: false, quests: [], error: 'The shared Quest Log has not been installed yet.' };
      throw new Error(resultError(results[0], 'The shared Quest Log could not be read.'));
    }
    var quests = sortQuests((results[0] && results[0].data || []).map(normalizeQuest).filter(function (quest) {
      return options.staff || quest.visibility === 'party';
    }));
    var questById = {}, objectiveById = {};
    quests.forEach(function (quest) { questById[quest.id] = quest; });
    if (options.staff && results[1] && results[1].error) {
      quests.secretError = resultError(results[1], 'Staff-only quest truth is unavailable.');
    } else {
      (results[1] && results[1].data || []).map(normalizeSecret).forEach(function (secret) {
        if (questById[secret.questId]) Object.assign(questById[secret.questId], secret);
      });
    }
    if (!(results[2] && results[2].error)) {
      (results[2].data || []).map(normalizeObjective).sort(byPosition).forEach(function (objective) {
        objectiveById[objective.id] = objective;
        if (questById[objective.questId]) questById[objective.questId].objectives.push(objective);
      });
    }
    if (!(results[3] && results[3].error)) {
      (results[3].data || []).map(normalizeEvidence).forEach(function (evidence) {
        if (objectiveById[evidence.objectiveId]) objectiveById[evidence.objectiveId].evidence.push(evidence);
      });
    }
    if (!(results[4] && results[4].error)) {
      (results[4].data || []).map(normalizeReward).filter(function (reward) {
        return options.staff || reward.visibility === 'party';
      }).sort(byPosition).forEach(function (reward) {
        if (questById[reward.questId]) questById[reward.questId].rewards.push(reward);
      });
    }
    return {
      available: true, quests: quests, error: '', secretError: quests.secretError || '',
      objectiveError: results[2] && results[2].error ? resultError(results[2], 'Quest objectives are unavailable.') : '',
      evidenceError: results[3] && results[3].error ? resultError(results[3], 'Objective evidence is unavailable.') : '',
      rewardError: results[4] && results[4].error ? resultError(results[4], 'Quest rewards are unavailable.') : ''
    };
  }

  function progressFor(quest) {
    var objectives = quest && Array.isArray(quest.objectives) ? quest.objectives : [];
    var complete = objectives.filter(function (row) { return row.state === 'complete'; }).length;
    return { complete: complete, total: objectives.length, label: complete + ' of ' + objectives.length };
  }
  function partyProjection(quest) {
    quest = quest || {};
    var copy = Object.assign({}, quest, {
      staffTruth: '', exactLocationId: null, exactLocationLabel: null,
      exactMapX: null, exactMapY: null, completionTruth: '', rewardTruth: '',
      objectives: (quest.objectives || []).map(function (objective) {
        return Object.assign({}, objective, { evidence: (objective.evidence || []).map(function (row) { return Object.assign({}, row); }) });
      }),
      rewards: (quest.rewards || []).filter(function (reward) { return reward.visibility === 'party'; })
        .map(function (reward) { return Object.assign({}, reward); })
    });
    return copy;
  }
  function momentIndex(moments) {
    var out = {};
    (moments || []).forEach(function (moment) { if (moment && moment.id) out[moment.id] = moment; });
    return out;
  }
  function evidenceMoments(objective, moments) {
    var index = momentIndex(moments);
    return (objective && objective.evidence || []).map(function (evidence) {
      return { evidence: evidence, moment: index[evidence.momentId] || null };
    });
  }
  function queryValue(search, key) {
    try { return text(new URLSearchParams(search == null ? '' : String(search)).get(key)); }
    catch (_) { return ''; }
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function statusLabel(value) {
    return { offered: 'Offered', active: 'Active', completed: 'Completed', failed: 'Failed', archived: 'Archived' }[value] || 'Offered';
  }
  function objectiveLabel(value) {
    return { locked: 'Not yet revealed', current: 'Current objective', complete: 'Complete · evidence attached', failed: 'Failed' }[value] || value;
  }
  function rewardLabel(value) {
    return { promised: 'Promised', hidden: 'Hidden', awarded: 'Awarded', forfeited: 'Forfeited' }[value] || value;
  }

  async function mount(options) {
    options = options || {};
    var doc = options.document || (typeof document !== 'undefined' ? document : null);
    if (!doc) return { active: false, reason: 'no-document' };
    var root = options.root || doc.querySelector('[data-quest-root]');
    if (!root) return { active: false, reason: 'no-root' };
    var view = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    var search = options.search == null ? (view && view.location ? view.location.search : '') : options.search;
    if (!isEnabled(search)) {
      root.innerHTML = '<div class="q-state"><b>Quest Log is guarded</b><p>This production reader opens only through an approved field-test link.</p></div>';
      return { active: false, reason: 'disabled' };
    }
    var sb = options.supabase || (view && view.__tok && view.__tok.sb);
    var profile = options.profile || (view && view.__tok && view.__tok.ready ? await view.__tok.ready : null);
    var staff = isStaff(profile);
    var campaignApi = options.campaignMoments || (view && view.CampaignMoments);
    var state = { result: null, moments: [], audience: staff ? 'staff' : 'player', filter: 'active', query: '', questId: queryValue(search, 'quest'), objectiveId: '' };

    async function refresh() {
      try {
        var reads = [load(sb, { staff: staff })];
        if (campaignApi && typeof campaignApi.load === 'function') reads.push(campaignApi.load(sb, { staff: staff }));
        var results = await Promise.all(reads);
        state.result = results[0];
        state.moments = results[1] && results[1].available ? results[1].moments : [];
        if (!state.result.available) { root.innerHTML = '<div class="q-state"><b>Quest Log unavailable</b><p>' + esc(state.result.error) + '</p></div>'; return; }
        if (!state.result.quests.some(function (quest) { return quest.id === state.questId; })) state.questId = state.result.quests[0] ? state.result.quests[0].id : '';
        var quest = currentQuest();
        if (queryValue(search, 'quest') && quest && quest.status !== 'active') state.filter = 'all';
        if (quest && !quest.objectives.some(function (objective) { return objective.id === state.objectiveId; })) {
          var current = quest.objectives.find(function (objective) { return objective.state === 'current'; }) || quest.objectives[0];
          state.objectiveId = current ? current.id : '';
        }
        render();
      } catch (error) {
        root.innerHTML = '<div class="q-state q-error"><b>Quest Log could not open</b><p>' + esc(error && error.message || 'Unknown error.') + '</p></div>';
      }
    }
    function allQuests() { return state.result && state.result.quests || []; }
    function currentQuestRaw() { return allQuests().find(function (quest) { return quest.id === state.questId; }) || allQuests()[0] || null; }
    function currentQuest() {
      var quest = currentQuestRaw();
      return quest && state.audience === 'player' ? partyProjection(quest) : quest;
    }
    function currentObjective() {
      var quest = currentQuest();
      return quest && (quest.objectives.find(function (objective) { return objective.id === state.objectiveId; }) || quest.objectives[0]) || null;
    }
    function questListHtml() {
      return allQuests().map(function (raw) {
        var quest = state.audience === 'player' ? partyProjection(raw) : raw;
        var progress = progressFor(quest), hidden = state.filter !== 'all' && quest.status !== state.filter;
        return '<button type="button" class="q-card' + (hidden ? ' filtered' : '') + '" data-quest="' + esc(quest.id) + '" aria-current="' + (quest.id === state.questId) + '">' +
          '<span class="q-status">' + esc(statusLabel(quest.status)) + '</span><span class="q-count">' + progress.label + '</span>' +
          '<b>' + esc(quest.title) + '</b><p>' + esc(quest.giverLabel || 'No giver recorded') + ' · ' + esc(quest.destinationLabel || 'No map destination') + '</p></button>';
      }).join('');
    }
    function objectivesHtml(quest) {
      if (!quest.objectives.length) return '<div class="q-empty">No objectives have been published.</div>';
      return quest.objectives.map(function (objective) {
        return '<button type="button" class="q-objective ' + esc(objective.state) + '" data-objective="' + esc(objective.id) + '" aria-current="' + (objective.id === state.objectiveId) + '">' +
          '<span>' + esc(objectiveLabel(objective.state)) + '</span><b>' + descriptionHtml(objective.title) + '</b><p>' + esc(objective.publicHint || 'No public hint recorded.') + '</p></button>';
      }).join('');
    }
    function rewardsHtml(quest) {
      if (!quest.rewards.length) return '<div class="q-empty">No rewards have been announced.</div>';
      return quest.rewards.map(function (reward) {
        return '<article class="q-reward"><span>' + esc(rewardLabel(reward.state)) + ' · ' + esc(reward.kind) + '</span><b>' + esc(reward.label) + '</b><p>' + esc(reward.detail || 'No additional terms recorded.') + '</p></article>';
      }).join('');
    }
    function staffTruthHtml(quest) {
      if (!staff || state.audience !== 'staff') return '';
      var exact = quest.exactLocationLabel || quest.exactLocationId || 'No exact destination recorded';
      return '<section class="q-secret"><span>Staff truth</span><p>' + esc(quest.staffTruth || 'No separate staff truth recorded.') + '</p>' +
        '<dl><div><dt>Exact destination</dt><dd>' + esc(exact) + '</dd></div><div><dt>Completion truth</dt><dd>' + esc(quest.completionTruth || 'No hidden requirement recorded.') + '</dd></div><div><dt>Reward truth</dt><dd>' + esc(quest.rewardTruth || 'No hidden reward condition recorded.') + '</dd></div></dl></section>';
    }
    function evidenceHtml(objective) {
      if (!objective) return '<div class="q-empty">Select an objective to inspect its evidence.</div>';
      var linked = evidenceMoments(objective, state.moments);
      if (!linked.length) return '<div class="q-evidence-note">No completion evidence is attached. This objective remains ' + esc(objective.state) + '.</div>';
      return linked.map(function (entry) {
        var moment = entry.moment, targets = moment && campaignApi && campaignApi.targets ? campaignApi.targets(moment) : {};
        var title = moment ? moment.title : 'Linked campaign moment unavailable';
        var context = moment ? ((moment.sessionId ? 'Session ' + moment.sessionId : 'No session') + (moment.locationId ? ' · ' + moment.locationId : '')) : 'Campaign moment details unavailable';
        function link(key, label, icon) {
          return targets && targets[key] ? '<a class="q-link" href="' + esc(targets[key]) + '"><i>' + icon + '</i><span><small>' + label + '</small><b>Open linked evidence</b></span><em>›</em></a>'
            : '<div class="q-link disabled"><i>' + icon + '</i><span><small>' + label + '</small><b>Not recorded</b></span><em>—</em></div>';
        }
        return '<article class="q-evidence"><span>Attached campaign moment</span><b>' + esc(title) + '</b><p>' + esc(context) + '</p>' +
          (entry.evidence.note ? '<p>' + esc(entry.evidence.note) + '</p>' : '') + '<div class="q-links">' + link('world', 'World', '⌖') + link('chronicle', 'Chronicle', '¶') + link('encounter', 'Encounter', '⚔') + '</div></article>';
      }).join('');
    }
    function noticesHtml() {
      if (!state.result) return '';
      var messages = [state.result.secretError, state.result.objectiveError, state.result.evidenceError, state.result.rewardError].filter(Boolean);
      return messages.length ? '<div class="q-notice">' + messages.map(esc).join(' ') + '</div>' : '';
    }
    function descriptionHtml(value) {
      return view && view.QuestFeedCapture && typeof view.QuestFeedCapture.descriptionHTML === 'function'
        ? view.QuestFeedCapture.descriptionHTML(value)
        : esc(value || 'No public summary recorded.');
    }
    function entityHtml(label, id, type, fallback) {
      if (!label || !id) return '<b>' + esc(label || fallback) + '</b>';
      return '<b class="' + type + '-link" data-' + type + '="' + esc(id) + '" tabindex="0">' + esc(label) + '</b>';
    }
    function plainRich(value) {
      return view && view.QuestFeedCapture && typeof view.QuestFeedCapture.descriptionText === 'function'
        ? view.QuestFeedCapture.descriptionText(value)
        : text(value);
    }
    function visibleQuests() {
      var query = state.query.toLowerCase();
      return allQuests().filter(function (raw) {
        var quest = state.audience === 'player' ? partyProjection(raw) : raw;
        if (state.filter !== 'all' && quest.status !== state.filter) return false;
        if (!query) return true;
        var objective = quest.objectives.map(function (row) { return plainRich(row.title); }).join(' ');
        return [quest.title, plainRich(quest.summary), objective, quest.giverLabel, quest.destinationLabel]
          .join(' ').toLowerCase().indexOf(query) >= 0;
      });
    }
    function hubCardHtml(quest) {
      var progress = progressFor(quest), objective = quest.objectives.find(function (row) { return row.state === 'current'; }) || quest.objectives[0];
      var open = quest.id === state.questId;
      return '<article class="qh-card ' + esc(quest.status) + (open ? ' is-open' : '') + '">' +
        '<div class="qh-card-top"><span>' + esc(statusLabel(quest.status)) + '</span><small>' + esc(progress.label) + ' objectives</small></div>' +
        '<h3>' + esc(quest.title) + '</h3>' + (objective ? '<p class="qh-objective">' + descriptionHtml(objective.title) + '</p>' : '') +
        '<div class="qh-card-actions"><button type="button" data-quest="' + esc(quest.id) + '">' + (open ? 'Close details' : 'Details') + '</button>' +
        (quest.destinationLocationId ? '<a href="world.html?quest=' + encodeURIComponent(quest.id) + '&location=' + encodeURIComponent(quest.destinationLocationId) + '">View on World</a>' : '') + '</div>' +
        (open ? '<div class="qh-details"><p>' + descriptionHtml(quest.summary || 'No description recorded.') + '</p><dl>' +
          '<div><dt>Quest Giver</dt><dd>' + entityHtml(quest.giverLabel, quest.giverId, 'npc', 'Not recorded') + '</dd></div>' +
          '<div><dt>Location</dt><dd>' + entityHtml(quest.destinationLabel, quest.destinationLocationId, 'location', 'No location yet') + '</dd></div></dl>' +
          (staff && state.audience === 'staff' && quest.staffTruth ? '<div class="qh-staff"><b>Staff truth</b><p>' + esc(quest.staffTruth) + '</p></div>' : '') + '</div>' : '') + '</article>';
    }
    function hubGroupsHtml() {
      var groups = {}, order = [];
      visibleQuests().forEach(function (raw) {
        var quest = state.audience === 'player' ? partyProjection(raw) : raw;
        var key = quest.destinationLocationId || 'unlocated';
        if (!groups[key]) { groups[key] = { label: quest.destinationLabel || 'No location yet', rows: [] }; order.push(key); }
        groups[key].rows.push(quest);
      });
      order.sort(function (a, b) {
        if (a === 'unlocated') return 1; if (b === 'unlocated') return -1;
        return groups[a].label.localeCompare(groups[b].label);
      });
      if (!order.length) return '<div class="q-empty">No quests match this view.</div>';
      return order.map(function (key) {
        var group = groups[key];
        return '<section class="qh-group"><header><h2>' + esc(group.label) + '</h2>' +
          (key !== 'unlocated' ? '<a href="world.html?location=' + encodeURIComponent(key) + '">View on World</a>' : '') +
          '<span>' + group.rows.length + ' quest' + (group.rows.length === 1 ? '' : 's') + '</span></header><div class="qh-cards">' + group.rows.map(hubCardHtml).join('') + '</div></section>';
      }).join('');
    }
    function render() {
      if (!state.result || !state.result.quests.length) {
        root.innerHTML = '<div class="q-state"><b>No shared quests yet</b><p>No campaign quest has been published to the party.</p></div>';
        return;
      }
      var rows = allQuests(), active = rows.filter(function (quest) { return quest.status === 'active'; }).length;
      var completed = rows.filter(function (quest) { return quest.status === 'completed'; }).length;
      root.innerHTML = '<div class="qh-app"><header class="q-head"><div><span>Shared campaign record</span><h1>Quest Hub</h1><p>See what matters now. Open a quest only when you want its story and connections.</p></div>' +
        (staff ? '<div class="q-audience" role="group" aria-label="Preview audience"><button type="button" data-audience="player" aria-pressed="' + (state.audience === 'player') + '">Player view</button><button type="button" data-audience="staff" aria-pressed="' + (state.audience === 'staff') + '">Staff view</button></div>' : '') + '</header>' + noticesHtml() +
        '<main class="qh-main"><div class="qh-tools"><input type="search" data-quest-search aria-label="Search quests" placeholder="Search quests, objectives, people, or locations" value="' + esc(state.query) + '"><div class="q-filters"><button data-filter="active" aria-pressed="' + (state.filter === 'active') + '">Active</button><button data-filter="completed" aria-pressed="' + (state.filter === 'completed') + '">Completed</button><button data-filter="all" aria-pressed="' + (state.filter === 'all') + '">All</button></div></div>' +
        '<div class="qh-metrics"><div><small>Active</small><b>' + active + '</b></div><div><small>Completed</small><b>' + completed + '</b></div><p>Begin a new quest with <b>/quest</b> in the Feed.</p></div><div class="qh-groups">' + hubGroupsHtml() + '</div></main></div>';
      if (view && typeof view.attachTooltips === 'function') {
        try { view.attachTooltips(root); } catch (_) {}
      }
    }
    function onClick(event) {
      var button = event.target && event.target.closest ? event.target.closest('button,[data-quest],[data-objective]') : null;
      if (!button || !root.contains(button)) return;
      if (button.dataset.quest) {
        state.questId = state.questId === button.dataset.quest ? '' : button.dataset.quest;
        if (!state.questId) { render(); return; }
        var quest = currentQuest();
        var current = quest.objectives.find(function (row) { return row.state === 'current'; }) || quest.objectives[0];
        state.objectiveId = current ? current.id : '';
      } else if (button.dataset.objective) state.objectiveId = button.dataset.objective;
      else if (button.dataset.filter) state.filter = button.dataset.filter;
      else if (button.dataset.audience && staff) state.audience = button.dataset.audience;
      else return;
      render();
    }
    function onInput(event) {
      if (!event.target || !event.target.matches('[data-quest-search]')) return;
      state.query = event.target.value;
      render();
      var input = root.querySelector('[data-quest-search]');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    await refresh();
    var channel = null;
    if (sb && typeof sb.channel === 'function' && state.result && state.result.available) {
      channel = sb.channel('quest-log-live');
      ['quests', 'quest_objectives', 'quest_objective_evidence', 'quest_rewards'].forEach(function (table) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, refresh);
      });
      channel.subscribe();
    }
    return { active: true, staff: staff, refresh: refresh, destroy: function () {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      if (channel && sb && typeof sb.removeChannel === 'function') sb.removeChannel(channel);
    } };
  }

  return {
    VERSION: VERSION, STATUSES: STATUSES, OBJECTIVE_STATES: OBJECTIVE_STATES,
    text: text, isStaff: isStaff, isEnabled: isEnabled, sortQuests: sortQuests,
    normalizeQuest: normalizeQuest, normalizeSecret: normalizeSecret,
    normalizeObjective: normalizeObjective, normalizeEvidence: normalizeEvidence,
    normalizeReward: normalizeReward, load: load, progressFor: progressFor,
    partyProjection: partyProjection, evidenceMoments: evidenceMoments, mount: mount
  };
});
