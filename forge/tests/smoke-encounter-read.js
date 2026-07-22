/* Known-answer smoke for Forge Encounter Read.
   Run: node forge/tests/smoke-encounter-read.js */
const Read = require("../forge-encounter-read.js");

let pass = 0, fail = 0;
function ok(name, condition) { condition ? pass++ : fail++; console.log((condition ? "✓ " : "✗ ") + name); }

ok("module is dual-export ready", Read.VERSION === 1);
ok("fractional CR parses from strings and 5etools objects", Read.crNumber("1/4") === .25 && Read.crNumber({cr:"1/2"}) === .5);
ok("CR maps to standard encounter XP", Read.xpForCr("1/4") === 50 && Read.xpForCr(3) === 700);
ok("multiclass level sums classes", Read.levelOf({classes:[{level:3},{level:2}]}) === 5);
ok("legacy class label sums levels", Read.levelOf({classLabel:"Warlock 2 / Sorcerer 1"}) === 3);

const party = [1,2,3,4].map(n => ({name:"PC "+n,level:4,currentHp:30,maxHp:30,pos:{c:n-1,r:1}}));
const goblins = [1,2,3,4].map(n => ({name:"Goblin "+n,cr:"1/4",active:true,pos:{c:n-1,r:0}}));
const orcs = [1,2].map(n => ({name:"Orc "+n,cr:"1/2",active:true,pos:{c:n+3,r:0}}));
const captain = {name:"Bugbear Captain",cr:1,active:false,pos:{c:5,r:0}};
const map = {cols:6,rows:2,h:[10,10,10,10,10,10,0,0,0,0,0,0]};
const read = Read.analyze({party,enemies:goblins.concat(orcs,captain),map});

ok("four level-four characters total sixteen levels", read.party.totalLevels === 16 && read.party.count === 4);
ok("party XP thresholds sum exactly", read.party.thresholds.easy === 500 && read.party.thresholds.medium === 1000 && read.party.thresholds.hard === 1500 && read.party.thresholds.deadly === 2000);
ok("CR benchmark is four", read.party.crBenchmark === 4);
ok("single-monster benchmark is CR four", read.party.singleMonsterBenchmark === 4);
ok("opening wave excludes waiting captain", read.opening.count === 6 && read.opening.totalCr === 2);
ok("opening wave reads Easy", read.opening.baseXp === 400 && read.opening.multiplier === 2 && read.opening.adjustedXp === 800 && read.opening.difficulty === "Easy");
ok("full roster reads Hard", read.full.count === 7 && read.full.totalCr === 3 && read.full.adjustedXp === 1500 && read.full.difficulty === "Hard");
ok("action economy warning uses opening enemies", read.warnings.some(w => w.key === "actions" && /6 active/.test(w.copy)));
ok("waiting-wave warning names held enemies", read.warnings.some(w => w.key === "waves" && /^1 enemies/.test(w.title)));
ok("fresh HP is visible context", read.warnings.some(w => w.key === "fresh"));
ok("map elevation is visible context", read.warnings.some(w => w.key === "elevation" && /10 feet/.test(w.copy)));

const largeParty = Array(6).fill(0).map(() => ({level:4}));
const largeRead = Read.analyze({party:largeParty,enemies:goblins.concat(orcs,captain).map(x => Object.assign({},x,{active:true}))});
ok("large parties step the count multiplier down", largeRead.full.multiplier === 2 && largeRead.full.adjustedXp === 1200);

const unknown = Read.analyze({party,enemies:[{name:"Homebrew",active:true}]});
ok("unknown CR never invents XP", unknown.full.unknownCount === 1 && unknown.full.adjustedXp === 0);
ok("unknown CR narrates", unknown.warnings.some(w => w.key === "unknown"));

const catalogue = [
  {name:"Bugbear",raw:{name:"Bugbear",cr:1,type:{type:"humanoid",tags:["goblinoid"]}}},
  {name:"Worg",raw:{name:"Worg",cr:"1/2",type:"monstrosity"}},
  {name:"Human Guard",raw:{name:"Human Guard",cr:"1/8",type:{type:"humanoid",tags:["human"]}}},
  {name:"Orc",raw:{name:"Orc",cr:"1/2",type:{type:"humanoid",tags:["orc"]}}}
];
const related = Read.relatedCreatures([
  {name:"Goblin",statblock:{name:"Goblin",type:{type:"humanoid",tags:["goblinoid"]}}},
  {name:"Hobgoblin",statblock:{name:"Hobgoblin",type:{type:"humanoid",tags:["goblinoid"]}}}
], catalogue);
ok("related enemies include shared goblinoids", related.some(x => x.name === "Bugbear"));
ok("explicit companion relationships include Worg", related.some(x => x.name === "Worg"));
ok("generic humans are not suggested for goblinoids", !related.some(x => x.name === "Human Guard"));
ok("unrelated orcs stay outside a goblinoid-only selection", !related.some(x => x.name === "Orc"));

const impact = Read.impactWithCreature(read.opening, read.party.count, "1/2");
ok("one added CR one-half creature recalculates adjusted XP", impact.adjustedXp === 1250);
ok("recalculated impact crosses into Medium", Read.difficultyFor(impact.adjustedXp, read.party.thresholds) === "Medium");

const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
ok("Workshop loads the cache-stamped authority", html.includes('forge-encounter-read.js?v=fread1'));
ok("Workshop exposes opening and full-roster reads", html.includes('data-encounter-read="opening"') && html.includes('data-encounter-read="full"'));
ok("adapter consumes authored activation instead of assuming all-at-once", html.includes("encounterActivationMode==='active'") && html.includes("currentEncounterRegionRecord(deployment)"));
ok("related suggestions use the existing Bestiary catalogue", html.includes("ForgeEncounterRead.relatedCreatures") && html.includes("ensureFoeBooksLoaded"));
ok("full Bestiary remains a separate browse-all door", html.includes('id="encounterOpenBestiary"') && html.includes("document.getElementById('fpToggle')"));
ok("retired benchmark nickname is absent", !/lazy line/i.test(html));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
