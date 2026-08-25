// Static safety contract for member quest creation. PostgreSQL execution and
// signed-in role checks remain the live SQL Editor field gate.
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../schema_delta_quest_authoring.sql', import.meta.url), 'utf8');
const preflight = readFileSync(new URL('../../docs/guides/QUEST-AUTHORING-PREFLIGHT.sql', import.meta.url), 'utf8');
const body = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');

let pass = 0, fail = 0;
const ok = (name, condition) => {
  if (condition) pass += 1;
  else { fail += 1; console.log('  FAIL:', name); }
};
const has = pattern => pattern.test(body);

console.log('--- durable Quest Begun receipt ---');
ok('giver identity and label become optional together', has(/alter table public\.quests alter column giver_id drop not null/i) && has(/alter table public\.quests alter column giver_label drop not null/i) && has(/quests_giver_pair/i));
ok('quest starts have one stable identity per quest', has(/create table if not exists public\.quest_starts[\s\S]*?id\s+uuid primary key[\s\S]*?quest_id\s+text not null unique references public\.quests\(id\) on delete restrict/i));
ok('origin vocabulary is exactly Chronicle Journal and Hub', has(/origin in \('chronicle','journal','hub'\)/i));
ok('Chronicle start preserves a typed feed identity', has(/feed_post_id\s+bigint/i));
ok('Journal start preserves a typed page identity', has(/journal_page_id\s+uuid/i));
ok('source deletion cannot rewrite the historical receipt', !/feed_post_id\s+bigint\s+references/i.test(body) && !/journal_page_id\s+uuid\s+references/i.test(body));
ok('origin constraint forbids invented source identities', has(/quest_starts_origin_source[\s\S]*?origin = 'chronicle' and feed_post_id is not null[\s\S]*?origin = 'journal' and journal_page_id is not null and feed_post_id is null[\s\S]*?origin = 'hub' and feed_post_id is null and journal_page_id is null/i));
ok('story-time index supports Chronicle session merge', has(/quest_starts_story_time_idx[\s\S]*?session_id, occurred_at, id/i));
ok('Quest Begun receipt rejects updates and deletes', has(/quest_starts_append_only[\s\S]*?before update or delete/i));
ok('members read starts only through readable quests', has(/quest_starts_select[\s\S]*?public\.is_member\(\)[\s\S]*?q\.visibility = 'party' or public\.is_staff\(\)/i));
ok('anonymous has no start-table capability and authenticated retains SELECT only', has(/revoke all privileges on table public\.quest_starts from anon, authenticated;[\s\S]*?grant select on table public\.quest_starts to authenticated;/i));
ok('starts join realtime for Chronicle repaint', has(/alter publication supabase_realtime add table public\.quest_starts/i));

console.log('--- narrow transactional creation ---');
ok('create quest is one SECURITY DEFINER RPC', has(/create or replace function public\.create_quest\s*\([\s\S]*?security definer/i));
ok('security definer pins a safe search path', has(/security definer\s+set search_path = public, pg_temp/i));
ok('anonymous callers are rejected', has(/if v_uid is null then[\s\S]*?must be signed in/i));
ok('all approved campaign members may create', has(/if not public\.is_member\(\) then[\s\S]*?approved campaign member/i));
ok('request identity is mandatory', has(/if p_request_id is null then[\s\S]*?request id is required/i));
ok('person-facing required fields are enforced', ['quest name is required', 'quest description is required', 'one clear objective is required'].every(text => body.toLowerCase().includes(text)));
ok('person-facing fields have bounded sizes', has(/length\(v_title\) > 160/i) && has(/length\(v_description\) > 5000/i) && has(/length\(v_objective_title\) > 500/i));
ok('giver and location pairs cannot split', (body.match(/num_nonnulls\(/g) || []).length === 2);
ok('origin validation covers each source shape', has(/v_origin = 'chronicle' and p_source_feed_post_id is null/i) && has(/v_origin = 'journal'[\s\S]*?p_source_journal_page_id is null/i) && has(/v_origin = 'hub'[\s\S]*?p_source_feed_post_id is not null/i));
ok('same request serializes concurrent retries', has(/pg_advisory_xact_lock\(hashtextextended\(p_request_id::text, 0\)\)/i));
ok('request identity deterministically names quest and objective', has(/v_quest_id := 'quest-' \|\| p_request_id::text/i) && has(/v_objective_id := 'quest-objective-' \|\| p_request_id::text/i));
ok('retry returns the existing three records', has(/'retried', true[\s\S]*?'quest', to_jsonb\(v_quest\)[\s\S]*?'objective', to_jsonb\(v_objective\)[\s\S]*?'start', to_jsonb\(v_start\)/i));
ok('reused request with different details is rejected', has(/request id was already used for different details/i));
ok('Chronicle source must be public Chronicle prose', has(/from public\.feed f[\s\S]*?f\.channel = 'chronicle'[\s\S]*?not f\.hidden/i));
ok('Chronicle Journal cross-link mismatch is rejected', has(/Chronicle entry does not point to that Journal page/i));
ok('Journal source identity must exist', has(/from public\.journal_pages p[\s\S]*?linked Journal page does not exist/i));
ok('source session falls back to current campaign session', has(/if v_session_id is null then[\s\S]*?select c\.current_session/i));
ok('quest is immediately active and party visible', has(/insert into public\.quests[\s\S]*?'active', 'party'/i));
ok('missing location stays honestly unlocated', has(/case when v_location_id is null then 'unlocated' else 'confirmed' end/i));
ok('one current objective is inserted', has(/insert into public\.quest_objectives[\s\S]*?v_objective_id, v_quest_id, 1[\s\S]*?'current'/i));
ok('start receipt inserts in the same function', has(/insert into public\.quest_starts[\s\S]*?p_request_id, v_quest_id, v_origin/i));
ok('first response returns all committed records', has(/'retried', false[\s\S]*?'quest', to_jsonb\(v_quest\)[\s\S]*?'objective', to_jsonb\(v_objective\)[\s\S]*?'start', to_jsonb\(v_start\)/i));
ok('only authenticated receives RPC execution', has(/revoke all on function public\.create_quest[\s\S]*?from public, anon;[\s\S]*?grant execute on function public\.create_quest[\s\S]*?to authenticated;/i));
ok('RPC adds no direct authenticated quest-table write grant', !/grant\s+(?:select,\s*)?(?:insert|update|delete)[\s\S]*?on(?: table)? public\.(?:quests|quest_objectives|quest_starts)[\s\S]*?to authenticated/i.test(body));

console.log('--- read-only application evidence ---');
ok('preflight distinguishes missing and installed authoring', preflight.includes("'quest_authoring_not_installed'") && preflight.includes("'installed_quest_authoring'"));
ok('preflight checks every source and session prerequisite', ["'public.feed'", "'public.journal_pages'", "'public.campaign'", "'public.is_member()'"].every(value => preflight.includes(value)));
ok('preflight checks the exact create RPC signature', preflight.includes("public.create_quest(uuid,text,text,text,text,text,text,text,text,bigint,uuid)"));
ok('preflight checks optional giver correction', preflight.includes("column_name = 'giver_id'") && preflight.includes("column_name = 'giver_label'"));
ok('preflight checks append-only start guard', preflight.includes("trigger_name = 'quest_starts_append_only'"));
ok('preflight rejects table and column write grants across all quest tables', /has_any_column_privilege/i.test(preflight) && preflight.includes("'quest_starts'"));
ok('preflight checks authenticated-only RPC execution', /has_function_privilege\('authenticated'/i.test(preflight) && /has_function_privilege\('anon'/i.test(preflight));
ok('preflight performs no writes', !/insert into|update\s+public|delete from|alter table|create table|drop policy|\bgrant\s|\brevoke\s/i.test(preflight));

console.log(`\nsmoke-quest-authoring-sql: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
