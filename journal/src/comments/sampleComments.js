// sampleComments.js — the standalone preview's comments store: same surface
// as the adapter's comment methods, in memory, with two seeded comments and
// one deliberate orphan so the "since edited" log shows on first open.
let rows = []
let seeded = false
let nextId = 1

export function makeSampleComments() {
  return {
    async loadComments(pageId) {
      if (!seeded) {
        seeded = true
        // seed onto whichever page asks first — the preview's demo page
        rows = [
          { id: nextId++, page_id: pageId, author_id: 'uid-caim', seat: 'caim', seatName: 'Caim',
            body_html: 'They didn’t swim — check the hull for claw marks below the waterline.',
            quote: 'ended at the waterline', prefix: 'mountain pass ', suffix: ', which should',
            status: 'open' },
          { id: nextId++, page_id: pageId, author_id: 'uid-narr', seat: '', seatName: 'Narrator',
            body_html: 'Lovely line — worth keeping when this goes to the Chronicle.',
            quote: 'The tide waits for no council of five', prefix: 'argued. ', suffix: ' Nothing',
            status: 'open' },
        ]
      }
      return rows.filter(r => r.page_id === pageId && r.status === 'open')
    },
    async addComment(row) {
      const r = { id: nextId++, status: 'open', ...row }
      rows.push(r)
      return r
    },
    async setCommentStatus(id, status) {
      const r = rows.find(x => x.id === id)
      if (r) r.status = status
    },
    async deleteComment(id) {
      rows = rows.filter(x => x.id !== id)
    },
  }
}
