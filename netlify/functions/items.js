// netlify/functions/items.js
// Proxies 5etools item data server-side to bypass browser CORS restrictions.
// Merges base equipment + magic items into one searchable list.
//
// GET /.netlify/functions/items?q=sword   → filtered results
// GET /.netlify/functions/items?q=sword&limit=20 → custom limit (default 30)

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

// Try multiple sources — first successful fetch wins for each slot
// items-base.json has mundane gear; items.json has magic items
const SOURCES = [
  `${BASE}/items-base.json`,
  `${BASE}/items.json`,
];

// Module-level cache — persists across warm function invocations
let _cache = null;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadAllItems() {
  if (_cache) return _cache;

  const results = await Promise.allSettled(SOURCES.map(fetchJson));

  const all = [];
  let loaded = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const items = result.value.item || result.value.items || [];
      all.push(...items.filter(i => i.name));
      loaded++;
    } else {
      console.error('[items] source failed:', result.reason?.message);
    }
  }

  if (loaded === 0) throw new Error('All item sources failed to load');

  // Deduplicate by name — first occurrence wins (items-base takes priority)
  const seen = new Set();
  _cache = all.filter(i => {
    if (seen.has(i.name)) return false;
    seen.add(i.name);
    return true;
  });

  console.log(`[items] loaded ${_cache.length} items from ${loaded} sources`);
  return _cache;
}

function normaliseRarity(item) {
  if (!item.rarity || item.rarity === 'none') return 'None';
  const map = {
    'common':    'Common',
    'uncommon':  'Uncommon',
    'rare':      'Rare',
    'very rare': 'Very Rare',
    'legendary': 'Legendary',
    'artifact':  'Artifact',
    'varies':    'Varies',
  };
  return map[item.rarity.toLowerCase()] || item.rarity;
}

function summarise(item) {
  const dmg    = item.dmg1 && item.dmgType ? `${item.dmg1} ${item.dmgType}` : null;
  const detail = [
    item.weaponCategory,
    dmg,
    item.ac !== undefined ? `AC ${item.ac}` : null,
    item.weight ? `${item.weight} lb` : null,
  ].filter(Boolean).join(' · ');

  return {
    name:      item.name,
    rarity:    normaliseRarity(item),
    type:      item.type     || null,
    typeText:  item.typeText || null,
    detail,
    weight:    item.weight   || null,
    dmg1:      item.dmg1     || null,
    dmgType:   item.dmgType  || null,
    ac:        item.ac       !== undefined ? item.ac : null,
    reqAttune: item.reqAttune
      ? (typeof item.reqAttune === 'string' ? item.reqAttune : 'Requires Attunement')
      : null,
    properties: item.property || [],
    entries:   item.entries   || [],
    source:    item.source    || null,
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
    const items   = await loadAllItems();
    const matches = items
      .filter(i => i.name.toLowerCase().includes(q))
      .slice(0, limit)
      .map(summarise);

    return respond(200, { items: matches, total: matches.length, query: q });
  } catch (e) {
    console.error('[items] handler error:', e);
    return respond(500, { error: e.message });
  }
};
