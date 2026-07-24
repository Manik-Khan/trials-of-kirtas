/* forge-test-fight.js — disposable Battle Forge roster snapshots
   Pure/UMD. Campaign sessions carry no testFight record and pass through
   unchanged. A TEST session applies its presets to the roster snapshot only;
   the board adapter separately uses isTestFight() to refuse sheet writeback. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeTestFight=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.0.0";
  var HEALTH={full:true,current:true,half:true,quarter:true,custom:true};
  var RESOURCES={full:true,current:true,empty:true,custom:true};
  var EFFECTS={clear:true,current:true};

  function plain(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function number(value,fallback){value=Number(value);return Number.isFinite(value)?value:fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function record(value){
    var out={};Object.keys(value||{}).forEach(function(key){
      out[key]=Math.max(0,number(value[key],0));
    });return out;
  }
  function normalizeConfig(value){
    value=value&&value.testFight?value.testFight:value;
    if(!value||value.mode!=="test")return null;
    return {
      version:1,mode:"test",
      health:HEALTH[value.health]?value.health:"full",
      resources:RESOURCES[value.resources]?value.resources:"full",
      effects:EFFECTS[value.effects]?value.effects:"clear",
      custom:plain(value.custom||{})
    };
  }
  function configFromMap(map){return normalizeConfig(map&&map.testFight);}
  function isTestFight(value){
    if(!value)return false;
    if(value.row)return !!configFromMap(value.row.map);
    if(value.map&&!value.testFight)return !!configFromMap(value.map);
    return !!normalizeConfig(value);
  }
  function attachToMap(map,value){
    var out=Object.assign({},map||{}),config=normalizeConfig(value);
    if(config)out.testFight=config;else delete out.testFight;
    return out;
  }
  function resourceMaxima(pools,current){
    var out={};(pools||[]).forEach(function(pool){
      if(pool&&pool.key)out[pool.key]=Math.max(0,number(pool.max,0));
    });
    Object.keys(current||{}).forEach(function(key){
      if(out[key]==null)out[key]=Math.max(0,number(current[key],0));
    });
    return out;
  }
  function healthValue(mode,current,max,custom){
    max=Math.max(0,number(max,number(current,0)));
    current=clamp(number(current,max),0,max);
    if(mode==="current")return current;
    if(mode==="half")return Math.ceil(max/2);
    if(mode==="quarter")return Math.ceil(max/4);
    if(mode==="custom")return clamp(number(custom,current),0,max);
    return max;
  }
  function resourcesValue(mode,current,maxima,custom){
    current=record(current);maxima=record(maxima);
    var keys={};Object.keys(current).forEach(function(key){keys[key]=true;});
    Object.keys(maxima).forEach(function(key){keys[key]=true;});
    Object.keys(custom||{}).forEach(function(key){keys[key]=true;});
    var out={};Object.keys(keys).forEach(function(key){
      var max=maxima[key]!=null?maxima[key]:current[key]||0;
      if(mode==="empty")out[key]=0;
      else if(mode==="full")out[key]=max;
      else if(mode==="custom")out[key]=clamp(number(custom&&custom[key],current[key]||0),0,max);
      else out[key]=current[key]||0;
    });return out;
  }
  function applyRoster(roster,value,factsByUnit){
    var config=normalizeConfig(value);if(!config)return plain(roster||[]);
    factsByUnit=factsByUnit||{};
    return (roster||[]).map(function(source){
      var row=plain(source),isPc=(row.kind||"pc")==="pc";if(!isPc)return row;
      var facts=factsByUnit[row.unit]||{},custom=config.custom[row.unit]||{};
      var maxHp=Math.max(0,number(facts.maxHp,number(row.maxHp,number(row.hp,0))));
      var currentHp=number(facts.currentHp,number(row.hp,maxHp));
      var currentResources=record(facts.currentResources||row.resources||{});
      var maxima=record(facts.maxResources||currentResources);
      row.maxHp=maxHp;
      row.hp=healthValue(config.health,currentHp,maxHp,custom.hp);
      row.resources=resourcesValue(config.resources,currentResources,maxima,custom.resources||{});
      if(config.effects==="current"){
        row.conditions=plain(facts.conditions||[]);
        row.startingEffects=plain(facts.startingEffects||[]);
      }else{
        row.conditions=[];
        row.startingEffects=[];
      }
      return row;
    });
  }
  function concentrationEffect(unit,concentration){
    if(!concentration)return null;
    var label=String(concentration.name||concentration.label||"Concentration");
    return {unit:unit,add_effect:{
      id:"test-current-concentration:"+unit,kind:"concentration",label:label,
      icon:"concentration",source:unit,target:unit,concentration:true,
      inherited:true,duration:concentration.duration||null
    }};
  }
  function startingEffectRows(roster){
    var rows=[],seq=-100000;
    (roster||[]).forEach(function(row){
      var effects=plain(row&&row.startingEffects||[]);
      if(!effects.length)return;
      rows.push({seq:seq++,kind:"ability_used",unit:row.unit,
        payload:{ability:"Inherited test state",effects:effects,slot:"free",silent:true},
        created_at:null,testSnapshot:true});
    });
    return rows;
  }
  function label(value){
    var config=normalizeConfig(value);if(!config)return "Campaign";
    return "TEST · "+config.health+" health · "+config.resources+" resources · effects "+config.effects;
  }

  return {VERSION:VERSION,normalizeConfig:normalizeConfig,configFromMap:configFromMap,
    isTestFight:isTestFight,attachToMap:attachToMap,resourceMaxima:resourceMaxima,
    applyRoster:applyRoster,concentrationEffect:concentrationEffect,
    startingEffectRows:startingEffectRows,label:label};
});
