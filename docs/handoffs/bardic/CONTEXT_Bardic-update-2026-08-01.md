# Bardic Radio host-clock handoff — current through 2026-08-02

Status: **Wave 1, Wave 2, and Wave 3 passed in the field. Production integration has not
started.**

This document is the current Bardic synchronization authority. It supersedes the unresolved
host-as-clock fork in the older project context while preserving the prior dead-end record.

## 1. Executive verdict

The browser architecture can synchronize locally decoded Web Audio across at least one MacBook
and one iPhone closely enough to sound like a single source in a room.

Wave 1 proved the host clock, readiness, future scheduling, and audible click alignment. Wave 2
proved the same path with a real Cloudinary MP3 for 1:52.4, including a synchronized restart from
45 seconds and synchronized stop. Wave 3 proved background preparation of a second track,
gapless hard cuts and crossfades, decoded-buffer reuse, synchronized stop, and failure isolation.
M described the music as unified and the 500 ms crossfade as very smooth.

This is a prototype verdict, not a production verdict. The proof pages are standalone and have
not replaced the clock/control logic in the live Bardic console or player.

## 2. Architecture that passed

```text
Cloudinary
  └─ identical audio bytes downloaded and decoded by every playback device

Host browser
  ├─ sole time authority
  └─ broadcasts future-timestamped commands through Supabase Realtime

Listener browser
  ├─ measures listener↔host offset with repeated ping/pong samples
  ├─ keeps the lowest-RTT samples
  └─ maps future host time to local AudioContext.currentTime

Every device
  └─ schedules its own decoded AudioBufferSourceNode
```

The packet does not trigger playback on arrival. It announces a future host timestamp. Each
device schedules locally with enough lead time for network jitter to become irrelevant to the
start event.

This removes the former stacked-clock problem:

```text
old: host↔Netlify error + listener↔Netlify error
new: listener↔actual-host error
```

Audio bytes and timing messages remain independent. The host does not relay or stream audio.

## 3. Frozen proof files

Do not edit these files. Begin later experiments from copies.

- `prototypes/bardic-sync/frozen/bardic-host-clock-wave1.2.3.html`
  - Known-good clock, connection, audible verification, and synchronized-click proof.
  - Supabase JS pinned to `2.111.0`.
  - Uses low-rate Broadcast device status rather than Presence.
- `prototypes/bardic-sync/frozen/bardic-real-track-wave2.html`
  - Known-good real-track download, decode, fingerprint, readiness, play, restart, and stop proof.
  - Default test track is the public Cloudinary URL recorded below.
- `prototypes/bardic-sync/frozen/bardic-track-switch-wave3.html`
  - Known-good two-buffer preparation, hard-cut, crossfade, repeated-switching, synchronized-stop,
    and failed-pending-download isolation proof.
  - Fresh sessions default to the field-preferred 500 ms crossfade.

Earlier root-level Wave 1 revisions and the transport diagnostic are debugging history, not the
current proof authority.

## 4. Wave 1 field evidence

Test devices were a MacBook browser host and an iPhone listener placed in the same room.

The successful flow was:

1. Both devices subscribed to the same Supabase Broadcast topic.
2. Each ran a local three-click sound test.
3. M explicitly confirmed the clicks were audible; each device changed to `VERIFIED`.
4. The phone measured its clock against the laptop host.
5. The host sent an eight-click command with a future host timestamp.
6. Both devices scheduled local Web Audio buffers and flashed at playback.

Captured clock evidence included:

- best RTT: 37.0 ms;
- offset jitter: 0.3 ms;
- valid samples: 40;
- host output latency reported around 24 ms;
- phone output latency reported around 15.35 ms.

The absolute host-minus-listener offset varied across sessions and was not itself a defect. The
estimator's stability mattered. In three synchronized trials and different listening positions,
the two sources blended closely enough that M moved his ear toward each device to verify that
both were producing the sound.

Wave 1 success condition is therefore satisfied perceptually. No microphone-derived numerical
error is claimed.

## 5. Wave 2 field evidence

Test asset:

```text
Title: Homecoming to Port
URL: https://res.cloudinary.com/df0tgoiyb/video/upload/v1779949286/1-07._Homecoming_to_Port_b9ez8w.mp3
Downloaded size: 3.75 MB
Decoded duration: 1:52.4
SHA-256 prefix shown by both devices: 54a2c7a1
```

Both devices independently downloaded and decoded the file, reported `READY`, and displayed the
same fingerprint before Play was enabled.

Field results:

- start from 0 seconds was perceptually unified;
- playback remained essentially unified through the full rhythmic track;
- one uncertain drum moment did not develop into accumulating separation and may have belonged
  to the recording or room reflections;
- restart from 45 seconds was synchronized;
- synchronized stop was clean.

This is materially stronger than the earlier clean Web Audio feasibility page: it proves the
host-clock protocol, real Supabase transport, explicit readiness, identical remote bytes, local
decode, and real music together on separate devices.

## 6. Debugging history worth preserving

### Silent phone did not invalidate scheduling

An early synchronized run flashed correctly but the phone produced no sound. The prototype had
treated a scheduled sound as proof of audible output. Later versions added a local three-click
test and required the human to press **I heard the three clicks**. `VERIFIED` now means audibly
confirmed, not merely “AudioContext says running.”

### Missing UI binding

Wave 1.2 initially threw `Cannot set properties of undefined (setting 'disabled')` because a new
button lacked its JavaScript binding. Wave 1.2.1 corrected it. Do not infer an audio failure from
that historical UI error.

### Generic transport errors were an invalid API key

Both old and new pages reported `CHANNEL_ERROR · transport failure`. A standalone HTTPS/raw
WebSocket diagnostic revealed `401 Invalid API key`. With the correct publishable key, Auth
returned 200, the raw Realtime socket opened, and a Phoenix heartbeat received `status: ok`.

The diagnostic REST-root request then returned `Secret API key required`; that endpoint was a
poor browser-key test and was not evidence that the publishable key failed. Auth plus the raw
Realtime heartbeat were the decisive results.

### Presence feedback loop closed the channel

After the credential correction, the channel subscribed and immediately reported
`Client presence rate limit exceeded`. UI/presence updates had formed a feedback loop. The later
`unmatched topic` errors were secondary messages sent after the server closed the topic.

Wave 1.2.3 removed Presence completely. Device status now uses ordinary low-rate Broadcast:
initial status, state changes, and a periodic heartbeat. The corrected page stayed subscribed
through visibility changes and received successful Realtime heartbeat replies.

### Host-only playback on failed send

An early proof could schedule the host even when the Broadcast timed out. Later revisions require
a successful Broadcast acknowledgement before the host schedules itself. Preserve that rule:
failed or closed transport must not create a misleading host-only test.

## 7. Protocol and readiness rules

Clock samples:

- listener sends a ping containing an ID and local send time;
- host immediately returns host receive/send times;
- listener records its receive time and estimates host offset;
- retain the lowest-RTT samples and report offset jitter;
- do not arm a listener until it has a usable estimate.

Audio readiness:

```text
LOCKED
  → local test scheduled
UNVERIFIED
  → human confirms audible output
VERIFIED
  → track downloading
DOWNLOADING
  → track decoding
DECODING
  → matching bytes decoded
READY
  → future command received
ARMED
  → scheduled local playback
PLAYING
```

Operational invariants:

- The host is the sole clock authority.
- Commands carry future host timestamps; arrival time is never playback time.
- Track identity is the byte fingerprint, not title or URL alone.
- Every connected playback device must be `VERIFIED` and `READY` with the same fingerprint for
  the safe first implementation.
- The host schedules locally only after Broadcast acknowledgement.
- Keep current and pending buffers, plus at most one queued buffer. Do not decode the whole
  library into memory.
- Output-latency compensation is a device-level refinement, not a substitute for the shared clock.
- No automatic drift correction belongs in the next proof. Observe sustained playback first.

## 8. Security and transport rules

The repository is public.

- Browser pages may accept only a Supabase publishable key (`sb_publishable_...`) or legacy anon
  key. Never place `sb_secret_...`, `service_role`, a JWT secret, database password, or any other
  privileged credential in these pages.
- The Supabase project URL is public routing information, not a secret.
- Prototype fields persist the browser-safe key in that browser's `localStorage` for testing.
  Never copy localStorage contents, event-log dumps containing credentials, or a filled-in page
  into the repository.
- No publishable or anon key is hardcoded in the frozen files. Password inputs are empty in source.
- Device status uses Broadcast, not Presence. Keep status low-rate and avoid feedback loops.
- The prototypes load pinned Supabase JS from jsDelivr; production integration should follow the
  repository's own dependency/cache-stamp conventions rather than silently inheriting that choice.

## 9. Mechanisms still ruled out

The field pass changes the host-clock verdict; it does not erase the prior dead ends.

Do not revive:

- synchronized `HTMLAudioElement` playback;
- continuous seeking or seek-based relock;
- acoustic room-correlation as a runtime synchronization system;
- a one-shot microphone measurement as the primary clock;
- `playbackRate` or time stretching for drift correction;
- `driftNudge()`;
- a host-offset/trim slider as the timing foundation;
- independent Netlify clock estimates for host and listeners.

`bardic-echo.js` remains dormant historical reference. Manual per-device trim may eventually be
useful for a stable residual hardware offset, but only after measured evidence shows one.

## 10. Production integration boundary

No live Bardic source was changed by Wave 1, Wave 2, or Wave 3.

Current production/historical files remain:

- `radio.html` — B17, Web Audio path behind `?engine=wa`;
- `bardic-player.js` — WA2 engine;
- `bardic-radio.js` — `clk2` Netlify-clock model;
- `bardic-console.html` and `bardic-app.jsx` — existing host controls;
- `bardic-echo.js` — dormant legacy measurement code;
- `webaudio-sync-proto.html` — earlier feasibility proof.

Wave 3 has passed. When production integration begins, add a new flagged host-clock path alongside
the existing behavior. Preserve the old route for A/B and rollback. Apply the repository's
cache-stamp rule to every changed include.

## 11. Wave 3 — seamless track switching passed

Wave 3 lives at `prototypes/bardic-sync/frozen/bardic-track-switch-wave3.html`. It keeps two
independently decoded buffers in memory. Preparing the inactive slot never stops the active
source. Every active verified device must report the same slot track ID and SHA-256 fingerprint
before the host can broadcast a future-timestamped transition.

The transition command supports an 8 ms anti-click hard-cut overlap or a synchronized 100–500 ms
crossfade using separate source/gain nodes. Duplicate transition and stop IDs are ignored, and
devices with no heartbeat for 35 seconds age out of the room gate.

MacBook-host/iPhone-listener field results on 2026-08-02:

- Track A started unified.
- Track B downloaded and decoded to matching hashes while A remained uninterrupted.
- The hard cut to B was unified and gapless; playback remained in sync after one minute.
- The 300 ms crossfade back to A was unified and gapless but felt slightly abrupt.
- The 500 ms crossfade to B was smooth and unified, so 500 ms is the fresh-session default.
- Reusing the prepared A buffer worked without another download.
- Synchronized stop worked.
- With B playing, an invalid Track A URL failed to fetch while B stayed audible and synchronized.
- Restoring A's URL returned both devices to matching `READY`; A then played and stopped in sync.

Automated validation runs the actual embedded scheduling functions with fake Web Audio and passes
26/26 checks. This covers matching and mismatching readiness, stale-device aging, crossfade and
hard-cut scheduling, duplicate transition/stop suppression, and failed-pending-download isolation.

Remaining gates: test more than two devices, mixed operating systems/browsers, longer tracks,
join-mid-track, reconnect, visibility changes, screen lock/background suspension, and degraded
networks. Only measured failure should justify replacing Supabase Broadcast with direct WebRTC.

## 12. Wave 4 candidate — room resilience

Current candidate:

- `prototypes/bardic-sync/candidates/bardic-room-resilience-wave4.html`
- `prototypes/bardic-sync/candidates/README-wave4.md`
- `prototypes/bardic-sync/tests/smoke-bardic-wave4.mjs`

Wave 4 begins from the frozen Wave 3 proof and adds a host playback anchor. The anchor identifies
the shared play, active slot, exact bytes, original host start time, initial position, and duration.
A late listener verifies audio, rebuilds its listener-to-host clock, prepares matching bytes, and
calculates the correct position at a future join timestamp. Only that listener schedules a new
source; devices already playing receive no restart or seek command.

Visibility/network interruptions mark the listener for recovery and discard stale clock samples.
On return, the same one-shot future scheduling path is used. Automatic recovery defaults on, with
a manual join button and explicit narrated blockers. No seeking or playback-rate correction was
reintroduced.

Automated and local-browser gates:

- Wave 4 real-function smoke: 39/39;
- page starts without browser console errors;
- listener and host recovery controls/states render and switch correctly.

Field evidence is still required for a late third device, refresh, network loss, background/screen
lock, and three-or-more-device transitions. Do not freeze Wave 4 or integrate it into production
until those gates pass.

## 13. Handoff summary

The main synchronization and transition uncertainties are closed: host-as-clock plus local decoded
Web Audio can sound unified on real separate devices, including gapless track changes. The next
task is to field-test the standalone Wave 4 room-resilience candidate, followed by production
integration behind a new flag.
