(function () {
  "use strict";
  var Core = window.ForgeEnterableBuildingProof;
  if (!Core) throw new Error("Enterable-building proof core did not load.");
  var scene = Core.createScene(), state = Core.createState(scene), animation = null;
  var canvas = document.getElementById("stage"), ctx = canvas.getContext("2d");
  var ui = {
    actions: document.getElementById("actions"), surfaceStack: document.getElementById("surfaceStack"),
    placeName: document.getElementById("placeName"), placeRelation: document.getElementById("placeRelation"), cameraMode: document.getElementById("cameraMode"),
    narration: document.getElementById("narration"), nextStop: document.getElementById("nextStop"), reset: document.getElementById("resetProof"),
    receiptState: document.getElementById("receiptState"), receiptSurface: document.getElementById("receiptSurface"), receiptLogical: document.getElementById("receiptLogical"),
    receiptRender: document.getElementById("receiptRender"), receiptShell: document.getElementById("receiptShell"), positionKey: document.getElementById("positionKey")
  };
  var camera = { x: 7, y: 7.1, zoom: 1, targetX: 7, targetY: 7.1, targetZoom: 1 };
  var colors = { ground: "#28382f", earth: "#17231e", stone: "#8d846d", stoneSide: "#625d4f", active: "#c9aa63", roof: "#665c52", roofLight: "#8a7864", water: "#1d595c", wood: "#8c6744", dark: "#171d1a" };

  function resize() {
    var rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function metrics() {
    var rect = canvas.getBoundingClientRect(), tile = Math.min(rect.width / 16.5, rect.height / 10.8) * camera.zoom;
    return { width: rect.width, height: rect.height, tileW: tile, tileH: tile * .5, heightScale: tile * .105, cx: rect.width * .5, cy: rect.height * .48 };
  }
  function project(x, y, logicalFt) {
    var m = metrics(), elevation = Core.toRenderElevation(scene, logicalFt);
    return { x: m.cx + ((x - camera.x) - (y - camera.y)) * m.tileW * .5, y: m.cy + ((x - camera.x) + (y - camera.y)) * m.tileH * .5 - elevation * m.heightScale, m: m };
  }
  function polygon(points, fill, stroke, alpha) {
    if (!points.length) return;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(function (point) { ctx.lineTo(point.x, point.y); }); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  }
  function diamond(x, y, w, h, z, fill, stroke, alpha) {
    polygon([project(x,y,z),project(x+w,y,z),project(x+w,y+h,z),project(x,y+h,z)],fill,stroke,alpha);
  }
  function prism(x, y, w, h, bottomFt, topFt, top, side, alpha) {
    var a = project(x,y,bottomFt), b = project(x+w,y,bottomFt), c = project(x+w,y+h,bottomFt), d = project(x,y+h,bottomFt);
    var A = project(x,y,topFt), B = project(x+w,y,topFt), C = project(x+w,y+h,topFt), D = project(x,y+h,topFt);
    polygon([b,c,C,B],side,null,alpha); polygon([c,d,D,C],side,null,alpha); polygon([A,B,C,D],top,"rgba(238,223,188,.14)",alpha);
  }
  function line3(points, color, width, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath();
    points.forEach(function (point, index) { var p = project(point.x, point.y, point.elevationFt); if (index) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); }); ctx.stroke(); ctx.restore();
  }
  function ground() {
    diamond(-1,-1,17,15,0,colors.ground,"rgba(211,197,157,.06)",1);
    for (var i = 0; i <= 16; i++) line3([{x:i,y:-1,elevationFt:.03},{x:i,y:14,elevationFt:.03}],"rgba(210,199,167,.06)",1);
    for (var j = 0; j <= 14; j++) line3([{x:-1,y:j,elevationFt:.03},{x:16,y:j,elevationFt:.03}],"rgba(210,199,167,.06)",1);
    diamond(.5,8,4.6,3.4,-10,"#173f42","rgba(117,183,179,.25)",1);
    diamond(.9,8.35,3.7,2.55,-9.8,colors.water,"rgba(150,211,202,.28)",1);
    for (var k = 0; k < 8; k++) {
      var x = 1.1 + k * .42; line3([{x:x,y:8.65,elevationFt:-9.7},{x:x+.55,y:10.2,elevationFt:-9.7}],"rgba(170,229,211,.12)",1);
    }
    diamond(4.1,6.7,4.2,3.9,0,"#79735f","rgba(225,209,171,.2)",1);
    for (var p = 0; p < 7; p++) line3([{x:4.2+p*.6,y:6.8,elevationFt:.05},{x:4.2+p*.6,y:10.45,elevationFt:.05}],"rgba(234,218,183,.1)",1);
  }
  function drawConnector(connector, active) {
    var path = connector.path;
    if (connector.kind === "stairs") {
      path.slice(0,-1).forEach(function (point, index) {
        var next = path[index+1], z = Math.max(point.elevationFt,next.elevationFt);
        var dx = (next.x-point.x) / Math.max(1,connector.segments), dy = (next.y-point.y) / Math.max(1,connector.segments);
        diamond(point.x-.18,point.y-.3,Math.max(.36,Math.abs(dx)+.36),Math.max(.55,Math.abs(dy)+.5),z,active?"#d4b36b":"#8d8168","rgba(242,220,168,.25)",active?1:.58);
      });
    }
    line3(path,active?"#efd081":"rgba(202,176,112,.45)",active?3:1.5,active?1:.7);
  }
  function wallSegment(a, b, bottom, top, alpha) {
    var width = .13;
    if (Math.abs(a.x-b.x) > Math.abs(a.y-b.y)) prism(Math.min(a.x,b.x),a.y-width/2,Math.abs(a.x-b.x),width,bottom,top,colors.stone,colors.stoneSide,alpha);
    else prism(a.x-width/2,Math.min(a.y,b.y),width,Math.abs(a.y-b.y),bottom,top,colors.stone,colors.stoneSide,alpha);
  }
  function furniture(surfaceId, alpha) {
    scene.objects.filter(function (object) { return object.surfaceId === surfaceId; }).forEach(function (object) {
      var z = Core.surfaceById(scene,surfaceId).elevationFt;
      if (object.kind === "table") prism(object.x,object.y,.9,.55,z,z+2.5,colors.wood,"#503b2a",alpha);
      else if (object.kind === "shelf") prism(object.x,object.y,.28,1.1,z,z+5.8,"#805b38","#4e3826",alpha);
      else prism(object.x,object.y,.45,.45,z,z+3.7,colors.wood,"#4e3826",alpha);
    });
  }
  function building() {
    var pres = state.presentation, hallActive = pres.activeFloor === "hall", galleryActive = pres.activeFloor === "gallery";
    prism(6.7,4.6,4.6,4.2,0,.6,hallActive?colors.active:"#79715d",colors.stoneSide,1);
    diamond(6.82,4.72,4.36,3.96,.63,hallActive?"#aa9160":"#746d5a","rgba(236,216,172,.16)",1);
    furniture("surface-hall",pres.inside?(hallActive?1:.28):.05);
    var nearAlpha = pres.nearWallOpacity, farAlpha = pres.inside?.86:1;
    wallSegment({x:6.7,y:4.6},{x:11.3,y:4.6},0,10,farAlpha);
    wallSegment({x:11.3,y:4.6},{x:11.3,y:8.8},0,10,farAlpha);
    wallSegment({x:6.7,y:4.6},{x:6.7,y:8.8},0,10,nearAlpha);
    wallSegment({x:6.7,y:8.8},{x:11.3,y:8.8},0,10,nearAlpha);
    prism(6.7,4.6,4.6,4.2,9.8,10.35,galleryActive?colors.active:"#786f5c",colors.stoneSide,pres.inside?1:.96);
    diamond(6.82,4.72,4.36,3.96,10.38,galleryActive?"#b99a61":"#746d5a","rgba(236,216,172,.16)",pres.inside?1:.9);
    furniture("surface-gallery",pres.inside?(galleryActive?1:.32):.03);
    wallSegment({x:6.7,y:4.6},{x:11.3,y:4.6},10,20,farAlpha);
    wallSegment({x:11.3,y:4.6},{x:11.3,y:8.8},10,20,farAlpha);
    wallSegment({x:6.7,y:4.6},{x:6.7,y:8.8},10,20,nearAlpha);
    wallSegment({x:6.7,y:8.8},{x:11.3,y:8.8},10,20,nearAlpha);
    drawWindows(pres.inside?Math.max(.16,nearAlpha):1);
    if (pres.inside) drawConnector(Core.connectorById(scene,"connector-hall-gallery"),true);
    roof(pres.roofOpacity);
  }
  function drawWindows(alpha) {
    [[7.5,4.53],[9,4.53],[10.5,4.53]].forEach(function (pos) { prism(pos[0],pos[1],.48,.05,12.2,16.5,"#b9d8c5","#46675d",alpha); });
    [[7.5,8.82],[10.2,8.82]].forEach(function (pos) { prism(pos[0],pos[1],.48,.05,3.2,7.1,"#99c7b9","#46675d",alpha); });
    prism(6.66,7.35,.08,.75,0,7,"#322a22","#221d19",alpha);
  }
  function roof(alpha) {
    var z = 20.2;
    ctx.save(); ctx.globalAlpha = alpha;
    polygon([project(6.35,4.25,z),project(11.65,4.25,z),project(10.9,6.5,z+5.2),project(7.1,6.5,z+5.2)],colors.roofLight,"rgba(236,215,178,.16)",1);
    polygon([project(7.1,6.5,z+5.2),project(10.9,6.5,z+5.2),project(11.65,9.05,z),project(6.35,9.05,z)],colors.roof,"rgba(236,215,178,.16)",1);
    ctx.restore();
  }
  function token() {
    var p = project(state.token.x,state.token.y,state.token.elevationFt), m=p.m, radius=Math.max(7,m.tileW*.12);
    ctx.save(); ctx.shadowColor="rgba(115,190,174,.7)";ctx.shadowBlur=18;ctx.fillStyle="#79b7aa";ctx.beginPath();ctx.ellipse(p.x,p.y-radius*.42,radius,radius*.62,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#e6f1e9";ctx.beginPath();ctx.arc(p.x,p.y-radius*1.15,radius*.44,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#1b3934";ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle="#e8dfca";ctx.font="600 10px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("MIRA",p.x,p.y+radius*1.05);ctx.restore();
  }
  function renderScene() {
    resize(); var rect=canvas.getBoundingClientRect(); ctx.clearRect(0,0,rect.width,rect.height);
    var background=ctx.createLinearGradient(0,0,0,rect.height);background.addColorStop(0,"#13201c");background.addColorStop(1,"#07100e");ctx.fillStyle=background;ctx.fillRect(0,0,rect.width,rect.height);
    ground();
    scene.connectors.filter(function (connector) { return connector.id !== "connector-hall-gallery"; }).forEach(function (connector) { drawConnector(connector,state.transition&&state.transition.connectorId===connector.id); });
    building(); token();
  }
  function cameraTarget() {
    var preset=state.presentation.cameraPreset;
    if(preset==="hall")return{x:8.5,y:6.8,zoom:1.28};
    if(preset==="gallery")return{x:8.5,y:6.3,zoom:1.36};
    if(preset==="lower")return{x:4.3,y:8.3,zoom:1.15};
    return{x:7,y:7.1,zoom:1};
  }
  function updateCamera() {
    var target=cameraTarget();camera.targetX=target.x;camera.targetY=target.y;camera.targetZoom=target.zoom;
    camera.x+=(camera.targetX-camera.x)*.085;camera.y+=(camera.targetY-camera.y)*.085;camera.zoom+=(camera.targetZoom-camera.zoom)*.085;
  }
  function surfaceRows() {
    var surfaces=scene.surfaces.slice().sort(function(a,b){return b.elevationFt-a.elevationFt;});
    ui.surfaceStack.innerHTML=surfaces.map(function(surface){
      var active=surface.id===state.token.surfaceId;
      return '<div class="surface-row '+(active?'active':'')+'"><span></span><div><strong>'+surface.shortLabel+'</strong><small>'+surface.relation+'</small></div><b>'+(surface.elevationFt>0?'+':'')+surface.elevationFt+' ft</b></div>';
    }).join("");
  }
  function actionRows() {
    var actions=Core.availableActions(state);
    ui.actions.innerHTML=actions.map(function(action){
      return '<div class="action-row '+(action.available?'ready':'')+'"><button type="button" data-action="'+action.id+'" '+(action.available?'':'disabled')+'><b>'+action.label+'</b><i>→</i></button><small>'+action.reason+'</small></div>';
    }).join("");
    ui.actions.querySelectorAll("button:not(:disabled)").forEach(function(button){button.onclick=function(){begin(button.dataset.action);};});
    var next=actions.find(function(action){return action.available;});
    ui.nextStop.disabled=!next;ui.nextStop.dataset.action=next?next.id:"";ui.nextStop.querySelector("b").textContent=next?next.label+" →":"Transitioning…";
  }
  function updateUI(message) {
    var surface=Core.surfaceById(scene,state.token.surfaceId), datum=Core.renderDatum(scene), pres=state.presentation;
    ui.placeName.textContent=surface.label;ui.placeRelation.textContent=surface.relation+" · "+(surface.elevationFt>0?"+":"")+surface.elevationFt+" ft";
    ui.cameraMode.textContent=pres.inside?(pres.activeFloor==="gallery"?"Interior camera · upper floor isolated":"Interior camera · roof lifted and near wall cut away"):"Outside camera · complete building";
    ui.receiptState.textContent=pres.inside?"inside":"outside";ui.receiptSurface.textContent=state.token.surfaceId;ui.receiptLogical.textContent=(state.token.elevationFt>0?"+":"")+state.token.elevationFt+" ft";
    ui.receiptRender.textContent=Core.toRenderElevation(scene,state.token.elevationFt)+" ft ("+(datum.offsetFt?"+"+datum.offsetFt+" display offset":"no offset")+")";
    ui.receiptShell.textContent=Math.round(pres.roofOpacity*100)+"% / "+Math.round(pres.nearWallOpacity*100)+"%";ui.positionKey.textContent=Core.positionKey(state.token);
    if(message)ui.narration.innerHTML="<b>Transition recorded.</b><span>"+message+"</span>";
    surfaceRows();actionRows();
  }
  function begin(actionId) {
    if(animation)return;var result=Core.performAction(scene,state,actionId);if(!result.ok){updateUI(result.message);return;}
    state=result.state;animation={started:performance.now(),duration:result.connector.kind==="stairs"?1150:720,message:result.message};updateUI(result.message);
  }
  function loop(now) {
    if(animation){var elapsed=Math.min(1,(now-animation.started)/animation.duration),ease=elapsed<.5?2*elapsed*elapsed:1-Math.pow(-2*elapsed+2,2)/2;state=Core.advanceTransition(scene,state,ease);if(elapsed>=1){var message=animation.message;animation=null;updateUI(message);}}
    updateCamera();renderScene();requestAnimationFrame(loop);
  }
  ui.nextStop.onclick=function(){if(ui.nextStop.dataset.action)begin(ui.nextStop.dataset.action);};
  ui.reset.onclick=function(){animation=null;state=Core.createState(scene);camera={x:7,y:7.1,zoom:1,targetX:7,targetY:7.1,targetZoom:1};ui.narration.innerHTML="<b>Courtyard ready.</b><span>The authored building and signed elevations are restored.</span>";updateUI();};
  window.addEventListener("resize",resize);updateUI();requestAnimationFrame(loop);
  window.__enterableBuildingProofState=function(){return{scene:Core.copy(scene),state:Core.copy(state),camera:Core.copy(camera),valid:Core.validateScene(scene)};};
})();
