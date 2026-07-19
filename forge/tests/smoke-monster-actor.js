const M=require('../../monster-actor.js');
let n=0,fail=0;
function ok(cond,label){n++;if(cond)console.log('ok '+n+' - '+label);else{fail++;console.error('not ok '+n+' - '+label);}}

const statblock={
  name:'Arcane Archer',size:['M'],type:{type:'humanoid',tags:['elf']},alignment:['N','G'],dex:18,
  ac:[16],hp:{average:16},speed:{walk:30},senses:['darkvision 60 ft.','passive Perception 13'],languages:['Common','Elvish'],
  skill:{perception:'+3',stealth:'+6'},
  trait:[{name:'Fey Ancestry',entries:['The archer has advantage on saves against being charmed.']}],
  action:[
    {name:'Shortsword',entries:['{@atk mw} {@hit 6} to hit, reach 5 ft., one target. {@h} 7 ({@damage 1d6 + 4}) piercing damage.']},
    {name:'Longbow',entries:['{@atk rw} {@hit 6} to hit, range 150/600 ft., one target. {@h} 8 ({@damage 1d8 + 4}) piercing damage.']},
    {name:'Multiattack',entries:['The archer makes two attacks.']}
  ],
  bonus:[{name:'Cunning Action',entries:['The archer takes the Dash, Disengage, or Hide action.']}],
  reaction:[{name:'Parry',entries:['The archer adds 2 to its AC against one melee attack.']}],
  spellcasting:[{name:'Innate Spellcasting',headerEntries:['Charisma is the archer’s spellcasting ability.'],will:['{@spell mage hand}'],daily:{'1':['{@spell misty step}']}}],
  fluff:{entries:['Patient sentries who favor high ground and warning shots.']}
};

const actor=M.toCharacter({id:'archer-1',name:'Archer 1',statblock});
ok(M.VERSION==='2.0.0','adapter version is pinned');
ok(actor.actions.filter(a=>a.type==='attack').length===2,'every parsed weapon attack survives the adapter');
ok(actor.actions.some(a=>a.label==='Longbow'&&/range 150\/600 ft/i.test(a.note)),'Longbow keeps both range bands');
ok(actor.reference.profile.some(x=>x.label==='Lore & behavior'&&/high ground/.test(x.desc)),'bestiary lore becomes DM-readable reference');
ok(actor.reference.traits.some(x=>x.label==='Fey Ancestry'),'racial and monster traits remain available');
ok(actor.reference.bonusActions.some(x=>x.label==='Cunning Action'),'bonus actions remain available');
ok(actor.reference.reactions.some(x=>x.label==='Parry'),'reactions remain available');
ok(actor.reference.spells.some(x=>x.label==='mage hand'&&x.usage==='At will'),'at-will spell list is normalized');
ok(actor.reference.spells.some(x=>x.label==='misty step'&&x.usage==='1/day'),'daily spell list is normalized');
ok(actor.combat.ac===16&&actor.combat.speed===30&&actor.combat.initiative===4,'combat vitals still use the real stat block');

if(fail){console.error('\n'+fail+' monster-actor checks failed');process.exit(1);}
console.log('\n'+n+' monster-actor checks green');
