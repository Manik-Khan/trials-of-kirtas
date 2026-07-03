# Book arc, increment 1 — deploy manifest

Mirrors the repo. No SQL — the book is a READING LAYER over the existing feed.

Replaces:
  journal.html (new ?v= stamps)
  journal-assets/journal.js · journal.css
  journal/src/App.jsx
  journal/src/ChronicleView.jsx
  journal/src/data/supabase-adapter.js
New:
  journal/src/data/bookModel.js (pure rows→chapters transform)
  journal/smoke-book.mjs (11/11)

What shipped: the journal's Chronicle tab now reads the LIVE feed —
sessions as chapters (session 0 = Prologue), chapter titles from
sessionTitle, the Narrator's golden box (actor_key dm), per-seat accent
cards riding the real chosen accents, provenance badges (📄 from journal,
⏱ shared later), and written_at PLACEMENT: late-shared pages sit at their
written-at time in the weave, not at their share time. Thread chips dim
the weave per entity, chapter by chapter. Hidden rows and non-chronicle
channels never render. Writing still happens in chronicle.html + journal
shares until increment 2 (threads + composer) and 3 (Quill retirement).
