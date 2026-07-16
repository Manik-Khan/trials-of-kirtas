#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");const s=fs.readFileSync(path.join(__dirname,"..","topography-test-mock.html"),"utf8");let pass=0;function has(x,m){if(!s.includes(x))throw Error("FAIL: "+m);console.log("ok",++pass,"-",m);}
has('forge-table-correctness.js?v=fg7','correctness seam is loaded');
has('forge-unit-art.js?v=ua2','unit-art cache stamp bumped');
has('id="sceneModeMenu"','Forge toggle owns the view menu');
has('id="sceneViewerMode"','Staff/Player View lives in Forge menu');
has('ForgeTableCorrectness.toggle','view toggle is local presentation state');
has("bestiary:{name:'Goblin',source:'MM'}",'fallback goblins carry bestiary identity');
has('No additional effect at higher levels.','non-scaling slot chooser explains higher slots');
has('else if(choices.length>1&&!READYING)','every leveled spell asks when several slots are eligible');
has('ForgeTableCorrectness.pushEvent(redactEnemyDefenseEvent(viewerFeedEvent(r)))','session feed paints authoritative resolved echoes through the viewer-safe seam');
has('+(hs.hit?"":" — miss"),false);','predictive attack narration does not duplicate rich row');
has('window.ForgeTableCorrectness.pushFact({actor:u.unit','sandbox attacks use rich feed renderer');
has('o.side==="foe"&&!staffView?""','player initiative hides enemy HP');
has('suppressEnemyHud ? null','player render receives no enemy kit');
has('ForgeTableCorrectness.staffView(sess)','Player View hides overseer toolbar');
has('forge-modal-open','reinforcement modal rises over HUD');
has('document.body.classList.remove("forge-modal-open")','closing reinforcements restores HUD');
has('resolved.fallbackUrl','token loader retries direct art after proxy failure');
has('hit:hs.hit,crit:hs.crit,roll:hs.roll','resolved attack facts repeat final display math');
has('coverName:ro.coverName||null','resolved PC attacks preserve the cover word');
has('kind:"ability",actor:u.unit,ability:a.label,effects:[{unit:t.unit,heal:t.hp-was}]','sandbox healing uses structured effects');
console.log("\n",pass,"Phase 1.5d contract checks green");
