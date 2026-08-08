/* living-codex.js — shared read/write seam for Chronicle discoveries.
 *
 * Canon NPC/location prose still lives in tooltips.js. This module merges it
 * with Supabase `entities`, while real player characters always resolve from
 * `characters` and are removed from the NPC pool.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LivingCodex = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var ENTITY_COLUMNS = 'id,type,name,descr,status,curated,role,parent_id,map_x,map_y,map_category,map_shape,map_state,created_at';
  var LEGACY_ENTITY_COLUMNS = 'id,type,name,descr,status,curated,created_at';

  function slug(value) {
    return String(value || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function characterName(row) {
    return String(row && row.structural && row.structural.name || row && row.key || '').trim();
  }

  function characterHint(row) {
    var s = row && row.structural || {};
    if (s.classLabel) return s.classLabel;
    var classes = Array.isArray(s.classes) ? s.classes : [];
    if (classes.length) return classes.map(function (c) {
      return [c.name, c.level].filter(Boolean).join(' ');
    }).join(' / ');
    return s.race || 'Player character';
  }

  function shapeCharacter(row) {
    if (!row || !row.key || row.delete_marked) return null;
    return {
      id: row.key,
      key: row.key,
      label: characterName(row),
      name: characterName(row),
      hint: characterHint(row),
      type: 'character',
      resolved: true,
      curated: true,
      origin: 'character'
    };
  }

  function shapeEntity(row) {
    if (!row || !row.id || !row.type) return null;
    return {
      id: row.id,
      label: row.name || row.id,
      name: row.name || row.id,
      type: row.type,
      hint: row.curated ? (row.role || row.descr || '') : 'new — awaiting confirmation',
      descr: row.descr || '',
      status: row.status || 'unknown',
      role: row.role || '',
      curated: !!row.curated,
      resolved: !!row.curated,
      parentId: row.parent_id || null,
      mapX: row.map_x == null ? null : Number(row.map_x),
      mapY: row.map_y == null ? null : Number(row.map_y),
      category: row.map_category || 'town',
      shape: row.map_shape || 'square',
      mapState: row.map_state || (row.parent_id ? 'nested' : 'unmapped'),
      createdAt: row.created_at || null,
      origin: 'journal'
    };
  }

  function samePerson(npc, character) {
    if (!npc || !character) return false;
    var npcId = slug(npc.id);
    var charId = slug(character.id);
    var npcName = slug(npc.label || npc.name);
    var charName = slug(character.label || character.name);
    return npcId === charId || npcName === charName
      || (npcId && charId.indexOf(npcId + '-') === 0);
  }

  function canonArray(obj, type) {
    return Object.keys(obj || {}).map(function (id) {
      var data = obj[id] || {};
      return {
        id: id,
        label: data.name || id,
        name: data.name || id,
        hint: data.role || data.type || '',
        descr: data.desc || '',
        status: data.status || 'unknown',
        type: type,
        curated: true,
        resolved: true,
        origin: 'canon'
      };
    });
  }

  function mergeCanon(canon, entities, type) {
    var seen = {};
    var out = [];
    (canon || []).forEach(function (item) {
      if (!item || seen[item.id]) return;
      seen[item.id] = true;
      out.push(item);
    });
    (entities || []).filter(function (item) { return item && item.type === type; }).forEach(function (item) {
      if (seen[item.id]) return;
      seen[item.id] = true;
      out.push(item);
    });
    return out;
  }

  function withoutCharacters(npcs, characters) {
    return (npcs || []).filter(function (npc) {
      return !(characters || []).some(function (character) { return samePerson(npc, character); });
    });
  }

  async function load(sb, options) {
    options = options || {};
    var charReq = sb.from('characters').select('key,structural,delete_marked').order('key');
    var entReq = sb.from('entities').select(ENTITY_COLUMNS);
    var aliasReq = sb.from('entity_aliases').select('type,alias_id,canonical_id');
    var results = await Promise.all([charReq, entReq, aliasReq]);
    var charRes = results[0], entRes = results[1], aliasRes = results[2];

    // Pages may be deployed just before the append-only migration is run.
    // Retrying the old projection keeps NPC mentions alive and narrates only
    // the new location metadata as unavailable.
    if (entRes.error && /column|schema cache/i.test(entRes.error.message || '')) {
      entRes = await sb.from('entities').select(LEGACY_ENTITY_COLUMNS);
    }
    if (charRes.error) throw new Error('characters: ' + charRes.error.message);
    if (entRes.error) throw new Error('entities: ' + entRes.error.message);

    var characters = (charRes.data || []).map(shapeCharacter).filter(Boolean);
    var entities = (entRes.data || []).map(shapeEntity).filter(Boolean);
    var canonNPCs = options.canonNPCs || canonArray(options.npcData, 'npc');
    var canonLocations = options.canonLocations || canonArray(options.locationData, 'location');
    var npcs = withoutCharacters(mergeCanon(canonNPCs, entities, 'npc'), characters);
    var locations = mergeCanon(canonLocations, entities, 'location');
    var aliases = {};
    if (!aliasRes.error) (aliasRes.data || []).forEach(function (row) {
      aliases[row.type + ':' + row.alias_id] = row.canonical_id;
    });
    return { characters: characters, npcs: npcs, locations: locations, entities: entities, aliases: aliases };
  }

  async function remember(sb, entity) {
    var row = { id: slug(entity.id || entity.label), type: entity.type, name: entity.label };
    var res = await sb.from('entities').insert(row).select('id,type,name,curated').maybeSingle();
    if (res.error && !/duplicate|unique/i.test(res.error.message || '')) throw new Error(res.error.message);
    return res.data || row;
  }

  function childrenOf(locations, parentId) {
    return (locations || []).filter(function (loc) {
      return loc.origin === 'journal' && loc.curated && loc.parentId === parentId;
    });
  }

  function mappedTopLevel(locations) {
    return (locations || []).filter(function (loc) {
      return loc.origin === 'journal' && loc.curated && !loc.parentId
        && Number.isFinite(loc.mapX) && Number.isFinite(loc.mapY);
    });
  }

  function unmappedTopLevel(locations) {
    return (locations || []).filter(function (loc) {
      return loc.origin === 'journal' && loc.curated && !loc.parentId
        && (!Number.isFinite(loc.mapX) || !Number.isFinite(loc.mapY));
    });
  }

  return {
    ENTITY_COLUMNS: ENTITY_COLUMNS,
    slug: slug,
    characterName: characterName,
    shapeCharacter: shapeCharacter,
    shapeEntity: shapeEntity,
    samePerson: samePerson,
    canonArray: canonArray,
    mergeCanon: mergeCanon,
    withoutCharacters: withoutCharacters,
    load: load,
    remember: remember,
    childrenOf: childrenOf,
    mappedTopLevel: mappedTopLevel,
    unmappedTopLevel: unmappedTopLevel
  };
});
