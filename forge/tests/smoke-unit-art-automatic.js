#!/usr/bin/env node
"use strict";
const A=require("../forge-unit-art.js");let pass=0;function ok(v,m){if(!v)throw Error("FAIL: "+m);console.log("ok",++pass,"-",m);}
const g={unit:"foe-goblin-1",side:"foe",name:"Goblin 1",bestiary:{name:"Goblin",source:"MM"}};
const id=A.monsterIdentity(null,g);ok(id.name==="Goblin"&&id.source==="MM","generic Forge goblin carries canonical bestiary identity");
const r=A.resolve(g,{});ok(r.source==="5etools-token"&&!r.fallback,"bestiary identity resolves automatic monster art");
ok(r.url.includes("/.netlify/functions/forge-token-art")&&r.url.includes("source=MM"),"WebGL receives same-origin token proxy URL");
ok(r.fallbackUrl==="https://5e.tools/img/bestiary/tokens/MM/Goblin.webp","direct 5e.tools art remains load fallback");
const picked={unit:"foe-wolf-1",side:"foe",name:"Wolf 1",statblock:{name:"Wolf",source:"MM"}};
ok(A.resolve(picked,{}).fallbackUrl.endsWith("/MM/Wolf.webp"),"picked statblock derives its own token art");
const custom={unit:"x",side:"foe",name:"X",tokenArt:"https://example.com/x.png",statblock:{name:"Goblin",source:"MM"}};
ok(A.resolve(custom,{}).source==="unit-field","custom art still outranks automatic art");
console.log("\n",pass,"automatic-art checks green");
