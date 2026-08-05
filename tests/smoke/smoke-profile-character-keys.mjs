// Locks the post-audit character identity seam: memberships accept current live
// character rows, Cosmere is repaired to the audited key, and the retired alias
// remains a read/navigation compatibility door rather than a second character.
import { readFileSync } from 'fs';

const sql = readFileSync(new URL('../../schema_delta_profile_character_keys_open.sql', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../../nav.js', import.meta.url), 'utf8');
const data = readFileSync(new URL('../../character-data.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (name, condition) => { if (condition) pass++; else { fail++; console.log('  FAIL: ' + name); } };

ok('migration opens profiles.character_key', sql.includes('drop constraint if exists profiles_character_key_check'));
ok('membership validates against live character rows', sql.includes('from public.characters c') && sql.includes('c.key = p_character_key'));
ok('membership rejects delete-marked characters', sql.includes('not coalesce(c.delete_marked, false)'));
ok('membership no longer carries the four-key allowlist', !sql.includes("p_character_key not in ('cosmere','caim','liadan','vesperian')"));
ok('migration repairs Cosmere by account email', sql.includes("lower(u.email) = 'ianakira@gmail.com'"));
ok('migration binds the audited current Cosmere key', sql.includes("'cosmererunestar-ae1a'"));
ok('navigation points at current Cosmere and retains the retired alias', nav.includes("key: 'cosmererunestar-ae1a', aliases: ['cosmere']"));
ok('CharacterData retains stable-alias fallback after exact lookup', data.includes("const STABLE_ALIASES = ['cosmere', 'caim', 'liadan', 'vesperian']") && data.includes('if (exact || !STABLE_ALIASES.includes(key))'));

console.log(`\nprofile character keys: ${pass}/${pass + fail} checks pass` + (fail ? ` — ${fail} FAILED` : ' ✓'));
process.exit(fail ? 1 : 0);
