import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync("funds-header.js","utf8");
const WALLET="FoFjucbrcvAK8bqYM3W4iKkorFJD6b2YuSScT2CzActx";
const ALT="BSxnWLQadUHMW3uS1uiG7EbEdLbdfdX72Wq4RJ7bd13q";
const MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function makeElement(){return {textContent:"",events:{},addEventListener(type,fn){this.events[type]=fn}}}
async function runCase({sol=2,usdc=50,price=75,failRpc=false,failPrice=false,phantom=null}={}){
 const elements=new Map();
 const getElementById=id=>{if(!elements.has(id))elements.set(id,makeElement());return elements.get(id)};
 const rpcWallets=[];
 const fakeFetch=async (url,opt={})=>{
  if(String(url).includes("binance")){
   if(failPrice)throw Error("Cours absent");
   return {ok:true,json:async()=>({price:String(price)})}
  }
  if(failRpc)throw Error("No RPC");
  const rpc=JSON.parse(opt.body),address=rpc.params[0];rpcWallets.push(address);
  if(rpc.method==="getBalance")return {ok:true,json:async()=>({result:{value:sol*1e9}})};
  if(rpc.method==="getTokenAccountsByOwner"){
   return {ok:true,json:async()=>({result:{value:usdc>0?[{account:{data:{parsed:{info:{
    mint:MINT,tokenAmount:{uiAmountString:String(usdc)}
   }}}}}]:[]}})};
  }
  throw Error("Unexpected RPC method "+rpc.method);
 };
 const window={REAL:{pk:phantom,watch:WALLET}};
 const document={hidden:false,getElementById,addEventListener(){}};
 const ctx={window,document,fetch:fakeFetch,AbortController,setTimeout,clearTimeout,setInterval:()=>0,localStorage:{getItem:()=>null}};
 vm.runInNewContext(source,ctx,{timeout:2000});
 await new Promise(resolve=>setTimeout(resolve,55));
 const get=id=>getElementById(id).textContent;
 return {amount:get("funds-header-amount"),detail:get("funds-header-detail"),status:get("funds-header-status"),rpcWallets};
}
const normal=await runCase();
assert.equal(normal.amount,"200,00 $");
assert.match(normal.detail,/SOL 2.*USDC 50/);
assert.match(normal.status,/Total partiel SOL \+ USDC/);
const empty=await runCase({sol:0,usdc:0,failPrice:true});
assert.equal(empty.amount,"0,00 $");
const noPrice=await runCase({sol:2,usdc:50,failPrice:true});
assert.equal(noPrice.amount,"—");
assert.match(noPrice.detail,/prix SOL indisponible/);
const offline=await runCase({failRpc:true});
assert.equal(offline.amount,"—");
assert.match(offline.status,/Solde indisponible/);
const phantom=await runCase({phantom:ALT});
assert.ok(phantom.rpcWallets.length>=2);
assert.ok(phantom.rpcWallets.every(w=>w===ALT),"Phantom selected wallet must be used");
console.log("Fonds en haut : tests SOL+USDC, RPC indisponible, prix absent, Phantom connecté OK");
