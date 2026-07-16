/* Silvery Barbs RAW smoke — the reducer half (grant_advantage effect +
   consume on attack + replay determinism) and the pure gate/reroll logic
   extracted from the mock. Run: node smoke-silvery-barbs.js */
const FR = require("./forge-replay.js");
let pass=0, fail=0;
const ok=(n,c)=>{ c?pass++:fail++; console.log((c?"✓ ":"✗ ")+n); };

/* ── pure logic mirrored from index.html ── */
function sbReroll(orig, newRoll){ return Math.min(orig, newRoll); }   // RAW: keep original, take lower
// offer gate: SB offered to a caster hostile to the ATTACKER (the succeeder)
function sbOffered(casterSide, attackerSide){ return casterSide !== attackerSide; }

// reroll-lower arithmetic
ok("reroll keeps the lower (orig 18, new 5 → 5)", sbReroll(18,5)===5);
ok("reroll keeps the ORIGINAL when new is higher (orig 7, new 15 → 7)", sbReroll(7,15)===7);
ok("d20a(false,true)-style would reroll BOTH — sbReroll never discards a good original",
   sbReroll(19,19)===19);

// offer gate — the actual bug fix
ok("PC hitting a foe: SB NOT offered to a PC caster", sbOffered("pc","pc")===false);
ok("foe hitting a PC: SB offered to a PC caster", sbOffered("pc","foe")===true);
ok("foe caster is never offered SB vs a foe attacker (same side)", sbOffered("foe","foe")===false);

/* ── reducer: the advantage grant is a replayable fact ── */
const ROSTER = [
  { unit:"liadan",  side:"pc",  pos:{c:1,r:1}, hp:31, reacts:["silveryBarbs"] },
  { unit:"caim",    side:"pc",  pos:{c:2,r:1}, hp:30, reacts:[] },
  { unit:"goblin1", side:"foe", pos:{c:5,r:5}, hp:7,  reacts:[] }
];
const row=(seq,unit,kind,payload)=>({seq,unit,actor:"u-"+unit,kind,payload,created_at:seq});
const setup=[
  row(1,"__session","session_started",{}),
  row(2,"liadan","initiative_rolled",{roll:15}),
  row(3,"caim","initiative_rolled",{roll:10}),
  row(4,"__session","initiative_set",{order:["liadan","caim","goblin1"]})
];

// grant advantage to caim via a prompt_answered carrying a grant_advantage effect
const pAns=setup.concat([
  row(5,"__session","prompt",{ to:"liadan", react:"silveryBarbs", timeout:20,
    context:{attacker:"goblin1",target:"caim"} }),
  row(6,"liadan","prompt_answered",{ prompt_seq:5, use:true, grantTo:"caim",
    effects:[{unit:"caim", grant_advantage:true, grant_reason:"silvery barbs"}] })
]);
let s=FR.replayLog(ROSTER,pAns);
ok("grant_advantage sets advGrant on the chosen ally", s.units.caim.advGrant && s.units.caim.advGrant.reason==="silvery barbs");
ok("the caster is NOT auto-granted (only the chosen unit)", !s.units.liadan.advGrant);
ok("SB answer marks liadan's reaction used", s.units.liadan.reactionUsed===true);

// self-grant fallback (grantTo = caster)
const selfGrant=setup.concat([
  row(5,"__session","prompt",{ to:"liadan", react:"silveryBarbs", timeout:20, context:{attacker:"goblin1",target:"caim"} }),
  row(6,"liadan","prompt_answered",{ prompt_seq:5, use:true, grantTo:"liadan",
    effects:[{unit:"liadan", grant_advantage:true, grant_reason:"silvery barbs"}] })
]);
let s2=FR.replayLog(ROSTER,selfGrant);
ok("self-grant fallback lands advGrant on the caster", s2.units.liadan.advGrant && s2.units.liadan.advGrant.reason==="silvery barbs");

// consume: caim's attack_resolved clears his standing grant
const spend=pAns.concat([
  row(7,"caim","attack_declared",{ target:"goblin1", hitBonus:5 }),
  row(8,"caim","attack_resolved",{ target:"goblin1", hit:true, dmg:6 })
]);
let s3=FR.replayLog(ROSTER,spend);
ok("advGrant is CONSUMED when the granted unit attacks", !s3.units.caim.advGrant);
ok("consuming caim's grant does not touch anyone else", s3.units.liadan.advGrant==null);

// replay determinism — same log twice, identical grant state
let a=FR.replayLog(ROSTER,pAns), b=FR.replayLog(ROSTER,pAns);
ok("replay is deterministic (advGrant identical across two runs)",
   JSON.stringify(a.units.caim.advGrant)===JSON.stringify(b.units.caim.advGrant));

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
