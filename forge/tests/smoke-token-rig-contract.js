#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../index.html");
if(!fs.existsSync(file)){console.error("ABORT: run this smoke after applying the token-rig patch");process.exit(1);}
const s=fs.readFileSync(file,"utf8");let pass=0;
function ok(v,label){if(!v)throw new Error("FAIL: "+label);console.log("ok",++pass,"-",label);}
ok(s.includes('forge-unit-art.js?v=ua1'),"unit-art module is cache-stamped");
ok(s.includes('function makeTopToken(u)'),"flat token constructor exists");
ok(s.includes('new THREE.CircleGeometry(TOP_TOKEN_R,48)'),"top token is a map-space circle");
ok(s.includes("disc.rotation.x=-Math.PI/2"),"token lies flat on the battlefield");
ok(s.includes('function syncUnitVisual(u)'),"one visibility gate owns both representations");
ok(s.includes("u.sprite.visible=allowed&&!top"),"3D standee is the 3D representation");
ok(s.includes("u.topToken.visible=allowed&&top"),"flat token is the top-down representation");
ok(s.includes("typeof foeVisible==='function'&&!foeVisible(u)"),"future fog seam gates the entire unit rig");
ok(s.includes('syncAllUnitVisuals();   // top token follows'),"token follows the existing movement tween");
ok(s.includes('if(u.topToken)u.topToken.position.set'),"height restage positions token discs");
ok(s.includes('if(force)disposeTopToken(u);'),"forced sprite swaps do not leave token ghosts");
ok(s.includes('tokenArt: opts.tokenArt || null'),"authoritative token-art metadata rides on units");
ok(s.includes('(stateUnit&&stateUnit.tokenArt)||row.tokenArt||row.token_url||null'),"session/roster art metadata is honored");
ok(s.includes('id="tokenArtEdit"')&&s.includes('id="tokenArtAuto"'),"customization controls exist");
ok(s.includes('<option value="unit">This combatant only</option>'),"per-instance scope exists");
ok(s.includes('<option value="kind">Creature / character default</option>'),"per-kind scope exists");
ok(s.includes('id="ftaFile" type="file" accept="image/*"'),"local image upload is available");
ok(s.includes("c.toDataURL('image/webp',.88)"),"local images are square-cropped and compressed before storage");
ok(s.includes("(scope==='unit'&&other===u)"),"instance override rebuilds only the selected combatant");
ok(s.includes("scope==='kind'&&ua&&ua.overrideKey(other,'kind')===key"),"kind override rebuilds every matching creature or character");
ok(s.includes('function pickTopToken(anyState)'),"near-vertical tactical picking has a direct disc raycast");
ok(s.includes('pickTopToken(healPending) || pickUnit(healPending) || cellUnit'),"top-down picking precedes the existing 3D WYSIWYG picker");
ok(s.includes('u.topToken===obj||u.topRing===obj'),"God Mode and legacy raycast matchers recognize token rig objects");
ok(s.includes('t.topToken.material.color.setHex(0xff6b57)'),"hit flash reaches the top-down token");
ok(s.includes('window.__forgeTokenArt='),"browser diagnostic API is exposed");
ok(s.includes('unitRigVisible(u)'),"unit rig has one discovery-ready visibility seam");
console.log("\n"+pass+" token-rig contract checks green");
