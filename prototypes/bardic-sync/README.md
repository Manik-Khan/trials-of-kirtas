# Bardic synchronization prototypes

This folder preserves standalone Bardic host-clock experiments separately from the live radio
and console.

## Frozen field-tested proofs

- `frozen/bardic-host-clock-wave1.2.3.html` — MacBook/iPhone audible clock and synchronized-click
  proof.
- `frozen/bardic-real-track-wave2.html` — identical-byte download/decode plus synchronized real
  track play, restart, and stop proof.
- `frozen/bardic-track-switch-wave3.html` — two-buffer background preparation, gapless hard cut,
  synchronized crossfade, buffer reuse, stop, and failed-pending-download isolation proof.

Wave 1 and Wave 2 passed on real devices on 2026-08-01. Wave 3 passed on the same MacBook/iPhone
pair on 2026-08-02. Treat all three as immutable evidence and begin later experiments from copies.

The full result, protocol rules, debugging history, security constraints, production boundary,
and Wave 3 plan live at:

`docs/handoffs/bardic/CONTEXT_Bardic-update-2026-08-01.md`

The Wave 3 real-function smoke remains at `tests/smoke-bardic-wave3.mjs` and reports 26/26 checks.

## Current candidate

- `candidates/bardic-room-resilience-wave4.html` — late join, refresh/reconnect recovery, lifecycle
  narration, and multi-device room handling built from the frozen Wave 3 proof.
- `candidates/README-wave4.md` — staged field gates for late join, network recovery, visibility,
  screen lock, and three-or-more-device transitions.
- `tests/smoke-bardic-wave4.mjs` — real-function anchor/recovery plus Wave 3 regression smoke;
  currently 50/50 checks, including wake-lock acquisition/release, host-authoritative transitions,
  and stale-source recovery cleanup.

Wave 4 is not frozen or production-ready until those real-device gates pass.

## Credential rule

Use only browser-safe Supabase publishable/legacy anon keys in local testing. Never commit a
filled key, `sb_secret_...`, `service_role`, database password, JWT secret, or browser
`localStorage` contents. The checked-in HTML contains empty credential inputs.
