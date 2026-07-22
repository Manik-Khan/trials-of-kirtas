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

import { wireInspiration } from './sheet-actions.js?v=sup1';
import { assembleActions } from './weapon-actions.js';
import { applyFeatureCorrections, applySpellCorrections } from './sheet-corrections.js?v=sup1';
import { mountSheetProgression } from './sheet-progression.js?v=facets1';

function esc(x){ return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sgn(n){ n=Number(n)||0; return (n>=0?'+':'\u2212')+Math.abs(n); }
function clamp(n){ return Math.max(0,Math.min(100,n)); }
function parseSource(src){
  src=String(src||''); var i=src.indexOf(':');
  var type=i>=0?src.slice(0,i):'class', label=i>=0?src.slice(i+1):src;
  var map={ "class":"t-class", subclass:"t-sub", race:"t-race", feat:"t-feat", custom:"t-custom" };
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
    var disCls=sk.dis?' dis':'', disHook=sk.dis?(' data-chk-dis="1" title="'+esc(sk.disReason||'Disadvantage')+'"'):'';
    var disBadge=sk.dis?'<span class="sk-dis" aria-label="disadvantage">dis</span>':'';
    return '<div class="skill'+(sk.prof?' prof':'')+disCls+'" data-chk="skill" data-chk-label="'+esc(sk.name)+'" data-chk-mod="'+(sk.bonus||0)+'"'+disHook+' tabindex="0" role="button"><span class="dotp"></span><span class="sk-n">'+esc(sk.name)+'</span><span class="sk-a">'+esc(attr)+'</span>'+disBadge+'<span class="sk-v">'+sgn(sk.bonus||0)+'</span></div>';
  }).join('');
}
function renderFeatures(root, feats, custom){
  var box=root.querySelector('[data-list="features"]'); if(!box) return;
  var derived=(feats||[]).map(function(fobj){
    var p=parseSource(fobj.source);
    var corr=fobj.correctionId ? (' data-correction-id="'+esc(fobj.correctionId)+'"') : '';
    var hide=fobj.correctionId ? '' : '<button class="corr-hide" type="button" data-corr-suppress="feature" data-corr-name="'+esc(fobj.name)+'" data-corr-source="'+esc(fobj.source)+'" aria-label="Hide '+esc(fobj.name)+'">Hide</button>';
    return '<div class="feat'+(fobj.correctionId?' is-correction':'')+'"'+corr+'><span class="f-tag '+p.cls+'">'+esc(p.label)+'</span><div class="f-body"><div class="f-n">'+esc(fobj.name)+'</div><div class="f-d">'+esc(fobj.desc)+'</div></div>'+hide+'</div>';
  }).join('');
  var added=(custom||[]).map(function(cf){
    return '<div class="feat is-custom"><span class="f-tag t-custom">Custom</span><div class="f-body"><div class="f-n">'+esc(cf.name)+'</div><div class="f-d">'+esc(cf.desc)+'</div></div>'
      +'<button class="f-del" type="button" data-cf-del="'+esc(cf.id)+'" title="Remove feature" aria-label="Remove feature">\u2715</button></div>';
  }).join('');
  box.innerHTML = derived + added;
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
  var oMap={ "class":"o-class", subclass:"o-sub", race:"o-race", feat:"o-feat", expanded:"o-sub", manual:"o-manual" };
  var tMap={ "class":"t-class", subclass:"t-sub", race:"t-race", feat:"t-feat", expanded:"t-exp", manual:"t-manual" };
  var o=sp.origin||'class';
  // the cast handler reads data-level; a forged spell may not carry its own level, so fall
  // back to the group's level (passed by groupHTML) instead of defaulting every spell to 0
  // (which made leveled spells log as "cantrip").
  var lvl = sp.level!=null ? sp.level : (glvl!=null ? glvl : 0);
  var corr=sp.correctionId ? (' data-correction-id="'+esc(sp.correctionId)+'"') : '';
  var review=sp.correctionId ? ('<span class="s-corr '+(sp.correctionStatus==='confirmed'?'confirmed':'')+'">'+(sp.correctionStatus==='confirmed'?'Confirmed':'Review')+'</span>') : '';
  var hide=sp.correctionId ? '' : '<button class="corr-hide" type="button" data-corr-suppress="spell" data-corr-name="'+esc(sp.name)+'" data-corr-source="'+esc(sp.source)+'" aria-label="Hide '+esc(sp.name)+'">Hide</button>';
  return '<div class="spell '+(oMap[o]||'o-class')+'" data-spell="'+esc(sp.name)+'" data-level="'+lvl+'"'+corr+(sp.conc?' data-conc="1"':'')+'><span class="s-car">\u25B8</span><span class="s-n">'+esc(sp.name)+(sp.conc?' <span class="s-conc" title="Concentration">C</span>':'')+'</span>'
       + '<span class="s-tag '+(tMap[o]||'t-class')+'">'+esc(sp.source)+'</span>'
       + review+'<span class="s-ct">'+esc(fmtCt(sp.time))+'</span>'+hide+'</div>';
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
  var cs=sc.correctionSummary||{}, hb=root.querySelector('[data-corr-audit]'), hc=root.querySelector('[data-corr-health]');
  if(hb){
    hb.classList.toggle('attention', !!cs.unreviewed);
    hb.classList.toggle('has-corrections', !!cs.active && !cs.unreviewed);
    hb.setAttribute('aria-label', cs.unreviewed ? (cs.unreviewed+' spell correction'+(cs.unreviewed===1?'':'s')+' need review') : 'Character correction history');
  }
  if(hc) hc.textContent = cs.unreviewed ? (cs.unreviewed+' need'+(cs.unreviewed===1?'s':'')+' review') : (cs.active ? (cs.active+' active correction'+(cs.active===1?'':'s')) : (cs.history ? (cs.history+' history event'+(cs.history===1?'':'s')) : 'No corrections'));
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
function renderEquipment(root, inventory, currency, strScore){
  root=root||document;
  inventory = Array.isArray(inventory) ? inventory : [];
  currency = currency || {};
  var ES=(typeof window!=='undefined'&&window.EquipSlots)?window.EquipSlots:((typeof globalThis!=='undefined'&&globalThis.EquipSlots)?globalThis.EquipSlots:null);
  var ATT_MAX=3;
  var attunedN=Math.min(ATT_MAX, inventory.filter(function(it){ return it && it.attuned; }).length);
  var capFull=attunedN>=ATT_MAX;
  var ic='<svg class="g-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3h9l4 4v14H6z"/><path d="M9 8h7M9 12h7M9 16h5"/></svg>';
  function pipRow(){ var p=''; for(var i=0;i<ATT_MAX;i++) p+='<span class="pip'+(i<attunedN?' on':'')+'"></span>'; return p; }
  function slotLabel(key){ var m=ES?ES.SLOTS.filter(function(x){return x.key===key;})[0]:null; return m?m.label:key; }
  function attuneBtn(it, idx){
    if(!it.reqAttune) return '';
    if(it.attuned) return '<button class="eq-pill on" data-at="'+idx+'" title="Attuned \u2014 tap to release">\u2726 Attuned</button>';
    if(capFull)    return '<button class="eq-pill capped" data-at="'+idx+'" title="Attunement limit (3 of 3) \u2014 release one first">\u2726 Attune</button>';
    return '<button class="eq-pill" data-at="'+idx+'">\u2726 Attune</button>';
  }

  // ── the paper-doll (only when EquipSlots is present) ──
  var slotsBox=root.querySelector('[data-equip-slots]');
  if(slotsBox){
    if(ES){
      slotsBox.innerHTML=ES.SLOTS.map(function(s){
        var it=null, idx=-1;
        for(var k=0;k<inventory.length;k++){ if(inventory[k] && inventory[k].slot===s.key){ it=inventory[k]; idx=k; break; } }
        if(!it) return '<div class="eq-slot empty'+(s.ac?' ac':'')+'" data-slot="'+esc(s.key)+'"><span class="sl-k">'+esc(s.label)+'</span><span class="sl-item">\u2014 empty \u2014</span></div>';
        var star=it.attuned?'<span class="sl-star">\u2726</span>':'';
        return '<div class="eq-slot filled'+(s.ac?' ac':'')+'" data-slot="'+esc(s.key)+'"><span class="sl-k">'+esc(s.label)+'</span><span class="sl-item">'+esc(it.name||'Item')+star+'</span><button class="sl-x" data-un="'+esc(s.key)+'" title="Unequip">Unequip</button></div>';
      }).join('');
    } else { slotsBox.innerHTML=''; }
  }
  // attunement summary row (pips + cap note)
  var attuneBox=root.querySelector('[data-equip-attune]');
  if(attuneBox) attuneBox.innerHTML='<span class="cap-note">'+(capFull?'Limit reached':'')+'</span>Attuned <span class="att-pips">'+pipRow()+'</span>';

  // ── the ONE manifest: every item, worn-first, worn tagged with its slot ──
  var box = root.querySelector('[data-equip]');
  if(box){
    var GM=(typeof window!=='undefined'&&window.GearManager)?window.GearManager:((typeof globalThis!=='undefined'&&globalThis.GearManager)?globalThis.GearManager:null);
    if(GM){ GM.render(box,{inventory:inventory,currency:currency,strScore:strScore,ES:ES}); GM.bind(box); }
    else {
    var order={}; if(ES) ES.SLOTS.forEach(function(s,i){ order[s.key]=i; });
    var rows=inventory.map(function(it,i){ return { it:it, i:i }; });
    if(ES) rows.sort(function(a,b){
      var aw=a.it.slot?0:1, bw=b.it.slot?0:1;
      if(aw!==bw) return aw-bw;
      if(a.it.slot&&b.it.slot) return (order[a.it.slot]||0)-(order[b.it.slot]||0);
      return a.i-b.i;
    });
    var dividerDone=false;
    var items=rows.map(function(r){
      var it=r.it, idx=r.i, worn=!!it.slot, eqp=ES?ES.canEquip(it):false;
      var lead=(ES && !worn && !dividerDone) ? (dividerDone=true, '<div class="inv-div">Carried</div>') : '';
      var mid = worn
        ? '<span class="inv-tag">'+esc(slotLabel(it.slot))+'</span>'
        : '<span class="g-d">'+esc(it.detail||it.typeLabel||it.rarity||'')+'</span>';
      var q=(it.qty && it.qty>1) ? '<span class="g-q">\u00D7'+it.qty+'</span>' : '';
      var ctl = !ES ? '' : (worn
        ? '<button class="eq-pill x" data-un="'+esc(it.slot)+'">Unequip</button>'+attuneBtn(it,idx)
        : (eqp?'<button class="eq-pill" data-eq="'+idx+'">Equip</button>':'')+attuneBtn(it,idx));
      return lead+'<div class="gitem'+(worn?' worn':'')+(it.attuned?' attuned':'')+'">'+ic+'<span class="g-n">'+esc(it.name||'Item')+'</span>'+mid+q+'<span class="g-ctl">'+ctl+'</span></div>';
    }).join('');
    if(!items) items='<div class="gitem" style="opacity:.5"><span class="g-n">No equipment yet</span></div>';
    var coins=[]; ['pp','gp','ep','sp','cp'].forEach(function(k){ if(currency[k]) coins.push('<span class="coin">'+currency[k]+' <small>'+k+'</small></span>'); });
    var coinStr = coins.join(' ') || '<span class="coin">0 <small>gp</small></span>';
    box.innerHTML = items + '<div class="coinline">'+coinStr+'</div>';
    }
  }

  // mirror attunement pips into the left Status block
  var la = root.querySelector('[data-attune]');
  if(la){ la.innerHTML = pipRow(); }
}
// Story + the four traits from the live bio. Empty fields read as a dash, never
// sample prose.
function renderStory(root, bio){
  root=root||document; bio = bio || {};
  var al = root.querySelector('[data-align]');
  if(al && bio.alignment != null && al !== (root.ownerDocument||document).activeElement) al.value = bio.alignment;
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
  setF('ac-warn', cb.acWarn||'');
  var acw=root.querySelector('[data-f="ac-warn"]'); if(acw) acw.title=cb.acWarnFull||'';
  setF('initiative', sgn(cb.initiative));
  var initEl=root.querySelector('[data-chk="init"]'); if(initEl) initEl.setAttribute('data-chk-mod', (cb.initiative||0));
  setF('speed', cb.speed);
  setF('speed-note', cb.speedNote||'');
  var spn=root.querySelector('[data-f="speed-note"]'); if(spn) spn.title=cb.speedReason||'';
  setF('prof', sgn(s.proficiencyBonus));
  setF('spellDC', cb.spellSaveDC!=null?cb.spellSaveDC:'\u2014');
  setF('spellAtk', cb.spellAttackBonus!=null?sgn(cb.spellAttackBonus):'\u2014');
  renderHitDice(root, s, v);
  var hp=(v.hp!=null?v.hp:cb.hp), hpMax=(cb.hpMax!=null?cb.hpMax:cb.hp), temp=(v.hpTemp!=null?v.hpTemp:0), bonus=(v.hpBonus!=null?v.hpBonus:0), effMax=(hpMax||0)+(bonus||0);
  setF('hp', hp); setF('hpMaxBig', '/ '+effMax); setF('hpCurrent', 'Current '+hp+' / '+effMax);
  setF('hpTemp', temp>0?('+'+temp+' Temp'):'');
  setF('hpTempVal', temp); setF('hpBonusVal', bonus);
  // Bar segments in HP-value order: current (green) · missing (empty track) · bonus-max
  // headroom (blue) · temp (gold). Missing HP is the dark track, never blue, so it can't
  // be mistaken for a bonus-max buffer.
  var hpTotal=effMax+temp;
  var hpw=function(n){ return clamp(hpTotal>0?((n<0?0:n)/hpTotal*100):0); };
  var mainShown=Math.min(hp, effMax);
  styleF('hpfill','width',hpw(mainShown)+'%');
  styleF('hpgap','width',hpw(Math.max(0, hpMax-hp))+'%');
  styleF('hpbonusbar','width',hpw(Math.max(0, effMax-Math.max(hp, hpMax)))+'%');
  styleF('hptemp','width',hpw(temp)+'%');
  // colour states off the base max: bloodied <=50%, critical <=20%, down at 0
  var hpRatio=(hpMax>0 ? hp/hpMax : 1), hpCard=root.querySelector('.hpmed');
  if(hpCard){
    hpCard.classList.toggle('hp-down', hp<=0);
    hpCard.classList.toggle('hp-critical', hp>0 && hpRatio<=0.2);
    hpCard.classList.toggle('hp-bloodied', hp>0 && hpRatio>0.2 && hpRatio<=0.5);
  }
  var senses=cb.senses||s.senses||{};
  setF('darkvision', senses.darkvision?(senses.darkvision+' ft'):'\u2014');
  setF('passivePerception', s.passivePerception);
  setF('passiveInsight', s.passiveInsight);
  var langs=(s.proficiencies&&s.proficiencies.languages)||s.languages;
  if(langs!=null) setF('languages', Array.isArray(langs)?langs.join(' \u00B7 '):langs);
  setStatus(root, v);
  var notes=(char.notes!=null?char.notes:s.notes);
  var ntEl=root.querySelector('[data-notes]');
  if(ntEl && notes!=null && ntEl!==(root.ownerDocument||document).activeElement) ntEl.value=notes;
  renderAbilities(root, ab); renderSaves(root, s); renderSkills(root, s.skills); renderFeatures(root, s.features, s.customFeatures);
  renderSpellcasting(root, s.spellcasting||{});
  renderConcentration(root, v);
  renderActions(root, s, char.inventory);
  renderTrackers(root, s, v);
  renderEquipment(root, char.inventory, char.currency, (s.abilities&&s.abilities.str&&s.abilities.str.score)||0);
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
// level/key of a slot pool, tolerant of older forged data: read the explicit field, else
// parse "Lvl N" out of the badge, else synthesize the pipState key from the label.
function poolLevelOf(p){ if(p && p.level!=null) return p.level; var m=/(\d+)/.exec((p&&p.badge)||''); return m?+m[0]:0; }
function poolKeyOf(p){ if(p && p.key) return p.key; if(p && p.points) return 'sorcery'; if(p && /pact/i.test(p.label||'')) return 'pactSlots'; var L=poolLevelOf(p); return L>0?('spell_'+L):''; }
// Canonical, LIVE spell-slot pools — keyed into the pipState ledger with `current`
// recomputed from spent. Prefers the forged structural.spellcasting block's pools
// (synthesizing key/level for characters forged BEFORE those were stamped, so they get
// spendable slots with no re-forge), and falls back to the legacy buildSpellcasting
// shape (Roll20/classFeatures characters). Shared by the display (toRenderShape) and the
// cast/spend path (sheet-actions castPools) so they can never disagree about what slots
// exist — the root of the "pips show but tapping a spell says no slots" bug.
function slotPoolsLive(structural, vitals){
  var s=structural||{}, v=vitals||{}, pip=v.pipState||{};
  var raw=(s.spellcasting && Array.isArray(s.spellcasting.pools) && s.spellcasting.pools.length)
            ? s.spellcasting.pools : ((buildSpellcasting(s, v)||{}).pools||[]);
  // Self-heal the third-caster slot label WITHOUT a reforge. An Eldritch Knight / Arcane
  // Trickster forged before the mergeSlotPools fix has its leveled pools baked "Fighter
  // Slots" / "Rogue Slots" (the class name). EK & AT are the only 1/3 subclasses, so a
  // single-class character whose subclass is one of them should read "<subclass> Slots".
  var m3=/Eldritch Knight|Arcane Trickster/.exec(String(s.subclass||''));
  var single=!/\s\/\s/.test(String(s.classLabel||''));               // not multiclassed
  var relabel=(m3 && single) ? (m3[0]+' Slots') : null;
  return raw.map(function(p){
    var key=poolKeyOf(p), max=p.max||0;
    var out=Object.assign({}, p, { key:key, level:poolLevelOf(p), current:Math.max(0, max-(pip[key]||0)) });
    if(relabel && /^spell_/.test(key)) out.label=relabel;            // leveled pools only — never Pact / Sorcery Points
    return out;
  });
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
// base damage plus any editor-added extra components (flat dice), e.g. "1d8+1 Slashing + 1d8 Fire"
function dmgFullFrag(a, dmgMod){
  var s=dmgFrag(a.dmgDice, dmgMod, a.dmgType);
  (a.extraDamage||[]).forEach(function(c){ if(c && c.dice) s+=(s?' <span class="ac-plus">+</span> ':'')+dmgFrag(c.dice, (+c.bonus||0), c.type); });
  return s;
}
var AE_PENCIL='<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" stroke-width="1.7" stroke-linejoin="round"/></svg>';
var AE_EYE='<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" stroke-width="1.6"/></svg>';
var AE_EYEOFF='<svg viewBox="0 0 24 24" fill="none"><path d="M4 4l16 16" stroke-width="1.6"/><path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5" stroke-width="1.6"/></svg>';
var AE_TRASH='<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" stroke-width="1.6" stroke-linejoin="round"/></svg>';
// inner HTML of a row's meta line (also used by the editor's live preview)
function actionMetaInner(a, s){
  var g=actionGroup(a.type), m=deriveActionMods(a, s);
  if(g==='utility') return esc(a.note||'');
  if(g==='damage') return dmgFullFrag(a, m.dmgMod);
  return (m.abil?'<span class="ac-abil">'+esc(m.abil)+'</span> \u00B7 ':'')+'to hit <b>'+(m.hitMod>=0?'+':'')+m.hitMod+'</b> \u00B7 dmg '+dmgFullFrag(a, m.dmgMod);
}
function actionRowHTML(a, s){
  a=a||{}; var g=actionGroup(a.type);
  var meta=(g==='utility')?'<div class="ac-note">'+actionMetaInner(a,s)+'</div>':'<div class="ac-meta">'+actionMetaInner(a,s)+'</div>';
  var id=esc(a.id||a.label||'');
  var badge=a._edited?'<span class="ac-edited">edited</span>':'';
  var nameHTML=esc(a.label||'');
  // Blue config chip on every ATTACK row: one press to switch the to-hit ability (and on a
  // weapon-cantrip, the bound weapon). It shows the current ability; styling + clickability
  // are CSS-gated to editors (.can-edit). The bound-weapon name stays visible in the label.
  var cfgChip='';
  if(g==='attack' && a.ability){
    var isCant=String(a.id||'').indexOf('cant-')===0;
    cfgChip=' <span class="ac-cfg" data-act-cfg="'+id+'" role="button" tabindex="0" title="'+(isCant?'Switch modifier or weapon':'Switch modifier')+'">'+esc(String(a.ability).toUpperCase())+'<span class="ac-cfg-car">\u25BE</span></span>';
  }
  // per-row editor tools (CSS-hidden until the section is in edit mode); not on utility rows
  var tools=(g==='utility')?'' :
    '<div class="ac-tools">'
    + '<button type="button" class="ac-tool ac-pencil" data-act-edit="'+id+'" aria-label="Customize action">'+AE_PENCIL+'</button>'
    + '<button type="button" class="ac-tool ac-eye'+(a._hidden?' on':'')+'" data-act-hide="'+id+'" aria-label="'+(a._hidden?'Un-hide action':'Hide action')+'">'+(a._hidden?AE_EYEOFF:AE_EYE)+'</button>'
    + '<button type="button" class="ac-tool ac-del" data-act-del="'+id+'" aria-label="Delete action" title="Delete">'+AE_TRASH+'</button>'
    + '</div>';
  return '<div class="act '+g+(a._hidden?' is-hidden':'')+(a._edited?' edited':'')+'" data-act="'+id+'"'+(g==='utility'?'':' tabindex="0" role="button"')+'>'
       + '<div class="ac-main"><div class="ac-n">'+nameHTML+cfgChip+badge+'</div>'+meta+'</div>'
       + (g==='utility'?'':'<span class="ac-go">roll</span>')
       + (g==='utility'?'':'<button type="button" class="ac-swap" data-act-swap="'+id+'" aria-label="Swap this attack" title="Swap this attack">\u25BE</button>')
       + tools
       + '</div>';
}
function renderActions(root, s, inventory){
  root=root||document; s=s||{};
  ensureActionEditorStyle(root.ownerDocument || (typeof document!=='undefined'?document:null));
  var sec=root.querySelector('[data-sec="actions"]'), host=root.querySelector('[data-list="actions"]');
  // weapon + weapon-cantrip attacks derive live from carried weapons; structural.actions
  // holds the rest. assembleActions is the single source the click handler shares.
  // includeHidden:true keeps editor-hidden rows in the DOM (greyed, CSS-hidden until edit
  // mode) so they can be un-hidden; the rolling path uses the default (hidden dropped).
  var list=assembleActions(inventory, s, { includeHidden:true });
  if(sec) sec.style.display = list.length ? '' : 'none';
  if(!host) return;
  var groups=[['attack','Attacks'],['damage','Bonus damage'],['utility','Utility']];
  host.innerHTML = groups.map(function(gp){
    var rows=list.filter(function(a){ return actionGroup(a.type)===gp[0]; });
    if(!rows.length) return '';
    return '<div class="agrp"><div class="agrp-h">'+gp[1]+'</div>'+rows.map(function(a){ return actionRowHTML(a, s); }).join('')+'</div>';
  }).join('')
  + '<button type="button" class="ac-add" data-act-add>+ Add your own attack</button>'
  + removedDrawerHTML(assembleActions(inventory, s, { includeRemoved:true }));
}
// editor-only drawer of deleted actions, each with Restore. CSS-hidden until edit mode.
function removedDrawerHTML(removed){
  if(!removed || !removed.length) return '';
  var rows=removed.map(function(a){
    return '<div class="ac-rrow"><span class="ac-rn">'+esc(a.label||'(unnamed)')+'</span>'
      + '<button type="button" class="ac-restore" data-act-restore="'+esc(a.id||a.label||'')+'">Restore</button></div>';
  }).join('');
  return '<div class="ac-removed"><div class="ac-removed-h">Removed \u00b7 '+removed.length+'</div>'+rows+'</div>';
}
function ordModStr(n){ return n>=0?'+'+n:''+n; }
function d20CardHTML(d){ d=d||{}; var kept='<span class="rcd-die'+(d.isCrit?' nat20':(d.isFumble?' nat1':''))+'">'+d.kept+'</span>'; return d.twin?kept+'<span class="rcd-die drop">'+d.dropped+'</span>':kept; }
// one result-card damage line per typed component (the editor's multi-type stack)
function dmgPartsHTML(parts, crit){
  return (parts||[]).map(function(p){
    var lab = p.type ? esc(p.type) : (crit?'Crit dmg':'Damage');
    return '<div class="rcd-line"><span class="rcd-lab">'+lab+'</span><span class="rcd-expr">['+(p.rolls||[]).join('][')+']'+(p.mod?' '+ordModStr(p.mod):'')+'</span><span class="rcd-tot dmg">'+p.total+'</span></div>';
  }).join('');
}
function actionResultHTML(r, latest){
  var inner;
  if(r.kind==='utility') inner='<div class="rcd-n">'+esc(r.name)+'</div><div class="rcd-note">'+esc(r.main||'')+'</div>';
  else if(r.kind==='check') inner='<div class="rcd-n">'+esc(r.name)+'</div><div class="rcd-line"><span class="rcd-lab">Roll</span><span class="rcd-expr">'+d20CardHTML(r.d20)+' '+ordModStr(r.mod||0)+(r.bless?' +'+r.bless+'\uD83D\uDE4F':'')+'</span><span class="rcd-tot">'+r.total+'</span></div>';
  else if(r.kind==='damage'){
    inner='<div class="rcd-n">'+esc(r.name)+'</div>';
    if(r.dmgParts && r.dmgParts.length) inner+=dmgPartsHTML(r.dmgParts, false);
    else inner+='<div class="rcd-line"><span class="rcd-lab">Damage</span><span class="rcd-expr">['+(r.dmgRolls||[]).join('][')+']'+(r.dmgMod?' '+ordModStr(r.dmgMod):'')+'</span><span class="rcd-tot dmg">'+r.dmgTotal+'</span></div><div class="rcd-type">'+esc(r.dmgType||'')+'</div>';
  }
  else { var flag=r.isCrit?'<span class="rcd-flag crit">\u2605 Crit</span>':(r.isFumble?'<span class="rcd-flag miss">\u2717 Nat 1</span>':'');
    inner='<div class="rcd-n">'+esc(r.name)+flag+'</div>'
      + '<div class="rcd-line"><span class="rcd-lab">To hit</span><span class="rcd-expr">'+d20CardHTML(r.d20)+' '+ordModStr(r.hitMod||0)+(r.bless?' +'+r.bless+'\uD83D\uDE4F':'')+'</span><span class="rcd-tot">'+r.total+'</span></div>';
    if(r.dmgParts && r.dmgParts.length) inner+=dmgPartsHTML(r.dmgParts, r.isCrit);
    else inner+='<div class="rcd-line"><span class="rcd-lab">'+(r.isCrit?'Crit dmg':'Damage')+'</span><span class="rcd-expr">['+(r.dmgRolls||[]).join('][')+']'+(r.dmgMod?' '+ordModStr(r.dmgMod):'')+'</span><span class="rcd-tot dmg">'+r.dmgTotal+'</span></div><div class="rcd-type">'+esc(r.dmgType||'')+'</div>';
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
  // Replace the display's slot pools with the canonical LIVE set (keyed into the ledger,
  // current recomputed from spent) so pips deplete + stay spendable — even for characters
  // forged before pools carried a key. Same helper the cast path uses → they never drift.
  if(s.spellcasting){ var livePools=slotPoolsLive(s, v); s.spellcasting=Object.assign({}, s.spellcasting, { pools:livePools }); }
  s.spellcasting=applySpellCorrections(s.spellcasting||{}, s);
  var featureDisplay=applyFeatureCorrections(s.features||[], s); s.features=featureDisplay.features;
  if(!s.resources) s.resources=buildResources(s, v);
  if(v.inspiration==null && s.inspiration!=null) v.inspiration=s.inspiration;
  // ── Display inventory: assign equipment slots so the paper-doll is populated
  // even for imported PCs whose items carry no slot yet (deterministic best-fit;
  // the controller persists this on the first equip change). Then derive live
  // Armour Class from worn armour — slots win, an un-slotted bag falls back to
  // "best you own" so AC is unchanged until you equip. Clone combat so we never
  // mutate the source structural; worn armour also stamps Stealth disadvantage. ──
  var ESL=(typeof window!=='undefined'&&window.EquipSlots)?window.EquipSlots:((typeof globalThis!=='undefined'&&globalThis.EquipSlots)?globalThis.EquipSlots:null);
  var AAC=(typeof window!=='undefined'&&window.ArmorAC)?window.ArmorAC:((typeof globalThis!=='undefined'&&globalThis.ArmorAC)?globalThis.ArmorAC:null);
  var inv=cd.inventory||[];
  if(ESL && inv.length && !inv.some(function(it){return it&&it.slot;}) && inv.some(function(it){return ESL.canEquip(it);})){
    inv=ESL.backfillSlots(inv, AAC?{ score:function(it){ var i2=AAC.classifyArmor(it); return i2?(i2.base+(i2.magic||0)):0; } }:undefined);
  }
  if(AAC){
    var ac=AAC.deriveAC(inv, s, v), cbA=Object.assign({}, s.combat||{});
    cbA.ac=ac.ac; cbA.acSource=ac.source;
    if(cbA.speed!=null && AAC.deriveSpeed){ var move=AAC.deriveSpeed(cbA.speed, s, ac); cbA.speed=move.speed; cbA.speedNote=move.note; cbA.speedReason=move.reason; }
    if(ac.notProficient){ cbA.acWarn='not proficient'; cbA.acWarnFull=(ac.profReason||'Not proficient')+' \u2014 disadvantage on Str/Dex rolls; can\u2019t cast'; }
    s.combat=cbA;
    if(ac.stealthDisadvantage){ s.skills=(s.skills||[]).map(function(sk){ return sk.name==='Stealth'?Object.assign({}, sk, { dis:true, disReason:ac.disReason||((ac.body||'Worn armour')+' \u2014 Stealth disadvantage') }):sk; }); }
  }
  return { structural:s, vitals:v, notes:(cd.notes!=null?cd.notes:s.notes), inventory:inv, currency:(cd.currency||{}), bio:(cd.bio||{}) };
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
// Action-editor styles, injected once per document (mirrors ensureDefs) so the editor
// ships self-contained no matter which host the sheet mounts into. Scoped under
// .tok-sheet; palette matches the v11 Metaphor sheet.
var AE_CSS = `<style id="tok-ae-css">
.tok-sheet .act-edit-btn{display:none;margin-left:auto;font:600 11px/1 'Oswald',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#e7c279;background:rgba(199,154,74,.10);border:1px solid #c79a4a;border-radius:999px;padding:5px 12px;cursor:pointer;transition:background .15s,color .15s}
.tok-sheet [data-sec="actions"].can-edit .act-edit-btn{display:inline-block}
.tok-sheet [data-sec="actions"].can-edit .sectitle .hint{display:none}
.tok-sheet .act-edit-btn.on{background:#c79a4a;color:#241a08}
.tok-sheet .ac-tools{display:none;align-items:center;gap:4px;margin-left:8px}
.tok-sheet .actionlist.editing .ac-tools{display:flex}
.tok-sheet .actionlist.editing .act{cursor:default}
.tok-sheet .actionlist.editing .act .ac-go{display:none}
.tok-sheet .ac-tool{width:30px;height:30px;border-radius:7px;border:1px solid #3a564f;background:rgba(255,255,255,.03);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:border-color .15s,background .15s}
.tok-sheet .ac-tool svg{width:14px;height:14px}
.tok-sheet .ac-tool svg path,.tok-sheet .ac-tool svg circle{stroke:#b9b0a0}
.tok-sheet .ac-tool:hover{border-color:#c79a4a}
.tok-sheet .ac-tool.on{border-color:#c79a4a;background:rgba(199,154,74,.12)}
.tok-sheet .ac-tool.on svg path,.tok-sheet .ac-tool.on svg circle{stroke:#e7c279}
.tok-sheet .act.is-hidden{display:none}
.tok-sheet .actionlist.editing .act.is-hidden{display:flex;opacity:.42}
.tok-sheet .actionlist.editing .act.is-hidden .ac-n{text-decoration:line-through;text-decoration-color:#cf3b2c}
/* delete tool — red intent; arms to a "Delete?" pill on first click (confirm on second) */
.tok-sheet .ac-del:hover{border-color:#cf3b2c;background:rgba(207,59,44,.12)}
.tok-sheet .ac-del:hover svg path{stroke:#e8a59c}
.tok-sheet .ac-del.armed{width:auto;padding:0 9px;border-color:#cf3b2c;background:rgba(207,59,44,.18);color:#f0a99f;font:600 9px/1 "Oswald",sans-serif;letter-spacing:.06em;text-transform:uppercase}
/* + Add your own attack */
.tok-sheet .ac-add{display:none}
.tok-sheet .actionlist.editing .ac-add{display:block;width:100%;margin-top:8px;padding:9px;border:1px dashed #3a564f;border-radius:8px;background:rgba(85,196,192,.05);color:#9fb8b3;font:600 10px/1 "Oswald",sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:border-color .15s,background .15s,color .15s}
.tok-sheet .actionlist.editing .ac-add:hover{border-color:#55c4c0;background:rgba(85,196,192,.12);color:#cdeae7}
/* Removed drawer */
.tok-sheet .ac-removed{display:none}
.tok-sheet .actionlist.editing .ac-removed{display:block;margin-top:10px;border-top:1px solid rgba(236,226,205,.1);padding-top:8px}
.tok-sheet .ac-removed-h{font:600 8.5px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8d8675;margin-bottom:6px}
.tok-sheet .ac-rrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 8px;border-radius:6px}
.tok-sheet .ac-rrow+.ac-rrow{margin-top:2px}
.tok-sheet .ac-rn{font:italic 13px/1.2 "EB Garamond",serif;color:#9a9381;text-decoration:line-through;text-decoration-color:rgba(207,59,44,.5)}
.tok-sheet .ac-restore{font:600 8.5px/1 "Oswald",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#55c4c0;background:transparent;border:1px solid rgba(85,196,192,.4);border-radius:999px;padding:5px 11px;cursor:pointer;transition:background .14s,border-color .14s}
.tok-sheet .ac-restore:hover{background:rgba(85,196,192,.14);border-color:rgba(85,196,192,.7)}
.tok-sheet .act.edited{border-left:3px solid #55c4c0}
.tok-sheet .ac-edited{font:600 9px/1 'Oswald',sans-serif;letter-spacing:.7px;text-transform:uppercase;color:#55c4c0;border:1px solid #55c4c0;border-radius:4px;padding:2px 5px;margin-left:7px;vertical-align:1px}
.tok-sheet .ac-plus{color:#b9b0a0;opacity:.7}
.tok-sheet .ae-editor{margin:-2px 0 8px;border:1px solid #c79a4a;border-top:none;border-radius:0 0 10px 10px;background:linear-gradient(180deg,rgba(199,154,74,.06),rgba(0,0,0,.12));padding:13px 12px 12px}
.tok-sheet .ae-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 11px}
.tok-sheet .ae-f{display:flex;flex-direction:column;gap:4px}
.tok-sheet .ae-f.wide{grid-column:1/-1}
.tok-sheet .ae-f label{font:500 10px/1 'Oswald',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#b9b0a0}
.tok-sheet .ae-f input[type=text],.tok-sheet .ae-f input[type=number],.tok-sheet .ae-f select{background:#10201e;border:1px solid #3a564f;border-radius:7px;color:#ece2cd;font:15px 'EB Garamond',serif;padding:7px 8px;width:100%}
.tok-sheet .ae-f input:focus,.tok-sheet .ae-f select:focus{outline:none;border-color:#c79a4a}
.tok-sheet .ae-f.check{flex-direction:row;align-items:center;gap:8px;padding-top:17px}
.tok-sheet .ae-f.check input{width:18px;height:18px;accent-color:#c79a4a}
.tok-sheet .ae-f.check label{letter-spacing:.6px}
.tok-sheet .ae-dmg{grid-column:1/-1;border:1px solid #3a564f;border-radius:9px;padding:9px 9px 10px;background:rgba(0,0,0,.12)}
.tok-sheet .ae-dmg-h{display:flex;align-items:center;gap:8px;font:500 10px/1 'Oswald',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#b9b0a0;margin-bottom:7px}
.tok-sheet .ae-dmg-h .ln{flex:1;height:1px;background:#3a564f}
.tok-sheet .ae-dhdr{display:grid;grid-template-columns:70px 54px 1fr auto;gap:6px}
.tok-sheet .ae-dhdr span{font:500 9px/1 'Oswald',sans-serif;letter-spacing:.7px;text-transform:uppercase;color:#b9b0a0}
.tok-sheet .ae-drow{display:grid;grid-template-columns:70px 54px 1fr auto;gap:6px;align-items:center;margin:6px 0}
.tok-sheet .ae-drow input{background:#10201e;border:1px solid #3a564f;border-radius:7px;color:#ece2cd;font:15px 'EB Garamond',serif;padding:6px 7px;width:100%}
.tok-sheet .ae-drow input:focus{outline:none;border-color:#c79a4a}
.tok-sheet .ae-tag{font:500 9px/1 'Oswald',sans-serif;letter-spacing:.4px;text-transform:uppercase;color:#55c4c0;border:1px solid #55c4c0;border-radius:5px;padding:5px 6px;white-space:nowrap}
.tok-sheet .ae-del{width:30px;height:30px;border-radius:7px;border:1px solid #3a564f;background:rgba(255,255,255,.03);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:all .14s}
.tok-sheet .ae-del svg{width:13px;height:13px}
.tok-sheet .ae-del svg path{stroke:#b9b0a0}
.tok-sheet .ae-del:hover{border-color:#cf3b2c}.tok-sheet .ae-del:hover svg path{stroke:#cf3b2c}
.tok-sheet .ae-del.armed{width:auto;padding:0 10px;border-color:#cf3b2c;background:rgba(207,59,44,.16);color:#cf3b2c;font:500 10px/1 'Oswald',sans-serif;letter-spacing:.7px;text-transform:uppercase}
.tok-sheet .ae-add{margin-top:8px;width:100%;font:500 11px/1 'Oswald',sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#e7c279;background:rgba(199,154,74,.08);border:1px dashed #c79a4a;border-radius:8px;padding:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.tok-sheet .ae-add:hover{background:rgba(199,154,74,.16)}
.tok-sheet .ae-add svg{width:13px;height:13px}.tok-sheet .ae-add svg path{stroke:#e7c279}
.tok-sheet .ae-pv{grid-column:1/-1;margin-top:2px;padding:8px 10px;border-radius:8px;background:#10201e;border:1px dashed #3a564f;font:14px 'EB Garamond',serif;color:#b9b0a0;line-height:1.4}
.tok-sheet .ae-pv .pvn{font-weight:500;color:#ece2cd}
.tok-sheet .ae-pv b{color:#ece2cd;font-weight:500}.tok-sheet .ae-pv .ac-abil{color:#55c4c0}
.tok-sheet .ae-act{display:flex;gap:7px;margin-top:12px;align-items:center}
.tok-sheet .ae-act .sp{flex:1}
.tok-sheet .ae-btn{font:600 12px/1 'Oswald',sans-serif;letter-spacing:.8px;text-transform:uppercase;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid #3a564f;background:transparent;color:#ece2cd}
.tok-sheet .ae-btn.save{background:#c79a4a;border-color:#c79a4a;color:#241a08}
.tok-sheet .ae-btn.reset{color:#b9b0a0}.tok-sheet .ae-btn.reset:hover{color:#cf3b2c;border-color:#cf3b2c}
.tok-sheet .ae-btn.danger{color:#cf3b2c;border-color:rgba(207,59,44,.5)}.tok-sheet .ae-btn.danger:hover{background:rgba(207,59,44,.12)}
/* armor-AC surfacing: Stealth-disadvantage badge on the skill row, AC non-proficiency warning, speed-penalty note */
.tok-sheet .skill .sk-dis{font:700 8px/1 'Oswald',sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#cf3b2c;border:1px solid rgba(207,59,44,.55);border-radius:3px;padding:2px 4px}
.tok-sheet .skill.dis .sk-v{color:#cf3b2c}
.tok-sheet .sheet-warn{font:600 9px/1.2 'Oswald',sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#cf3b2c;margin-top:3px}
.tok-sheet .sheet-warn:empty{display:none}
.tok-sheet .med .spd-note{color:#cf3b2c;font:600 11px/1.1 'Oswald',sans-serif;letter-spacing:.4px}
.tok-sheet .med .spd-note:empty{display:none}
/* ── equipment: paper-doll + one inventory manifest (equip / attune) ── */
.tok-sheet .eq-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}
.tok-sheet [data-equip-attune]{display:flex;align-items:center;gap:8px;font:400 11px/1 'Oswald',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#c2b99f}
.tok-sheet [data-equip-attune] .att-pips{display:inline-flex;gap:7px}
.tok-sheet [data-equip-attune] .pip{width:12px;height:12px;transform:rotate(45deg);border:1.5px solid #e7c279;background:transparent;filter:none;transition:background .15s}
.tok-sheet [data-equip-attune] .pip.on{background:#e7c279}
.tok-sheet .cap-note{font:600 9px/1 'Oswald',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e7c279;opacity:.85}
.tok-sheet .cap-note:empty{display:none}
.tok-sheet .eq-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tok-sheet .eq-grid:empty{display:none}
.tok-sheet .eq-slot{position:relative;border:1px solid rgba(199,154,74,.34);background:rgba(6,14,13,.78);border-radius:3px;padding:9px 11px 10px;min-height:46px;display:flex;flex-direction:column;gap:4px;justify-content:center}
.tok-sheet .eq-slot .sl-k{font:600 8.5px/1 'Oswald',sans-serif;letter-spacing:.17em;text-transform:uppercase;color:#8d8675}
.tok-sheet .eq-slot .sl-item{font-family:'EB Garamond',serif;font-size:14.5px;color:#f9f3e6;display:flex;align-items:center;gap:6px;line-height:1.15}
.tok-sheet .eq-slot .sl-star{color:#e7c279;font-size:12px;line-height:1}
.tok-sheet .eq-slot.empty{border-style:dashed;border-color:rgba(236,226,205,.13)}
.tok-sheet .eq-slot.empty .sl-item{color:#8d8675;font-style:italic;opacity:.6;font-size:13px}
.tok-sheet .eq-slot.ac::after{content:"AC";position:absolute;top:7px;right:9px;font:600 7.5px/1 'Oswald',sans-serif;letter-spacing:.12em;color:#e7c279;opacity:.5}
.tok-sheet .eq-slot .sl-x{display:none;position:absolute;bottom:7px;right:9px;font:600 8px/1 'Oswald',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#e0584a;background:none;border:0;cursor:pointer;padding:0}
.tok-sheet [data-sec="inventory"].can-edit .eq-slot.filled:hover .sl-x,.tok-sheet [data-sec="inventory"].can-edit .eq-slot.filled:focus-within .sl-x{display:block}
.tok-sheet .gitem.worn .g-n{color:#e7c279;font-weight:500}
.tok-sheet .gitem.attuned .g-n{color:#e7c279}
.tok-sheet .inv-tag{font:600 8.5px/1 'Oswald',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e7c279;border:1px solid rgba(199,154,74,.5);border-radius:4px;padding:3px 6px;background:rgba(199,154,74,.08)}
.tok-sheet .inv-div{font:600 8.5px/1 'Oswald',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#8d8675;opacity:.55;padding:13px 0 7px;margin-top:4px;border-top:1px solid rgba(236,226,205,.13)}
.tok-sheet .g-ctl{margin-left:auto;display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.tok-sheet .eq-pill{display:none;font:600 9px/1 'Oswald',sans-serif;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:5px 11px;cursor:pointer;border:1px solid #c79a4a;background:rgba(199,154,74,.10);color:#e7c279;transition:background .15s,color .15s,opacity .15s}
.tok-sheet [data-sec="inventory"].can-edit .eq-pill{display:inline-flex;align-items:center;gap:4px}
.tok-sheet .eq-pill:hover{background:rgba(199,154,74,.22)}
.tok-sheet .eq-pill.on{background:#c79a4a;color:#241c11;border-color:#c79a4a}
.tok-sheet .eq-pill.capped{opacity:.32;cursor:not-allowed;border-style:dashed}
.tok-sheet .eq-pill.x{border-color:rgba(224,88,74,.5);color:#e0584a;background:rgba(207,59,44,.10)}
.tok-sheet .eq-pill.x:hover{background:rgba(207,59,44,.2)}
.tok-sheet .ac-bind{color:inherit}
.tok-sheet [data-sec="actions"].can-edit .ac-bind{cursor:pointer;color:#55c4c0;border-bottom:1px dashed rgba(85,196,192,.45);transition:color .15s,border-color .15s}
.tok-sheet [data-sec="actions"].can-edit .ac-bind:hover{color:#7fd6d2;border-bottom-color:rgba(85,196,192,.85)}
.tok-sheet .ac-bind-caret{font-size:.78em;margin-left:3px;opacity:.7}
.tok-sheet [data-sec="actions"]:not(.can-edit) .ac-bind-caret{display:none}
/* blue config chip — editors only; a viewer sees the ability in the meta line instead */
.tok-sheet .ac-cfg{display:none}
.tok-sheet [data-sec="actions"].can-edit .ac-cfg{display:inline-flex;align-items:center;gap:3px;font:500 8.5px/1 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#55c4c0;border:1px solid rgba(85,196,192,.4);background:rgba(85,196,192,.08);padding:2px 6px;margin-left:6px;cursor:pointer;vertical-align:middle;transition:background .14s,border-color .14s}
.tok-sheet [data-sec="actions"].can-edit .ac-cfg:hover{background:rgba(85,196,192,.18);border-color:rgba(85,196,192,.7);color:#7fd6d2}
.tok-sheet .ac-cfg-car{font-size:.9em;opacity:.75}
/* chip popover: a Weapon section + a Modifier section */
.sa-pop.sa-cfg{min-width:206px}
.sa-pop.sa-cfg .sa-grp{font:600 8.5px/1 'Oswald',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8d8675;padding:8px 4px 5px;border-top:1px solid rgba(236,226,205,.1);margin-top:4px}
.sa-pop.sa-cfg .sa-grp:first-of-type{border-top:0;margin-top:0}
.sa-pop.sa-cfg .cfg-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;font:500 13.5px/1.2 'EB Garamond',serif;color:#ece2cd;background:transparent;border:1px solid transparent;border-radius:6px;padding:7px 9px;cursor:pointer;transition:background .12s,border-color .12s}
.sa-pop.sa-cfg .cfg-opt:hover{background:rgba(85,196,192,.1);border-color:rgba(85,196,192,.3)}
.sa-pop.sa-cfg .cfg-opt .sub{font:italic 11px/1 'EB Garamond',serif;color:#8d8675}
.sa-pop.sa-cfg .cfg-opt .chk{color:#55c4c0;font-size:13px}
.sa-pop.sa-bind{min-width:184px}
.sa-pop.sa-bind .bind-list{display:flex;flex-direction:column;gap:2px;margin-top:7px}
.sa-pop.sa-bind .bind-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;font:500 13.5px/1.25 'EB Garamond',serif;color:#ece2cd;background:transparent;border:1px solid transparent;border-radius:7px;padding:8px 10px;cursor:pointer;transition:background .12s,border-color .12s}
.sa-pop.sa-bind .bind-opt:hover{background:rgba(85,196,192,.10);border-color:rgba(85,196,192,.32)}
.sa-pop.sa-bind .bind-opt.on{background:rgba(85,196,192,.14);border-color:rgba(85,196,192,.5);color:#f9f3e6}
.sa-pop.sa-bind .bind-chk{color:#55c4c0;font-weight:700}
.tok-sheet .ac-swap{display:none;flex:0 0 auto;width:24px;height:24px;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;border-radius:6px;color:#8d8675;cursor:pointer;opacity:.55;font-size:12px;transition:opacity .15s,color .15s,background .15s,border-color .15s}
.tok-sheet [data-sec="actions"].can-edit .act:not(.is-hidden) .ac-swap{display:inline-flex}
.tok-sheet .ac-swap:hover{opacity:1;color:#55c4c0;border-color:rgba(85,196,192,.35);background:rgba(85,196,192,.08)}
.sa-pop.sa-swap{min-width:212px}
.sa-pop.sa-swap .swap-list{display:flex;flex-direction:column;gap:2px;margin-top:7px}
.sa-pop.sa-swap .swap-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;font:500 13.5px/1.25 'EB Garamond',serif;color:#ece2cd;background:transparent;border:1px solid transparent;border-radius:7px;padding:8px 10px;cursor:pointer;transition:background .12s,border-color .12s}
.sa-pop.sa-swap .swap-opt:hover{background:rgba(85,196,192,.10);border-color:rgba(85,196,192,.32)}
.sa-pop.sa-swap .swap-in{font:600 9px/1 'Oswald',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#55c4c0;opacity:.65;white-space:nowrap}
.sa-pop.sa-swap .swap-opt:hover .swap-in{opacity:1}
</style>`;
function ensureActionEditorStyle(doc){
  doc = doc || (typeof document!=='undefined'?document:null); if(!doc) return;
  if (doc.getElementById('tok-ae-css')) return;
  (doc.head || doc.body || doc.documentElement).insertAdjacentHTML('beforeend', AE_CSS);
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
          <div class="med hot"><div class="lab">Armor Class</div><div class="big" data-f="ac">14</div><div class="sub" data-f="ac-sub">studded leather</div><div class="sheet-warn" data-f="ac-warn"></div></div>
          <div class="med roll-chk" data-chk="init" data-chk-label="Initiative" data-chk-mod="0" tabindex="0" role="button"><div class="lab">Initiative</div><div class="big" data-f="initiative">+2</div><div class="sub">dexterity</div></div>
        </div>
        <div class="med hpmed hot">
          <div class="lab">Hit Points</div>
          <div class="big"><span data-f="hp">18</span> <span style="font-size:23px;color:var(--cream-dim)" data-f="hpMaxBig">/ 23</span></div>
          <div class="hpbar-row">
            <button type="button" class="step hp-quick" data-hpadj="dmg" aria-label="Take 1 damage">−</button>
            <div class="hpbar"><div class="hpfill" data-f="hpfill"></div><div class="hpgap" data-f="hpgap"></div><div class="hpbonusbar" data-f="hpbonusbar"></div><div class="hptemp" data-f="hptemp"></div></div>
            <button type="button" class="step hp-quick" data-hpadj="heal" aria-label="Heal 1">+</button>
          </div>
          <div class="hpmeta"><span data-f="hpCurrent">Current 18 / 23</span><span class="tmp" data-f="hpTemp">+4 Temp</span></div>
          <div class="hp-adj" data-hp-adj>
            <div class="hp-adj-dh">
              <button type="button" class="step" data-hpadj="amt-" aria-label="Decrease amount">−</button>
              <input type="number" class="hp-amt" data-f-hpamt min="1" value="1" aria-label="Damage or heal amount">
              <button type="button" class="step" data-hpadj="amt+" aria-label="Increase amount">+</button>
              <button type="button" class="hp-btn dmg" data-hpadj="dmgN">Damage</button>
              <button type="button" class="hp-btn heal" data-hpadj="healN">Heal</button>
            </div>
            <div class="hp-adj-tb">
              <span class="hp-adj-lbl temp">Temp</span>
              <button type="button" class="step" data-hpadj="temp-" aria-label="Temp HP down">−</button>
              <span class="hp-adj-val" data-f="hpTempVal">0</span>
              <button type="button" class="step" data-hpadj="temp+" aria-label="Temp HP up">+</button>
              <span class="hp-adj-lbl bonus">Bonus</span>
              <button type="button" class="step" data-hpadj="bonus-" aria-label="Bonus max down">−</button>
              <span class="hp-adj-val" data-f="hpBonusVal">0</span>
              <button type="button" class="step" data-hpadj="bonus+" aria-label="Bonus max up">+</button>
            </div>
          </div>
        </div>
        <div class="med-row">
          <div class="med mini"><div class="lab">Speed</div><div class="big"><span data-f="speed">30</span><span style="font-size:15px;color:var(--cream-dim)">ft</span></div><div class="sub spd-note" data-f="speed-note"></div></div>
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
        <div class="sectitle"><span class="swashwrap"><h2>Actions</h2></span><span class="tail"></span><button class="act-edit-btn" type="button" data-action-edit>Edit</button><span class="hint">tap to roll</span></div>
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

          <div class="corr-bar">
            <button class="corr-health" type="button" data-corr-audit><span class="corr-dot"></span><span data-corr-health>No corrections</span></button>
            <button class="corr-add" type="button" data-corr-add>+ Add spell</button>
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
          <div class="feat-foot">
            <button class="feat-add" type="button" data-cf-add aria-expanded="false">＋ Add feature</button>
            <div class="feat-form" data-cf-form hidden>
              <label>Feature name</label>
              <input type="text" maxlength="60" data-cf-name aria-label="Feature name" placeholder="e.g. Oath of the Wanderer">
              <div class="ff-row2">
                <label>Description</label>
                <textarea data-cf-desc aria-label="Feature description" placeholder="What does this feature do?"></textarea>
              </div>
              <div class="ff-btns">
                <button class="ff-btn" type="button" data-cf-cancel>Cancel</button>
                <button class="ff-btn go" type="button" data-cf-save>Add feature</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- INVENTORY -->
      <div class="block" data-sec="inventory">
        <div class="eq-head">
          <div class="sectitle" style="margin:0;flex:0 1 auto"><span class="swashwrap"><h2>Equipped</h2></span></div>
          <span class="attune-wrap" data-equip-attune></span>
        </div>
        <div class="eq-grid" data-equip-slots></div>
        <div class="sectitle" style="margin-top:22px"><span class="swashwrap"><h2>Inventory</h2></span><span class="tail"></span><span class="hint">your whole kit · worn first</span></div>
        <div class="panelbox" data-equip></div>
      </div>

      <!-- BIO -->
      <div class="block" data-sec="bio">
        <div class="sectitle"><span class="swashwrap"><h2>Story</h2></span><span class="tail"></span></div>
        <div class="panelbox">
          <div class="bio-align">
            <span class="ba-lab">Alignment</span>
            <input type="text" class="ba-input" data-align placeholder="e.g. Chaotic Good" maxlength="40" autocomplete="off">
            <span class="ba-status" data-align-status></span>
          </div>
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
          <textarea class="notepad" data-notes placeholder="Write anything here \u2014 saves automatically."></textarea>
          <div class="notes-status" data-notes-status></div>
        </div>
      </div>

      <!-- JOURNAL (field-note capture; hidden until journal-capture.js mounts it.
           display:none is deliberate \u2014 wireSheetTabs owns the hidden ATTRIBUTE,
           so the module's reveal and the tab logic never fight) -->
      <div class="block" data-sec="notes" data-journal-block style="display:none">
        <div class="sectitle">
          <span class="swashwrap"><h2>Journal</h2></span><span class="tail"></span>
          <a class="journal-door-mini" data-journal-door href="#">
            <span class="jd-glyph">\u2766</span><span class="jd-title">Open the Journal</span><span class="jd-arrow">\u2192</span>
          </a>
        </div>
        <div class="panelbox">
          <div class="jc-cap" data-jc-capture></div>
          <div class="jc-list-lab" data-jc-list-lab>Your pages</div>
          <div data-jc-list></div>
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
// The sheet reads two plain-script helpers off `window`: ArmorAC (live Armour
// Class) and EquipSlots (the equipment paper-doll). sheet-v2.html loads them
// statically, but the rail loader (characters-tab.js) and the combat float mount
// the SAME sheet on pages that don't — so the sheet loads its own deps here and
// "just works" wherever it's mounted, instead of every host page having to
// remember the right <script> tags. Idempotent + cached: concurrent mounts share
// one load, an already-present global short-circuits, a failed/blocked load still
// resolves (the render degrades to the plain list rather than hanging).
var __depPromise = null;
function ensureDeps(doc){
  var w = (typeof window!=='undefined') ? window : (typeof globalThis!=='undefined' ? globalThis : null);
  if(!w) return Promise.resolve();
  if(w.ArmorAC && w.EquipSlots && w.GearManager && w.ItemIcons && w.SoulShardsData) return Promise.resolve();
  doc = doc || (typeof document!=='undefined' ? document : null);
  if(!doc || !doc.createElement) return Promise.resolve();   // Node/jsdom-no-DOM: deps are eval'd in by the smoke
  if(__depPromise) return __depPromise;
  function loadScript(src){
    return new Promise(function(res){
      var done=false, fin=function(){ if(!done){ done=true; res(); } };
      try{
        if(doc.querySelector('script[src="'+src+'"]') || doc.querySelector('script[src$="/'+src+'"]')){ fin(); return; }
        var s = doc.createElement('script'); s.src = src; s.async = false;
        s.onload = fin; s.onerror = fin;
        (doc.head || doc.body || doc.documentElement).appendChild(s);
        setTimeout(fin, 4000);   // never hang the sheet if the script can't load — degrade to the plain list
      }catch(_){ fin(); }
    });
  }
  var jobs = [];
  if(!w.ArmorAC)    jobs.push(loadScript('armor-ac.js?v=um1'));
  if(!w.EquipSlots) jobs.push(loadScript('equip-slots.js'));
  if(!w.GearManager) jobs.push(loadScript('gear-manager.js'));
  if(!w.ItemIcons)  jobs.push(loadScript('item-icons.js'));
  // The spell drawer (sheet-actions.js) reads spell text through window.SoulShardsData.
  // sheet-v2.html loads it statically; the rail loader and the combat float mount the
  // sheet on pages that don't — without it, tapping a spell shows "compendium isn't
  // loaded on this page." Self-heal it here like the four above (plain script → window).
  if(!w.SoulShardsData) jobs.push(loadScript('soul-shards-data.js?v=caim1'));
  __depPromise = Promise.all(jobs).then(function(){ return new Promise(function(r){ setTimeout(r, 0); }); });  // let the IIFEs register on window
  return __depPromise;
}
function mountSheet(container, key, opts){
  opts = opts || {};
  var CD = opts.characterData || (typeof window!=='undefined' ? window.CharacterData : null);
  var doc = (container && container.ownerDocument) || (typeof document!=='undefined' ? document : null);
  ensureDefs(doc);
  container.innerHTML = SHEET_TEMPLATE;
  wireSheetTabs(container);
  if (!CD) { showError(container, 'CharacterData not loaded'); return { ready: Promise.resolve() }; }
  var depsReady = ensureDeps(doc);   // armour-AC + equipment-slots, loaded once, shared with the controller below
  var ready = depsReady.then(function(){ return CD.loadCharacter(key); }).then(function(cd){
    if(!cd){ showError(container, 'No character "'+key+'"'); return; }
    renderSheet(container, toRenderShape(cd));
    applyExtras(container, cd);
    mountSheetProgression({ root: container, character: cd, characterData: CD, key: key });
  }).catch(function(e){ console.error('[sheet] mount:', e); showError(container, (e&&e.message)?e.message:'Could not load character'); });
  // inspiration + equipment write-affordances, scoped to this container (sheet-actions.js);
  // depsReady lets the controller's slot backfill wait for EquipSlots so it never races the load.
  try { wireInspiration({ root: container, characterData: CD, key: key, depsReady: depsReady }); } catch(_){}
  return { ready: ready };
}

if (typeof window !== 'undefined') {
  window.mountSheet = mountSheet;
  window.__sheet = { renderSheet: renderSheet, toRenderShape: toRenderShape, renderEquipment: renderEquipment, renderStory: renderStory, wireSheetTabs: wireSheetTabs, buildSpellcasting: buildSpellcasting, renderSpellcasting: renderSpellcasting, slotPoolsLive: slotPoolsLive, buildResources: buildResources, renderResources: renderResources, renderTrackers: renderTrackers, trackerSpecs: trackerSpecs, renderConcentration: renderConcentration, renderActions: renderActions, actionMeta: actionMetaInner, renderActionResult: renderActionResult, deriveActionMods: deriveActionMods, renderHitDice: renderHitDice, applyExtras: applyExtras, mountSheet: mountSheet };
}

export { mountSheet };
