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

## Credential rule

Use only browser-safe Supabase publishable/legacy anon keys in local testing. Never commit a
filled key, `sb_secret_...`, `service_role`, database password, JWT secret, or browser
`localStorage` contents. The checked-in HTML contains empty credential inputs.
