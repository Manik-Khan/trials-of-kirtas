// Mutable entity pool: static canon (tooltips.js extract) + play-created
// stubs. Phase 2 real version: static data merged with the Supabase
// `entities` table; add() becomes an insert.
import { NPCS, LOCATIONS } from './sample.js'

const pool = {
  npc: NPCS.map(e => ({ ...e, origin: 'canon' })),
  location: LOCATIONS.map(e => ({ ...e, origin: 'canon' })),
}
const created = [] // play-created stubs, in creation order (the curation queue)

export const entityStore = {
  persist: null, // live mode sets this: stub => Promise (fire-and-forget)
  hydrate({ npcs, locations }) {
    pool.npc = npcs
    pool.location = locations
  },
  npcs: () => pool.npc,
  locations: () => pool.location,
  has: (type, id) => pool[type].some(e => e.id === id),
  createdStubs: () => created,
  add(stub) {
    if (this.has(stub.type, stub.id)) return false
    const entity = { id: stub.id, label: stub.label, type: stub.type, hint: 'new — from the journal', origin: 'journal' }
    pool[stub.type].push(entity)
    created.push(entity)
    if (this.persist) Promise.resolve(this.persist(stub)).catch(e => console.error('[journal] entity persist failed:', e))
    return true
  },
}
