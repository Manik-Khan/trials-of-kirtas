(function () {
  "use strict";

  var Importer = window.ForgeImageImporterProof;
  var Structure = window.ForgeImageStructureReviewProof;
  var ui = {};
  [
    "imageFile", "sourceReceipt", "scalePanel", "autoGrid", "drawGridCell", "noGrid", "gridNote",
    "griddedControls", "ungriddedControls", "gridCellPx", "gridOriginX", "gridOriginY", "targetColumns",
    "proposeRegions", "selectionPanel", "armedKit", "pendingSwatch", "pendingMeaning",
    "drawHeightDown", "drawHeightValue", "drawHeightUp", "undoDraw", "redoDraw",
    "verifyGrid", "gridCoverage", "zoomOut", "zoomFit", "zoomIn", "zoomValue", "toggleGrid",
    "typePalette", "closeTypePalette", "typePaletteTools", "typePaletteKinds", "typePaletteVariants",
    "drawPalette", "eraserPalette", "pointerPalette", "zoomPalette", "paletteDeleteSelected",
    "paletteHeightDown", "paletteHeightValue", "paletteHeightUp",
    "heightPopover", "heightPopoverName", "closeHeightPopover", "previewHeightDown", "previewHeightValue", "previewHeightUp",
    "artTitle", "viewGrid", "artView", "previewView",
    "emptyState", "canvasStack", "sourceCanvas", "overlayCanvas", "previewCanvas", "status",
    "sceneName", "metricGrid", "metricRegions", "metricSurfaces", "metricConnectors", "typeSummary",
    "authoredCount", "authoredList",
    "selectedPanel", "regionName", "regionReceipt", "selectedHeightDown", "selectedHeightValue", "selectedHeightUp", "heightReceipt",
    "surfaceReceipt", "reviewJson", "openCombatProof", "fatal"
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
    selectionTool: "pointer",
    semanticType: "building",
    semanticAppearance: "timber-house",
    selectedId: null,
    drawHeightFt: 15,
    calibrating: false,
    verifyingGrid: false,
    gridAnchor: null,
    gridVisible: true,
    gridVerified: false,
    drag: null,
    gridDrag: null,
    lassoPoints: null,
    eraserCells: [],
    lastEraserCell: null,
    eraserSizeCells: 1,
    panDrag: null,
    zoom: 1,
    undoStack: [],
    redoStack: [],
    previewHits: [],
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
    state.semanticAppearance = state.semanticType === "ground" ? "ground" : appearanceFor(state.semanticType, state.semanticAppearance).id;
    var appearance = state.semanticType === "ground"
      ? { label: "Base ground / erase", color: "#857958" }
      : appearanceFor(state.semanticType, state.semanticAppearance);
    ui.pendingSwatch.style.background = appearance.color;
    ui.pendingMeaning.textContent = (state.semanticType === "ground" ? "Ground / erase" : Structure.TYPES[state.semanticType].label)
      + " · " + appearance.label;
    ui.drawHeightValue.textContent = state.drawHeightFt + " ft";
    ui.paletteHeightValue.textContent = state.drawHeightFt + " ft";
  }
  function setDrawHeight(value) {
    var minimum = state.semanticType === "water" ? 0 : 5;
    state.drawHeightFt = state.semanticType === "water" ? 0 : clamp(Math.round(Number(value) / 5) * 5, minimum, 120);
    syncPendingAppearance(); renderOverlay();
    if (state.review && (state.selectionTool === "brush" || state.selectionTool === "lasso")) {
      setStatus((state.selectionTool === "brush" ? "Brush" : "Lasso") + " active at "
        + state.drawHeightFt + " ft. The height marker will follow the drawing.");
    }
  }
  function sourceGridFromInputs() {
    var scale = state.scale || 1;
    var cellPx = Math.max(4, Number(ui.gridCellPx.value) || 70) * scale;
    var phaseX = (Number(ui.gridOriginX.value) || 0) * scale;
    var phaseY = (Number(ui.gridOriginY.value) || 0) * scale;
    return Structure.gridCoveringArtwork(state.analysisWidth, state.analysisHeight, cellPx, phaseX, phaseY,
      Object.assign({}, state.detectedGrid && state.detectedGrid.evidence || { manualInputs: true }, {
        farPointChecked: state.gridVerified
      }));
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
    state.selectedId = null;
    state.gridDrag = null; state.lassoPoints = null; state.eraserCells = []; state.lastEraserCell = null;
    setEnabled(ui.selectionPanel, false);
    setEnabled(ui.selectedPanel, false);
    state.undoStack = []; state.redoStack = [];
    updateHistoryControls();
    renderAll();
  }
  function gridCoverageText(grid) {
    if (!grid) return "No grid coverage.";
    var left = Math.max(0, -grid.originX), top = Math.max(0, -grid.originY);
    var right = Math.max(0, grid.originX + grid.cols * grid.cellPx - state.analysisWidth);
    var bottom = Math.max(0, grid.originY + grid.rows * grid.cellPx - state.analysisHeight);
    var partials = [left, right, top, bottom].filter(function (value) { return value > 0.25; }).length;
    return grid.cols + " × " + grid.rows + " cells across the full artwork"
      + (partials ? " · " + partials + " partial edge" + (partials === 1 ? "" : "s") : " · exact edge coverage");
  }
  function updateGridReceipt() {
    var grid = activeGrid();
    ui.gridCoverage.textContent = gridCoverageText(grid);
    ui.toggleGrid.textContent = state.gridVisible ? "# Grid on" : "# Grid off";
    ui.toggleGrid.classList.toggle("active", state.gridVisible);
  }
  function syncGridControls() {
    ui.griddedControls.hidden = state.gridMode === "ungridded";
    ui.ungriddedControls.hidden = state.gridMode !== "ungridded";
    ui.autoGrid.classList.toggle("active", state.gridMode === "auto" && !state.calibrating);
    ui.drawGridCell.classList.toggle("active", state.calibrating || state.gridMode === "gridded");
    ui.drawGridCell.setAttribute("aria-pressed", String(state.calibrating));
    ui.noGrid.classList.toggle("active", state.gridMode === "ungridded");
    ui.canvasStack.classList.toggle("calibrating", state.calibrating);
    ui.canvasStack.classList.toggle("inspecting", !state.calibrating && state.selectionTool === "pointer");
    ui.canvasStack.classList.toggle("brushing", !state.calibrating && state.selectionTool === "brush");
    ui.canvasStack.classList.toggle("lasso-selecting", !state.calibrating && state.selectionTool === "lasso");
    ui.canvasStack.classList.toggle("erasing", !state.calibrating && state.selectionTool === "eraser");
    ui.canvasStack.classList.toggle("panning", !state.calibrating && state.selectionTool === "pan");
    ui.canvasStack.classList.toggle("zooming", !state.calibrating && state.selectionTool === "zoom");
    ui.verifyGrid.hidden = !(state.gridMode === "gridded" && state.gridAnchor && !state.gridVerified);
    updateGridReceipt();
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
    var manual = grid.evidence && grid.evidence.manualCell;
    ui.gridNote.className = "grid-note " + (manual ? "good" : "warn");
    ui.gridNote.textContent = manual
      ? "Locally calibrated: " + originalCell.toFixed(1) + " source pixels. Check a distant intersection to catch accumulated drift."
      : "Auto—unverified: " + originalCell.toFixed(1) + " source pixels. Do not trace against this overlay until it matches the printed grid.";
    updateGridReceipt();
  }
  function inspectGrid() {
    if (!state.imageData) return;
    state.gridMode = "auto";
    state.calibrating = false;
    state.verifyingGrid = false;
    state.gridAnchor = null;
    state.gridVerified = false;
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
    fitArtwork();
  }
  function fitArtwork() {
    if (!state.analysisWidth) return;
    var available = Math.max(240, ui.artView.clientWidth - 32);
    state.zoom = Math.min(1, available / state.analysisWidth);
    applyZoom();
    ui.artView.scrollLeft = 0; ui.artView.scrollTop = 0;
  }
  function applyZoom() {
    if (!state.analysisWidth) return;
    state.zoom = clamp(state.zoom, 0.2, 5);
    ui.canvasStack.style.width = Math.round(state.analysisWidth * state.zoom) + "px";
    ui.zoomValue.textContent = Math.round(state.zoom * 100) + "%";
  }
  function zoomAtPoint(event, point) {
    var viewRect = ui.artView.getBoundingClientRect();
    state.zoom *= event.shiftKey ? 0.8 : 1.25;
    applyZoom();
    ui.artView.scrollLeft = Math.max(0, point.x * state.zoom - (event.clientX - viewRect.left));
    ui.artView.scrollTop = Math.max(0, point.y * state.zoom - (event.clientY - viewRect.top));
    setStatus("Zoom " + Math.round(state.zoom * 100) + "% · click to zoom in, Shift-click to zoom out, F to fit.");
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
        state.verifyingGrid = false;
        state.gridAnchor = null;
        state.gridVerified = false;
        state.gridVisible = false;
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
      context.moveTo(x, 0);
      context.lineTo(x, state.analysisHeight);
    }
    for (var r = 0; r <= grid.rows; r++) {
      var y = grid.originY + r * grid.cellPx;
      context.moveTo(0, y);
      context.lineTo(state.analysisWidth, y);
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
          overlayLabel(overlayContext, region.cells, grid,
            Structure.TYPES[region.type].label + " · " + region.topFt + " FT", "#fff3bd");
        }
        overlayContext.restore();
      });
    }
    if (grid && state.gridDrag) {
      var brushCells = gridRectCells(state.gridDrag.start, state.gridDrag.end);
      var brushAppearance = appearanceFor(state.semanticType, state.semanticAppearance);
      overlayContext.save();
      overlayContext.fillStyle = brushAppearance.color + "b8";
      overlayContext.strokeStyle = "#fff3bd";
      overlayContext.lineWidth = Math.max(1.5, grid.cellPx * 0.06);
      brushCells.forEach(function (cell) {
        var x = grid.originX + cell[0] * grid.cellPx, y = grid.originY + cell[1] * grid.cellPx;
        overlayContext.fillRect(x, y, grid.cellPx, grid.cellPx);
        overlayContext.strokeRect(x, y, grid.cellPx, grid.cellPx);
      });
      overlayLabel(overlayContext, brushCells, grid,
        Structure.TYPES[state.semanticType].label + " · " + state.drawHeightFt + " FT", "#fff3bd");
      overlayContext.restore();
    }
    if (grid && state.eraserCells.length) {
      overlayContext.save();
      overlayContext.fillStyle = "rgba(190,73,62,.55)";
      overlayContext.strokeStyle = "#ffb09f";
      overlayContext.lineWidth = Math.max(1.5, grid.cellPx * 0.06);
      state.eraserCells.forEach(function (cell) {
        var x = grid.originX + cell[0] * grid.cellPx, y = grid.originY + cell[1] * grid.cellPx;
        overlayContext.fillRect(x, y, grid.cellPx, grid.cellPx);
        overlayContext.strokeRect(x, y, grid.cellPx, grid.cellPx);
      });
      overlayLabel(overlayContext, state.eraserCells, grid,
        "ERASE " + state.eraserSizeCells + " × " + state.eraserSizeCells, "#ffb09f");
      overlayContext.restore();
    }
    if (state.gridVisible && !state.calibrating) renderGrid(overlayContext, grid);
    if (state.lassoPoints && state.lassoPoints.length) {
      overlayContext.save(); overlayContext.beginPath();
      overlayContext.moveTo(state.lassoPoints[0][0], state.lassoPoints[0][1]);
      state.lassoPoints.slice(1).forEach(function (point) { overlayContext.lineTo(point[0], point[1]); });
      overlayContext.strokeStyle = "#fff0a8"; overlayContext.lineWidth = Math.max(2, (grid && grid.cellPx || 18) * 0.08);
      overlayContext.setLineDash([8, 5]); overlayContext.stroke();
      if (state.selectionTool === "lasso") {
        var last = state.lassoPoints[state.lassoPoints.length - 1];
        var marker = state.drawHeightFt + " ft";
        overlayContext.setLineDash([]);
        overlayContext.font = "700 15px ui-sans-serif";
        var markerWidth = overlayContext.measureText(marker).width + 16;
        overlayContext.fillStyle = "rgba(255,240,168,.96)";
        overlayContext.fillRect(last[0] + 10, last[1] - 24, markerWidth, 22);
        overlayContext.fillStyle = "#171d1a";
        overlayContext.textAlign = "center";
        overlayContext.fillText(marker, last[0] + 10 + markerWidth / 2, last[1] - 8);
      }
      overlayContext.restore();
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
    state.selectedId = null;
    setEnabled(ui.selectionPanel, true);
    setEnabled(ui.selectedPanel, false);
    state.selectionTool = "pointer";
    document.querySelectorAll("[data-draw-tool]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.drawTool === "pointer");
    });
    syncPendingAppearance();
    renderAll();
    setStatus(state.gridMode === "auto"
      ? "Broad areas proposed on Auto scale. If the printed grid drifts, draw one real square before trusting coverage."
      : "Broad hints proposed. Choose Lasso, right-click for a kind, and draw one object per gesture.");
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
  function gridRectCells(start, end) {
    if (!start || !end) return [];
    var cells = [];
    for (var r = Math.min(start.r, end.r); r <= Math.max(start.r, end.r); r++) {
      for (var c = Math.min(start.c, end.c); c <= Math.max(start.c, end.c); c++) cells.push([c, r]);
    }
    return cells;
  }
  function eraserStamp(center) {
    var grid = state.review && state.review.grid;
    if (!grid || !center) return [];
    var radius = Math.floor(state.eraserSizeCells / 2), cells = [];
    for (var r = center.r - radius; r <= center.r + radius; r++) {
      for (var c = center.c - radius; c <= center.c + radius; c++) {
        if (c >= 0 && r >= 0 && c < grid.cols && r < grid.rows) cells.push([c, r]);
      }
    }
    return cells;
  }
  function addEraserAt(point) {
    var cell = cellAtPoint(point);
    if (!cell) return;
    var starts = state.lastEraserCell || cell;
    var steps = Math.max(Math.abs(cell.c - starts.c), Math.abs(cell.r - starts.r), 1);
    var existing = new Set(state.eraserCells.map(function (item) { return item[0] + "," + item[1]; }));
    for (var step = 0; step <= steps; step++) {
      var center = {
        c: Math.round(starts.c + (cell.c - starts.c) * step / steps),
        r: Math.round(starts.r + (cell.r - starts.r) * step / steps)
      };
      eraserStamp(center).forEach(function (item) {
        var itemKey = item[0] + "," + item[1];
        if (!existing.has(itemKey)) { existing.add(itemKey); state.eraserCells.push(item); }
      });
    }
    state.lastEraserCell = cell;
  }
  function finishCalibration(point) {
    var calibrationDrag = state.drag;
    var grid = Importer.gridFromDrawnBox(
      state.analysisWidth, state.analysisHeight,
      calibrationDrag.startX, calibrationDrag.startY, point.x, point.y, 1
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
    state.verifyingGrid = false;
    state.gridVerified = false;
    state.gridAnchor = {
      x: Math.min(calibrationDrag.startX, point.x),
      y: Math.min(calibrationDrag.startY, point.y)
    };
    state.gridVisible = true;
    reportDetectedGrid(grid);
    clearReview();
    syncGridControls();
    setStatus("One printed square owns local scale and phase. Zoom out and check a distant intersection before tracing.");
  }
  function finishGridVerification(point) {
    var refined = Structure.refineGridFromPoint(state.analysisWidth, state.analysisHeight, activeGrid(), state.gridAnchor, point);
    state.verifyingGrid = false;
    if (!refined) {
      syncGridControls();
      setStatus("That check was too close to the first square. Choose a printed intersection near the far edge.");
      return;
    }
    state.gridVerified = true;
    state.detectedGrid = refined;
    ui.gridCellPx.value = (refined.cellPx / state.scale).toFixed(2);
    ui.gridOriginX.value = (refined.phaseX / state.scale).toFixed(2);
    ui.gridOriginY.value = (refined.phaseY / state.scale).toFixed(2);
    ui.gridNote.className = "grid-note good";
    ui.gridNote.textContent = "Far-edge checked: " + (refined.cellPx / state.scale).toFixed(2) + " source pixels per cell. The projection covers the full artwork.";
    clearReview(); syncGridControls();
    setStatus("Grid checked across the artwork. Show or hide it at any time, then find broad areas.");
  }
  function updateHistoryControls() {
    ui.undoDraw.disabled = !state.undoStack.length;
    ui.redoDraw.disabled = !state.redoStack.length;
  }
  function pushUndo() {
    if (!state.review) return;
    state.undoStack.push(JSON.parse(JSON.stringify(state.review)));
    if (state.undoStack.length > 40) state.undoStack.shift();
    state.redoStack = [];
    updateHistoryControls();
  }
  function restoreHistory(from, to, label) {
    if (!from.length || !state.review) return;
    to.push(JSON.parse(JSON.stringify(state.review)));
    state.review = from.pop();
    state.selectedId = null;
    updateHistoryControls(); renderAll(); setStatus(label + ". Every structure remains individually authored.");
  }
  function saveAuthoredSelection(selection, toolLabel) {
    pushUndo();
    var result = Structure.authorSelection(state.review, selection, state.semanticType, {
      appearance: state.semanticAppearance,
      palette: Structure.paletteForCells(state.analysis, selection.cells)
    });
    state.review = Structure.updateRegion(result.review, result.regionId, { topFt: state.drawHeightFt });
    state.selectedId = result.regionId;
    renderAll();
    setStatus(appearanceFor(state.semanticType, state.semanticAppearance).label + " saved at "
      + state.drawHeightFt + " ft with the " + toolLabel + ". Keep drawing or right-click to change tools.");
  }
  function finishLasso() {
    var points = state.lassoPoints || [], grid = state.review && state.review.grid || activeGrid();
    state.lassoPoints = null;
    if (!grid || points.length < 3) { renderOverlay(); setStatus("The lasso needs a closed freehand boundary."); return; }
    var cells = Structure.cellsFromPolygon(grid, points, 0.18);
    if (!cells.length) { renderOverlay(); setStatus("That lasso did not cover a complete tactical cell. Zoom in or draw a slightly larger boundary."); return; }
    var selection = Structure.selectionFromCells(cells, {
      kind: "polygon", points: points, imageSize: [state.analysisWidth, state.analysisHeight]
    });
    saveAuthoredSelection(selection, "lasso");
  }
  function finishGridBrush() {
    var drag = state.gridDrag;
    state.gridDrag = null;
    if (!drag) return;
    var cells = gridRectCells(drag.start, drag.end);
    if (!cells.length) { renderOverlay(); return; }
    saveAuthoredSelection(Structure.selectionFromCells(cells, {
      kind: "grid-rectangle",
      rect: {
        minC: Math.min(drag.start.c, drag.end.c), minR: Math.min(drag.start.r, drag.end.r),
        maxC: Math.max(drag.start.c, drag.end.c), maxR: Math.max(drag.start.r, drag.end.r)
      }
    }), "grid brush");
  }
  function finishEraser() {
    var cells = state.eraserCells.slice();
    state.eraserCells = []; state.lastEraserCell = null;
    if (!cells.length) { renderOverlay(); return; }
    var erased = Structure.eraseSelection(state.review, Structure.selectionFromCells(cells, {
      kind: "grid-eraser", sizeCells: state.eraserSizeCells
    }), state.selectedId);
    if (erased.affected) {
      pushUndo();
      state.review = erased.review;
      if (state.selectedId && !selectedRegion()) state.selectedId = null;
    }
    renderAll();
    setStatus(erased.affected
      ? "Eraser changed " + erased.affected + " structure" + (erased.affected === 1 ? "" : "s") + ". Undo is available."
      : "The eraser crossed no authored structure; nothing changed.");
  }
  function deleteSelectedRegion() {
    var region = selectedRegion();
    if (!region || region.source !== "dm-authored") {
      setStatus("Pointer: select a drawn structure before deleting it.");
      return;
    }
    pushUndo();
    var deleted = Structure.deleteRegion(state.review, region.id);
    state.review = deleted.review; state.selectedId = null;
    closeHeightPopover(); closeTypePalette(); renderAll();
    setStatus(region.label + " deleted. Undo restores it.");
  }
  function selectAuthoredAtPoint(point) {
    var cell = cellAtPoint(point);
    return cell && state.review && state.review.regions.slice().reverse().find(function (candidate) {
      return candidate.source === "dm-authored" && candidate.cells.some(function (savedCell) {
        return savedCell[0] === cell.c && savedCell[1] === cell.r;
      });
    });
  }
  function selectedRegion() {
    return state.review && state.review.regions.find(function (region) { return region.id === state.selectedId; });
  }
  function syncDrawToolButtons() {
    document.querySelectorAll("[data-draw-tool]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.drawTool === state.selectionTool);
    });
    syncGridControls();
  }
  function setTool(tool, narrate) {
    state.selectionTool = tool;
    state.gridDrag = null; state.lassoPoints = null; state.eraserCells = []; state.lastEraserCell = null;
    syncDrawToolButtons();
    if (!narrate) return;
    setStatus(tool === "pointer" ? "Pointer (V): click a drawn structure; Delete or Backspace removes it."
      : tool === "brush" ? "Grid brush (B) at " + state.drawHeightFt + " ft: drag a straight cell rectangle."
        : tool === "lasso" ? "Lasso (L) at " + state.drawHeightFt + " ft: trace one irregular structure."
          : tool === "eraser" ? "Eraser (E) " + state.eraserSizeCells + " × " + state.eraserSizeCells + ": drag across authored cells."
            : tool === "zoom" ? "Zoom (Z): click the map to zoom in; Shift-click to zoom out; F fits."
              : "Hand (H): drag the artwork without changing structures.");
  }
  function renderTypePalette() {
    document.querySelectorAll("[data-palette-tool]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.paletteTool === state.selectionTool);
    });
    ui.drawPalette.hidden = state.selectionTool !== "brush" && state.selectionTool !== "lasso";
    ui.eraserPalette.hidden = state.selectionTool !== "eraser";
    ui.pointerPalette.hidden = state.selectionTool !== "pointer";
    ui.zoomPalette.hidden = state.selectionTool !== "zoom";
    ui.paletteDeleteSelected.disabled = !selectedRegion();
    document.querySelectorAll("[data-eraser-size]").forEach(function (button) {
      button.classList.toggle("active", Number(button.dataset.eraserSize) === state.eraserSizeCells);
    });
    ui.typePaletteKinds.replaceChildren(); ui.typePaletteVariants.replaceChildren();
    Object.keys(Structure.TYPES).forEach(function (type) {
      var button = document.createElement("button");
      button.type = "button"; button.textContent = Structure.TYPES[type].label;
      button.classList.toggle("active", type === state.semanticType);
      button.addEventListener("click", function () {
        state.semanticType = type; state.semanticAppearance = appearanceFor(type).id;
        state.drawHeightFt = Structure.TYPES[type].topFt;
        syncPendingAppearance(); renderTypePalette();
      });
      ui.typePaletteKinds.appendChild(button);
    });
    (Structure.APPEARANCES[state.semanticType] || []).forEach(function (appearance) {
      var button = document.createElement("button"), swatch = document.createElement("i"), label = document.createElement("span");
      button.type = "button"; button.classList.toggle("active", appearance.id === state.semanticAppearance);
      swatch.style.background = appearance.color; label.textContent = appearance.label; button.append(swatch, label);
      button.addEventListener("click", function () {
        state.semanticAppearance = appearance.id; syncPendingAppearance(); closeTypePalette();
        setStatus(appearance.label + " armed. Every completed " + (state.selectionTool === "brush" ? "grid brush" : "lasso")
          + " becomes one separate " + Structure.TYPES[state.semanticType].label.toLowerCase() + ".");
      });
      ui.typePaletteVariants.appendChild(button);
    });
  }
  function openTypePalette(clientX, clientY) {
    closeHeightPopover();
    renderTypePalette(); ui.typePalette.hidden = false;
    var width = 330, height = 520;
    ui.typePalette.style.left = clamp(clientX, 8, window.innerWidth - width - 8) + "px";
    ui.typePalette.style.top = clamp(clientY, 8, window.innerHeight - height - 8) + "px";
  }
  function closeTypePalette() { ui.typePalette.hidden = true; }
  function renderSelectedPanel() {
    var region = selectedRegion();
    var authored = region && region.source === "dm-authored";
    setEnabled(ui.selectedPanel, authored);
    if (!authored) {
      ui.regionName.textContent = "Nothing selected";
      ui.regionReceipt.textContent = "Select a structure on the artwork, list, or Height Preview.";
      ui.selectedHeightValue.textContent = "—";
      ui.heightReceipt.textContent = "Choose a structure to compare its height with the rest of the scene.";
      return;
    }
    ui.regionName.textContent = region.label;
    var regionAppearance = appearanceFor(region.type, region.appearance);
    ui.regionReceipt.textContent = region.cells.length + " squares · "
      + Structure.TYPES[region.type].label + " · " + regionAppearance.label;
    ui.selectedHeightValue.textContent = region.topFt + " ft";
    var rise = Math.max(0, region.topFt - region.baseFt);
    ui.heightReceipt.textContent = rise
      ? region.topFt + " ft above the map · use −5 / +5 to compare it with nearby structures."
      : "This structure remains on the map surface.";
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
      ui.openCombatProof.disabled = true;
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
      swatch.style.background = region.palette && region.palette.primary || appearance.color; title.textContent = region.label;
      detail.textContent = Structure.TYPES[region.type].label + " · " + appearance.label;
      height.textContent = region.topFt + " ft"; copy.append(title, detail); button.append(swatch, copy, height);
      button.addEventListener("click", function () {
        state.selectedId = region.id;
        state.semanticType = region.type;
        state.semanticAppearance = region.appearance;
        state.drawHeightFt = region.topFt;
        renderAll();
        setStatus(region.label + " selected at " + region.topFt + " ft. Use −5 / +5 to compare its height.");
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
    ui.openCombatProof.disabled = !authored.length;
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
    state.previewHits = [];
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
    var orderedRegions = state.review.regions.filter(function (region) {
      return region.source === "dm-authored";
    }).sort(function (a, b) {
      var ac = averageCell(a), bc = averageCell(b);
      return ac.c + ac.r - bc.c - bc.r;
    });
    orderedRegions.forEach(function (region) {
      var appearance = appearanceFor(region.type, region.appearance), color = region.palette && region.palette.primary || appearance.color;
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
      var hit = region.cells.reduce(function (bounds, cell) {
        var top = project(cell[0], cell[1], region.topFt);
        var bottom = project(cell[0], cell[1], region.baseFt);
        bounds.left = Math.min(bounds.left, top.x - tileW / 2, bottom.x - tileW / 2);
        bounds.right = Math.max(bounds.right, top.x + tileW / 2, bottom.x + tileW / 2);
        bounds.top = Math.min(bounds.top, top.y - tileH);
        bounds.bottom = Math.max(bounds.bottom, bottom.y + tileH);
        return bounds;
      }, { id: region.id, left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
      state.previewHits.push(hit);
    });
    if (!orderedRegions.length) {
      ctx.fillStyle = "rgba(12,17,15,.86)";
      ctx.fillRect(canvas.width / 2 - 190, 28, 380, 42);
      ctx.fillStyle = "#eee7d6"; ctx.font = "15px ui-sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Draw a structure to give this scene height.", canvas.width / 2, 54);
    }
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
    renderSelectedPanel();
    renderSummary();
    syncPendingAppearance();
    updateHistoryControls();
    updateGridReceipt();
  }
  function adjustSelectedHeight(step) {
    var region = selectedRegion();
    if (!region || region.source !== "dm-authored") return;
    pushUndo();
    var minimum = region.type === "water" ? 0 : Math.max(5, region.baseFt);
    var next = region.type === "water" ? 0 : clamp(region.topFt + step, minimum, 120);
    state.review = Structure.updateRegion(state.review, region.id, { topFt: next });
    state.drawHeightFt = next;
    renderAll();
    ui.previewHeightValue.textContent = next + " ft";
    setStatus(region.label + " is now " + next + " ft high. No Apply step is needed.");
  }
  function openHeightPopover(region, clientX, clientY) {
    ui.heightPopoverName.textContent = region.label;
    ui.previewHeightValue.textContent = region.topFt + " ft";
    ui.heightPopover.hidden = false;
    var width = 270, height = 112;
    ui.heightPopover.style.left = clamp(clientX + 12, 8, window.innerWidth - width - 8) + "px";
    ui.heightPopover.style.top = clamp(clientY + 12, 8, window.innerHeight - height - 8) + "px";
  }
  function closeHeightPopover() { ui.heightPopover.hidden = true; }
  function previewRegionAt(event) {
    var rect = ui.previewCanvas.getBoundingClientRect();
    var x = (event.clientX - rect.left) * ui.previewCanvas.width / rect.width;
    var y = (event.clientY - rect.top) * ui.previewCanvas.height / rect.height;
    return state.previewHits.slice().reverse().find(function (hit) {
      return x >= hit.left && x <= hit.right && y >= hit.top && y <= hit.bottom;
    });
  }
  function setView(view) {
    closeTypePalette();
    closeHeightPopover();
    state.view = view;
    ui.viewGrid.className = "view-grid " + (view === "artwork" ? "artwork-only" : view === "preview" ? "preview-only" : "split");
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.view === view);
    });
    renderPreview();
  }

  function storeCombatHandoff() {
    if (!state.review || !state.analysis || !state.file) return;
    var authored = state.review.regions.filter(function (region) { return region.source === "dm-authored"; });
    if (!authored.length) { setStatus("Draw at least one confirmed structure before continuing."); return; }
    var nonce = Date.now(), key = "forge-image-combat-handoff:" + nonce;
    var underlayKey = key + ":artwork";
    try {
      sessionStorage.setItem(underlayKey, ui.sourceCanvas.toDataURL("image/jpeg", 0.78));
      sessionStorage.setItem(key, JSON.stringify({
        contract: "forge-image-combat-handoff/v1",
        source: { name: state.file.name, width: state.originalWidth, height: state.originalHeight, localOnly: true },
        review: state.review,
        analysis: state.analysis,
        underlayKey: underlayKey
      }));
    } catch (error) {
      setStatus("This browser could not hold the local artwork handoff. The review remains unchanged here.");
      return;
    }
    setStatus("Reviewed structures and their local artwork colors are entering the combat handoff proof.");
    window.location.href = "mock-forge-image-combat-handoff.html#handoff=" + encodeURIComponent(key);
  }

  ui.imageFile.addEventListener("change", function () { loadFile(ui.imageFile.files[0]); });
  ui.openCombatProof.addEventListener("click", storeCombatHandoff);
  ui.autoGrid.addEventListener("click", inspectGrid);
  ui.drawGridCell.addEventListener("click", function () {
    state.gridMode = "gridded";
    state.calibrating = !state.calibrating;
    state.verifyingGrid = false;
    state.drag = null;
    if (state.calibrating) state.gridVisible = false;
    syncGridControls();
    setStatus(state.calibrating
      ? "The generated overlay is hidden. Zoom in, then drag exactly one printed square from corner to opposite corner."
      : "Grid drawing cancelled.");
  });
  ui.verifyGrid.addEventListener("click", function () {
    state.verifyingGrid = true; state.calibrating = false; state.gridVisible = true; state.drag = null;
    syncGridControls(); setStatus("Click a matching printed-grid intersection near the far edge. This exposes accumulated size drift.");
  });
  ui.noGrid.addEventListener("click", function () {
    state.gridMode = "ungridded";
    state.calibrating = false;
    state.verifyingGrid = false;
    state.gridVisible = false;
    state.drag = null;
    clearReview();
    syncGridControls();
    ui.gridNote.className = "grid-note good";
    ui.gridNote.textContent = "No printed grid. The chosen map width becomes the tactical scale; the overlay can remain hidden.";
    setStatus("Choose the intended map width, then propose regions.");
  });
  [ui.gridCellPx, ui.gridOriginX, ui.gridOriginY, ui.targetColumns].forEach(function (input) {
    input.addEventListener("change", function () { state.gridVerified = false; clearReview(); renderOverlay(); });
  });
  ui.proposeRegions.addEventListener("click", propose);
  document.querySelectorAll("[data-draw-tool]").forEach(function (button) {
    button.addEventListener("click", function () {
      setTool(button.dataset.drawTool, true);
    });
  });
  document.querySelectorAll("[data-palette-tool]").forEach(function (button) {
    button.addEventListener("click", function () {
      setTool(button.dataset.paletteTool, true);
      renderTypePalette();
      if (state.selectionTool === "pan") closeTypePalette();
    });
  });
  document.querySelectorAll("[data-eraser-size]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.eraserSizeCells = Number(button.dataset.eraserSize);
      setTool("eraser", true); closeTypePalette();
    });
  });
  ui.paletteDeleteSelected.addEventListener("click", deleteSelectedRegion);
  ui.armedKit.addEventListener("click", function (event) {
    if (state.selectionTool !== "brush" && state.selectionTool !== "lasso") setTool("brush", false);
    openTypePalette(event.clientX, event.clientY);
  });
  ui.closeTypePalette.addEventListener("click", closeTypePalette);
  ui.drawHeightDown.addEventListener("click", function () { setDrawHeight(state.drawHeightFt - 5); });
  ui.drawHeightUp.addEventListener("click", function () { setDrawHeight(state.drawHeightFt + 5); });
  ui.paletteHeightDown.addEventListener("click", function () { setDrawHeight(state.drawHeightFt - 5); });
  ui.paletteHeightUp.addEventListener("click", function () { setDrawHeight(state.drawHeightFt + 5); });
  ui.selectedHeightDown.addEventListener("click", function () { adjustSelectedHeight(-5); });
  ui.selectedHeightUp.addEventListener("click", function () { adjustSelectedHeight(5); });
  ui.previewHeightDown.addEventListener("click", function () { adjustSelectedHeight(-5); });
  ui.previewHeightUp.addEventListener("click", function () { adjustSelectedHeight(5); });
  ui.closeHeightPopover.addEventListener("click", closeHeightPopover);
  ui.undoDraw.addEventListener("click", function () { restoreHistory(state.undoStack, state.redoStack, "Last authoring gesture undone"); });
  ui.redoDraw.addEventListener("click", function () { restoreHistory(state.redoStack, state.undoStack, "Authoring gesture restored"); });
  ui.toggleGrid.addEventListener("click", function () { state.gridVisible = !state.gridVisible; updateGridReceipt(); renderOverlay(); });
  ui.zoomIn.addEventListener("click", function () { state.zoom *= 1.25; applyZoom(); });
  ui.zoomOut.addEventListener("click", function () { state.zoom /= 1.25; applyZoom(); });
  ui.zoomFit.addEventListener("click", fitArtwork);
  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () { setView(button.dataset.view); });
  });
  ui.previewCanvas.addEventListener("click", function (event) {
    var hit = previewRegionAt(event);
    if (!hit) { closeHeightPopover(); return; }
    var region = state.review.regions.find(function (candidate) { return candidate.id === hit.id; });
    if (!region) return;
    state.selectedId = region.id;
    state.semanticType = region.type;
    state.semanticAppearance = region.appearance;
    state.drawHeightFt = region.topFt;
    renderAll();
    openHeightPopover(region, event.clientX, event.clientY);
    setStatus(region.label + " selected at " + region.topFt + " ft. Use −5 / +5 here to compare it with the scene.");
  });
  ui.overlayCanvas.addEventListener("contextmenu", function (event) {
    if (!state.review) return;
    event.preventDefault();
    if (state.selectionTool === "pointer") {
      var region = selectAuthoredAtPoint(canvasPoint(event));
      state.selectedId = region && region.id || state.selectedId;
      renderAll();
    }
    openTypePalette(event.clientX, event.clientY);
  });
  ui.overlayCanvas.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    var point = canvasPoint(event);
    ui.overlayCanvas.setPointerCapture && ui.overlayCanvas.setPointerCapture(event.pointerId);
    if (state.selectionTool === "pan") {
      state.panDrag = { x: event.clientX, y: event.clientY, left: ui.artView.scrollLeft, top: ui.artView.scrollTop };
      ui.canvasStack.classList.add("dragging"); return;
    }
    if (state.calibrating || state.verifyingGrid || state.selectionTool === "pointer") {
      state.drag = { startX: point.x, startY: point.y, endX: point.x, endY: point.y };
    } else if (state.selectionTool === "brush") {
      var brushCell = cellAtPoint(point);
      if (brushCell) state.gridDrag = { start: brushCell, end: brushCell };
    } else if (state.selectionTool === "lasso") state.lassoPoints = [[point.x, point.y]];
    else if (state.selectionTool === "eraser") {
      state.eraserCells = []; state.lastEraserCell = null; addEraserAt(point);
    }
    renderOverlay();
  });
  ui.overlayCanvas.addEventListener("pointermove", function (event) {
    if (state.panDrag) {
      ui.artView.scrollLeft = state.panDrag.left - (event.clientX - state.panDrag.x);
      ui.artView.scrollTop = state.panDrag.top - (event.clientY - state.panDrag.y);
      return;
    }
    var point = canvasPoint(event);
    if (state.drag) { state.drag.endX = point.x; state.drag.endY = point.y; }
    if (state.gridDrag) {
      var brushCell = cellAtPoint(point);
      if (brushCell) state.gridDrag.end = brushCell;
    }
    if (state.lassoPoints) {
      var last = state.lassoPoints[state.lassoPoints.length - 1];
      if (Math.hypot(point.x - last[0], point.y - last[1]) > 3) state.lassoPoints.push([point.x, point.y]);
    }
    if (state.selectionTool === "eraser" && (event.buttons & 1)) addEraserAt(point);
    renderOverlay();
  });
  ui.overlayCanvas.addEventListener("pointerup", function (event) {
    if (event.button !== 0) return;
    var point = canvasPoint(event);
    if (state.panDrag) { state.panDrag = null; ui.canvasStack.classList.remove("dragging"); return; }
    if (state.calibrating) {
      if (!state.drag) return;
      finishCalibration(point);
      return;
    }
    if (state.verifyingGrid) { finishGridVerification(point); return; }
    if (state.selectionTool === "pointer") {
      state.drag = null;
      var region = selectAuthoredAtPoint(point);
      state.selectedId = region && region.id || null;
      if (region) {
        state.semanticType = region.type;
        state.semanticAppearance = region.appearance;
        state.drawHeightFt = region.topFt;
      }
      renderAll();
      setStatus(region ? region.label + " selected at " + region.topFt + " ft. Use −5 / +5 to compare its height." : "No drawn structure is present here; automatic hints remain reference only.");
      return;
    }
    state.drag = null;
    if (state.selectionTool === "brush" && state.gridDrag) finishGridBrush();
    else if (state.selectionTool === "lasso" && state.lassoPoints) { state.lassoPoints.push([point.x, point.y]); finishLasso(); }
    else if (state.selectionTool === "eraser" && state.eraserCells.length) finishEraser();
    else if (state.selectionTool === "zoom") zoomAtPoint(event, point);
  });
  ui.overlayCanvas.addEventListener("pointercancel", function () {
    state.drag = null; state.gridDrag = null; state.lassoPoints = null; state.eraserCells = [];
    state.lastEraserCell = null; state.panDrag = null; ui.canvasStack.classList.remove("dragging"); renderOverlay();
  });
  document.addEventListener("keydown", function (event) {
    var target = event.target;
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
    if (event.key === "Escape") {
      closeTypePalette(); closeHeightPopover(); state.calibrating = false; state.verifyingGrid = false;
      state.drag = null; state.gridDrag = null; state.lassoPoints = null; state.eraserCells = []; syncGridControls(); return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault(); deleteSelectedRegion(); return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    var key = event.key.toLowerCase();
    var tools = { v: "pointer", b: "brush", l: "lasso", e: "eraser", h: "pan", z: "zoom" };
    if (tools[key]) { event.preventDefault(); setTool(tools[key], true); closeTypePalette(); return; }
    if (key === "f") { event.preventDefault(); fitArtwork(); setStatus("Artwork fitted to view. Press Z to zoom from the map."); return; }
    if ((event.key === "[" || event.key === "]") && state.selectionTool === "eraser") {
      var sizes = [1, 3, 5], current = sizes.indexOf(state.eraserSizeCells);
      state.eraserSizeCells = sizes[clamp(current + (event.key === "]" ? 1 : -1), 0, sizes.length - 1)];
      setTool("eraser", true);
    }
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
