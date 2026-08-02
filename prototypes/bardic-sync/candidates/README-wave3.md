# Bardic track switching — Wave 3 candidate

Status: **implemented and headlessly validated; real two-device browser/audio field test required.**

This standalone page is a copy-derived successor to the frozen Wave 2 proof. It does not modify
Wave 1.2.3, Wave 2, or any production Bardic file.

## What Wave 3 adds

- Two independent decoded slots: Track A and Track B.
- Track B can download and decode while Track A keeps playing (and vice versa).
- Room readiness requires every active verified device to report the same track ID and SHA-256
  fingerprint for the selected target slot.
- One synchronized transition command supports:
  - hard cut (an 8 ms anti-click overlap);
  - 100, 250, 300, or 500 ms crossfade.
- A→B→A switching reuses both decoded buffers.
- Duplicate transition and stop IDs are ignored.
- Devices older than 35 seconds age out of the room gate.
- A failed inactive-slot download reports an error without stopping or replacing the current
  source.

Default tracks come from ToK's existing `data/tracks.json` library:

- Track A: **Homecoming to Port**
- Track B: **The Bustling Port Market**

Both URL and label fields remain editable.

## First field test — one step at a time

Use the same HTTPS hosting method and browser-safe Supabase publishable key that worked for Wave 2.

1. Close every older Wave page on both devices.
2. Open `bardic-track-switch-wave3.html` on the laptop and phone.
3. Confirm both use room `bardic-wave3-switching`.
4. Connect the laptop as **Host** and phone as **Listener**.
5. On each device, play the three local clicks and press **I heard the three clicks** only when
   they are audible.
6. On the host, press **Prepare Track A on all devices**.
7. Wait until both device rows show matching `READY` hashes under Track A.
8. Leave target **Track A**, transition **Hard cut**, position `0`, then press **Start Track A
   synchronized**.
9. Confirm A starts cleanly and remains unified.
10. While A is still playing, press **Prepare Track B on all devices**.
11. Confirm A never stops or goes silent while B downloads and decodes.
12. Wait until both rows show matching `READY` hashes under Track B.
13. Select target **Track B**, leave **Hard cut**, position `0`, and switch.
14. Listen for a clean shared cut with no loading gap, echo, or one-device-only playback.
15. Select target **Track A**, choose **Crossfade**, choose `300 ms`, and switch back.
16. Confirm both devices begin and finish the crossfade together.
17. Repeat B→A once more, optionally comparing `100 ms` and `500 ms`.
18. Press **Stop synchronized** and confirm both stop together.

## Failure-isolation check

Only after the normal A/B test passes:

1. Keep one slot playing.
2. Put an invalid URL in the inactive slot.
3. Prepare that inactive slot.
4. The inactive slot must show an error while the current track remains audible and unchanged.
5. Restore the original URL and prepare it again before continuing.

## What to report

For the hard cut and crossfade separately, report one of:

- unified and gapless;
- unified but with a noticeable common delay;
- slight fixed flam;
- clearly separated;
- variable alignment;
- one device went silent;
- current track stopped during preparation.

Also copy the device rows and newest event-log entries if any slot fails or hashes differ.

## Validation completed here

```text
Inline JavaScript parse: pass
UI bindings: 46/46 present, no duplicate IDs
Wave 3 real-function smoke: 26/26
Credential-pattern scan: clean
```

The smoke executes the actual embedded functions with fake Web Audio scheduling. It covers
matching/mismatching readiness, stale-device aging, crossfade source/gain scheduling, gapless
hard-cut scheduling, duplicate transition suppression, failed pending download isolation, and
duplicate stop suppression.

The current sandbox could not serve or open the local page in a browser, so rendered layout,
live Supabase behavior, real downloads/decodes, and audible multi-device transitions remain field
gates. Do not freeze this candidate or integrate it into production until those gates pass.

## Credential rule

Use only a browser-safe Supabase publishable/legacy anon key. Never commit a filled key,
`sb_secret_...`, `service_role`, database password, JWT secret, or copied browser `localStorage`.
