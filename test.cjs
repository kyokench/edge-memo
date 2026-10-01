const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const elements = new Map();
function element() { return {value:"", textContent:"", hidden:false, disabled:false, files:[], children:[], setAttribute(k,v){this[k]=v}, replaceChildren(){this.children=[]}, append(...v){this.children.push(...v)}, focus(){}, click(){}}; }
const document = {getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll(){return [...elements.values()]}};
let saved;
const context = vm.createContext({document,console,structuredClone,crypto:require("node:crypto").webcrypto,Blob,URL,setTimeout:()=>{},confirm:()=>true,chrome:{storage:{local:{get:async()=>saved ? ({memoData:structuredClone(saved)}) : ({}),set:async v=>{saved=structuredClone(v.memoData)}}}}});
vm.runInContext(fs.readFileSync(__dirname+"/backup.js","utf8"),context);
vm.runInContext(fs.readFileSync(__dirname+"/popup.js","utf8"),context);
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve))};
const $=id=>document.getElementById(id);
(async()=>{
 await flush();
 assert.equal($("tempPanel").hidden,false);
 $("scratch").value="一時メモ";$("scratch").oninput();await flush();assert.equal(saved.scratch,"一時メモ");
 $("newNote").onclick();$("title").value="テスト";$("body").value="<script>安全な文字列</script>";$("editor").onsubmit({preventDefault(){}});await flush();assert.equal(saved.notes.length,1);
 $("list").children[0].onclick({target:{closest:()=>null}});
 assert.equal($("viewer").hidden,false);assert.equal($("viewBody").textContent,"<script>安全な文字列</script>");
 assert.equal($("list").hidden,true);
 $("backToList").onclick();assert.equal($("viewer").hidden,true);assert.equal($("list").hidden,false);
 const card=$("list").children[0];card.onkeydown({target:card,key:"Enter",preventDefault(){}});
 assert.equal($("viewer").hidden,false);$("editViewed").onclick();assert.equal($("editor").hidden,false);assert.equal($("viewer").hidden,true);
 $("body").value="編集済み";$("editor").onsubmit({preventDefault(){}});await flush();assert.equal(saved.notes[0].body,"編集済み");
 $("list").children[0].children[2].children[2].onclick();await flush();assert.equal(saved.notes.length,0);
 const backup={format:"edge-two-memos",version:1,scratch:"取込",notes:[{title:"取込メモ",body:"本文",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]};
 $("file").files=[{size:500,text:async()=>JSON.stringify(backup)}];$("file").onchange();await flush();assert.equal(saved.notes.length,1);assert.equal(saved.scratch,"一時メモ\n\n取込");
 const before=JSON.stringify(saved);$("file").files=[{size:1,text:async()=>JSON.stringify({format:"invalid"})}];$("file").onchange();await flush();assert.equal(JSON.stringify(saved),before);
 $("export").onclick();await flush();assert.match($("status").textContent,/エクスポート/);
 $("clearTemp").onclick();await flush();assert.equal(saved.scratch,"");
 const html=context.createMemoBackupHtml({scratch:"<script>alert(1)</script>&",notes:[{title:"<img onerror=x>",body:"本文\n2行目",updatedAt:"2026-10-01T00:00:00Z"} ]});
 assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;&amp;"));
 assert.ok(html.includes("&lt;img onerror=x&gt;"));
 assert.ok(!html.includes("<script>"));assert.ok(!html.includes('src="'));
 assert.ok(html.includes("本文\n2行目"));
 $("exportHtml").onclick();await flush();assert.match($("status").textContent,/HTML/);
 console.log("PASS: default tab, autosave, create, edit, delete, import merge, invalid import, export, clear");
})().catch(error=>{console.error(error);process.exitCode=1});



