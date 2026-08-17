import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../schema_delta_item_attunement.sql', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../../sheet-actions.js', import.meta.url), 'utf8');
const gear = readFileSync(new URL('../../gear-manager.js', import.meta.url), 'utf8');
const mount = readFileSync(new URL('../../sheet-mount.js', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function ok(value, name) { if (value) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }
function has(pattern) { return pattern.test(sql); }

ok(has(/add column if not exists requires_attunement boolean not null default false/i), 'schema adds an explicit durable requirement');
ok(has(/where attuned = true/i) && has(/requires attunement/i), 'backfill preserves active and imported requirements');
ok(has(/item_instances_attunement_check[\s\S]*?requires_attunement or attuned = false/i), 'active attunement requires the durable rule');
ok(has(/function public\.set_item_attunement_requirement/i) && has(/if not public\.is_staff\(\)/i), 'only staff can set the requirement');
ok(has(/set_item_attunement_requirement[\s\S]*?for update/i), 'requirement change locks canonical state');
ok(has(/'reqAttune', p_requires_attunement[\s\S]*?'attuned', case when p_requires_attunement then v_item\.attuned else false end/i), 'requirement change synchronizes the Gear row and clears active state when disabled');
ok(has(/update public\.item_instances[\s\S]*?requires_attunement = p_requires_attunement[\s\S]*?attuned = case/i), 'requirement change synchronizes the durable row');
ok(has(/function public\.set_item_attuned/i) && has(/if not public\.is_member\(\)/i), 'campaign members use the narrow bearer attunement RPC');
ok(has(/current_bearer_key is distinct from p_expected_bearer_key/i), 'stale bearer state is rejected');
ok(has(/not v_item\.requires_attunement/i), 'a no-requirement item cannot be attuned');
ok(has(/v_attuned_count >= 3/i), 'server enforces the three-item cap');
ok(has(/jsonb_build_object\('reqAttune', true, 'attuned', p_attuned\)/i), 'bearer RPC updates the matching inventory row');
ok(has(/update public\.item_instances[\s\S]*?set attuned = p_attuned/i), 'bearer RPC updates canonical state in the same transaction');
ok(has(/grant execute on function public\.set_item_attunement_requirement/i) && has(/grant execute on function public\.set_item_attuned/i), 'authenticated callers receive only RPC execution');
ok(actions.includes("sb.rpc('set_item_attuned'") && actions.includes('p_expected_bearer_key: key'), 'flagged Gear control calls the atomic bearer RPC');
ok(actions.includes('if (!it.instanceId || !itemHistoryEnabled()) it.reqAttune'), 'tracked requirement cannot drift through the flagged ordinary editor');
ok(gear.includes('managed in Item History'), 'tracked editor explains where staff changes the rule');
ok(actions.includes("root.dataset.itemHistoryActive === '1'") && gear.includes('st.itemHistoryActive') && mount.includes('itemHistoryActive:!!(root.dataset'), 'promotion is scoped to the full-sheet root and does not activate mounted Gear');

console.log(`\nsmoke-item-attunement-sql: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
