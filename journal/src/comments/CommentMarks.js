// CommentMarks.js — paints comment highlights over the live editor as
// ProseMirror DECORATIONS: nothing enters the doc, nothing serializes.
// The doc stays pristine; the paint is a view-layer fact, recomputed from
// the comment list + the current text (so highlights follow edits until the
// anchor genuinely breaks — at which point the comment orphans, elsewhere).
//
// Feed it comments via editor.commands.setCommentMarks(list); clicks on a
// highlight call the configured onJump(commentId).
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { docWalk, indexToPos, splitByAnchor } from '../comments/anchor.js'

const key = new PluginKey('tokCommentMarks')

function buildDecos(doc, comments) {
  if (!comments || !comments.length) return DecorationSet.empty
  const walk = docWalk(doc.toJSON())
  const { anchored } = splitByAnchor(walk.text, comments)
  const decos = []
  for (const { comment, at } of anchored) {
    const from = indexToPos(walk, at.start)
    const to = indexToPos(walk, at.end - 1) + 1
    if (to > from) {
      decos.push(Decoration.inline(from, to, {
        class: 'j-c-hl',
        'data-cid': String(comment.id),
        'data-seat': comment.seat || 'narrator',
      }))
    }
  }
  return DecorationSet.create(doc, decos)
}

export const CommentMarks = Extension.create({
  name: 'commentMarks',

  addOptions() {
    return { onJump: () => {} }
  },

  addCommands() {
    return {
      setCommentMarks: comments => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(key, comments || []))
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const onJump = this.options.onJump
    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => ({ comments: [], decos: DecorationSet.empty, doc }),
          apply(tr, prev) {
            const next = tr.getMeta(key)
            if (next !== undefined) {
              return { comments: next, decos: buildDecos(tr.doc, next) }
            }
            if (tr.docChanged) {
              // re-anchor over the new text — strict matcher, so a broken
              // anchor simply stops painting (and shows as orphaned in the rail)
              return { comments: prev.comments, decos: buildDecos(tr.doc, prev.comments) }
            }
            return prev
          },
        },
        props: {
          decorations(state) { return key.getState(state).decos },
          handleClick(view, _pos, event) {
            const hl = event.target && event.target.closest
              ? event.target.closest('.j-c-hl') : null
            if (hl && hl.dataset.cid) { onJump(hl.dataset.cid); return true }
            return false
          },
        },
      }),
    ]
  },
})
