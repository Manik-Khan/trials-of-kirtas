// Suggestion menus portal to <body> so the clipped Journal workspace cannot
// cut them off. Carry the page-local reading tokens across that portal.
const TOKENS = [
  '--sh-ink', '--sh-accent', '--sh-paper', '--sh-place',
  '--sh-ink-soft', '--sh-ink-faint', '--sh-ink-wash-2', '--sh-hairline',
  '--sh-font-body', '--sh-font-utility',
]

export function prepareSuggestionPopup(popup, editor) {
  const scope = editor?.view?.dom?.closest('.sh-scope')
  if (!scope || typeof getComputedStyle !== 'function') return popup
  const style = getComputedStyle(scope)
  for (const token of TOKENS) {
    const value = style.getPropertyValue(token)
    if (value) popup.style.setProperty(token, value)
  }
  return popup
}
