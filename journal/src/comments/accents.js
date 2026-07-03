// accents.js — seat color resolution. Content stores SEAT KEYS only; this
// module turns keys into paint at render time. Precedence:
//   1. the player's chosen accent (profiles.appearance.accent)
//   2. the fallback palette (the approved mock's colors)
//   3. a stable hue hashed from the key (unknown/future seats never collide
//      with "no color")
export const FALLBACK = {
  liadan:    '#9d7bd8',
  caim:      '#6faf7e',
  vesperian: '#c96f6f',
  cosmere:   '#6f9fc9',
  narrator:  '#b8952a',
}

export function hashHue(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h % 360
}

export function seatColor(seat, accents = {}) {
  const k = seat || 'narrator'
  return accents[k] || FALLBACK[k] || `hsl(${hashHue(k)} 45% 62%)`
}

// CSS custom properties for a React style object: { '--seat-caim': '#…', … }
export function seatVars(seats, accents = {}) {
  const vars = {}
  for (const s of new Set([...seats, 'narrator'])) {
    vars[`--seat-${s || 'narrator'}`] = seatColor(s, accents)
  }
  return vars
}
