(function () {
  "use strict";

  var Importer = window.ForgeImageImporterProof;
  var Structure = window.ForgeImageStructureReviewProof;
  var ui = {};
  [
    "imageFile", "sourceReceipt", "scalePanel", "autoGrid", "drawGridCell", "noGrid", "gridNote",
    "griddedControls", "ungriddedControls", "gridCellPx", "gridOriginX", "gridOriginY", "targetColumns",
    "proposeRegions", "selectionPanel", "selectionReceipt", "clearSelection", "magicTolerance",
    "magicToleranceValue", "toleranceControl", "semanticPanel", "semanticTools", "semanticAppearance",
    "pendingSwatch", "pendingMeaning", "commitSelection", "startNextRegion",
    "artTitle", "viewGrid", "artView", "previewView",
    "emptyState", "canvasStack", "sourceCanvas", "overlayCanvas", "previewCanvas", "status",
    "sceneName", "metricGrid", "metricRegions", "metricSurfaces", "metricConnectors", "typeSummary",
    "authoredCount", "authoredList",
    "inspector", "regionName", "regionReceipt", "regionType", "regionLabel", "regionBase", "regionTop",
    "regionWalkable", "regionAccess", "regionSupport", "regionAppearance", "applyRegion", "regionToSelection", "heightReceipt",
    "movementNote", "surfaceReceipt", "reviewJson", "fatal"
  ].forEach(function (id) { ui[id] = document.getElementById(id); });

  var sourceContext = ui.sourceCanvas.getContext("2d", { willReadFrequently: true });
  var overlayContext = ui.overlayCanvas.getContext("2d");
  var previewContext = ui.previewCanvas.getContext("2d");
  var state = {
    file: null,
    image: null,
    originalWidth: 0,
    originalHeight: 0,
    analysisWidth: 0,
    analysisHeight: 0,
    scale: 1,
    imageData: null,
    gridMode: "auto",
    detectedGrid: null,
    analysis: null,
    review: null,
    selectionTool: "lasso",
    selectionOperation: "replace",
    semanticType: "building",
    semanticAppearance: "timber-house",
    selection: null,
    editingRegionId: null,
    selectedId: null,
    calibrating: false,
    drag: null,
    lassoPoints: null,
    view: "artwork"
  };

  function setStatus(message) {
    ui.status.textContent = message;
  }
  function setEnabled(element, enabled) {
    element.classList.toggle("disabled", !enabled);
  }
  function safeName(name) {
    return String(name || "Structure review").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  }
  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }
  function appearanceFor(type, appearanceId) {
    return Structure.appearanceFor(type, appearanceId);
  }
  function fillAppearanceOptions(select, type, selectedId) {
    select.replaceChildren();
    if (type === "ground") {
      var ground = document.createElement("option");
      ground.value = "ground"; ground.textContent = "Base ground / erase"; select.appendChild(ground);
      select.disabled = true;
      return "ground";
    }
    select.disabled = false;
    (Structure.APPEARANCES[type] || []).forEach(function (appearance) {
      var option = document.createElement("option");
      option.value = appearance.id; option.textContent = appearance.label; select.appendChild(option);
    });
    var selected = appearanceFor(type, selectedId).id;
    select.value = selected;
    return selected;
  }
  function syncPendingAppearance() {
    state.semanticAppearance = fillAppearanceOptions(ui.semanticAppearance, state.semanticType, state.semanticAppearance);
    var appearance = state.semanticType === "ground"
      ? { label: "Base ground / erase", color: "#857958" }
      : appearanceFor(state.semanticType, state.semanticAppearance);
    ui.pendingSwatch.style.background = appearance.color;
    ui.pendingMeaning.textContent = (state.semanticType === "ground" ? "Ground / erase" : Structure.TYPES[state.semanticType].label)
      + " · " + appearance.label;
  }
  function sourceGridFromInputs() {
    var scale = state.scale || 1;
    var cellPx = Math.max(4, Number(ui.gridCellPx.value) || 70) * scale;
    var originX = Math.max(0, Number(ui.gridOriginX.value) || 0) * scale;
    var originY = Math.max(0, Number(ui.gridOriginY.value) || 0) * scale;
    return {
      found: true,
      cellPx: cellPx,
      originX: originX,
      originY: originY,
      cols: Math.max(1, Math.floor((state.analysisWidth - originX) / cellPx)),
      rows: Math.max(1, Math.floor((state.analysisHeight - originY) / cellPx)),
      confidence: state.detectedGrid && state.detectedGrid.confidence || 0.72,
      evidence: state.detectedGrid && state.detectedGrid.evidence || { manualInputs: true }
    };
  }
  function activeGrid() {
    if (!state.imageData) return null;
    if (state.gridMode === "ungridded") {
      return Importer.gridFromColumns(state.analysisWidth, state.analysisHeight, Number(ui.targetColumns.value));
    }
    return sourceGridFromInputs();
  }
  function clearReview() {
    state.analysis = null;
    state.review = null;
    state.selection = null;
    state.editingRegionId = null;
    state.selectedId = null;
    setEnabled(ui.selectionPanel, false);
    setEnabled(ui.semanticPanel, false);
    setEnabled(ui.inspector, false);
    renderAll();
  }
  function syncGridControls() {
    ui.griddedControls.hidden = state.gridMode === "ungridded";
    ui.ungriddedControls.hidden = state.gridMode !== "ungridded";
    ui.autoGrid.classList.toggle("active", state.gridMode === "auto" && !state.calibrating);
    ui.drawGridCell.classList.toggle("active", state.calibrating || state.gridMode === "gridded");
    ui.drawGridCell.setAttribute("aria-pressed", String(state.calibrating));
    ui.noGrid.classList.toggle("active", state.gridMode === "ungridded");
    ui.canvasStack.classList.toggle("calibrating", state.calibrating);
    ui.canvasStack.classList.toggle("inspecting", !state.calibrating && state.selectionTool === "inspect");
    ui.canvasStack.classList.toggle("magic-selecting", !state.calibrating && state.selectionTool === "magic");
    ui.canvasStack.classList.toggle("lasso-selecting", !state.calibrating && state.selectionTool === "lasso");
    renderOverlay();
  }
  function reportDetectedGrid(grid) {
    if (!grid || !grid.found) {
      ui.gridNote.textContent = "No stable repeated grid was found. Choose No grid or draw one printed square.";
      return;
    }
    var originalCell = grid.cellPx / state.scale;
    ui.gridCellPx.value = originalCell.toFixed(1);
    ui.gridOriginX.value = (grid.originX / state.scale).toFixed(1);
    ui.gridOriginY.value = (grid.originY / state.scale).toFixed(1);
    ui.gridNote.textContent = grid.evidence && grid.evidence.manualCell
      ? "DM-drawn square: " + originalCell.toFixed(1) + " source pixels · "
        + Math.floor((state.originalWidth - grid.originX / state.scale) / originalCell) + " × "
        + Math.floor((state.originalHeight - grid.originY / state.scale) / originalCell)
      : "Auto proposal: " + originalCell.toFixed(1) + " source pixels · verify it against the printed lines.";
  }
  function inspectGrid() {
    if (!state.imageData) return;
    state.gridMode = "auto";
    state.calibrating = false;
    state.detectedGrid = Importer.detectGrid(state.imageData.data, state.analysisWidth, state.analysisHeight);
    reportDetectedGrid(state.detectedGrid);
    clearReview();
    syncGridControls();
    setStatus(state.detectedGrid.found
      ? "Auto proposed a repeated period. Draw one real square whenever the overlay drifts."
      : "Auto declined to claim a grid. Draw one real square or choose an ungridded width.");
  }
  function drawSource(image) {
    var maxDimension = 1200;
    state.scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    state.originalWidth = image.naturalWidth;
    state.originalHeight = image.naturalHeight;
    state.analysisWidth = Math.max(1, Math.round(image.naturalWidth * state.scale));
    state.analysisHeight = Math.max(1, Math.round(image.naturalHeight * state.scale));
    [ui.sourceCanvas, ui.overlayCanvas].forEach(function (canvas) {
      canvas.width = state.analysisWidth;
      canvas.height = state.analysisHeight;
    });
    sourceContext.clearRect(0, 0, state.analysisWidth, state.analysisHeight);
    sourceContext.drawImage(image, 0, 0, state.analysisWidth, state.analysisHeight);
    state.imageData = sourceContext.getImageData(0, 0, state.analysisWidth, state.analysisHeight);
    ui.emptyState.hidden = true;
    ui.canvasStack.hidden = false;
    ui.artTitle.textContent = safeName(state.file.name);
  }
  function loadFile(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setStatus("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        state.file = file;
        state.image = image;
        state.detectedGrid = null;
        state.gridMode = "auto";
        state.calibrating = false;
        drawSource(image);
        clearReview();
        setEnabled(ui.scalePanel, true);
        ui.sourceReceipt.replaceChildren();
        var title = document.createElement("strong"), detail = document.createElement("span");
        title.textContent = file.name;
        detail.textContent = image.naturalWidth + " × " + image.naturalHeight + " · local browser source";
        ui.sourceReceipt.append(title, detail);
        inspectGrid();
      };
      image.onerror = function () { setStatus("The selected image could not be decoded."); };
      image.src = reader.result;
    };
    reader.onerror = function () { setStatus("The selected image could not be read."); };
    reader.readAsDataURL(file);
  }
  function renderGrid(context, grid) {
    if (!grid) return;
    context.save();
    context.strokeStyle = "rgba(247,222,145,.58)";
    context.lineWidth = Math.max(1, Math.min(state.analysisWidth, state.analysisHeight) / 760);
    context.beginPath();
    for (var c = 0; c <= grid.cols; c++) {
      var x = grid.originX + c * grid.cellPx;
      context.moveTo(x, grid.originY);
      context.lineTo(x, grid.originY + grid.rows * grid.cellPx);
    }
    for (var r = 0; r <= grid.rows; r++) {
      var y = grid.originY + r * grid.cellPx;
      context.moveTo(grid.originX, y);
      context.lineTo(grid.originX + grid.cols * grid.cellPx, y);
    }
    context.stroke();
    context.restore();
  }
  function traceFootprint(context, footprint) {
    if (!footprint) return;
    if (footprint.kind === "polygon" && footprint.points && footprint.points.length > 2) {
      context.beginPath();
      context.moveTo(footprint.points[0][0], footprint.points[0][1]);
      footprint.points.slice(1).forEach(function (point) { context.lineTo(point[0], point[1]); });
      context.closePath(); context.stroke();
      return;
    }
    if (footprint.kind === "composite") {
      footprint.parts.forEach(function (part) { traceFootprint(context, part.footprint); });
    }
    if (footprint.kind === "magic-within") traceFootprint(context, footprint.fence);
  }
  function overlayLabel(context, cells, grid, label, color) {
    if (!cells || !cells.length) return;
    var total = cells.reduce(function (sum, cell) { return { c: sum.c + cell[0], r: sum.r + cell[1] }; }, { c: 0, r: 0 });
    var c = total.c / cells.length, r = total.r / cells.length;
    var x = grid.originX + (c + 0.5) * grid.cellPx, y = grid.originY + (r + 0.5) * grid.cellPx;
    var fontSize = Math.max(8, Math.min(18, grid.cellPx * 0.48));
    context.font = "700 " + fontSize + "px ui-sans-serif";
    var text = String(label || "REGION").toUpperCase(), width = context.measureText(text).width + 10;
    context.fillStyle = "rgba(9,13,11,.82)"; context.fillRect(x - width / 2, y - fontSize, width, fontSize + 6);
    context.fillStyle = color; context.textAlign = "center"; context.fillText(text, x, y + 2);
  }
  function renderOverlay() {
    overlayContext.clearRect(0, 0, state.analysisWidth, state.analysisHeight);
    var grid = state.review && state.review.grid || activeGrid();
    if (state.review) {
      state.review.regions.forEach(function (region) {
        var color = appearanceFor(region.type, region.appearance).color;
        overlayContext.save();
        overlayContext.fillStyle = color + (region.source === "dm-authored" ? "c8" : "58");
        region.cells.forEach(function (cell) {
          overlayContext.fillRect(
            grid.originX + cell[0] * grid.cellPx,
            grid.originY + cell[1] * grid.cellPx,
            grid.cellPx + 0.4, grid.cellPx + 0.4
          );
        });
        if (region.id === state.selectedId) {
          overlayContext.strokeStyle = "#fff0a8";
          overlayContext.lineWidth = Math.max(2, grid.cellPx * 0.08);
          region.cells.forEach(function (cell) {
            overlayContext.strokeRect(
              grid.originX + cell[0] * grid.cellPx,
              grid.originY + cell[1] * grid.cellPx,
              grid.cellPx, grid.cellPx
            );
          });
        }
        if (region.source === "dm-authored" && region.cells.length >= 2) {
          overlayLabel(overlayContext, region.cells, grid, Structure.TYPES[region.type].label, "#fff3bd");
        }
        overlayContext.restore();
      });
    }
    if (state.selection && state.selection.cells.length) {
      var pendingAppearance = state.semanticType === "ground"
        ? { color: "#857958", label: "Ground / erase" }
        : appearanceFor(state.semanticType, state.semanticAppearance);
      overlayContext.save();
      overlayContext.fillStyle = pendingAppearance.color + "b8";
      overlayContext.strokeStyle = "#fff3bd";
      overlayContext.lineWidth = Math.max(1.5, grid.cellPx * 0.06);
      state.selection.cells.forEach(function (cell) {
        overlayContext.fillRect(grid.originX + cell[0] * grid.cellPx, grid.originY + cell[1] * grid.cellPx, grid.cellPx, grid.cellPx);
      });
      traceFootprint(overlayContext, state.selection.footprint);
      overlayLabel(overlayContext, state.selection.cells, grid,
        (state.editingRegionId ? "EDIT " : "NEW ") + (state.semanticType === "ground" ? "GROUND" : Structure.TYPES[state.semanticType].label),
        "#fff3bd");
      overlayContext.restore();
    }
    renderGrid(overlayContext, grid);
    if (state.lassoPoints && state.lassoPoints.length) {
      overlayContext.save(); overlayContext.beginPath();
      overlayContext.moveTo(state.lassoPoints[0][0], state.lassoPoints[0][1]);
      state.lassoPoints.slice(1).forEach(function (point) { overlayContext.lineTo(point[0], point[1]); });
      overlayContext.strokeStyle = "#fff0a8"; overlayContext.lineWidth = Math.max(2, grid.cellPx * 0.08);
      overlayContext.setLineDash([8, 5]); overlayContext.stroke(); overlayContext.restore();
    }
    if (state.drag && state.calibrating) {
      var left = Math.min(state.drag.startX, state.drag.endX);
      var top = Math.min(state.drag.startY, state.drag.endY);
      var width = Math.abs(state.drag.endX - state.drag.startX);
      var height = Math.abs(state.drag.endY - state.drag.startY);
      overlayContext.save();
      overlayContext.fillStyle = "rgba(212,180,95,.16)";
      overlayContext.strokeStyle = "#fff0a8";
      overlayContext.lineWidth = Math.max(2, Math.min(state.analysisWidth, state.analysisHeight) / 360);
      overlayContext.setLineDash([8, 5]);
      overlayContext.fillRect(left, top, width, height);
      overlayContext.strokeRect(left, top, width, height);
      overlayContext.restore();
    }
  }
  function propose() {
    if (!state.imageData) return;
    var grid = activeGrid();
    if (!grid || grid.cols * grid.rows > 6500) {
      setStatus("That grid creates too many squares. Increase cell size or reduce the ungridded width.");
      return;
    }
    setStatus("Finding broad water, vegetation, and constructed-area evidence…");
    state.analysis = Importer.analyze(state.imageData.data, state.analysisWidth, state.analysisHeight, grid);
    state.review = Structure.proposeRegions(state.analysis, { minimumCells: 3 });
    state.selectedId = state.review.regions[0] && state.review.regions[0].id || null;
    state.selection = null;
    setEnabled(ui.selectionPanel, true);
    setEnabled(ui.semanticPanel, true);
    setEnabled(ui.inspector, !!state.selectedId);
    state.selectionTool = "lasso";
    document.querySelectorAll("[data-selection-tool]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.selectionTool === "lasso");
    });
    ui.toleranceControl.hidden = true;
    syncPendingAppearance();
    renderAll();
    setStatus(state.gridMode === "auto"
      ? "Broad areas proposed on Auto scale. If the printed grid drifts, draw one real square before trusting coverage."
      : "Broad hints proposed. Lasso one structure, choose its kind and appearance, then save it.");
  }
  function canvasPoint(event) {
    var rect = ui.overlayCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * ui.overlayCanvas.width / rect.width,
      y: (event.clientY - rect.top) * ui.overlayCanvas.height / rect.height
    };
  }
  function cellAtPoint(point) {
    var grid = state.review && state.review.grid || activeGrid();
    if (!grid) return null;
    var c = Math.floor((point.x - grid.originX) / grid.cellPx);
    var r = Math.floor((point.y - grid.originY) / grid.cellPx);
    return c >= 0 && r >= 0 && c < grid.cols && r < grid.rows ? { c: c, r: r } : null;
  }
  function finishCalibration(point) {
    var grid = Importer.gridFromDrawnBox(
      state.analysisWidth, state.analysisHeight,
      state.drag.startX, state.drag.startY, point.x, point.y, 1
    );
    state.drag = null;
    if (!grid) {
      renderOverlay();
      setStatus("That drag was too small. Draw from one printed grid corner to its opposite corner.");
      return;
    }
    state.detectedGrid = grid;
    state.gridMode = "gridded";
    state.calibrating = false;
    reportDetectedGrid(grid);
    clearReview();
    syncGridControls();
    setStatus("One source square now owns scale and alignment. Propose regions when the overlay fits.");
  }
  function renderSelectionReceipt() {
    var count = state.selection && state.selection.cells.length || 0;
    syncPendingAppearance();
    ui.selectionReceipt.textContent = count
      ? count + " tactical squares in this " + (state.editingRegionId ? "edited" : "new") + " footprint · saved structures remain"
      : "No working footprint. Saved structures remain on the map.";
    ui.commitSelection.disabled = !count;
    ui.commitSelection.textContent = state.editingRegionId
      ? "Update " + (state.semanticType === "ground" ? "region" : Structure.TYPES[state.semanticType].label)
      : "Save " + (state.semanticType === "ground" ? "Ground / erase" : Structure.TYPES[state.semanticType].label);
  }
  function applySelection(next) {
    state.selection = Structure.combineSelection(state.selection, next, state.selectionOperation);
    renderSelectionReceipt(); renderOverlay();
    setStatus((state.selection && state.selection.cells.length || 0)
      + " squares selected. Refine with Add/Subtract, then assign a meaning.");
  }
  function magicSelect(point) {
    var grid = state.review && state.review.grid || activeGrid();
    if (!grid || !state.imageData) return;
    if (!state.selection || !state.selection.cells.length) {
      setStatus("Color assist needs a boundary. Draw a loose lasso around one feature first; it will never search the whole map.");
      return;
    }
    var allowedMask = Structure.maskFromCells(grid, state.selection.cells, state.analysisWidth, state.analysisHeight);
    var seedIndex = clamp(Math.floor(point.y), 0, state.analysisHeight - 1) * state.analysisWidth
      + clamp(Math.floor(point.x), 0, state.analysisWidth - 1);
    if (!allowedMask[seedIndex]) {
      setStatus("Click inside the current lasso. Color assist cannot add pixels beyond that boundary.");
      return;
    }
    setStatus("Refining connected local color inside the current lasso…");
    var tolerance = Number(ui.magicTolerance.value) || 18;
    var mask = Structure.magicMask(
      state.imageData.data, state.analysisWidth, state.analysisHeight,
      point.x, point.y, tolerance, { allowedMask: allowedMask }
    );
    var cells = Structure.cellsFromMask(grid, mask, state.analysisWidth, state.analysisHeight, 0.18);
    if (!cells.length) {
      setStatus("No tactical square contained enough of that color inside the lasso. Raise tolerance or keep the lasso as drawn.");
      return;
    }
    var fence = state.selection.footprint;
    state.selection = Structure.selectionFromCells(cells, {
      kind: "magic-within", seed: [point.x, point.y], tolerance: tolerance,
      fence: fence, imageSize: [state.analysisWidth, state.analysisHeight]
    });
    renderSelectionReceipt(); renderOverlay();
    setStatus(cells.length + " squares retained inside the lasso. No artwork outside the boundary was searched.");
  }
  function finishLasso() {
    var points = state.lassoPoints || [], grid = state.review && state.review.grid || activeGrid();
    state.lassoPoints = null;
    if (!grid || points.length < 3) { renderOverlay(); setStatus("The lasso needs a closed freehand boundary."); return; }
    var cells = Structure.cellsFromPolygon(grid, points, 0.18);
    applySelection(Structure.selectionFromCells(cells, {
      kind: "polygon", points: points, imageSize: [state.analysisWidth, state.analysisHeight]
    }));
  }
  function commitSelection() {
    if (!state.review || !state.selection || !state.selection.cells.length) return;
    var editingRegionId = state.editingRegionId;
    var result = Structure.authorSelection(state.review, state.selection, state.semanticType, {
      replaceRegionId: editingRegionId,
      appearance: state.semanticType === "ground" ? null : state.semanticAppearance
    });
    state.review = result.review; state.selectedId = result.regionId; state.selection = null;
    state.editingRegionId = null;
    setEnabled(ui.inspector, !!state.selectedId); renderAll(); renderSelectionReceipt();
    setStatus(state.semanticType === "ground"
      ? "Selection returned to the underlying ground without fragmenting neighboring regions."
      : appearanceFor(state.semanticType, state.semanticAppearance).label + (editingRegionId
        ? " footprint updated. Height, support, access, and identity were preserved."
        : " saved as a new " + Structure.TYPES[state.semanticType].label.toLowerCase() + ". Start another structure whenever ready."));
  }
  function useRegionAsSelection() {
    var region = selectedRegion();
    if (!region) return;
    state.selection = Structure.selectionFromCells(region.cells, region.footprint || { kind: "cells" });
    state.editingRegionId = region.id;
    state.semanticType = region.type;
    state.semanticAppearance = region.appearance || appearanceFor(region.type).id;
    document.querySelectorAll("[data-semantic-type]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.semanticType === region.type);
    });
    syncPendingAppearance(); renderSelectionReceipt(); renderOverlay();
    setStatus("The region footprint is now editable. Add or subtract artwork, then update it without losing its height or support.");
  }
  function startAnotherRegion() {
    state.selection = null; state.editingRegionId = null; state.selectedId = null;
    state.lassoPoints = null; state.selectionTool = "lasso"; state.selectionOperation = "replace";
    document.querySelectorAll("[data-selection-tool]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.selectionTool === "lasso");
    });
    document.querySelectorAll("[data-selection-operation]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.selectionOperation === "replace");
    });
    ui.toleranceControl.hidden = true;
    syncGridControls(); renderAll();
    setStatus("Ready for another structure. Saved regions remain visible; draw its footprint with the lasso.");
  }
  function selectedRegion() {
    return state.review && state.review.regions.find(function (region) { return region.id === state.selectedId; });
  }
  function renderInspector() {
    var region = selectedRegion();
    setEnabled(ui.inspector, !!region);
    if (!region) {
      ui.regionName.textContent = "Nothing selected";
      ui.regionReceipt.textContent = "Inspect a proposed region or create one from a selection.";
      ui.heightReceipt.textContent = "Select a raised region to inspect its vertical span.";
      ui.movementNote.textContent = "Movement evidence appears after selecting an elevated region.";
      return;
    }
    ui.regionName.textContent = region.label;
    var regionAppearance = appearanceFor(region.type, region.appearance);
    ui.regionReceipt.textContent = region.cells.length + " squares · "
      + (region.source === "dm-authored" ? "DM authored" : Math.round(region.confidence * 100) + "% local proposal")
      + " · " + regionAppearance.label;
    ui.regionType.value = region.type;
    fillAppearanceOptions(ui.regionAppearance, region.type, region.appearance);
    ui.regionLabel.value = region.label;
    ui.regionBase.value = region.baseFt;
    ui.regionTop.value = region.topFt;
    ui.regionWalkable.checked = !!region.roofWalkable;
    ui.regionAccess.value = region.access || "none";
    ui.regionSupport.value = region.supportMode || Structure.TYPES[region.type].supportMode;
    var rise = Math.max(0, region.topFt - region.baseFt);
    ui.heightReceipt.textContent = "Base " + region.baseFt + " ft → top " + region.topFt + " ft · "
      + rise + " ft span · " + (region.supportMode || "unspecified") + " support";
    if ((region.type === "roof" || region.type === "bridge") && region.supportMode === "none") {
      ui.heightReceipt.textContent += " · intentionally unsupported / special";
    }
    if (!rise) ui.movementNote.textContent = "This region remains on the base surface.";
    else if (region.access === "climb") {
      ui.movementNote.textContent = rise + " ft climb · ordinary movement budget "
        + Structure.climbCost(rise, false) + " ft · with a climbing speed " + Structure.climbCost(rise, true) + " ft.";
    } else if (region.access === "none") {
      ui.movementNote.textContent = "Raised " + rise + " ft with no ordinary connector. Jump, flight, teleport, or a later authored access route is required.";
    } else {
      ui.movementNote.textContent = rise + " ft rise connected by " + region.access + ". Final path length belongs to the authored connector.";
    }
  }
  function renderSummary() {
    if (!state.review) {
      ui.sceneName.textContent = "No structure review";
      ui.metricGrid.textContent = "—"; ui.metricRegions.textContent = "—";
      ui.metricSurfaces.textContent = "—"; ui.metricConnectors.textContent = "—";
      ui.typeSummary.innerHTML = "<p>Local proposals will be grouped here.</p>";
      ui.authoredCount.textContent = "0";
      ui.authoredList.innerHTML = "<p>No DM-authored structures yet.</p>";
      ui.surfaceReceipt.innerHTML = "<p>No surfaces or volumes compiled.</p>";
      ui.reviewJson.textContent = "{}";
      return;
    }
    var summary = Structure.summarize(state.review);
    var compiled = Structure.compileReview(state.review);
    ui.sceneName.textContent = state.review.scene;
    ui.metricGrid.textContent = state.review.grid.cols + " × " + state.review.grid.rows;
    ui.metricRegions.textContent = String(state.review.regions.length);
    ui.metricSurfaces.textContent = String(summary.surfaces);
    ui.metricConnectors.textContent = String(summary.connectors);
    ui.typeSummary.replaceChildren();
    Object.keys(summary.counts).forEach(function (type) {
      var row = document.createElement("div");
      row.className = "type-row";
      var swatch = document.createElement("i"), label = document.createElement("span"), value = document.createElement("b");
      swatch.style.background = Structure.TYPES[type].color;
      label.textContent = Structure.TYPES[type].label;
      value.textContent = summary.counts[type];
      row.append(swatch, label, value); ui.typeSummary.appendChild(row);
    });
    var authored = state.review.regions.filter(function (region) { return region.source === "dm-authored"; });
    ui.authoredCount.textContent = String(authored.length);
    ui.authoredList.replaceChildren();
    if (!authored.length) ui.authoredList.innerHTML = "<p>No DM-authored structures yet.</p>";
    authored.forEach(function (region) {
      var appearance = appearanceFor(region.type, region.appearance);
      var button = document.createElement("button"), swatch = document.createElement("i");
      var copy = document.createElement("span"), title = document.createElement("strong"), detail = document.createElement("small");
      var height = document.createElement("em");
      button.type = "button"; button.className = "authored-region" + (region.id === state.selectedId ? " active" : "");
      swatch.style.background = appearance.color; title.textContent = region.label;
      detail.textContent = Structure.TYPES[region.type].label + " · " + appearance.label;
      height.textContent = region.topFt + " ft"; copy.append(title, detail); button.append(swatch, copy, height);
      button.addEventListener("click", function () {
        state.selectedId = region.id; renderAll();
        setStatus(region.label + " selected. Its meaning, appearance, height, support, and footprint are editable.");
      });
      ui.authoredList.appendChild(button);
    });
    ui.surfaceReceipt.replaceChildren();
    [
      ["Walk surfaces", compiled.surfaces.length + " · ground, water, roofs, and decks remain separate"],
      ["Volumes", compiled.volumes.length + " · buildings and obstacles carry bottom/top feet"],
      ["Connectors", compiled.connectors.length + " · stairs, ramps, ladders, or climb access"],
      ["Underpasses", compiled.surfaces.filter(function (surface) { return surface.supportsUnderpass; }).length
        + " proposed · renderer study only"]
    ].forEach(function (item) {
      var row = document.createElement("div"), title = document.createElement("strong"), detail = document.createElement("span");
      title.textContent = item[0]; detail.textContent = item[1]; row.append(title, detail); ui.surfaceReceipt.appendChild(row);
    });
    ui.reviewJson.textContent = JSON.stringify({ review: state.review, proposal: compiled }, null, 2);
  }
  function colorForMaterial(material) {
    return Importer.MATERIALS[material] && Importer.MATERIALS[material].color || "#857958";
  }
  function shade(hex, factor) {
    var value = hex.replace("#", "");
    var red = parseInt(value.slice(0, 2), 16), green = parseInt(value.slice(2, 4), 16), blue = parseInt(value.slice(4, 6), 16);
    return "rgb(" + Math.round(red * factor) + "," + Math.round(green * factor) + "," + Math.round(blue * factor) + ")";
  }
  function renderPreview() {
    var ctx = previewContext, canvas = ui.previewCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var background = ctx.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, "#24322c"); background.addColorStop(1, "#080c0a");
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!state.review || !state.analysis) {
      ctx.fillStyle = "#9f9d91"; ctx.font = "18px Georgia"; ctx.textAlign = "center";
      ctx.fillText("Structure heights appear after local proposals.", canvas.width / 2, canvas.height / 2);
      return;
    }
    var cols = state.review.grid.cols, rows = state.review.grid.rows;
    var tileW = Math.min(18, 880 * 2 / Math.max(1, cols + rows));
    var tileH = tileW * 0.45, elevationScale = tileH * 0.72;
    var originX = canvas.width / 2 - (cols - rows) * tileW / 4;
    var originY = 62;
    function project(c, r, elevationFt) {
      return {
        x: originX + (c - r) * tileW / 2,
        y: originY + (c + r) * tileH / 2 - elevationFt * elevationScale
      };
    }
    function diamond(c, r, elevationFt, fill, stroke) {
      var p = project(c, r, elevationFt);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + tileW / 2, p.y + tileH / 2);
      ctx.lineTo(p.x, p.y + tileH);
      ctx.lineTo(p.x - tileW / 2, p.y + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.65; ctx.stroke(); }
    }
    function prism(c, r, bottomFt, topFt, color, selected) {
      var top = project(c, r, topFt), bottom = project(c, r, bottomFt);
      ctx.beginPath();
      ctx.moveTo(top.x - tileW / 2, top.y + tileH / 2);
      ctx.lineTo(top.x, top.y + tileH);
      ctx.lineTo(bottom.x, bottom.y + tileH);
      ctx.lineTo(bottom.x - tileW / 2, bottom.y + tileH / 2);
      ctx.closePath(); ctx.fillStyle = shade(color, 0.54); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(top.x + tileW / 2, top.y + tileH / 2);
      ctx.lineTo(top.x, top.y + tileH);
      ctx.lineTo(bottom.x, bottom.y + tileH);
      ctx.lineTo(bottom.x + tileW / 2, bottom.y + tileH / 2);
      ctx.closePath(); ctx.fillStyle = shade(color, 0.68); ctx.fill();
      diamond(c, r, topFt, color, selected ? "#fff0a8" : "rgba(238,231,214,.16)");
    }
    function joinedPrism(region, bottomFt, topFt, color, selected) {
      var occupied = new Set(region.cells.map(function (cell) { return cell[0] + "," + cell[1]; }));
      var cells = region.cells.slice().sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
      cells.forEach(function (cell) {
        var c = cell[0], r = cell[1], top = project(c, r, topFt), bottom = project(c, r, bottomFt);
        if (!occupied.has((c + 1) + "," + r)) {
          ctx.beginPath();
          ctx.moveTo(top.x + tileW / 2, top.y + tileH / 2); ctx.lineTo(top.x, top.y + tileH);
          ctx.lineTo(bottom.x, bottom.y + tileH); ctx.lineTo(bottom.x + tileW / 2, bottom.y + tileH / 2);
          ctx.closePath(); ctx.fillStyle = shade(color, 0.62); ctx.fill();
        }
        if (!occupied.has(c + "," + (r + 1))) {
          ctx.beginPath();
          ctx.moveTo(top.x - tileW / 2, top.y + tileH / 2); ctx.lineTo(top.x, top.y + tileH);
          ctx.lineTo(bottom.x, bottom.y + tileH); ctx.lineTo(bottom.x - tileW / 2, bottom.y + tileH / 2);
          ctx.closePath(); ctx.fillStyle = shade(color, 0.5); ctx.fill();
        }
      });
      cells.forEach(function (cell) {
        diamond(cell[0], cell[1], topFt, color, selected ? "#fff0a8" : null);
      });
    }
    function supportPosts(region, color) {
      var cells = region.cells.slice().sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
      var stride = Math.max(1, Math.ceil(cells.length / 6));
      cells.forEach(function (cell, index) {
        if (index % stride) return;
        var deck = project(cell[0], cell[1], region.topFt - 0.8), ground = project(cell[0], cell[1], region.baseFt);
        ctx.strokeStyle = shade(color, 0.52); ctx.lineWidth = Math.max(1.5, tileW * 0.14);
        ctx.beginPath(); ctx.moveTo(deck.x, deck.y + tileH / 2); ctx.lineTo(ground.x, ground.y + tileH / 2); ctx.stroke();
      });
    }
    function pitchedCrown(region, color) {
      var average = averageCell(region), peak = project(average.c, average.r, region.topFt + 3);
      var leftCell = region.cells.reduce(function (best, cell) { return cell[0] - cell[1] < best[0] - best[1] ? cell : best; });
      var rightCell = region.cells.reduce(function (best, cell) { return cell[0] - cell[1] > best[0] - best[1] ? cell : best; });
      var left = project(leftCell[0], leftCell[1], region.topFt), right = project(rightCell[0], rightCell[1], region.topFt);
      ctx.beginPath(); ctx.moveTo(left.x - tileW / 2, left.y + tileH / 2); ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(right.x + tileW / 2, right.y + tileH / 2); ctx.strokeStyle = shade(color, 1.16);
      ctx.lineWidth = Math.max(1.2, tileW * 0.12); ctx.stroke();
    }
    function heightLabel(region, emphasized) {
      var average = averageCell(region), point = project(average.c, average.r, region.topFt + 1.5);
      var label = region.topFt + " ft · " + appearanceFor(region.type, region.appearance).label;
      ctx.font = emphasized ? "bold 12px ui-sans-serif" : "10px ui-sans-serif";
      var width = ctx.measureText(label).width + 12;
      ctx.fillStyle = emphasized ? "rgba(255,240,168,.96)" : "rgba(12,17,15,.84)";
      ctx.fillRect(point.x - width / 2, point.y - 17, width, 15);
      ctx.fillStyle = emphasized ? "#171d1a" : "#eee7d6"; ctx.textAlign = "center";
      ctx.fillText(label, point.x, point.y - 6);
    }
    function heightRuler(maxFt) {
      var x = 34, groundY = canvas.height - 42, topY = Math.max(24, groundY - maxFt * elevationScale);
      ctx.strokeStyle = "rgba(255,240,168,.62)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, topY); ctx.stroke();
      ctx.font = "10px ui-sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#eee7d6";
      for (var feet = 0; feet <= maxFt; feet += 5) {
        var y = groundY - feet * elevationScale;
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.stroke();
        ctx.fillText(feet + " ft", x + 8, y + 3);
      }
    }
    var baseCells = state.analysis.cells.slice().sort(function (a, b) { return a.c + a.r - b.c - b.r; });
    baseCells.forEach(function (cell) {
      diamond(cell.c, cell.r, 0, shade(colorForMaterial(cell.material), 0.58), "rgba(238,231,214,.08)");
    });
    var orderedRegions = state.review.regions.slice().sort(function (a, b) {
      var ac = averageCell(a), bc = averageCell(b);
      return ac.c + ac.r - bc.c - bc.r;
    });
    orderedRegions.forEach(function (region) {
      var appearance = appearanceFor(region.type, region.appearance), color = appearance.color;
      var cells = region.cells.slice().sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
      var selected = region.id === state.selectedId;
      if (region.type === "water") {
        cells.forEach(function (cell) {
          diamond(cell[0], cell[1], region.baseFt - 0.5, color, selected ? "#fff0a8" : "rgba(220,244,247,.22)");
        });
      } else if (region.type === "tree") {
        cells.forEach(function (cell) {
          var p = project(cell[0], cell[1], region.baseFt);
          var top = project(cell[0], cell[1], region.topFt);
          ctx.strokeStyle = "#5d4932"; ctx.lineWidth = Math.max(1, tileW * 0.12);
          ctx.beginPath(); ctx.moveTo(p.x, p.y + tileH / 2); ctx.lineTo(top.x, top.y + tileH / 2); ctx.stroke();
          ctx.fillStyle = color; ctx.beginPath();
          if (appearance.form === "conifer") {
            ctx.moveTo(top.x, top.y - tileH * 0.7); ctx.lineTo(top.x + tileW * 0.42, top.y + tileH * 0.8);
            ctx.lineTo(top.x - tileW * 0.42, top.y + tileH * 0.8); ctx.closePath();
          } else ctx.arc(top.x, top.y + tileH / 2, tileW * (appearance.form === "mangrove" ? 0.48 : 0.38), 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (region.type === "tent") {
        joinedPrism(region, Math.max(region.baseFt, region.topFt - 1.2), region.topFt, color, selected);
        supportPosts(region, color);
        pitchedCrown(region, color);
      } else if (region.type === "stairs") {
        cells.forEach(function (cell, index) {
          var t = cells.length <= 1 ? 1 : index / (cells.length - 1);
          prism(cell[0], cell[1], region.baseFt, region.baseFt + (region.topFt - region.baseFt) * t, color, selected);
        });
      } else if (region.type === "bridge" || region.type === "roof") {
        if (region.supportMode === "solid") joinedPrism(region, region.baseFt, region.topFt, color, selected);
        else {
          joinedPrism(region, region.topFt - 0.8, region.topFt, color, selected);
          if (region.supportMode === "posts" || region.supportMode === "arches") supportPosts(region, color);
        }
        if (appearance.form === "pitched") pitchedCrown(region, color);
      } else if (region.type === "building" && appearance.form === "pavilion") {
        joinedPrism(region, Math.max(region.baseFt, region.topFt - 1), region.topFt, color, selected);
        supportPosts(region, color); pitchedCrown(region, color);
      } else {
        joinedPrism(region, region.baseFt, region.topFt, color, selected);
        if (appearance.form === "pitched") pitchedCrown(region, color);
      }
    });
    var maxFt = Math.max(20, orderedRegions.reduce(function (max, region) { return Math.max(max, region.topFt); }, 0));
    heightRuler(Math.ceil(maxFt / 5) * 5);
    var labelRegions = orderedRegions.slice().sort(function (a, b) { return b.cells.length - a.cells.length; }).slice(0, 12);
    var selected = selectedRegion();
    if (selected && labelRegions.indexOf(selected) < 0) labelRegions.push(selected);
    labelRegions.forEach(function (region) {
      if (region.topFt > region.baseFt) heightLabel(region, region.id === state.selectedId);
    });
  }
  function averageCell(region) {
    var total = region.cells.reduce(function (sum, cell) { return { c: sum.c + cell[0], r: sum.r + cell[1] }; }, { c: 0, r: 0 });
    return { c: total.c / region.cells.length, r: total.r / region.cells.length };
  }
  function renderAll() {
    renderOverlay();
    renderPreview();
    renderInspector();
    renderSummary();
    renderSelectionReceipt();
  }
  function applySelectedRegion() {
    var region = selectedRegion();
    if (!region) return;
    state.review = Structure.updateRegion(state.review, region.id, {
      type: ui.regionType.value,
      appearance: ui.regionAppearance.value,
      label: ui.regionLabel.value,
      baseFt: Number(ui.regionBase.value),
      topFt: Number(ui.regionTop.value),
      roofWalkable: ui.regionWalkable.checked,
      access: ui.regionAccess.value,
      supportMode: ui.regionSupport.value
    });
    renderAll();
    setStatus("Region meaning, appearance, height, walk surface, and access receipt updated.");
  }
  function setView(view) {
    state.view = view;
    ui.viewGrid.className = "view-grid " + (view === "artwork" ? "artwork-only" : view === "preview" ? "preview-only" : "split");
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.view === view);
    });
    renderPreview();
  }

  ui.imageFile.addEventListener("change", function () { loadFile(ui.imageFile.files[0]); });
  ui.autoGrid.addEventListener("click", inspectGrid);
  ui.drawGridCell.addEventListener("click", function () {
    state.gridMode = "gridded";
    state.calibrating = !state.calibrating;
    state.drag = null;
    syncGridControls();
    setStatus(state.calibrating
      ? "Drag exactly one printed grid square—from one corner to its opposite corner."
      : "Grid drawing cancelled.");
  });
  ui.noGrid.addEventListener("click", function () {
    state.gridMode = "ungridded";
    state.calibrating = false;
    state.drag = null;
    clearReview();
    syncGridControls();
    ui.gridNote.textContent = "Ungrounded artwork will use the chosen number of squares across.";
    setStatus("Choose the intended map width, then propose regions.");
  });
  [ui.gridCellPx, ui.gridOriginX, ui.gridOriginY, ui.targetColumns].forEach(function (input) {
    input.addEventListener("change", function () { clearReview(); renderOverlay(); });
  });
  ui.proposeRegions.addEventListener("click", propose);
  document.querySelectorAll("[data-selection-tool]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.selectionTool = button.dataset.selectionTool;
      document.querySelectorAll("[data-selection-tool]").forEach(function (item) { item.classList.toggle("active", item === button); });
      ui.toleranceControl.hidden = state.selectionTool !== "magic";
      syncGridControls();
      setStatus(state.selectionTool === "inspect"
        ? "Inspect mode. Click an existing colored region."
        : state.selectionTool === "magic"
          ? state.selection && state.selection.cells.length
            ? "Color assist is fenced by the current lasso. Click a material inside it."
            : "Color assist is bounded. Draw a loose lasso first, then return here."
          : "Draw a freehand boundary around one artwork feature; release to close it.");
    });
  });
  document.querySelectorAll("[data-selection-operation]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.selectionOperation = button.dataset.selectionOperation;
      document.querySelectorAll("[data-selection-operation]").forEach(function (item) { item.classList.toggle("active", item === button); });
      setStatus((state.selectionOperation === "replace" ? "Replace this working footprint" : state.selectionOperation === "add" ? "Add to this working footprint" : "Subtract from this working footprint") + ". Saved structures are unchanged.");
    });
  });
  document.querySelectorAll("[data-semantic-type]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.semanticType = button.dataset.semanticType;
      state.semanticAppearance = state.semanticType === "ground" ? "ground" : appearanceFor(state.semanticType).id;
      document.querySelectorAll("[data-semantic-type]").forEach(function (item) { item.classList.toggle("active", item === button); });
      syncPendingAppearance(); renderSelectionReceipt(); renderOverlay();
      setStatus((state.semanticType === "ground" ? "Ground / erase" : Structure.TYPES[state.semanticType].label)
        + " selected. The working footprint changed color; no saved structure was removed.");
    });
  });
  ui.semanticAppearance.addEventListener("change", function () {
    state.semanticAppearance = ui.semanticAppearance.value;
    syncPendingAppearance(); renderSelectionReceipt(); renderOverlay();
    setStatus(appearanceFor(state.semanticType, state.semanticAppearance).label + " selected for the working footprint.");
  });
  ui.magicTolerance.addEventListener("input", function () { ui.magicToleranceValue.textContent = ui.magicTolerance.value; });
  ui.clearSelection.addEventListener("click", function () {
    state.selection = null; state.editingRegionId = null; state.lassoPoints = null; renderSelectionReceipt(); renderOverlay();
    setStatus("Artwork selection cleared. Existing reviewed regions are unchanged.");
  });
  ui.commitSelection.addEventListener("click", commitSelection);
  ui.startNextRegion.addEventListener("click", startAnotherRegion);
  ui.regionToSelection.addEventListener("click", useRegionAsSelection);
  ui.regionType.addEventListener("change", function () {
    ui.regionSupport.value = Structure.TYPES[ui.regionType.value].supportMode;
    fillAppearanceOptions(ui.regionAppearance, ui.regionType.value, null);
  });
  document.querySelectorAll("[data-height-step]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = clamp((Number(ui.regionTop.value) || 0) + Number(button.dataset.heightStep), Number(ui.regionBase.value) || 0, 120);
      ui.regionTop.value = next; applySelectedRegion();
    });
  });
  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () { setView(button.dataset.view); });
  });
  ui.applyRegion.addEventListener("click", applySelectedRegion);
  ui.overlayCanvas.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    var point = canvasPoint(event);
    ui.overlayCanvas.setPointerCapture && ui.overlayCanvas.setPointerCapture(event.pointerId);
    if (state.calibrating || state.selectionTool === "inspect" || state.selectionTool === "magic") {
      state.drag = { startX: point.x, startY: point.y, endX: point.x, endY: point.y };
    } else if (state.selectionTool === "lasso") state.lassoPoints = [[point.x, point.y]];
    renderOverlay();
  });
  ui.overlayCanvas.addEventListener("pointermove", function (event) {
    var point = canvasPoint(event);
    if (state.drag) { state.drag.endX = point.x; state.drag.endY = point.y; }
    if (state.lassoPoints) {
      var last = state.lassoPoints[state.lassoPoints.length - 1];
      if (Math.hypot(point.x - last[0], point.y - last[1]) > 3) state.lassoPoints.push([point.x, point.y]);
    }
    renderOverlay();
  });
  ui.overlayCanvas.addEventListener("pointerup", function (event) {
    var point = canvasPoint(event);
    if (state.calibrating) {
      if (!state.drag) return;
      finishCalibration(point);
      return;
    }
    if (state.selectionTool === "inspect") {
      var cell = cellAtPoint(point);
      state.drag = null;
      var region = cell && state.review && Structure.regionAt(state.review, cell.c, cell.r);
      state.selectedId = region && region.id || null;
      renderAll();
      setStatus(region ? "Region selected. Height, support, and footprint are editable on the right." : "Only the base ground surface is present here.");
      return;
    }
    state.drag = null;
    if (state.selectionTool === "magic") magicSelect(point);
    else if (state.selectionTool === "lasso" && state.lassoPoints) { state.lassoPoints.push([point.x, point.y]); finishLasso(); }
  });
  ui.overlayCanvas.addEventListener("pointercancel", function () { state.drag = null; state.lassoPoints = null; renderOverlay(); });

  Object.keys(Structure.TYPES).forEach(function (type) {
    var option = document.createElement("option");
    option.value = type; option.textContent = Structure.TYPES[type].label;
    ui.regionType.appendChild(option);
  });
  syncPendingAppearance();

  try {
    if (!Importer || !Importer.analyze || !Importer.gridFromDrawnBox) throw new Error("The local pixel interpreter did not load.");
    if (!Structure || !Structure.proposeRegions) throw new Error("The structure-review authority did not load.");
    renderAll();
  } catch (error) {
    console.error(error);
    ui.fatal.textContent = "Structure Review could not start: " + error.message;
    ui.fatal.classList.add("on");
  }
})();
