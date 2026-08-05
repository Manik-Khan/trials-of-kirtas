export const RECORDS_MODES = ['chronicle', 'both', 'journal']
export const DEFAULT_DOCK_WIDTH = 42

export function recordsModeFromSearch(search = '') {
  const view = new URLSearchParams(search).get('view')
  return RECORDS_MODES.includes(view) ? view : 'journal'
}

export function recordsSearch(mode, search = '') {
  const next = new URLSearchParams(search)
  if (mode === 'journal') next.delete('view')
  else next.set('view', RECORDS_MODES.includes(mode) ? mode : 'chronicle')
  const value = next.toString()
  return value ? `?${value}` : ''
}

export function clampDockWidth(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_DOCK_WIDTH
  return Math.max(30, Math.min(62, n))
}
