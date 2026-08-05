// Stable character aliases must survive Forge-generated current keys. Exact keys
// always win; a retired alias falls back to the live party row by structural name.
import { readFileSync } from 'fs';

const source = readFileSync(new URL('../../character-data.js', import.meta.url), 'utf8');
const current = {
  key: 'cosmererunestar-ae1a', owner: 'uid-cosmere',
  structural: { name: 'Cosmere Runestar' }, vitals: {}, inventory: [], equipment: {},
  currency: {}, bio: {}, notes: '', updated_at: '2026-08-05T00:00:00Z', delete_marked: false
};
const calls = [];
const sb = {
  from(table) {
    return {
      select() {
        return {
          async eq(column, key) {
            calls.push(['eq', table, column, key]);
            return { data: key === current.key ? [current] : [], error: null };
          },
          async order(column) {
            calls.push(['order', table, column]);
            return { data: [current], error: null };
          }
        };
      }
    };
  }
};
const window = { __tok: { ready: Promise.resolve({ role: 'player' }), sb } };
new Function('window', source)(window);

let pass = 0, fail = 0;
const ok = (name, condition) => { if (condition) pass++; else { fail++; console.log('  FAIL: ' + name); } };

const exact = await window.CharacterData.loadCharacter('cosmererunestar-ae1a');
ok('current exact key resolves directly', exact && exact.key === 'cosmererunestar-ae1a');
ok('current exact key does not scan the party', calls.filter(c => c[0] === 'order').length === 0);

const legacy = await window.CharacterData.loadCharacter('cosmere');
ok('retired Cosmere alias resolves the audited current row', legacy && legacy.key === 'cosmererunestar-ae1a');
ok('alias fallback scans current non-deleted party rows', calls.filter(c => c[0] === 'order').length === 1);

const missing = await window.CharacterData.loadCharacter('not-a-stable-alias');
ok('unknown keys do not guess by name', missing === null);
ok('unknown keys do not scan the party', calls.filter(c => c[0] === 'order').length === 1);

console.log(`\ncharacter-data aliases: ${pass}/${pass + fail} checks pass` + (fail ? ` — ${fail} FAILED` : ' ✓'));
process.exit(fail ? 1 : 0);
