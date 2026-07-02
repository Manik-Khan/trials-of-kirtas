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

// nav.js mounts async (session gate) — the house idiom: check, else wait
// for the nav:ready event. NEVER poll window.__tok just once.
function waitForTok(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (window.__tok?.sb) return resolve(window.__tok)
    const timer = setTimeout(() => {
      document.removeEventListener('nav:ready', once)
      reject(new Error('nav.js never signalled ready'))
    }, timeoutMs)
    function once() {
      clearTimeout(timer)
      document.removeEventListener('nav:ready', once)
      resolve(window.__tok)
    }
    document.addEventListener('nav:ready', once)
  })
}

export async function bootJournal() {
  // The deployed page carries data-tok-shell tags (theme.css / nav.js /
  // tooltips.js); the standalone preview strips them. On-site we WAIT for
  // nav.js — falling back to the sample there would masquerade as working.
  const onSite = typeof document !== 'undefined'
    && !!document.querySelector('[data-tok-shell]')
  if (!onSite) {
    return { mode: 'sample', vault: sampleVault, banner: null }
  }

  const tok = await waitForTok()
  if (!tok?.sb || !tok?.ready) throw new Error('session unavailable (window.__tok incomplete)')

  const profile = await tok.ready
  const sb = tok.sb
  const uid = tok.session?.user?.id
  const params = new URLSearchParams(window.location.search)

  // whose journal: ?character= wins; otherwise your own seat (staff → Narrator).
  // nav.js exposes the profile in camelCase — characterKey, NOT character_key
  // (nav.js ~line 879). The snake_case read here made every player's seat
  // compute to null: staff landed on the Narrator vault even with a character
  // (the overseer plays Vesperian), and ?character=<own seat> showed read-only.
  const mySeatKey = profile?.characterKey ?? profile?.character_key ?? null
  const characterKey = params.has('character')
    ? (params.get('character') || null)
    : mySeatKey
  const ownSeat = mySeatKey === characterKey
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
