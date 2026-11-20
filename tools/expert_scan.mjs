// Lecture publique des marchés ; n'envoie jamais d'ordre ni de transaction.
import {writeFileSync} from 'node:fs';
const bases=['https://data-api.binance.vision','https://api.binance.com'],assets=[['SOL','SOLUSDT'],['BTC','BTCUSDT'],['ETH','ETHUSDT']];
const now=Date.now();
async function api(path){let last;for(const base of bases){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(base+path,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.json()}catch(e){last=e}finally{clearTimeout(timer)}}throw last||Error('Source indisponible')}
async function candles(symbol,tf,n){const rows=await api('/api/v3/klines?symbol='+symbol+'&interval='+tf+'&limit='+n);if(!Array.isArray(rows))throw Error('Bougies invalides');return rows.filter(v=>+v[6]<=now).map(v=>({c:+v[4],h:+v[2],t:+v[6]})).filter(v=>Number.isFinite(v.c)&&Number.isFinite(v.h)&&v.c>0)}
function ema(v,n){if(v.length<n)return null;let a=v.slice(0,n).reduce((s,t)=>s+t,0)/n;for(let i=n;i<v.length;i++)a=v[i]*(2/(n+1))+a*(1-2/(n+1));return a}
function rsi(v,n=14){if(v.length<=n)return null;let u=0,d=0;for(let i=1;i<=n;i++){const v0=v[i]-v[i-1];u+=Math.max(0,v0);d+=Math.max(0,-v0)}u/=n;d/=n;for(let i=n+1;i<v.length;i++){const delta=v[i]-v[i-1];u=(u*(n-1)+Math.max(0,delta))/n;d=(d*(n-1)+Math.max(0,-delta))/n}return d===0?(u===0?50:100):100-100/(1+u/d)}
async function analyze(symbol){
const [h1,h4,m5,m15,t]=await Promise.all([candles(symbol,'1h',27),candles(symbol,'4h',70),candles(symbol,'5m',70),candles(symbol,'15m',50),api('/api/v3/ticker/price?symbol='+symbol)]);
if(h1.length<25||h4.length<56||m5.length<23||m15.length<16)throw Error('Historique incomplet');
const c4=h4.map(v=>v.c), ema50=ema(c4,50),prior=ema(c4.slice(0,-6),50),price=+t.price,high24=Math.max(...h1.slice(-25,-1).map(v=>v.h)),r=rsi(m15.map(v=>v.c));
if(!Number.isFinite(price)||price<=0||!Number.isFinite(high24)||!Number.isFinite(ema50)||!Number.isFinite(prior)||!Number.isFinite(r))throw Error('Prix et indicateurs non fiables');
const regime=c4.at(-1)>ema50&&ema50>=prior,fast=ema(m5.map(v=>v.c),9)>ema(m5.map(v=>v.c),21),okRSI=r>=40&&r<=70,confirmed=h1.at(-1).c>high24;
const code=!regime?'REGIME_4H_INSUFFISANT':!fast?'EMA_5M_INSUFFISANTE':!okRSI?'RSI_HORS_ZONE':confirmed?'CASSURE_CONFIRMED_1H':price>=high24?'CASSURE_EN_COURS':price>=high24*0.99?'PROCHE_CASSURE':'EN_ATTENTE';
return {status:'ok',code,price,high24,distance_pct:+((price/high24-1)*100).toFixed(3),rsi15:+r.toFixed(2),regime_4h:regime,fast_trend_5m:fast,confirmed_1h:confirmed,latest_closed_1h:h1.at(-1).t};
}
const data={checked_at:new Date(now).toISOString(),source:'Binance cours spot et bougies closes',trading_executed:false,status:'ok',assets:{}};
const rows=await Promise.all(assets.map(async ([a,sym])=>{try{return [a,await analyze(sym)]}catch(e){return [a,{status:'error',code:'SOURCE_INDISPONIBLE',error:String(e.message||e).slice(0,160)}]}}));
for(const [a,v] of rows)data.assets[a]=v;
if(rows.some(([,v])=>v.status==='error'))data.status='partial';
if(rows.every(([,v])=>v.status==='error'))data.status='error';
writeFileSync('market_signals.json',JSON.stringify(data,null,2)+'\n');
console.log('Contrôle terminé',data.checked_at,data.status,rows.map(([a,v])=>a+':'+v.code).join(' ; '));
if(data.status!=='ok')console.log('::warning::Cours partiellement ou totalement indisponibles ; aucune valeur ne doit être inventée.');
