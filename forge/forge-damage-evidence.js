/* ── forge-damage-evidence.js ─────────────────────────────────────────
   Battle Forge damage evidence contract.

   Damage totals are never sufficient evidence by themselves. This module
   normalizes the component rolls carried by attack_resolved / ability_used
   facts and renders a permanently visible arithmetic line for the table feed.

   Browser: window.ForgeDamageEvidence. Node: module.exports.
   Pure except decorateNewestRow(), whose DOM use is optional.              */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeDamageEvidence=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.0.0";
  function esc(s){return String(s==null?"":s).replace(/[&<>\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function num(v,fallback){var n=Number(v);return Number.isFinite(n)?n:(fallback==null?0:fallback);}
  function normalizePart(raw,index){
    raw=raw||{};
    var rolls=Array.isArray(raw.rolls)?raw.rolls.map(function(v){return num(v,0);}):[];
    var bonus=num(raw.bonus,0), total=raw.total==null?rolls.reduce(function(a,b){return a+b;},0)+bonus:num(raw.total,0);
    return {
      index:index||0,
      dice:raw.dice==null?null:String(raw.dice),
      rolls:rolls,
      bonus:bonus,
      type:raw.type==null?"":String(raw.type),
      label:raw.label==null?"":String(raw.label),
      total:total
    };
  }
  function normalizeParts(parts,total){
    var out=Array.isArray(parts)?parts.map(normalizePart):[];
    if(!out.length&&total!=null)out.push({index:0,dice:null,rolls:[],bonus:num(total,0),type:"",label:"Total",total:num(total,0)});
    return out;
  }
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
  function text(parts,total){
    var p=normalizeParts(parts,total);
    return p.map(arithmetic).join(" | ");
  }
  function html(parts,total){
    var p=normalizeParts(parts,total);
    if(!p.length)return "";
    return '<div class="ffr-dmg-detail forge-damage-evidence" data-damage-evidence="1">'+p.map(function(part){
      return '<div class="ffr-dmg-line"><span class="forge-dmg-formula">'+esc(formula(part))+'</span><span class="forge-dmg-arithmetic">'+esc(arithmetic(part))+'</span></div>';
    }).join("")+'</div>';
  }
  function attachPayload(fact,payload){
    fact=fact||{};payload=payload||{};
    if(payload.dmgParts)fact.dmgParts=normalizeParts(payload.dmgParts,payload.dmg);
    if(payload.dmgFormula!=null)fact.dmgFormula=String(payload.dmgFormula);
    if(payload.dmg!=null&&fact.dmg==null)fact.dmg=num(payload.dmg,0);
    return fact;
  }
  function decorateRow(row,fact){
    if(!row||!fact)return false;
    var parts=normalizeParts(fact.dmgParts,fact.dmg);
    if(!parts.length)return false;
    var existing=row.querySelector&&row.querySelector('[data-damage-evidence="1"]');
    if(existing)return true;
    var legacyLines=row.querySelectorAll?Array.prototype.slice.call(row.querySelectorAll('.ffr-dmg-line')):[];
    if(legacyLines.length){
      legacyLines.forEach(function(line,index){
        if(line.querySelector&&line.querySelector('.forge-dmg-formula'))return;
        if(typeof line.insertAdjacentHTML==='function')line.insertAdjacentHTML('afterbegin','<span class="forge-dmg-formula">'+esc(formula(parts[index]||parts[0]))+'</span>');
      });
      var detail=row.querySelector&&row.querySelector('.ffr-dmg-detail');
      (detail||legacyLines[0]).setAttribute('data-damage-evidence','1');return true;
    }
    var wrap=row.querySelector&&row.querySelector('.ffr-dmg-wrap');
    if(!wrap)wrap=row;
    if(!wrap||typeof wrap.insertAdjacentHTML!=="function")return false;
    wrap.insertAdjacentHTML("beforeend",html(parts,fact.dmg));
    return true;
  }
  function decorateNewestRow(doc,fact){
    doc=doc||(typeof document!=="undefined"?document:null);
    if(!doc)return false;
    var row=doc.querySelector("#fgFeed .fg-frow");
    return decorateRow(row,fact);
  }
  return {VERSION:VERSION,normalizePart:normalizePart,normalizeParts:normalizeParts,arithmetic:arithmetic,formula:formula,text:text,html:html,attachPayload:attachPayload,decorateRow:decorateRow,decorateNewestRow:decorateNewestRow};
});
