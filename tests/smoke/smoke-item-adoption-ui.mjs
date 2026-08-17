// Dependency-free client contract for the promoted item-adoption bridge. The
// browser harness drives the real DOM; PostgreSQL behavior is covered by the
// dedicated SQL smoke and the live SQL-editor field pass.
import { readFileSync } from 'node:fs';
import ItemAdoption from '../../item-adoption.js';

let pass = 0, fail = 0;
const ok = (condition, label) => { if (condition) pass++; else { fail++; console.log('  FAIL:', label); } };

console.log('--- promotion + authority gate ---');
ok(ItemAdoption.isEnabled('') && ItemAdoption.isEnabled('?itemHistory=1'), 'full-sheet default and explicit flag enable adoption');
ok(!ItemAdoption.isEnabled('?itemHistory=0'), 'zero remains an explicit rollback switch');
ok(ItemAdoption.isStaff({ role:'dm' }) && ItemAdoption.isStaff({ role:'overseer' }), 'DM and overseer are staff');
ok(!ItemAdoption.isStaff({ role:'player' }) && !ItemAdoption.isStaff(null), 'players and missing profiles are not staff');

console.log('--- exact RPC payload ---');
const ITEM = { id:'cloak-row', name:'Embroidered Cloak', qty:1, rarity:'Rare', entries:['Wearer moves silently.'], flavor:'Smoke-grey with silver leaves.' };
const unknown = ItemAdoption.buildPayload({
  item:ITEM, characterKey:'cosmere', characterName:'Cosmere Runestar', inventoryIndex:2,
  identification:'unidentified', publicName:'Embroidered Cloak', publicDescription:'Smoke-grey cloak.',
  trueName:'Cloak of the Last Outrider', rarity:'Rare', rules:'Windstep.', lore:'Woven at the Watch.',
  acquisitionKind:'found', sessionId:'9', locationId:'dark-forest', encounterId:'goblin-battalion', battleMapId:'forest-road', recoverySummary:'Recovered after the ambush.'
});
ok(unknown.p_character_key === 'cosmere' && unknown.p_inventory_index === 2, 'bearer and exact inventory index are preserved');
ok(unknown.p_expected_item.name === ITEM.name && unknown.p_expected_item !== ITEM, 'exact expected row is cloned for stale-state protection');
ok(unknown.p_public.identification === 'unidentified' && !('rarity' in unknown.p_public) && !('mechanics' in unknown.p_public), 'unidentified public payload cannot leak rarity or rules');
ok(unknown.p_secret.trueName === 'Cloak of the Last Outrider' && unknown.p_secret.rarity === 'Rare', 'staff truth stays in the secret payload');
ok(unknown.p_context.sessionId === '9' && unknown.p_context.locationId === 'dark-forest', 'session and location links are retained');
ok(unknown.p_context.encounterId === 'goblin-battalion' && unknown.p_context.battleMapId === 'forest-road', 'encounter and battle-map links are retained');
ok(unknown.p_context.recoverySummary === 'Recovered after the ambush.' && /Cosmere Runestar/.test(unknown.p_context.assignmentSummary), 'both first-history summaries are supplied');
const backstory = ItemAdoption.buildPayload({ item:ITEM, characterKey:'cosmere', characterName:'Cosmere Runestar', inventoryIndex:0, identification:'identified', trueName:'The Hexblade', acquisitionKind:'backstory' });
ok(backstory.p_context.recoverySummary === "The Hexblade entered the campaign as part of Cosmere Runestar's backstory.", 'backstory origin does not pretend the item was recovered during play');
ok(backstory.p_context.assignmentSummary === 'Cosmere Runestar began the campaign carrying The Hexblade.', 'backstory possession does not pretend the party chose the bearer');
const known = ItemAdoption.buildPayload({ item:ITEM, characterKey:'cosmere', inventoryIndex:0, identification:'identified', publicName:'Unknown cloak', trueName:'Cloak of Elvenkind', rarity:'Rare', rules:'Perception checks have disadvantage.' });
ok(known.p_public.displayName === 'Cloak of Elvenkind' && known.p_public.rarity === 'Rare' && known.p_public.mechanics.description.includes('Perception'), 'identified public payload publishes true name, rarity, and rules');
ok(known.p_secret.lore === '' && known.p_item_id === null, 'optional lore is normalized and the server generates identity');

console.log('--- fresh-row lookup + RPC boundary ---');
ok(ItemAdoption.itemByKey([ITEM], 'id:cloak-row').index === 0, 'stable row id resolves to the fresh inventory index');
ok(ItemAdoption.itemByKey([{ name:'Torch' }, ITEM], 'ix:1').item.name === ITEM.name, 'index fallback resolves id-less inventory rows');
ok(ItemAdoption.itemByKey([ITEM], 'id:missing') === null, 'stale render keys fail closed');
let rpcName = null, rpcPayload = null;
const response = await ItemAdoption.adopt({ rpc:async (name, payload) => { rpcName = name; rpcPayload = payload; return { data:{ ok:true, inventoryItem:{ instanceId:'item_cloak' } }, error:null }; } }, { item:ITEM, characterKey:'cosmere', inventoryIndex:0, publicName:'Embroidered Cloak', trueName:'Cloak of the Last Outrider', rarity:'Rare' });
ok(rpcName === 'adopt_inventory_item' && rpcPayload.p_expected_item.id === 'cloak-row', 'client calls the one atomic RPC with the selected row');
ok(response.ok === true && response.inventoryItem.instanceId === 'item_cloak', 'server confirmation passes through to the UI');
let rejected = false;
try { await ItemAdoption.adopt({ rpc:async () => ({ data:null, error:{ message:'Only campaign staff may begin an item history.' } }) }, { item:ITEM, characterKey:'cosmere', inventoryIndex:0, publicName:'Cloak', trueName:'Cloak', rarity:'Rare' }); } catch (error) { rejected = /staff/.test(error.message); }
ok(rejected, 'server refusal is narrated instead of treated as success');

console.log('--- production page wiring ---');
const source = readFileSync(new URL('../../item-adoption.js', import.meta.url), 'utf8');
const sheetHtml = readFileSync(new URL('../../sheet-v2.html', import.meta.url), 'utf8');
ok(/loadCharacter\(options\.characterKey\)/.test(source), 'bridge reloads the current character before choosing the RPC row');
ok(/MutationObserver/.test(source) && /data-item-history-action/.test(source), 'real Gear details receive adoption affordances after every repaint');
ok(/Split this stack to one item before tracking it/.test(source), 'stacked-item refusal explains the required action');
ok(/view\.location\.reload\(\)/.test(source), 'successful adoption reloads before old sheet state can overwrite the RPC result');
ok(/Acquisition origin/.test(source) && /assignmentSummary/.test(source), 'origin step requires an intentional acquisition and authors both history lines');
ok(sheetHtml.includes('item-adoption.js?v=ia3'), 'full sheet loads the promoted cache-stamped adoption module');
ok(/ItemAdoption\.mount\(\{\s*root:\s*root,\s*characterKey:\s*key/.test(sheetHtml), 'full sheet mounts the bridge only after the sheet is ready');

console.log(`\nsmoke-item-adoption-ui: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
