// Durable item identity: hidden staff facts, append-only story events, transfer,
// transformation, and replay into the same current item state.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Items = require('../../item-provenance.js');

let pass = 0, fail = 0;
const ok = (name, condition, detail) => {
  if (condition) pass++;
  else { fail++; console.log('  FAIL:', name, detail === undefined ? '' : JSON.stringify(detail)); }
};
const rejects = (name, fn, message) => {
  try { fn(); ok(name, false, 'did not throw'); }
  catch (error) { ok(name, String(error && error.message).indexOf(message) >= 0, error && error.message); }
};

const first = Items.createItem({
  instanceId: 'item_8f31c2',
  displayName: 'Smoke-veiled embroidered cloak',
  publicDescription: 'A travel-stained cloak stitched with dim silver thread.',
  createdAt: '2026-08-13T18:00:00.000Z'
});
const secret = Items.createSecret({
  itemId: 'item_8f31c2',
  trueName: 'Cloak of Elvenkind',
  definitionKey: 'dmg:cloak-of-elvenkind',
  rarity: 'uncommon',
  publicDescription: 'The hood seems to gather shadow around its wearer.',
  mechanics: { stealthAdvantage: true, perceptionDisadvantage: true },
  lore: 'Woven for a vanished outrider of Veren\'s Watch.'
});

console.log('--- identity + separate staff secrets ---');
ok('item identity uses the v1 contract', first.schema === Items.ITEM_SCHEMA && first.instanceId === 'item_8f31c2');
ok('new item begins unidentified', first.identification === 'unidentified' && first.rarity === null);
ok('secret rarity normalizes to the sheet palette', secret.rarity === 'Uncommon');
ok('player item does not contain the secret name', JSON.stringify(Items.publicProjection(first)).indexOf('Cloak of Elvenkind') < 0);
ok('player item does not contain staff lore', JSON.stringify(Items.publicProjection(first)).indexOf('vanished outrider') < 0);
ok('staff projection keeps secret separate from public item', Items.staffProjection(first, secret).secret.lore === secret.lore);
rejects('a secret cannot be attached to another item', () => Items.staffProjection(Items.createItem({ instanceId: 'item_other', name: 'Other' }), secret), 'different item');
const guardedUnknown = Items.createItem({ instanceId: 'item_guarded', name: 'Unknown ring', definitionKey: 'dmg:ring-of-secrets', rarity: 'Legendary', mechanics: { forbidden: true } });
ok('unidentified creation cannot accidentally publish hidden rules', guardedUnknown.definitionKey === null && guardedUnknown.rarity === null && !guardedUnknown.mechanics.forbidden);

const history = [];
const recovered = Items.recover(first, {
  eventId: 'event_recovered', at: '2026-08-13T18:10:00.000Z', actorKey: 'staff-m',
  sessionId: 'session-42', locationId: 'location-pine-road', encounterId: 'encounter-goblin-patrol',
  battleMapId: 'battle-pine-road', summary: 'Recovered after the battle in the woods.'
});
history.push(recovered.event);

console.log('--- authored recovery + assignment ---');
ok('recovery retains the same item identity', recovered.item.instanceId === first.instanceId);
ok('recovery links session, location, encounter, and battle map', ['session-42', 'location-pine-road', 'encounter-goblin-patrol', 'battle-pine-road'].every((value) => JSON.stringify(recovered.event).indexOf(value) >= 0));
ok('recovery places the unassigned item at its location', recovered.item.status === 'recovered' && recovered.item.currentLocationId === 'location-pine-road');
ok('transition leaves its input untouched', first.status === 'unplaced' && first.currentLocationId === null);

const assigned = Items.assign(recovered.item, 'cosmere', {
  eventId: 'event_assigned', at: '2026-08-13T18:12:00.000Z', actorKey: 'staff-m',
  sessionId: 'session-42', locationId: 'location-pine-road', summary: 'The party entrusted the cloak to Cosmere.'
});
history.push(assigned.event);
ok('assignment moves current custody to Cosmere', assigned.item.currentBearerKey === 'cosmere' && assigned.item.status === 'held');
ok('assignment preserves the recovery event as historical fact', history[0].locationId === 'location-pine-road' && history[0].type === 'recovered');
rejects('assignment cannot silently replace an existing bearer', () => Items.assign(assigned.item, 'liadan', { eventId: 'event_bad_assignment' }), 'must be transferred');

console.log('--- identification + player naming ---');
const identified = Items.identify(assigned.item, secret, {
  eventId: 'event_identified', at: '2026-08-14T17:00:00.000Z', actorKey: 'staff-m',
  sessionId: 'session-43', journalPageId: 'journal-cloak-study', summary: 'The runes yielded their secret.'
});
history.push(identified.event);
ok('identification reveals the true name and rarity', identified.item.displayName === 'Cloak of Elvenkind' && identified.item.rarity === 'Uncommon');
ok('identification reveals mechanics into the public item', identified.item.mechanics.stealthAdvantage === true);
ok('identification does not copy staff lore into the public item', JSON.stringify(identified.item).indexOf('vanished outrider') < 0);
ok('identification event links the Journal page', identified.event.journalPageId === 'journal-cloak-study');
rejects('identification cannot be appended twice', () => Items.identify(identified.item, secret, { eventId: 'event_second_identification' }), 'already identified');

const renamed = Items.rename(identified.item, 'Dawnweave Cloak', {
  eventId: 'event_renamed', at: '2026-08-14T17:05:00.000Z', actorKey: 'cosmere',
  feedPostId: 'feed-dawnweave-name', summary: 'Cosmere named it Dawnweave.'
});
history.push(renamed.event);
ok('rename changes the display name without changing identity or definition', renamed.item.displayName === 'Dawnweave Cloak' && renamed.item.instanceId === first.instanceId && renamed.item.definitionKey === secret.definitionKey);
ok('rename history retains both names', renamed.event.data.fromName === 'Cloak of Elvenkind' && renamed.event.data.toName === 'Dawnweave Cloak');
rejects('a stale rename cannot overwrite a newer name', () => Items.applyEvent(renamed.item, Object.assign({}, renamed.event, { eventId: 'event_stale_rename', data: { fromName: 'Cloak of Elvenkind', toName: 'Old Name' } })), 'current item name');

console.log('--- atomic transfer semantics ---');
const equipped = Object.assign({}, renamed.item, { slot: 'CLOAK', attuned: true });
const transferred = Items.transfer(equipped, 'liadan', {
  eventId: 'event_transferred', at: '2026-08-20T19:30:00.000Z', actorKey: 'cosmere',
  sessionId: 'session-44', locationId: 'verens-watch', momentId: 'moment-cloak-gift',
  summary: 'Cosmere gave Dawnweave to Líadan.'
});
history.push(transferred.event);
ok('transfer preserves identity and moves current custody', transferred.item.instanceId === first.instanceId && transferred.item.currentBearerKey === 'liadan');
ok('transfer clears bearer-specific equipment state', transferred.item.slot === null && transferred.item.attuned === false);
ok('transfer records both historical bearers', transferred.event.data.fromCharacterKey === 'cosmere' && transferred.event.data.toCharacterKey === 'liadan');
ok('transfer links to the campaign moment', transferred.event.momentId === 'moment-cloak-gift' && transferred.event.locationId === 'verens-watch');
ok('prior history still says Cosmere received and named it', history[1].data.toCharacterKey === 'cosmere' && history[3].actorKey === 'cosmere');
rejects('a stale trade cannot overwrite current custody', () => Items.applyEvent(transferred.item, Object.assign({}, transferred.event, { eventId: 'event_stale', data: { fromCharacterKey: 'cosmere', toCharacterKey: 'vesperian' } })), 'current bearer');
rejects('an item cannot be transferred to the same bearer', () => Items.transfer(transferred.item, 'liadan', { eventId: 'event_same' }), 'different character');

console.log('--- transformation + deterministic replay ---');
const transformed = Items.transform(transferred.item, {
  definitionKey: 'tok:dawnweave-awakened',
  displayName: 'Dawnweave, Mantle of First Light',
  publicDescription: 'Its silver thread now burns gold at sunrise.',
  rarity: 'Rare',
  mechanics: { stealthAdvantage: true, dawnWard: true }
}, {
  eventId: 'event_transformed', at: '2026-09-03T20:00:00.000Z', actorKey: 'staff-m',
  sessionId: 'session-47', locationId: 'mountain-grove', summary: 'Dawnweave awakened during the siege.'
});
history.push(transformed.event);
ok('transformation evolves the same object instead of replacing it', transformed.item.instanceId === first.instanceId && transformed.item.definitionKey === 'tok:dawnweave-awakened');
ok('transformation can promote rarity in the existing palette', transformed.item.rarity === 'Rare');
ok('transformation retains the present bearer', transformed.item.currentBearerKey === 'liadan');

const replayed = Items.replay(first, history);
ok('event replay rebuilds the final durable item state', JSON.stringify(replayed) === JSON.stringify(transformed.item), { replayed, expected: transformed.item });
ok('the complete history remains append-only and ordered', history.length === 6 && history.map((row) => row.type).join(',') === 'recovered,assigned,identified,renamed,transferred,transformed');
rejects('an event cannot mutate a different item instance', () => Items.applyEvent(first, Object.assign({}, history[0], { itemId: 'item_other' })), 'different item');
rejects('invalid rarity never enters the contract', () => Items.createSecret({ itemId: first.instanceId, trueName: 'Bad', rarity: 'Mythic' }), 'Rarity must be');

console.log(`\nsmoke-item-provenance: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
