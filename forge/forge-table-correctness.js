/* ── forge-table-correctness.js ───────────────────────────────────────
   Battle Forge table-correctness + presentation seams.

   Phase 1.5d:
   - canonical resource aliases (kiPoints -> ki, while rawKey stays intact)
   - local Staff View / Player View presentation mask
   - structured resolved-fact feed rows with verdict tinting
   - BG3 HUD cover-contest control restoration

   Phase 1.5e:
   - opaque, legible mechanical feed hierarchy
   - collapsed geometry diagnostics
   - persistent-effect/Sanctuary fact narration

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
  var VERSION="1.3.0";
  var VIEW_KEY="tok-forge-view-mode-v1";

  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
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

  function normalizeKit(kit,charData){
    if(!kit||typeof kit!=="object")return kit;
    if(kit.res&&kit.res.ki==null&&kit.res.kiPoints!=null)kit.res.ki=kit.res.kiPoints;
    (kit.pools||[]).forEach(function(p){if(p&&p.key==="kiPoints"){p.key="ki";if(!p.rawKey)p.rawKey="kiPoints";}});
    if(root.ForgeCombatRules&&typeof root.ForgeCombatRules.auditKit==="function")root.ForgeCombatRules.auditKit(kit,charData);
    return kit;
  }
  function installKitAlias(){
    var kd=root.ForgeKitDerive;if(!kd||kd.__tableCorrectnessKi)return false;
    ["derive","wrapStarterKit"].forEach(function(name){
      if(typeof kd[name]!=="function")return;var raw=kd[name];kd[name]=function(){var args=arguments;return normalizeKit(raw.apply(this,args),args[0]);};
    });
    kd.__tableCorrectnessKi=true;return true;
  }

  function toneForFact(f){
    if(!f)return "neutral";
    var effects=Array.isArray(f.effects)?f.effects:[];
    if(f.kind==="effect"||f.kind==="sanctuary-save")return f.saved===false?"ward":"effect";
    if(f.heal!=null||effects.some(function(e){return e&&e.heal!=null;}))return "heal";
    if(f.crit&&f.hit)return "crit";
    if(f.kind==="save"||f.saveAbility)return f.saved?"save":"hit";
    if(f.hit===true||f.dmg!=null||effects.some(function(e){return e&&e.dmg!=null;}))return "hit";
    if(f.hit===false)return "miss";return "neutral";
  }
  function unitName(key){
    if(key==="__unseen_foe__")return "Unseen foe";
    try{var u=root.CB&&root.CB.units&&(root.CB.units.find(function(x){return x.unit===key||x.key===key||x.id===key;}));return u?u.name:key;}catch(_e){return key;}
  }
  function effectHtml(f){
    var actor=esc(unitName(f.actor||"")),target=esc(unitName(f.target||""));
    if(f.kind==="sanctuary-save"){
      return '<div class="ffr-head"><b>'+actor+'</b> → <b>'+target+'</b> · Sanctuary <span class="ffr-verdict '+(f.saved?'save':'miss')+'">'+(f.saved?'SAVE':'WARD HOLDS')+'</span></div>'+
        '<div class="ffr-math">Wisdom '+esc(f.roll)+' '+(Number(f.mod)>=0?'+ ':'− ')+esc(Math.abs(Number(f.mod)||0))+' = <b>'+esc(f.total)+'</b> · DC '+esc(f.dc)+'</div>'+
        '<div class="ffr-primary">'+(f.saved?'The attack may proceed.':'Choose another target or lose the attack.')+'</div>';
    }
    var e=f.effect||{}, label=esc(e.label||e.kind||"Effect");
    if(f.action==="add")return '<div class="ffr-head"><b>'+label+'</b> <span class="ffr-verdict effect">APPLIED</span></div><div class="ffr-primary">'+target+' is warded'+(e.dc!=null?' · Wisdom save DC '+esc(e.dc):'')+'.</div>';
    return '<div class="ffr-head"><b>'+label+'</b> <span class="ffr-verdict miss">ENDED</span></div><div class="ffr-primary">'+target+(f.reason?' · '+esc(f.reason):'')+'.</div>';
  }
  function factHtml(fact){
    var body="";
    if(fact.kind==="effect"||fact.kind==="sanctuary-save")body=effectHtml(fact);
    else{
      var fr=root.ForgeFeedRender;if(!fr)return "";
      body=(fact.kind==="ability"||fact.ability&&!fact.roll&&!fact.saveAbility)?fr.abilityBody(fact,{unitName:unitName}):fr.rollBody(fact,{unitName:unitName});
    }
    return '<div class="forge-result-row forge-result-'+toneForFact(fact)+'">'+body+'</div>';
  }
  function pushFact(fact){var html=factHtml(fact);if(html&&typeof root.addForgeRow==="function")root.addForgeRow(html);return html;}
  var attackDeclares=Object.create(null);
  function effectsFromEvent(row){
    var p=row&&row.payload||{}, ops=Array.isArray(p.effects)?p.effects:[], out=[];
    ops.forEach(function(op){
      if(op&&op.add_effect)out.push({kind:"effect",action:"add",actor:row.unit,target:op.add_effect.target||op.unit,effect:op.add_effect});
      if(op&&op.remove_effect)out.push({kind:"effect",action:"remove",actor:row.unit,target:op.unit,effect:{id:op.remove_effect,label:op.effect_label||"Effect",kind:op.effect_kind||"effect"},reason:op.reason||"removed"});
    });
    return out;
  }
  function factFromEvent(row,declared){
    if(!row||!(row.kind==="attack_resolved"||row.kind==="ability_used"))return null;
    var p=row.payload||{},ctx=p.context||{};
    if(row.kind==="ability_used"){
      if(ctx&&typeof ctx==="object"&&ctx.kind==="sanctuary-save")return {kind:"sanctuary-save",actor:row.unit,target:ctx.target,roll:ctx.roll,mod:ctx.mod,total:ctx.total,dc:ctx.dc,saved:!!ctx.saved};
      var hasLedgerOp=(p.effects||[]).some(function(op){return op&&(op.add_effect||op.remove_effect);});
      if(hasLedgerOp&&p.silent!==false)return null;
      return {kind:"ability",actor:row.unit,unit:row.unit,ability:p.ability||p.mode||"Ability",target:p.target||(p.targets&&p.targets[0])||null,effects:p.effects||[],heal:p.heal,dmg:p.dmg,narration:typeof p.context==="string"?p.context:(p.narration||null)};
    }
    var d=declared||{}, all=Object.assign({},d,p);
    var coverName=all.coverName||({0:"none",2:"half",5:"three-quarters"})[all.cover]||(all.cover===Infinity?"total":null);
    return {kind:"attack",actor:row.unit,unit:row.unit,target:all.target,mode:all.mode||"Attack",roll:all.roll,hitBonus:all.hitBonus,hit:!!p.hit,crit:p.crit!=null?!!p.crit:!!d.crit,dmg:p.dmg,adv:!!all.adv,dis:!!all.dis,advReason:all.advReason,cover:all.cover,coverName:coverName,mods:all.mods||[],dropped:all.dropped};
  }
  function pushEvent(row){
    if(!row)return "";
    if(row.kind==="attack_declared"){attackDeclares[row.unit]=Object.assign({},row.payload||{});return "";}
    var declared=null;
    if(row.kind==="attack_resolved"){declared=attackDeclares[row.unit]||null;delete attackDeclares[row.unit];}
    var f=factFromEvent(row,declared),html=f?pushFact(f):"";
    effectsFromEvent(row).forEach(function(ef){pushFact(ef);});
    return html;
  }

  function stripTags(html){
    var s=String(html||"");
    if(root.document){var d=root.document.createElement("div");d.innerHTML=s;var t=d.textContent||d.innerText;if(t)return t;}
    return s.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  }
  function isGeometryDiagnostic(html){return /occluder\s+at|corners?\s+blocked|grid\s+(?:ray|geometry)|blocker\s+cell/i.test(stripTags(html));}
  function diagnosticHtml(html){
    var text=stripTags(html);
    return '<details class="forge-geometry-group"><summary>Geometry details</summary><div class="forge-geometry-line">'+esc(text)+'</div></details>';
  }
  function pushDiagnostic(html){var out=diagnosticHtml(html);if(typeof root.addForgeRow==="function")root.addForgeRow(out,{channel:"system"});return out;}

  var FEED_VIEW_KEY="tok-forge-feed-view-v1";
  function feedView(){var s=storage(),v="table";try{v=s&&s.getItem(FEED_VIEW_KEY)||"table";}catch(_e){}return /^(table|system|all)$/.test(v)?v:"table";}
  function setFeedView(v){if(!/^(table|system|all)$/.test(v))v="table";var s=storage();try{if(s)s.setItem(FEED_VIEW_KEY,v);}catch(_e){}applyFeedView(v);return v;}
  function rowChannel(html,opts){if(opts&&opts.channel)return opts.channel;if(root.ForgeCombatRules&&root.ForgeCombatRules.categoryForHtml)return root.ForgeCombatRules.categoryForHtml(html);return isGeometryDiagnostic(html)?"system":"table";}
  function applyFeedView(v){if(!root.document)return;v=v||feedView();var feed=root.document.getElementById("fgFeed");if(!feed)return;feed.dataset.feedView=v;feed.querySelectorAll(".fg-feed-tab").forEach(function(b){b.classList.toggle("on",b.dataset.view===v);});feed.querySelectorAll(".fg-frow[data-feed-channel]").forEach(function(r){r.hidden=!(v==="all"||r.dataset.feedChannel===v);});}
  function ensureFeedTabs(){if(!root.document)return false;var feed=root.document.getElementById("fgFeed");if(!feed)return false;var tabs=root.document.getElementById("fgFeedTabs");if(!tabs){tabs=root.document.createElement("div");tabs.id="fgFeedTabs";tabs.className="fg-feed-tabs";["table","system","all"].forEach(function(v){var b=root.document.createElement("button");b.type="button";b.className="fg-feed-tab";b.dataset.view=v;b.textContent=v.charAt(0).toUpperCase()+v.slice(1);b.onclick=function(){setFeedView(v);};tabs.appendChild(b);});var head=feed.firstElementChild;feed.insertBefore(tabs,head?head.nextSibling:feed.firstChild);}
    /* Rows that arrived before this decorator installed still need a channel;
       otherwise System filtering would leave old geometry diagnostics visible. */
    feed.querySelectorAll(".fg-frow:not([data-feed-channel])").forEach(function(r){r.dataset.feedChannel=rowChannel(r.innerHTML);});
    applyFeedView();return true;}
  function markNewestFeedRow(channel){if(!root.document)return;var feed=root.document.getElementById("fgFeed");if(!feed)return;var rows=feed.querySelectorAll(".fg-frow:not([data-feed-channel])");if(!rows.length)return;var row=rows[0];row.dataset.feedChannel=channel||"table";applyFeedView();}
  function installFeedChannels(){if(typeof root.addForgeRow!=="function"||root.addForgeRow.__feedChannels)return false;var raw=root.addForgeRow;var wrapped=function(html,opts){var ch=rowChannel(html,opts);var out=raw.apply(this,arguments);/* Stamp the just-added row before retro-classifying older rows, so an explicit opts.channel always wins. */markNewestFeedRow(ch);ensureFeedTabs();return out;};wrapped.__feedChannels=true;wrapped._raw=raw;root.addForgeRow=wrapped;ensureFeedTabs();return true;}
  function ensureFlowButtons(state){
    if(!root.document)return;var bar=root.document.getElementById("fgBar");if(!bar)return;var host=bar.querySelector(".fg-hint")||bar;
    function btn(id,label,eventName,show,title){var b=root.document.getElementById(id);if(!show){if(b)b.remove();return null;}if(!b){b=root.document.createElement("button");b.id=id;b.type="button";b.className="fg-flow-btn";b.addEventListener("click",function(){root.document.dispatchEvent(new root.CustomEvent(eventName));});host.appendChild(b);}b.innerHTML=label;b.title=title||"";return b;}
    btn("fgConfirmAttack","⚔ Confirm attack","forge:confirmAttack",!!(state&&state.confirmAttack),state&&state.confirmWhy||"Roll the armed attack against the selected target.");
    btn("fgUndoMove","↶ Undo move","forge:undoMove",!!(state&&state.undoMove),state&&state.undoWhy||"Undo your most recent move before another consequence occurs.");
    var stand=btn("fgStand","Stand up","forge:standProne",!!(state&&state.canStand),state&&state.standWhy||"Spend half your speed to stand from Prone.");if(stand&&state.standCostFt)stand.innerHTML="Stand up · "+state.standCostFt+" ft";
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
      ensureContestButton(outState);ensureFlowButtons(outState);return out;
    };
    wrapped.__tableCorrectness=true;wrapped._raw=raw;root.renderForgeBar=wrapped;return true;
  }
  function injectCss(){
    if(!root.document||root.document.getElementById("forgeTableCorrectnessCss"))return;
    var s=root.document.createElement("style");s.id="forgeTableCorrectnessCss";s.textContent=[
      (root.ForgeFeedRender&&root.ForgeFeedRender.CSS)||"",
      ".fg-contest-next{display:block;width:100%;margin-top:8px;padding:7px 10px;border:1px solid rgba(216,179,91,.55);background:rgba(216,179,91,.08);color:#d7c18a;font:700 11px/1.2 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}",
      ".fg-flow-btn{display:inline-flex;margin:8px 5px 0 0;padding:8px 11px;border:1px solid rgba(111,190,157,.55);background:rgba(58,138,146,.16);color:#d9fff1;font:750 11px/1.2 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}",
      "#fgConfirmAttack{border-color:rgba(216,179,91,.75);background:rgba(216,179,91,.20);color:#fff0bd}",
      "#fgUndoMove{border-color:rgba(150,177,196,.62);background:rgba(78,112,140,.17);color:#d9efff}",
      ".fg-feed-tabs{display:flex;gap:5px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.18)}",
      ".fg-feed-tab{flex:1;padding:6px 7px;border:1px solid rgba(216,179,91,.28);background:transparent;color:#aaa18f;font:750 10px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}",
      ".fg-feed-tab.on{background:rgba(216,179,91,.18);border-color:rgba(216,179,91,.66);color:#f6e8bd}",
      ".fg-frow[hidden]{display:none!important}",
      ".fg-contest-next.on{background:rgba(216,179,91,.24);border-color:#d8b35b;color:#fff1bf}",
      "#fgFeed{background:rgba(12,16,15,.965)!important;border-color:rgba(205,184,132,.34)!important;box-shadow:0 18px 54px rgba(0,0,0,.62)!important;backdrop-filter:blur(14px) saturate(.78);-webkit-backdrop-filter:blur(14px) saturate(.78);color:#eee7d8!important}",
      "#fgFeed .fg-feed-head,#fgFeed h3,#fgFeed h4{color:#dcbf72!important;text-shadow:0 1px 0 #000}",
      "#fgFeed>*{border-color:rgba(255,255,255,.09)!important}",
      "#fgFeed .fg-fbody{padding:0!important}",
      "#fgFeed .fg-frow{display:block!important;padding:0!important;gap:0!important;border-color:rgba(255,255,255,.09)!important;font:500 13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
      "#fgFeed .fg-frow>i,#fgFeed .fg-frow>em{display:block;padding:11px 13px;color:#e3dac9;font-size:13px;line-height:1.55}",
      ".forge-result-row{margin:0;padding:12px 13px 11px;border-left:4px solid transparent;color:#f2ecdf;font:500 13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
      ".forge-result-row .ffr-head{font-size:13px!important;font-weight:750!important;line-height:1.35!important;color:#fff8e8!important;letter-spacing:.01em}",
      ".forge-result-row .ffr-math,.forge-result-row [class*='math']{margin-top:5px;color:#ddd5c6!important;font:600 12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}",
      ".forge-result-row .ffr-primary{margin-top:5px;color:#fff4d8;font-size:14px;font-weight:720;line-height:1.35}",
      ".forge-result-row .ffr-dmg,.forge-result-row .ffr-dmg-total,.forge-result-row [class*='dmg-total']{display:inline-block;margin-top:6px;color:#fff5dc!important;font-size:17px!important;font-weight:850!important;line-height:1.15!important}",
      ".forge-result-row .ffr-verdict{display:inline-block;margin-left:5px;padding:2px 6px;border-radius:2px;font:800 10px/1.15 'Barlow Condensed',sans-serif;letter-spacing:.1em;vertical-align:1px}",
      ".forge-result-row .ffr-verdict.save{background:rgba(92,128,166,.32);color:#cfe7ff}.forge-result-row .ffr-verdict.miss{background:rgba(178,85,75,.30);color:#ffc9c1}.forge-result-row .ffr-verdict.effect{background:rgba(191,156,73,.28);color:#ffe6a1}",
      ".forge-result-hit{background:rgba(48,105,62,.27);border-left-color:rgba(103,185,121,.86)}",
      ".forge-result-miss{background:rgba(121,46,46,.28);border-left-color:rgba(211,100,88,.88)}",
      ".forge-result-crit{background:rgba(137,104,28,.30);border-left-color:rgba(236,194,72,.92)}",
      ".forge-result-save{background:rgba(54,77,104,.29);border-left-color:rgba(100,149,198,.84)}",
      ".forge-result-heal{background:rgba(39,100,83,.29);border-left-color:rgba(85,181,147,.84)}",
      ".forge-result-effect,.forge-result-ward{background:rgba(115,90,34,.27);border-left-color:rgba(221,181,79,.88)}",
      ".forge-geometry-group{margin:0;padding:9px 12px;background:rgba(3,6,6,.36);color:#bcb5a7;font:500 11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
      ".forge-geometry-group summary{cursor:pointer;color:#d2c7b1;font:700 11px/1.35 system-ui,-apple-system,sans-serif;letter-spacing:.03em;list-style-position:inside}",
      ".forge-geometry-group:not([open]) .forge-geometry-line{display:none}.forge-geometry-line{padding:8px 3px 2px;color:#aaa294;overflow-wrap:anywhere}",
      ".forge-effect-badge{position:absolute;transform:translate(-50%,-100%);padding:3px 7px;background:rgba(24,20,13,.92);border:1px solid #d8b35b;color:#ffe7a2;box-shadow:0 4px 16px rgba(0,0,0,.38);font:800 9px/1.2 'Barlow Condensed',sans-serif;letter-spacing:.1em;white-space:nowrap}",
      ".cbU-eff{position:absolute;margin:-5px 0 0 21px;width:14px;height:14px;display:grid;place-items:center;border-radius:50%;background:#2a2518;border:1px solid #d8b35b;color:#ffe7a2;font:800 9px/1 sans-serif;z-index:2}",
      ".cbUnit{position:relative}",
      ".cbSanctuaryCard{border-color:#d8b35b!important}",
      "body.forge-player-view #cbOverseer{display:none!important}",
      "body.forge-player-view.forge-active-foe #fgBar{display:none!important}"
    ].join("\n");root.document.head.appendChild(s);
  }
  function installFeedInteraction(){
    if(!root.document||root.document.__forgeFeedInteraction)return false;
    root.document.__forgeFeedInteraction=true;
    root.document.addEventListener("click",function(ev){
      var hit=ev&&ev.target&&ev.target.closest?ev.target.closest(".ffr-dmg-total"):null;
      if(!hit)return;
      var wrap=hit.closest?hit.closest(".ffr-dmg-wrap"):null;
      if(wrap)wrap.classList.toggle("expanded");
    });
    return true;
  }
  function install(){injectCss();installKitAlias();installHudDecorator();installFeedInteraction();installFeedChannels();ensureFeedTabs();applyBody();return true;}
  install();
  if(root.document)root.document.addEventListener("DOMContentLoaded",install,{once:true});
  return Object.freeze({VERSION:VERSION,VIEW_KEY:VIEW_KEY,privileged:privileged,mode:mode,staffView:staffView,playerView:playerView,setMode:setMode,toggle:toggle,applyBody:applyBody,visibleOrder:visibleOrder,displayUnit:displayUnit,viewerSnapshot:viewerSnapshot,normalizeKit:normalizeKit,installKitAlias:installKitAlias,factFromEvent:factFromEvent,factHtml:factHtml,pushFact:pushFact,pushEvent:pushEvent,isGeometryDiagnostic:isGeometryDiagnostic,diagnosticHtml:diagnosticHtml,pushDiagnostic:pushDiagnostic,feedView:feedView,setFeedView:setFeedView,applyFeedView:applyFeedView,installFeedChannels:installFeedChannels,ensureFeedTabs:ensureFeedTabs,installHudDecorator:installHudDecorator,installFeedInteraction:installFeedInteraction,ensureFlowButtons:ensureFlowButtons,install:install});
});
