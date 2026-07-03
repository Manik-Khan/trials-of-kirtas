// Attribution.js — the seat-colored attribution chip: the ONE new span type
// the comments arc adds to the locked doc format.
//
// ATOMIC by design (the mock's approved lock): the chip is a claim that these
// are the named seat's words. It can be deleted or moved whole, never edited
// inside — an editable chip would let the owner put words in someone's mouth
// while their color vouches for them. Rewording happens BEFORE accept
// (edit-then-accept) or by deleting the chip and paraphrasing unattributed.
//
// Serialized shape (deterministic — chronicle CSS and any future SQL rewrite
// depend on attribute order, same discipline as mention chips):
//   <span data-attrib="caim" data-attrib-name="Caim" class="tok-attrib">
//     …the words…<span class="tok-attrib-seat">— Caim</span></span>
import { Node, mergeAttributes } from '@tiptap/core'

export const Attribution = Node.create({
  name: 'attribution',
  group: 'inline',
  inline: true,
  atom: true,                       // one opaque character; no editing inside
  selectable: true,

  addAttributes() {
    return {
      seat:     { default: null },  // character_key ('' → narrator)
      seatName: { default: '' },    // display name at accept time
      text:     { default: '' },    // the accepted words
    }
  },

  parseHTML() {
    return [{
      tag: 'span[data-attrib]',
      getAttrs: el => ({
        seat: el.getAttribute('data-attrib'),
        seatName: el.getAttribute('data-attrib-name') || '',
        // the words = text content minus the trailing seat tag
        text: (el.childNodes[0] && el.childNodes[0].textContent) || el.textContent || '',
      }),
    }]
  },

  renderHTML({ node }) {
    const { seat, seatName, text } = node.attrs
    return ['span',
      mergeAttributes({
        'data-attrib': seat || 'narrator',
        'data-attrib-name': seatName,
        class: 'tok-attrib',
      }),
      text,
      ['span', { class: 'tok-attrib-seat' }, `— ${seatName || 'Narrator'}`],
    ]
  },
})
