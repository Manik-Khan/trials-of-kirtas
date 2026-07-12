/* ── forge-feed-render.js ────────────────────────────────────────────────
   Bite 2 · §6.3: the shared feed-row body renderer.

   Takes a resolved fact (from the forge pipeline or the local sandbox) and
   produces body HTML matching the BG3 HUD spec §3:
     • head line: actor → target · action · VERDICT BADGE
     • d20 math line: spelled dice, kept/dropped, modifier tags
     • damage stacks: total by default, tap-expand every die
     • **NO AC EVER** (§5.19 — the target number is theirs)

   Pure & headless: no DOM, no Supabase, no three.js. Dual-export: browser
   (window.ForgeFeedRender) + node (module.exports).

   Usage:
     var html = ForgeFeedRender.rollBody(fact, ctx);
     //  fact = { actor, target, mode, roll, hitBonus, hit, crit, dmg,
     //           adv, dis, advReason, cover, coverName, mods, ... }
     //  ctx  = { unitName(key) }    [optional — name lookup]                  */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeFeedRender = api;
})(typeof self !== "undefined" ? self : this, function () {

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c] || c; }); }

  // ── VERDICT BADGES ──────────────────────────────────────────────────────
  var VERDICTS = {
    critHit:  { label: "✶ CRIT",  cls: "ffr-v ffr-v-crit" },
    hit:      { label: "HIT",     cls: "ffr-v ffr-v-hit" },
    miss:     { label: "MISS",    cls: "ffr-v ffr-v-miss" },
    fail:     { label: "FAIL",    cls: "ffr-v ffr-v-fail" },
    save:     { label: "SAVE",    cls: "ffr-v ffr-v-save" },
    fumble:   { label: "NAT 1",   cls: "ffr-v ffr-v-miss" }
  };

  function verdictBadge(fact) {
    if (fact.kind === "save" || fact.saveAbility) {
      return fact.saved ? VERDICTS.save : VERDICTS.fail;
    }
    if (fact.crit && fact.hit) return VERDICTS.critHit;
    if (fact.roll === 1 && !fact.hit) return VERDICTS.fumble;
    if (fact.hit) return VERDICTS.hit;
    return VERDICTS.miss;
  }

  // ── MODIFIER TAGS ───────────────────────────────────────────────────────
  /* Spec §3: ⇑ adv·reason, ⇓ dis, cover word, 🙏 ✦, silvery-barbs.
     Each tag is a small inline badge in the math line.                      */
  function modTags(fact) {
    var tags = [];
    if (fact.adv) {
      var reason = fact.advReason || "";
      tags.push('<span class="ffr-mod ffr-mod-adv">\u21d1 adv' + (reason ? "\u00b7" + esc(reason) : "") + "</span>");
    }
    if (fact.dis) {
      tags.push('<span class="ffr-mod ffr-mod-dis">\u21d3 dis</span>');
    }
    if (fact.coverName) {
      tags.push('<span class="ffr-mod ffr-mod-cover">' + esc(fact.coverName) + "</span>");
    }
    // Payload mods: bless d4, guidance d4, etc.
    (fact.mods || []).forEach(function (m) {
      if (m.k === "bless") {
        tags.push('<span class="ffr-mod ffr-mod-bless">\ud83d\ude4f +' + m.v + "</span>");
      } else if (m.k === "guidance") {
        tags.push('<span class="ffr-mod ffr-mod-bless">\u2726 +' + m.v + "</span>");
      } else if (m.k === "silvery_barbs" || m.k === "silveryBarbs") {
        tags.push('<span class="ffr-mod ffr-mod-sb">silvery barbs</span>');
      } else {
        tags.push('<span class="ffr-mod">' + esc(m.k) + (m.v != null ? " " + m.v : "") + "</span>");
      }
    });
    return tags.join(" ");
  }

  // ── d20 MATH LINE ───────────────────────────────────────────────────────
  /* Spelled dice: show the kept roll, and the dropped one struck-through
     when advantage/disadvantage applied.                                    */
  function d20MathLine(fact) {
    var parts = [];
    var kept = fact.roll != null ? fact.roll : "?";
    var dropped = fact.dropped != null ? fact.dropped : null;

    // Dice display: [kept] and optionally [dropped] struck-through
    if (dropped != null) {
      parts.push('<span class="ffr-die">' + kept + "</span>");
      parts.push('<span class="ffr-die ffr-drop">' + dropped + "</span>");
    } else {
      parts.push('<span class="ffr-die">' + kept + "</span>");
    }

    // + hit bonus
    if (fact.hitBonus != null) {
      var hb = fact.hitBonus;
      parts.push('<span class="ffr-mod-num">' + (hb >= 0 ? "+" + hb : String(hb)) + "</span>");
    }

    // = total (only for attack rolls where we can compute it)
    if (fact.roll != null && fact.hitBonus != null) {
      var total = fact.roll + fact.hitBonus;
      parts.push('<span class="ffr-total">= ' + total + "</span>");
    }

    // Modifier tags
    var tags = modTags(fact);
    if (tags) parts.push(tags);

    return '<div class="ffr-math">' + parts.join(" ") + "</div>";
  }

  // ── DAMAGE STACK ────────────────────────────────────────────────────────
  /* Multi-die damage stacks show the total by default with press/tap to
     expand every die (press, not hover-only — touch).
     The `dmgParts` array carries per-component breakdowns:
       [{ rolls:[3,5,2], bonus:4, type:"Slashing", total:14 }, ...]
     Without dmgParts, we show the flat `dmg` total.                        */
  function dmgStackHtml(fact) {
    if (!fact.hit && !fact.saved === false) return ""; // miss / save → no damage
    if (fact.dmg == null && !fact.dmgParts) return "";

    var total = fact.dmg != null ? fact.dmg : 0;
    if (fact.dmgParts && fact.dmgParts.length) {
      // Sum if total not pre-computed
      if (fact.dmg == null) {
        total = 0;
        fact.dmgParts.forEach(function (p) { total += (p.total || 0); });
      }
    }

    var parts = [];
    parts.push('<div class="ffr-dmg-wrap">');

    // Total line (always visible)
    var critTag = fact.crit ? '<span class="ffr-crit-tag">\u2736</span> ' : "";
    parts.push('<span class="ffr-dmg-total">' + critTag + total + " dmg</span>");

    // Expandable per-component breakdown
    if (fact.dmgParts && fact.dmgParts.length) {
      parts.push('<div class="ffr-dmg-detail">');
      fact.dmgParts.forEach(function (p) {
        var rolls = (p.rolls || []).map(function (r) {
          return "[" + r + "]";
        }).join("");
        var bonusStr = p.bonus ? (p.bonus >= 0 ? " +" + p.bonus : " " + p.bonus) : "";
        var typeStr = p.type ? ' <span class="ffr-dmg-type">' + esc(p.type) + "</span>" : "";
        parts.push('<div class="ffr-dmg-line">' + rolls + bonusStr +
          " = " + (p.total || 0) + typeStr + "</div>");
      });
      parts.push("</div>");
    }

    parts.push("</div>");
    return parts.join("");
  }

  // ── HEAD LINE ───────────────────────────────────────────────────────────
  /* actor → target · action · VERDICT BADGE                                */
  function headLine(fact, ctx) {
    ctx = ctx || {};
    var nameOf = ctx.unitName || function (k) { return k || "?"; };

    var actor = esc(nameOf(fact.actor || fact.unit));
    var target = fact.target ? esc(nameOf(fact.target)) : null;
    var mode = fact.mode || fact.ability || fact.label || "Attack";
    var v = verdictBadge(fact);

    var line = '<span class="ffr-actor">' + actor + "</span>";
    if (target) line += ' <span class="ffr-arrow">\u2192</span> <span class="ffr-target">' + target + "</span>";
    line += ' <span class="ffr-mode">\u00b7 ' + esc(mode) + "</span>";
    line += ' <span class="' + v.cls + '">' + v.label + "</span>";

    return '<div class="ffr-head">' + line + "</div>";
  }

  // ── SAVE LINE ───────────────────────────────────────────────────────────
  /* Saves show the DC — the caster's own number (§3). */
  function saveLine(fact) {
    if (!fact.saveAbility && !fact.dc) return "";
    var parts = [];
    if (fact.saveAbility) parts.push(fact.saveAbility.toUpperCase() + " save");
    if (fact.saveRoll != null) parts.push(String(fact.saveRoll));
    if (fact.dc != null) parts.push("vs DC " + fact.dc);
    return '<div class="ffr-save">' + esc(parts.join(" ")) + "</div>";
  }

  // ── HEAL / ABILITY LINE ─────────────────────────────────────────────────
  function healLine(fact, ctx) {
    ctx = ctx || {};
    var nameOf = ctx.unitName || function (k) { return k || "?"; };
    if (fact.heal == null) return "";
    var target = fact.target ? esc(nameOf(fact.target)) : "";
    return '<div class="ffr-heal">+' + fact.heal + " hp" + (target ? " \u2192 " + target : "") + "</div>";
  }

  // ── FULL ROLL BODY ──────────────────────────────────────────────────────
  /* The main entry point: produces the full body HTML for one resolved fact.
     Used by both the feed-panel insert and any local fallback paint.        */
  function rollBody(fact, ctx) {
    if (!fact) return "";

    var parts = [];

    // 1. Head line: actor → target · action · verdict
    parts.push(headLine(fact, ctx));

    // 2. d20 math line (attacks and saves)
    if (fact.roll != null) {
      parts.push(d20MathLine(fact));
    }

    // 3. Save line (saves show the DC)
    if (fact.saveAbility || fact.dc) {
      parts.push(saveLine(fact));
    }

    // 4. Damage stack (attacks and saves that deal damage)
    if (fact.hit || (fact.saved === false)) {
      parts.push(dmgStackHtml(fact));
    }

    // 5. Heal line
    if (fact.heal != null) {
      parts.push(healLine(fact, ctx));
    }

    // 6. Narration (ability_used, buff, etc.)
    if (fact.narration) {
      parts.push('<div class="ffr-narration">' + esc(fact.narration) + "</div>");
    }

    return '<div class="ffr-row">' + parts.join("") + "</div>";
  }

  // ── ABILITY BODY (non-roll) ─────────────────────────────────────────────
  function abilityBody(fact, ctx) {
    if (!fact) return "";
    ctx = ctx || {};
    var nameOf = ctx.unitName || function (k) { return k || "?"; };

    var actor = esc(nameOf(fact.actor || fact.unit));
    var parts = [];
    parts.push('<div class="ffr-head"><span class="ffr-actor">' + actor + "</span>");
    if (fact.ability) parts.push(' <span class="ffr-mode">\u00b7 ' + esc(fact.ability) + "</span>");
    parts.push("</div>");

    // Effects narration
    (fact.effects || []).forEach(function (e) {
      if (e.dmg) parts.push('<div class="ffr-dmg-total">' + e.dmg + " dmg \u2192 " + esc(nameOf(e.unit)) + "</div>");
      if (e.heal) parts.push('<div class="ffr-heal">+' + e.heal + " hp \u2192 " + esc(nameOf(e.unit)) + "</div>");
    });

    if (fact.narration) {
      parts.push('<div class="ffr-narration">' + esc(fact.narration) + "</div>");
    }

    return '<div class="ffr-row">' + parts.join("") + "</div>";
  }

  // ── CSS (the renderer owns its own styles) ──────────────────────────────
  var CSS = [
    ".ffr-row { font-size:13px; line-height:1.4; color:var(--tk-ink,#d4cdb8); }",
    ".ffr-head { font-weight:600; margin-bottom:2px; }",
    ".ffr-actor { color:var(--tk-gold,#c5a855); }",
    ".ffr-target { color:var(--tk-ink-2,#a89f8a); }",
    ".ffr-arrow { color:var(--tk-ink-2,#a89f8a); opacity:.7; }",
    ".ffr-mode { color:var(--tk-ink-2,#a89f8a); font-weight:400; }",
    // verdict badges
    ".ffr-v { display:inline-block; padding:1px 6px; border-radius:3px; font-size:11px; font-weight:700; letter-spacing:.5px; vertical-align:middle; margin-left:4px; }",
    ".ffr-v-hit  { background:#2a6a35; color:#b0e8b0; }",
    ".ffr-v-crit { background:#7a5a10; color:#ffe680; }",
    ".ffr-v-miss { background:#6a2a2a; color:#e8b0b0; }",
    ".ffr-v-fail { background:#6a2a2a; color:#e8b0b0; }",
    ".ffr-v-save { background:#2a4a6a; color:#b0d0e8; }",
    // math line
    ".ffr-math { margin:2px 0; font-family:'Fira Mono','Consolas',monospace; font-size:12px; }",
    ".ffr-die { display:inline-block; background:rgba(200,190,160,.15); padding:0 4px; border-radius:2px; font-weight:700; }",
    ".ffr-drop { text-decoration:line-through; opacity:.45; font-weight:400; }",
    ".ffr-mod-num { opacity:.75; }",
    ".ffr-total { font-weight:700; }",
    // modifier tags
    ".ffr-mod { display:inline-block; padding:0 4px; border-radius:2px; font-size:10px; vertical-align:middle; margin-left:3px; }",
    ".ffr-mod-adv { background:rgba(80,160,80,.25); color:#8ad88a; }",
    ".ffr-mod-dis { background:rgba(160,80,80,.25); color:#d88a8a; }",
    ".ffr-mod-cover { background:rgba(100,100,160,.25); color:#a0a0d0; }",
    ".ffr-mod-bless { background:rgba(180,160,80,.25); color:#d8c860; }",
    ".ffr-mod-sb { background:rgba(120,100,180,.25); color:#b0a0e0; }",
    // damage
    ".ffr-dmg-wrap { margin:3px 0; }",
    ".ffr-dmg-total { font-weight:700; color:var(--tk-blood,#c04040); font-size:14px; cursor:pointer; }",
    ".ffr-dmg-detail { display:none; margin:2px 0 2px 8px; font-family:'Fira Mono','Consolas',monospace; font-size:11px; opacity:.8; }",
    ".ffr-dmg-wrap.expanded .ffr-dmg-detail { display:block; }",
    ".ffr-dmg-line { margin:1px 0; }",
    ".ffr-dmg-type { opacity:.6; font-style:italic; }",
    ".ffr-crit-tag { color:#ffe680; }",
    // save
    ".ffr-save { font-size:12px; opacity:.8; margin:2px 0; }",
    // heal
    ".ffr-heal { font-weight:700; color:#5aaa6a; font-size:14px; margin:2px 0; }",
    // narration
    ".ffr-narration { font-style:italic; opacity:.7; margin:2px 0; }"
  ].join("\n");

  // ── VALIDATION ──────────────────────────────────────────────────────────
  /* Confirm no "AC" substring anywhere in the output (§5.19). */
  function assertNoAC(html) {
    // AC inside a word like "Mace" or "Place" is fine; standalone "AC" is the check
    return !/\bAC\b/.test(html);
  }

  // ── public API ──────────────────────────────────────────────────────────
  return {
    rollBody:     rollBody,
    abilityBody:  abilityBody,
    headLine:     headLine,
    d20MathLine:  d20MathLine,
    dmgStackHtml: dmgStackHtml,
    saveLine:     saveLine,
    healLine:     healLine,
    verdictBadge: verdictBadge,
    modTags:      modTags,
    assertNoAC:   assertNoAC,
    CSS:          CSS,
    VERDICTS:     VERDICTS
  };
});
