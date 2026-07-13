#!/usr/bin/env node
"use strict";
let pass=0;function ok(v,m){if(!v)throw Error("FAIL: "+m);console.log("ok",++pass,"-",m);}
const old=global.fetch;let seen="",kind="image/webp";
global.fetch=async url=>{seen=url;return {ok:true,status:200,headers:{get:()=>kind},arrayBuffer:async()=>Buffer.from("RIFFfake")};};
const fn=require("../../netlify/functions/forge-token-art.js");
(async()=>{
 let r=await fn.handler({queryStringParameters:{source:"MM",name:"Goblin"}});
 ok(r.statusCode===200&&r.isBase64Encoded,"successful image is returned as base64");
 ok(seen==="https://5e.tools/img/bestiary/tokens/MM/Goblin.webp","proxy is restricted to the canonical bestiary-token path");
 ok(r.headers["access-control-allow-origin"]==="*","proxy response is WebGL/CORS clean");
 ok(/max-age=604800/.test(r.headers["cache-control"]),"token art is cacheable");
 r=await fn.handler({queryStringParameters:{source:"../bad",name:"Goblin"}});
 ok(r.statusCode===400,"source path traversal is rejected");
 r=await fn.handler({queryStringParameters:{source:"MM",name:"bad/name"}});
 ok(r.statusCode===400,"name path traversal is rejected");
 kind="text/html";
 r=await fn.handler({queryStringParameters:{source:"MM",name:"Goblin"}});
 ok(r.statusCode===502,"non-image upstream responses are rejected");
 console.log("\n",pass,"token-proxy checks green");
})().finally(()=>{global.fetch=old;});
