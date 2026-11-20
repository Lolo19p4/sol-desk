import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=name=>fs.readFileSync(name,"utf8");
for(const name of ["swap.js","live-layout.js","live-summary.js","real.js","expert-scanner.js"]){
  new vm.Script(read(name),{filename:name});
}
const html=read("index.html");
assert.match(html,/id="live-summary"/);
assert.match(html,/id="live-wallet"/);
assert.match(html,/live-layout\.js/);
assert.match(html,/live-summary\.js/);
assert(!html.includes('<script src="auto.js'),"No hidden automatic simulation");
const swap=read("swap.js");
assert.match(swap,/swap\/v2/);
assert.match(swap,/signTransaction/);
assert.match(swap,/requestId/);
assert(!swap.includes("FEE_ACCOUNT"),"No unverified 3 percent platform fee");
const real=read("real.js");
assert.match(real,/window\.SolDeskOpenSwap/);
assert.match(real,/setReal\(true\)/);
assert.match(real,/start\.click\(\)/);
const nodes={};
const el=id=>{
 if(!nodes[id]){
  nodes[id]={
   id, value:id==="ct_jeton"?"0":id==="ct_montant"?"5":"",
   disabled:false,textContent:"",innerHTML:"",className:"",
   classList:{toggle(){},add(){},remove(){}},
   attributes:{},setAttribute(k,v){this.attributes[k]=v},
   addEventListener(){},append(){},replaceChildren(){},
   scrollIntoView(){},
  };
 }
 return nodes[id];
};
const requests=[];
const sandbox={
  document:{getElementById:el,createElement:()=>({value:"",textContent:""})},
  window:{phantom:null,solana:null},
  fetch:async(url,options)=>{requests.push([String(url),options]);
    return {ok:true,status:200,json:async()=>({outAmount:"125000000",feeBps:2,router:"metis",requestId:"x",transaction:null})};},
  URLSearchParams,console,BigInt,Number,String,Uint8Array,
  setTimeout,clearTimeout,atob,btoa
};
vm.runInNewContext(swap,sandbox,{filename:"swap.js"});
await nodes.ct_devisBtn.onclick();
assert.equal(requests.length,1,"Quote fetched exactly once");
assert(requests[0][0].includes("/swap/v2/order?"),"Real Jupiter v2 order used");
assert(!requests[0][1]?.method,"Read-only quote request");
assert.match(nodes.ct_devis.textContent,/125/);
await nodes.ct_echanger.onclick();
assert.equal(requests.length,1,"No transaction transmitted without Phantom");
console.log("Interface de cotation et garde Phantom : OK");
