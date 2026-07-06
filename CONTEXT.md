# CONTEXT.md — Trials of Kirtas
Updated: July 5, 2026 (night — the wash takes two pages; the Bardic Console learns to broadcast)
Replace the previous CONTEXT.md with this one.

────────────────────────────────────────────────────────────
## DEPLOY STATE
- **July 4 items confirmed live**: rail-dock v3 (combat.html) AND the v7
  character-badge fix both rode the July 4 21:51 push — the old doc's
  "pending" lines were stale against their own commit. Item closed.
  supabase-keepalive.yml also in.
- **tok-lore-npcs-wash-v1: deployed, verified** (M: "these work well").
- **Bardic wave A (tok-bardic-remote-waveA-v3): deployed, verified** —
  remote works, multicast works, pause works after the engine-latch fix.
- **Bardic radio B.6.2: deployed + bardic-air.sql run (with the grants
  block), heartbeat verified working** on the phone's rail.
- **tok-bardic-trim-routing-B7: uploading at session close** (radio.html,
  bardic-app.jsx, bardic-bus.js, bardic-tab.js; no SQL). ⚠ REFRESH THE
  CONSOLE TAB after this push — see LESSONS 2.
- Superseded zips, do not deploy: bardic-multicast-v1, remote-i1,
  waveA(-v1/v2), radio-waveB/B2/B3/B4/B5/B6/B6-1.
- Validation bar this session: every zip carried its smokes in _edits/;
  suite at close: radio 86 · bus 19 · tab 28 · pause 12 · multicast 10,
  all green. Wash: lore 12/12, npcs 21/21, mocks 16/16 + 8/8.

## WHAT SHIPPED (July 5)
**1. The wash sweep took lore + npcs** (factions-mirror pattern):
- lore.html: 4 edits — header ember → --look-header-ember; callout →
  candidate A (well → band), text → --look-card-text + real italic-600
  semibold (font link gained the axis); gold hairlines stay literal
  (theme constant). Approved via mock-lore-wash (A/B shown live).
- npcs.html: 16 rewires across 11 published tokens — ember, card family,
  trim, accent-strong hover, portrait stage → modal-g1/g2 (3 fossil
  stops preserved in fallbacks), dots → --look-dots, badge → --look-scrim
  with text PINNED #f0ece4 (scrim is dark in both derivation branches;
  --parchment drifts). KEEPERS untouched and smoke-pinned: five wipes,
  bars, faction tints, status dots; portrait-fade was already
  token-faithful via --ink-deep. Body byte-identical from <body> on.
- Both smokes parse ROOT_MAP from look-derive.js itself (34 tokens).

**2. The Bardic Console became a system** (the session's arc):
- **bardic-bus.js** — BroadcastChannel('tok-bardic-bus'), protocol v1 in
  the header (THE contract): verbs hello/cast/toggle/stop/pause/next/
  prev/vol/globalPause/air/radiomask in; full-SNAPSHOT state out
  (never diffs — riders stateless, latest snapshot is truth); engine-bye.
- **bardic-app.jsx** — engine adapter (verb table on refs); busSnapshot
  identity-stable (radio state via radioStateRef — a shifting snapshot
  was tearing the bus down per roster change); NEW pauseChannel
  (per-channel pause never existed; toggle = double-press-to-skip);
  selected-channel-first multicast (one mood, many channels, own bags);
  radio relay: clock-stamped anchors on every state change + 10s tick,
  sonus/YT omitted, engineId stamped; onAir conflict → airBlockedBy;
  radioMask per-channel routing; bardic_air heartbeat every 10s;
  BARDIC_BUILD tag ('B6') in every snapshot.
- **bardic-audio.js** — the latch bug (SHIPPED SINCE THE MIXER WAS BUILT):
  playTrack never reset _paused → pause-then-cast bricked pausing while
  the app flipped its own state. Fixed: playTrack resets; pause/resume
  trust the ELEMENT (heals live desyncs in one press); the 100/300/600ms
  autoplay watchdog is cancellable and pauseTrack cancels it.
- **bardic-tab.js** — the rail's Bardic tab (registerTab, order 30,
  rail.js untouched but for a 6-line loader in the characters-tab slot).
  Role-shaped pane, collapsible sections persisted (tok-bardic-shut):
  RADIO leads (listener role), ENGINE (auto-opens when live), CHANNELS
  (dropdown-first rows — silence + moods alphabetical; pause/next/vol;
  antenna toggle = rides broadcast or host-only, visible on air only),
  BROADCAST (On Air, roster with ±ms, blocked-by state). Corner chip:
  ticker offsets (396/36), toggle → mini chip lives IN the rail row,
  tab live-dot, handle ember; for players the chip reads ON AIR and
  routes straight to radio.html. Cross-device awareness = heartbeat
  POLL (15s + wake + pane-show), narrated diagnostics (raw error text,
  stale-flag → "refresh the console tab", row-missing distinct).
- **bardic-radio.js** — shared clock (/.netlify/functions/time, 6 pings,
  min-RTT filter, 60s re-sync); pure helpers bestOffset/positionAt/
  driftNudge (page and harness run the SAME math); broadcast() with
  unique engine keys + {engine:true} meta + conflict preflight (the
  incumbent keeps the air) + pre-join anchor buffering + sync-request
  answering; listen() SELF-REBUILDING (error statuses → 2s-backoff
  rebuild; reconnect() on demand); watch() retained but the rail no
  longer uses sockets.
- **radio.html** — one-tap tune-in (the gesture births a pre-blessed
  6-element pool — iOS only blesses gesture-born audio); anchors-only
  scheduling; NO rate manipulation ever (see LESSONS 3): seeks past
  0.45s, one per 15s, adaptive per-device seekLead, never during
  rebuffer; staleness ladder ask-12s / rebuild-22s / off-air-35s;
  single-engine latch; wake → resync + rebuild-if-stale; wake lock;
  SYNC TRIM slider ±500ms persisted (tok-radio-trim) — the human dials
  out BT/pipeline latency by ear, one clean seek on settle; telemetry:
  clock line, "last anchor Ns ago", per-channel lock ±ms + stall count.
- **netlify/functions/time.js**, **_edits/bardic-air.sql** (singleton
  heartbeat row; RLS + EXPLICIT GRANTS + notify pgrst reload).

## LESSONS PINNED (July 5)
1. **A transport's reach is a design constraint. Write it down.**
   BroadcastChannel = one device. Realtime = the room — but iOS freezes
   background sockets without telling the page; ROWS don't freeze.
   Affordances must match the transport that can serve them (the phone's
   rail offered "Light the engine" because it couldn't hear the laptop).
2. **The console tab is long-lived BY DESIGN → it runs pre-deploy code.**
   Refresh any open console tab after every bardic push. Build tags make
   stale tabs visible (Engine header shows '· B6'; bump per wave).
3. **Never rate-nudge music.** WebKit's pitch-preserving stretcher is the
   "56k mp3" sound; a standing error holds the whole listen inside it.
   Correction = rare clean seeks with an adaptive lead. (M's ear found
   this; ±570ms + "compression" was the giveaway.)
4. **iOS blesses only gesture-born audio elements.** Channels cast after
   tune-in played to nobody. The tap births a pool; draw from it forever.
5. **Stub the publisher's contract — a scar, not just a rule.** The mood
   field is `label`; the harness fed `name`-shaped moods and passed while
   the dropdown rendered blank. Assert mappings against the SOURCE.
6. **Silent catch blocks cost three field rounds.** Failures must narrate:
   loud warns + on-screen diagnostics (the heartbeat error text solved in
   one screenshot what silence couldn't in three).
7. **Policies are not privileges.** New Supabase tables may need explicit
   GRANTs; RLS is consulted only after table rights pass. And
   `notify pgrst, 'reload schema'` after DDL.
8. **Field telemetry beats theory.** "last anchor Ns ago", stall counts,
   and lock readouts turned every report after their arrival into a
   diagnosis. Instrument before you iterate.

## KNOWN-AND-ACCEPTED / OPEN
- **Radio sync floor (media elements): ~±150-500ms on iOS** after all
  fixes; trim kills the FIXED part per device. Ambience reads as
  resonance (M likes it); rhythm needs trim calibration — and if that's
  not enough, wave C (below). Remote solo listeners don't perceive offset
  at all (no room to be offset against).
- Track-change gap ~2s on listeners (load + one seek) — physics of
  streaming; preloading (engine announces next track early) is the lever
  if it grates.
- Stalls 1-2 at track start = load buffering, normal. CLIMBING stalls
  mid-track post-B.6 = genuine delivery; lever = Cloudinary audio
  transforms (consistent-bitrate AAC), a URL tweak.
- Two engines racing on-air simultaneously: preflight covers the normal
  case; the listener single-engine latch is the insurance.
- Chip vs roll ticker on combat.html: both bottom-right; eyeball for
  crowding, one-line offset if needed.
- Carried from July 4: ◐ override banner (mock-override-banner.html,
  outputs-only, unreviewed); players' Battle strip = Display only;
  dead feed-reader code in combat.html awaits feed-core;
  smoke-nav-cog-flyout.mjs awaiting git rm; schema deltas for
  characters/saved_monsters/drawings live-DB only; statblock drawer
  deliberate.

## THE MAP (revised July 5 night)
1. **Field-test B.7**: calibrate sync trim per device with a rhythmic
   track; exercise the antenna toggles (ambience to the room, battle
   host-only). Read the telemetry lines back.
2. **Wave C — Web Audio precision mode** (only if rhythm still fails
   post-trim): fetch + decodeAudioData + source.start(when, offset)
   against the audio clock; sample-accurate, ±15-40ms honest;
   outputLatency compensation; per-channel opt-in (decoded PCM is
   memory-hungry — not a wholesale swap). Own arc, session-day testing.
3. **Wash sweep, next page: world** (then compendium). index PULLED from
   the sweep — its overhaul designs token-native from the start (its own
   mock-first arc). combat.html joins eventually, same as factions.
4. **party.html ↔ v11 sheet parity**: field-by-field diff vs
   sheet-mount.js's render set → layout mock → build.
5. **Feed-core extraction → chronicle swap.** M to name the referent:
   retire chronicle.html for journal.html, or rebuild chronicle.html on
   the shared feed. Feed-core lands first either way; sweep combat.html's
   dead reader code in the same pass.
6. **Console layout re-haul** (needs M's gripes list) — dropdowns-in-rail
   precedent may inform the console's own density.
7. **Mobile trio** (token drag / sheet-float overflow / sf-reopen tab) —
   combat-sheet-float.js + board pointer handlers, own arc.
8. Small standalones: medallion portraits rollout, rail alias wiring,
   badge growth, flyout polish, Scenes rail-size if it reads small live.

## STANDING RULES (additions in caps context)
mock → approve → build for all UX. node --check + jsdom smokes before
every handover (JSX: @babel/parser IS the node --check); smoke green +
screenshot = done. C preps zips; M deploys (SQL first when present); C
never commits or pushes. REFRESH THE CONSOLE TAB AFTER EVERY BARDIC
DEPLOY. Injected chrome: ID-prefixed selectors, JS-mixed rgb()/rgba()
literals, cache-stamp per SETTINGS_V (rail riders follow the shipped
bare-src bootstrap convention). scrollIntoView banned in scoped
containers; overflow:clip not programmatically scrollable. GitHub web
upload drops hidden dotfiles. Stub the publisher's contract in smoke
harnesses, not your own assumption — AND ASSERT FIELD MAPPINGS AGAINST
SOURCE (the `label` scar). Recon saved state before connecting dormant
surfaces. Verify deploy state; never infer it from repo constants — and
never from a long-lived tab. Map items name FILES, not furniture.
FAILURES MUST NARRATE: no silent catch blocks in cross-device paths;
surface the raw error where the person testing can see it. NEVER
RATE-NUDGE MUSIC. Bardic protocol lives in bardic-bus.js's header;
snapshots, never diffs. Every bardic wave bumps BARDIC_BUILD.
