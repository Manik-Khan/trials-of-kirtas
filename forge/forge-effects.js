/* forge-effects.js — Battle Forge persistent-effect ledger (Phase 1.5e)
   Pure/UMD. Persistent effects ride inside the existing event payload.effects
   array, so old replay clients safely ignore the new records while this module
   derives the authoritative effect state from the same append-only log.

   Effect operation shapes:
     {unit, add_effect:{id,kind,label,source,target,dc,duration,...}}
     {unit, remove_effect:id, reason}

   Sanctuary, Bless, and Hex are first-class ledger effects. Sanctuary uses its
   direct-target Wisdom-save gate; Bless/Hex use the same ledger for duration,
   concentration replacement, refresh, replay, and removal. Area effects remain
   outside Sanctuary's incoming direct-target gate. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeEffects=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.3.0";

  function plain(v){ return v==null?v:JSON.parse(JSON.stringify(v)); }
  function n(v,d){ v=Number(v); return Number.isFinite(v)?v:d; }
  function seqSort(a,b){ return n(a&&a.seq,0)-n(b&&b.seq,0); }
  function effectOps(row){
    var p=row&&row.payload||{};
    return Array.isArray(p.effects)?p.effects:[];
  }
  function effectiveRows(rows){
    var all=(rows||[]).slice().sort(seqSort), branch=[];
    all.forEach(function(row){
      if(row&&row.kind==="restore"){
        var to=n(row.payload&&row.payload.to_seq,-1);
        branch=all.filter(function(x){ return n(x&&x.seq,0)<=to && x.kind!=="restore"; });
      }else branch.push(row);
    });
    return branch.sort(seqSort);
  }
  function nextActive(state,ended){
    var order=state.order;
    if(!order.length)return null;
    var at=order.indexOf(ended);
    if(at<0)at=order.indexOf(state.active);
    for(var i=1;i<=order.length;i++){
      var key=order[(Math.max(0,at)+i)%order.length];
      if(key)return key;
    }
    return order[0]||null;
  }
  function expireAtTurnStart(state,unit,seq,expired){
    Object.keys(state.effects).forEach(function(id){
      var e=state.effects[id];
      if(!e||!e.expires)return;
      if(e.expires.unit===unit && n(state.starts[unit],0)>=n(e.expires.startCount,Infinity)){
        delete state.effects[id];
        expired.push({id:id,effect:e,reason:"duration",seq:seq});
      }
    });
  }
  function addEffect(state,op,row,changes){
    var src=plain(op.add_effect)||{}, id=String(src.id||("effect:"+row.seq+":"+(op.unit||src.target||"unit")));
    src.id=id; src.target=src.target||op.unit||null; src.source=src.source||row.unit||null;
    src.appliedSeq=n(row.seq,0); src.appliedAt=row.created_at||null;
    if(src.duration&&src.duration.kind==="source-turns"){
      var du=src.duration.unit||src.source, count=Math.max(1,n(src.duration.count,1));
      src.expires={unit:du,startCount:n(state.starts[du],0)+count};
    }
    state.effects[id]=src;
    changes.push({type:"add",effect:src,seq:n(row.seq,0)});
  }
  function removeEffect(state,op,row,changes){
    var id=String(op.remove_effect||"");
    if(!id||!state.effects[id])return;
    var e=state.effects[id]; delete state.effects[id];
    changes.push({type:"remove",effect:e,reason:op.reason||"removed",seq:n(row.seq,0)});
  }
  function replay(rows){
    var state={version:VERSION,effects:{},order:[],active:null,starts:{},changes:[],expired:[]};
    var branch=effectiveRows(rows), corrections={};
    branch.forEach(function(row){if(row&&row.kind==="override"&&row.payload)corrections[row.payload.corrects_seq]=row.payload.correction||{};});
    branch.forEach(function(row){
      if(!row||row.kind==="override")return;
      var p=Object.assign({},row.payload||{},corrections[row.seq]||{});
      if(row.kind==="initiative_set"){
        var first=!state.order.length;
        state.order=(p.order||p.initiative||[]).slice();
        state.active=(p.resume_at&&state.order.indexOf(p.resume_at)>=0)?p.resume_at:(first||state.order.indexOf(state.active)<0?state.order[0]:state.active);
        if(first&&state.active){state.starts[state.active]=n(state.starts[state.active],0)+1;expireAtTurnStart(state,state.active,row.seq,state.expired);}
      }else if(row.kind==="turn_ended"&&state.order.length){
        state.active=nextActive(state,row.unit||state.active);
        if(state.active){state.starts[state.active]=n(state.starts[state.active],0)+1;expireAtTurnStart(state,state.active,row.seq,state.expired);}
      }
      var effectiveRow=Object.assign({},row,{payload:p});
      effectOps(effectiveRow).forEach(function(op){
        if(!op||typeof op!=="object")return;
        if(op.add_effect)addEffect(state,op,effectiveRow,state.changes);
        if(op.remove_effect)removeEffect(state,op,effectiveRow,state.changes);
      });
    });
    var byUnit={};
    Object.keys(state.effects).forEach(function(id){
      var e=state.effects[id], k=e.target||"";
      if(!byUnit[k])byUnit[k]=[];
      byUnit[k].push(e);
    });
    state.byUnit=byUnit;
    return state;
  }
  function forUnit(state,unit){ return state&&state.byUnit&&state.byUnit[unit]?state.byUnit[unit].slice():[]; }
  function find(state,unit,kind){
    var a=forUnit(state,unit);
    for(var i=0;i<a.length;i++)if(a[i].kind===kind)return a[i];
    return null;
  }
  function blessId(source,target,nonce){return "bless:"+String(source)+":"+String(target)+":"+String(nonce==null?Date.now():nonce);}
  function addBless(opts){
    opts=opts||{};var source=String(opts.source||""),target=String(opts.target||"");
    return {unit:target,add_effect:{
      id:opts.id||blessId(source,target,opts.nonce),kind:"bless",label:"Bless",icon:"bless",
      source:source,target:target,die:"1d4",concentration:true,group:opts.group||null,
      duration:{kind:"source-turns",unit:source,count:Math.max(1,n(opts.turns,10))}
    }};
  }
  function addBlessGroup(opts){
    opts=opts||{};var nonce=opts.nonce==null?Date.now():opts.nonce,group=opts.group||("bless:"+String(opts.source||"")+":"+nonce);
    return (opts.targets||[]).map(function(target,i){return addBless({source:opts.source,target:target,nonce:String(nonce)+":"+i,group:group,turns:opts.turns});});
  }
  function hexId(source,target,nonce){return "hex:"+String(source)+":"+String(target)+":"+String(nonce==null?Date.now():nonce);}
  function addHex(opts){
    opts=opts||{};var source=String(opts.source||""),target=String(opts.target||"");
    return {unit:target,add_effect:{
      id:opts.id||hexId(source,target,opts.nonce),kind:"hex",label:"Hex",icon:"hex",
      source:source,target:target,die:"1d6",concentration:true,
      duration:{kind:"source-turns",unit:source,count:Math.max(1,n(opts.turns,600))}
    }};
  }
  function concentrationRemovals(state,source,reason){
    var out=[];Object.keys(state&&state.effects||{}).forEach(function(id){var e=state.effects[id];
      if(e&&e.source===source&&e.concentration)out.push(remove(id,reason||"concentration replaced",e.target,e));
    });return out;
  }
  function initiativeDieId(kind,source,target,nonce){return String(kind||"initiative-die")+":"+String(source||"")+":"+String(target||"")+":"+String(nonce==null?Date.now():nonce);}
  function addInitiativeDie(opts){
    opts=opts||{};var kind=String(opts.kind||"initiative-die"),source=String(opts.source||""),target=String(opts.target||"");
    return {unit:target,add_effect:{id:opts.id||initiativeDieId(kind,source,target,opts.nonce),kind:kind,label:opts.label||"Initiative bonus",icon:opts.icon||"sparkles",source:source,target:target,die:opts.die||"1d4",consumeOnUse:!!opts.consumeOnUse,concentration:!!opts.concentration,duration:opts.duration||{kind:"source-turns",unit:source,count:Math.max(1,n(opts.turns,10))}}};
  }
  function addGiftOfAlacrity(opts){opts=opts||{};return addInitiativeDie({kind:"gift-of-alacrity",label:"Gift of Alacrity",icon:"hourglass",source:opts.source,target:opts.target,nonce:opts.nonce,die:"1d8",consumeOnUse:false,concentration:false,turns:Math.max(1,n(opts.turns,4800))});}
  function addGuidance(opts){opts=opts||{};return addInitiativeDie({kind:"guidance",label:"Guidance",icon:"sparkles",source:opts.source,target:opts.target,nonce:opts.nonce,die:"1d4",consumeOnUse:true,concentration:true,turns:Math.max(1,n(opts.turns,10))});}
  function addBardicInspiration(opts){opts=opts||{};return addInitiativeDie({kind:"bardic-inspiration",label:"Bardic Inspiration",icon:"musical-notes",source:opts.source,target:opts.target,nonce:opts.nonce,die:opts.die||"1d6",consumeOnUse:true,concentration:false,turns:Math.max(1,n(opts.turns,100))});}
  function modifierDie(state,unit,kind,roll){var e=find(state,unit,kind);if(!e)return null;return {effect:e,roll:Math.max(1,n(roll,1)),die:e.die||"1d4"};}
  function concentrationSave(state,source,damage,mod,roll,opts){
    opts=opts||{};var removals=concentrationRemovals(state,source,opts.reason||"concentration broken");
    if(!removals.length)return {required:false,source:source,damage:Math.max(0,n(damage,0)),effects:[]};
    var dmg=Math.max(0,n(damage,0)),dc=Math.max(10,Math.floor(dmg/2)),r=n(roll,1),m=n(mod,0),total=r+m;
    var automatic=!!opts.incapacitated, saved=!automatic&&total>=dc;
    return {required:true,source:source,damage:dmg,dc:dc,roll:r,mod:m,total:total,saved:saved,
      automatic:automatic,effects:saved?[]:removals};
  }
  function sanctuaryId(source,target,nonce){ return "sanctuary:"+String(source)+":"+String(target)+":"+String(nonce==null?Date.now():nonce); }
  function addSanctuary(opts){
    opts=opts||{};
    var source=String(opts.source||""),target=String(opts.target||"");
    return {unit:target,add_effect:{
      id:opts.id||sanctuaryId(source,target,opts.nonce), kind:"sanctuary", label:"Sanctuary",
      source:source,target:target,dc:n(opts.dc,10), icon:"shield", harmfulGate:"direct-target",
      breakOn:["attack","damage","harmful-spell"], duration:{kind:"source-turns",unit:source,count:10}
    }};
  }
  function remove(id,reason,unit,effect){
    var out={unit:unit||null,remove_effect:String(id),reason:reason||"removed"};
    if(effect){out.effect_label=effect.label||null;out.effect_kind=effect.kind||null;}
    return out;
  }
  function wisdomSave(effect,mod,roll){
    roll=n(roll,1);mod=n(mod,0);var total=roll+mod,dc=n(effect&&effect.dc,10);
    /* Ability checks and saving throws do not auto-succeed on a natural 20 or
       auto-fail on a natural 1 in the 2014 rules. Sanctuary uses the total. */
    return {roll:roll,mod:mod,total:total,dc:dc,saved:total>=dc};
  }
  function isSanctuaryAction(a){
    var label=String(a&&a.label||"").replace(/\s+\([^)]*\)\s*$/,"").toLowerCase();
    return label==="sanctuary";
  }
  function harmfulDirect(a){
    if(!a||a.aoe||a.area||a.template)return false;
    var kind=String(a.kind||"");
    /* Explicitly non-hostile actions must stay non-hostile even when their
       legacy record happens to use `dmg` as a generic dice field (healing did). */
    if(kind==="heal"||kind==="buffAlly"||kind==="selfheal"||kind==="utility"||
       kind==="universal"||kind==="stand"||kind==="monk-dodge"||kind==="monk-step")return false;
    if(kind==="attack"||kind==="save"||kind==="buff"||kind==="damage")return true;
    /* Defensive publisher normalisation: early foe/statblock adapters historically
       passed {hit,dmg,rng} before assigning kind:"attack". Only an untyped record
       may use this shape fallback; a typed friendly action must never be reclassified. */
    if(kind)return false;
    return a.hit!=null||a.dmg!=null||a.damage!=null||a.saveAbility!=null;
  }
  function breaksSanctuary(a){
    if(!a)return false;
    /* Legacy Sanctuary also ends when the warded creature deals damage. Keep
       this generic so later non-attack damage abilities do not need a spell-
       specific exception. */
    var dealsDamage=!!a.dealsDamage||a.dmg!=null||a.damage!=null;
    return a.kind==="attack"||dealsDamage||((a.spell||a.kind==="save"||a.kind==="buff")&&harmfulDirect(a));
  }
  function removalForActor(state,actor,a,reason){
    if(!breaksSanctuary(a))return null;
    var e=find(state,actor,"sanctuary");
    return e?remove(e.id,reason||"warded creature attacked, dealt damage, or cast a harmful spell",actor,e):null;
  }
  function eventSummary(row){
    var p=row&&row.payload||{}, c=p.context||{};
    if(c.kind==="sanctuary-save")return {kind:"sanctuary-save",actor:row.unit,target:c.target,roll:c.roll,mod:c.mod,total:c.total,dc:c.dc,saved:!!c.saved};
    var ops=effectOps(row), out=[];
    ops.forEach(function(op){
      if(op&&op.add_effect)out.push({kind:"effect-add",effect:op.add_effect});
      if(op&&op.remove_effect)out.push({kind:"effect-remove",id:op.remove_effect,label:op.effect_label||null,effectKind:op.effect_kind||null,reason:op.reason||"removed"});
    });
    return out.length?out:null;
  }
  return {VERSION:VERSION,effectiveRows:effectiveRows,replay:replay,forUnit:forUnit,find:find,
    addSanctuary:addSanctuary,addBless:addBless,addBlessGroup:addBlessGroup,addHex:addHex,
    addInitiativeDie:addInitiativeDie,addGiftOfAlacrity:addGiftOfAlacrity,addGuidance:addGuidance,addBardicInspiration:addBardicInspiration,
    concentrationRemovals:concentrationRemovals,concentrationSave:concentrationSave,modifierDie:modifierDie,remove:remove,wisdomSave:wisdomSave,isSanctuaryAction:isSanctuaryAction,
    harmfulDirect:harmfulDirect,breaksSanctuary:breaksSanctuary,removalForActor:removalForActor,eventSummary:eventSummary,
    _internals:{effectOps:effectOps,nextActive:nextActive}};
});
