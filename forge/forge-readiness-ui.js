/* forge-readiness-ui.js — fail-safe presentation for CharacterReadiness.
 * The normal path stays quiet. Review/manual/blocked characters receive a
 * compact badge and an explainable repair sheet.
 * Dual-export: window.ForgeReadinessUI / module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeReadinessUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "1.0.0";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function badge(report) {
    if (!report) return { tone: "unknown", label: "CHECKING", title: "Readiness is still compiling." };
    if (report.status === "ready") return { tone: "ready", label: "READY", title: "Sheet and Forge agree." };
    if (report.status === "manual") return { tone: "manual", label: "MANUAL " + report.counts.manual, title: "Playable with explicit manual rules." };
    if (report.status === "review") return { tone: "review", label: "REVIEW", title: "Playable; review the onboarding note." };
    return { tone: "blocked", label: "NEEDS REPAIR", title: report.counts.blockers + " onboarding issue" + (report.counts.blockers === 1 ? "" : "s") + "." };
  }
  function findingHtml(row) {
    return '<li class="fruFinding fru-' + esc(row.severity) + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></li>';
  }
  function choiceHtml(row) {
    var data = row.data || {}, options = data.options || [];
    if (!options.length) return "";
    return '<label class="fruChoice"><span>' + esc(row.title) + '</span><select data-fru-choice="' + esc(data.index) + '">' +
      '<option value="">Choose exact item\u2026</option>' +
      options.map(function (name) { return '<option value="' + esc(name) + '">' + esc(name) + '</option>'; }).join("") +
      '</select><button type="button" data-fru-save-choice="' + esc(data.index) + '">Save choice</button></label>';
  }
  function section(title, rows) {
    if (!rows || !rows.length) return "";
    return '<section class="fruSection"><h3>' + esc(title) + '</h3><ul>' + rows.map(findingHtml).join("") + '</ul></section>';
  }
  function sheetHtml(character, report) {
    var b = badge(report), choices = (report.blockers || []).filter(function (row) {
      return row.kind === "choice" && row.data && row.data.options && row.data.options.length;
    });
    var missing = report.counts && report.counts.missingGrants;
    return '<div class="fruBackdrop" data-fru-close></div><article class="fruSheet" role="dialog" aria-modal="true" aria-labelledby="fruTitle">' +
      '<button class="fruClose" type="button" data-fru-close aria-label="Close">\u00d7</button>' +
      '<div class="fruKicker">CHARACTER ONBOARDING \u00b7 ' + esc(b.label) + '</div>' +
      '<h2 id="fruTitle">' + esc(report.name) + '</h2>' +
      '<p class="fruLead">' + (report.status === "ready"
        ? "The saved sheet and compiled Forge kit agree."
        : report.status === "blocked"
          ? "The Forge caught information that did not complete onboarding. Fix the items below, then it recompiles automatically."
          : "This character may enter combat. The listed rules remain visible for manual handling until their automation is built.") + '</p>' +
      section("Must be fixed", report.blockers) +
      choices.map(choiceHtml).join("") +
      section("Manual at the table", report.manual) +
      section("Review notes", report.warnings) +
      '<div class="fruActions">' +
        (missing ? '<button type="button" data-fru-restore>Restore missing grants</button>' : '') +
        '<a href="../shards.html?reforge=' + encodeURIComponent(character.key || "") + '&amp;readiness=1">Open Shard Reforger</a>' +
      '</div><div class="fruStatus" data-fru-status></div></article>';
  }
  function installStyle(doc) {
    if (doc.getElementById("forgeReadinessCss")) return;
    var style = doc.createElement("style");
    style.id = "forgeReadinessCss";
    style.textContent = [
      ".fruRoot{position:fixed;inset:0;z-index:2400;display:grid;place-items:center}.fruRoot[hidden]{display:none}",
      ".fruBackdrop{position:absolute;inset:0;background:rgba(7,5,3,.82);backdrop-filter:blur(5px)}",
      ".fruSheet{position:relative;width:min(720px,calc(100vw - 30px));max-height:calc(100vh - 34px);overflow:auto;padding:28px;background:#17120d;color:#f0e6ce;border:1px solid rgba(184,149,42,.55);box-shadow:0 24px 80px #000}",
      ".fruKicker,.fruSheet h3,.fruChoice span{font:700 11px 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#b8952a}",
      ".fruSheet h2{margin:5px 0 8px;font:700 29px 'Cinzel',serif}.fruLead{margin:0 0 20px;color:#b9ad94;line-height:1.45}",
      ".fruClose{position:absolute;right:12px;top:8px;border:0;background:transparent;color:#9a8f78;font-size:30px;cursor:pointer}",
      ".fruSection{margin:18px 0}.fruSection h3{margin:0 0 7px}.fruSection ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}",
      ".fruFinding{padding:10px 12px;border-left:3px solid #8a2222;background:rgba(255,255,255,.035)}.fruFinding b,.fruFinding span{display:block}.fruFinding span{margin-top:3px;color:#b9ad94;line-height:1.4}.fru-manual{border-left-color:#b8952a}.fru-review,.fru-warning{border-left-color:#766a56}",
      ".fruChoice{display:grid;grid-template-columns:1fr minmax(180px,1fr) auto;gap:8px;align-items:center;margin:9px 0;padding:10px 12px;background:rgba(184,149,42,.08)}",
      ".fruChoice select,.fruChoice button,.fruActions button,.fruActions a{font:700 13px 'Barlow Condensed',sans-serif;letter-spacing:.07em;padding:9px 11px;border:1px solid rgba(184,149,42,.55);background:#0d0a07;color:#f0e6ce;text-decoration:none;cursor:pointer}",
      ".fruActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.fruStatus{min-height:1.2em;margin-top:10px;color:#b8952a}",
      ".fruBadge{position:absolute;left:12px;top:50px;z-index:4;padding:4px 7px;border:1px solid rgba(184,149,42,.5);background:rgba(13,10,7,.88);font:700 10px 'Barlow Condensed',sans-serif;letter-spacing:.12em;color:#b8952a;cursor:pointer}.fruBadge.ready{color:#86b997;border-color:#477a58}.fruBadge.blocked{color:#e17b6f;border-color:#8a2222}",
      "@media(max-width:620px){.fruChoice{grid-template-columns:1fr}.fruSheet{padding:24px 18px}}"
    ].join("");
    doc.head.appendChild(style);
  }
  function controller(options) {
    options = options || {};
    var doc = options.document || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;
    installStyle(doc);
    var root = doc.getElementById("forgeReadinessRoot");
    if (!root) {
      root = doc.createElement("div");
      root.id = "forgeReadinessRoot";
      root.className = "fruRoot";
      root.hidden = true;
      doc.body.appendChild(root);
    }
    var currentCharacter = null, currentReport = null;
    function close() { root.hidden = true; root.innerHTML = ""; }
    function status(message) {
      var el = root.querySelector("[data-fru-status]");
      if (el) el.textContent = message || "";
    }
    function show(character, report) {
      currentCharacter = character; currentReport = report;
      root.innerHTML = sheetHtml(character || {}, report || {});
      root.hidden = false;
      root.querySelectorAll("[data-fru-close]").forEach(function (el) { el.addEventListener("click", close); });
      var restore = root.querySelector("[data-fru-restore]");
      if (restore) restore.addEventListener("click", function () {
        status("Restoring saved grants\u2026");
        Promise.resolve(options.onRestore && options.onRestore(currentCharacter, currentReport)).then(close).catch(function (err) {
          status((err && err.message) || "The grants could not be restored.");
        });
      });
      root.querySelectorAll("[data-fru-save-choice]").forEach(function (button) {
        button.addEventListener("click", function () {
          var index = button.getAttribute("data-fru-save-choice");
          var select = root.querySelector('[data-fru-choice="' + index + '"]');
          if (!select || !select.value) { status("Choose an exact weapon first."); return; }
          status("Saving equipment choice\u2026");
          Promise.resolve(options.onEquipment && options.onEquipment(currentCharacter, Number(index), select.value)).then(close).catch(function (err) {
            status((err && err.message) || "The equipment choice could not be saved.");
          });
        });
      });
    }
    return { show: show, close: close, root: root };
  }

  return Object.freeze({ VERSION: VERSION, badge: badge, sheetHtml: sheetHtml, controller: controller });
});
