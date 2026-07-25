/* forge-capabilities.js — shared combat capability contract.
   Character sheets and, later, monster statblocks project into this shape
   before HUD/resolver/AI presentation. Unsupported rules remain explicit:
   `held`, `missing`, or `reference` capabilities never enter execution.
   Pure + dual-export: window.ForgeCapabilities / module.exports. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeCapabilities=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.1.0",SCHEMA="forge-capability/v1";
  var STATUSES=["executable","held","missing","reference"];
  var CONSUMERS=["player-hud","dm-hud","enemy-ai","feed","replay"];

  function text(v){return String(v==null?"":v).trim();}
  function norm(v){return text(v).toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9]+/g," ").trim();}
  function slug(v){return norm(v).replace(/\s+/g,"-")||"capability";}
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function uniq(list){var seen=Object.create(null),out=[];(list||[]).forEach(function(v){v=text(v);if(v&&!seen[v]){seen[v]=1;out.push(v);}});return out;}
  function sourceId(kind,label){return kind+":"+norm(label);}
  function titleCase(v){return text(v).replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\b\w/g,function(c){return c.toUpperCase();});}
  function labelKey(v){
    return norm(v).replace(/\bhands of healing\b/,"hand of healing")
      .replace(/\bhexblades curse\b/,"hexblade s curse")
      .replace(/^ki points?$/,"ki");
  }
  function groupFor(tile){
    if(tile.tab==="attacks")return "attacks";
    if(tile.tab==="spells"||tile.spell)return "spells";
    if(tile.tab==="items")return "items";
    if(tile.reaction)return "reactions";
    if(/rider/.test(text(tile.kind)))return "riders";
    return "actions";
  }
  function economyFor(tile){
    if(tile.reaction)return "reaction";
    if(tile.bonus)return "bonus";
    if(tile.free)return "free";
    return "action";
  }
  function costFor(tile){
    var cost=tile&&tile.cost;if(!cost||typeof cost!=="object")return null;
    return Object.keys(cost).sort().map(function(k){return k+" "+cost[k];}).join(", ")||null;
  }
  function targetFor(tile){
    if(tile&&tile.rng!=null)return (Number(tile.rng)||0)*5+" ft";
    if(tile&&tile.kind==="selfheal")return "self";
    return null;
  }
  function rollFor(tile){
    if(tile&&tile.kind==="attack")return "attack "+(tile.hit==null?"":((Number(tile.hit)>=0?"+":"")+tile.hit)).trim();
    if(tile&&tile.kind==="save")return "DC "+(tile.dc||"?")+" "+text(tile.saveAbility).toUpperCase();
    return null;
  }
  function effectsFor(tile){
    var out=[];
    if(tile&&tile.dmg)out.push(tile.dmg+(tile.dmgType?" "+tile.dmgType:""));
    if(tile&&tile.effectKind)out.push(tile.effectKind);
    if(tile&&tile.rider)out.push(tile.rider+" rider");
    return out.join(" · ")||null;
  }
  function executableConsumers(){return ["player-hud","dm-hud","feed","replay"];}
  function visibleConsumers(){return ["player-hud","dm-hud"];}

  var FEATURE_RULES=[
    {re:/^unarmored defense$/i,status:"executable",kind:"ac-rule",group:"defenses",effects:"derived AC"},
    {re:/^unarmored movement$/i,status:"executable",kind:"movement",group:"movement",effects:"derived speed"},
    {re:/^disciple of life$/i,status:"executable",kind:"healing-rider",group:"riders",effects:"2 + spell level healing"},
    {re:/repelling blast/i,status:"executable",verification:"field",kind:"post-hit-rider",group:"riders",effects:"forced move up to 10 ft"},
    {re:/^war caster$/i,status:"executable",verification:"field",kind:"reaction-passive",group:"reactions",effects:"OA cantrip choice + concentration advantage"},
    {re:/^starlight step$/i,status:"executable",kind:"teleport",group:"movement",effects:"30 ft teleport",tags:["teleport:30"]},
    {re:/blessing of the raven queen/i,status:"executable",kind:"teleport-defense",group:"movement",effects:"30 ft teleport + temporary resistance",tags:["teleport:30","effect:raven-resistance"]},
    {re:/^deflect missiles$/i,status:"missing",kind:"reaction",group:"reactions",effects:"reduce ranged weapon damage; optional return",reason:"Incoming-hit reduction and return-attack branch not wired."},
    {re:/^hand of harm$/i,status:"held",kind:"post-hit-rider",group:"riders",effects:"extra necrotic damage",reason:"Post-hit choice remains deliberately blocked."},
    {re:/^magical inspiration$/i,status:"missing",kind:"inspiration-rider",group:"riders",reason:"Spell damage/healing consumption branch not wired."},
    {re:/^mote of potential$/i,status:"missing",kind:"inspiration-rider",group:"riders",reason:"Check, attack, and save branches are not structured."},
    {re:/^performance of creation$/i,status:"missing",kind:"creation-action",group:"actions",reason:"Created-object workflow is not represented in combat."},
    {re:/^weapon bond$/i,status:"missing",kind:"equipment-feature",group:"traits",reason:"Disarm protection and recall action are not represented."},
    {re:/^hellish resistance$/i,status:"executable",kind:"damage-resistance",group:"defenses",tags:["resistance:fire"]},
    {re:/necrotic resistance/i,status:"executable",kind:"damage-resistance",group:"defenses",tags:["resistance:necrotic"]},
    {re:/^darkvision$|eyes of the dark/i,status:"missing",kind:"sense",group:"senses",tags:["sense:darkvision"],reason:"Visibility does not consume actor senses yet."},
    {re:/^fey ancestry$/i,status:"missing",kind:"save-defense",group:"defenses",tags:["advantage:charmed"],reason:"Saving throws do not consume passive defense sources yet."},
    {re:/^jack of all trades$/i,status:"held",kind:"check-passive",group:"traits",reason:"Initiative is projected; general ability-check consumption is not."}
  ];
  var SPELL_RULES=[
    {re:/^shield$/i,status:"executable",kind:"reaction-spell",group:"reactions"},
    {re:/^silvery barbs$/i,status:"executable",verification:"field",kind:"reaction-spell",group:"reactions"},
    {re:/^hellish rebuke$/i,status:"executable",kind:"reaction-spell",group:"reactions"},
    {re:/^absorb elements$/i,status:"held",kind:"reaction-spell",group:"reactions",reason:"Incoming elemental resistance and next-hit rider are not wired."},
    {re:/^feather fall$/i,status:"missing",kind:"reaction-spell",group:"reactions",reason:"Falling trigger and controlled-descent effect are not wired."},
    {re:/^green flame blade$/i,status:"held",kind:"weapon-cantrip",group:"riders",reason:"The secondary-creature fire leap is not wired."},
    {re:/^aid$/i,status:"held",kind:"max-hp-spell",group:"spells",reason:"A generic buff cannot replace current/max HP changes."},
    {re:/^spare the dying$/i,status:"held",kind:"stabilize-spell",group:"spells",reason:"A zero-point heal cannot replace stabilization."},
    {re:/^mage armor$/i,status:"held",kind:"ac-spell",group:"defenses",reason:"The generic spell path is not a valid AC-state resolver."}
  ];

  function ruleFor(list,label){
    for(var i=0;i<list.length;i++)if(list[i].re.test(text(label)))return list[i];
    return null;
  }
  function featureRows(s){
    var out=[],seen=Object.create(null);
    function add(row,origin){
      var name=text(row&&row.name||row);if(!name)return;var id=sourceId("feature",name);
      if(seen[id])return;seen[id]=1;out.push({id:id,name:name,origin:origin||text(row&&row.source)||"feature",raw:row});
    }
    (s.features||[]).forEach(function(f){add(f,text(f&&f.source)||"feature");});
    (s.customFeatures||[]).forEach(function(f){add(f,text(f&&f.source)||"custom feature");});
    Object.keys(s.classFeatures||{}).forEach(function(k){var v=s.classFeatures[k];if(v!==false&&v!=null)add({name:titleCase(k),value:v},"class feature");});
    if(/\bshadar[\s-]?kai\b/i.test(text(s.race)))add({name:"Necrotic Resistance",source:"Shadar-kai"},"race-derived");
    return out;
  }
  function spellRows(s){
    var out=[],seen=Object.create(null);
    function add(row,origin){
      var name=text(row&&row.name||row);if(!name)return;var id=sourceId("spell",name);
      if(seen[id])return;seen[id]=1;out.push({id:id,name:name,origin:origin||text(row&&row.origin)||"spellcasting",raw:row});
    }
    function walk(v,origin){
      if(v==null)return;
      if(Array.isArray(v)){v.forEach(function(x){walk(x,origin);});return;}
      if(typeof v!=="object")return;
      if(v.name&&(v.level!=null||v.castingTime||v.time||v.range||v.origin))add(v,origin);
      Object.keys(v).forEach(function(k){if(k!=="name"&&k!=="entries"&&k!=="desc")walk(v[k],origin);});
    }
    walk(s.spells,"spells");walk(s.spellcasting,"spellcasting");
    return out;
  }
  function capabilityFromTile(tile){
    var status=tile.greyed?"held":"executable";
    return {
      schema:SCHEMA,id:text(tile.id)||("action-"+slug(tile.label)),label:text(tile.label)||"Action",
      kind:text(tile.kind)||"utility",group:groupFor(tile),status:status,verification:"code",
      economy:economyFor(tile),targeting:targetFor(tile),roll:rollFor(tile),cost:costFor(tile),
      effects:effectsFor(tile),trigger:null,duration:null,tags:[],
      automation:{state:status,reason:tile.greyReason||tile.reason||null},
      consumers:status==="executable"?executableConsumers():visibleConsumers(),
      sourceRefs:[],legacy:{id:tile.id||null,tab:tile.tab||null}
    };
  }
  function capabilityFromRule(source,rule,kind){
    rule=rule||{};
    var status=rule.status||"reference";
    return {
      schema:SCHEMA,id:kind+"-"+slug(source.name),label:source.name,
      kind:rule.kind||kind,group:rule.group||(kind==="spell"?"spells":"traits"),
      status:status,verification:rule.verification||"code",economy:rule.economy||null,
      targeting:rule.targeting||null,roll:rule.roll||null,cost:rule.cost||null,
      effects:rule.effects||null,trigger:rule.trigger||null,duration:rule.duration||null,
      tags:clone(rule.tags||[]),automation:{state:status,reason:rule.reason||null},
      consumers:status==="executable"?executableConsumers():visibleConsumers(),
      sourceRefs:[{id:source.id,kind:kind,label:source.name,origin:source.origin}],legacy:null
    };
  }
  function validate(cap){
    var errors=[];
    if(!cap||cap.schema!==SCHEMA)errors.push("schema");
    ["id","label","kind","group","status"].forEach(function(k){if(!text(cap&&cap[k]))errors.push(k);});
    if(cap&&STATUSES.indexOf(cap.status)<0)errors.push("status");
    (cap&&cap.consumers||[]).forEach(function(c){if(CONSUMERS.indexOf(c)<0)errors.push("consumer:"+c);});
    return {ok:errors.length===0,errors:uniq(errors)};
  }
  function fromCharacter(charData,kit,opts){
    charData=charData||{};kit=kit||{};opts=opts||{};
    var s=opts.structural||charData.structural||{},caps=[],byLabel=Object.create(null),sourceIds=[];
    function rememberSource(ref){if(ref&&ref.id)sourceIds.push(ref.id);}
    function add(cap,forceRule){
      var key=labelKey(cap.label),found=byLabel[key];
      if(!found){
        cap.sourceRefs=(cap.sourceRefs||[]).slice();cap.tags=uniq(cap.tags||[]);
        caps.push(cap);byLabel[key]=cap;(cap.sourceRefs||[]).forEach(rememberSource);return cap;
      }
      (cap.sourceRefs||[]).forEach(function(ref){
        if(!found.sourceRefs.some(function(x){return x.id===ref.id;}))found.sourceRefs.push(ref);
        rememberSource(ref);
      });
      found.tags=uniq((found.tags||[]).concat(cap.tags||[]));
      if(forceRule){
        ["kind","group","status","verification","economy","targeting","roll","cost","effects","trigger","duration","automation","consumers"].forEach(function(k){
          if(cap[k]!=null)found[k]=clone(cap[k]);
        });
      }
      return found;
    }
    ["attacks","spells","items","actions"].forEach(function(tab){
      (kit.tabs&&kit.tabs[tab]||[]).forEach(function(tile){add(capabilityFromTile(tile),false);});
    });
    (kit.pools||[]).forEach(function(pool){
      var label=text(pool.label||pool.badge||pool.key),field=/^ki\b/i.test(label);
      add({schema:SCHEMA,id:"resource-"+slug(pool.key||label),label:label,kind:"limited-resource",group:"resources",
        status:"executable",verification:field?"field":"code",economy:null,targeting:null,roll:null,cost:null,
        effects:"current/max resource authority",trigger:text(pool.recharge)||null,duration:null,tags:[],
        automation:{state:"executable",reason:null},consumers:executableConsumers(),
        sourceRefs:[{id:sourceId("resource",pool.key||label),kind:"resource",label:label,origin:text(pool.origin||pool.source)||"resource"}],
        legacy:{key:pool.key||null,rawKey:pool.rawKey||null}},false);
    });
    featureRows(s).forEach(function(source){
      var rule=ruleFor(FEATURE_RULES,source.name),cap=capabilityFromRule(source,rule,"feature");
      add(cap,!!rule);
    });
    spellRows(s).forEach(function(source){
      var rule=ruleFor(SPELL_RULES,source.name),cap=capabilityFromRule(source,rule,"spell");
      add(cap,!!rule);
    });
    caps.forEach(function(cap){cap.valid=validate(cap).ok;});
    var represented=Object.create(null);caps.forEach(function(cap){(cap.sourceRefs||[]).forEach(function(ref){represented[ref.id]=1;});});
    var counts={executable:0,held:0,missing:0,reference:0};caps.forEach(function(cap){counts[cap.status]++;});
    var audit={
      schema:SCHEMA,actor:charData.key||kit.key||null,total:caps.length,byStatus:counts,
      sourceCount:uniq(sourceIds).length,
      unaccountedSources:uniq(sourceIds).filter(function(id){return !represented[id];}),
      invalidCapabilities:caps.filter(function(cap){return !cap.valid;}).map(function(cap){return cap.id;})
    };
    return {schema:SCHEMA,actor:charData.key||kit.key||null,capabilities:caps,audit:audit};
  }
  function attachToKit(charData,kit,opts){
    var result=fromCharacter(charData,kit,opts);kit.capabilities=result.capabilities;kit.capabilityAudit=result.audit;kit.capabilitySchema=SCHEMA;return kit;
  }

  return Object.freeze({
    VERSION:VERSION,SCHEMA:SCHEMA,STATUSES:STATUSES.slice(),CONSUMERS:CONSUMERS.slice(),
    fromCharacter:fromCharacter,attachToKit:attachToKit,validate:validate,
    featureRows:featureRows,spellRows:spellRows,norm:norm
  });
});
