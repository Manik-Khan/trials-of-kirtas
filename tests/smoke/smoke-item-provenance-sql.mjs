// Static contract gate for the prepared item SQL. PostgreSQL/Supabase is not
// available in this workspace, so deployment still requires SQL Editor review.
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../schema_delta_item_provenance.sql', import.meta.url), 'utf8');
const preflight = readFileSync(new URL('../../docs/guides/ITEM-TRANSFER-PREFLIGHT.sql', import.meta.url), 'utf8');
const executable = (sql) => sql
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--.*$/gm, '');
const body = executable(migration);
const audit = executable(preflight);

let pass = 0, fail = 0;
const ok = (name, condition) => {
  if (condition) pass++;
  else { fail++; console.log('  FAIL:', name); }
};
const has = (source, pattern) => pattern.test(source);

console.log('--- durable tables match tok-item/v1 ---');
ok('public item_instances table exists', has(body, /create table if not exists public\.item_instances\s*\(/i));
ok('staff item_secrets table exists', has(body, /create table if not exists public\.item_secrets\s*\(/i));
ok('append-only item_events table exists', has(body, /create table if not exists public\.item_events\s*\(/i));
ok('public identity remains a stable text id', has(body, /item_instances\s*\([\s\S]*?\bid\s+text primary key/i));
ok('rarity uses the approved six-color vocabulary', ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'].every((rarity) => body.includes(`'${rarity}'`)));
ok('unknown public rows cannot contain revealed mechanics', has(body, /item_instances_identification_public_check[\s\S]*?definition_key is null[\s\S]*?rarity is null[\s\S]*?mechanics = '\{\}'::jsonb/i));
ok('custody requires a bearer only while held', has(body, /item_instances_custody_check[\s\S]*?status = 'held'[\s\S]*?current_bearer_key is not null[\s\S]*?status <> 'held'[\s\S]*?current_bearer_key is null/i));
ok('equipment state is rejected when an item is not held', has(body, /item_instances_equipment_check[\s\S]*?status = 'held' or \(slot is null and attuned = false\)/i));

console.log('--- event history is append-only + linkable ---');
ok('event vocabulary matches the JS lifecycle', ['recovered', 'assigned', 'identified', 'renamed', 'transferred', 'transformed', 'lost', 'destroyed'].every((type) => body.includes(`'${type}'`)));
ok('event sequence supplies deterministic append order', has(body, /sequence\s+bigint generated always as identity unique/i));
ok('all approved cross-system links exist', ['session_id', 'location_id', 'moment_id', 'encounter_id', 'journal_page_id', 'feed_post_id', 'battle_map_id'].every((field) => has(body, new RegExp(`\\b${field}\\s+text`))));
ok('update/delete are blocked by a database trigger', has(body, /create trigger item_events_append_only[\s\S]*?before update or delete on public\.item_events/i));
ok('no item-events update policy exists', !has(body, /create policy[^;]+on public\.item_events\s+for update/is));
ok('no item-events delete policy exists', !has(body, /create policy[^;]+on public\.item_events\s+for delete/is));

console.log('--- secrets + writes remain server-gated ---');
ok('all three tables enable RLS', ['item_instances', 'item_secrets', 'item_events'].every((table) => has(body, new RegExp(`alter table public\\.${table}\\s+enable row level security`, 'i'))));
ok('members may read public item state', has(body, /item_instances_select[\s\S]*?for select to authenticated using \(public\.is_member\(\)\)/i));
ok('only staff may read item secrets', has(body, /item_secrets_staff_select[\s\S]*?for select to authenticated using \(public\.is_staff\(\)\)/i));
ok('authenticated direct writes are revoked', has(body, /revoke insert, update, delete on public\.item_instances, public\.item_secrets, public\.item_events from authenticated/i));
ok('prepared migration does not guess at characters', !has(body, /public\.characters/i));
ok('transfer RPC is correctly absent until live authority is captured', !has(body, /create or replace function public\.(?:transfer_item|item_transfer)/i));

console.log('--- preflight is complete + read-only ---');
ok('preflight captures columns', has(audit, /from information_schema\.columns/i));
ok('preflight captures constraints and indexes', has(audit, /from pg_constraint/i) && has(audit, /from pg_indexes/i));
ok('preflight captures RLS policies', has(audit, /from pg_policies/i));
ok('preflight captures triggers and function bodies', has(audit, /from pg_trigger/i) && has(audit, /pg_get_functiondef/i));
ok('preflight captures grants and realtime', has(audit, /from information_schema\.role_table_grants/i) && has(audit, /from pg_publication_tables/i));
ok('preflight consolidates every section into one JSON result', has(audit, /jsonb_pretty\s*\(\s*jsonb_build_object\s*\(/i) && has(audit, /as item_transfer_preflight/i));
ok('preflight is one statement so Supabase cannot hide earlier grids', audit.split(';').filter((statement) => statement.trim()).length === 1);
ok('preflight contains no mutating statement', !has(audit, /^\s*(?:alter|create|drop|insert|update|delete|grant|revoke|truncate)\b/im));

console.log(`\nsmoke-item-provenance-sql: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
