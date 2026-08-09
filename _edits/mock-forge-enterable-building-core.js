/* Enterable-building proof · pure stacked-place and transition authority.
   Browser: window.ForgeEnterableBuildingProof. Node: module.exports. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeEnterableBuildingProof = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function round(value, places) {
    var scale = Math.pow(10, places == null ? 3 : places);
    return Math.round(Number(value) * scale) / scale;
  }
  function surfaceById(scene, id) {
    return (scene.surfaces || []).find(function (surface) { return surface.id === id; }) || null;
  }
  function connectorById(scene, id) {
    return (scene.connectors || []).find(function (connector) { return connector.id === id; }) || null;
  }
  function positionKey(position) {
    return Number(position.c) + "," + Number(position.r) + "@" + String(position.surfaceId);
  }
  function renderDatum(scene) {
    var lowest = Math.min.apply(null, (scene.surfaces || []).map(function (surface) { return Number(surface.elevationFt); }));
    return { logicalFloorFt: lowest, offsetFt: lowest < 0 ? -lowest : 0 };
  }
  function toRenderElevation(scene, logicalFt) {
    return Number(logicalFt) + renderDatum(scene).offsetFt;
  }
  function interpolate(from, to, segments) {
    var points = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      points.push({
        x: round(from.x + (to.x - from.x) * t),
        y: round(from.y + (to.y - from.y) * t),
        c: Math.round(from.c + (to.c - from.c) * t),
        r: Math.round(from.r + (to.r - from.r) * t),
        elevationFt: round(from.elevationFt + (to.elevationFt - from.elevationFt) * t)
      });
    }
    return points;
  }
  function deriveConnector(scene, input) {
    var fromSurface = surfaceById(scene, input.from.surfaceId);
    var toSurface = surfaceById(scene, input.to.surfaceId);
    if (!fromSurface || !toSurface) throw new Error("Connector " + input.id + " names an unknown landing surface.");
    var from = Object.assign({}, input.from, { elevationFt: Number(fromSurface.elevationFt) });
    var to = Object.assign({}, input.to, { elevationFt: Number(toSurface.elevationFt) });
    var riseFt = to.elevationFt - from.elevationFt;
    var segments = input.kind === "stairs" ? Math.max(1, Math.ceil(Math.abs(riseFt) / 2.5)) : 1;
    return {
      id: input.id,
      label: input.label,
      kind: input.kind,
      from: from,
      to: to,
      riseFt: riseFt,
      segments: segments,
      path: interpolate(from, to, segments),
      authoredFacts: ["from.surfaceId", "to.surfaceId"],
      derivedFacts: ["riseFt", "path[].elevationFt"]
    };
  }
  function createScene() {
    var scene = {
      schema: "forge-stacked-place-proof/v1",
      version: 1,
      name: "The River Archive",
      cellFt: 5,
      surfaces: [
        { id: "surface-lower-garden", label: "Lower garden", shortLabel: "Lower garden", kind: "exterior", elevationFt: -10, relation: "10 ft below the courtyard", c: 2, r: 9, x: 1.4, y: 8.7, w: 3.5, h: 2.5 },
        { id: "surface-courtyard", label: "Courtyard", shortLabel: "Courtyard", kind: "exterior", elevationFt: 0, relation: "site datum", c: 5, r: 8, x: 4.1, y: 6.7, w: 4.2, h: 3.9 },
        { id: "surface-hall", label: "Archive hall", shortLabel: "Hall", kind: "interior", elevationFt: 0, relation: "same level as the courtyard", c: 7, r: 7, x: 6.7, y: 4.6, w: 4.6, h: 4.2 },
        { id: "surface-gallery", label: "Upper gallery", shortLabel: "Gallery", kind: "interior", elevationFt: 10, relation: "one floor above the hall", c: 7, r: 7, x: 6.7, y: 4.6, w: 4.6, h: 4.2 },
        { id: "surface-roof", label: "Archive roof", shortLabel: "Roof", kind: "roof", elevationFt: 20, relation: "one floor above the gallery", c: 7, r: 7, x: 6.5, y: 4.4, w: 5, h: 4.6, walkable: false }
      ],
      connectorSpecs: [
        { id: "connector-garden-stairs", label: "River stairs", kind: "stairs", from: { surfaceId: "surface-lower-garden", c: 3, r: 9, x: 3.2, y: 9.2 }, to: { surfaceId: "surface-courtyard", c: 5, r: 9, x: 5.2, y: 9.2 } },
        { id: "connector-front-door", label: "Archive door", kind: "door", from: { surfaceId: "surface-courtyard", c: 6, r: 8, x: 6.1, y: 7.7 }, to: { surfaceId: "surface-hall", c: 7, r: 8, x: 7.1, y: 7.7 } },
        { id: "connector-hall-gallery", label: "Gallery stairs", kind: "stairs", from: { surfaceId: "surface-hall", c: 9, r: 7, x: 9.8, y: 7.7 }, to: { surfaceId: "surface-gallery", c: 9, r: 5, x: 9.8, y: 5.2 } }
      ],
      objects: [
        { kind: "table", surfaceId: "surface-hall", x: 8.2, y: 6.4 },
        { kind: "shelf", surfaceId: "surface-hall", x: 7.1, y: 5.2 },
        { kind: "shelf", surfaceId: "surface-gallery", x: 8.0, y: 5.0 },
        { kind: "lectern", surfaceId: "surface-gallery", x: 9.6, y: 6.4 }
      ],
      meta: {
        authority: "isolated-proof",
        positionContract: "{c,r,surfaceId,elevationFt}",
        heightContract: "signed logical elevations; renderer offset is presentation only"
      }
    };
    scene.connectors = scene.connectorSpecs.map(function (spec) { return deriveConnector(scene, spec); });
    delete scene.connectorSpecs;
    return scene;
  }

  var ACTIONS = [
    { id: "enter", label: "Enter the archive", connectorId: "connector-front-door", from: "surface-courtyard", to: "surface-hall", narration: "The door owns the transition. The roof lifts and the near walls cut away." },
    { id: "climb", label: "Climb to the gallery", connectorId: "connector-hall-gallery", from: "surface-hall", to: "surface-gallery", narration: "The gallery landing supplies +10 ft. Four gradual stair segments are derived between the floors." },
    { id: "descend", label: "Return to the hall", connectorId: "connector-hall-gallery", from: "surface-gallery", to: "surface-hall", reverse: true, narration: "The same connector reverses cleanly; no second staircase height is authored." },
    { id: "exit", label: "Exit to the courtyard", connectorId: "connector-front-door", from: "surface-hall", to: "surface-courtyard", reverse: true, narration: "Outside again. The camera releases the room and the complete roof returns." },
    { id: "lower", label: "Descend to the lower garden", connectorId: "connector-garden-stairs", from: "surface-courtyard", to: "surface-lower-garden", reverse: true, narration: "The garden remains logically −10 ft. Only the renderer shifts it above its drawing floor." },
    { id: "rise", label: "Return to the courtyard", connectorId: "connector-garden-stairs", from: "surface-lower-garden", to: "surface-courtyard", narration: "The stair ends at the courtyard datum: exactly 0 ft, without rewriting the lower garden." }
  ];
  function actionById(id) { return ACTIONS.find(function (action) { return action.id === id; }) || null; }
  function presentationFor(surfaceId) {
    var inside = surfaceId === "surface-hall" || surfaceId === "surface-gallery";
    return {
      inside: inside,
      activeFloor: surfaceId === "surface-gallery" ? "gallery" : surfaceId === "surface-hall" ? "hall" : "exterior",
      roofOpacity: inside ? 0.08 : 1,
      nearWallOpacity: inside ? 0.1 : 1,
      cameraPreset: surfaceId === "surface-gallery" ? "gallery" : surfaceId === "surface-hall" ? "hall" : surfaceId === "surface-lower-garden" ? "lower" : "outside"
    };
  }
  function createState(scene) {
    scene = scene || createScene();
    var start = surfaceById(scene, "surface-courtyard");
    return {
      schema: "forge-enterable-building-state/v1",
      token: { id: "mira", name: "Mira", c: start.c, r: start.r, x: 5.3, y: 8.4, surfaceId: start.id, elevationFt: start.elevationFt },
      presentation: presentationFor(start.id),
      transition: null,
      eventLog: [{ kind: "placed", message: "Mira waits in the courtyard at the site datum." }]
    };
  }
  function availableActions(state) {
    return ACTIONS.map(function (action) {
      var available = action.from === state.token.surfaceId && !state.transition;
      return Object.assign({}, action, {
        available: available,
        reason: available ? "Ready" : state.transition ? "Finish the current transition first." : "Available from " + action.from.replace("surface-", "").replace(/-/g, " ") + "."
      });
    });
  }
  function orientedPath(connector, reverse) {
    var path = copy(connector.path);
    return reverse ? path.reverse() : path;
  }
  function performAction(scene, state, actionId) {
    var action = actionById(actionId);
    if (!action) return { ok: false, state: state, message: "That building action does not exist." };
    if (state.transition) return { ok: false, state: state, message: "Finish the current transition first." };
    if (state.token.surfaceId !== action.from) return { ok: false, state: state, message: action.label + " is unavailable from " + surfaceById(scene, state.token.surfaceId).label + "." };
    var connector = connectorById(scene, action.connectorId), destination = surfaceById(scene, action.to);
    if (!connector || !destination) return { ok: false, state: state, message: "The authored connection is incomplete." };
    var next = copy(state), path = orientedPath(connector, action.reverse);
    next.transition = { actionId: action.id, connectorId: connector.id, path: path, progress: 0 };
    next.presentation = presentationFor(destination.id);
    next.eventLog.push({ kind: "transition", connectorId: connector.id, message: action.narration });
    return { ok: true, state: next, action: copy(action), connector: copy(connector), message: action.narration };
  }
  function advanceTransition(scene, state, progress) {
    if (!state.transition) return copy(state);
    var next = copy(state), path = next.transition.path, clamped = Math.max(0, Math.min(1, Number(progress)));
    var scaled = clamped * (path.length - 1), index = Math.min(path.length - 2, Math.floor(scaled)), local = scaled - index;
    if (clamped === 1) { index = path.length - 2; local = 1; }
    var a = path[index], b = path[index + 1];
    next.token.x = round(a.x + (b.x - a.x) * local);
    next.token.y = round(a.y + (b.y - a.y) * local);
    next.token.elevationFt = round(a.elevationFt + (b.elevationFt - a.elevationFt) * local);
    next.transition.progress = clamped;
    if (clamped === 1) {
      var action = actionById(next.transition.actionId), destination = surfaceById(scene, action.to);
      next.token.c = destination.c; next.token.r = destination.r; next.token.x = b.x; next.token.y = b.y;
      next.token.surfaceId = destination.id; next.token.elevationFt = destination.elevationFt;
      next.transition = null;
    }
    return next;
  }
  function validateScene(scene) {
    var errors = [], ids = new Set();
    (scene.surfaces || []).forEach(function (surface) {
      if (!surface.id || ids.has(surface.id)) errors.push("Every surface needs a unique stable ID.");
      ids.add(surface.id);
      if (!Number.isFinite(Number(surface.elevationFt))) errors.push(surface.id + " has no finite logical elevation.");
    });
    (scene.connectors || []).forEach(function (connector) {
      var from = surfaceById(scene, connector.from.surfaceId), to = surfaceById(scene, connector.to.surfaceId);
      if (!from || !to) errors.push(connector.id + " names an unknown landing.");
      else {
        if (connector.from.elevationFt !== from.elevationFt || connector.to.elevationFt !== to.elevationFt) errors.push(connector.id + " does not inherit its landing elevations.");
        if (connector.riseFt !== to.elevationFt - from.elevationFt) errors.push(connector.id + " has an independently authored rise.");
      }
      if (!connector.path.length || connector.path[0].elevationFt !== connector.from.elevationFt || connector.path[connector.path.length - 1].elevationFt !== connector.to.elevationFt) errors.push(connector.id + " path misses a landing.");
    });
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    ACTIONS: copy(ACTIONS), copy: copy, surfaceById: surfaceById, connectorById: connectorById,
    positionKey: positionKey, renderDatum: renderDatum, toRenderElevation: toRenderElevation,
    interpolate: interpolate, deriveConnector: deriveConnector, createScene: createScene,
    createState: createState, availableActions: availableActions, performAction: performAction,
    advanceTransition: advanceTransition, presentationFor: presentationFor, validateScene: validateScene
  };
});
