/* ── forge-damage-evidence.js ─────────────────────────────────────────
   Battle Forge Phase 2f.1 damage evidence release gate.

   The prior decorator ran after addForgeRow(), which is not a safe contract:
   the HUD may repaint its feed after that call, erasing a DOM-only edit. This
   version inserts the evidence into the HTML BEFORE the row enters the HUD.

   It also owns the resolved-event translation seam so dmgParts/dmgFormula are
   carried across local attacks, Supabase echoes, refresh replay, and resync.

   Browser: window.ForgeDamageEvidence. Node: module.exports.               */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeDamageEvidence=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="2.0.0";

  function esc(s){return String(s==null?"":s).replace(/[&<>\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function num(v,f){var n=Number(v);return Number.isFinite(n)?n:(f==null?0:f);}
  function normalizePart(raw,index){
    raw=raw||{};
    var rolls=Array.isArray(raw.rolls)?raw.rolls.map(function(v){return num(v,0);}):[];
    var bonus=num(raw.bonus,0);
    var total=raw.total==null?rolls.reduce(function(a,b){return a+b;},0)+bonus:num(raw.total,0);
    return {index:index||0,dice:raw.dice==null?null:String(raw.dice),rolls:rolls,bonus:bonus,
      type:raw.type==null?"":String(raw.type),label:raw.label==null?"":String(raw.label),total:total};
  }
  function normalizeParts(parts){return Array.isArray(parts)?parts.map(normalizePart):[];}
  function arithmetic(part){
    part=normalizePart(part,0);
    var terms=part.rolls.map(function(r){return "["+r+"]";});
    if(part.bonus)terms.push((part.bonus>=0?"+":"")+part.bonus);
    if(!terms.length&&part.dice)terms.push(part.dice);
    if(!terms.length)terms.push(String(part.total));
    return terms.join(" ")+" = "+part.total+(part.type?" "+part.type:"")+(part.label?" · "+part.label:"");
  }
  function formula(part){
    part=normalizePart(part,0);
    var out=part.dice||((part.rolls.length?part.rolls.length+" dice":"0"));
    if(part.bonus)out+=" "+(part.bonus>=0?"+":"−")+" "+Math.abs(part.bonus);
    if(part.type)out+=" "+part.type;
    if(part.label)out+=" · "+part.label;
    return out;
  }
  function evidenceHtml(parts,total,declaredFormula){
    parts=normalizeParts(parts);
    if(!parts.length)return "";
    return '<div class="forge-damage-evidence-v2" data-damage-evidence="2">'+
      (declaredFormula?'<div class="forge-dmg-declared">'+esc(declaredFormula)+'</div>':"")+
      parts.map(function(p){return '<div class="forge-dmg-component"><span class="forge-dmg-formula">'+
        esc(formula(p))+'</span><span class="forge-dmg-arithmetic">'+esc(arithmetic(p))+'</span></div>';}).join("")+
      '<div class="forge-dmg-check">components = '+esc(parts.reduce(function(n,p){return n+p.total;},0))+
      (total!=null?' · event total = '+esc(total):"")+'</div></div>';
  }
  function attachPayload(fact,payload){
    fact=fact||{};payload=payload||{};
    if(Array.isArray(payload.dmgParts))fact.dmgParts=normalizeParts(payload.dmgParts);
    if(payload.dmgFormula!=null)fact.dmgFormula=String(payload.dmgFormula);
    if(payload.dmg!=null&&fact.dmg==null)fact.dmg=num(payload.dmg,0);
    return fact;
  }
  function injectEvidence(html,fact){
    html=String(html||"");
    if(!fact||!Array.isArray(fact.dmgParts)||!fact.dmgParts.length)return html;
    if(html.indexOf('data-damage-evidence="2"')>=0)return html;
    var block=evidenceHtml(fact.dmgParts,fact.dmg,fact.dmgFormula);
    var at=html.lastIndexOf("</div>");
    return at>=0?html.slice(0,at)+block+html.slice(at):html+block;
  }
  function missingHtml(html,fact){
    if(!fact||fact.hit!==true||fact.dmg==null||Array.isArray(fact.dmgParts)&&fact.dmgParts.length)return html;
    var block='<div class="forge-damage-missing" data-damage-missing="1">Damage evidence missing: this event carried only the total '+esc(fact.dmg)+'.</div>';
    var at=String(html||"").lastIndexOf("</div>");
    return at>=0?html.slice(0,at)+block+html.slice(at):String(html||"")+block;
  }
  function effectFacts(row,api){
    var p=row&&row.payload||{};
    (Array.isArray(p.effects)?p.effects:[]).forEach(function(op){
      if(op&&op.add_effect)api.pushFact({kind:"effect",action:"add",actor:row.unit,target:op.add_effect.target||op.unit,effect:op.add_effect});
      if(op&&op.remove_effect)api.pushFact({kind:"effect",action:"remove",actor:row.unit,target:op.unit,
        effect:{id:op.remove_effect,label:op.effect_label||"Effect",kind:op.effect_kind||"effect"},reason:op.reason||"removed"});
    });
  }
  function install(root){
    root=root||(typeof window!=="undefined"?window:null);
    if(!root||!root.ForgeTableCorrectness)return false;
    var base=root.ForgeTableCorrectness;
    if(base.__damageEvidenceV2)return true;
    var declares=Object.create(null),warned=Object.create(null),proxy=Object.assign({},base);

    proxy.pushFact=function(fact){
      fact=fact||{};
      var html=base.factHtml?base.factHtml(fact):"";
      html=injectEvidence(html,fact);
      html=missingHtml(html,fact);
      if(html&&typeof root.addForgeRow==="function")root.addForgeRow(html,{channel:"table"});
      if(fact.hit===true&&fact.dmg!=null&&!(Array.isArray(fact.dmgParts)&&fact.dmgParts.length)){
        var key=[fact.actor||fact.unit,fact.target,fact.mode,fact.roll,fact.dmg].join("|");
        if(!warned[key]){
          warned[key]=1;
          var msg='<i>Damage evidence gate: '+esc(fact.mode||"attack")+' resolved with a scalar total but no dice components.</i>';
          if(typeof root.addForgeRow==="function")root.addForgeRow(msg,{channel:"system"});
        }
      }
      return html;
    };
    proxy.pushEvent=function(row){
      if(!row)return "";
      if(row.kind==="attack_declared"){
        declares[row.unit]=Object.assign({},row.payload||{});
        return "";
      }
      if(row.kind==="attack_resolved"||row.kind==="ability_used"){
        var declared=row.kind==="attack_resolved"?(declares[row.unit]||null):null;
        if(row.kind==="attack_resolved")delete declares[row.unit];
        var fact=base.factFromEvent?base.factFromEvent(row,declared):null;
        if(fact)attachPayload(fact,row.payload||{});
        var html=fact?proxy.pushFact(fact):"";
        effectFacts(row,proxy);
        return html;
      }
      return typeof base.pushEvent==="function"?base.pushEvent(row):"";
    };
    proxy.resetDamageEvidence=function(){declares=Object.create(null);warned=Object.create(null);};
    proxy.__damageEvidenceV2=true;
    proxy.__damageEvidenceBase=base;
    root.ForgeTableCorrectness=proxy;
    return true;
  }

  function text(parts){return normalizeParts(parts).map(arithmetic).join(" | ");}
  function html(parts,total,declaredFormula){return evidenceHtml(parts,total,declaredFormula);}
  return {VERSION:VERSION,normalizePart:normalizePart,normalizeParts:normalizeParts,arithmetic:arithmetic,
    formula:formula,text:text,html:html,evidenceHtml:evidenceHtml,attachPayload:attachPayload,injectEvidence:injectEvidence,install:install};
});
