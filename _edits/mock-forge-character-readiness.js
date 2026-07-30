/* mock-forge-character-readiness.js
   Interaction shell for the standalone Forge character-readiness approval mock. */
(function () {
  "use strict";

  var api = window.MockForgeCharacterReadiness;
  if (!api) {
    document.body.innerHTML = "<p style='padding:24px;color:#f2b8a8'>Character readiness core did not load.</p>";
    return;
  }

  var groupLabels = {
    attacks: "Attacks",
    bonus: "Actions",
    reactions: "Reactions",
    passives: "Passives",
    manual: "Manual",
    locked: "Locked"
  };
  var state = {
    selected: "chonkalius",
    filter: "all",
    previewGroup: "attacks",
    selectedCapability: null,
    records: api.copy(api.FIXTURES),
    toastTimer: null
  };

  function el(id) {
    return document.getElementById(id);
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function selectedRecord() {
    return state.records[state.selected];
  }
  function selectedAudit() {
    return api.audit(selectedRecord());
  }
  function statusCopy(audit) {
    if (audit.status === "ready") {
      return "The saved sheet, exact choices, and playable Forge capabilities agree. This character may enter the table.";
    }
    if (audit.status === "blocked") {
      return "Core character authority is incomplete. The Forge keeps this character visible, explains the failure, and prevents a broken combat snapshot.";
    }
    return "The character is recognized, but the Forge would omit or misrepresent part of their actual kit. Resolve every narrated gap before entry.";
  }
  function showToast(message) {
    var toast = el("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3000);
  }
  function setClass(base, status) {
    return base + " " + status;
  }

  function renderRoster() {
    var cards = Object.keys(state.records).map(function (key) {
      var record = state.records[key];
      var audit = api.audit(record);
      if (state.filter === "attention" && audit.status === "ready") return "";
      return [
        '<button type="button" class="actor-card', key === state.selected ? " is-active" : "", '" data-actor="', escapeHtml(key), '">',
        '<span class="actor-avatar">', escapeHtml(record.badge), "</span>",
        '<span class="actor-copy"><strong>', escapeHtml(record.name), "</strong><small>", escapeHtml(record.classLine), "</small></span>",
        '<span class="actor-state ', escapeHtml(audit.status), '" aria-label="', escapeHtml(audit.statusLabel), '"></span>',
        "</button>"
      ].join("");
    }).join("");
    el("actors").innerHTML = cards || '<div class="empty-state">No characters match this filter.</div>';
    el("actors").querySelectorAll("[data-actor]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selected = button.getAttribute("data-actor");
        state.selectedCapability = null;
        state.previewGroup = "attacks";
        render();
      });
    });
  }

  function renderHeader(audit) {
    var record = selectedRecord();
    el("actorBadge").textContent = record.badge;
    el("actorName").textContent = record.name;
    el("actorLine").textContent = record.classLine;
    el("readinessBadge").className = setClass("status-pill", audit.status);
    el("readinessBadge").textContent = audit.statusLabel;
    el("readinessBanner").className = setClass("readiness-banner", audit.status);
    el("readinessTitle").textContent = audit.status === "ready"
      ? "The character contract is complete"
      : audit.status === "blocked"
        ? "Core sheet data must be completed"
        : "Review required before the table";
    el("readinessCopy").textContent = statusCopy(audit);
    el("tableDoor").disabled = !audit.canEnterTable;
    el("tableDoor").textContent = audit.canEnterTable ? "Continue to Table" : "Table locked";
  }

  function renderMetrics(audit) {
    var metrics = [
      [audit.counts.sourceMissing, "Missing grants"],
      [audit.counts.runtimeGaps, "Rules gaps"],
      [audit.counts.unresolvedChoices, "Open choices"],
      [audit.attacks.length, "Basic attacks"]
    ];
    el("metrics").innerHTML = metrics.map(function (metric) {
      return '<div class="metric"><strong>' + escapeHtml(metric[0]) + '</strong><span>' + escapeHtml(metric[1]) + "</span></div>";
    }).join("");
  }

  function renderSourceChecks(audit) {
    el("sourceChecks").innerHTML = audit.sourceChecks.map(function (check) {
      var mark = check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×";
      return [
        '<div class="source-check ', escapeHtml(check.status), '">',
        '<span class="check-mark">', mark, "</span>",
        "<div><strong>", escapeHtml(check.label), "</strong><small>", escapeHtml(check.detail), "</small></div>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderCoverage(audit) {
    if (!audit.expectedRows.length) {
      el("coverage").innerHTML = '<div class="empty-state">No expected feature manifest exists yet. A class, subclass, species, and feat selection must generate this list.</div>';
      return;
    }
    el("coverage").innerHTML = audit.expectedRows.map(function (row) {
      var sheetStatus = row.sourcePresent ? "pass" : "fail";
      var forgeLabel = row.runtimeStatus === "executable" ? "Live" :
        row.runtimeStatus === "manual" ? "Manual" :
          row.runtimeStatus === "reference" ? "Reference" :
            row.runtimeStatus === "held" ? "Held" : "Missing";
      return [
        '<button type="button" class="coverage-row', state.selectedCapability === row.id ? " is-selected" : "", '" data-capability="', escapeHtml(row.id), '">',
        '<span class="coverage-label"><strong>', escapeHtml(row.label), '</strong><small class="origin-', escapeHtml(row.group.toLowerCase()), '">', escapeHtml(row.group), " · ", escapeHtml(row.expectedAt || "Expected grant"), "</small></span>",
        '<span class="row-status ', sheetStatus, '">', row.sourcePresent ? "Present" : "Absent", "</span>",
        '<span class="tiny-status ', escapeHtml(row.runtimeStatus), '">', escapeHtml(forgeLabel), "</span>",
        "</button>"
      ].join("");
    }).join("");
    el("coverage").querySelectorAll("[data-capability]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedCapability = button.getAttribute("data-capability");
        renderPreview(audit);
        renderCoverage(audit);
      });
    });
  }

  function renderPreview(audit) {
    var groups = api.preview(selectedRecord());
    if (!groups[state.previewGroup]) state.previewGroup = "attacks";
    el("previewTabs").innerHTML = Object.keys(groupLabels).map(function (key) {
      return [
        '<button type="button" class="preview-tab', state.previewGroup === key ? " is-active" : "", '" data-preview="', key, '" role="tab">',
        groupLabels[key], " ", groups[key].length,
        "</button>"
      ].join("");
    }).join("");
    el("previewTabs").querySelectorAll("[data-preview]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.previewGroup = button.getAttribute("data-preview");
        state.selectedCapability = null;
        renderPreview(selectedAudit());
      });
    });

    if (state.selectedCapability) {
      var row = audit.expectedRows.filter(function (item) { return item.id === state.selectedCapability; })[0];
      if (row) {
        var detail = row.capability && row.capability.reason
          ? row.capability.reason
          : row.note || (row.runtimeStatus === "executable" ? "This feature has an explicit playable Forge owner." : "This grant has an explicit onboarding disposition.");
        el("previewList").innerHTML = [
          '<div class="capability-detail"><strong>', escapeHtml(row.label), "</strong>",
          escapeHtml(detail), "<br><br>Sheet: ", row.sourcePresent ? "present" : "absent",
          " · Forge: ", escapeHtml(row.runtimeStatus), "</div>"
        ].join("");
        return;
      }
    }

    var rows = groups[state.previewGroup];
    el("previewList").innerHTML = rows.length ? rows.map(function (row) {
      return [
        '<div class="preview-card tone-', escapeHtml(row.tone), '">',
        "<strong>", escapeHtml(row.label), "</strong>",
        "<small>", escapeHtml(row.detail || row.status), "</small>",
        "</div>"
      ].join("");
    }).join("") : '<div class="empty-state">Nothing appears in this Forge group for the current contract.</div>';
  }

  function renderAttention(audit) {
    var findings = audit.blockers.concat(audit.warnings);
    el("attentionList").innerHTML = findings.length ? findings.map(function (row) {
      return [
        '<div class="attention-card ', escapeHtml(row.severity), '">',
        '<div class="attention-kind">', escapeHtml(row.kind), "</div>",
        "<strong>", escapeHtml(row.title), "</strong>",
        "<small>", escapeHtml(row.detail), "</small>",
        "</div>"
      ].join("");
    }).join("") : '<div class="empty-state">No hidden gaps. The table door is now justified by the same contract the player reviewed.</div>';
  }

  function renderResolutions() {
    var record = selectedRecord();
    var applied = record.appliedResolutions || [];
    if (!record.resolutions || !record.resolutions.length) {
      el("resolutionList").innerHTML = '<div class="empty-state">No approval package is authored for this example. Its open item demonstrates how an existing character remains reviewable rather than silently “supported.”</div>';
      return;
    }
    el("resolutionList").innerHTML = record.resolutions.map(function (resolution) {
      var isApplied = applied.indexOf(resolution.id) >= 0;
      return [
        '<div class="resolution-card', isApplied ? " is-applied" : "", '">',
        "<strong>", escapeHtml(resolution.label), "</strong>",
        "<small>", escapeHtml(resolution.summary), "</small>",
        '<button type="button" data-resolution="', escapeHtml(resolution.id), '"', isApplied ? " disabled" : "", ">",
        isApplied ? "Applied" : "Apply",
        "</button></div>"
      ].join("");
    }).join("");
    el("resolutionList").querySelectorAll("[data-resolution]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-resolution");
        state.records[state.selected] = api.applyResolution(selectedRecord(), id);
        state.selectedCapability = null;
        render();
      });
    });
  }

  function renderButtons(audit) {
    var record = selectedRecord();
    var resolutions = record.resolutions || [];
    var applied = record.appliedResolutions || [];
    el("applyAll").disabled = !resolutions.length || applied.length === resolutions.length;
    el("applyAll").textContent = audit.status === "ready" ? "Target contract proved" : "Prove approved target";
    el("resetActor").disabled = !applied.length;
  }

  function render() {
    var audit = selectedAudit();
    renderRoster();
    renderHeader(audit);
    renderMetrics(audit);
    renderSourceChecks(audit);
    renderCoverage(audit);
    renderPreview(audit);
    renderAttention(audit);
    renderResolutions();
    renderButtons(audit);
  }

  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.filter = button.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (item) {
        item.classList.toggle("is-active", item === button);
      });
      renderRoster();
    });
  });

  el("applyAll").addEventListener("click", function () {
    state.records[state.selected] = api.applyAll(selectedRecord());
    state.selectedCapability = null;
    render();
    showToast("Target contract applied in the mock only. No saved character or campaign data changed.");
  });
  el("resetActor").addEventListener("click", function () {
    state.records[state.selected] = api.copy(api.FIXTURES[state.selected]);
    state.selectedCapability = null;
    state.previewGroup = "attacks";
    render();
  });
  el("tableDoor").addEventListener("click", function () {
    if (!selectedAudit().canEnterTable) return;
    showToast("Admission proved. Production wiring waits for approval of this contract.");
  });

  window.__readinessMock = {
    audit: function () { return api.copy(selectedAudit()); },
    select: function (key) {
      if (!state.records[key]) return false;
      state.selected = key;
      state.selectedCapability = null;
      render();
      return true;
    },
    applyAll: function () {
      state.records[state.selected] = api.applyAll(selectedRecord());
      render();
      return api.copy(selectedAudit());
    },
    reset: function () {
      state.records[state.selected] = api.copy(api.FIXTURES[state.selected]);
      render();
      return api.copy(selectedAudit());
    }
  };

  render();
})();
