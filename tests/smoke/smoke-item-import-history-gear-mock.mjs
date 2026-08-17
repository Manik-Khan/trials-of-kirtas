// Dependency-free contract for the approved-next import-with-history and closed Gear mock.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../_edits/mock-item-import-history-gear.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function ok(condition, name) { if (condition) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }

ok(/^<!doctype html>/i.test(html), 'mock is a standalone HTML document');
ok(!/(?:src|href)=["'](?:https?:|\.\.\/)/i.test(html), 'mock has no external runtime dependencies');
ok(/No dependencies · no database calls · nothing is saved/.test(html), 'mock clearly labels its non-persistent boundary');
ok(/Skyblinder Staff/.test(html) && /Uncommon/.test(html), 'field-tested imported item is the specimen');
ok(/Add ordinary item/.test(html), 'ordinary import remains available');
ok(/Import with history/.test(html), 'deliberate tracked import is a distinct staff action');
ok(/Unidentified is the safe default/.test(html), 'tracked import defaults to unidentified');
ok(/Public name/.test(html) && /Runed Quarterstaff/.test(html), 'unidentified public identity differs from true name');
ok(/Visible description/.test(html) && /finely balanced quarterstaff/.test(html), 'party-visible physical description is required and previewed');
ok(/Staff-only truth · prefilled from compendium/.test(html), 'compendium truth stays explicitly staff-only');
ok(/True name/.test(html) && /True rarity/.test(html) && /Rules revealed on identification/.test(html), 'secret import projection carries name rarity and rules');
ok(/One confirmed operation/.test(html) && /If any part fails, nothing is added/.test(html), 'review narrates atomic creation');
ok(/true name cannot flash onto the character’s inventory/.test(html), 'pre-import state explicitly prevents a true-name leak');
ok(/gear-item tracked/.test(html), 'mock renders a tracked closed Gear row');
ok(/row-chip smoky/.test(html) && /Unidentified/.test(html), 'unidentified closed row has written smoky state');
ok(/◇ History/.test(html) && /Permanent item history/.test(html), 'closed row has a non-color permanent-history marker');
ok(/Rarity unrevealed|rarity and mechanics unrevealed/i.test(html), 'unidentified row withholds rarity');
ok(/gear-item\.tracked\.identified/.test(html) && /--green:#68b878/.test(html), 'identified tracked row receives the Uncommon green treatment');
ok(/row-chip uncommon/.test(html), 'identified row names rarity in addition to color');
ok(/detail-label[^<]*>Description|detail-label\">Description/.test(html), 'expanded Gear includes a Description section');
ok(/Known properties/.test(html) && /\+1 bonus to attack and damage/.test(html), 'identification restores known properties into Gear');
ok(/Properties unrevealed/.test(html), 'unidentified expanded detail narrates hidden properties');
ok(/Open permanent record/.test(html), 'expanded detail still opens permanent history');
ok(/Identify item/.test(html), 'staff can exercise the reveal from the tracked Gear detail');
ok(/data-preview="search"/.test(html) && /data-preview="unidentified"/.test(html) && /data-preview="identified"/.test(html), 'review controls expose before unidentified and identified states');
ok(/min-height:var\(--touch\)/.test(html) && /--touch:48px/.test(html), 'primary controls retain 48px touch targets');
ok(/@media\(max-width:620px\)/.test(html) && /max-height:92dvh/.test(html), 'mobile becomes a touch-safe bottom sheet');
ok(/prefers-reduced-motion:reduce/.test(html), 'reduced motion is respected');
ok(!/Chronicle|Party['’]s Path|World-map|quest|evolving-item/i.test(html), 'mock stays firmly inside the item workflow');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
ok(scripts.length === 1, 'mock carries one self-contained interaction script');
try { new Function(scripts[0]); ok(true, 'inline interaction script parses'); } catch (error) { console.log(error); ok(false, 'inline interaction script parses'); }

console.log(`\nsmoke-item-import-history-gear-mock: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
