// smoke-forge-commit.mjs — validates the Forge persistence wiring without a network:
//   1. soul-shards-derive.js now derives combat.hp / hpMax (inject a mock engine)
//   2. character-data.js create/markDeletion/remove/newKey call the right RPCs
// Run: node smoke-forge-commit.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error('FAIL:', n); } };

// ── 1. HP derivation ─────────────────────────────────────────────────────────
{
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only' });
  const win = dom.window;
  win.eval(fs.readFileSync('soul-shards-derive.js', 'utf8'));

  // a mock engine: one Fighter-shaped build with a known hp.max
  const fakeEngine = { build: (o) => ({
    className: 'Fighter', classSource: 'PHB', level: o.level, hd: 10,
    savingThrows: ['str', 'con'], hp: { max: 44, method: 'average', byLevel: [] },
    features: [{ name: 'Second Wind', origin: 'class:Fighter', entries: ['...'] }],
    asiLevels: [], spellcasting: null, pending: []
  }) };
  const fakeSC = {
    deriveSpellcasting: () => null,
    deriveClasses: (mi) => (mi.classes || []).map((c) => ({ name: c.name, level: c.level }))
  };
  const abilities = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 };

  const r = win.SoulShardsDerive.deriveStructural(
    { name: 'Test', abilities, classes: [{ model: { name: 'Fighter' }, level: 5 }] },
    { engine: fakeEngine, spellcasting: fakeSC }
  );
  ok('derive sets combat.hpMax from build.hp.max', r.structural.combat.hpMax === 44);
  ok('derive sets combat.hp = hpMax (fresh = full)', r.structural.combat.hp === 44);
  ok('single-class drops the generic hp gap', !r._incomplete.some((s) => /combat\.hp\b|hpMax/i.test(s)));
  ok('AC still flagged incomplete', r._incomplete.some((s) => /combat\.ac/i.test(s)));

  const r2 = win.SoulShardsDerive.deriveStructural(
    { name: 'MC', abilities, classes: [{ model: { name: 'Fighter' }, level: 3 }, { model: { name: 'Rogue' }, level: 2 }] },
    { engine: fakeEngine, spellcasting: fakeSC }
  );
  ok('multiclass hpMax sums builds (44+44)', r2.structural.combat.hpMax === 88);
  ok('multiclass adds over-count caveat', r2._incomplete.some((s) => /multiclass HP/i.test(s)));
}

// ── 2. CharacterData write methods ───────────────────────────────────────────
{
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only' });
  const win = dom.window;
  const calls = [];
  win.__tok = {
    ready: Promise.resolve({ userId: 'u1', role: 'player' }),
    sb: { rpc: (name, params) => { calls.push({ name, params }); return Promise.resolve({ data: (params && params.p_key) || 'ok', error: null }); } }
  };
  win.eval(fs.readFileSync('character-data.js', 'utf8'));
  const CD = win.CharacterData;

  ok('newKey = slug + 4 hex', /^thorneblackwood-[0-9a-f]{4}$/.test(CD.newKey('Thorne Blackwood')));
  ok('newKey unique per call', CD.newKey('Thorne Blackwood') !== CD.newKey('Thorne Blackwood'));
  ok('newKey blank → fallback slug', /^character-[0-9a-f]{4}$/.test(CD.newKey('')));

  await CD.create('thorne-1a2b', { structural: { name: 'Thorne' }, vitals: { hp: 44 } });
  const cc = calls.find((c) => c.name === 'create_character');
  ok('create → create_character RPC', !!cc);
  ok('create p_key', cc && cc.params.p_key === 'thorne-1a2b');
  ok('create p_structural', cc && cc.params.p_structural && cc.params.p_structural.name === 'Thorne');
  ok('create p_vitals', cc && cc.params.p_vitals && cc.params.p_vitals.hp === 44);

  await CD.markDeletion('thorne-1a2b', true);
  const mk = calls.filter((c) => c.name === 'mark_character_deletion');
  ok('markDeletion → mark_character_deletion RPC', mk.length === 1);
  ok('mark p_marked true', mk[0] && mk[0].params.p_marked === true);
  await CD.markDeletion('thorne-1a2b', false);
  const mk2 = calls.filter((c) => c.name === 'mark_character_deletion');
  ok('un-mark p_marked false', mk2.length === 2 && mk2[1].params.p_marked === false);

  await CD.remove('thorne-1a2b');
  const rm = calls.find((c) => c.name === 'delete_character');
  ok('remove → delete_character RPC', !!rm);
  ok('remove p_key', rm && rm.params.p_key === 'thorne-1a2b');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
