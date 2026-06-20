// sheet-data.js
// ---------------------------------------------------------------------------
// Renders the at-a-glance character sheet (mockup-sheet-visual-direction) from
// a live `characters` row. Reads the documented `structural` + `vitals` shapes.
//
//   import { mountSheet } from './sheet-data.js';
//   await mountSheet('cosmere');           // fills every [data-f] / [data-list]
//
// mountSheet() pulls the row via window.CharacterData.loadCharacter(key) (the
// existing client module, on window.__tok.sb) and hands it to renderSheet().
// renderSheet(root, char) is also exported for direct use / tests.
//
// WIRED: identity, combat medallions, HP bar (vitals), abilities, saves,
// skills, senses, status, features, spellcasting (slot pools + spell lists).
// STILL STATIC (next pass): Resources trackers (no structural source yet),
// Equipment + Attunement (GEAR).
// ---------------------------------------------------------------------------

function esc(x){ return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sgn(n){ n=Number(n)||0; return (n>=0?'+':'\u2212')+Math.abs(n); }
function clamp(n){ return Math.max(0,Math.min(100,n)); }
function parseSource(src){
  src=String(src||''); var i=src.indexOf(':');
  var type=i>=0?src.slice(0,i):'class', label=i>=0?src.slice(i+1):src;
  var map={ "class":"t-class", subclass:"t-sub", race:"t-race", feat:"t-feat" };
  return { cls: map[type]||'t-class', label: label };
}
function renderSubline(root, s){
  var box=root.querySelector('[data-list="subline"]'); if(!box) return;
  var parts=[], classes=s.classes||(s.classLabel?[{name:s.classLabel,level:'',subclass:s.subclass}]:[]);
  classes.forEach(function(c){
    var sub=c.subclass?(' <span class="sub">\u00B7 '+esc(c.subclass)+'</span>'):'';
    parts.push('<span><b>'+esc(c.name)+'</b> '+(c.level!=null?c.level:'')+sub+'</span>');
  });
  if(s.race) parts.push('<span>'+esc(s.race)+'</span>');
  if(s.level!=null) parts.push('<span><b>Level '+s.level+'</b></span>');
  if(s.alignment) parts.push('<span>'+esc(s.alignment)+'</span>');
  box.innerHTML=parts.join('<span class="dot">\u2726</span>');
}
function renderAbilities(root, ab){
  var box=root.querySelector('[data-list="abilities"]'); if(!box) return;
  var order=[['str','Str'],['dex','Dex'],['con','Con'],['int','Int'],['wis','Wis'],['cha','Cha']];
  box.innerHTML=order.map(function(o){
    var a=ab[o[0]]||{}, mod=a.mod||0;
    return '<div class="abil'+(mod<0?' neg':'')+'"><div class="nm">'+o[1]+'</div><div class="sc">'+(a.score!=null?a.score:'')+'</div><div class="md">'+sgn(mod)+'</div></div>';
  }).join('');
}
function renderSaves(root, s){
  var box=root.querySelector('[data-list="saves"]'); if(!box) return;
  var sv=s.saves||{}, order=[['str','Str'],['dex','Dex'],['con','Con'],['int','Int'],['wis','Wis'],['cha','Cha']];
  box.innerHTML=order.map(function(o){
    var x=sv[o[0]]||{};
    return '<div class="save'+(x.proficient?' prof':'')+'"><span class="dotp"></span><span class="sv-n">'+o[1]+'</span><span class="sv-v">'+sgn(x.bonus||0)+'</span></div>';
  }).join('');
}
function renderSkills(root, skills){
  var box=root.querySelector('[data-list="skills"]'); if(!box) return;
  box.innerHTML=(skills||[]).map(function(sk){
    var attr=sk.attr?(sk.attr.charAt(0).toUpperCase()+sk.attr.slice(1)):'';
    return '<div class="skill'+(sk.prof?' prof':'')+'"><span class="dotp"></span><span class="sk-n">'+esc(sk.name)+'</span><span class="sk-a">'+esc(attr)+'</span><span class="sk-v">'+sgn(sk.bonus||0)+'</span></div>';
  }).join('');
}
function renderFeatures(root, feats){
  var box=root.querySelector('[data-list="features"]'); if(!box) return;
  box.innerHTML=(feats||[]).map(function(fobj){
    var p=parseSource(fobj.source);
    return '<div class="feat"><span class="f-tag '+p.cls+'">'+esc(p.label)+'</span><div><div class="f-n">'+esc(fobj.name)+'</div><div class="f-d">'+esc(fobj.desc)+'</div></div></div>';
  }).join('');
}
function setStatus(root, v){
  var conc=root.querySelector('[data-f="concentration"]');
  if(conc){ if(v.concentration){ conc.textContent=v.concentration; conc.className='conc-on'; } else { conc.textContent='none'; conc.className='muted'; } }
  var cond=root.querySelector('[data-f="conditions"]');
  if(cond){ var l=v.conditions; if(Array.isArray(l)&&l.length){ cond.textContent=l.join(' \u00B7 '); cond.className=''; } else { cond.textContent='none active'; cond.className='muted'; } }
  var insp=root.querySelector('[data-f="inspiration"]');
  if(insp){ insp.style.background = v.inspiration ? 'var(--gold-br)' : ''; }
}
// --- Spellcasting block. Reads structural.spellcasting; classes[] is read by
//     renderSubline() above. Shape (what Soul Shards P6/P7 emits on structural):
//   structural.spellcasting = {
//     ability, saveDC, attackBonus, prepared,        // prepared:false -> "Known"
//     pools:[{ label, badge, tone:'class'|'subclass'|'dim', current, max, recharge }],
//     groups:[{ heading, spells:[{ name, origin:'class'|'subclass'|'race'|'feat'|'expanded', source, time }] }],
//     featNote, detail:{ name,school,cast,range,components,duration,concentration,body,higher }|null
//   }
function poolHTML(p){
  p=p||{};
  var toneCls = p.tone==='subclass'?' s2':(p.tone==='dim'?' dim':'');
  var max=p.max||0, cur=p.current||0, slots='';
  for(var i=0;i<max;i++){
    slots += (i<cur)
      ? '<span class="slot'+(p.tone==='subclass'?' teal':'')+' on"></span>'
      : '<span class="slot empty"></span>';
  }
  return '<div class="pool'+toneCls+'"><div class="p-lab"><span>'+esc(p.label)+'</span>'
       + '<span class="lv">'+esc(p.badge)+'</span></div>'
       + '<div class="slots">'+slots+'</div>'
       + '<div class="p-rec">'+esc(p.recharge)+'</div></div>';
}
function spellHTML(sp){
  sp=sp||{};
  var oMap={ "class":"o-class", subclass:"o-sub", race:"o-race", feat:"o-feat", expanded:"o-sub" };
  var tMap={ "class":"t-class", subclass:"t-sub", race:"t-race", feat:"t-feat", expanded:"t-exp" };
  var o=sp.origin||'class';
  return '<div class="spell '+(oMap[o]||'o-class')+'"><span class="s-n">'+esc(sp.name)+'</span>'
       + '<span class="s-tag '+(tMap[o]||'t-class')+'">'+esc(sp.source)+'</span>'
       + '<span class="s-ct">'+esc(sp.time)+'</span></div>';
}
function groupHTML(g){
  g=g||{};
  return '<div class="spell-group"><div class="sg-h">'+esc(g.heading)+'</div>'
       + '<div class="spell-cols">'+(g.spells||[]).map(spellHTML).join('')+'</div></div>';
}
function detailHTML(d){
  if(!d) return '';
  var dur = d.concentration ? '<b class="conc">'+esc(d.duration)+'</b>' : '<b>'+esc(d.duration)+'</b>';
  return '<div class="detail">'
       + '<div class="d-h"><span class="d-n">'+esc(d.name)+'</span><span class="d-sch">'+esc(d.school)+'</span></div>'
       + '<div class="d-grid"><span>Cast <b>'+esc(d.cast)+'</b></span><span>Range <b>'+esc(d.range)+'</b></span>'
       + '<span>Components <b>'+esc(d.components)+'</b></span><span>Duration '+dur+'</span></div>'
       + '<p class="d-body">'+esc(d.body)+'</p>'
       + '<p class="d-hl"><b>At higher levels</b> \u2014 '+esc(d.higher)+'</p></div>';
}
function renderSpellcasting(root, sc){
  sc=sc||{};
  function setF(fld,val){ if(val===undefined||val===null) return; var e=root.querySelector('[data-f="'+fld+'"]'); if(e) e.textContent=val; }
  var ph=root.querySelector('[data-list="pools"]');       if(ph) ph.innerHTML=(sc.pools||[]).map(poolHTML).join('');
  setF('castAbility', sc.ability);
  setF('castDC', sc.saveDC);
  setF('castAtk', sc.attackBonus!=null?sgn(sc.attackBonus):null);
  setF('castType', sc.prepared===true?'Prepared':(sc.prepared===false?'Known':sc.castType));
  setF('featNote', sc.featNote);
  var gb=root.querySelector('[data-list="spellGroups"]');  if(gb) gb.innerHTML=(sc.groups||[]).map(groupHTML).join('');
  var db=root.querySelector('[data-list="detail"]');       if(db) db.innerHTML=detailHTML(sc.detail);
}

function renderSheet(root, char){
  root=root||document; char=char||{};
  var s=char.structural||{}, v=char.vitals||{}, cb=s.combat||{}, ab=s.abilities||{};
  function setF(fld,val){ if(val===undefined||val===null) return; var e=root.querySelector('[data-f="'+fld+'"]'); if(e) e.textContent=val; }
  function styleF(fld,p,val){ var e=root.querySelector('[data-f="'+fld+'"]'); if(e) e.style[p]=val; }
  var nm=root.querySelector('[data-f="name"]');
  if(nm&&s.name){ var ps=String(s.name).trim().split(/\s+/); if(ps.length>1){ var last=ps.pop(); nm.innerHTML=esc(ps.join(' '))+' <em>'+esc(last)+'</em>'; } else nm.textContent=s.name; }
  renderSubline(root, s);
  setF('ac', cb.ac);
  if(cb.acSource!=null) setF('ac-sub', cb.acSource);
  setF('initiative', sgn(cb.initiative));
  setF('speed', cb.speed);
  setF('prof', sgn(s.proficiencyBonus));
  setF('spellDC', cb.spellSaveDC);
  setF('spellAtk', sgn(cb.spellAttackBonus));
  if(cb.hitDice!=null) setF('hitDice', cb.hitDice);
  var hp=(v.hp!=null?v.hp:cb.hp), hpMax=(cb.hpMax!=null?cb.hpMax:cb.hp), temp=(v.hpTemp!=null?v.hpTemp:0), bonus=(v.hpBonus!=null?v.hpBonus:0), effMax=(hpMax||0)+(bonus||0);
  setF('hp', hp); setF('hpMaxBig', '/ '+hpMax); setF('hpCurrent', 'Current '+hp+' / '+hpMax);
  setF('hpTemp', temp>0?('+'+temp+' Temp'):'');
  if(effMax>0){ styleF('hpfill','width',clamp(hp/effMax*100)+'%'); styleF('hptemp','width',clamp(temp/effMax*100)+'%'); }
  var senses=cb.senses||s.senses||{};
  setF('darkvision', senses.darkvision?(senses.darkvision+' ft'):'\u2014');
  setF('passivePerception', s.passivePerception);
  setF('passiveInsight', s.passiveInsight);
  var langs=(s.proficiencies&&s.proficiencies.languages)||s.languages;
  if(langs!=null) setF('languages', Array.isArray(langs)?langs.join(' \u00B7 '):langs);
  setStatus(root, v);
  var notes=(char.notes!=null?char.notes:s.notes);
  if(notes!=null) setF('notes', notes);
  renderAbilities(root, ab); renderSaves(root, s); renderSkills(root, s.skills); renderFeatures(root, s.features);
  renderSpellcasting(root, s.spellcasting||{});
}
var SAMPLE={
  structural:{
    name:'Cosmere Runestar',
    classes:[{name:'Warlock',level:2,subclass:'The Hexblade'},{name:'Sorcerer',level:1,subclass:'Shadow Magic'}],
    classLabel:'Warlock 2 / Sorcerer 1', subclass:'The Hexblade / Shadow Magic',
    race:'Astral Elf', level:3, alignment:'Neutral Good',
    proficiencyBonus:2, passivePerception:13, passiveInsight:13,
    abilities:{ str:{score:8,mod:-1}, dex:{score:14,mod:2}, con:{score:14,mod:2}, int:{score:10,mod:0}, wis:{score:12,mod:1}, cha:{score:17,mod:3} },
    combat:{ ac:14, acSource:'studded leather', initiative:2, hpMax:23, speed:30, hitDice:'2d8 + 1d6', spellSaveDC:13, spellAttackBonus:5, senses:{darkvision:60} },
    saves:{ str:{bonus:-1,proficient:false}, dex:{bonus:2,proficient:false}, con:{bonus:2,proficient:false}, int:{bonus:0,proficient:false}, wis:{bonus:3,proficient:true}, cha:{bonus:5,proficient:true} },
    skills:[ {name:'Acrobatics',attr:'dex',bonus:2,prof:false},{name:'Animal Handling',attr:'wis',bonus:1,prof:false},{name:'Arcana',attr:'int',bonus:2,prof:true},{name:'Athletics',attr:'str',bonus:-1,prof:false},{name:'Deception',attr:'cha',bonus:5,prof:true},{name:'History',attr:'int',bonus:0,prof:false},{name:'Insight',attr:'wis',bonus:3,prof:true},{name:'Intimidation',attr:'cha',bonus:5,prof:true},{name:'Investigation',attr:'int',bonus:0,prof:false},{name:'Medicine',attr:'wis',bonus:1,prof:false},{name:'Nature',attr:'int',bonus:0,prof:false},{name:'Perception',attr:'wis',bonus:3,prof:true},{name:'Performance',attr:'cha',bonus:3,prof:false},{name:'Persuasion',attr:'cha',bonus:5,prof:true},{name:'Religion',attr:'int',bonus:0,prof:false},{name:'Sleight of Hand',attr:'dex',bonus:2,prof:false},{name:'Stealth',attr:'dex',bonus:2,prof:false},{name:'Survival',attr:'wis',bonus:1,prof:false} ],
    proficiencies:{ languages:['Common','Elvish','Infernal'] },
    features:[ {name:'Pact Magic',source:'class:Warlock',desc:'Spells fueled by short-rest pact slots, all cast at their highest level.'},{name:'Hex Warrior',source:'subclass:Hexblade',desc:'Use Charisma for attack and damage with a bonded weapon.'},{name:"Hexblade's Curse",source:'subclass:Hexblade',desc:'Mark a foe for bonus damage and crit on a 19\u201320.'},{name:'Eldritch Invocations',source:'class:Warlock',desc:"Agonizing Blast \u00B7 Devil's Sight."},{name:'Shadow Magic Origin',source:'class:Sorcerer',desc:'Your soul carries a fragment of the Shadowfell.'},{name:'Strength of the Grave',source:'subclass:Shadow',desc:'Drop to 1 HP instead of 0 on a Charisma save.'},{name:'Darkvision 60 ft',source:'race:Astral Elf',desc:'See in dim light and darkness.'},{name:'Fey Ancestry',source:'race:Astral Elf',desc:'Advantage against charm; immune to magical sleep.'},{name:'Starlight Step',source:'race:Astral Elf',desc:'Teleport 30 ft as a bonus action, prof. uses per long rest.'} ],
    spellcasting:{
      ability:'Charisma', saveDC:13, attackBonus:5, prepared:false,
      pools:[
        { label:'Pact Magic',     badge:'Lvl 1', tone:'class',    current:2, max:2, recharge:'2 slots \u00B7 short rest' },
        { label:'Sorcerer Slots', badge:'Lvl 1', tone:'subclass', current:2, max:2, recharge:'2 slots \u00B7 long rest' },
        { label:'Sorcery Points', badge:'0',     tone:'dim',      current:0, max:1, recharge:'unlocks at Sorcerer 2' }
      ],
      featNote:'\u2014 no feat spells at this level',
      groups:[
        { heading:'Cantrips \u00B7 At Will', spells:[
          { name:'Eldritch Blast',   origin:'class', source:'Warlock',     time:'1 action' },
          { name:'Booming Blade',    origin:'class', source:'Sorcerer',    time:'1 action' },
          { name:'Minor Illusion',   origin:'class', source:'Sorcerer',    time:'1 action' },
          { name:'Prestidigitation', origin:'class', source:'Sorcerer',    time:'1 action' },
          { name:'Light',            origin:'race',  source:'Astral Fire', time:'1 action' }
        ]},
        { heading:'1st Level', spells:[
          { name:'Hex',              origin:'class',    source:'Warlock',  time:'1 bonus' },
          { name:'Armor of Agathys', origin:'class',    source:'Warlock',  time:'1 action' },
          { name:'Shield',           origin:'expanded', source:'Expanded', time:'1 reaction' },
          { name:'Chromatic Orb',    origin:'class',    source:'Sorcerer', time:'1 action' },
          { name:'Charm Person',     origin:'class',    source:'Sorcerer', time:'1 action' }
        ]}
      ],
      detail:{
        name:'Hex', school:'1st-level enchantment \u00B7 Warlock',
        cast:'1 Bonus Action', range:'90 ft', components:'V, S, M',
        duration:'Concentration, 1 hr', concentration:true,
        body:'Lay a curse on a creature you can see within range. Your attacks deal an extra 1d6 necrotic damage to it, and it has disadvantage on ability checks made with one ability score of your choice.',
        higher:'a 3rd-level slot holds the curse up to 8 hours; 5th level, up to 24 hours.'
      }
    }
  },
  vitals:{ hp:18, hpTemp:4, hpBonus:0, concentration:'Hex', conditions:[], inspiration:false },
  notes:'Patron stirs near the rift \u2014 ask Vesperian about the star-iron blade. Owe Caim a favour.'
};

export async function mountSheet(key, root){
  root = root || (typeof document !== 'undefined' ? document : null);
  if (!root || typeof window === 'undefined' || !window.CharacterData) return null;
  try {
    const c = await window.CharacterData.loadCharacter(key);
    if (c) renderSheet(root, c);
    return c;
  } catch (e) {
    console.error('mountSheet: could not load', key, e);
    return null;
  }
}
export { renderSheet, SAMPLE };
