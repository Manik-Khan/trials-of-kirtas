// smoke-shards-forge-gear.mjs
// Verifies the forge's FILL-IF-EMPTY gear predicate headlessly: extracts the real
// gearIsEmpty(inventory, currency) from shards.html (same technique the forge-wiring
// smoke uses for buildStructuralPreview) and checks the "is this character carrying
// nothing yet?" decision that gates whether an UPDATE attaches starting gear.
// "Empty" = no items AND no coin in any denomination; non-array / null inputs are
// treated as empty (defensive). A populated inventory OR any coin blocks the fill.
import { readFileSync } from 'fs';

const html = readFileSync('shards.html', 'utf-8');
const m = html.match(/function gearIsEmpty\(inventory, currency\)\{[\s\S]*?\n\}/);
if (!m) { console.log('could not extract gearIsEmpty'); process.exit(1); }
const gearIsEmpty = (new Function('return (' + m[0] + ')'))();

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + n); };

// ── EMPTY → fill is allowed ──────────────────────────────────────────────────
ok('empty inventory + empty currency',        gearIsEmpty([], {}) === true);
ok('empty inventory + all-zero coin',         gearIsEmpty([], { pp:0, gp:0, ep:0, sp:0, cp:0 }) === true);
ok('non-array inventory treated as empty',    gearIsEmpty(null, {}) === true);
ok('undefined inventory treated as empty',    gearIsEmpty(undefined, {}) === true);
ok('null currency treated as no-coin',        gearIsEmpty([], null) === true);
ok('undefined currency treated as no-coin',   gearIsEmpty([], undefined) === true);
ok('both args missing',                       gearIsEmpty() === true);

// ── NOT EMPTY → fill is blocked (never clobber loot/coin) ─────────────────────
ok('one item blocks fill',                    gearIsEmpty([{ name:'Rapier' }], {}) === false);
ok('any gold blocks fill',                    gearIsEmpty([], { gp:5 }) === false);
ok('a single copper blocks fill',             gearIsEmpty([], { cp:1 }) === false);
ok('platinum blocks fill',                    gearIsEmpty([], { pp:2 }) === false);
ok('electrum blocks fill',                    gearIsEmpty([], { ep:3 }) === false);
ok('silver blocks fill',                      gearIsEmpty([], { sp:7 }) === false);
ok('items AND coin both block',               gearIsEmpty([{ name:'x' }], { gp:5 }) === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
