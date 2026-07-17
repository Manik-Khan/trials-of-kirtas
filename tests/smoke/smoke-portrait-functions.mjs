// smoke-portrait-functions.mjs — validates the pure helpers in portrait-upload-sign.js
import { createHash } from 'crypto';
import pkg from '/mnt/user-data/outputs/netlify/functions/portrait-upload-sign.js';
const { sign, sanitizeName, parseUploaders } = pkg._test;

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const sha1 = (s) => createHash('sha1').update(s).digest('hex');

// ── signature construction ──
// params must be sorted alphabetically and joined k=v&k=v, then secret appended, sha1 hex
const SECRET = 'topsecret';
const sig = sign({ timestamp: 1311, public_id: 'vesperian', folder: 'kirtas/portraits' }, SECRET);
const expected = sha1('folder=kirtas/portraits&public_id=vesperian&timestamp=1311' + SECRET);
ok('signature matches the canonical sorted to-sign string', sig === expected, { sig, expected });
ok('signature is 40-char sha1 hex', /^[0-9a-f]{40}$/.test(sig), sig);

// order of keys in the input must not matter (it sorts)
const sig2 = sign({ folder: 'kirtas/portraits', timestamp: 1311, public_id: 'vesperian' }, SECRET);
ok('key order in input does not change the signature', sig === sig2);

// empty / undefined params are dropped before signing
const sigA = sign({ folder: 'kirtas/portraits', public_id: 'x', timestamp: 5, eager: '' }, SECRET);
const sigB = sign({ folder: 'kirtas/portraits', public_id: 'x', timestamp: 5 }, SECRET);
ok('empty params are excluded from the signature', sigA === sigB);

// a different secret produces a different signature
ok('signature depends on the secret', sign({ public_id: 'x', timestamp: 1 }, 'a') !== sign({ public_id: 'x', timestamp: 1 }, 'b'));

// ── filename sanitisation ──
ok('strips extension + lowercases', sanitizeName('Vesperian.PNG') === 'vesperian', sanitizeName('Vesperian.PNG'));
ok('spaces/odd chars become dashes', sanitizeName('My Cool Portrait!!.jpg') === 'my-cool-portrait', sanitizeName('My Cool Portrait!!.jpg'));
ok('trims leading/trailing dashes', sanitizeName('  --weird--.webp ') === 'weird', JSON.stringify(sanitizeName('  --weird--.webp ')));
ok('blank name falls back to a generated id', /^portrait-\d+$/.test(sanitizeName('')), sanitizeName(''));
ok('no path traversal survives', sanitizeName('../../etc/passwd') === 'etc-passwd', sanitizeName('../../etc/passwd'));
ok('caps absurd length at 60 chars', sanitizeName('a'.repeat(200)).length === 60);

// ── uploader allow-list parsing ──
ok('parses + lowercases + trims emails', JSON.stringify(parseUploaders(' A@x.com , B@Y.com ')) === JSON.stringify(['a@x.com', 'b@y.com']));
ok('empty env yields empty list', parseUploaders('').length === 0 && parseUploaders(undefined).length === 0);
ok('drops empty segments', JSON.stringify(parseUploaders('a@x.com,,b@x.com,')) === JSON.stringify(['a@x.com', 'b@x.com']));

console.log('\nsmoke-portrait-functions: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
