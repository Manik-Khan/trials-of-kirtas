// smoke-sheet-noncaster.mjs
// Guards the spellcasting-block hygiene: a TRUE non-caster (Champion Fighter, no spell data)
// must read clean — the template's baked-in Cosmere sample (Spell DC 13, +5, Charisma, Known)
// must NOT bleed through, the cast-meta + legend hide, and the list shows a plain empty state.
// The caster case proves the provenance spells (a forged racial caster) still render.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts:'outside-only', pretendToBeVisual:true });
global.window = dom.window; global.document = dom.window.document;
window.eval(readFileSync(new URL('./resource-derive.js', import.meta.url), 'utf8'));
const { mountSheet } = await import('./sheet-mount.js');

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };
const mockCD = (row) => ({ async canEdit(){ return false; }, async loadCharacter(){ return JSON.parse(JSON.stringify(row)); }, async save(){} });

// ── non-caster: Champion Fighter, zero spell data ──
const FIGHTER = {
  key:'grok',
  structural:{
    name:'Grok Ironhide',
    combat:{ ac:18, hpMax:34, initiative:1, speed:30 },     // no spellSaveDC / spellAttackBonus
    abilities:{ str:{score:18,mod:4}, dex:{score:12,mod:1}, con:{score:16,mod:3}, int:{score:8,mod:-1}, wis:{score:12,mod:1}, cha:{score:10,mod:0} },
    proficiencyBonus:2, skills:[], saves:[]
  },
  vitals:{ hp:34 }
};
// ── caster: a forged racial caster's spellcasting block (derive shape) ──
const CASTER = {
  key:'rogue',
  structural:{
    name:'Slither',
    combat:{ ac:14, hpMax:24, spellSaveDC:13, spellAttackBonus:5 },
    abilities:{ str:{score:10,mod:0}, dex:{score:16,mod:3}, con:{score:14,mod:2}, int:{score:11,mod:0}, wis:{score:14,mod:2}, cha:{score:16,mod:3} },
    proficiencyBonus:2, skills:[], saves:[],
    spellcasting:{ ability:'Charisma', saveDC:13, attackBonus:5, prepared:false, pools:[], featNote:'',
      groups:[
        { heading:'Cantrips \u00B7 At Will', spells:[{ name:'Poison Spray', origin:'race', source:'Yuan-Ti' }] },
        { heading:'1st Level',              spells:[{ name:'Animal Friendship', origin:'race', source:'Yuan-Ti' }] }
      ] }
  },
  vitals:{ hp:24 }
};

console.log('\n[non-caster] Champion Fighter must read clean');
{
  const slot = document.createElement('div'); document.body.appendChild(slot);
  mountSheet(slot, 'grok', { characterData: mockCD(FIGHTER) }); await settle();
  const dc  = slot.querySelector('[data-f="spellDC"]');
  const atk = slot.querySelector('[data-f="spellAtk"]');
  ok(dc  && dc.textContent === '\u2014',  'Spell DC tile shows dash, not sample 13');
  ok(atk && atk.textContent === '\u2014', 'Spell Atk tile shows dash, not sample +5');
  const meta = slot.querySelector('.cast-meta'), leg = slot.querySelector('.legend');
  ok(meta && meta.style.display === 'none', 'cast-meta hidden');
  ok(leg  && leg.style.display  === 'none', 'legend hidden');
  const gb = slot.querySelector('[data-list="spellGroups"]');
  ok(gb && /doesn.t cast spells/.test(gb.textContent), 'plain empty state shown');
  ok(gb && !/Charisma|origin colours/.test(gb.textContent), 'no sample/dev-placeholder leak');
}

console.log('[caster] forged racial caster still renders its spells');
{
  const slot = document.createElement('div'); document.body.appendChild(slot);
  mountSheet(slot, 'rogue', { characterData: mockCD(CASTER) }); await settle();
  const dc = slot.querySelector('[data-f="spellDC"]');
  ok(dc && dc.textContent === '13', 'Spell DC tile shows the real 13');
  const meta = slot.querySelector('.cast-meta');
  ok(meta && meta.style.display !== 'none', 'cast-meta visible');
  const ab = slot.querySelector('[data-f="castAbility"]');
  ok(ab && ab.textContent === 'Charisma', 'ability reads Charisma');
  const gb = slot.querySelector('[data-list="spellGroups"]');
  ok(gb && /Poison Spray/.test(gb.textContent) && /Animal Friendship/.test(gb.textContent), 'racial spells render in the list');
}

console.log('\n' + (fail === 0 ? '\u2713 ALL PASS' : '\u2717 ' + fail + ' FAILED') + '  (' + pass + ' passed)');
process.exit(fail === 0 ? 0 : 1);
