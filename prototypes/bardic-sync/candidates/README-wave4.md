# Bardic room resilience — Wave 4 candidate

Status: **implemented, browser-checked, and headlessly validated; real multi-device field gates
remain.**

This standalone page begins from the frozen Wave 3 proof. It does not modify Waves 1–3 or any
production Bardic file.

## What Wave 4 adds

- The host publishes a stable playback anchor containing the shared play ID, active slot, matching
  track identity/hash, original host start time, initial position, and duration.
- A late listener verifies audio, measures its clock against the host, downloads the host's active
  bytes, and calculates the track position at a future join timestamp.
- The late listener schedules one local Web Audio source. Devices already playing are not sent a
  restart or seek command.
- A returning listener discards stale clock samples after a meaningful visibility or network
  interruption and uses the same future-scheduled join path.
- Automatic recovery is enabled by default; a manual **Join current host playback** button remains
  available when every safety gate is ready.
- Recovery states narrate missing audio verification, clock rebuilding, byte preparation, stale
  host anchors, armed joins, and completed joins.
- The existing 35-second device aging, Wave 3 two-buffer transitions, and Broadcast-only transport
  remain intact.

The join position is derived from the immutable host start anchor:

```text
join position = original position + (future join host time - original start host time)
```

The implementation does not use seeking, playback-rate correction, a server clock, or packet
arrival as playback time.

## Field gate 1 — late listener

Use HTTPS and the same browser-safe Supabase publishable key as Waves 1–3.

1. Close older Wave pages.
2. Open `bardic-room-resilience-wave4.html` on the laptop host and first phone listener.
3. Use room `bardic-wave4-resilience` on both.
4. Connect and audibly verify both devices.
5. Prepare Track A and start it synchronized from position `0`.
6. Confirm the original pair is unified.
7. While A continues, open Wave 4 on a third device as a listener.
8. Connect and audibly verify the third device. Leave automatic recovery enabled.
9. Watch the third device move through clock rebuilding and matching-byte preparation.
10. Confirm it reports a future join as armed and then **Joined to current host playback**.
11. Confirm the original pair never restarts, pauses, seeks, or changes volume.
12. Listen for whether all three devices are unified.

If a third device is unavailable, refresh the original listener while the host continues. This
tests the same preparation/join path, but does not prove three-device scale.

## Field gate 2 — refresh and reconnect

1. Keep the host and at least one listener playing.
2. Reload a listener page.
3. Reconnect and repeat the audible local verification if the browser requires it.
4. Confirm the listener automatically reloads the host's active bytes and rejoins at the current
   position without restarting the room.
5. Briefly interrupt that listener's network, restore it, and wait for Realtime to resubscribe.
6. Confirm the listener discards the old clock estimate, takes fresh samples, and schedules one
   clean rejoin.

## Field gate 3 — visibility and audio suspension

1. Background a listener for at least two seconds while the host continues.
2. Return to the page.
3. If Web Audio was suspended, replay and confirm the three local clicks.
4. Confirm the listener rebuilds its clock and rejoins once; it must not loop through repeated
   restarts.
5. Repeat with a real screen lock/unlock if the device permits browser audio to resume.

## Field gate 4 — room scale and transitions

With three or more active devices if available:

1. Prepare Track B while A plays.
2. Hard-cut to B.
3. Crossfade back to A at 500 ms.
4. Stop synchronized.
5. Confirm an unverified late device blocks a new room-wide transition and clearly says why.
6. Confirm a device with no heartbeat for 35 seconds ages out and no longer blocks the room.

## What to report

For each join or recovery, report:

- joined unified;
- joined with a slight fixed flam;
- joined clearly separated;
- joined and then drifted;
- repeatedly restarted;
- failed to prepare matching bytes;
- remained blocked, including the recovery badge text;
- or required another audio gesture.

Copy the newest event-log lines if a recovery fails or repeats.

## Validation completed here

```text
Wave 4 real-function smoke: 39/39
Browser startup: clean
Host/listener recovery UI states: pass
```

The smoke executes the actual embedded clock, anchor, scheduling, transition, stop, and failed-load
functions with fake Web Audio. Real audible recovery, browser suspension behavior, and more than
two devices remain field evidence rather than automated claims.

## Credential rule

Use only a browser-safe Supabase publishable/legacy anon key. Never commit a filled key,
`sb_secret_...`, `service_role`, database password, JWT secret, or copied browser `localStorage`.
