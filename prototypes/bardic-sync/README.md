# Bardic synchronization prototypes

This folder preserves standalone Bardic host-clock experiments separately from the live radio
and console.

## Frozen field-tested proofs

- `frozen/bardic-host-clock-wave1.2.3.html` — MacBook/iPhone audible clock and synchronized-click
  proof.
- `frozen/bardic-real-track-wave2.html` — identical-byte download/decode plus synchronized real
  track play, restart, and stop proof.

Both passed on real devices on 2026-08-01. Treat them as immutable evidence. Copy Wave 2 to a new
file for Wave 3 track-switching work.

The full result, protocol rules, debugging history, security constraints, production boundary,
and Wave 3 plan live at:

`docs/handoffs/bardic/CONTEXT_Bardic-update-2026-08-01.md`

## Credential rule

Use only browser-safe Supabase publishable/legacy anon keys in local testing. Never commit a
filled key, `sb_secret_...`, `service_role`, database password, JWT secret, or browser
`localStorage` contents. The checked-in HTML contains empty credential inputs.
