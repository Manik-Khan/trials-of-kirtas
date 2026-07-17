// smoke-shards-bgspells.mjs
// Two checks for the background-expanded-spell feature:
//  (1) collectBgExpanded (extracted from shards.html) parses the `expanded` group of a
//      background's additionalSpells into {key, level}, stripping |source and #flag.
//  (2) a LIVE resolution pass confirms the 2014 mirror actually has Dimir's spells at the
//      levels we bucket them to — otherwise the feature would silently show nothing.
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../../shards.html', import.meta.url), 'utf8');
const s = html.indexOf('function collectBgExpanded(bg){');
const e = html.indexOf('\n  }', s) + 4;
const collectBgExpanded = (new Function(html.slice(s, e) + '\n; return collectBgExpanded;'))();

// Dimir Operative's real additionalSpells shape (from GGR / the 2014 mirror)
const dimir = {
  name: 'Dimir Operative', source: 'GGR',
  additionalSpells: [{
    expanded: {
      s0: ['encode thoughts|ggr#c', 'mage hand#c'],
      s1: ['disguise self', 'sleep'],
      s2: ['detect thoughts', 'pass without trace'],
      s3: ['gaseous form', 'meld into stone', 'nondetection'],
      s4: ['arcane eye', 'freedom of movement'],
      s5: ['modify memory']
    }
  }]
};

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };
const got = collectBgExpanded(dimir);
const at = key => got.filter(x => x.key === key).map(x => x.level);

ok('parsed every expanded ref (2+2+2+3+2+1 = 12)', got.length === 12);
ok("strips |source + #c -> 'encode thoughts' at level 0", at('encode thoughts').join() === '0');
ok("'mage hand' bucketed as cantrip (level 0)", at('mage hand').join() === '0');
ok("'disguise self' at level 1", at('disguise self').join() === '1');
ok("'pass without trace' at level 2", at('pass without trace').join() === '2');
ok("'meld into stone' at level 3", at('meld into stone').join() === '3');
ok("'modify memory' at level 5", at('modify memory').join() === '5');
ok('all keys are lowercase', got.every(x => x.key === x.key.toLowerCase()));
ok('missing background -> []', collectBgExpanded(null).length === 0);
ok('background with no additionalSpells -> []', collectBgExpanded({ name: 'Acolyte' }).length === 0);

console.log(`\ncollectBgExpanded: ${pass}/${pass + fail} checks pass` + (fail ? ` — ${fail} FAILED` : ' \u2713'));

// ── (2) live resolution against the real data ──
const probe = (async () => {
  const win = {};
  const mod = { exports: {} };
  new Function('module', 'exports', 'window', readFileSync(new URL('../../soul-shards-data.js', import.meta.url), 'utf8'))(mod, mod.exports, win);
  const D = mod.exports;
  if (typeof D.loadSpellMeta !== 'function') { console.log('\n(live) loadSpellMeta unavailable — skipping'); return; }
  try {
    const metas = await D.loadSpellMeta(['encode thoughts', 'mage hand', 'pass without trace', 'meld into stone'], { detail: true });
    const by = {}; (metas || []).forEach(m => { by[m.name.toLowerCase()] = m; });
    const show = (k, expLvl) => {
      const m = by[k];
      const okk = m && m.level === expLvl;
      console.log(`  ${okk ? 'ok  ' : 'MISS'} ${k} -> ${m ? ('"' + m.name + '" L' + m.level) : 'NOT FOUND'} (expect L${expLvl})`);
    };
    console.log('\n(live) Dimir spells resolved from the 2014 mirror:');
    show('encode thoughts', 0);
    show('mage hand', 0);
    show('pass without trace', 2);
    show('meld into stone', 3);
  } catch (err) {
    console.log('\n(live) resolution skipped — ' + (err && err.message));
  }
})();

probe.finally(() => process.exit(fail ? 1 : 0));
