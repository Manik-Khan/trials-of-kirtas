const FR = require("../forge-replay.js");
const FB = require("../forge-board.js");
let pass=0, fail=0;
function ok(n,c){ if(c){pass++;} else {fail++; console.log("  FAIL "+n);} }
function snap(s){ return JSON.parse(JSON.stringify(s)); }
const roster=[{unit:"caim",side:"pc",pos:{c:1,r:1},hp:24},{unit:"gob1",side:"foe",pos:{c:5,r:5},hp:7}];
function run(rows){ // replay collecting verbs per row
  let st=FR.initialState(roster), out=[];
  rows.forEach(r=>{ const before=snap(st);
    if(r.kind==="override"||r.kind==="restore"){ st=FR.replayLog(roster,rows.filter(x=>x.seq<=r.seq)); }
    else FR.applyEvent(st,r,null);
    out.push(FB.verbsFor(r,before,st)); });
  return {st,verbs:out};
}
const rows=[
  {seq:1,kind:"session_started",unit:"__session",payload:{}},
  {seq:2,kind:"initiative_set",unit:"__session",payload:{order:["caim","gob1"]}},
  {seq:3,kind:"move_declared",unit:"caim",payload:{path:[{c:1,r:1},{c:2,r:1},{c:3,r:1}]}},
  {seq:4,kind:"move_resolved",unit:"caim",payload:{final_cell:{c:3,r:1}}},
  {seq:5,kind:"attack_declared",unit:"caim",payload:{target:"gob1",roll:18}},
  {seq:6,kind:"prompt",unit:"caim",payload:{to:"gob1",react:"shield",timeout:20}},
  {seq:7,kind:"prompt_answered",unit:"gob1",payload:{prompt_seq:6,use:false}},
  {seq:8,kind:"attack_resolved",unit:"caim",payload:{target:"gob1",hit:true,dmg:3}},
  {seq:9,kind:"turn_ended",unit:"caim",payload:{}},
  {seq:10,kind:"edit",unit:"__session",payload:{changes:[{add_unit:{unit:"gob2",side:"foe",pos:{c:6,r:6},hp:7}}]}},
];
const {st,verbs}=run(rows);
ok("session_started → status verb", verbs[0].some(v=>v.t==="status"&&v.status==="active"));
ok("initiative_set → turn verb for caim", verbs[1].some(v=>v.t==="turn"&&v.unit==="caim"&&v.round===1));
ok("move_declared → no movement verb yet", !verbs[2].some(v=>v.t==="walk"||v.t==="jump"));
ok("move_resolved → walk with declared path", verbs[3].some(v=>v.t==="walk"&&v.unit==="caim"&&v.path.length===3&&v.to.c===3));
ok("prompt → prompt verb", verbs[5].some(v=>v.t==="prompt"&&v.prompt.to==="gob1"));
ok("answer → prompt_clear", verbs[6].some(v=>v.t==="prompt_clear"));
ok("attack_resolved → hp verb delta -3", verbs[7].some(v=>v.t==="hp"&&v.unit==="gob1"&&v.hp===4&&v.delta===-3));
ok("turn_ended → turn verb gob1", verbs[8].some(v=>v.t==="turn"&&v.unit==="gob1"));
ok("add_unit → spawn verb", verbs[9].some(v=>v.t==="spawn"&&v.unit==="gob2"));
// restore → resync
const rows2=rows.concat([{seq:11,kind:"restore",unit:"__session",payload:{to_seq:2,snapshot:FR.snapshot(FR.replayLog(roster,rows.slice(0,2)))}}]);
ok("restore → resync verb", run(rows2).verbs[10].some(v=>v.t==="resync"));
// bite-1 fix (2026-07-11): a lost move_declared no longer degrades the tween —
// the resolve fact carries its own path, and verbsFor prefers declared, then payload
const gap=[
  {seq:1,kind:"session_started",unit:"__session",payload:{}},
  {seq:2,kind:"initiative_set",unit:"__session",payload:{order:["caim","gob1"]}},
  // no move_declared: the row was silently lost in transit
  {seq:4,kind:"move_resolved",unit:"caim",payload:{final_cell:{c:3,r:1},path:[{c:1,r:1},{c:2,r:1},{c:3,r:1}]}},
  {seq:5,kind:"move_resolved",unit:"caim",payload:{final_cell:{c:4,r:1}}},   // legacy row: no path anywhere
];
const gapRun=run(gap);
ok("move_resolved with payload.path and no declare → still a walk",
  gapRun.verbs[2].some(v=>v.t==="walk"&&v.unit==="caim"&&v.path.length===3&&v.to.c===3));
ok("no declared and no payload path → jump (old logs unchanged)",
  gapRun.verbs[3].some(v=>v.t==="jump"&&v.unit==="caim"&&v.to.c===4));
// controls / canClaim / mirrorPlan
ok("controls: own unit", FB.controls({actor:"u1",units:["caim"],overseer:false},"caim"));
ok("controls: overseer any", FB.controls({actor:"u9",units:[],overseer:true},"gob1"));
ok("controls: not yours", !FB.controls({actor:"u1",units:["caim"],overseer:false},"gob1"));
const sess={status:"staging",roster:[{unit:"caim",kind:"pc"},{unit:"gob1",kind:"foe"}],controllers:{u2:["cosmere"]}};
ok("canClaim ok", FB.canClaim(sess,"u1","caim").ok);
ok("canClaim: foes unclaimable", !FB.canClaim(sess,"u1","gob1").ok);
ok("canClaim: taken", !FB.canClaim({...sess,controllers:{u2:["caim"]}},"u1","caim").ok);
ok("canClaim: ended", !FB.canClaim({...sess,status:"ended"},"u1","caim").ok);
// mirrorPlan: hp changed on MY unit only, absolute value
const b4={units:{caim:{hp:24},gob1:{hp:7}}}, af={units:{caim:{hp:20},gob1:{hp:4}}};
const plan=FB.mirrorPlan(b4,af,["caim"],{caim:{sheet_ref:"caim"},gob1:{}});
ok("mirrorPlan: one write, my unit, absolute", plan.length===1&&plan[0].key==="caim"&&plan[0].vitals.hp===20);
console.log("smoke-forge-board: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
