/* En-tête fonds Solana : données publiques vérifiées, jamais de compte fictif.
 * Montant affiché = estimation SOL + USDC uniquement, autres actifs exclus.
 * Aucune clé et aucune transaction. Fonctionne même si l'API Jupiter est hors service.
 */
(function(){
"use strict";
const SOL_MINT="So11111111111111111111111111111111111111112";
const USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RPC=["https://solana-rpc.publicnode.com","https://api.mainnet-beta.solana.com"];
const PRICES=["https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT","https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT"];
const DEFAULT="FoFjucbrcvAK8bqYM3W4iKkorFJD6b2YuSScT2CzActx";
const el=id=>document.getElementById(id);
const money=n=>n.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2});
const amount=n=>n.toLocaleString("fr-FR",{maximumFractionDigits:6});
const valid=a=>typeof a==="string"&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
const cache=new Map();let busy=false,lastAddress="",lastRequestAt=0;
const timeout=ms=>{const c=new AbortController();const timer=setTimeout(()=>c.abort(),ms);return {signal:c.signal,stop:()=>clearTimeout(timer)}};
async function requestJson(url,options,ms=6500){
 const timer=timeout(ms);
 try{const response=await fetch(url,{...options,signal:timer.signal,cache:"no-store"});if(!response.ok)throw Error("HTTP "+response.status);return await response.json()}
 finally{timer.stop()}
}
async function rpc(method,params){
 const body=JSON.stringify({jsonrpc:"2.0",id:1,method,params});
 const all=RPC.map(host=>requestJson(host,{method:"POST",headers:{"content-type":"application/json"},body},6000).then(data=>{
  if(!data||data.error||!data.result)throw Error("Réponse RPC "+method+" invalide");return data.result;
 }));
 return Promise.any(all);
}
async function priceSol(){
 const all=PRICES.map(url=>requestJson(url,{},5000).then(data=>{
  const n=Number(data.price);if(!Number.isFinite(n)||n<=0)throw Error("Prix SOL invalide");return n
 }));
 return Promise.any(all);
}
function address(){
 const r=window.REAL;
 if(valid(r?.pk))return {id:r.pk,origin:"Phantom connecté"};
 if(valid(r?.watch))return {id:r.watch,origin:"Adresse publique suivie"};
 let w;try{w=localStorage.getItem("soldesk_watch")}catch(e){}
 if(valid(w))return {id:w,origin:"Adresse publique suivie"};
 return {id:DEFAULT,origin:"Ancienne adresse Sol Desk (propriété non vérifiée)"};
}
function showStatus(s){const box=el("funds-header-status");if(box)box.textContent=s}
function resetHeader(){
 el("funds-header-amount").textContent="—";
 el("funds-header-detail").textContent="Lecture publique SOL + USDC…";
}
function showData(addr,origin,result,stale=false){
 const {sol,usdc,solPrice,asOf}=result;
 const value=sol===0||Number.isFinite(solPrice)?usdc+sol*(solPrice||0):null;
 el("funds-header-amount").textContent=value==null?"—":money(value)+" $";
 el("funds-header-detail").textContent="SOL "+amount(sol)+" · USDC "+amount(usdc)+
   (sol>0&&!Number.isFinite(solPrice)?" · prix SOL indisponible":"");
 const label=origin+" · "+addr.slice(0,5)+"…"+addr.slice(-5);
 const t=new Date(asOf).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 showStatus(label+" · "+(stale?"Dernière lecture fiable ":"Vérifié à ")+t+
  " · Total partiel SOL + USDC uniquement (hors autres tokens, NFT et réseaux).");
}
async function refresh(force=false){
 if(document.hidden||busy)return;
 const active=address(),now=Date.now(),different=active.id!==lastAddress;
 if(!force&&!different&&now-lastRequestAt<20000)return;
 if(different){resetHeader();lastAddress=active.id}
 busy=true;lastRequestAt=now;
 try{
  showStatus("Lecture blockchain Solana pour "+active.origin+"…");
  const [native,tokens,quote]=await Promise.allSettled([
   rpc("getBalance",[active.id,{commitment:"confirmed"}]),
   rpc("getTokenAccountsByOwner",[active.id,{mint:USDC_MINT},{encoding:"jsonParsed",commitment:"confirmed"}]),
   priceSol()
  ]);
  if(native.status!=="fulfilled"||tokens.status!=="fulfilled")throw Error("Solde blockchain incomplet");
  if(active.id!==address().id)return; // portefeuille changé en cours de lecture
  const lamports=Number(native.value.value);
  if(!Number.isSafeInteger(lamports)||lamports<0)throw Error("Solde SOL non fiable");
  const tokenAccounts=tokens.value.value;
  if(!Array.isArray(tokenAccounts))throw Error("Réponse USDC non fiable");
  let usdc=0;
  for(const a of tokenAccounts){
   const info=a.account?.data?.parsed?.info;
   if(info?.mint!==USDC_MINT)throw Error("Compte USDC non reconnu");
   const qty=Number(info.tokenAmount?.uiAmountString);
   if(!Number.isFinite(qty)||qty<0)throw Error("Quantité USDC invalide");
   usdc+=qty;
  }
  const solPrice=quote.status==="fulfilled"?quote.value:null;
  const result={sol:lamports/1e9,usdc,solPrice,asOf:Date.now()};
  cache.set(active.id,result);
  showData(active.id,active.origin,result);
 }catch(e){
  if(active.id!==address().id)return;
  const saved=cache.get(active.id);
  if(saved)showData(active.id,active.origin,saved,true);
  else{
   resetHeader();
   showStatus(active.origin+" · "+active.id.slice(0,5)+"…"+active.id.slice(-5)+
    " · Solde indisponible : échec de la lecture RPC. Aucun montant supposé.");
  }
 }finally{busy=false}
}
const refreshBtn=el("funds-header-refresh");
if(refreshBtn)refreshBtn.addEventListener("click",()=>refresh(true));
const connectBtn=el("funds-header-connect");
if(connectBtn)connectBtn.addEventListener("click",()=>{
 const btn=el("conn");if(btn)btn.click();else showStatus("Le bouton de connexion Phantom est indisponible.");
});
refresh(true);
setInterval(()=>{
 if(document.hidden)return;
 const current=address();
 if(current.id!==lastAddress)refresh(true);
 else refresh(false);
},5000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh(true)});
})();