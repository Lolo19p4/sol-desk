/* Historique des contrôles réels, jamais d'ordres ni de clés. */
import fs from "node:fs";
import {pathToFileURL} from "node:url";
const FILE="signal_history.json";
const MAX_CHECKS=72;
const ALERT_CODES=new Set(["CASSURE_CONFIRMED_1H","CASSURE_EN_COURS","PROCHE_CASSURE"]);
export function mergeHistory(original,market){
  const stamp=Date.parse(market?.checked_at||"");
  if(!Number.isFinite(stamp)||!market||!market.assets||typeof market.assets!=="object")
    throw Error("Contrôle marché horodaté nécessaire");
  const assets={};
  const alerts=[];
  for(const symbol of ["SOL","BTC","ETH"]){
    const value=market.assets[symbol]||{};
    const status=value.status==="ok"?"ok":"error";
    const code=String(value.code||"SOURCE_INDISPONIBLE").slice(0,60);
    const price=Number(value.price);
    assets[symbol]={status,code,price:status==="ok"&&Number.isFinite(price)&&price>0?price:null};
    if(status==="ok"&&ALERT_CODES.has(code))alerts.push(symbol+": "+code);
  }
  const event={checked_at:new Date(stamp).toISOString(),status:market.status==="ok"?"ok":market.status==="partial"?"partial":"error",assets,alerts};
  const previous=Array.isArray(original?.checks)?original.checks:[];
  const checks=[event,...previous.filter(x=>x&&x.checked_at!==event.checked_at)]
    .filter(x=>Number.isFinite(Date.parse(x.checked_at||"")))
    .sort((a,b)=>Date.parse(b.checked_at)-Date.parse(a.checked_at))
    .slice(0,MAX_CHECKS);
  return {updated_at:event.checked_at,purpose:"Contrôles publics de marchés, sans ordre ni transaction",trading_executed:false,checks};
}
function main(){
  const market=JSON.parse(fs.readFileSync("market_signals.json","utf8"));
  let previous={checks:[]};
  if(fs.existsSync(FILE))previous=JSON.parse(fs.readFileSync(FILE,"utf8"));
  const result=mergeHistory(previous,market);
  fs.writeFileSync(FILE,JSON.stringify(result,null,2)+"\n");
  console.log("Historique scanner publié :",result.updated_at,"points",result.checks.length,
    "alertes",result.checks[0].alerts.length,"trades",result.trading_executed);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
