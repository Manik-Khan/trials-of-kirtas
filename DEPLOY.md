# Pagelink fix — deploy manifest

Mirrors the repo. No SQL. Replaces:
  journal.html (new ?v= stamps)
  journal-assets/journal.js · journal.css
  journal/src/JournalView.jsx
  journal/src/editor/pageSuggestion.js
  journal/smoke-comments.mjs (26/26)
New:
  journal/src/editor/pagelink-core.js (pure [[ core — match.js discipline)

Fixes: (1) the [[ suggestion pool and create path used the SAMPLE vault in
live mode (Session-12 ghosts; created pages vanished); the active vault is
now injected. (2) pageLink chips had no navigation — plain click opens the
page in read-only views; Cmd/Ctrl+click while editing. Dead links (targets
that do not exist, e.g. the ghost links you made today) no-op harmlessly —
delete those chips and relink.
