import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../schema_delta_item_management.sql', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function ok(value, name) { if (value) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }
function has(pattern) { return pattern.test(sql); }

ok(has(/function public\.identify_item/i), 'identification has one narrow RPC');
ok(has(/identify_item[\s\S]*?if not public\.is_staff\(\)/i), 'identification is staff-only');
ok(has(/identification = 'identified'[\s\S]*?already identified/i), 'repeat identification is rejected');
ok(has(/from public\.item_secrets[\s\S]*?for update/i), 'prepared secret truth is locked before reveal');
ok(has(/display_name = v_secret\.true_name[\s\S]*?rarity = v_secret\.rarity[\s\S]*?mechanics = v_secret\.mechanics/i), 'prepared public truth is published atomically');
ok(has(/jsonb_build_object\([\s\S]*?'name', v_secret\.true_name[\s\S]*?'identification', 'identified'/i), 'held inventory projection is identified in the same transaction');
ok(has(/'identified'[\s\S]*?jsonb_build_object\('oldDisplayName'/i), 'identification appends an attributed history event');
ok(has(/function public\.rename_item/i), 'rename has one narrow RPC');
ok(has(/rename_item[\s\S]*?if not public\.is_staff\(\)/i), 'rename is staff-only');
ok(has(/if p_new_name is null/i) && has(/choose a different public name/i), 'rename validates public name input');
ok(has(/jsonb_build_object\('name', p_new_name\)/i), 'rename updates the held inventory row');
ok(has(/set display_name = p_new_name/i), 'rename updates canonical public truth');
ok(has(/'renamed'[\s\S]*?'oldDisplayName'[\s\S]*?'newDisplayName'/i), 'rename appends old and new names to history');
ok(!/update public\.item_events|delete from public\.item_events/i.test(sql), 'management never rewrites append-only history');
ok(has(/grant execute on function public\.identify_item/i) && has(/grant execute on function public\.rename_item/i), 'authenticated users receive only narrow RPC execution');

console.log(`\nsmoke-item-management-sql: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
