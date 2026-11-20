/* Affiche des performances HISTORIQUES déclarées. Lecture seule. */
(function(){
"use strict";
const root=document.getElementById("perf-history");
const calc=window.SolDeskPerformance;
if(!root||!calc)return;
const el=id=>document.getElementById(id);
const cash=v=>Number.isFinite(v)?v.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" $":"—";
const pct=v=>Number.isFinite(v)?(v*100).toLocaleString("fr-FR",{maximumFractionDigits:1})+" %":"—";
const num=v=>Number.isFinite(v)?v.toLocaleString("fr-FR",{maximumFractionDigits:2}):"—";
async function json(path){const r=await fetch(path+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);return r.json()}
function drawTable(arr){
 const body=el("perf-assets");body.replaceChildren();
 if(!arr.length){const tr=document.createElement("tr");const td=document.createElement("td");td.colSpan=5;td.textContent="Aucune vente avec résultat exploitable.";tr.appendChild(td);body.appendChild(tr);return}
 for(const a of arr){
  const tr=document.createElement("tr");
  for(const v of [a.asset,String(a.trades),String(a.wins),String(a.losses),cash(a.pnl)]){
   const td=document.createElement("td");td.textContent=v;tr.appendChild(td)
  }
  tr.lastElementChild.className=a.pnl<0?"ko":"ok";body.appendChild(tr)
 }
}
function put(id,value){el(id).textContent=String(value)}
let busy=false;
async function load(){
 if(busy)return;busy=true;
 try{
  const [tradesResult,statusResult]=await Promise.allSettled([json("trades.json"),json("status.json")]);
  if(tradesResult.status!=="fulfilled")throw Error("Journal des opérations indisponible");
  const source=tradesResult.value,metrics=calc.analyze(source.trades);
  put("perf-total",cash(metrics.pnl));
  put("perf-rate",pct(metrics.winRate));
  put("perf-profit",num(metrics.profitFactor));
  put("perf-closed",metrics.closed+" ventes");
  put("perf-losses",metrics.maxLossStreak+" pertes consécutives (historique)");
  drawTable(metrics.assets);
  let health="Moteur autonome : non vérifié";
  if(statusResult.status==="fulfilled"){
   const ms=Date.parse(statusResult.value.dernier_passage||"");
   const age=Date.now()-ms;
   if(Number.isFinite(age)&&age>=-300000&&age<=30*60000)health="Moteur : signal publié récemment, exécution non prouvée";
   else if(Number.isFinite(age)&&age>30*60000)health="Moteur non confirmé : dernier signal publié il y a "+Math.floor(age/60000)+" min";
  }
  const stamp=source.maj||"date inconnue";
  put("perf-status",metrics.closed+" ventes avec P&L déclaré · fichier mis à jour "+stamp+" · "+health+". Les fonds détenus dans Phantom et les frais non enregistrés ne sont pas inclus.");
 }catch(e){put("perf-status","Statistiques non vérifiables : "+(e.message||String(e))+". Aucun résultat inventé.")}
 finally{busy=false}
}
el("perf-refresh").addEventListener("click",load);
load();
setInterval(()=>{if(!document.hidden)load()},60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
})();
