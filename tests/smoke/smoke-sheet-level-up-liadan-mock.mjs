// smoke-sheet-level-up-liadan-mock.mjs — guards the standalone Líadan Level Up interaction proof.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../_edits/mock-sheet-level-up-liadan.html', import.meta.url), 'utf8');
let pass = 0;
let fail = 0;
const ok = (label, condition) => {
  if (condition) { pass++; console.log(`ok ${pass} - ${label}`); }
  else { fail++; console.error(`not ok ${pass + fail} - ${label}`); }
};

ok('mock is a standalone HTML document', /<!doctype html>/i.test(html) && /<title>ToK · Líadan Level Up Mock<\/title>/.test(html));
ok('mock has no external dependencies', !/<script[^>]+src=|<link[^>]+href=|\bfetch\s*\(|\bsupabase\b/i.test(html));
ok('mock explicitly performs no character writes', /Standalone player Level Up mock · no character writes/.test(html) && /no character data changed/i.test(html));
ok('mock is fixed to Líadan', /Líadan Luchóg/.test(html) && /Mouseling/.test(html));
ok('current multiclass build is exact', /Bard 3<\/b> · College of Creation/.test(html) && /Cleric 1<\/b> · Life Domain/.test(html));
ok('character level advances from four to five', /Level 4 → 5/.test(html));
ok('advancing class is fixed to Bard', /taking Bard from 3 to 4/.test(html) && /Bard 3 → 4/.test(html));
ok('Cleric level is visibly unchanged', /Cleric 1 unchanged/.test(html));
ok('species is carried forward', /Species<\/span><b>Mouseling/.test(html));
ok('background is carried forward', /Entertainer \(Singer\)/.test(html));
ok('subclasses are carried forward', /College of Creation<br>Life Domain/.test(html));
ok('equipment and personality are carried forward', /Equipment, proficiencies, personality, biography, and existing spells/.test(html));
ok('level up is distinguished from Reforge', /This is a Level Up, not a Reforge/.test(html));
ok('advanced Reforger is a separate action', /Open full Reforger · advanced/.test(html) && /separate, intentional action/.test(html));
ok('full class editing controls are absent', !/Add class|Remove Bard|Remove Cleric|Set starting|Lower level|Raise level/.test(html));
ok('full creation steps are absent', !/>Species<\/button>|>Background<\/button>|>Items<\/button>|>Personality<\/button>/.test(html));
ok('flow has three focused stages', (html.match(/data-step-button="[1-3]"/g) || []).length === 3 && (html.match(/data-step-panel="[1-3]"/g) || []).length === 3);
ok('automatic proficiency change is exact', /Proficiency \+2 → \+3/.test(html));
ok('HP is a required player choice rather than an automatic fixed gain', /Hit points · player choice/.test(html) && /Choose the new hit points/.test(html) && !/automatic:\[[^\]]*Maximum HP/.test(html));
ok('HP offers fixed average or Bard hit-die roll', /data-hp-mode="average"/.test(html) && /data-hp-mode="roll"/.test(html) && /Roll 1d8/.test(html));
ok('HP choice adds Constitution and calculates the new maximum', /5 \+ CON 2 = 7 HP/.test(html) && /state\.hpRoll\+33/.test(html) && /maximum HP 31 →/.test(html));
ok('rolled HP is narrated and can be rerolled', /id="roll-result"/.test(html) && /id="reroll-hp"/.test(html) && /function rollHp\(\)/.test(html));
ok('multiclass slot gain is exact', /Two 3rd-level slots/.test(html) && /5th-level multiclass spellcaster/.test(html));
ok('slot explanation does not falsely grant third-level spells', /do not grant 3rd-level Bard or Cleric spells yet/.test(html));
ok('Bard allowance changes are exact', /3 cantrips and 7 known spells/.test(html) && /current 2 Bard cantrips and 6 known Bard spells/.test(html));
ok('ASI or feat is required', /Ability Score Improvement or feat/.test(html) && /data-asi-path="scores"/.test(html) && /data-asi-path="feat"/.test(html));
ok('ASI supports +2 or split +1 choices', /data-distribution="plus2"/.test(html) && /data-distribution="split"/.test(html));
ok('live ability scores seed the mock', /str:6,dex:12,con:14,int:12,wis:13,cha:15/.test(html));
ok('feat list is honestly illustrative', /illustrative mock shortlist/.test(html) && /complete campaign-approved feat library/.test(html));
ok('feat options have expandable descriptions', /const FEATS=/.test(html) && /data-feat-option/.test(html) && /Read details/.test(html));
ok('Fey Touched explains its benefits', /'Fey Touched':\{meta:/.test(html) && /Learn Misty Step/.test(html));
ok('Fey Touched requires its ability increase and spell choices', /id="fey-ability"/.test(html) && /id="fey-spell"/.test(html) && /Fey Touched’s added spell/.test(html));
ok('Fey Touched spell choices have descriptions', /const FEY_SPELLS=/.test(html) && /id="fey-spell-detail"/.test(html) && /showSelectionDetail\('#fey-spell-detail'/.test(html));
ok('one new Bard cantrip is required', /Choose one new Bard cantrip/.test(html) && /id="cantrip-options"/.test(html));
ok('cantrip choices have casting summaries and expandable descriptions', /const CANTRIPS=/.test(html) && /data-cantrip-option/.test(html) && /Cantrip · 1 action/.test(html));
ok('existing Bard cantrips remain selected', /Kept · Prestidigitation/.test(html) && /Kept · Vicious Mockery/.test(html));
ok('one new Bard spell is required', /Choose one new Bard spell/.test(html) && /id="spell-options"/.test(html));
ok('new Bard spell is limited to first or second level', /Bard spell of 1st or 2nd level/.test(html));
ok('Bard spell choices are separated by level tabs', /data-spell-level="1"/.test(html) && /data-spell-level="2"/.test(html) && /state\.spellLevel=Number/.test(html));
ok('inapplicable third-level spells are explained rather than offered', /Why there is no 3rd-level spell tab/.test(html) && !/data-spell-level="3"/.test(html));
ok('Bard spell choices have casting summaries and expandable descriptions', /const SPELLS=/.test(html) && /data-spell-option/.test(html) && /2nd level · 1 action/.test(html));
ok('saving-throw spells carry their target save ability', /'Suggestion':\{level:2,save:'wis'/.test(html) && /'Shatter':\{level:2,save:'con'/.test(html) && /'Faerie Fire':\{level:1,save:'dex'/.test(html));
ok('save preview uses proficiency plus the casting ability modifier', /dc:8\+3\+mod/.test(html) && /PB \+3 · Save DC/.test(html));
ok('Bard save preview uses Charisma', /data-dc-lens="bard"/.test(html) && /ability=kind==='cleric'\?'wis':'cha'/.test(html));
ok('Cleric save preview uses Wisdom as an explicit comparison', /data-dc-lens="cleric"/.test(html) && /Comparison only/.test(html));
ok('Bard spell cards remain bound to the Bard DC', /renderCatalog\('#spell-options',atLevel,'spell',state\.spell,bard\)/.test(html) && /save against Bard DC/.test(html));
ok('ability and feat choices recalculate spellcasting profiles', /function effectiveAbilities\(\)/.test(html) && /renderCastingDependent\(\)/.test(html));
ok('Fey Touched save DC uses its selected ability', /function feyCastingProfile\(\)/.test(html) && /choose the casting ability to calculate DC/.test(html));
ok('six existing Bard spells remain visible', ['Charm Person','Cure Wounds','Feather Fall','Healing Word','Silvery Barbs','Aid'].every(name => html.includes(name)));
ok('known-spell replacement is optional', /Replace one known Bard spell/.test(html) && /replace-spell-toggle/.test(html));
ok('Bardic Versatility cantrip replacement is optional', /Bardic Versatility · replace one Bard cantrip/.test(html) && /swap-cantrip-toggle/.test(html));
ok('Bardic Versatility Expertise move is optional', /Bardic Versatility · move one Expertise choice/.test(html) && /Medicine/.test(html) && /Performance/.test(html));
ok('optional choices are collapsed initially', /<details class="optional">/.test(html));
ok('review preserves the prior Facet', /existing Level 4 form remains in Facets of the Shard/.test(html));
ok('required choices gate review', /id="review-button"[^>]+disabled/.test(html) && /if\(step===3&&!requiredComplete\(\)\) return/.test(html));
ok('mobile controls retain touch-sized actions', /min-height:44px/.test(html) && /min-height:48px/.test(html) && /@media\(max-width:760px\)/.test(html));
ok('reduced-motion preference is respected', /prefers-reduced-motion:reduce/.test(html));
ok('narrated state uses accessible status roles', (html.match(/role="status"/g) || []).length >= 2);
ok('browser field state is exposed', /window\.__liadanLevelUpMock/.test(html));

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
ok('mock has one self-contained interaction script', scripts.length === 1);
new vm.Script(scripts[0], { filename: 'mock-sheet-level-up-liadan.inline.js' });
ok('inline interaction script parses', true);

console.log(`\nsmoke-sheet-level-up-liadan-mock: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
