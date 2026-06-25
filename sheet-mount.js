// sheet-mount.js
// ---------------------------------------------------------------------------
// Shared mount for the at-a-glance sheet (the v11 / Metaphor sheet).
// Holds the sheet's body-markup template + the whole render layer (lifted
// verbatim from sheet-v2.html's inline boot — already root-scoped) and exposes
// mountSheet(container, key), so the sheet can render into ANY node: its own
// page (sheet-v2.html, a thin caller) or floated over another (combat.html).
//
// applyExtras + showError are now root-scoped (were the only two document-bound
// fns). Inspiration is wired by mountSheet, scoped to the container, via
// sheet-actions.js's wireInspiration — which is why sheet-actions.js no longer
// self-boots (mountSheet owns that lifecycle; double-binding would double-write).
//
// Pure under Node for the smoke: mountSheet takes its CharacterData (defaults to
// window.CharacterData) and never auto-runs.
// ---------------------------------------------------------------------------

import { wireInspiration } from './sheet-actions.js';

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
var FULLABIL={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
function renderAbilities(root, ab){
  var box=root.querySelector('[data-list="abilities"]'); if(!box) return;
  var order=[['str','Str'],['dex','Dex'],['con','Con'],['int','Int'],['wis','Wis'],['cha','Cha']];
  box.innerHTML=order.map(function(o){
    var a=ab[o[0]]||{}, mod=a.mod||0;
    return '<div class="abil'+(mod<0?' neg':'')+'" data-chk="ability" data-chk-label="'+FULLABIL[o[0]]+'" data-chk-mod="'+mod+'" tabindex="0" role="button"><div class="nm">'+o[1]+'</div><div class="sc">'+(a.score!=null?a.score:'')+'</div><div class="md">'+sgn(mod)+'</div></div>';
  }).join('');
}
function renderSaves(root, s){
  var box=root.querySelector('[data-list="saves"]'); if(!box) return;
  var sv=s.saves||{}, order=[['str','Str'],['dex','Dex'],['con','Con'],['int','Int'],['wis','Wis'],['cha','Cha']];
  box.innerHTML=order.map(function(o){
    var x=sv[o[0]]||{};
    return '<div class="save'+(x.proficient?' prof':'')+'" data-chk="save" data-chk-label="'+FULLABIL[o[0]]+' Save" data-chk-mod="'+(x.bonus||0)+'" tabindex="0" role="button"><span class="dotp"></span><span class="sv-n">'+o[1]+'</span><span class="sv-v">'+sgn(x.bonus||0)+'</span></div>';
  }).join('');
}
function renderSkills(root, skills){
  var box=root.querySelector('[data-list="skills"]'); if(!box) return;
  box.innerHTML=(skills||[]).map(function(sk){
    var attr=sk.attr?(sk.attr.charAt(0).toUpperCase()+sk.attr.slice(1)):'';
    return '<div class="skill'+(sk.prof?' prof':'')+'" data-chk="skill" data-chk-label="'+esc(sk.name)+'" data-chk-mod="'+(sk.bonus||0)+'" tabindex="0" role="button"><span class="dotp"></span><span class="sk-n">'+esc(sk.name)+'</span><span class="sk-a">'+esc(attr)+'</span><span class="sk-v">'+sgn(sk.bonus||0)+'</span></div>';
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
  var cond=root.querySelector('[data-f="conditions"]');
  if(cond){ var l=v.conditions; if(Array.isArray(l)&&l.length){ cond.textContent=l.join(' \u00B7 '); cond.classList.remove('muted'); } else { cond.textContent='none active'; cond.classList.add('muted'); } }
  var insp=root.querySelector('[data-f="inspiration"]');
  if(insp){ insp.style.background = v.inspiration ? 'var(--gold-br)' : ''; }
}
function poolHTML(p){
  p=p||{};
  var toneCls = p.tone==='subclass'?' s2':(p.tone==='dim'?' dim':'');
  var max=p.max||0, cur=p.current||0, key=esc(p.key||''), slots='';
  for(var i=0;i<max;i++){
    slots += (i<cur)
      ? '<span class="slot'+(p.tone==='subclass'?' teal':'')+' on" data-slot="'+key+'" data-i="'+i+'"></span>'
      : '<span class="slot empty" data-slot="'+key+'" data-i="'+i+'"></span>';
  }
  return '<div class="pool'+toneCls+'"><div class="p-lab"><span>'+esc(p.label)+'</span>'
       + '<span class="lv">'+esc(p.badge)+'</span></div>'
       + '<div class="slots">'+slots+'</div>'
       + '<div class="p-rec">'+esc(p.recharge)+'</div></div>';
}
// Casting time can arrive as a clean string OR the raw 5etools structure
// ([{number,unit}]) for spells resolved off the class list (racial grants). Format
// either; never serialize an object into the row (that printed "[object Object]").
function fmtCt(t){
  if(!t) return '';
  if(typeof t==='string') return t;
  if(Array.isArray(t)&&t[0]){ var x=t[0]; var u=x.unit==='bonus'?'bonus action':x.unit; return (x.number!=null?x.number+' ':'')+u+((x.number>1&&u)?'s':''); }
  return '';
}
function spellHTML(sp, glvl){
  sp=sp||{};
  var oMap={ "class":"o-class", subclass:"o-sub", race:"o-race", feat:"o-feat", expanded:"o-sub" };
  var tMap={ "class":"t-class", subclass:"t-sub", race:"t-race", feat:"t-feat", expanded:"t-exp" };
  var o=sp.origin||'class';
  // the cast handler reads data-level; a forged spell may not carry its own level, so fall
  // back to the group's level (passed by groupHTML) instead of defaulting every spell to 0
  // (which made leveled spells log as "cantrip").
  var lvl = sp.level!=null ? sp.level : (glvl!=null ? glvl : 0);
  return '<div class="spell '+(oMap[o]||'o-class')+'" data-spell="'+esc(sp.name)+'" data-level="'+lvl+'"'+(sp.conc?' data-conc="1"':'')+'><span class="s-n">'+esc(sp.name)+(sp.conc?' <span class="s-conc" title="Concentration">C</span>':'')+'</span>'
       + '<span class="s-tag '+(tMap[o]||'t-class')+'">'+esc(sp.source)+'</span>'
       + '<span class="s-ct">'+esc(fmtCt(sp.time))+'</span></div>';
}
function groupHTML(g){
  g=g||{};
  var glvl = g.level!=null ? g.level : (function(){ var m=/(\d+)/.exec(g.heading||''); return m?+m[0]:0; })();
  return '<div class="spell-group"><div class="sg-h">'+esc(g.heading)+'</div>'
       + '<div class="spell-cols">'+(g.spells||[]).map(function(sp){ return spellHTML(sp, glvl); }).join('')+'</div></div>';
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
  root=root||document; sc=sc||{};
  function setF(fld,val){ if(val===undefined||val===null) return; var e=root.querySelector('[data-f="'+fld+'"]'); if(e) e.textContent=val; }
  var ph=root.querySelector('[data-list="pools"]');       if(ph) ph.innerHTML=(sc.pools||[]).map(poolHTML).join('');
  // A character casts if it has a save DC, any spells, or any spell pools. With none of
  // those, hide the cast-meta + legend so the template's SAMPLE DC/ability/type don't bleed
  // through for a martial, and show a plain empty state instead of an empty spell list.
  var dash='\u2014';
  var casts=(sc.saveDC!=null)||(sc.groups&&sc.groups.length)||(sc.pools&&sc.pools.length);
  var meta=root.querySelector('.cast-meta'), leg=root.querySelector('.legend');
  if(meta) meta.style.display=casts?'':'none';
  if(leg)  leg.style.display =casts?'':'none';
  setF('castAbility', sc.ability||dash);
  setF('castDC', sc.saveDC!=null?sc.saveDC:dash);
  setF('castAtk', sc.attackBonus!=null?sgn(sc.attackBonus):dash);
  setF('castType', sc.prepared===true?'Prepared':(sc.prepared===false?'Known':(sc.castType||dash)));
  setF('featNote', sc.featNote);
  var gb=root.querySelector('[data-list="spellGroups"]');
  if(gb) gb.innerHTML=casts?(sc.groups||[]).map(groupHTML).join(''):'<p class="spell-none" style="opacity:.55;font-style:italic;margin:10px 2px">This character doesn\u2019t cast spells.</p>';
  var db=root.querySelector('[data-list="detail"]');       if(db) db.innerHTML=detailHTML(sc.detail);
}
// Concentration banner — driven by vitals.concentration ({name,duration} | null).
// The cast handler in sheet-actions.js sets it; the drop button clears it.
function renderConcentration(root, v){
  root=root||document; v=v||{};
  var el=root.querySelector('[data-conc-val]'); if(!el) return;
  var c=v.concentration;
  if(c && c.name){
    el.classList.remove('muted');
    el.innerHTML='<span class="cs-dot"></span>'+esc(c.name)
      + '<button class="cc-drop" type="button" data-conc-drop aria-label="Drop concentration">drop \u2715</button>';
  } else { el.classList.add('muted'); el.textContent='none'; }
}
function renderResources(root, pools){
  root=root||document; pools=pools||[];
  var host=root.querySelector('[data-list="resources"]'); if(host) host.innerHTML=pools.map(poolHTML).join('');
  var sec=root.querySelector('[data-sec="resources"]');   if(sec) sec.style.display=pools.length?'':'none';
}
// ── Resource trackers: the curated, tap-to-spend, drag-reorder left-rail panel.
// Pure data render (the interaction layer in sheet-actions.js owns spend / add /
// edit / remove / drag and re-renders through here). Each tracker's accent keys off
// its classification (gold class / teal subclass / red race / purple feat / gold
// weapon / neutral custom). available = derived/custom max − vitals.pipState[id].
var TRK_ACCENT={ 'class':'var(--o-class)', subclass:'var(--o-subclass)', race:'var(--o-race)', feat:'var(--o-feat)', item:'var(--gold)', custom:'var(--cream-dim)' };
var TRK_LABEL ={ 'class':'Class', subclass:'Subclass', race:'Race', feat:'Feat', item:'Weapon', custom:'Custom' };
function trkAccent(o){ return TRK_ACCENT[o]||TRK_ACCENT.custom; }
function trkLabel(o){ return TRK_LABEL[o]||TRK_LABEL.custom; }
// The visible, ordered specs for the panel. structural.trackerOrder is the curated
// set + order once the player has touched it; absent → pre-seed = every derived /
// custom pool in derive order. A stale id (resource no longer applies) self-heals out.
function trackerSpecs(structural){
  var RD=(typeof window!=='undefined' && window.ResourceDerive)?window.ResourceDerive:null;
  var specs=(RD && RD.derive)?RD.derive(structural||{}):[];
  var order=structural&&structural.trackerOrder;
  if(order&&order.length){ var byId={}; specs.forEach(function(s){ byId[s.id]=s; }); return order.map(function(id){ return byId[id]; }).filter(Boolean); }
  return specs;
}
function trkSpend(spec, spent){
  var cur=Math.max(0,(spec.max||0)-(spent||0)), acc=trkAccent(spec.origin);
  if((spec.max||0)>6){
    return '<div class="trk-count" style="--accent:'+acc+'">'
      +'<button class="step" type="button" data-tstep="-1" aria-label="Spend one">\u2212</button>'
      +'<span class="num">'+cur+' / '+spec.max+'</span>'
      +'<button class="step" type="button" data-tstep="1" aria-label="Restore one">+</button></div>';
  }
  var out='<div class="trk-p" style="--accent:'+acc+'" role="group" aria-label="'+esc(spec.label)+'">';
  for(var i=0;i<(spec.max||0);i++){ out+='<i tabindex="0" role="button" data-tpip="'+i+'" class="'+(i<cur?'on':'')+'" aria-label="'+(i<cur?'spend':'restore')+'"></i>'; }
  return out+'</div>';
}
function renderTrackers(root, structural, vitals){
  root=root||document; structural=structural||{}; vitals=vitals||{};
  var host=root.querySelector('[data-list="trackers"]'); if(!host) return;
  var pip=vitals.pipState||{};
  host.innerHTML=trackerSpecs(structural).map(function(s){
    var acc=trkAccent(s.origin), spent=pip[s.id]||0;
    var right=trkSpend(s, spent)
      +(s.custom?'<button class="trk-e" type="button" data-tedit="'+esc(s.id)+'" aria-label="Edit '+esc(s.label)+'">\u270E</button>':'')
      +'<button class="trk-x" type="button" data-tdel="'+esc(s.id)+'" data-tcustom="'+(s.custom?1:0)+'" aria-label="Remove '+esc(s.label)+'">\u2715</button>'
      +'<div class="trk-confirm"><span class="cf-l">delete?</span>'
        +'<button class="cf-yes" type="button" data-tconfirm="'+esc(s.id)+'" data-tcustom="'+(s.custom?1:0)+'">Delete</button>'
        +'<button class="cf-no" type="button" data-tcancel>Keep</button></div>';
    return '<div class="trk" data-tid="'+esc(s.id)+'" style="--accent:'+acc+'">'
      +'<button class="grip" type="button" data-tgrip aria-label="Reorder '+esc(s.label)+' (arrow keys to move)"></button>'
      +'<span class="trk-bar"></span>'
      +'<div class="trk-main"><div class="trk-n">'+esc(s.label)+'</div>'
      +'<div class="trk-meta"><span class="trk-src">'+esc(trkLabel(s.origin))+'</span> \u00B7 '+esc(s.recharge||'')+'</div></div>'
      +right+'</div>';
  }).join('');
}
// Live hit-dice readout. Derived TOTAL per die size (ResourceDerive.deriveHitDice);
// SPENT comes from vitals.hitDiceSpent — available = total - spent. Pips when few,
// a compact avail/total when a die has more than six.
function renderHitDice(root, s, v){
  root=root||document; s=s||{}; v=v||{};
  var host=root.querySelector('[data-list="hitdice"]'); if(!host) return;
  var hd=(typeof window!=='undefined' && window.ResourceDerive && window.ResourceDerive.deriveHitDice)?window.ResourceDerive.deriveHitDice(s):{pools:[],total:0};
  var spent=v.hitDiceSpent||{};
  if(!hd.pools.length){ host.innerHTML='<span class="hd-empty">\u2014</span>'; return; }
  host.innerHTML=hd.pools.map(function(p){
    var sp=spent[p.die]||0, avail=Math.max(0,p.total-sp), glyphs;
    if(p.total>6){ glyphs='<span class="hd-count">'+avail+'/'+p.total+'</span>'; }
    else { var g=''; for(var i=0;i<p.total;i++){ g+='<i class="hd-pip'+(i<avail?' on':'')+'"></i>'; } glyphs='<span class="hd-pips">'+g+'</span>'; }
    return '<div class="hd-row"><span class="hd-die">'+esc(p.die)+'</span>'+glyphs+'</div>';
  }).join('');
}

// Equipment, coin, and attunement from the live inventory/currency. An empty
// inventory shows an empty state (not the old sample gear); attunement pips reflect
// items flagged attuned (max 3) and are mirrored in the left Status block.
function renderEquipment(root, inventory, currency){
  root=root||document;
  inventory = Array.isArray(inventory) ? inventory : [];
  currency = currency || {};
  var attunedN = Math.min(3, inventory.filter(function(it){ return it && it.attuned; }).length);
  var box = root.querySelector('[data-equip]');
  if(box){
    var ic='<svg class="g-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3h9l4 4v14H6z"/><path d="M9 8h7M9 12h7M9 16h5"/></svg>';
    var items = inventory.map(function(it){
      var d = it.detail || it.typeLabel || it.rarity || '';
      var q = (it.qty && it.qty>1) ? '<span class="g-q">\u00D7'+it.qty+'</span>' : '';
      return '<div class="gitem">'+ic+'<span class="g-n">'+esc(it.name||'Item')+'</span>'+(d?'<span class="g-d">'+esc(d)+'</span>':'')+q+'</div>';
    }).join('');
    if(!items) items='<div class="gitem" style="opacity:.5"><span class="g-n">No equipment yet</span></div>';
    var coins=[]; ['pp','gp','ep','sp','cp'].forEach(function(k){ if(currency[k]) coins.push('<span class="coin">'+currency[k]+' <small>'+k+'</small></span>'); });
    var coinStr = coins.join(' ') || '<span class="coin">0 <small>gp</small></span>';
    var pips=''; for(var i=0;i<3;i++) pips+='<span class="pip'+(i<attunedN?' on':'')+'" style="width:10px;height:10px"></span>';
    box.innerHTML = items + '<div class="coinline">'+coinStr+'<span class="attune-wrap">Attuned'+pips+'</span></div>';
  }
  var la = root.querySelector('[data-attune]');
  if(la){ var lp=''; for(var j=0;j<3;j++) lp+='<span class="pip'+(j<attunedN?' on':'')+'"></span>'; la.innerHTML = lp; }
}
// Story + the four traits from the live bio. Empty fields read as a dash, never
// sample prose.
function renderStory(root, bio){
  root=root||document; bio = bio || {};
  var q = root.querySelector('[data-f="storyQuote"]');
  if(q) q.textContent = bio.backstory || bio.appearance || '';
  function trait(f, val){ var e=root.querySelector('[data-f="'+f+'"]'); if(e) e.textContent = (val && String(val).trim()) ? val : '\u2014'; }
  trait('bioPersonality', bio.personality);
  trait('bioIdeals', bio.ideals);
  trait('bioBonds', bio.bonds);
  trait('bioFlaws', bio.flaws);
}
function renderSheet(root, char){
  root=root||document; char=char||{};
  var s=char.structural||{}, v=char.vitals||{}, cb=s.combat||{}, ab=s.abilities||{};
  function setF(fld,val){ if(val===undefined||val===null) return; var e=root.querySelector('[data-f="'+fld+'"]'); if(e) e.textContent=val; }
  function styleF(fld,p,val){ var e=root.querySelector('[data-f="'+fld+'"]'); if(e) e.style[p]=val; }
  var nm=root.querySelector('[data-f="name"]');
  if(nm&&s.name){ var ps=String(s.name).trim().split(/\s+/); if(ps.length>1){ var last=ps.pop(); nm.innerHTML=esc(ps.join(' '))+' <em>'+esc(last)+'</em>'; } else nm.textContent=s.name; }
  setF('nameFoot', s.name);
  renderSubline(root, s);
  setF('ac', cb.ac);
  if(cb.acSource!=null) setF('ac-sub', cb.acSource);
  setF('initiative', sgn(cb.initiative));
  var initEl=root.querySelector('[data-chk="init"]'); if(initEl) initEl.setAttribute('data-chk-mod', (cb.initiative||0));
  setF('speed', cb.speed);
  setF('prof', sgn(s.proficiencyBonus));
  setF('spellDC', cb.spellSaveDC!=null?cb.spellSaveDC:'\u2014');
  setF('spellAtk', cb.spellAttackBonus!=null?sgn(cb.spellAttackBonus):'\u2014');
  renderHitDice(root, s, v);
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
  renderConcentration(root, v);
  renderActions(root, s);
  renderTrackers(root, s, v);
  renderEquipment(root, char.inventory, char.currency);
  renderStory(root, char.bio);
}
// ── live data: map a CharacterData row into the renderer's shape, then bind ──
function normSkills(sk){
  if(!sk) return [];
  var arr = Array.isArray(sk) ? sk : Object.keys(sk).map(function(k){ return sk[k]; });
  return arr.map(function(x){ return { name:x.name, attr:(x.attr||'').toLowerCase(), bonus:x.bonus, prof: !!x.prof && x.prof!=='none' }; });
}
function levelInfo(L){
  L=String(L).toLowerCase();
  if(L.indexOf('cantrip')===0) return { n:0, heading:'Cantrips \u00B7 At Will' };
  var m=L.match(/\d+/), n=m?parseInt(m[0],10):0, ord=['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];
  return { n:n, heading:(ord[n]||(n+'th'))+' Level' };
}
function buildSpellcasting(s, v){
  var cb=s.combat||{}, cf=s.classFeatures||{}, pip=(v&&v.pipState)||{};
  var ability='';
  if(cb.spellSaveDC!=null && s.proficiencyBonus!=null && s.abilities){
    var target=cb.spellSaveDC-8-s.proficiencyBonus, names={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
    Object.keys(s.abilities).forEach(function(k){ if(!ability && (s.abilities[k]||{}).mod===target) ability=names[k]||k; });
  }
  var pools=[];
  if(cf.pactSlots){ var pm=cf.pactSlots.max||0, ps=pip.pactSlots||0, pl=cf.pactSlots.level||1; pools.push({key:'pactSlots',level:pl,label:'Pact Magic',badge:'Lvl '+pl,tone:'class',max:pm,current:Math.max(0,pm-ps),recharge:pm+' slot'+(pm!==1?'s':'')+' \u00B7 short rest'}); }
  if(cf.sorcererSlots){ Object.keys(cf.sorcererSlots).forEach(function(L){ var ss=cf.sorcererSlots[L]||{}, m=ss.max||0, sp=pip['sorc_'+L]||0; pools.push({key:'sorc_'+L,level:parseInt(L,10)||0,label:'Sorcerer Slots',badge:'Lvl '+L,tone:'subclass',max:m,current:Math.max(0,m-sp),recharge:m+' slot'+(m!==1?'s':'')+' \u00B7 long rest'}); }); }
  if(cf.spellSlots){ Object.keys(cf.spellSlots).sort(function(a,b){return (parseInt(a,10)||0)-(parseInt(b,10)||0);}).forEach(function(L){ var ss=cf.spellSlots[L]||{}, m=ss.max||0, sp=pip['spell_'+L]||0; if(m>0) pools.push({key:'spell_'+L,level:parseInt(L,10)||0,label:'Spell Slots',badge:'Lvl '+L,tone:'class',max:m,current:Math.max(0,m-sp),recharge:m+' slot'+(m!==1?'s':'')+' \u00B7 long rest'}); }); }
  if(cf.sorceryPoints){ var sm=cf.sorceryPoints.max||0, sps=pip.sorcery||0; pools.push({key:'sorcery',level:0,points:true,label:'Sorcery Points',badge:String(Math.max(0,sm-sps)),tone:'dim',max:sm,current:Math.max(0,sm-sps),recharge:sm>0?'sorcerer long rest':'unlocks at Sorcerer 2'}); }
  var groups=[], spells=s.spells||{};
  Object.keys(spells).map(function(L){ return { key:L, info:levelInfo(L) }; }).sort(function(a,b){ return a.info.n-b.info.n; }).forEach(function(o){
    var arr=spells[o.key]; if(!arr||!arr.length) return;
    groups.push({ heading:o.info.heading, level:o.info.n, spells:arr.map(function(sp){ return { name:sp.name, origin:'class', source:'', time:sp.castingTime||'', level:o.info.n, conc:!!sp.concentration, ritual:!!sp.ritual }; }) });
  });
  return { ability:ability, saveDC:cb.spellSaveDC, attackBonus:cb.spellAttackBonus, pools:pools, groups:groups, detail:null, featNote:'\u2014 origin colours arrive when the derive carries provenance' };
}
// Non-spellcasting resource pools (Ki / Bardic / Superiority / Starlight Step),
// derived from class/level/abilities/race via ResourceDerive; spent comes from
// vitals.pipState — same ledger the combat orbs read.
function buildResources(s, v){
  var pip=(v&&v.pipState)||{};
  var specs=(typeof window!=='undefined' && window.ResourceDerive && window.ResourceDerive.derive)?window.ResourceDerive.derive(s):[];
  return specs.map(function(r){
    var cur=Math.max(0, r.max-(pip[r.id]||0));
    return { label:r.label, badge:(r.die||''), tone:r.tone, max:r.max, current:cur,
             recharge: cur+' of '+r.max+(r.recharge?' \u00B7 '+r.recharge:'') };
  });
}
// ── Actions: weapon/cantrip attacks, bonus damage, utility. Hit + damage derive
// from the chosen ability + proficiency; with no ability set they fall back to a
// flat hitMod/dmgMod, so existing data keeps working. Rolling is STATELESS — the
// interaction layer in sheet-actions.js rolls through DiceEngine and posts to the
// feed; these functions just paint the list and the result cards (the cards are
// built from the engine's structured fields, not its HUD strings).
function abilModOf(s, k){ var ab=(s.abilities||{})[k]; return ab && ab.mod!=null ? ab.mod : 0; }
function deriveActionMods(a, s){
  a=a||{}; s=s||{}; var prof=s.proficiencyBonus||0, hit, dmg;
  if(a.ability){ hit=abilModOf(s,a.ability)+(a.proficient?prof:0)+(+a.atkBonus||0); dmg=(a.dmgAbility?abilModOf(s,a.ability):0)+(+a.dmgBonus||0); }
  else { hit=+a.hitMod||0; dmg=+a.dmgMod||0; }
  return { hitMod:hit, dmgMod:dmg, abil:a.ability?String(a.ability).toUpperCase():'' };
}
function actionGroup(t){ return (t==='attack'||t==='attack-cantrip')?'attack':(t==='damage-only'?'damage':'utility'); }
function dmgFrag(dice, dmgMod, type){ if(!dice) return ''; return '<b>'+esc(dice)+(dmgMod?(dmgMod>=0?'+':'')+dmgMod:'')+'</b> '+esc(type||''); }
function actionRowHTML(a, s){
  a=a||{}; var g=actionGroup(a.type), m=deriveActionMods(a, s), meta;
  if(g==='utility') meta='<div class="ac-note">'+esc(a.note||'')+'</div>';
  else if(g==='damage') meta='<div class="ac-meta">'+dmgFrag(a.dmgDice, m.dmgMod, a.dmgType)+'</div>';
  else meta='<div class="ac-meta">'+(m.abil?'<span class="ac-abil">'+esc(m.abil)+'</span> \u00B7 ':'')+'to hit <b>'+(m.hitMod>=0?'+':'')+m.hitMod+'</b> \u00B7 dmg '+dmgFrag(a.dmgDice, m.dmgMod, a.dmgType)+'</div>';
  return '<div class="act '+g+'" data-act="'+esc(a.id||a.label||'')+'"'+(g==='utility'?'':' tabindex="0" role="button"')+'>'
       + '<div class="ac-main"><div class="ac-n">'+esc(a.label||'')+'</div>'+meta+'</div>'
       + (g==='utility'?'':'<span class="ac-go">roll</span>')+'</div>';
}
function renderActions(root, s){
  root=root||document; s=s||{};
  var sec=root.querySelector('[data-sec="actions"]'), host=root.querySelector('[data-list="actions"]');
  var list=s.actions||[];
  if(sec) sec.style.display = list.length ? '' : 'none';
  if(!host) return;
  var groups=[['attack','Attacks'],['damage','Bonus damage'],['utility','Utility']];
  host.innerHTML = groups.map(function(gp){
    var rows=list.filter(function(a){ return actionGroup(a.type)===gp[0]; });
    if(!rows.length) return '';
    return '<div class="agrp"><div class="agrp-h">'+gp[1]+'</div>'+rows.map(function(a){ return actionRowHTML(a, s); }).join('')+'</div>';
  }).join('');
}
function ordModStr(n){ return n>=0?'+'+n:''+n; }
function d20CardHTML(d){ d=d||{}; var kept='<span class="rcd-die'+(d.isCrit?' nat20':(d.isFumble?' nat1':''))+'">'+d.kept+'</span>'; return d.twin?kept+'<span class="rcd-die drop">'+d.dropped+'</span>':kept; }
function actionResultHTML(r, latest){
  var inner;
  if(r.kind==='utility') inner='<div class="rcd-n">'+esc(r.name)+'</div><div class="rcd-note">'+esc(r.main||'')+'</div>';
  else if(r.kind==='check') inner='<div class="rcd-n">'+esc(r.name)+'</div><div class="rcd-line"><span class="rcd-lab">Roll</span><span class="rcd-expr">'+d20CardHTML(r.d20)+' '+ordModStr(r.mod||0)+(r.bless?' +'+r.bless+'\uD83D\uDE4F':'')+'</span><span class="rcd-tot">'+r.total+'</span></div>';
  else if(r.kind==='damage') inner='<div class="rcd-n">'+esc(r.name)+'</div><div class="rcd-line"><span class="rcd-lab">Damage</span><span class="rcd-expr">['+(r.dmgRolls||[]).join('][')+']'+(r.dmgMod?' '+ordModStr(r.dmgMod):'')+'</span><span class="rcd-tot dmg">'+r.dmgTotal+'</span></div><div class="rcd-type">'+esc(r.dmgType||'')+'</div>';
  else { var flag=r.isCrit?'<span class="rcd-flag crit">\u2605 Crit</span>':(r.isFumble?'<span class="rcd-flag miss">\u2717 Nat 1</span>':'');
    inner='<div class="rcd-n">'+esc(r.name)+flag+'</div>'
      + '<div class="rcd-line"><span class="rcd-lab">To hit</span><span class="rcd-expr">'+d20CardHTML(r.d20)+' '+ordModStr(r.hitMod||0)+(r.bless?' +'+r.bless+'\uD83D\uDE4F':'')+'</span><span class="rcd-tot">'+r.total+'</span></div>'
      + '<div class="rcd-line"><span class="rcd-lab">'+(r.isCrit?'Crit dmg':'Damage')+'</span><span class="rcd-expr">['+(r.dmgRolls||[]).join('][')+']'+(r.dmgMod?' '+ordModStr(r.dmgMod):'')+'</span><span class="rcd-tot dmg">'+r.dmgTotal+'</span></div>'
      + '<div class="rcd-type">'+esc(r.dmgType||'')+'</div>';
  }
  return '<div class="rcard'+(latest?' latest':'')+'">'+inner+'</div>';
}
function renderActionResult(root, hist){
  root=root||document; var host=root.querySelector('[data-list="actionResult"]'); if(!host) return;
  hist=hist||[];
  host.innerHTML = hist.length ? hist.slice(0,4).map(function(r,i){ return actionResultHTML(r, i===0); }).join('')
    : '<div class="rcard-empty">Tap an action to roll \u2014 the result lands here, and on the feed.</div>';
}
function toRenderShape(cd){
  cd=cd||{}; var s=Object.assign({}, cd.structural||{}), v=Object.assign({}, cd.vitals||{});
  s.skills=normSkills(s.skills);
  if(s.passiveInsight==null){ var ins=s.skills.filter(function(x){return x.name==='Insight';})[0]; if(ins) s.passiveInsight=10+(ins.bonus||0); }
  if(!s.spellcasting) s.spellcasting=buildSpellcasting(s, v);
  if(!s.resources) s.resources=buildResources(s, v);
  if(v.inspiration==null && s.inspiration!=null) v.inspiration=s.inspiration;
  return { structural:s, vitals:v, notes:(cd.notes!=null?cd.notes:s.notes), inventory:(cd.inventory||[]), currency:(cd.currency||{}), bio:(cd.bio||{}) };
}
function applyExtras(root, cd){
  var v=cd.vitals||{}, s=cd.structural||{}, insp=(v.inspiration!=null?v.inspiration:s.inspiration);
  var por=root.querySelector('.portrait'); if(por) por.classList.toggle('inspired', !!insp);
  var frame=root.querySelector('.portrait .frame');
  if(frame && s.portrait){ frame.innerHTML='<img src="'+esc(s.portrait)+'" alt="" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block">'; }
}
function showError(root, msg){ var sub=root.querySelector('[data-list="subline"]'); if(sub) sub.innerHTML='<span style="color:var(--red-br)">'+esc(msg)+'</span>'; }

// ── filter defs the sheet markup references (filter:url(#rough) …) ──
// Injected once per host document, keyed on a real filter id, so a page that already
// carries the defs (sheet-v2.html's page chrome, or a prior mount) is a no-op.
var SHEET_DEFS = `<svg class="defs" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs>
    <filter id="distress" x="-6%" y="-10%" width="112%" height="124%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.035" numOctaves="3" seed="3" result="rough"/>
      <feDisplacementMap in="SourceGraphic" in2="rough" scale="1.6" result="disp"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.14 0.18" numOctaves="2" seed="9" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.12" result="mask"/>
      <feComposite in="disp" in2="mask" operator="in"/>
    </filter>
    <filter id="swash" x="-25%" y="-60%" width="150%" height="220%">
      <feTurbulence type="fractalNoise" baseFrequency="0.011 0.03" numOctaves="3" seed="5" result="r"/>
      <feDisplacementMap in="SourceGraphic" in2="r" scale="17" result="d"/>
      <feTurbulence type="turbulence" baseFrequency="0.05 0.08" numOctaves="2" seed="2" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.05 1.0" result="ga"/>
      <feComposite in="d" in2="ga" operator="in"/>
    </filter>
    <filter id="rough" x="-15%" y="-40%" width="130%" height="180%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" seed="4" result="r"/>
      <feDisplacementMap in="SourceGraphic" in2="r" scale="4"/>
    </filter>
    <filter id="glitch1" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feOffset in="r" dx="-2" dy="0" result="ro"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feOffset in="b" dx="2" dy="0" result="bo"/>
      <feBlend in="ro" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="bo" mode="screen"/>
    </filter>
    <filter id="glitch2" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="1" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feOffset in="r" dx="-3.5" dy="0" result="ro"/>
      <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feOffset in="b" dx="3.5" dy="0" result="bo"/>
      <feBlend in="ro" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="bo" mode="screen"/>
    </filter>
    <filter id="glitch3" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="1" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feOffset in="r" dx="-6" dy="0" result="ro"/>
      <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feOffset in="b" dx="6" dy="0" result="bo"/>
      <feBlend in="ro" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="bo" mode="screen"/>
    </filter>
    <filter id="glitch4" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="1" seed="19" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="24" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feOffset in="r" dx="-9" dy="0" result="ro"/>
      <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feOffset in="b" dx="9" dy="0" result="bo"/>
      <feBlend in="ro" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="bo" mode="screen"/>
    </filter>
    <pattern id="geo-hex" patternUnits="userSpaceOnUse" width="46" height="40"><path d="M11.5 1 L34.5 1 L46 20 L34.5 39 L11.5 39 L0 20 Z" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1.1"/></pattern>
    <pattern id="geo-triangles" patternUnits="userSpaceOnUse" width="20" height="17.32"><path d="M0 0 L10 17.32 L20 0 M0 17.32 L10 0 L20 17.32 M0 0 H20 M0 17.32 H20" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern>
    <pattern id="geo-diamonds" patternUnits="userSpaceOnUse" width="28" height="28"><path d="M14 0 L28 14 L14 28 L0 14 Z" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern>
    <pattern id="geo-grid" patternUnits="userSpaceOnUse" width="26" height="26"><path d="M26 0 H0 V26" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern>
    <pattern id="geo-dots" patternUnits="userSpaceOnUse" width="22" height="22"><circle cx="11" cy="11" r="1.7" fill="rgba(236,226,205,.82)"/></pattern>
    <pattern id="geo-rings" patternUnits="userSpaceOnUse" width="30" height="30"><circle cx="15" cy="15" r="9" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern>
    <pattern id="geo-crosses" patternUnits="userSpaceOnUse" width="24" height="24"><path d="M12 7 V17 M7 12 H17" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern>
  </defs></svg>`;
function ensureDefs(doc){
  doc = doc || (typeof document!=='undefined'?document:null); if(!doc) return;
  if (doc.getElementById('rough')) return;
  (doc.body || doc.documentElement).insertAdjacentHTML('beforeend', SHEET_DEFS);
}

// ── the reusable sheet body markup (stamped into the mount container) ──
var SHEET_TEMPLATE = `<main class="tok-sheet">
  <div class="frameline"></div>
  <div class="ghostnum">III</div>
  
  <div class="annot l">Astral · Shadow · Pact</div>
  <div class="annot r">Trials of Kirtas</div>

  <!-- ——— MASTHEAD ——— -->
  <header class="masthead">
    <div class="portrait">
      <span class="ring3"></span><span class="ring"></span><span class="ring2"></span>
      <div class="frame">
        <svg class="por" viewBox="0 0 150 150" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="splitbg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1d4a4d"/>
              <stop offset="48%" stop-color="#16302e"/>
              <stop offset="100%" stop-color="#5a221c"/>
            </linearGradient>
            <radialGradient id="glow" cx="58%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#cfe0df" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#cfe0df" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="150" height="150" fill="url(#splitbg)"/>
          <rect width="150" height="150" fill="url(#glow)"/>
          <!-- starlit hooded silhouette, looking up -->
          <g fill="#0e1d1c" opacity="0.94">
            <path d="M78 34 C58 32 48 50 50 70 C51 82 57 92 68 96 L62 150 L96 150 L92 96
                     C103 90 106 78 105 66 C103 46 96 36 78 34 Z"/>
            <path d="M80 30 C56 28 44 48 47 72 C50 56 62 44 80 44 C96 44 104 52 108 66 C110 44 100 30 80 30 Z" opacity="0.8"/>
          </g>
          <g fill="#e7c279"><circle cx="74" cy="60" r="2.4"/><circle cx="86" cy="52" r="1.5" opacity="0.8"/><circle cx="64" cy="70" r="1.3" opacity="0.7"/></g>
          <g stroke="#e0584a" stroke-width="0.7" fill="none" opacity="0.5"><circle cx="75" cy="66" r="40"/><circle cx="75" cy="66" r="54"/></g>
        </svg>
      </div>
    </div>

    <div class="titleblock">
      <span class="eyebrow-wrap swashwrap"><p class="eyebrow">Trials of Kirtas</p></span>
      <h1 class="charname" data-f="name">Cosmere <em>Runestar</em></h1>
      <div class="subline" data-list="subline">
        <span><b>Warlock</b> 2 <span class="sub">· The Hexblade</span></span>
        <span class="dot">✦</span>
        <span><b>Sorcerer</b> 1 <span class="sub">· Shadow Magic</span></span>
        <span class="dot">✦</span>
        <span>Astral Elf</span>
        <span class="dot">✦</span>
        <span><b>Level 3</b></span>
        <span class="dot">✦</span>
        <span>Neutral Good</span>
      </div>
    </div>
  </header>

  <!-- pinned concentration / conditions strip — visible on every tab -->
  <div class="conc-strip">
    <span><span class="cs-lab">Concentration</span><span class="cs-val muted" data-conc-val>none</span></span>
    <span class="cs-sep"></span>
    <span><span class="cs-lab">Conditions</span><span class="cs-val muted" data-f="conditions">none active</span></span>
  </div>

  <!-- ——— BODY ——— -->
  <div class="body-grid">

    <!-- LEFT -->
    <aside class="leftcol">
      <div class="medstack">
        <div class="med-row">
          <div class="med hot"><div class="lab">Armor Class</div><div class="big" data-f="ac">14</div><div class="sub" data-f="ac-sub">studded leather</div></div>
          <div class="med roll-chk" data-chk="init" data-chk-label="Initiative" data-chk-mod="0" tabindex="0" role="button"><div class="lab">Initiative</div><div class="big" data-f="initiative">+2</div><div class="sub">dexterity</div></div>
        </div>
        <div class="med hpmed hot">
          <div class="lab">Hit Points</div>
          <div class="big"><span data-f="hp">18</span> <span style="font-size:23px;color:var(--cream-dim)" data-f="hpMaxBig">/ 23</span></div>
          <div class="hpbar"><div class="hpfill" data-f="hpfill"></div><div class="hptemp" data-f="hptemp"></div></div>
          <div class="hpmeta"><span data-f="hpCurrent">Current 18 / 23</span><span class="tmp" data-f="hpTemp">+4 Temp</span></div>
        </div>
        <div class="med-row">
          <div class="med mini"><div class="lab">Speed</div><div class="big"><span data-f="speed">30</span><span style="font-size:15px;color:var(--cream-dim)">ft</span></div></div>
          <div class="med mini"><div class="lab">Prof.</div><div class="big" data-f="prof">+2</div></div>
        </div>
        <div class="med-row">
          <div class="med mini hot"><div class="lab">Spell DC</div><div class="big" data-f="spellDC">13</div></div>
          <div class="med mini hot"><div class="lab">Spell Atk</div><div class="big" data-f="spellAtk">+5</div></div>
        </div>
        <div class="med hd" id="hd-med"><div class="lab">Hit Dice</div><div class="hd-body" data-list="hitdice"></div></div>
        <div class="med cluster">
          <button class="cc rest" data-rest="short" type="button" aria-label="Short Rest">
            <span class="ic"><svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 2.6 A8.4 8.4 0 0 1 11 19.4 Z" fill="currentColor"/></svg></span>
            <span class="cclabel">Short Rest</span>
          </button>
          <button class="cc center" id="insp-toggle" type="button" aria-pressed="false" aria-label="Inspiration">
            <span class="ic"><span class="insp"></span></span>
            <span class="cclabel">Inspiration</span>
          </button>
          <button class="cc rest" data-rest="long" type="button" aria-label="Long Rest">
            <span class="ic"><svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8.4" fill="currentColor"/><circle cx="8" cy="8.5" r="1.5" fill="#182826" opacity=".5"/><circle cx="13.5" cy="12.5" r="1.1" fill="#182826" opacity=".5"/></svg></span>
            <span class="cclabel">Long Rest</span>
          </button>
        </div>
        <div class="insp-stat" id="insp-stat" aria-live="polite"></div>
      </div>
      <div class="lblock">
        <div class="lhead">Senses &amp; Lore</div>
        <div class="lrow"><span>Darkvision</span><b data-f="darkvision">60 ft</b></div>
        <div class="lrow"><span>Passive Perception</span><b data-f="passivePerception">13</b></div>
        <div class="lrow"><span>Passive Insight</span><b data-f="passiveInsight">13</b></div>
        <div class="lrow"><span>Languages</span><b data-f="languages">Common · Elvish · Infernal</b></div>
      </div>
      <div class="lblock">
        <div class="lhead">Resources <span class="lhint">tap to spend</span></div>
        <div data-list="trackers"></div>
        <div class="trk add" data-trk-add tabindex="0" role="button" aria-expanded="false"><span class="trk-n">+ add tracker</span></div>
        <div class="taddbox" data-trk-form hidden>
          <div class="tedit-head" data-trk-edithead><span class="t" data-trk-edittitle>Edit tracker</span><button class="x" type="button" data-trk-cancel>cancel</button></div>
          <div class="tform">
            <label class="tfld" for="trk-name">Name</label>
            <input class="tinput" id="trk-name" type="text" maxlength="40" placeholder="e.g. Channel Divinity" data-trk-name>
            <label class="tfld">Classification</label>
            <div class="chips" data-trk-origins>
              <button type="button" class="chip" data-o="class" style="--c:var(--o-class)"><i></i>Class</button>
              <button type="button" class="chip" data-o="subclass" style="--c:var(--o-subclass)"><i></i>Subclass</button>
              <button type="button" class="chip" data-o="race" style="--c:var(--o-race)"><i></i>Race</button>
              <button type="button" class="chip" data-o="feat" style="--c:var(--o-feat)"><i></i>Feat</button>
              <button type="button" class="chip" data-o="item" style="--c:var(--gold)"><i></i>Weapon</button>
              <button type="button" class="chip on" data-o="custom" style="--c:var(--cream-dim)"><i></i>Custom</button>
            </div>
            <label class="tfld">Maximum</label>
            <div class="tmax">
              <select class="tsel" data-trk-mtype>
                <option value="fixed">Fixed number</option>
                <option value="pb">Proficiency bonus</option>
                <option value="level">Character level</option>
                <option value="mod">Ability modifier</option>
              </select>
              <input class="tinput" type="number" min="1" max="20" value="1" data-trk-mfixed>
              <select class="tsel" data-trk-mability hidden>
                <option value="cha">CHA</option><option value="con">CON</option><option value="wis">WIS</option>
                <option value="int">INT</option><option value="dex">DEX</option><option value="str">STR</option>
              </select>
            </div>
            <div style="height:10px"></div>
            <label class="tfld" for="trk-recharge">Recharges on</label>
            <select class="tsel" id="trk-recharge" data-trk-recharge>
              <option value="long">Long rest</option>
              <option value="short">Short rest</option>
              <option value="short-long">Short or long rest</option>
            </select>
            <button class="tbtn" type="button" data-trk-save>Add tracker</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- RIGHT -->
    <section class="rightcol">

      <nav class="sheet-tabbar" role="tablist">
        <button class="sheet-tab active" data-tab="overview" role="tab" type="button">Overview</button>
        <button class="sheet-tab" data-tab="actions" role="tab" type="button">Actions</button>
        <button class="sheet-tab" data-tab="spells" role="tab" type="button">Spells</button>
        <button class="sheet-tab" data-tab="inventory" role="tab" type="button">Inventory</button>
        <button class="sheet-tab" data-tab="features" role="tab" type="button">Features</button>
        <button class="sheet-tab" data-tab="bio" role="tab" type="button">Bio</button>
        <button class="sheet-tab" data-tab="notes" role="tab" type="button">Notes</button>
      </nav>

      <!-- ABILITIES -->
      <div class="block">
        <div class="sectitle"><span class="swashwrap"><h2>Abilities</h2></span><span class="tail"></span><span class="hint">Charisma is the soul of this build</span></div>
        <div class="panelbox">
          <div class="abil-grid" data-list="abilities">
            <div class="abil neg"><div class="nm">Str</div><div class="sc">8</div><div class="md">−1</div></div>
            <div class="abil"><div class="nm">Dex</div><div class="sc">14</div><div class="md">+2</div></div>
            <div class="abil"><div class="nm">Con</div><div class="sc">14</div><div class="md">+2</div></div>
            <div class="abil"><div class="nm">Int</div><div class="sc">10</div><div class="md">+0</div></div>
            <div class="abil"><div class="nm">Wis</div><div class="sc">12</div><div class="md">+1</div></div>
            <div class="abil"><div class="nm">Cha</div><div class="sc">17</div><div class="md">+3</div></div>
          </div>
          <div class="saves" data-list="saves">
            <div class="save"><span class="dotp"></span><span class="sv-n">Str</span><span class="sv-v">−1</span></div>
            <div class="save"><span class="dotp"></span><span class="sv-n">Dex</span><span class="sv-v">+2</span></div>
            <div class="save"><span class="dotp"></span><span class="sv-n">Con</span><span class="sv-v">+2</span></div>
            <div class="save"><span class="dotp"></span><span class="sv-n">Int</span><span class="sv-v">+0</span></div>
            <div class="save prof"><span class="dotp"></span><span class="sv-n">Wis</span><span class="sv-v">+3</span></div>
            <div class="save prof"><span class="dotp"></span><span class="sv-n">Cha</span><span class="sv-v">+5</span></div>
          </div>
        </div>
      </div>

      <!-- SKILLS -->
      <div class="block">
        <div class="sectitle"><span class="swashwrap"><h2>Skills</h2></span><span class="tail"></span><span class="hint">● proficient</span></div>
        <div class="panelbox">
          <div class="skills" data-list="skills">
            <div class="skill"><span class="dotp"></span><span class="sk-n">Acrobatics</span><span class="sk-a">Dex</span><span class="sk-v">+2</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Animal Handling</span><span class="sk-a">Wis</span><span class="sk-v">+1</span></div>
            <div class="skill prof"><span class="dotp"></span><span class="sk-n">Arcana</span><span class="sk-a">Int</span><span class="sk-v">+2</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Athletics</span><span class="sk-a">Str</span><span class="sk-v">−1</span></div>
            <div class="skill prof"><span class="dotp"></span><span class="sk-n">Deception</span><span class="sk-a">Cha</span><span class="sk-v">+5</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">History</span><span class="sk-a">Int</span><span class="sk-v">+0</span></div>
            <div class="skill prof"><span class="dotp"></span><span class="sk-n">Insight</span><span class="sk-a">Wis</span><span class="sk-v">+3</span></div>
            <div class="skill prof"><span class="dotp"></span><span class="sk-n">Intimidation</span><span class="sk-a">Cha</span><span class="sk-v">+5</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Investigation</span><span class="sk-a">Int</span><span class="sk-v">+0</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Medicine</span><span class="sk-a">Wis</span><span class="sk-v">+1</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Nature</span><span class="sk-a">Int</span><span class="sk-v">+0</span></div>
            <div class="skill prof"><span class="dotp"></span><span class="sk-n">Perception</span><span class="sk-a">Wis</span><span class="sk-v">+3</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Performance</span><span class="sk-a">Cha</span><span class="sk-v">+3</span></div>
            <div class="skill prof"><span class="dotp"></span><span class="sk-n">Persuasion</span><span class="sk-a">Cha</span><span class="sk-v">+5</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Religion</span><span class="sk-a">Int</span><span class="sk-v">+0</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Sleight of Hand</span><span class="sk-a">Dex</span><span class="sk-v">+2</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Stealth</span><span class="sk-a">Dex</span><span class="sk-v">+2</span></div>
            <div class="skill"><span class="dotp"></span><span class="sk-n">Survival</span><span class="sk-a">Wis</span><span class="sk-v">+1</span></div>
          </div>
        </div>
      </div>

      <!-- ACTIONS -->
      <div class="block" data-sec="actions">
        <div class="sectitle"><span class="swashwrap"><h2>Actions</h2></span><span class="tail"></span><span class="hint">tap to roll</span></div>
        <div class="panelbox">
          <div class="roll-mods" data-roll-mods>
            <button class="rmod" type="button" data-rmod="advantage">Advantage</button>
            <button class="rmod" type="button" data-rmod="disadvantage">Disadvantage</button>
            <button class="rmod" type="button" data-rmod="bless">Bless</button>
          </div>
          <div class="actionlist" data-list="actions"></div>
          <div class="actionresult" data-list="actionResult"><div class="rcard-empty">Tap an action to roll &mdash; the result lands here, and on the feed.</div></div>
        </div>
      </div>

      <!-- SPELLCASTING (Spells tab) -->
      <div class="block" data-sec="spells">
        <div class="sectitle"><span class="swashwrap"><h2>Spellcasting</h2></span><span class="tail"></span><span class="hint">ability · save · attack</span></div>
        <div class="panelbox">
          <div class="spellhead" data-list="pools"></div>
          <div class="cast-meta">
            <span>Ability <b data-f="castAbility">Charisma</b></span><span>Save DC <b data-f="castDC">13</b></span><span>Attack <b data-f="castAtk">+5</b></span><span>Type <b data-f="castType">Known</b></span>
          </div>
          <div class="legend">
            <span><i class="l-class"></i>Class</span><span><i class="l-sub"></i>Subclass</span>
            <span><i class="l-race"></i>Species</span><span><i class="l-feat"></i>Feat</span>
            <span class="none" data-f="featNote">— no feat spells at this level</span>
          </div>

          <div data-list="spellGroups"></div>

          <div data-list="detail">
          <div class="detail">
            <div class="d-h"><span class="d-n">Hex</span><span class="d-sch">1st-level enchantment · Warlock</span></div>
            <div class="d-grid">
              <span>Cast <b>1 Bonus Action</b></span><span>Range <b>90 ft</b></span>
              <span>Components <b>V, S, M</b></span><span>Duration <b class="conc">Concentration, 1 hr</b></span>
            </div>
            <p class="d-body">Lay a curse on a creature you can see within range. Your attacks deal an extra 1d6 necrotic damage to it, and it has disadvantage on ability checks made with one ability score of your choice.</p>
            <p class="d-hl"><b>At higher levels</b> — a 3rd-level slot holds the curse up to 8 hours; 5th level, up to 24 hours.</p>
          </div>
          </div><!-- /detail -->
        </div>
      </div>

      <!-- FEATURES -->
      <div class="block" data-sec="features">
        <div class="sectitle"><span class="swashwrap"><h2>Features</h2></span><span class="tail"></span><span class="hint">&amp; traits</span></div>
        <div class="panelbox">
          <div class="feat-cols" data-list="features">
            <div class="feat"><span class="f-tag t-class">Warlock</span><div><div class="f-n">Pact Magic</div><div class="f-d">Spells fueled by short-rest pact slots, all cast at their highest level.</div></div></div>
            <div class="feat"><span class="f-tag t-sub">Hexblade</span><div><div class="f-n">Hex Warrior</div><div class="f-d">Use Charisma for attack and damage with a bonded weapon.</div></div></div>
            <div class="feat"><span class="f-tag t-sub">Hexblade</span><div><div class="f-n">Hexblade's Curse</div><div class="f-d">Mark a foe for bonus damage and crit on a 19–20.</div></div></div>
            <div class="feat"><span class="f-tag t-class">Warlock</span><div><div class="f-n">Eldritch Invocations</div><div class="f-d">Agonizing Blast · Devil's Sight.</div></div></div>
            <div class="feat"><span class="f-tag t-class">Sorcerer</span><div><div class="f-n">Shadow Magic Origin</div><div class="f-d">Your soul carries a fragment of the Shadowfell.</div></div></div>
            <div class="feat"><span class="f-tag t-sub">Shadow</span><div><div class="f-n">Strength of the Grave</div><div class="f-d">Drop to 1 HP instead of 0 on a Charisma save.</div></div></div>
            <div class="feat"><span class="f-tag t-race">Astral Elf</span><div><div class="f-n">Darkvision 60 ft</div><div class="f-d">See in dim light and darkness.</div></div></div>
            <div class="feat"><span class="f-tag t-race">Astral Elf</span><div><div class="f-n">Fey Ancestry</div><div class="f-d">Advantage against charm; immune to magical sleep.</div></div></div>
            <div class="feat"><span class="f-tag t-race">Astral Elf</span><div><div class="f-n">Starlight Step</div><div class="f-d">Teleport 30 ft as a bonus action, prof. uses per long rest.</div></div></div>
          </div>
        </div>
      </div>

      <!-- INVENTORY -->
      <div class="block" data-sec="inventory">
        <div class="sectitle"><span class="swashwrap"><h2>Inventory</h2></span><span class="tail"></span><span class="hint">carried · currency · attunement</span></div>
        <div class="panelbox" data-equip></div>
      </div>

      <!-- BIO -->
      <div class="block" data-sec="bio">
        <div class="sectitle"><span class="swashwrap"><h2>Story</h2></span><span class="tail"></span></div>
        <div class="panelbox">
          <p class="story-quote" data-f="storyQuote"></p>
          <div class="traits">
            <div class="trait"><div class="t-l">Personality</div><div class="t-t" data-f="bioPersonality">\u2014</div></div>
            <div class="trait"><div class="t-l">Ideals</div><div class="t-t" data-f="bioIdeals">\u2014</div></div>
            <div class="trait"><div class="t-l">Bonds</div><div class="t-t" data-f="bioBonds">\u2014</div></div>
            <div class="trait"><div class="t-l">Flaws</div><div class="t-t" data-f="bioFlaws">\u2014</div></div>
          </div>
        </div>
      </div>

      <!-- NOTES -->
      <div class="block" data-sec="notes">
        <div class="sectitle"><span class="swashwrap"><h2>Notes</h2></span><span class="tail"></span></div>
        <div class="panelbox">
          <div class="notepad" data-f="notes"></div>
        </div>
      </div>

      <div class="footer"><span class="mk" data-f="nameFoot">Cosmere Runestar</span><div class="ln"></div><span class="mk">Trials of Kirtas</span></div>

    </section>
  </div>
</main>`;

// ── mountSheet(container, key[, {characterData}]) ──
// Stamp the template into `container`, render the live row into it, light the
// portrait, and wire inspiration scoped to THIS container. Pure of any single
// page: combat.html can float a sheet by calling this with its own node.
// Tab bar: Overview shows every section (the master sheet); a focused tab shows
// only its data-sec section. Abilities/Skills carry no data-sec, so they live in
// Overview only. The vitals sidebar + strip are outside .rightcol and always show.
function wireSheetTabs(root){
  root=root||document;
  var tabs=root.querySelectorAll('.sheet-tab');
  var blocks=root.querySelectorAll('.rightcol > .block');
  if(!tabs.length) return;
  function activate(id){
    tabs.forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tab')===id); });
    blocks.forEach(function(b){ var sec=b.getAttribute('data-sec'); b.hidden = !(id==='overview' || sec===id); });
  }
  tabs.forEach(function(t){ t.addEventListener('click', function(){ activate(t.getAttribute('data-tab')); }); });
  activate('overview');
}
function mountSheet(container, key, opts){
  opts = opts || {};
  var CD = opts.characterData || (typeof window!=='undefined' ? window.CharacterData : null);
  var doc = (container && container.ownerDocument) || (typeof document!=='undefined' ? document : null);
  ensureDefs(doc);
  container.innerHTML = SHEET_TEMPLATE;
  wireSheetTabs(container);
  if (!CD) { showError(container, 'CharacterData not loaded'); return { ready: Promise.resolve() }; }
  var ready = CD.loadCharacter(key).then(function(cd){
    if(!cd){ showError(container, 'No character "'+key+'"'); return; }
    renderSheet(container, toRenderShape(cd));
    applyExtras(container, cd);
  }).catch(function(e){ console.error('[sheet] mount:', e); showError(container, (e&&e.message)?e.message:'Could not load character'); });
  // inspiration write-affordance, scoped to this container (sheet-actions.js)
  try { wireInspiration({ root: container, characterData: CD, key: key }); } catch(_){}
  return { ready: ready };
}

if (typeof window !== 'undefined') {
  window.mountSheet = mountSheet;
  window.__sheet = { renderSheet: renderSheet, toRenderShape: toRenderShape, renderEquipment: renderEquipment, renderStory: renderStory, wireSheetTabs: wireSheetTabs, buildSpellcasting: buildSpellcasting, buildResources: buildResources, renderResources: renderResources, renderTrackers: renderTrackers, trackerSpecs: trackerSpecs, renderConcentration: renderConcentration, renderActions: renderActions, renderActionResult: renderActionResult, deriveActionMods: deriveActionMods, renderHitDice: renderHitDice, applyExtras: applyExtras, mountSheet: mountSheet };
}

export { mountSheet };
