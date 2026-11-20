/* Contrôle cloud réel de SOL, BTC, ETH. Aucune clé, aucun ordre, aucune signature. */
import fs from "node:fs";

const HOSTS=["https://api.binance.com","https://data-api.binance.vision"];
const ASSETS=["SOL","BTC","ETH"];
const out=[];
async function json(path){
 let last;
 for(const host of HOSTS){
  try{
   const response=await fetch(host+path,{signal:AbortSignal.timeout(13000)});
   if(!response.ok)throw Error("HTTP "+response.status);
   return await response.json();
  }catch(e){last=e}
 }
 throw last||Error("Aucune source disponible");
}
async function candles(sym,tf,n){
 const raw=await json("/api/v3/klines?symbol="+sym+"&interval="+tf+"&limit="+n);
 if(!Array.isArray(raw))throw Error("Format de bougies non reconnu");
 return raw.filter(x=>Number(x[6])<=Date.now()).map(x=>({c:+x[4],h:+x[2]})).filter(x=>Number.isFinite(x.c)&&Number.isFinite(x.h));
}
function ema(v,n){
 if(v.length<n)return NaN;
 let x=v.slice(0,n).reduce((a,b)=>a+b,0)/n;const k=2/(n+1);
 for(let i=n;i<v.length;i++)x=v[i]*k+x*(1-k);
 return x;
}
function rsi(v,n=14){
 if(v.length<n+1)return NaN;
 let up=0,down=0;
 for(let i=1;i<=n;i++){const d=v[i]-v[i-1];up+=Math.max(0,d);down+=Math.max(0,-d)}
 up/=n;down/=n;
 for(let i=n+1;i<v.length;i++){const d=v[i]-v[i-1];up=(up*(n-1)+Math.max(0,d))/n;down=(down*(n-1)+Math.max(0,-d))/n}
 return down===0?(up===0?50:100):100-100/(1+up/down);
}
async function check(name){
 const sym=name+"USDT";
 const [hour,four,five,quarter,ticker]=await Promise.all([
  candles(sym,"1h",27),candles(sym,"4h",70),candles(sym,"5m",70),candles(sym,"15m",50),json("/api/v3/ticker/price?symbol="+sym)
 ]);
 if(hour.length<25||four.length<56||five.length<23||quarter.length<16)throw Error("Historique incomplet");
 const high24=Math.max(...hour.slice(-25,-1).map(v=>v.h));
 const price=Number(ticker.price),close4=four.map(v=>v.c),close5=five.map(v=>v.c);
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(high24)||high24<=0)throw Error("Cours invalide");
 const regime=close4.at(-1)>ema(close4,50)&&ema(close4,50)>=ema(close4.slice(0,-6),50);
 const fast=ema(close5,9)>ema(close5,21),rv=rsi(quarter.map(v=>v.c));
 const confirmed=hour.at(-1).c>high24,near=price>=high24*0.99,above=price>=high24;
 let signal="ATTENTE",why="Conditions pas toutes réunies";
 if(regime&&fast&&rv>=40&&rv<=70){
  if(confirmed){signal="CONFIRMÉ";why="Dernière clôture 1 h au-dessus du plus haut 24 h"}
  else if(above){signal="CASSURE EN COURS";why="Cours au-dessus du plus haut 24 h, clôture 1 h non confirmée"}
  else if(near){signal="PRÉALERTE";why="Cours à moins de 1 % du plus haut 24 h"}
 }
 return {asset:name,price,high24,rsi15:rv,regime4h:regime,ema5m:fast,signal,why,source:"Binance public",checkedAt:new Date().toISOString()};
}
const results=await Promise.allSettled(ASSETS.map(check));
for(let i=0;i<results.length;i++){
 const v=results[i];
 if(v.status==="fulfilled"){
  out.push(v.value);
  const x=v.value;
  const line=x.asset+": "+x.price.toFixed(4)+" USDT, RSI "+x.rsi15.toFixed(1)+", "+x.signal+" ("+x.why+")";
  console.log(line);
  if(x.signal!=="ATTENTE")console.log("::notice::"+line);
 }else console.log("::warning::"+ASSETS[i]+": source indisponible ou invalide — "+String(v.reason));
}
let bot="Pas de statut bot vérifié";
try{
 const status=JSON.parse(fs.readFileSync("status.json","utf8"));
 const ms=Date.parse(status.dernier_passage);
 if(Number.isFinite(ms)){
  const age=(Date.now()-ms)/60000;
  bot="Dernier passage Sol Desk déclaré : "+status.dernier_passage+" ("+age.toFixed(1)+" min).";
  if(age>30)console.log("::warning::Signal publié ancien, moteur Sol Desk 24h/24 non confirmé ("+age.toFixed(1)+" min)");
 }
}catch(e){console.log("::warning::Statut du bot illisible : "+String(e))}
const summary=[
 "# Radar crypto — contrôle réel",
 "",
 "- Vérification : "+new Date().toISOString(),
 "- Bot : "+bot,
 "- Source des cours : Binance, endpoints publics ; pas de trading.",
 "",
 "| Actif | Prix USDT | RSI 15 min | Etat |",
 "|---|---:|---:|---|",
 ...out.map(x=>"| "+x.asset+" | "+x.price.toFixed(4)+" | "+x.rsi15.toFixed(1)+" | "+x.signal+" |"),
 "",
 "Une préalerte n'est pas une promesse de gain ni une opération exécutée."
].join("\n");
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+"\n");
if(results.every(v=>v.status==="rejected")){console.error("Aucun cours fiable sur les 3 marchés");process.exitCode=1}
