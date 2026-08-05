// smoke-shards-level-up.mjs — guards the production Level Up route and save seam.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../shards.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (label, condition) => { if (condition) pass++; else { fail++; console.error('FAIL:', label); } };

ok('sheet route is read from URLSearchParams', /params\.get\('mode'\) === 'level-up'/.test(html) && /params\.get\('character'\)/.test(html));
ok('requested class advances exactly one level', /ce\.level = Math\.min\(20, fromClass \+ 1\)/.test(html));
ok('Level 20 is narrated and blocked', /already Level 20/.test(html));
ok('loaded Reforge and Level Up builds pin the existing character target', /Loading a character is the explicit Reforge\/Level Up target selection[\s\S]*if \(draft\._editKey\)\{ mode = 'existing'; existingKey = draft\._editKey; \}/.test(html));
ok('loaded Reforge cannot silently select Create new', /value="new"' \+ \(editing \? ' disabled'/.test(html));
ok('Reforge completion confirms the existing key and retained ID', /Reforge complete[\s\S]*updated [\s\S]* in place \([\s\S]*Character ID and current resources were retained/.test(html));
ok('transient Level Up state is excluded from the saved build snapshot', /k === '_levelUp'\) return/.test(html));
ok('successful Level Up appends the prior Facet', /SoulFacets\.appendFacet\(cur,[\s\S]*Preserved before Level/.test(html));
ok('Facet append happens before the character save', html.indexOf('SoulFacets.appendFacet(cur') < html.indexOf('CharacterData.save(existingKey, patch)'));
ok('successful save clears transient Level Up state', /delete draft\._levelUp;[\s\S]*saveDraft\(\)/.test(html));
ok('completion message names the advanced class and preserved level', /Level Up complete[\s\S]*was preserved in Facets of the Shard/.test(html));
ok('Shard Reforger deep-link is also supported', /params\.get\('reforge'\)/.test(html));

console.log(`\nsmoke-shards-level-up: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
