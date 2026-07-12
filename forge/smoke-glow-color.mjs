/* glowColorFor logic smoke — extract the pure function from the real file and
   assert M's rules: foe red, friendly gold, target red wins, active PC auto-gold. */
import fs from "fs";
const html=fs.readFileSync("topo-work.html","utf8");
const mod=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>/module/.test(m[1]))[0][2];
const start=mod.indexOf("function glowColorFor");
const end=mod.indexOf("function syncGlow");
const body=mod.slice(start,end);
const GLOW_SEL="#e8b53a", GLOW_TGT="#c0402f";
let CB={active:true,over:false,ti:0,order:[],selKey:null,tgtKey:null};
function active(){ return CB.order[CB.ti]; }
const glowColorFor=new Function("CB","active","GLOW_SEL","GLOW_TGT","return ("+body.replace("function glowColorFor(u){","function(u){")+")")(CB,active,GLOW_SEL,GLOW_TGT);
const pc ={key:"caim",side:"pc", alive:true};
const foe={key:"gob", side:"foe",alive:true};
CB.order=[pc,foe];
let pass=0,fail=0; const ok=(n,c)=>{c?pass++:fail++;console.log((c?"✓ ":"✗ ")+n);};

CB.ti=0; CB.selKey=null; CB.tgtKey=null;
ok("active PC glows gold (its turn, no click)", glowColorFor(pc)===GLOW_SEL);
ok("non-active foe glows nothing by default", glowColorFor(foe)===null);

CB.selKey="gob";
ok("selecting a foe → RED (not gold)", glowColorFor(foe)===GLOW_TGT);
CB.selKey="caim";
ok("selecting a PC → gold", glowColorFor(pc)===GLOW_SEL);

CB.selKey=null; CB.tgtKey="gob";
ok("targeting a foe → red", glowColorFor(foe)===GLOW_TGT);
CB.tgtKey="caim";
ok("targeting even a PC → red (explicit target wins)", glowColorFor(pc)===GLOW_TGT);

CB.tgtKey=null; CB.selKey=null; CB.ti=1;   // foe's turn
ok("active FOE never auto-golds", glowColorFor(foe)===null);
const dead={key:"x",side:"pc",alive:false}; CB.order=[dead]; CB.ti=0; CB.selKey="x";
ok("dead unit never glows", glowColorFor(dead)===null);

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
