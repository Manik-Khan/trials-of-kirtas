import { readFileSync } from 'node:fs';
import CampaignMoments from '../../campaign-moments.js';

let passed = 0;
let failed = 0;
function ok(condition, label) {
  if (condition) passed += 1;
  else { failed += 1; console.log('  FAIL: ' + label); }
}

ok(CampaignMoments.VERSION === 'cm-2', 'shared reader exposes the cm-2 legacy-link contract');
ok(CampaignMoments.isEnabled('?campaignLinks=1') && CampaignMoments.isEnabled('?path=1') && CampaignMoments.isEnabled('?moment=m-1'), 'guard accepts path and deep-link doors');
ok(!CampaignMoments.isEnabled(''), 'campaign connections remain guarded by default');
ok(CampaignMoments.isStaff({ role:'dm' }) && !CampaignMoments.isStaff({ role:'player' }), 'staff projection is role-gated');

const locations = [
  { id:'tiersgard', label:'Tiersgard', mapX:28, mapY:71 },
  { id:'gold-leaf', label:'The Gold Leaf', parentId:'tiersgard' },
  { id:'verens-watch', label:"Veren's Watch", mapX:25, mapY:52 }
];
const moments = [
  CampaignMoments.normalizeMoment({ id:'m-2', kind:'npc', occurred_at:'2026-08-02T00:00:00Z', location_id:'gold-leaf', party_present:true }),
  CampaignMoments.normalizeMoment({ id:'m-1', kind:'battle', also:['treasure'], occurred_at:'2026-08-01T00:00:00Z', location_id:'verens-watch', party_present:true, encounter_id:'enc-1', scene_id:'scene-1' }),
  CampaignMoments.normalizeMoment({ id:'m-0', kind:'treasure', occurred_at:'2026-07-01T00:00:00Z', location_id:null, party_present:false })
];
ok(CampaignMoments.sortMoments(moments).map(row => row.id).join(',') === 'm-0,m-1,m-2', 'moments sort by story time oldest first');
ok(CampaignMoments.momentMatches(moments[1], 'battle') && CampaignMoments.momentMatches(moments[1], 'treasure'), 'one fact projects through primary and secondary lenses');
const nested = CampaignMoments.mapLocationFor(moments[0], locations);
ok(nested.id === 'tiersgard' && nested.sourceLocationId === 'gold-leaf', 'nested places project through their mapped parent');
const clusters = CampaignMoments.mapClusters(moments, locations, 'all');
ok(clusters.length === 2, 'unlocated moments do not receive guessed map clusters');
ok(CampaignMoments.pathPoints(moments, locations).map(row => row.locationId).join(',') === 'verens-watch,tiersgard', 'only party-present mapped facts draw the path in story order');

moments[1].items = [{ itemId:'item-staff', bearerKey:'liadan' }];
moments[1].sessionId = '9'; moments[1].feedPostId = '934'; moments[1].forgeSessionId = 'forge-1';
const targets = CampaignMoments.targets(moments[1]);
ok(targets.world.includes('moment=m-1') && targets.chronicle.includes('moment=m-1'), 'World and Chronicle target the same moment identity');
ok(targets.item.includes('character=liadan') && targets.item.includes('item=item-staff'), 'item target opens the current bearer and permanent item identity');
ok(targets.encounter === 'forge/?session=forge-1', 'Forge UUID is a direct typed battle-map target');
ok(CampaignMoments.targets(moments[2]).world === null, 'missing location remains an unavailable World connection');
ok(CampaignMoments.targets({ id:'m-session-only', sessionId:'8' }).chronicle === null, 'a session number alone never invents a Chronicle entry');

const dbRows = {
  campaign_moments:[{ id:'m-live', kind:'battle', title:'Recovered after the ambush', summary:'One fact.', occurred_at:'2026-08-09T00:00:00Z', session_id:9, location_id:'verens-watch', map_precision:'confirmed', party_present:true, visibility:'party', feed_post_id:934, encounter_id:'enc-live', scene_id:'scene-live' }],
  campaign_moment_secrets:[{ moment_id:'m-live', staff_summary:'Exact truth.', exact_location_id:'sunken-chapel', exact_map_x:11, exact_map_y:29 }],
  item_events:[
    { id:'event-live', item_id:'item-staff', event_type:'recovered', moment_id:null },
    { id:'event-direct', item_id:'item-direct', event_type:'assigned', moment_id:'m-live' }
  ],
  campaign_moment_item_events:[{ id:'link-live', moment_id:'m-live', item_event_id:'event-live' }],
  item_instances:[
    { id:'item-staff', display_name:'Skyblinder Staff', current_bearer_key:'liadan', status:'held' },
    { id:'item-direct', display_name:'Direct Item', current_bearer_key:'cosmere', status:'held' }
  ]
};
function fakeSb(calls, failures = {}) {
  return { from(table) {
    calls.push(table);
    const builder = {
      select() { return builder; }, order() { return builder; }, not() { return builder; },
      then(resolve, reject) {
        const result = failures[table] ? { data:null, error:{ message:failures[table] } } : { data:dbRows[table] || [], error:null };
        return Promise.resolve(result).then(resolve, reject);
      }
    };
    return builder;
  } };
}
const staffCalls = [];
const loaded = await CampaignMoments.load(fakeSb(staffCalls), { staff:true });
ok(loaded.available && loaded.moments[0].staffTruth === 'Exact truth.', 'staff load joins separate exact truth onto the public moment');
ok(staffCalls.includes('campaign_moment_item_events'), 'shared reader requests additive legacy associations');
ok(loaded.moments[0].items[0].name === 'Skyblinder Staff' && loaded.moments[0].items[0].linkId === 'link-live', 'legacy event joins the permanent item without rewriting its source moment');
ok(loaded.moments[0].items.some(item => item.name === 'Direct Item' && item.linkId === null), 'native event moment identity remains supported beside legacy associations');
const playerCalls = [];
const playerLoaded = await CampaignMoments.load(fakeSb(playerCalls), { staff:false });
ok(!playerCalls.includes('campaign_moment_secrets') && playerLoaded.moments[0].staffTruth === '', 'player load never requests staff-only campaign truth');
const absent = await CampaignMoments.load(fakeSb([], { campaign_moments:'relation public.campaign_moments does not exist' }), { staff:false });
ok(!absent.available && /not been installed/.test(absent.error), 'pre-migration deployment narrates the unavailable contract');

const sql = readFileSync(new URL('../../schema_delta_campaign_moments.sql', import.meta.url), 'utf8');
const linkSql = readFileSync(new URL('../../schema_delta_campaign_moment_item_links.sql', import.meta.url), 'utf8');
ok(/create table if not exists public\.campaign_moments/i.test(sql), 'canonical campaign moment table exists');
ok(/create table if not exists public\.campaign_moment_secrets/i.test(sql), 'staff exact truth has a separate table');
ok(/scene_id\s+uuid references public\.scenes\(id\)/i.test(sql) && /forge_session_id\s+uuid references public\.forge_sessions\(id\)/i.test(sql), 'battle maps use typed database identities');
ok(/num_nonnulls\(scene_id, forge_session_id\) <= 1/i.test(sql), 'one moment cannot claim two canonical battle maps');
ok(/visibility = 'party' or public\.is_staff\(\)/i.test(sql), 'RLS hides staff-only moments from players');
ok(/campaign_moment_secrets_staff_select[\s\S]*?public\.is_staff\(\)/i.test(sql), 'exact truth is database-enforced staff-only');
ok(/revoke insert, update, delete[\s\S]*?from authenticated/i.test(sql), 'production readers cannot mutate campaign history');
ok(/alter publication supabase_realtime add table public\.campaign_moments/i.test(sql), 'World can repaint after a deliberate server-side moment insert');
ok(!/insert into public\.campaign_moments/i.test(sql), 'migration invents no production story data');
ok(/create table if not exists public\.campaign_moment_item_events/i.test(linkSql), 'additive legacy association table exists');
ok(/moment_id\s+text not null references public\.campaign_moments\(id\)/i.test(linkSql) && /item_event_id\s+text not null references public\.item_events\(id\)/i.test(linkSql), 'association retains both immutable identities');
ok(/unique \(item_event_id\)/i.test(linkSql), 'one source item event cannot claim multiple moments');
ok(/campaign_moment_item_events_select[\s\S]*?m\.visibility = 'party' or public\.is_staff\(\)/i.test(linkSql), 'legacy associations cannot reveal staff-only moments');
ok(/revoke insert, update, delete[\s\S]*?campaign_moment_item_events from authenticated/i.test(linkSql), 'authenticated readers cannot mutate associations');
ok(!/update\s+public\.item_events/i.test(linkSql), 'legacy delta never rewrites append-only item events');
ok(linkSql.includes("'moment-s8-unopened-satchel'") && linkSql.includes("'moment-s8-skyblinder-recovered'"), 'first field data remains two explicit facts');
ok(/moment-s8-unopened-satchel[\s\S]*?449[\s\S]*?84b36678-21b3-4a64-baf5-96a3d1c3475f[\s\S]*?ce811962-031d-431d-bc2d-ebcdb83693d1/i.test(linkSql), 'unopened satchel owns its exact Chronicle encounter and scene evidence');
ok(/moment-s8-skyblinder-recovered[\s\S]*?feed_post_id is null[\s\S]*?encounter_id is null[\s\S]*?scene_id is null/i.test(linkSql), 'Skyblinder receives no guessed Chronicle encounter or scene identity');
ok(/momentitemlink-s8-skyblinder-recovered[\s\S]*?itemev_4b983df8-a75c-4601-aefe-73849ec8d759/i.test(linkSql), 'Skyblinder joins its exact recovery event through the additive association');

const world = readFileSync(new URL('../../world.html', import.meta.url), 'utf8');
const chronicle = readFileSync(new URL('../../chronicle.html', import.meta.url), 'utf8');
const worldScript = [...world.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(source=>source.includes('CANON LOCATION DATA'));
const chronicleScript = [...chronicle.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(source=>source.includes('Phase 2: the chronicle'));
try { new Function(worldScript); ok(true, 'World production script parses'); } catch (error) { ok(false, 'World production script parses: ' + error.message); }
try { new Function(chronicleScript); ok(true, 'Chronicle production script parses'); } catch (error) { ok(false, 'Chronicle production script parses: ' + error.message); }
ok(world.includes('campaign-moments.js?v=cm2') && world.includes('id="rail-path"') && world.includes('party-path-line'), 'World loads the guarded Party\'s Path projection');
ok(world.includes('CampaignMoments.mapClusters') && world.includes('CampaignMoments.pathPoints'), 'World clusters co-located moments and draws only witnessed travel');
ok(world.includes('worldIsStaff ? moments.filter') && world.includes('party-path-pin staff-exact'), 'staff exact coordinates render through a separate role-gated layer');
ok(world.includes("No map location was recorded, so Party's Path does not guess a pin."), 'World narrates an unlocated fact instead of guessing');
ok(world.includes('This moment has no linked Chronicle entry.') && world.includes('No durable item is linked to this moment.'), 'World narrates both partial-link boundaries');
ok(world.includes('Item connections unavailable:') && world.includes('Item connections could not be read:'), 'World distinguishes an unavailable association reader from a truly unlinked item');
ok(chronicle.includes('campaign-moments.js?v=cm2') && chronicle.includes('campaignEntryConnections'), 'Chronicle decorates the linked feed projection');
ok(chronicle.includes('scroller.scrollTop +='), 'Chronicle deep link moves its own pane without scrolling the page');

console.log(`\nsmoke-campaign-moments: ${passed}/${passed + failed} passed${failed ? `  (${failed} FAILED)` : ''}`);
process.exit(failed ? 1 : 0);
