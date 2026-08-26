import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../../schema_delta_quest_rich_length_validation.sql', import.meta.url), 'utf8')
const preflight = readFileSync(new URL('../../docs/guides/QUEST-RICH-LENGTH-PREFLIGHT.sql', import.meta.url), 'utf8')
let pass = 0, fail = 0
const ok = (condition, label) => condition ? pass += 1 : (fail += 1, console.log('  FAIL:', label))

ok(/create or replace function public\.quest_rich_visible_length\(p_value text\)/i.test(sql), 'migration installs one readable-length helper')
ok(/immutable[\s\S]*?strict[\s\S]*?set search_path = public, pg_temp/i.test(sql), 'helper is deterministic and pins its search path')
ok(/tok-quest-rich-v1:/.test(sql) && /jsonb_array_elements/i.test(sql), 'helper reads the existing versioned paragraph envelope')
ok(/v_inline ->> 'type' = 'tokMention'[\s\S]*?1 \+ length/i.test(sql), 'linked mentions count as their visible @ label')
ok(/v_inline ->> 'type' = 'hardBreak'[\s\S]*?v_length \+ 1/i.test(sql), 'hard breaks count as one readable character')
ok(/length\(v_description\) > 50000[\s\S]*?quest_rich_visible_length\(v_description\) > 5000/i.test(sql), 'description keeps a raw cap and a readable 5000-character cap')
ok(/length\(v_objective_title\) > 10000[\s\S]*?quest_rich_visible_length\(v_objective_title\) > 500/i.test(sql), 'objective keeps a raw cap and a readable 500-character cap')
ok(/did not match the installed authoring foundation; no change was applied/i.test(sql), 'surgical RPC correction fails closed on an unexpected installed function')
ok(/position\('quest_rich_visible_length\(v_description\)'[\s\S]*?position\('quest_rich_visible_length\(v_objective_title\)'[\s\S]*?return;/i.test(sql), 'migration reruns safely after the correction is installed')
ok(/quest_rich_visible_length\(v_example\) <> 124/i.test(sql), 'migration proves the reported formatted objective as a known answer')
ok(/revoke all on function public\.quest_rich_visible_length\(text\) from public, anon, authenticated/i.test(sql), 'helper exposes no unnecessary client capability')
ok(/installed_quest_rich_length_validation/.test(preflight) && /create_quest_not_using_readable_length/.test(preflight), 'preflight distinguishes installed and incomplete outcomes')
ok(!/else\s+public\.quest_rich_visible_length/i.test(preflight) && /known_answer_expected', 124/.test(preflight), 'preflight still runs safely when the helper is absent')
ok(/has_function_privilege\('authenticated'/.test(preflight) && /has_function_privilege\('anon'/.test(preflight), 'preflight retains the authenticated-only RPC execution check')
ok(!/insert into|update\s+public|delete from|alter table|create table|drop policy|\bgrant\s|\brevoke\s/i.test(preflight), 'preflight remains read-only')

console.log(`\nsmoke-quest-rich-length-sql: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`)
process.exit(fail ? 1 : 0)
