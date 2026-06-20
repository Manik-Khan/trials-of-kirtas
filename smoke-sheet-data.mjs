// smoke-sheet-data.mjs
// Integrated parity smoke for the FOLDED sheet-data.js: render SAMPLE through the
// public renderSheet() and prove the Spellcasting pane reproduces the v11 hardcoded
// fallback value-by-value. Exercises the real path (renderSheet -> renderSpellcasting
// reading SAMPLE.structural.spellcasting), not just the helper in isolation.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { renderSheet, SAMPLE } from './sheet-data.js';

const html = readFileSync('/home/claude/out/mockup-sheet-visual-direction-v11.html', 'utf-8');
const doc = new JSDOM(html).window.document;   // page scripts are not run

const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const cls  = (el, drop) => [...el.classList].filter(c => c !== drop).join(' ');

function extract(root) {
  const out = [];
  const push = (k, v) => out.push(k + ' = ' + norm(v));
  root.querySelectorAll('[data-list="pools"] .pool').forEach((p, i) => {
    const tone = p.classList.contains('s2') ? 'subclass' : p.classList.contains('dim') ? 'dim' : 'class';
    push(`pool${i}.label`, p.querySelector('.p-lab span').textContent);
    push(`pool${i}.badge`, p.querySelector('.lv').textContent);
    push(`pool${i}.tone`, tone);
    push(`pool${i}.on`, p.querySelectorAll('.slot.on').length);
    push(`pool${i}.empty`, p.querySelectorAll('.slot.empty').length);
    push(`pool${i}.recharge`, p.querySelector('.p-rec').textContent);
  });
  ['castAbility', 'castDC', 'castAtk', 'castType', 'featNote'].forEach(f => {
    const e = root.querySelector(`[data-f="${f}"]`);
    push(f, e ? e.textContent : '(missing)');
  });
  root.querySelectorAll('[data-list="spellGroups"] .spell-group').forEach((g, gi) => {
    push(`group${gi}.heading`, g.querySelector('.sg-h').textContent);
    g.querySelectorAll('.spell').forEach((sp, si) => {
      const tag = sp.querySelector('.s-tag');
      push(`group${gi}.spell${si}.name`, sp.querySelector('.s-n').textContent);
      push(`group${gi}.spell${si}.origin`, cls(sp, 'spell'));
      push(`group${gi}.spell${si}.tag`, tag.textContent);
      push(`group${gi}.spell${si}.tagcls`, cls(tag, 's-tag'));
      push(`group${gi}.spell${si}.time`, sp.querySelector('.s-ct').textContent);
    });
  });
  const d = root.querySelector('[data-list="detail"] .detail');
  if (d) {
    push('detail.name', d.querySelector('.d-n').textContent);
    push('detail.school', d.querySelector('.d-sch').textContent);
    d.querySelectorAll('.d-grid span').forEach((s, i) => push(`detail.grid${i}`, s.textContent));
    push('detail.conc', !!d.querySelector('.d-grid b.conc'));
    push('detail.body', d.querySelector('.d-body').textContent);
    push('detail.higher', d.querySelector('.d-hl').textContent);
  } else { push('detail', '(missing)'); }
  return out;
}

const before = extract(doc);   // hardcoded fallback

// blank the spellcasting hooks, then render the whole sheet from SAMPLE
doc.querySelectorAll('[data-list="pools"],[data-list="spellGroups"],[data-list="detail"]').forEach(e => { e.innerHTML = ''; });
['castAbility', 'castDC', 'castAtk', 'castType', 'featNote'].forEach(f => { const e = doc.querySelector(`[data-f="${f}"]`); if (e) e.textContent = ''; });
renderSheet(doc, SAMPLE);

const after = extract(doc);

let pass = 0, fail = 0;
const n = Math.max(before.length, after.length);
for (let i = 0; i < n; i++) {
  if (before[i] === after[i] && before[i] !== undefined) pass++;
  else { fail++; console.log('  MISMATCH\n    fallback: ' + before[i] + '\n    rendered: ' + after[i]); }
}
console.log(`\nFolded sheet-data.js — Spellcasting parity: ${pass}/${pass + fail} pass` + (fail ? ` — ${fail} FAILED` : ' \u2713'));
process.exit(fail ? 1 : 0);
