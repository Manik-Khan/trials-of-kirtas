// smoke-soul-facets.mjs — immutable mechanical history + lineage known answers.
import { classesOf, levelOf, classSummary, mechanicalSnapshot, appendFacet, facetsOf, lineageOf } from '../../soul-facets.js';

let pass = 0, fail = 0;
const ok = (label, condition) => { if (condition) pass++; else { fail++; console.error('FAIL:', label); } };
const clone = value => JSON.parse(JSON.stringify(value));

const character = {
  key: 'liadan', name: 'Líadan Luchóg',
  structural: {
    name: 'Líadan Luchóg', level: 6,
    classes: [{ name: 'Bard', level: 5, subclass: 'College of Lore', starting: true }, { name: 'Cleric', level: 1, subclass: 'Life Domain' }],
    features: [{ name: 'Cutting Words' }], customFeatures: [{ name: 'Shift Step' }],
    spellcasting: { groups: [{ heading: '1st Level', spells: [{ name: 'Healing Word' }, { name: 'Bless' }] }] },
    _build: { classes: [{ n: 'Bard', level: 5 }, { n: 'Cleric', level: 1 }] },
    soulLineage: { fragments: [{ characterKey: 'second', name: 'Second Reality Fragment', campaign: 'The Second Reality', status: 'sacrificed' }], refractions: [{ name: 'Borrowed Resolve' }] }
  },
  vitals: { hp: 41, concentration: null }, inventory: [{ name: 'Rapier' }], equipment: { mainHand: 'Rapier' }, currency: { gp: 17 },
  bio: { backstory: 'not part of a facet' }, notes: 'journal-adjacent notes stay outside'
};

ok('multiclass entries normalize', classesOf(character.structural).map(c => c.name).join(',') === 'Bard,Cleric');
ok('total level sums every class', levelOf(character.structural) === 6);
ok('class summary keeps multiclass levels', classSummary(character.structural) === 'Bard 5 / Cleric 1');
ok('legacy classLabel parses names and levels', classSummary({ classLabel: 'Warlock 2 / Sorcerer 1' }) === 'Warlock 2 / Sorcerer 1' && levelOf({ classLabel: 'Warlock 2 / Sorcerer 1' }) === 3);

const snapshot = mechanicalSnapshot(character);
ok('snapshot includes structural build data', snapshot.structural._build.classes.length === 2);
ok('snapshot includes vitals, inventory, equipment, and currency', snapshot.vitals.hp === 41 && snapshot.inventory[0].name === 'Rapier' && snapshot.equipment.mainHand === 'Rapier' && snapshot.currency.gp === 17);
ok('snapshot excludes notes and bio', !('notes' in snapshot) && !('bio' in snapshot));
ok('snapshot excludes lineage from the mechanical payload', !snapshot.structural.soulLineage);

const original = clone(character);
const first = appendFacet(character, { createdAt: '2026-07-22T12:00:00.000Z', label: 'Before Level 7' });
ok('append creates one Level 6 facet', first.appended && first.facet.level === 6 && first.structural.soulFacets.items.length === 1);
ok('facet summary records feature and spell counts', first.facet.counts.features === 2 && first.facet.counts.spells === 2);
ok('append does not mutate the source character', JSON.stringify(character) === JSON.stringify(original));
ok('facet payload does not recursively contain soulFacets', !first.facet.snapshot.structural.soulFacets);

const withFirst = clone(character); withFirst.structural = first.structural;
const duplicate = appendFacet(withFirst, { createdAt: '2026-07-22T12:05:00.000Z' });
ok('identical current mechanics do not duplicate the latest facet', !duplicate.appended && facetsOf({ structural: duplicate.structural }).length === 1);

const changed = clone(withFirst); changed.structural.classes[0].level = 6; changed.structural.level = 7;
const second = appendFacet(changed, { createdAt: '2026-07-29T12:00:00.000Z' });
ok('changed mechanics append a second facet', second.appended && second.structural.soulFacets.items.length === 2 && second.facet.level === 7);

const lineage = lineageOf(character);
ok('lineage derives the current fragment', lineage.fragments.some(f => f.characterKey === 'liadan' && f.current));
ok('lineage retains cross-reality fragments', lineage.fragments.some(f => f.characterKey === 'second' && f.campaign === 'The Second Reality'));
ok('lineage retains Refractions', lineage.refractions[0].name === 'Borrowed Resolve');

console.log(`\nsmoke-soul-facets: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
