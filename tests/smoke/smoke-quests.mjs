import { readFileSync } from 'node:fs';
import Quests from '../../quests.js';

let passed = 0;
let failed = 0;
function ok(condition, label) {
  if (condition) passed += 1;
  else { failed += 1; console.log('  FAIL: ' + label); }
}

ok(Quests.VERSION === 'q-3', 'reader exposes the q-3 shared contract');
ok(Quests.isEnabled('') && Quests.isEnabled('?quest=quest-a'), 'Quest Log is available through normal and deep-link routes');
ok(!Quests.isEnabled('?questLog=0'), 'Quest Log retains an explicit rollback door');
ok(Quests.isStaff({ role:'dm' }) && Quests.isStaff({ role:'overseer' }) && !Quests.isStaff({ role:'player' }), 'staff projection is role-gated');

const quest = Quests.normalizeQuest({ id:'quest-a', title:'A Quest', status:'active', giver_id:'sumi', giver_label:'Sumi', destination_location_id:'barrow-wastes', destination_label:'Near the Barrow Wastes', destination_precision:'approximate' });
ok(quest.id === 'quest-a' && quest.giverId === 'sumi' && quest.giverLabel === 'Sumi', 'quest keeps giver identity and readable label separately');
ok(quest.destinationLocationId === 'barrow-wastes' && quest.destinationPrecision === 'approximate', 'quest keeps destination identity and precision');
const objective = Quests.normalizeObjective({ id:'obj-a', quest_id:'quest-a', position:2, title:'Find it', state:'current' });
ok(objective.questId === 'quest-a' && objective.position === 2 && objective.state === 'current', 'objective normalization keeps parent order and state');
const evidence = Quests.normalizeEvidence({ id:'qe-a', objective_id:'obj-a', moment_id:'moment-a', note:'Proof.' });
ok(evidence.objectiveId === 'obj-a' && evidence.momentId === 'moment-a', 'evidence retains both immutable identities');
const reward = Quests.normalizeReward({ id:'qr-a', quest_id:'quest-a', position:1, kind:'favor', label:"Sumi's favor", state:'promised', visibility:'party' });
ok(reward.questId === 'quest-a' && reward.kind === 'favor' && reward.visibility === 'party', 'reward normalization retains public state');

const sorted = Quests.sortQuests([
  Quests.normalizeQuest({ id:'completed', title:'Done', status:'completed', updated_at:'2026-08-20T00:00:00Z' }),
  Quests.normalizeQuest({ id:'offered', title:'Offered', status:'offered', updated_at:'2026-08-20T00:00:00Z' }),
  Quests.normalizeQuest({ id:'active', title:'Active', status:'active', updated_at:'2026-08-19T00:00:00Z' })
]);
ok(sorted.map(row => row.id).join(',') === 'active,offered,completed', 'active and offered work stays ahead of completed history');

quest.objectives = [
  Quests.normalizeObjective({ id:'o1', quest_id:'quest-a', position:1, title:'First', state:'complete' }),
  Quests.normalizeObjective({ id:'o2', quest_id:'quest-a', position:2, title:'Second', state:'current' })
];
quest.rewards = [
  Quests.normalizeReward({ id:'r1', quest_id:'quest-a', position:1, label:'Public', visibility:'party' }),
  Quests.normalizeReward({ id:'r2', quest_id:'quest-a', position:2, label:'Secret', state:'hidden', visibility:'staff' })
];
Object.assign(quest, { staffTruth:'Secret truth', exactLocationId:'chapel', exactLocationLabel:'The Chapel', completionTruth:'Break the seals', rewardTruth:'Only if sealed' });
ok(Quests.progressFor(quest).label === '1 of 2', 'progress derives from ordered objective state');
const playerQuest = Quests.partyProjection(quest);
ok(playerQuest.staffTruth === '' && playerQuest.exactLocationId === null && playerQuest.completionTruth === '', 'player projection strips staff quest truth');
ok(playerQuest.rewards.length === 1 && playerQuest.rewards[0].label === 'Public', 'player preview filters staff-only rewards');
ok(quest.staffTruth === 'Secret truth' && quest.rewards.length === 2, 'player preview never mutates the staff record');

const moments = [{ id:'moment-a', title:'Evidence A' }];
quest.objectives[0].evidence = [evidence, Quests.normalizeEvidence({ id:'qe-missing', objective_id:'o1', moment_id:'moment-missing' })];
const joined = Quests.evidenceMoments(quest.objectives[0], moments);
ok(joined[0].moment === moments[0] && joined[1].moment === null, 'evidence resolves only exact readable moment identities');

const dbRows = {
  quests:[{ id:'quest-live', title:'Live Quest', summary:'Shared.', public_hint:'Look east.', status:'active', visibility:'party', giver_id:'sumi', giver_label:'Sumi', destination_location_id:'tiersgard', destination_label:'Tiersgard', destination_precision:'confirmed', offered_at:'2026-08-18T00:00:00Z', completed_at:null, updated_at:'2026-08-20T00:00:00Z' }],
  quest_secrets:[{ quest_id:'quest-live', staff_truth:'Exact truth.', exact_location_id:'gold-leaf', exact_location_label:'The Gold Leaf', exact_map_x:null, exact_map_y:null, completion_truth:'Do the deed.', reward_truth:'Hidden terms.' }],
  quest_objectives:[{ id:'obj-live', quest_id:'quest-live', position:1, title:'Do the thing', public_hint:'Try.', state:'complete', completed_at:'2026-08-20T00:00:00Z' }],
  quest_objective_evidence:[{ id:'qe-live', objective_id:'obj-live', moment_id:'moment-live', note:'Proven.', attached_at:'2026-08-20T00:00:00Z' }],
  quest_rewards:[
    { id:'qr-live', quest_id:'quest-live', position:1, kind:'favor', label:'A favor', detail:'Promised.', state:'promised', visibility:'party', awarded_at:null },
    { id:'qr-hidden', quest_id:'quest-live', position:2, kind:'access', label:'Hidden access', detail:'Secret.', state:'hidden', visibility:'staff', awarded_at:null }
  ]
};
function fakeSb(rows, errors) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(table);
      const builder = {
        select() { return builder; }, order() { return builder; },
        then(resolve, reject) { return Promise.resolve({ data:(rows && rows[table]) || [], error:errors && errors[table] ? { message:errors[table] } : null }).then(resolve, reject); }
      };
      return builder;
    }
  };
}
const playerSb = fakeSb(dbRows);
const playerLoad = await Quests.load(playerSb, { staff:false });
ok(playerLoad.available && playerLoad.quests.length === 1, 'player reader loads the shared quest');
ok(!playerSb.calls.includes('quest_secrets') && playerLoad.quests[0].staffTruth === '', 'player reader never requests staff-only truth');
ok(playerLoad.quests[0].objectives[0].evidence[0].momentId === 'moment-live', 'reader joins evidence to its objective');
ok(playerLoad.quests[0].rewards.length === 1 && playerLoad.quests[0].rewards[0].label === 'A favor', 'player reader defensively filters staff-only rewards');
const staffSb = fakeSb(dbRows);
const staffLoad = await Quests.load(staffSb, { staff:true });
ok(staffSb.calls.includes('quest_secrets') && staffLoad.quests[0].staffTruth === 'Exact truth.', 'staff reader receives the separate secret projection');
ok(staffLoad.quests[0].rewards.length === 2, 'staff reader retains hidden rewards');
const absent = await Quests.load(fakeSb({}, { quests:'relation public.quests does not exist' }), { staff:false });
ok(!absent.available && /not been installed/.test(absent.error), 'pre-migration deployment narrates the unavailable contract');

const sql = readFileSync(new URL('../../schema_delta_quests.sql', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../quests.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../quests.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../quests.html', import.meta.url), 'utf8');
const harness = readFileSync(new URL('../fixtures/quests-harness.html', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../../nav.js', import.meta.url), 'utf8');
const preflight = readFileSync(new URL('../../docs/guides/QUEST-PREFLIGHT.sql', import.meta.url), 'utf8');
const privilegeSql = readFileSync(new URL('../../schema_delta_quest_reader_privileges.sql', import.meta.url), 'utf8');
const world = readFileSync(new URL('../../world.html', import.meta.url), 'utf8');
const rail = readFileSync(new URL('../../rail.js', import.meta.url), 'utf8');
const railTab = readFileSync(new URL('../../quests-tab.js', import.meta.url), 'utf8');

ok(/create table if not exists public\.quests/i.test(sql), 'canonical quest table exists');
ok(/create table if not exists public\.quest_secrets/i.test(sql), 'staff truth has a separate table');
ok(/create table if not exists public\.quest_objectives/i.test(sql), 'ordered objectives have a durable table');
ok(/create table if not exists public\.quest_objective_evidence/i.test(sql), 'objective evidence has an additive association table');
ok(/moment_id\s+text not null references public\.campaign_moments\(id\) on delete restrict/i.test(sql), 'evidence reuses immutable campaign moment identity');
ok(/create table if not exists public\.quest_rewards/i.test(sql), 'rewards have a durable ordered table');
ok(/destination_precision in \('unlocated','approximate','confirmed'\)/i.test(sql), 'destination precision is explicit');
ok(/quest_objective_evidence_required[\s\S]*?deferrable initially deferred/i.test(sql), 'completed objectives require evidence at transaction commit');
ok(/quest_completion_required[\s\S]*?completed_quest_objective_set[\s\S]*?after insert or update or delete[\s\S]*?deferrable initially deferred/i.test(sql), 'completed quests retain a valid objective set across quest and objective mutations');
ok(/quest_evidence_append_only[\s\S]*?before update or delete/i.test(sql), 'attached objective evidence is append-only');
ok(/quests_select[\s\S]*?visibility = 'party' or public\.is_staff\(\)/i.test(sql), 'RLS hides staff-only quests from players');
ok(/quest_secrets_staff_select[\s\S]*?public\.is_staff\(\)/i.test(sql), 'secret truth is database-enforced staff-only');
ok(/quest_evidence_select[\s\S]*?m\.visibility = 'party' or public\.is_staff\(\)/i.test(sql), 'evidence links cannot reveal a staff-only campaign moment');
ok(/quest_rewards\.visibility = 'party' or public\.is_staff\(\)/i.test(sql), 'staff-only rewards remain hidden at the database boundary');
ok(/revoke insert, update, delete[\s\S]*?from authenticated/i.test(sql), 'authenticated production clients remain readers');
ok(!/insert into public\.quests/i.test(sql), 'migration invents no campaign quest data');
ok(!/create or replace function public\.(create|update|complete|publish)_quest/i.test(sql), 'staff authoring RPCs remain outside the first field gate');
ok(/alter publication supabase_realtime add table public\.quests/i.test(sql), 'shared Quest Log can repaint after deliberate service writes');
ok(preflight.includes("'installed_quest_foundation'") && preflight.includes("'quest_schema_not_installed'"), 'preflight reports installed and missing-schema outcomes');
ok(/has_any_column_privilege/i.test(preflight) && /authenticated_write_grants\s*>\s*0/i.test(preflight), 'preflight rejects inherited, table, or column authenticated write grants across the quest tables');
ok(/quest_objective_evidence_required/.test(preflight) && /completed_quest_objective_set/.test(preflight) && /quest_evidence_append_only/.test(preflight), 'preflight checks completion, objective-set, and append-only guards');
ok(!/insert into|update\s+public|delete from|alter table|create table|drop policy|\bgrant\s|\brevoke\s/i.test(preflight), 'preflight remains read-only');
ok(/revoke all privileges on table public\.quests[\s\S]*?from authenticated;/i.test(privilegeSql), 'additive correction clears authenticated table and column grants');
ok(/grant select on table public\.quests[\s\S]*?to authenticated;/i.test(privilegeSql), 'additive correction grants back only the guarded reader capability');
ok(!/\b(insert|update|delete|truncate|references|trigger)\b[\s\S]*?to authenticated/i.test(privilegeSql), 'additive correction restores no authenticated write or structural privilege');

ok(source.includes("sb.from('quests')") && source.includes("sb.from('quest_objectives')") && source.includes("sb.from('quest_objective_evidence')"), 'reader uses the canonical quest tables');
ok(source.includes("options.staff\n      ? sb.from('quest_secrets')"), 'secret read is conditional on resolved staff authority');
ok(source.includes('partyProjection(quest)') && source.includes("reward.visibility === 'party'"), 'staff player-preview strips secret rewards');
ok(source.includes('campaignApi.targets(moment)'), 'objective evidence reuses campaign connection targets');
ok(source.includes('No completion evidence is attached.'), 'missing evidence narrates why an objective remains incomplete');
ok(source.includes('QuestFeedCapture.descriptionHTML(value)') && source.includes('view.attachTooltips(root)'), 'Quest Log renders safe linked descriptions and binds their hover cards');
ok(source.includes('See what matters now. Open a quest only when you want its story and connections.'), 'production Hub uses the approved streamlined purpose');
ok(source.includes('function hubGroupsHtml()') && source.includes('Search quests, objectives, people, or locations'), 'Hub groups the visual record and searches its useful fields');
ok(!/\.insert\s*\(|\.update\s*\(|\.delete\s*\(/.test(source), 'guarded client has no write path');
ok(css.includes('@media(max-width:720px)') && css.includes('min-height:64px'), 'mobile layout retains touch-sized evidence links');
ok(page.includes('quests.css?v=q3') && page.includes('quests.js?v=q3') && page.includes('campaign-moments.js?v=cm2'), 'production page loads cache-stamped quest and campaign readers');
ok(page.includes('quest-feed-capture.js?v=qfc3') && page.includes('tooltips.css?v=qt1') && page.includes('tooltips.js'), 'Quest Log loads the rich-description and tooltip dependencies');
ok(/characters\.js[\s\S]*nav\.js\?v=sup8[\s\S]*battle\.js\?v=settings1/.test(page), 'production page loads battle.js only after its character dependency');
ok(page.includes('data-quest-root') && page.includes('window.Quests.mount'), 'dedicated page mounts the guarded reader');
ok(nav.includes("{ label: 'Quests'"), 'global navigation exposes the promoted Quest Hub');
ok(rail.includes('quests-tab.js?v=qt1') && railTab.includes("id: 'quests'"), 'site-wide rail registers the compact Quest projection');
ok(railTab.includes('Open in Quest Hub') && railTab.includes('Use <b>/quest</b> in the Feed'), 'rail keeps details concise and points authoring back to the Feed');
ok(world.includes('quests.js?v=q3') && world.includes('function locationQuestsHTML'), 'World derives location quest cards from the shared reader');
ok(world.includes('world.html?quest=') === false && source.includes('world.html?quest='), 'Hub links to World without embedding copied World URLs in quest data');
ok(world.includes('min-height: 0; overflow-y: auto; overscroll-behavior: contain') && world.includes('formatLocationProse'), 'World detail panel scrolls and breaks very long legacy prose into paragraphs');
const inline = [...page.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(block => block.includes('startQuestLog'));
try { new Function(inline); ok(true, 'production page boot script parses'); } catch (error) { ok(false, 'production page boot script parses: ' + error.message); }
ok(harness.includes('../../quests.js?v=q3') && harness.includes('../../quest-feed-capture.js?v=qfc3') && harness.includes('../../campaign-moments.js?v=cm2') && harness.includes('window.Quests.mount'), 'browser harness uses production readers');

console.log(`\nsmoke-quests: ${passed}/${passed + failed} passed${failed ? `  (${failed} FAILED)` : ''}`);
process.exit(failed ? 1 : 0);
