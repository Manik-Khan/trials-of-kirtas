// ══════════════════════════════════════════════════════════
// TokMention — the structured reference node.
//
// This is the whole point of the TipTap move: a mention is an
// ATOMIC NODE carrying { id, type, label, resolved } — not a
// colour-span. It is:
//   • atomic  — one backspace removes the whole thing; the
//               cursor can't land inside it
//   • typed   — 'npc' | 'location' (extensible: quest, item…)
//   • queryable — walk doc JSON for type:'tokMention' nodes and
//               you have every reference in the entry (backlinks)
//
// Serialized HTML mirrors the chronicle's existing span shape
// (data-mention-type / data-mention-key + npc-link etc. classes)
// so rendered journal HTML is style-compatible with chronicle CSS.
// ══════════════════════════════════════════════════════════

import Mention from '@tiptap/extension-mention'

const CLASS_FOR = {
  'npc':                 'npc-link',
  'location':            'location-link',
  'npc-unresolved':      'npc-unresolved',
  'location-unresolved': 'location-unresolved',
}

function mentionClass(attrs) {
  const key = attrs.resolved ? attrs.type : `${attrs.type}-unresolved`
  return `tok-mention ${CLASS_FOR[key] || 'npc-link'}`
}

export const TokMention = Mention.extend({
  name: 'tokMention',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: el => el.getAttribute('data-mention-key'),
        renderHTML: attrs => ({ 'data-mention-key': attrs.id }),
      },
      type: {
        default: 'npc', // 'npc' | 'location'
        parseHTML: el => (el.getAttribute('data-mention-type') || 'npc').replace('-unresolved', ''),
        renderHTML: attrs => ({}), // emitted via the combined data-mention-type below
      },
      label: {
        default: null,
        parseHTML: el => (el.textContent || '').replace(/^@/, ''),
        renderHTML: attrs => ({}),
      },
      resolved: {
        default: true,
        parseHTML: el => !(el.getAttribute('data-mention-type') || '').endsWith('-unresolved'),
        renderHTML: attrs => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-mention-type]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs
    const typeAttr = a.resolved ? a.type : `${a.type}-unresolved`
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-mention-type': typeAttr,
        'data-mention-key': a.id,
        class: mentionClass(a),
      },
      `@${a.label ?? a.id}`,
    ]
  },

  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id}`
  },
})

// ── Reference extraction (the queryable payoff) ──────────────
// Walks TipTap doc JSON and returns deduped refs:
//   [{ id, type, label, resolved, count }]
export function extractRefs(docJSON) {
  const refs = new Map()
  const walk = node => {
    if (!node) return
    if (node.type === 'tokMention' && node.attrs) {
      const { id, type, label, resolved } = node.attrs
      const key = `${type}:${id}`
      const cur = refs.get(key)
      if (cur) cur.count += 1
      else refs.set(key, { id, type, label, resolved, count: 1 })
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(docJSON)
  return [...refs.values()]
}
