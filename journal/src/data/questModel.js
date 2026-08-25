// Quest capture + Chronicle projection helpers. Pure, so the production
// reader and the known-answer smoke exercise the same ordering rules.

export function questCaptureEnabled(search = '') {
  return new URLSearchParams(search).get('questCapture') === '1'
}

export function questTitle(title, objective) {
  const named = String(title || '').trim()
  if (named) return named
  const task = String(objective || '').trim().replace(/[.!?]+$/, '')
  if (task.length <= 80) return task
  const cut = task.slice(0, 80)
  const space = cut.lastIndexOf(' ')
  return (space > 48 ? cut.slice(0, space) : cut) + '…'
}

export function buildQuestStarts(payload = {}) {
  const quests = new Map((payload.quests || []).map(q => [String(q.id), q]))
  const firstObjectives = new Map()
  ;(payload.objectives || [])
    .slice()
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .forEach(o => {
      const id = String(o.quest_id)
      if (!firstObjectives.has(id)) firstObjectives.set(id, o)
    })

  return (payload.starts || []).map(s => {
    const questId = String(s.quest_id)
    const quest = quests.get(questId)
    if (!quest) return null
    const objective = firstObjectives.get(questId)
    const parsed = Date.parse(s.occurred_at)
    return {
      id: String(s.id),
      questId,
      origin: s.origin,
      at: Number.isNaN(parsed) ? 0 : parsed,
      session: s.session_id == null ? 0 : s.session_id,
      feedPostId: s.feed_post_id == null ? null : String(s.feed_post_id),
      journalPageId: s.journal_page_id || null,
      title: quest.title || 'Untitled quest',
      description: quest.summary || '',
      objective: objective?.title || '',
      giverId: quest.giver_id || null,
      giverLabel: quest.giver_label || null,
      locationId: quest.destination_location_id || null,
      locationLabel: quest.destination_label || null,
    }
  }).filter(Boolean).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
}

export function questStartsBySession(starts) {
  const grouped = {}
  for (const start of starts || []) {
    (grouped[start.session] = grouped[start.session] || []).push(start)
  }
  return grouped
}

// Chronicle-origin receipts sit directly after their source entry. Journal
// and Hub receipts keep their own creation time because no prose source exists.
export function mergeStoryTimeline(entries, fights, starts) {
  const items = (entries || []).map(e => ({ t: e.at, k: 'entry', e }))
  ;(fights || []).forEach(f => items.push({ t: f.startAt, k: 'fight', f }))
  ;(starts || []).filter(s => !(s.origin === 'chronicle' && s.feedPostId))
    .forEach(q => items.push({ t: q.at, k: 'quest', q }))
  const rank = { entry: 0, quest: 1, fight: 2 }
  items.sort((a, b) => a.t - b.t || rank[a.k] - rank[b.k])

  const anchored = (starts || [])
    .filter(s => s.origin === 'chronicle' && s.feedPostId)
    .slice()
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  for (const q of anchored) {
    let at = items.findIndex(it => it.k === 'entry' && String(it.e.id) === q.feedPostId)
    if (at < 0) {
      items.push({ t: q.at, k: 'quest', q })
      continue
    }
    while (items[at + 1]?.k === 'quest' && items[at + 1].q.feedPostId === q.feedPostId) at += 1
    items.splice(at + 1, 0, { t: items[at].t, k: 'quest', q })
  }
  return items
}

export function chaptersWithQuestSessions(chapters, starts) {
  const next = (chapters || []).map(ch => ({ ...ch, entries: ch.entries || [] }))
  const sessions = new Set(next.map(ch => ch.session))
  for (const q of starts || []) {
    if (sessions.has(q.session)) continue
    sessions.add(q.session)
    next.push({
      session: q.session,
      title: q.session === 0 ? 'Prologue' : '',
      date: q.at ? new Date(q.at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : '',
      entries: [],
    })
  }
  return next.sort((a, b) => b.session - a.session)
}
