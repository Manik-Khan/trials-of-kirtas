/* item-provenance.js — durable identity + append-only history for notable items.
 *
 * The item instance is the current, party-readable fact. Hidden identification
 * details live in a separate secret record. Events are immutable historical
 * facts and can later move to their own Supabase table without changing this
 * contract. No sheet, Journal, Chronicle, or World surface is wired here yet.
 *
 * Pure + dual-export: window.ItemProvenance / module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ItemProvenance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var ITEM_SCHEMA = 'tok-item/v1';
  var SECRET_SCHEMA = 'tok-item-secret/v1';
  var EVENT_SCHEMA = 'tok-item-event/v1';
  var RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
  var EVENT_TYPES = ['recovered', 'assigned', 'identified', 'renamed', 'transferred', 'transformed', 'lost', 'destroyed'];
  var LINK_FIELDS = ['sessionId', 'locationId', 'momentId', 'encounterId', 'journalPageId', 'feedPostId', 'battleMapId'];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function nullableText(value) {
    var out = text(value);
    return out || null;
  }

  function requireText(value, label) {
    var out = text(value);
    if (!out) throw new Error(label + ' is required.');
    return out;
  }

  function randomId(prefix) {
    var cryptoApi = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return prefix + cryptoApi.randomUUID();
    return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function rarity(value, allowEmpty) {
    var wanted = text(value).toLowerCase();
    if (!wanted && allowEmpty) return null;
    for (var i = 0; i < RARITIES.length; i++) {
      if (RARITIES[i].toLowerCase() === wanted) return RARITIES[i];
    }
    throw new Error('Rarity must be Common, Uncommon, Rare, Very Rare, Legendary, or Artifact.');
  }

  function createItem(input) {
    input = input || {};
    var identified = input.identification === 'identified';
    return {
      schema: ITEM_SCHEMA,
      version: 1,
      instanceId: nullableText(input.instanceId) || randomId('item_'),
      definitionKey: identified ? nullableText(input.definitionKey) : null,
      displayName: requireText(input.displayName || input.name, 'Item display name'),
      publicDescription: text(input.publicDescription),
      rarity: identified ? rarity(input.rarity, true) : null,
      identification: identified ? 'identified' : 'unidentified',
      mechanics: identified ? clone(input.mechanics || {}) : {},
      status: input.status === 'held' ? 'held' : (input.status === 'destroyed' ? 'destroyed' : 'unplaced'),
      currentBearerKey: nullableText(input.currentBearerKey),
      currentLocationId: nullableText(input.currentLocationId),
      slot: nullableText(input.slot),
      attuned: !!input.attuned,
      createdAt: nullableText(input.createdAt) || new Date().toISOString()
    };
  }

  function createSecret(input) {
    input = input || {};
    return {
      schema: SECRET_SCHEMA,
      version: 1,
      itemId: requireText(input.itemId, 'Secret item id'),
      trueName: requireText(input.trueName, 'Secret true name'),
      definitionKey: nullableText(input.definitionKey),
      rarity: rarity(input.rarity, false),
      publicDescription: text(input.publicDescription),
      mechanics: clone(input.mechanics || {}),
      lore: text(input.lore)
    };
  }

  function publicProjection(item) {
    item = requireItem(item);
    return clone({
      schema: item.schema,
      version: item.version,
      instanceId: item.instanceId,
      definitionKey: item.definitionKey,
      displayName: item.displayName,
      publicDescription: item.publicDescription,
      rarity: item.rarity,
      identification: item.identification,
      mechanics: item.mechanics,
      status: item.status,
      currentBearerKey: item.currentBearerKey,
      currentLocationId: item.currentLocationId,
      slot: item.slot,
      attuned: item.attuned,
      createdAt: item.createdAt
    });
  }

  function staffProjection(item, secret) {
    item = requireItem(item);
    secret = requireSecret(secret, item.instanceId);
    return { item: publicProjection(item), secret: clone(secret) };
  }

  function requireItem(item) {
    if (!item || item.schema !== ITEM_SCHEMA || !text(item.instanceId)) throw new Error('A valid ' + ITEM_SCHEMA + ' item is required.');
    return item;
  }

  function requireSecret(secret, itemId) {
    if (!secret || secret.schema !== SECRET_SCHEMA || !text(secret.itemId)) throw new Error('A valid ' + SECRET_SCHEMA + ' secret is required.');
    if (itemId && secret.itemId !== itemId) throw new Error('The secret belongs to a different item.');
    return secret;
  }

  function event(item, type, data, meta) {
    item = requireItem(item);
    data = data || {};
    meta = meta || {};
    if (EVENT_TYPES.indexOf(type) < 0) throw new Error('Unsupported item event type: ' + type + '.');
    var out = {
      schema: EVENT_SCHEMA,
      version: 1,
      eventId: nullableText(meta.eventId) || randomId('itemev_'),
      itemId: item.instanceId,
      type: type,
      at: nullableText(meta.at) || new Date().toISOString(),
      actorKey: nullableText(meta.actorKey),
      summary: text(meta.summary),
      data: clone(data)
    };
    LINK_FIELDS.forEach(function (field) { out[field] = nullableText(meta[field]); });
    return out;
  }

  function requireEvent(item, itemEvent) {
    requireItem(item);
    if (!itemEvent || itemEvent.schema !== EVENT_SCHEMA || !text(itemEvent.eventId)) throw new Error('A valid ' + EVENT_SCHEMA + ' event is required.');
    if (itemEvent.itemId !== item.instanceId) throw new Error('The event belongs to a different item.');
    if (EVENT_TYPES.indexOf(itemEvent.type) < 0) throw new Error('Unsupported item event type: ' + itemEvent.type + '.');
    return itemEvent;
  }

  function applyEvent(item, itemEvent) {
    item = clone(requireItem(item));
    itemEvent = requireEvent(item, itemEvent);
    var data = itemEvent.data || {};

    if (itemEvent.type === 'recovered') {
      item.status = 'recovered';
      item.currentLocationId = nullableText(data.locationId || itemEvent.locationId);
    } else if (itemEvent.type === 'assigned') {
      if (item.currentBearerKey) throw new Error('An item with a current bearer must be transferred, not assigned.');
      item.currentBearerKey = requireText(data.toCharacterKey, 'Assigned character key');
      item.currentLocationId = null;
      item.status = 'held';
    } else if (itemEvent.type === 'identified') {
      if (item.identification === 'identified') throw new Error('The item is already identified.');
      item.definitionKey = nullableText(data.definitionKey);
      item.displayName = requireText(data.trueName, 'Identified item name');
      item.publicDescription = text(data.publicDescription);
      item.rarity = rarity(data.rarity, false);
      item.mechanics = clone(data.mechanics || {});
      item.identification = 'identified';
    } else if (itemEvent.type === 'renamed') {
      if (data.fromName && item.displayName !== data.fromName) throw new Error('Rename source does not match the current item name.');
      item.displayName = requireText(data.toName, 'New item name');
    } else if (itemEvent.type === 'transferred') {
      var fromKey = requireText(data.fromCharacterKey, 'Transfer source character key');
      var toKey = requireText(data.toCharacterKey, 'Transfer destination character key');
      if (item.currentBearerKey !== fromKey) throw new Error('Transfer source does not match the current bearer.');
      if (fromKey === toKey) throw new Error('Transfer destination must be a different character.');
      item.currentBearerKey = toKey;
      item.currentLocationId = null;
      item.status = 'held';
      item.slot = null;
      item.attuned = false;
    } else if (itemEvent.type === 'transformed') {
      var changes = data.changes || {};
      if (Object.prototype.hasOwnProperty.call(changes, 'definitionKey')) item.definitionKey = nullableText(changes.definitionKey);
      if (Object.prototype.hasOwnProperty.call(changes, 'displayName')) item.displayName = requireText(changes.displayName, 'Transformed item name');
      if (Object.prototype.hasOwnProperty.call(changes, 'publicDescription')) item.publicDescription = text(changes.publicDescription);
      if (Object.prototype.hasOwnProperty.call(changes, 'rarity')) item.rarity = rarity(changes.rarity, true);
      if (Object.prototype.hasOwnProperty.call(changes, 'mechanics')) item.mechanics = clone(changes.mechanics || {});
    } else if (itemEvent.type === 'lost') {
      item.currentBearerKey = null;
      item.currentLocationId = nullableText(data.locationId || itemEvent.locationId);
      item.slot = null;
      item.attuned = false;
      item.status = 'lost';
    } else if (itemEvent.type === 'destroyed') {
      item.currentBearerKey = null;
      item.currentLocationId = nullableText(data.locationId || itemEvent.locationId);
      item.slot = null;
      item.attuned = false;
      item.status = 'destroyed';
    }
    return item;
  }

  function transition(item, type, data, meta) {
    var itemEvent = event(item, type, data, meta);
    return { item: applyEvent(item, itemEvent), event: itemEvent };
  }

  function recover(item, meta) {
    meta = meta || {};
    return transition(item, 'recovered', { locationId: nullableText(meta.locationId) }, meta);
  }

  function assign(item, toCharacterKey, meta) {
    return transition(item, 'assigned', { toCharacterKey: toCharacterKey }, meta);
  }

  function identify(item, secret, meta) {
    item = requireItem(item);
    secret = requireSecret(secret, item.instanceId);
    return transition(item, 'identified', {
      definitionKey: secret.definitionKey,
      trueName: secret.trueName,
      publicDescription: secret.publicDescription,
      rarity: secret.rarity,
      mechanics: secret.mechanics
    }, meta);
  }

  function rename(item, toName, meta) {
    return transition(item, 'renamed', { fromName: item && item.displayName, toName: toName }, meta);
  }

  function transfer(item, toCharacterKey, meta) {
    item = requireItem(item);
    return transition(item, 'transferred', { fromCharacterKey: item.currentBearerKey, toCharacterKey: toCharacterKey }, meta);
  }

  function transform(item, changes, meta) {
    return transition(item, 'transformed', { changes: clone(changes || {}) }, meta);
  }

  function lose(item, meta) {
    meta = meta || {};
    return transition(item, 'lost', { fromCharacterKey: item && item.currentBearerKey, locationId: nullableText(meta.locationId) }, meta);
  }

  function destroy(item, meta) {
    meta = meta || {};
    return transition(item, 'destroyed', { fromCharacterKey: item && item.currentBearerKey, locationId: nullableText(meta.locationId) }, meta);
  }

  function replay(initialItem, events) {
    return (events || []).reduce(function (item, itemEvent) { return applyEvent(item, itemEvent); }, clone(requireItem(initialItem)));
  }

  return Object.freeze({
    VERSION: VERSION,
    ITEM_SCHEMA: ITEM_SCHEMA,
    SECRET_SCHEMA: SECRET_SCHEMA,
    EVENT_SCHEMA: EVENT_SCHEMA,
    RARITIES: RARITIES.slice(),
    EVENT_TYPES: EVENT_TYPES.slice(),
    LINK_FIELDS: LINK_FIELDS.slice(),
    createItem: createItem,
    createSecret: createSecret,
    publicProjection: publicProjection,
    staffProjection: staffProjection,
    event: event,
    applyEvent: applyEvent,
    recover: recover,
    assign: assign,
    identify: identify,
    rename: rename,
    transfer: transfer,
    transform: transform,
    lose: lose,
    destroy: destroy,
    replay: replay
  });
});
