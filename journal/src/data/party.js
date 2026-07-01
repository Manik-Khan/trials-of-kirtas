// Seats for the identity strip — the four PCs + the Narrator.
// Mirrors the chronicle's identity model: character_key + player handle.
// (Mock data; on-site this resolves from profiles via window.__tok.)
export const SEATS = [
  { key: 'cosmere',   character: 'Cosmere Runestar', player: 'ianakira' },
  { key: 'caim',      character: 'Caim',             player: 'jayvanmidde' },
  { key: 'liadan',    character: 'Líadan Luchóg',    player: 'nazanroseaktas' },
  { key: 'vesperian', character: 'Vesperian',        player: 'thebraveruby' },
  { key: null,        character: 'Narrator',         player: 'Bloomdao' },
]
