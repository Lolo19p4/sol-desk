/* Scanner expert de marché : données Binance réelles, lecture seule.
   Les cours bougent toutes les 15 s ; EMA, RSI et seuils sont recalculés
   sur bougies closes chaque minute. Aucun ordre n'est émis ici. */
(function(){
"use strict";
const root=document.getElementById("expert-radar");
if(!root)return;
const bases=["https://api.binance.com","https://data-api.binance.vision"];
const pairs=[["SOL","SOLUSDT"],["BTC","BTCUSDT"],["ETH","ETHUSDT"]];
const state={};let running=false,lastCandles=0,lastPrice=0,lastError="";
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString("fr-FR",{maximumFractionDigits:d}):"—";
async function fetchJson(path){
 let last;
 for(const base of bases){
  try{const ctrl=new AbortController(),to=setTimeout(()=>ctrl.abort(),9000);
   try{const r=await fetch(base+path,{cache:"no-store",signal:ctrl.signal});
    if(!r.ok)throw Error("HTTP "+r.status);
    const j=await r.json();if(!Array.isArray(j)&&typeof j!=="object")throw Error("Format invalide");return j;
   }finally{clearTimeout(to)}
  }catch(e){last=e}
 }
 throw last||Error("Cours indisponible");
}
async function candles(sym,tf,n){
 const raw=await fetchJson("/api/v3/klines?symbol="+sym+"&interval="+tf+"&limit="+n);
 if(!Array.isArray(raw))throw Error("Bougies non reconnues");
 const now=Date.now();
 return raw.filter(x=>Number(x[6])<=now).map(x=>({c:Number(x[4]),h:Number(x[2]),t:Number(x[6])}))
 .filter(x=>Number.isFinite(x.c)&&Number.isFinite(x.h));
}
function ema(v,n){
 if(v.length<n)return null;
 let a=v.slice(0,n).reduce((x,y)=>x+y,0)/n,k=2/(n+1);
 for(let i=n;i<v.length;i++)a=v[i]*k+a*(1-k);
 return a;
}
function rsi(v,n=14){
 if(v.length<n+1)return null;
 let up=0,down=0;
 for(let i=1;i<=n;i++){let d=v[i]-v[i-1];up+=Math.max(0,d);down+=Math.max(0,-d)}
 up/=n;down/=n;
 for(let i=n+1;i<v.length;i++){let d=v[i]-v[i-1];up=(up*(n-1)+Math.max(0,d))/n;down=(down*(n-1)+Math.max(0,-d))/n}
 return down===0?(up===0?50:100):100-100/(1+up/down);
}
function signal(x){
 if(!x||!Number.isFinite(x.price)||!Number.isFinite(x.high24)||x.high24<=0||Date.now()-(x.candlesAt||0)>120000)return ["indisponible","Cours, seuil ou analyse récente absent"];
 if(!x.regime)return ["attente","Prix sous EMA50 4 h ou tendance 4 h non confirmée"];
 if(!x.fastTrend)return ["attente","EMA9 5 min pas encore au-dessus de EMA21"];
 if(!Number.isFinite(x.rsi)||x.rsi<40||x.rsi>70)return ["prudence","RSI 15 min hors zone 40–70"];
 if(x.confirmed)return ["confirmé","Cassure confirmée par la dernière clôture 1 h"];
 if(x.price>=x.high24)return ["surveillance","Cassure en cours, attendre clôture 1 h"];
 if(x.price>=x.high24*0.99)return ["préalerte","Moins de 1 % sous le plus haut précédent des 24 h"];
 return ["attente","Tendance favorable, cassure encore éloignée"];
}
function render(){
 const st=$("expert-state"),tbody=$("expert-rows");tbody.replaceChildren();
 let ready=0;let alerts=0;
 for(const [id] of pairs){
  const x=state[id],tr=document.createElement("tr");
  const status=x?signal(x):["indisponible","Analyse non chargée"];
  if(x&&Number.isFinite(x.price)&&Number.isFinite(x.high24))ready++;
  if(["confirmé","surveillance","préalerte"].includes(status[0]))alerts++;
  const fields=[
   id,
   x?fmt(x.price,id==="BTC"?2:4)+" $":"—",
   x&&x.high24?fmt((x.price/x.high24-1)*100,2)+" %":"—",
   x?fmt(x.rsi,1):"—",
   status[0],
   status[1]
  ];
  for(let j=0;j<fields.length;j++){
   const td=document.createElement("td");td.textContent=fields[j];if(j===4)td.className=status[0]==="confirmé"?"ok":status[0]==="prudence"?"ko":"";
   tr.appendChild(td);
  }
  tbody.appendChild(tr);
 }
 const age=Math.max(Date.now()-lastCandles,Date.now()-lastPrice);
 if(!ready)st.textContent="Cours non vérifiables. "+(lastError||"En attente de données réelles.");
 else if(age>120000)st.textContent="DONNÉES PÉRIMÉES — dernier point "+new Date(Math.min(lastCandles,lastPrice)).toLocaleTimeString("fr-FR")+". Aucun signal fiable.";
 else st.textContent="Données Binance · "+ready+"/3 actifs vérifiés · "+alerts+" préalertes/cassures · prix à "+new Date(lastPrice).toLocaleTimeString("fr-FR")+", bougies à "+new Date(lastCandles).toLocaleTimeString("fr-FR")+". Aucun achat automatique.";
}
async function updateCandles(){
 if(running||document.hidden)return;
 running=true;
 try{
 const results=await Promise.allSettled(pairs.map(async ([id,sym])=>{
  const [h1,h4,m5,m15]=await Promise.all([candles(sym,"1h",27),candles(sym,"4h",70),candles(sym,"5m",70),candles(sym,"15m",50)]);
  if(h1.length<25||h4.length<56||m5.length<23||m15.length<16)throw Error("Historique incomplet");
  const previous=h1.slice(-25,-1),high24=Math.max(...previous.map(z=>z.h));
  const close4=h4.map(z=>z.c),ema50=ema(close4,50);
  const ema50Before=ema(close4.slice(0,-6),50);
  const c4=close4[close4.length-1],m5prices=m5.map(z=>z.c),last1=h1[h1.length-1].c;
  const obj={
    high24,regime:c4>ema50&&ema50>=ema50Before,
    fastTrend:ema(m5prices,9)>ema(m5prices,21),
    rsi:rsi(m15.map(z=>z.c)),confirmed:last1>high24,
    candlesAt:Date.now(),price:state[id]?.price||last1
  };
  state[id]=obj;
 }));
 if(results.every(x=>x.status==="rejected"))throw Error("Bougies indisponibles sur les 3 actifs");
 lastCandles=Date.now();const failures=results.filter(x=>x.status==="rejected").length;lastError=failures?failures+" actif(s) sans bougies : signaux incomplets.":"";
 }catch(e){lastError=e.message||String(e)}
 finally{running=false;render()}
}
async function updatePrices(){
 if(document.hidden)return;
 try{
  const data=await fetchJson("/api/v3/ticker/price?symbols="+encodeURIComponent(JSON.stringify(pairs.map(z=>z[1]))));
  if(!Array.isArray(data))throw Error("Cours invalides");
  let n=0;
  for(const [id,sym] of pairs){const v=data.find(z=>z.symbol===sym),p=Number(v?.price);if(Number.isFinite(p)&&p>0&&state[id]){state[id].price=p;n++}}
  if(n>0){lastPrice=Date.now();lastError=""}else throw Error("Aucun cours exploitable");
 }catch(e){lastError=e.message||String(e)}
 render();
}
async function refresh(){await updateCandles();await updatePrices()}
$("expert-refresh").addEventListener("click",refresh);
refresh();
setInterval(updatePrices,15000);
setInterval(updateCandles,60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
})();