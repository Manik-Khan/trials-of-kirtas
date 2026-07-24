/* ── forge-feed-render.js ─────────────────────────────────────────────
   Shared Forge feed renderer. Damage follows the existing site Battle HUD:
     Dmg: [5] +6 = 11 Slashing
     Crit dmg: [4][5] +6 = 15 Slashing
   Component math is always visible; no hidden tap target and no scalar-only
   success row when dmgParts are present. NO TARGET AC IS EVER SHOWN.          */
(function(root,factory){var api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ForgeFeedRender=api;})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="3.3.0";
  function esc(s){return String(s==null?"":s).replace(/[&<>\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  var VERDICTS={critHit:{label:"✶ CRIT",cls:"ffr-v ffr-v-crit"},hit:{label:"HIT",cls:"ffr-v ffr-v-hit"},miss:{label:"MISS",cls:"ffr-v ffr-v-miss"},fail:{label:"FAIL",cls:"ffr-v ffr-v-fail"},save:{label:"SAVE",cls:"ffr-v ffr-v-save"},fumble:{label:"NAT 1",cls:"ffr-v ffr-v-miss"}};
  function verdictBadge(f){if(f.kind==="save"||f.saveAbility)return f.saved?VERDICTS.save:VERDICTS.fail;if(f.crit&&f.hit)return VERDICTS.critHit;if(f.roll===1&&!f.hit)return VERDICTS.fumble;return f.hit?VERDICTS.hit:VERDICTS.miss;}
  function modTags(f){var t=[];if(f.adv)t.push('<span class="ffr-mod ffr-mod-adv">⇑ adv'+(f.advReason?'·'+esc(f.advReason):'')+'</span>');if(f.dis)t.push('<span class="ffr-mod ffr-mod-dis">⇓ dis</span>');if(f.coverName)t.push('<span class="ffr-mod ffr-mod-cover">'+esc(f.coverName)+'</span>');(f.mods||[]).forEach(function(m){var k=m.k||"mod",label=String(k).replace(/_/g," "),cl=/bless|guidance/.test(k)?"ffr-mod-bless":/silvery/i.test(k)?"ffr-mod-sb":"",v=m.v!=null?Number(m.v):null;t.push('<span class="ffr-mod '+cl+'">'+esc(label)+(m.v!=null?' '+(isFinite(v)&&v>=0?'+':'')+esc(m.v):'')+'</span>');});return t.join(" ");}
  function diceEvidence(rolls,keptIndex,label){
    if(!Array.isArray(rolls)||!rolls.length)return "";
    var out=rolls.map(function(v,i){return '<span class="ffr-die '+(i===Number(keptIndex)?'ffr-keep':'ffr-drop')+'">'+esc(v)+'</span>';}).join(' ');
    return (label?'<span class="ffr-dice-label">'+esc(label)+'</span> ':'')+out;
  }
  function d20MathLine(f){
    var p=[],base=diceEvidence(f.d20Rolls,f.d20KeptIndex,null);
    p.push(base||'<span class="ffr-die">'+esc(f.roll!=null?f.roll:"?")+'</span>');
    var reaction=diceEvidence(f.reactionD20Rolls,f.reactionD20KeptIndex,"SB");
    if(reaction)p.push('<span class="ffr-reaction-dice">'+reaction+'</span>');
    else if(f.dropped!=null)p.push('<span class="ffr-die ffr-drop">'+esc(f.dropped)+'</span>');
    if(f.hitBonus!=null)p.push('<span class="ffr-mod-num">'+(Number(f.hitBonus)>=0?'+':'')+esc(f.hitBonus)+'</span>');
    if(f.rollTotal!=null)p.push('<span class="ffr-total">= '+esc(f.rollTotal)+'</span>');
    else if(f.roll!=null&&f.hitBonus!=null)p.push('<span class="ffr-total">= '+esc(Number(f.roll)+Number(f.hitBonus))+'</span>');
    var tags=modTags(f);if(tags)p.push(tags);return '<div class="ffr-math">'+p.join(' ')+'</div>';
  }
  function rolledDice(part){
    if(part&&part.rolledDice)return part.rolledDice;
    var d=String(part&&part.dice||""),m=/(\d+)d(\d+)/i.exec(d),count=(part&&part.rolls||[]).length;
    return m&&count?count+'d'+m[2]:d;
  }
  function damageLine(part,crit){
    part=part||{};var rolls=(part.rolls||[]).map(function(r){return '['+esc(r)+']';}).join('');
    var b=Number(part.bonus)||0,terms=rolls||esc(rolledDice(part)||part.dice||part.total||0);
    if(b)terms+=' <span class="ffr-dmg-bonus">'+(b>=0?'+':'−')+Math.abs(b)+'</span>';
    return '<div class="ffr-dmg-line"><b>'+(crit?'Crit dmg:':'Dmg:')+'</b> '+terms+' = <b>'+esc(part.total||0)+'</b>'+(part.type?' <span class="ffr-dmg-type">'+esc(part.type)+'</span>':'')+'</div>'+
      '<div class="ffr-dmg-formula">'+esc(rolledDice(part)||part.dice||'0')+(b?' '+(b>=0?'+':'−')+' '+Math.abs(b):'')+(part.type?' '+esc(part.type):'')+'</div>';
  }
  function dmgStackHtml(f){
    if(!f.hit&&f.saved!==false)return "";if(f.dmg==null&&!(f.dmgParts&&f.dmgParts.length))return "";
    var parts=f.dmgParts||[],total=f.dmg!=null?f.dmg:parts.reduce(function(s,p){return s+(Number(p.total)||0);},0);
    var out='<div class="ffr-dmg-wrap">';
    if(parts.length){
      parts.forEach(function(p){out+=damageLine(p,!!f.crit);});
      if(parts.length>1)out+='<div class="ffr-dmg-total">Combined damage: <b>'+esc(total)+'</b></div>';
    }else out+='<div class="ffr-dmg-line ffr-dmg-missing"><b>Dmg:</b> '+esc(total)+' total · dice record missing</div>';
    return out+'</div>';
  }
  function headLine(f,ctx){ctx=ctx||{};var name=ctx.unitName||function(k){return k||"?";},v=verdictBadge(f),s='<span class="ffr-actor">'+esc(name(f.actor||f.unit))+'</span>';if(f.target)s+=' <span class="ffr-arrow">→</span> <span class="ffr-target">'+esc(name(f.target))+'</span>';s+=' <span class="ffr-mode">· '+esc(f.mode||f.ability||f.label||"Attack")+'</span> <span class="'+v.cls+'">'+v.label+'</span>';return '<div class="ffr-head">'+s+'</div>';}
  function saveLine(f){if(!f.saveAbility&&!f.dc)return "";var p=[];if(f.saveAbility)p.push(String(f.saveAbility).toUpperCase()+" save");if(f.saveD20!=null)p.push(String(f.saveD20));if(f.saveBonus!=null)p.push((Number(f.saveBonus)>=0?"+":"")+String(f.saveBonus));(f.saveMods||[]).forEach(function(m){p.push(String(m.k||"mod")+" "+(Number(m.v)>=0?"+":"")+String(m.v));});if(f.saveTotal!=null)p.push("= "+f.saveTotal);else if(f.saveRoll!=null)p.push(String(f.saveRoll));if(f.dc!=null)p.push("vs DC "+f.dc);return '<div class="ffr-save">'+esc(p.join(' '))+'</div>';}
  function healLine(f,ctx){if(f.heal==null)return "";ctx=ctx||{};var name=ctx.unitName||function(k){return k||"?";};return '<div class="ffr-heal">+'+esc(f.heal)+' hp'+(f.target?' → '+esc(name(f.target)):'')+'</div>';}
  function concentrationLine(f){var c=f&&f.concentration;if(!c||!c.required)return "";if(c.automatic)return '<div class="ffr-concentration broken"><b>Concentration:</b> broken on falling unconscious.</div>';var rolled=Array.isArray(c.d20Rolls)&&c.d20Rolls.length?c.d20Rolls.join(' / '):c.roll,parts=['CON',rolled];if(c.adv)parts.push('(War Caster advantage)');if(c.baseBonus)parts.push((Number(c.baseBonus)>=0?'+':'')+c.baseBonus);if(c.bless)parts.push('Bless +'+c.bless);parts.push('= '+c.total,'vs DC '+c.dc);return '<div class="ffr-concentration '+(c.saved?'held':'broken')+'"><b>Concentration:</b> '+esc(parts.join(' '))+' · '+(c.saved?'holds':'broken')+'</div>';}
  function rollBody(f,ctx){if(!f)return "";var p=[headLine(f,ctx)];if(f.roll!=null)p.push(d20MathLine(f));if(f.saveAbility||f.dc)p.push(saveLine(f));if(f.hit||f.saved===false)p.push(dmgStackHtml(f));if(f.heal!=null)p.push(healLine(f,ctx));if(f.concentration)p.push(concentrationLine(f));if(f.narration)p.push('<div class="ffr-narration">'+esc(f.narration)+'</div>');return '<div class="ffr-row">'+p.join('')+'</div>';}
  function abilityBody(f,ctx){if(!f)return "";ctx=ctx||{};var name=ctx.unitName||function(k){return k||"?";},p=['<div class="ffr-head"><span class="ffr-actor">'+esc(name(f.actor||f.unit))+'</span>'+(f.ability?' <span class="ffr-mode">· '+esc(f.ability)+'</span>':'')+'</div>'];(f.effects||[]).forEach(function(e){if(e.dmg)p.push('<div class="ffr-dmg-line"><b>Dmg:</b> '+esc(e.dmg)+' → '+esc(name(e.unit))+'</div>');if(e.heal)p.push('<div class="ffr-heal">+'+esc(e.heal)+' hp → '+esc(name(e.unit))+'</div>');});if(f.narration)p.push('<div class="ffr-narration">'+esc(f.narration)+'</div>');return '<div class="ffr-row">'+p.join('')+'</div>';}
  function assertNoAC(html){return !/\bAC\b/.test(String(html||""));}
  var CSS=[
    ".ffr-row{font-size:13px;line-height:1.42;color:var(--tk-ink,#d4cdb8)}",
    ".ffr-head{font-weight:600;margin-bottom:2px}.ffr-actor{color:var(--tk-gold,#c5a855)}.ffr-target,.ffr-mode,.ffr-arrow{color:var(--tk-ink-2,#a89f8a)}",
    ".ffr-v{display:inline-block;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:700;letter-spacing:.5px;margin-left:4px}.ffr-v-hit{background:#2a6a35;color:#b0e8b0}.ffr-v-crit{background:#7a5a10;color:#ffe680}.ffr-v-miss,.ffr-v-fail{background:#6a2a2a;color:#e8b0b0}.ffr-v-save{background:#2a4a6a;color:#b0d0e8}",
    ".ffr-math{margin:2px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}.ffr-die{display:inline-block;background:rgba(200,190,160,.15);padding:0 4px;border-radius:2px;font-weight:700}.ffr-keep{border:1px solid rgba(216,179,91,.88);box-shadow:inset 0 0 0 1px rgba(255,240,188,.12);color:#fff0bd}.ffr-drop{text-decoration:line-through;opacity:.45}.ffr-reaction-dice{display:inline-flex;align-items:center;gap:3px;padding-left:6px;margin-left:3px;border-left:1px solid rgba(176,160,224,.42)}.ffr-dice-label{font:800 9px/1 system-ui,sans-serif;letter-spacing:.09em;color:#b8a9e7}.ffr-total{font-weight:700}",
    ".ffr-mod{display:inline-block;padding:0 4px;border-radius:2px;font-size:10px;margin-left:3px}.ffr-mod-adv{background:rgba(80,160,80,.25);color:#8ad88a}.ffr-mod-dis{background:rgba(160,80,80,.25);color:#d88a8a}.ffr-mod-cover{background:rgba(100,100,160,.25);color:#a0a0d0}.ffr-mod-bless{background:rgba(180,160,80,.25);color:#d8c860}.ffr-mod-sb{background:rgba(120,100,180,.25);color:#b0a0e0}",
    ".ffr-dmg-wrap{margin:4px 0;padding:5px 7px;border-left:2px solid rgba(216,179,91,.62);background:rgba(0,0,0,.16)}.ffr-dmg-total{font-weight:800;color:#f1e2bd;font-size:14px;margin-bottom:2px}.ffr-dmg-line{font:700 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#fff1cd}.ffr-dmg-bonus{color:#f4c965}.ffr-dmg-type{color:#d7c9aa;font-style:normal}.ffr-dmg-formula{font:600 10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#bdb39e;margin:0 0 3px 2px}.ffr-dmg-missing{color:#ffb5aa}",
    ".ffr-save{font-size:12px;opacity:.85;margin:2px 0}.ffr-heal{font-weight:700;color:#7bd18c;font-size:14px;margin:2px 0}.ffr-concentration{margin:5px 0 1px;padding:4px 6px;border-left:2px solid rgba(216,179,91,.58);background:rgba(216,179,91,.08);font-size:11px}.ffr-concentration.held{color:#c9e6b8;border-left-color:#75aa68}.ffr-concentration.broken{color:#ffc0b2;border-left-color:#bf6654}.ffr-narration{font-style:italic;opacity:.75;margin:2px 0}"
  ].join("\n");
  return {VERSION:VERSION,rollBody:rollBody,abilityBody:abilityBody,headLine:headLine,d20MathLine:d20MathLine,dmgStackHtml:dmgStackHtml,saveLine:saveLine,healLine:healLine,concentrationLine:concentrationLine,verdictBadge:verdictBadge,modTags:modTags,assertNoAC:assertNoAC,CSS:CSS,VERDICTS:VERDICTS};
});
