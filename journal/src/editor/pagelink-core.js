// pagelink-core.js — the [[ trigger's PURE core: no imports, no JSX, headlessly
// importable (the match.js discipline). pageSuggestion.js is the thin wrapper
// that adds the popup rendering.

// items: the ACTIVE vault's pages; no match → a "create" row. The vault is
// INJECTED — a static import once served sample fixtures into live mode.
export function buildPageItems(vault, query) {
  const q = (query || '').toLowerCase().trim()
  const items = vault.pages()
    .filter(p => !q || p.title.toLowerCase().includes(q))
    .slice(0, 7)
    .map(p => ({
      id: p.id, type: 'page', label: p.title, hint: p.folder,
      resolved: true, section: 'Pages',
    }))
  if (q && !items.some(i => i.label.toLowerCase() === q)) {
    items.push({
      id: null, type: 'page', label: (query || '').trim(), hint: '',
      resolved: false, section: 'Create',
    })
  }
  return items
}

// click → navigation, resolved purely. Read-only views navigate on plain
// click; editable views require Cmd/Ctrl (plain clicks must still place the
// cursor). Returns the pageId or null.
export function resolvePageLinkClick(domTarget, event, editable) {
  const el = domTarget && domTarget.closest ? domTarget.closest('span[data-pagelink]') : null
  if (!el) return null
  if (editable && !(event.metaKey || event.ctrlKey)) return null
  return el.getAttribute('data-pagelink') || null
}
