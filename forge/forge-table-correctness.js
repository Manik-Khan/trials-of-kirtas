/* ── forge-table-correctness.js ───────────────────────────────────────
   Battle Forge Phase 1.5d table-correctness seams.

   - canonical resource aliases (kiPoints -> ki, while rawKey stays intact)
   - local Staff View / Player View presentation mask
   - structured resolved-fact feed rows with verdict tinting
   - BG3 HUD cover-contest control restoration

   Account authority remains in ForgeBoard/Supabase. Viewer mode only masks
   privileged presentation on this browser; real players are always masked.
   Browser: window.ForgeTableCorrectness. Node: module.exports.
   ───────────────────────────────────────────────────────────────────── */
(function(root,factory){
  var api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeTableCorrectness=api;
})(typeof self!=="undefined"?self:this,function(root){
  "use strict";
  var VERSION="1.0.0";
  var VIEW_KEY="tok-forge-view-mode-v1";

  function storage(){try{return root.localStorage||null;}catch(_e){return null;}}
  function readStored(){var s=storage();if(!s)return "staff";try{return s.getItem(VIEW_KEY)==="player"?"player":"staff";}catch(_e){return "staff";}}
  function writeStored(v){var s=storage();if(!s)return;try{s.setItem(VIEW_KEY,v);}catch(_e){}}
  function session(){return root.__forgeSession||null;}
  function privileged(sess){
    sess=sess||session();
    var me=sess&&sess.me;
    if(me&&(me.overseer||me.staff||me.dm))return true;
    var role=root.__tok&&root.__tok.member&&root.__tok.member.role;
    return /^(staff|dm|overseer|admin)$/i.test(String(role||""));
  }
  function mode(sess){return privileged(sess)?readStored():"player";}
  function staffView(sess){return privileged(sess)&&mode(sess)==="staff";}
  function playerView(sess){return !staffView(sess);}
  function setMode(next,sess){
    if(!privileged(sess))return "player";
    next=next==="player"?"player":"staff";writeStored(next);applyBody(sess);
    if(typeof root.renderHud==="function")try{root.renderHud();}catch(_e){}
    if(root.document&&typeof root.CustomEvent==="function")root.document.dispatchEvent(new root.CustomEvent("forge:viewerMode",{detail:{mode:next}}));
    return next;
  }
  function toggle(sess){return setMode(mode(sess)==="staff"?"player":"staff",sess);}
  function applyBody(sess,active){
    if(!root.document)return;
    var body=root.document.body;if(!body)return;
    var pv=playerView(sess);
    body.classList.toggle("forge-player-view",pv);
    body.classList.toggle("forge-staff-view",!pv);
    body.classList.toggle("forge-active-foe",!!(active&&active.side==="foe"));
    body.dataset.forgeViewerMode=pv?"player":"staff";
  }
  function visibleOrder(order,foeVisible,sess){
    var pv=playerView(sess);
    return (order||[]).filter(function(u){
      if(!pv||!u||u.side!=="foe")return true;
      return typeof foeVisible==="function"?!!foeVisible(u):true;
    });
  }
  function displayUnit(u,sess){
    if(!u)return u;
    if(!playerView(sess)||u.side!=="foe")return u;
    var clean={};Object.keys(u).forEach(function(k){
      if(["hp","hpMax","ac","res","actions","mActions","statblock","save","atk"].indexOf(k)<0)clean[k]=u[k];
    });
    clean.hp="";clean.hpMax="";clean.ac=null;clean.res={};clean.actions=[];clean.mActions=[];clean._masked=true;
    return clean;
  }
  function viewerSnapshot(sess,active){
    var p=privileged(sess),m=mode(sess),pv=!p||m==="player";
    return {privileged:p,mode:pv?"player":"staff",playerView:pv,staffView:!pv,suppressEnemyHud:!!(pv&&active&&active.side==="foe")};
  }

  function normalizeKit(kit){
    if(!kit||typeof kit!=="object")return kit;
    if(kit.res&&kit.res.ki==null&&kit.res.kiPoints!=null)kit.res.ki=kit.res.kiPoints;
    (kit.pools||[]).forEach(function(p){if(p&&p.key==="kiPoints"){p.key="ki";if(!p.rawKey)p.rawKey="kiPoints";}});
    return kit;
  }
  function installKitAlias(){
    var kd=root.ForgeKitDerive;if(!kd||kd.__tableCorrectnessKi)return false;
    ["derive","wrapStarterKit"].forEach(function(name){
      if(typeof kd[name]!=="function")return;var raw=kd[name];kd[name]=function(){return normalizeKit(raw.apply(this,arguments));};
    });
    kd.__tableCorrectnessKi=true;return true;
  }

  function toneForFact(f){
    if(!f)return "neutral";
    var effects=Array.isArray(f.effects)?f.effects:[];
    if(f.heal!=null||effects.some(function(e){return e&&e.heal!=null;}))return "heal";
    if(f.crit&&f.hit)return "crit";
    if(f.kind==="save"||f.saveAbility)return f.saved?"save":"hit";
    if(f.hit===true||f.dmg!=null||effects.some(function(e){return e&&e.dmg!=null;}))return "hit";
    if(f.hit===false)return "miss";return "neutral";
  }
  function unitName(key){
    try{var u=root.CB&&root.CB.units&&(root.CB.units.find(function(x){return x.unit===key||x.key===key||x.id===key;}));return u?u.name:key;}catch(_e){return key;}
  }
  function factHtml(fact){
    var fr=root.ForgeFeedRender;if(!fr)return "";
    var body=(fact.kind==="ability"||fact.ability&&!fact.roll&&!fact.saveAbility)?fr.abilityBody(fact,{unitName:unitName}):fr.rollBody(fact,{unitName:unitName});
    return '<div class="forge-result-row forge-result-'+toneForFact(fact)+'">'+body+'</div>';
  }
  function pushFact(fact){var html=factHtml(fact);if(html&&typeof root.addForgeRow==="function")root.addForgeRow(html);return html;}
  var attackDeclares=Object.create(null);
  function factFromEvent(row,declared){
    if(!row||!(row.kind==="attack_resolved"||row.kind==="ability_used"))return null;
    var p=row.payload||{};
    if(row.kind==="ability_used")return {kind:"ability",actor:row.unit,unit:row.unit,ability:p.ability||p.mode||"Ability",target:p.target||(p.targets&&p.targets[0])||null,effects:p.effects||[],heal:p.heal,dmg:p.dmg,narration:p.context||p.narration||null};
    /* Current protocol keeps roll/mode/range facts on attack_declared and the
       final hit/damage on attack_resolved. Merge the pair for old logs; new
       Phase 1.5d resolved rows also repeat the display facts so a dropped
       declaration cannot degrade the feed. */
    var d=declared||{}, all=Object.assign({},d,p);
    var coverName=all.coverName||({0:"none",2:"half",5:"three-quarters"})[all.cover]||(all.cover===Infinity?"total":null);
    return {kind:"attack",actor:row.unit,unit:row.unit,target:all.target,mode:all.mode||"Attack",roll:all.roll,hitBonus:all.hitBonus,hit:!!p.hit,crit:p.crit!=null?!!p.crit:!!d.crit,dmg:p.dmg,adv:!!all.adv,dis:!!all.dis,advReason:all.advReason,cover:all.cover,coverName:coverName,mods:all.mods||[],dropped:all.dropped};
  }
  function pushEvent(row){
    if(!row)return "";
    if(row.kind==="attack_declared"){attackDeclares[row.unit]=Object.assign({},row.payload||{});return "";}
    var declared=null;
    if(row.kind==="attack_resolved"){declared=attackDeclares[row.unit]||null;delete attackDeclares[row.unit];}
    var f=factFromEvent(row,declared);return f?pushFact(f):"";
  }

  function ensureContestButton(state){
    if(!root.document)return;
    var bar=root.document.getElementById("fgBar");if(!bar)return;
    var old=root.document.getElementById("fgContestNext");
    var show=!!(state&&state.session&&state.iControl&&!state.waiting&&state.pending&&state.pending.kind==="attack"&&!state.suppressEnemyHud);
    if(!show){if(old)old.remove();return;}
    if(!old){old=root.document.createElement("button");old.id="fgContestNext";old.type="button";old.className="fg-contest-next";old.addEventListener("click",function(){root.document.dispatchEvent(new root.CustomEvent("forge:toggleContest"));});
      var host=bar.querySelector(".fg-hint")||bar;host.appendChild(old);}
    old.classList.toggle("on",!!state.contestCover);
    old.innerHTML=state.contestCover?"⚖ Contest next shot: <b>armed</b>":"⚖ Contest next shot";
    old.title="Pause before the roll so the DM can re-rule cover for this attack. If no ruling arrives in 20 seconds, the grid stands.";
  }
  function installHudDecorator(){
    if(typeof root.renderForgeBar!=="function"||root.renderForgeBar.__tableCorrectness)return false;
    var raw=root.renderForgeBar;
    var wrapped=function(state){
      state=state||{};var sess=session();var snap=viewerSnapshot(sess,state.active);applyBody(sess,state.active);
      var outState=Object.assign({},state,{viewerMode:snap.mode,suppressEnemyHud:snap.suppressEnemyHud});
      if(snap.playerView){outState.order=(state.order||[]).map(function(u){return displayUnit(u,sess);});outState.active=displayUnit(state.active,sess);if(snap.suppressEnemyHud)outState.kit=null;}
      var out=raw(outState);
      if(root.document){var bar=root.document.getElementById("fgBar"),feed=root.document.getElementById("fgFeed");
        if(bar)bar.style.display=snap.suppressEnemyHud?"none":"";
        if(feed)feed.style.display="";
      }
      ensureContestButton(outState);return out;
    };
    wrapped.__tableCorrectness=true;wrapped._raw=raw;root.renderForgeBar=wrapped;return true;
  }
  function injectCss(){
    if(!root.document||root.document.getElementById("forgeTableCorrectnessCss"))return;
    var s=root.document.createElement("style");s.id="forgeTableCorrectnessCss";s.textContent=[
      (root.ForgeFeedRender&&root.ForgeFeedRender.CSS)||"",
      ".fg-contest-next{display:block;width:100%;margin-top:8px;padding:7px 10px;border:1px solid rgba(216,179,91,.55);background:rgba(216,179,91,.08);color:#d7c18a;font:700 11px/1.2 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}",
      ".fg-contest-next.on{background:rgba(216,179,91,.24);border-color:#d8b35b;color:#fff1bf}",
      ".forge-result-row{margin:-8px;padding:9px 10px;border-left:3px solid transparent}",
      ".forge-result-hit{background:rgba(54,111,67,.18);border-left-color:rgba(102,174,116,.7)}",
      ".forge-result-miss{background:rgba(125,55,55,.18);border-left-color:rgba(192,92,82,.7)}",
      ".forge-result-crit{background:rgba(142,111,38,.20);border-left-color:rgba(229,190,80,.8)}",
      ".forge-result-save{background:rgba(61,84,111,.18);border-left-color:rgba(99,139,181,.7)}",
      ".forge-result-heal{background:rgba(46,105,91,.18);border-left-color:rgba(86,170,144,.7)}",
      "body.forge-player-view #cbOverseer{display:none!important}",
      "body.forge-player-view.forge-active-foe #fgBar{display:none!important}"
    ].join("\n");root.document.head.appendChild(s);
  }
  function install(){injectCss();installKitAlias();installHudDecorator();applyBody();return true;}
  install();
  if(root.document)root.document.addEventListener("DOMContentLoaded",install,{once:true});
  return Object.freeze({VERSION:VERSION,VIEW_KEY:VIEW_KEY,privileged:privileged,mode:mode,staffView:staffView,playerView:playerView,setMode:setMode,toggle:toggle,applyBody:applyBody,visibleOrder:visibleOrder,displayUnit:displayUnit,viewerSnapshot:viewerSnapshot,normalizeKit:normalizeKit,installKitAlias:installKitAlias,factFromEvent:factFromEvent,factHtml:factHtml,pushFact:pushFact,pushEvent:pushEvent,installHudDecorator:installHudDecorator,install:install});
});
