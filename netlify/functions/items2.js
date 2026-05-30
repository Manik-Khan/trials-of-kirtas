// netlify/functions/items2.js
// Proxies 5etools item data server-side to bypass browser CORS restrictions.
// Returns rich item data including properties, price, weapon category, and source.
//
// GET /.netlify/functions/items2?q=longsword  → filtered results (default 30)
// GET /.netlify/functions/items2?q=sword&limit=50

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: { ...cors, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ── Module-level cache ──
let _cache        = null; // merged item list
let _propertyMap  = null; // abbreviation → { name, entries }
let _itemTypeMap  = null; // type code → display label

// Property abbreviation → display name (fallback if not in JSON)
const PROPERTY_ABBR = {
  A:   'Ammunition',  AF:  'Ammunition (Firearm)',
  BF:  'Burst Fire',  F:   'Finesse',
  H:   'Heavy',       L:   'Light',
  LD:  'Loading',     MT:  'Mounted',
  R:   'Reach',       RLD: 'Reload',
  S:   'Special',     T:   'Thrown',
  '2H':'Two-Handed',  V:   'Versatile',
};

// Item type code → readable label
const TYPE_LABELS = {
  A: 'Ammunition',      AF: 'Ammunition (Firearm)',
  AIR: 'Vehicle (Air)', EXP: 'Explosive',
  FD: 'Food & Drink',   G: 'Adventuring Gear',
  GS: 'Gaming Set',     HA: 'Heavy Armor',
  INS: 'Instrument',    LA: 'Light Armor',
  M: 'Melee Weapon',    MA: 'Medium Armor',
  MNT: 'Mount',         MSC: 'Miscellaneous',
  OTH: 'Other',         P: 'Potion',
  R: 'Ranged Weapon',   RD: 'Rod',
  RG: 'Ring',           S: 'Shield',
  SC: 'Scroll',         SCF: 'Spellcasting Focus',
  SHP: 'Vehicle (Water)',SHT: 'Ammunition',
  ST: 'Staff',          T: 'Tool',
  TAH: 'Tack & Harness',TG: 'Trade Good',
  VEH: 'Vehicle (Land)',WD: 'Wand',
  WON: 'Wondrous Item',
};

async function loadPropertyMap() {
  if (_propertyMap) return _propertyMap;
  try {
    const data = await fetchJson(`${BASE}/items-base.json`);
    _propertyMap = {};
    for (const prop of (data.itemProperty || [])) {
      if (prop.abbreviation) {
        _propertyMap[prop.abbreviation] = {
          name:    prop.name || PROPERTY_ABBR[prop.abbreviation] || prop.abbreviation,
          entries: prop.entries || [],
        };
      }
    }
    console.log(`[items] loaded ${Object.keys(_propertyMap).length} properties`);
  } catch(e) {
    console.error('[items] property load failed:', e.message);
    _propertyMap = {};
  }
  return _propertyMap;
}

async function loadAllItems() {
  if (_cache) return _cache;

  const baseItems  = [];
  const magicItems = [];

  try {
    const base = await fetchJson(`${BASE}/items-base.json`);
    baseItems.push(...(base.baseitem || base.item || []).filter(i => i.name));

    // Also grab property map from the same fetch (already parsed above)
    if (!_propertyMap) {
      _propertyMap = {};
      for (const prop of (base.itemProperty || [])) {
        if (prop.abbreviation) {
          _propertyMap[prop.abbreviation] = {
            name:    prop.name || PROPERTY_ABBR[prop.abbreviation] || prop.abbreviation,
            entries: prop.entries || [],
          };
        }
      }
    }
    console.log(`[items] base: ${baseItems.length} items`);
  } catch(e) {
    console.error('[items] base source failed:', e.message);
  }

  try {
    const magic = await fetchJson(`${BASE}/items.json`);
    magicItems.push(...(magic.item || []).filter(i => i.name));
    console.log(`[items] magic: ${magicItems.length} items`);
  } catch(e) {
    console.error('[items] magic source failed:', e.message);
  }

  if (baseItems.length === 0 && magicItems.length === 0) {
    throw new Error('All item sources failed to load');
  }

  const baseNames  = new Set(baseItems.map(i => i.name));
  const uniqueMagic = magicItems.filter(i => !baseNames.has(i.name));
  _cache = [...baseItems, ...uniqueMagic];
  console.log(`[items] total: ${_cache.length} (${baseItems.length} base + ${uniqueMagic.length} magic)`);
  return _cache;
}

function normaliseRarity(item) {
  if (!item.rarity || item.rarity === 'none') return 'None';
  const map = {
    'common': 'Common', 'uncommon': 'Uncommon', 'rare': 'Rare',
    'very rare': 'Very Rare', 'legendary': 'Legendary',
    'artifact': 'Artifact', 'varies': 'Varies',
  };
  return map[item.rarity.toLowerCase()] || item.rarity;
}

function formatPrice(item) {
  // 5etools stores price as { quantity, denomination } on the item
  // OR as item.value in copper pieces for base items
  if (item.value !== undefined && item.value !== null) {
    // value is in copper pieces
    const cp = item.value;
    if (cp >= 1000 && cp % 1000 === 0) return `${cp / 1000} pp`;
    if (cp >= 100  && cp % 100  === 0) return `${cp / 100} gp`;
    if (cp >= 10   && cp % 10   === 0) return `${cp / 10} sp`;
    if (cp >= 100) {
      const gp = Math.floor(cp / 100);
      const rem = cp % 100;
      if (rem === 0) return `${gp} gp`;
      const sp = Math.floor(rem / 10);
      const rcp = rem % 10;
      const parts = [`${gp} gp`];
      if (sp)  parts.push(`${sp} sp`);
      if (rcp) parts.push(`${rcp} cp`);
      return parts.join(', ');
    }
    return `${cp} cp`;
  }
  // Some magic items use { quantity, denomination } directly
  if (item.price && typeof item.price === 'object') {
    return `${item.price.quantity} ${item.price.denomination || 'gp'}`;
  }
  return null;
}

function formatSource(item) {
  if (!item.source) return null;
  const page = item.page ? ` p${item.page}` : '';
  return `${item.source}${page}`;
}

function buildWeaponCategory(item) {
  // e.g. "Martial weapon, melee weapon"
  const parts = [];
  if (item.weaponCategory) parts.push(`${item.weaponCategory} weapon`);
  const typeLabel = TYPE_LABELS[item.type] || null;
  if (typeLabel && typeLabel.toLowerCase().includes('weapon') && !parts.find(p => p.toLowerCase().includes(typeLabel.toLowerCase()))) {
    parts.push(typeLabel.toLowerCase());
  } else if (item.type === 'M') {
    parts.push('melee weapon');
  } else if (item.type === 'R') {
    parts.push('ranged weapon');
  }
  return parts.length ? parts.join(', ') : (typeLabel || null);
}

function resolveProperties(item, propMap) {
  if (!item.property || !item.property.length) return [];
  return item.property.map(abbr => {
    const p = propMap[abbr] || {};
    const name = p.name || PROPERTY_ABBR[abbr] || abbr;
    // For Versatile, include the 2H damage die if present
    let displayName = name;
    if (abbr === 'V' && item.dmg2) {
      displayName = `${name} (${item.dmg2})`;
    }
    // For Thrown, include range if present
    if (abbr === 'T' && item.range) {
      displayName = `${name} (${item.range} ft.)`;
    }
    // Flatten entries to text
    const desc = (p.entries || []).map(e => {
      if (typeof e === 'string') return e;
      if (e.entries) return e.entries.filter(x => typeof x === 'string').join(' ');
      return '';
    }).filter(Boolean).join(' ');
    return { abbr, name: displayName, desc };
  });
}

// Strip 5etools inline tags: {@item backpack|phb} → "backpack", {@item Torch|phb|Torches} → "Torches"
function stripTags(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    // {@tag text|source|display} → display or text
    .replace(/\{@\w+\s+([^|}]+?)(?:\|[^|}]*?)?(?:\|([^}]+?))?\}/g, (_, text, display) => display || text)
    .replace(/\{@[^}]+\}/g, '') // remove any remaining tags
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenEntries(entries) {
  // Recursively flatten 5etools entry objects to plain text strings
  if (!entries || !entries.length) return [];
  const result = [];
  for (const e of entries) {
    if (typeof e === 'string') {
      const cleaned = stripTags(e);
      if (cleaned) result.push(cleaned);
    } else if (e && typeof e === 'object') {
      if (e.type === 'entries' && e.entries) {
        if (e.name) result.push(stripTags(e.name) + ':');
        result.push(...flattenEntries(e.entries));
      } else if (e.type === 'list' && e.items) {
        result.push(...flattenEntries(e.items));
      } else if (e.type === 'item' && e.name && e.entry) {
        result.push(`${stripTags(e.name)}: ${stripTags(e.entry)}`);
      } else if (e.type === 'table') {
        // Skip tables
      } else if (e.entries) {
        result.push(...flattenEntries(e.entries));
      } else if (e.entry) {
        result.push(stripTags(e.entry));
      }
    }
  }
  return result;
}

// Also clean packContents item names
function cleanPackItem(c) {
  if (!c) return null;
  if (c.special) return stripTags(c.special);
  if (c.item) {
    const name = c.item.split('|')[0]; // "backpack|phb" → "backpack"
    const display = name.charAt(0).toUpperCase() + name.slice(1);
    return c.quantity > 1 ? `${display} ×${c.quantity}` : display;
  }
  return null;
}

function summarise(item, propMap) {
  const props      = resolveProperties(item, propMap);
  const price      = formatPrice(item);
  const sourceStr  = formatSource(item);
  const weaponCat  = buildWeaponCategory(item);
  const typeLabel  = TYPE_LABELS[item.type] || item.typeText || null;

  // Quick-glance detail line for list display
  const dmg = item.dmg1 && item.dmgType ? `${item.dmg1} ${item.dmgType}` : null;
  const detail = [
    item.weaponCategory ? `${item.weaponCategory} weapon` : (typeLabel || null),
    dmg,
    item.ac !== undefined ? `AC ${item.ac}` : null,
    item.weight ? `${item.weight} lb` : null,
  ].filter(Boolean).join(' · ');

  return {
    name:        item.name,
    rarity:      normaliseRarity(item),
    type:        item.type     || null,
    typeLabel,
    weaponCat,
    detail,                          // short summary for list row
    price,                           // "15 gp"
    weight:      item.weight   || null,
    dmg1:        item.dmg1     || null,
    dmg2:        item.dmg2     || null, // 2H damage (Versatile)
    dmgType:     item.dmgType  || null,
    range:       item.range    || null,
    ac:          item.ac       !== undefined ? item.ac : null,
    strength:    item.strength || null, // str requirement for heavy armor
    stealth:     item.stealth  || null, // true if imposes stealth disadv
    reqAttune:   item.reqAttune
      ? (typeof item.reqAttune === 'string' ? item.reqAttune : 'Requires Attunement')
      : null,
    properties:  props,                // [{ abbr, name, desc }]
    entries:     flattenEntries(item.entries || []),
    contents:    item.packContents
      ? item.packContents.map(cleanPackItem).filter(Boolean)
      : null,
    // Raw structured pack contents, passed through so the inventory can auto-explode
    // a pack into real child items with quantities. (contents above stays for display.)
    packContents: item.packContents || null,
    source:      item.source   || null,
    sourceFull:  sourceStr,            // "PHB'14 p149"
    page:        item.page     || null,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  const q     = (event.queryStringParameters?.q || '').toLowerCase().trim();
  const limit = Math.min(parseInt(event.queryStringParameters?.limit || '30'), 50);

  if (!q) return respond(400, { error: 'Missing query parameter: q' });
  if (q.length < 2) return respond(400, { error: 'Query must be at least 2 characters' });

  try {
    const [items, propMap] = await Promise.all([loadAllItems(), loadPropertyMap()]);
    // propMap may already be populated by loadAllItems — merge
    const mergedPropMap = { ..._propertyMap, ...propMap };

    const matches = items
      .filter(i => i.name.toLowerCase().includes(q))
      .slice(0, limit)
      .map(i => summarise(i, mergedPropMap));

    return respond(200, { items: matches, total: matches.length, query: q });
  } catch(e) {
    console.error('[items] handler error:', e);
    return respond(500, { error: e.message });
  }
};
