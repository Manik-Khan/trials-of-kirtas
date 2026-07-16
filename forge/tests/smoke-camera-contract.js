#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(process.argv[2]||path.join(__dirname,"..","index.html"));
const s=fs.readFileSync(file,"utf8");let n=0;
function ok(v,m){if(!v)throw new Error("FAIL: "+m);console.log("ok",++n,"-",m);}
ok(s.includes("new THREE.PerspectiveCamera(38,1,0.1,900)"),"existing perspective camera remains authoritative");
ok(!s.includes("new THREE.OrthographicCamera("),"top-down does not create a second renderer camera");
ok(s.includes("CAM_VIEW_3D='3d'")&&s.includes("CAM_VIEW_TOP='top'"),"3D and top-down presets exist");
ok(s.includes("CAM_TOP_PHI=0.055"),"top-down avoids the exact vertical singularity");
ok(s.includes('id="cameraViewToggle"'),"view toggle is present in the local camera panel");
ok(s.includes("camera.getWorldDirection(forward)"),"pan is camera-relative after orbit");
ok(s.includes("e.shiftKey||e.button===1"),"Shift-drag and middle-drag pan without stealing right-click targeting");
ok(s.includes("const cameraTouches=new Map()")&&s.includes("pinchGap/gap"),"touch supports two-finger pan and pinch zoom");
ok(s.includes("cameraFollowTurn(u);"),"turn start re-engages active-unit follow");
ok(s.includes("cameraFollowTick();   // Phase 1.5"),"follow tracks tweened movement continuously");
ok(s.includes("frameCameraPair(a,t)"),"target selection frames attacker and target");
ok(s.includes("Overview is available to the overseer only"),"full-map overview explains its player gate");
ok(s.includes("focusUnit(tu,'focus')"),"map token selection focuses the selected unit");
ok(s.includes("cam.view!==CAM_VIEW_TOP || o.kind==='sky'"),"top-down hides horizon cards while retaining the sky backdrop");
ok(s.includes("window.__forgeCamera="),"camera state is exposed for browser diagnostics");
console.log("\n"+n+" camera contract checks green");
