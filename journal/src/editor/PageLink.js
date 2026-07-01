// PageLink — the [[wikilink]]: an atomic link to another page in THIS
// journal. Sibling of TokMention but a separate graph: @ = the shared
// world (entities), [[ = the private vault (pages).
// Serializes as <span data-pagelink="id" data-pagelink-label="Title">.

import Mention from '@tiptap/extension-mention'

export const PageLink = Mention.extend({
  name: 'pageLink',

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: el => el.getAttribute('data-pagelink'),
        renderHTML: attrs => ({ 'data-pagelink': attrs.pageId }),
      },
      label: {
        default: null,
        parseHTML: el => el.getAttribute('data-pagelink-label') || el.textContent,
        renderHTML: attrs => ({ 'data-pagelink-label': attrs.label }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-pagelink]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      { ...HTMLAttributes, class: 'page-link' },
      node.attrs.label ?? node.attrs.pageId,
    ]
  },

  renderText({ node }) {
    return `[[${node.attrs.label ?? node.attrs.pageId}]]`
  },
})
