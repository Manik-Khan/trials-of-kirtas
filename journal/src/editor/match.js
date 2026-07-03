// Pure candidate-matching for the @ suggestion — separated from the
// popup wiring so it's unit-testable headlessly.
// Mirrors chronicle.html's inline dropdown: case-insensitive substring
// over name OR key; NPCs then Locations (5 each); no match → offer
// "create as unresolved" (both types) from the typed multi-word name.

export const slug = s =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function buildItems(query, NPCS, LOCATIONS, aliases = {}) {
  const q = query.toLowerCase().trim()
  const sq = slug(query)
  // aliases: `${type}:${aliasId}` → canonicalId. An entity also matches when
  // the query matches one of its retired keys — typing the old typo finds
  // canon instead of re-seeding the stub merge_entity just retired.
  const aliasHit = e => Object.entries(aliases).some(([k, canon]) =>
    canon === e.id && k.startsWith(e.type + ':')
    && (k.slice(e.type.length + 1).includes(sq) || k.slice(e.type.length + 1).includes(q)))
  const match = e => !q || e.label.toLowerCase().includes(q) || e.id.includes(q)
    || (sq && e.id.includes(sq)) || aliasHit(e)

  const npcs = NPCS.filter(match).slice(0, 5)
    .map(e => ({ ...e, resolved: true, section: 'NPCs' }))
  const locs = LOCATIONS.filter(match).slice(0, 5)
    .map(e => ({ ...e, resolved: true, section: 'Locations' }))

  const items = [...npcs, ...locs]

  if (!items.length && q) {
    const label = query.trim()
    items.push(
      { id: slug(label), type: 'npc', label, hint: '', resolved: false, section: 'Create' },
      { id: slug(label), type: 'location', label, hint: '', resolved: false, section: 'Create' },
    )
  }
  return items
}


// Resolve what an @ pick should insert — pure, testable headlessly.
// store: { resolve(type,id), add(stub) } (entityStore's surface).
// Returns { id, type, label, resolved, created } — created=true means a new
// stub was seeded (caller fires onCreateEntity).
export function resolveMentionInsert(props, store) {
  let { id, type, label } = props
  let resolved = props.resolved
  let created = false
  // Alias interception: a merged-away key resolves to canon — the chip
  // inserts with the canonical id AND label, and nothing is re-seeded.
  const canon = store.resolve(type, id)
  if (canon) {
    id = canon.id; label = canon.label; resolved = true
  } else if (!resolved) {
    created = store.add({ id, type, label })
    resolved = true
  }
  return { id, type, label, resolved, created }
}
