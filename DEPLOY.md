# Alias wiring — deploy manifest

Mirrors the repo. No SQL (entity_aliases already exists from the org arc).

Replaces:
  journal.html (new ?v= stamps)
  journal-assets/journal.js · journal.css
  journal/src/data/supabase-adapter.js
  journal/src/data/entityStore.js
  journal/src/editor/match.js
  journal/src/editor/suggestion.js
New:
  journal/smoke-alias.mjs (14/14)

What shipped: entity_aliases is now CONSULTED at typing time in the
journal's @ pool. Typing a merged-away key (e.g. the old typo) surfaces
the canonical entity — matched, labeled, and inserted as canon — and the
retired stub can never be re-seeded (guarded in the store itself). The
insert decision lives in match.js as a pure function (resolveMentionInsert)
per the pagelink-core discipline.

NOT included (flagged): the RAIL composer (mention-composer.js,
chronicle-side vanilla) does not consult aliases yet — same wiring, different
deploy unit; say the word and it ships as its own small patch.

Verify live: after merging a typo in the curation queue, type the OLD name
with @ in any journal page — the canon chip should appear in the picker and
insert solid.
