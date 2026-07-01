// Callout — an Obsidian-style admonition block, ToK-flavored.
// Variants: note 💡 · quest ⚔ · warning ❗ · lore 📜
//
// This answers the "would it show in the chronicle?" question by
// construction: the node serializes to <div data-callout="…"> and both
// surfaces share one stylesheet — the journal EDITS it, the chronicle
// RENDERS the same HTML. When the chronicle becomes TipTap (Phase 5),
// this same extension parses it back. One schema, every surface.

import { Node, mergeAttributes } from '@tiptap/core'

export const CALLOUT_VARIANTS = ['note', 'quest', 'warning', 'lore']

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'note',
        parseHTML: el => el.getAttribute('data-callout') || 'note',
        renderHTML: attrs => ({ 'data-callout': attrs.variant }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'tok-callout' }), 0]
  },

  addCommands() {
    return {
      toggleCallout: (attrs = {}) => ({ commands }) =>
        commands.toggleWrap(this.name, attrs),
      cycleCalloutVariant: () => ({ editor, commands }) => {
        const cur = editor.getAttributes(this.name).variant || 'note'
        const next = CALLOUT_VARIANTS[(CALLOUT_VARIANTS.indexOf(cur) + 1) % CALLOUT_VARIANTS.length]
        return commands.updateAttributes(this.name, { variant: next })
      },
    }
  },
})
