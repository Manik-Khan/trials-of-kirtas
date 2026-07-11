# Battle Forge — Contest Cover
*Design spec, 2026-07-11 (M's second ruling, same day as the ledge-peek geometry change).
Companion to `FORGE_PROTOCOL.md` (the event spine this leans on) and `CONTEXT_Forge.md` §4
(the geometry that produces the verdict being argued). **Spec only — nothing built yet; M
approves the mechanism and the mock (`forge/cover-contest-mock.html`) first.***

---

## §0 · The ruling (M, 2026-07-11)

> "The admin needs a way to change [cover] in the moment, per attack. If a player makes an
> argument for something else, and it's agreed, the admin can click on the block saying no
> attack or +2 or +5 and change it right there. It needs to be **before the roll**. Or, when
> they roll, the player has a **'contest cover' toggle** for that attack, and the admin can
> choose what it is from a **menu on their side** that comes up with the contest."

The geometry (`losVerdict`) is the honest default. This is the human override for the cases
the grid can't see — half-cover from a body the DM is narrating, an angle the model doesn't
model. **One mechanism, two doors, one fact in the log.**

## §1 · Two doors, one mechanism

| Door | Who starts it | When |
|---|---|---|
| **(a) Player contests** | attacker taps **Contest cover** on the targeted attack card | before they roll |
| **(b) Overseer re-rules** | overseer taps the cover chip on any attack about to happen (or the last one) | any time |

Both converge on the same thing: **the overseer picks a ruling from a four-option menu**
— `none` · `half +2` · `¾ +5` · `total (no attack)` — plus a free-text reason line that
lands in the combat log. The ruling is a **fact the whole table replays to**, so every
device agrees the shot was taken under ¾, not ½.

## §2 · The design decision — reuse the prompt spine, add **no** new event kinds

The contest is a **pre-roll pause that routes to exactly one device, times out to a safe
default, survives a refresh, and dedups by seq.** That is precisely `prompt` /
`prompt_answered` (`forge-replay.js` `pendingPrompt`; `forge-pipeline.js` `ask()`). Both
options were weighed:

**Option A — new kinds (`cover_contest` + `cover_ruled`).** Cleanest sentences in the
Chronicle; explicit privileged `cover_ruled`. **Cost:** 17→19 kinds; a new RLS clause; a
second `pendingPrompt`-shaped slot and a second `ask()`-shaped pause re-implementing what
already exists and is smoke-covered.

**Option B — reuse `prompt` / `prompt_answered` (RECOMMENDED).** The contest is a `prompt`
with `react:"cover"` whose `to` is the **overseer sentinel `"__overseer"`**, answered by a
`prompt_answered` the overseer writes. Zero new kinds; zero schema/RLS change (see §6); the
pause, single-device routing, refresh-recovery, and seq-dedup come for free and are already
tested. Costs, and how each is paid:

- *`to` is normally a reacting player; here it's the overseer.* Routing already keys on
  `controlsUnit(payload.to)`, and `controlsUnit("__overseer")` is true **only** on the
  overseer device — the ruling menu pops there and nowhere else. No code change to routing.
- *`prompt_answered` sets `reactionUsed` on `to`.* `"__overseer"` isn't in `state.units`,
  so the existing `if (state.units[row.unit])` guard already no-ops it. A cover ruling
  consumes no reaction.
- *Timeout semantics invert* (overseer is primary, not the fallback). Handled on the
  **asker** side, not `checkTimeouts` — see §4. `checkTimeouts` firing `onPromptFallback`
  on the overseer's own screen is benign (the menu is already open) and can be suppressed by
  skipping `react:"cover"` there.

**Recommendation: Option B.** Surgical, no new surface, honours "the log wins" without a new
vocabulary word. The one thin addition is a `react` **value** (`"cover"`), not a `kind`.

## §3 · The flow (Option B, door (a))

Attacker's device, attacker has toggled **Contest cover** on this attack:

1. **Pause before the roll.** The pipeline runs a new `contestCover(unit, ctx)` built from
   the existing `ask()` primitive — it publishes `prompt { unit: <attacker>, to:"__overseer",
   react:"cover", context:{ attacker, target, verdict, culprit } }` and awaits, exactly like
   a reaction prompt. `attack_declared` is **not** published yet — the roll hasn't happened.
2. **Routes to the overseer only.** `deps.onPrompt(row)` fires solely on the overseer device
   (`controlsUnit("__overseer")`); every other device — including the contesting player —
   shows *"waiting on the DM…"*. The player's card is frozen mid-declare.
3. **The overseer rules.** The menu (mock §7) offers `none / +2 / +5 / no attack` + a reason
   line. Tap publishes `prompt_answered { unit:"__overseer", prompt_seq, use:true,
   cover, acBonus, reason }`.
4. **The attack proceeds under the ruling.** The asker's `ask` promise resolves with the
   answer; the pipeline **bakes `{cover, acBonus}` into the `attack_declared` payload**
   (`mode`/`context`) and publishes it, then rolls and resolves as normal. `total` → the
   attack never declares; the card narrates *"DM ruled total cover — no shot."* The reason
   string is echoed into the combat log (a `chat` event, or carried on `attack_declared`
   context and rendered by the board).

**Door (b)** is the same publish pair, initiated by the overseer: the overseer's toolbar
raises the contest for the acting unit (`prompt { unit:<acting>, to:"__overseer",
react:"cover" }`) and answers it in the same gesture. If the attack has already resolved,
door (b) is instead an `override` on `attack_resolved` (existing machinery, `corrects_seq`)
— re-ruling cover on a *past* shot is a retcon, not a pre-roll pause.

## §4 · Timing & timeout

- **Pre-roll pause is mandatory for the contest** — the whole point is the ruling lands
  *before* dice. The declared event carries the ruled cover, so replay never has to reconcile
  a roll made under the wrong number.
- **Timeout = the geometry default, mirroring the 20 s prompt→overseer fallback.** The
  asker's `contestCover` races a 20 s timer (same constant as `prompt.timeout`); if the
  overseer hasn't ruled, the promise resolves with the **geometry verdict unchanged** and the
  attack proceeds under the computed cover. A silent DM never stalls the fight; the safe
  default is the honest grid answer. (Unlike a reaction, there is no second fallback target —
  the overseer *is* the authority, so its non-answer means "the grid stands.")
- A late ruling that arrives after the 20 s default already fired is inert: the
  `attack_declared` is already in the log under the default; the overseer uses `override` if
  they still want to change it.

## §5 · Replay semantics

- The **ruling is a fact**: `prompt` + `prompt_answered{cover,acBonus,reason}` sit in the log,
  and the following `attack_declared` carries the ruled cover inline. Any device replaying —
  late joiner, refresh, rewound branch — reconstructs the same shot under the same cover with
  no outside dependency. Self-contained, per the protocol's inline-fact rule.
- **Refresh mid-contest** lands in `pendingPrompt` with `react:"cover"` → the returning
  device shows *"waiting on the DM…"* (or the ruling menu, on the overseer), timer adjusted
  from `created_at`. Same recovery path as a reaction prompt; no new code.
- A ruling of `total` produces **no `attack_declared`** — replay shows the contest resolved
  to "no shot," and the turn continues. Deterministic.
- `restore` behind a contest erases the whole pair with the branch; `override` can retcon a
  past `attack_resolved`'s cover but **cannot reach behind the latest `restore`** (protocol
  §5) — use `edit` there.

## §6 · RLS / overseer-only

No schema change; no new policy. Under the existing §1 identity gate:

- `prompt {unit:<attacker>, to:"__overseer", react:"cover"}` — the attacker controls
  `<attacker>` and `prompt` is not privileged, so the insert passes. (Door (b): the overseer
  writes it; the overseer may write any unit.)
- `prompt_answered {unit:"__overseer"}` — a **player does not control `"__overseer"`**, so
  the identity gate rejects a player forging a ruling; **only the overseer** (who may write
  any unit) can answer a cover contest. The privileged-kind list is untouched — the sentinel
  `unit` alone makes the ruling overseer-only, and the MemoryBus twin (§8) tests exactly
  this rejection.

## §7 · What the highlight needs from the geometry

The overseer must be able to point at *the block being argued about*:

- `losVerdict(map,a,b)` already returns `eye:{x,y,peek}` and the graded `cover/acBonus`.
- `losRay(map,a,b,eye)` returns `{blocked, at:{c,r}}` — **the first blocking cell** along the
  winning eye's ray.
- The contest `context` carries `{ verdict, culprit: losRay(map,a,b,verdict.eye).at }`. The
  player card names it (*"¾ +5 — the boulder at G7. Contest?"*); the overseer menu highlights
  that cell on the board so the ruling is about a thing everyone can see. If `culprit` is null
  (corner-lines-only cover, no single blocker) the card says *"partial cover from the angle"*
  and no cell lights — narrated, not blank.

## §8 · Test plan (repo tradition: real functions, real field)

New known-answer smoke `forge/tests/smoke-cover-contest.js` (extract the real pipeline +
replay; MemoryBus twin for the gate), plus cases folded into `smoke-protocol.js`:

1. **Contest → ruling → declare.** Scripted log: `prompt{react:"cover"}` →
   `prompt_answered{cover:"three-quarters",acBonus:5}` → `attack_declared` carries `acBonus:5`
   → `attack_resolved` applies it. Exact expected final state.
2. **Timeout default.** No ruling within 20 s → `contestCover` resolves to the geometry
   verdict; the attack declares under the computed cover, unchanged. (Fake clock, mirror the
   prompt-timeout smoke.)
3. **`total` = no shot.** Ruling `total` → no `attack_declared`; turn continues; target
   untouched.
4. **Overseer proactive (door b)** and **past-shot re-rule via `override`** — the override
   case reuses the existing override smoke shape.
5. **Replay determinism** — same contest log twice → identical state; **refresh mid-contest**
   → state says *waiting on the DM* (proves recovery).
6. **MemoryBus gate twin:** a non-overseer publishing `prompt_answered{unit:"__overseer"}` is
   **rejected**; the overseer's identical write is **accepted**. This is the whole
   overseer-only guarantee, tested headless before any network.
7. **Culprit highlight** — known map where `losRay(map,a,b,eye).at` is a fixed cell; assert
   the contest context carries that `{c,r}`; assert the null-culprit case narrates.

## §9 · Out of scope

Per-attack cover *auto-suggestion* beyond the grid verdict; templated/AoE cover (bite 2);
saving a ruling as a reusable house rule; contesting anything other than cover (advantage,
range) — the same spine would extend, but not now. Player-side dice entry stays where
`FORGE_PROTOCOL.md` §9 left it.
