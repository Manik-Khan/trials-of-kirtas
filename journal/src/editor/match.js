// Pure candidate-matching for the @ suggestion — separated from the
// popup wiring so it's unit-testable headlessly.
// Mirrors chronicle.html's inline dropdown: case-insensitive substring
// over name OR key; NPCs then Locations (5 each); no match → offer
// "create as unresolved" (both types) from the typed multi-word name.

export const slug = s =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function buildItems(query, NPCS, LOCATIONS) {
  const q = query.toLowerCase().trim()
  const match = e => !q || e.label.toLowerCase().includes(q) || e.id.includes(q)

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
