// backend.js — boots the journal in one of two modes:
//   'sample' — standalone preview / no nav.js: the baked mock vault.
//   'live'   — on-site: window.__tok session, ?character= scoping,
//              Supabase-backed vault + hydrated entity pool.
//
// Canon entities: tooltips.js declares NPC_DATA/LOCATION_DATA as top-level
// consts in a CLASSIC script (global lexical scope — NOT window properties,
// so module code can't see them directly). index.html bridges them onto
// window.__tokCanon via a tiny inline classic script after tooltips.js.

import { makeJournalStore } from './supabase-adapter.js'
import { makeLiveVault } from './live-vault.js'
import { entityStore } from './entityStore.js'
import { vault as sampleVault } from './vault.js'
import { SEATS } from './party.js'

const seatName = key =>
  SEATS.find(s => String(s.key) === String(key))?.character
  ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Narrator')

export async function bootJournal() {
  const tok = typeof window !== 'undefined' ? window.__tok : null
  if (!tok?.sb || !tok?.ready) {
    return { mode: 'sample', vault: sampleVault, banner: null }
  }

  const profile = await tok.ready
  const sb = tok.sb
  const uid = tok.session?.user?.id
  const params = new URLSearchParams(window.location.search)

  // whose journal: ?character= wins; otherwise your own seat (staff → Narrator)
  const characterKey = params.has('character')
    ? (params.get('character') || null)
    : (profile?.character_key ?? null)
  const ownSeat = (profile?.character_key ?? null) === characterKey
  const isStaff = profile?.role === 'overseer' || profile?.role === 'dm'
  const canWriteHere = ownSeat || (characterKey === null && isStaff)

  const store = makeJournalStore({ sb, uid, characterKey })

  const canon = window.__tokCanon || {}
  const toArr = (obj, type) => Object.entries(obj || {})
    .map(([k, v]) => ({ id: k, label: v.name || k, type, hint: v.role || v.type || '' }))

  const [rows, entities, session] = await Promise.all([
    store.loadPages(),
    store.loadEntities({
      canonNPCs: toArr(canon.npcs, 'npc'),
      canonLocations: toArr(canon.locations, 'location'),
    }),
    store.getCurrentSession(),
  ])

  entityStore.hydrate(entities)
  entityStore.persist = stub => store.addEntity(stub)

  const liveVault = makeLiveVault({
    store, uid,
    characterName: seatName(characterKey),
    rows, session, canWriteHere,
  })

  return {
    mode: 'live',
    vault: liveVault,
    banner: canWriteHere ? null : `viewing ${seatName(characterKey)}’s journal — read-only`,
  }
}
