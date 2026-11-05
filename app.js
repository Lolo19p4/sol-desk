const DS='https://api.dexscreener.com',RC='https://api.rugcheck.xyz/v1';
const K='soldesk_v2',CAP=60;try{localStorage.removeItem('soldesk_v1')}catch(e){}
function showBal(){const eq=S.bal+Object.values(S.pos).reduce((s,p)=>s+p.amt*(p.pts.at(-1).value/p.entry),0),g=eq-CAP;window.SIMG=g;if(window.REAL&&window.REAL.tot){const R=window.REAL,B=16.94,rg=R.tot-B;$('bal').textContent='$'+R.tot.toFixed(2)+' ('+(rg>=0?'+':'−')+'$'+Math.abs(rg).toFixed(2)+')';$('bal').style.color=rg>=0?'#4ade80':'#f87171';$('bal').nextElementSibling.textContent='Portefeuille réel (départ $16.94 = 11.30 + dépôt 5.64) · gains simulation '+(g>=0?'+':'−')+'$'+Math.abs(g).toFixed(2)}else{$('bal').textContent=(g>=0?'+':'−')+'$'+Math.abs(g).toFixed(2);$('bal').style.color=g>=0?'#4ade80':'#f87171'}}
setInterval(()=>{try{showBal()}catch(e){}},5000);
let S=null;try{S=JSON.parse(localStorage.getItem(K)||'null')}catch(e){}S=S||{bal:60,pos:{},hist:[],stats:{seen:0,killed:0,scored:0,trades:0,wins:0,losses:0},done:{},log:[]};
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}};
const $=id=>document.getElementById(id);
const series={};let running=false,timer;
function log(m){S.log.unshift(new Date().toLocaleTimeString('fr-FR')+'  '+m);S.log=S.log.slice(0,300);save();$('log').textContent=S.log.join('\n')}
function lit(i){document.querySelectorAll('.ag').forEach((e,j)=>e.classList.toggle('on',j===i))}
async function j(u){try{const r=await fetch(u);if(!r.ok)throw r.status;return await r.json()}catch(e){return null}}
let chart,line;try{chart=LightweightCharts.createChart($('chart'),{layout:{background:{color:'#121a23'},textColor:'#d6e2ee'},grid:{vertLines:{color:'#1f2a36'},horzLines:{color:'#1f2a36'}},timeScale:{timeVisible:true,secondsVisible:true}});
line=chart.addLineSeries({color:'#4ade80'});
if(window.ResizeObserver)new ResizeObserver(()=>chart.applyOptions({width:$('chart').clientWidth})).observe($('chart'))}catch(e){line={setData(){}};$('chart').innerHTML='<span class=sk>Graphique indisponible</span>';window.__err&&__err('graphique : '+e.message)}
$('sel').onchange=drawChart;
let solT=0;function drawChart(){const a=$('sel').value;const p=S.pos[a];if(p){line.setData(p.pts);return}
 // aucune position fictive (ex. mode RÉEL) : on affiche le prix SOL en 1 min au lieu d'un graphique vide
 if(Date.now()-solT<25e3)return;solT=Date.now();candles('SOL',60).then(c=>{if(!c||S.pos[$('sel').value])return;const o=new Date().getTimezoneOffset()*60;line.setData(c.slice(-120).map(x=>({time:x[0]-o,value:x[4]})));chart&&chart.timeScale().fitContent()})}

async function scout(){lit(0);
 const a=await j(DS+'/token-profiles/latest/v1'),b=await j(DS+'/token-boosts/latest/v1');
 if(!a&&!b){log('Scout : DexScreener ne répond pas (réseau/CORS). Nouvel essai plus tard.');return[]}
 const addrs=[...new Set([...(a||[]),...(b||[])].filter(x=>x.chainId==='solana').map(x=>x.tokenAddress))].filter(x=>!S.done[x]).slice(0,30);
 if(!addrs.length)return[];
 const pairs=await j(DS+'/tokens/v1/solana/'+addrs.join(','))||[];
 const best={};for(const p of pairs){const t=p.baseToken.address;if(!best[t]||(p.liquidity?.usd||0)>(best[t].liquidity?.usd||0))best[t]=p}
 const now=Date.now(),out=[];
 for(const p of Object.values(best)){const age=(now-(p.pairCreatedAt||0))/36e5,mc=p.marketCap||p.fdv||0;
  S.done[p.baseToken.address]=1;
  if(age>=0.5&&age<=72&&mc>=3e5&&mc<=2e7){out.push(p);S.stats.seen++}}
 log(`Scout : ${addrs.length} jetons regardés, ${out.length} dans la cible.`);return out}

async function filter(p){lit(1);
 const r=await j(`${RC}/tokens/${p.baseToken.address}/report`);
 const R=[],add=(n,v)=>R.push([n,v]);// v: true ok / false ko / null skipped
 add('Mint révoqué',r?r.mintAuthority==null:null);
 add('Freeze révoqué',r?r.freezeAuthority==null:null);
 const lp=r?.markets?.length?Math.max(...r.markets.map(m=>m.lp?.lpLockedPct||0)):null;
 add('LP brûlée/bloquée',lp==null?null:lp>=90);
 add('Liquidité > 40k $',(p.liquidity?.usd||0)>4e4);
 add('Volume 1h > 50k $',(p.volume?.h1||0)>5e4);
 const th=r?.topHolders;add('Top 10 ≤ 25 %',th?.length?th.slice(0,10).reduce((s,h)=>s+(h.pct||0),0)<=25:null);
 const sup=r?.token?.supply,cb=r?.creatorBalance;add('Dev ≤ 3 %',sup&&cb!=null?cb/sup*100<=3:null);
 const ins=r?.graphInsidersDetected;add('Lancement groupé ≤ 10 %',ins==null?null:ins<=10?true:false);
 add('Pompe 1h ≤ 80 %',(p.priceChange?.h1??0)<=80);
 return R}

function analyst(p,r){lit(2);
 const tx=p.txns?.h1||{buys:0,sells:0},bs=tx.buys/Math.max(1,tx.sells);
 const mom=Math.max(0,Math.min(20,(p.priceChange?.h1||0)/2+10));
 const buyers=Math.min(20,tx.buys/15);
 const ratio=Math.min(20,bs*10);
 const growth=Math.min(15,((p.txns?.h1?.buys||0)/Math.max(1,(p.txns?.h6?.buys||0)/6))*7);
 const lm=(p.liquidity?.usd||0)/Math.max(1,p.marketCap||p.fdv);const liq=Math.min(15,lm*100);
 const smart=10*(r.filter(x=>x[1]===true).length/9);// pas de données "smart wallets" gratuites : approximation
 return Math.round(mom+buyers+ratio+growth+liq+smart)}

function buy(p,score){lit(3);if(window.REAL?.on){REAL.signal(p.baseToken.symbol,p.baseToken.address,'buy','note '+score);return}const a=p.baseToken.address,amt=+(Math.min(S.bal,CAP*100)*STRAT.size).toFixed(2),px=+p.priceUsd;
 if(amt<0.5||!px||S.pos[a])return;S.bal-=amt;
 S.pos[a]={sym:p.baseToken.symbol,pair:p.pairAddress,entry:px,peak:px,amt,score,url:p.url,pts:[{time:Math.floor(Date.now()/1e3),value:px}]};
 S.stats.trades++;log(`Executor : ACHAT FICTIF ${p.baseToken.symbol} ${amt}$ @ ${px} (note ${score})`);save()}

const MAJ=['SOL','BTC','ETH','JUP','BONK','WIF','LINK','AVAX'],MAJR=MAJ.concat(['RAY','LTC']);// v31 : univers élargi
const STRAT={rsiMin:35,rsiMax:85,emaTol:0.998,analyst:60,size:0.40,mv1Exit:-1.5,mv5Exit:-2.5,mv5Max:4};window.STRAT=STRAT;// MAJR : liste de rotation RÉEL seulement (SIM inchangé)
const ema=(v,n)=>{const k=2/(n+1);let e=v[0];return v.map(x=>e=x*k+e*(1-k))};
function rsi(v,n=14){let g=0,l=0;for(let i=v.length-n;i<v.length;i++){const d=v[i]-v[i-1];d>0?g+=d:l-=d}return l?100-100/(1+g/l):100}
async function candles(s,gr=300){const c=await j(`https://api.exchange.coinbase.com/products/${s}-USD/candles?granularity=${gr}`);return c?c.reverse():null}
async function prudent(){lit(0);const RS=[];for(const s of (window.REAL?.on?MAJR:MAJ)){const RL=!!window.REAL?.on,c=await candles(s,RL?60:300);if(!c){log('Scout : prix '+s+' indisponible');continue}
 S.stats.seen++;const cl=c.map(x=>x[4]),px=cl.at(-1),mv1=(px/cl.at(-2)-1)*100,mv5=(px/cl.at(-6)-1)*100,e20=ema(cl,RL?9:20).at(-1),e50=ema(cl,RL?21:50).at(-1),r=rsi(cl);lit(2);S.stats.scored++;
 const k='MAJ_'+s,P=S.pos[k];
 if(window.REAL?.on){RS.push({s,bull:e20>e50*STRAT.emaTol&&r>STRAT.rsiMin&&r<STRAT.rsiMax&&mv1>STRAT.mv1Exit&&mv5<STRAT.mv5Max,bear:mv5<STRAT.mv5Exit,force:(e20/e50-1)*100,why:'1 min EMA9/21, RSI '+r.toFixed(0)+', 1m '+mv1.toFixed(2)+' % / 5m '+mv5.toFixed(2)+' %'+', tendance '+(e20>e50?'hausse':'baisse')});continue}
 if(P){if(r>STRAT.rsiMax||e20<e50*STRAT.emaTol||mv5<STRAT.mv5Exit){close(k,px,r>STRAT.rsiMax?'RSI > '+STRAT.rsiMax:mv5<STRAT.mv5Exit?'chute 5 bougies '+mv5.toFixed(1)+' %':'tendance baisse')}}
 else if(e20>e50*STRAT.emaTol&&r>STRAT.rsiMin&&r<STRAT.rsiMax&&mv1>STRAT.mv1Exit&&mv5<STRAT.mv5Max){lit(3);const amt=+(Math.min(S.bal,CAP*100)*STRAT.size).toFixed(2);if(amt>=0.5){S.bal-=amt;S.pos[k]={sym:s,major:1,entry:px,peak:px,amt,score:Math.round(r),url:'https://www.coinbase.com/price/'+s.toLowerCase(),pts:c.slice(-100).map(x=>({time:x[0],value:x[4]}))};S.stats.trades++;log(`Executor : ACHAT FICTIF ${s} ${amt}$ @ ${px} (EMA20>EMA50, RSI ${r.toFixed(0)})`)}}
 else{S.stats.killed++;log(`Analyst : ${s} pas d'achat (RSI ${r.toFixed(0)}, tendance ${e20>e50?'hausse':'baisse'}, 1b ${mv1.toFixed(2)} % / 5b ${mv5.toFixed(2)} %)`)}}
 if(window.REAL?.on&&window.SCAN)RS.push(...SCAN.signals());if(window.REAL?.on&&RS.length)REAL.rotate(RS);save()}
function close(k,px,why){const P=S.pos[k],ch=px/P.entry-1,val=P.amt*(1+ch);S.bal+=val;const pnl=val-P.amt;pnl>=0?S.stats.wins++:S.stats.losses++;
 S.hist.unshift({sym:P.sym,pnl,why,t:Date.now()});log(`Risk : VENTE FICTIVE ${P.sym} (${why}) ${pnl>=0?'+':''}${pnl.toFixed(2)}$`);delete S.pos[k]}
async function riskMaj(){for(const k of Object.keys(S.pos).filter(k=>S.pos[k].major)){const c=await candles(S.pos[k].sym);if(!c)continue;const P=S.pos[k],px=c.at(-1)[4],t=c.at(-1)[0];
 if(t>P.pts.at(-1).time)P.pts.push({time:t,value:px});P.peak=Math.max(P.peak,px);const ch=px/P.entry-1;
 if(ch<=-0.06)close(k,px,'stop -6 %');else if(P.peak/P.entry-1>=0.12&&px<=P.peak*0.85)close(k,px,'stop suiveur')}}
const POOLS={'aa70268e-4b52-42bf-a116-608b370f9501':'Ethereum','6f00d46b-8735-49ae-9ced-2a0fccc56ad0':'Ethereum (2)','d9fa8e14-0447-4207-9ae8-7810199dfa1f':'Arbitrum','7e0661bf-8cf3-45e6-9424-31916d4c7b84':'Base','0a1131e6-a59d-537c-b18f-826b9583f01f':'Monad','1b8b4cdb-0728-42a8-bf13-2c8fea7427ee':'Polygon','c4b05318-88af-4536-a834-f5fc8940d2d3':'Avalanche'};
let yT=0,rates=[];async function yields(){if(Date.now()-yT<6e5)return;yT=Date.now();
 const res=await Promise.all(Object.entries(POOLS).map(async([id,ch])=>{const d=await j('https://yields.llama.fi/chart/'+id);const l=d?.data?.at(-1);return l&&l.apy!=null?{id,chain:ch,apy:l.apy,tvl:l.tvlUsd}:null}));
 rates=res.filter(Boolean).sort((a,b)=>b.apy-a.apy);
 $('yield').innerHTML=rates.length?'<table><tr><th>Réseau</th><th>APY</th><th>Dépôts</th></tr>'+rates.map(p=>`<tr><td>${p.chain}</td><td class=ok>${p.apy.toFixed(2)} %</td><td>$${(p.tvl/1e6).toFixed(0)}M</td></tr>`).join('')+'</table><div class=sk>Source : DefiLlama (Aave v3 USDC).</div>':'<span class=sk>Données indisponibles</span>';
 if(!rates.length)return;const b=rates[0];S.y=S.y||{total:0,day:0,dk:'',last:Date.now()};
 if(!S.y.id){S.y.id=b.id;S.y.chain=b.chain;S.y.apy=b.apy;log(`Rendement USDC : dépôt fictif sur Aave ${b.chain} à ${b.apy.toFixed(2)} %`)}
 else{const cur=rates.find(r=>r.id===S.y.id);if(cur)S.y.apy=cur.apy;
  if(b.id!==S.y.id&&b.apy>=S.y.apy+0.5){log(`Rendement USDC : changement ${S.y.chain} (${S.y.apy.toFixed(2)} %) → ${b.chain} (${b.apy.toFixed(2)} %)`);S.y.id=b.id;S.y.chain=b.chain;S.y.apy=b.apy}}save()}
const RES=0.90;// garde 90 % du cash libre (3 trades à 30 %) pour les prochains achats
function accrue(){const y=S.y;if(!y?.id)return;const now=Date.now(),dt=(now-y.last)/1e3;y.last=now;
 const dep=Math.max(0,S.bal*(1-RES)),gain=dep*y.apy/100*dt/31536e3;S.bal+=gain;y.total+=gain;
 const dk=new Date().toDateString();if(y.dk!==dk){y.dk=dk;y.day=0}y.day+=gain;
 $('yc').innerHTML=`Pool : <b>Aave ${y.chain}</b><br>Taux : <b class=ok>${y.apy.toFixed(2)} %</b><br>Placé : $${dep.toFixed(2)} (réserve $${(S.bal-dep).toFixed(2)})<br>Gagné total : <b class=ok>$${y.total.toFixed(2)}</b><br>Aujourd'hui : $${y.day.toFixed(2)}`;
 showBal()}
setInterval(()=>{accrue();if(Math.random()<0.1)save()},1000);setInterval(yields,6e5);
async function risk(){lit(4);await riskMaj();const ks=Object.keys(S.pos).filter(k=>!S.pos[k].major);if(!ks.length)return;
 const ps=await j(DS+'/latest/dex/pairs/solana/'+ks.map(k=>S.pos[k].pair).join(','));
 const list=ps?.pairs||[];
 for(const k of ks){const q=list.find(x=>x.pairAddress===S.pos[k].pair);if(!q)continue;const P=S.pos[k],px=+q.priceUsd;
  const t=Math.floor(Date.now()/1e3);if(t>P.pts.at(-1).time)P.pts.push({time:t,value:px});P.pts=P.pts.slice(-500);
  P.peak=Math.max(P.peak,px);const ch=px/P.entry-1,trail=P.peak/P.entry-1>=0.12;
  let why=null;if(ch<=-0.06)why='stop -6 %';else if(trail&&px<=P.peak*0.85)why='stop suiveur';
  if(why){const val=P.amt*(1+ch);S.bal+=val;const pnl=val-P.amt;pnl>=0?S.stats.wins++:S.stats.losses++;
   S.hist.unshift({sym:P.sym,pnl,why,t:Date.now()});log(`Risk : VENTE FICTIVE ${P.sym} (${why}) ${pnl>=0?'+':''}${pnl.toFixed(2)}$`);delete S.pos[k]}}
 save()}

function render(){lit(5);showBal();const s=S.stats;
 const inPos=Object.values(S.pos).reduce((a,p)=>a+p.amt*(p.pts.at(-1).value/p.entry),0);
 $('stats').innerHTML=`<span>Vus <b>${s.seen}</b></span><span>Éliminés <b>${s.killed}</b></span><span>Notés <b>${s.scored}</b></span><span>Trades <b>${s.trades}</b></span><span>Gagnés <b class=ok>${s.wins}</b></span><span>Perdus <b class=ko>${s.losses}</b></span><span>En position <b>$${inPos.toFixed(2)}</b></span>`;
 $('pos').innerHTML='<tr><th>Jeton</th><th>Mise</th><th>Entrée</th><th>Var.</th></tr>'+Object.values(S.pos).map(p=>{const c=(p.pts.at(-1).value/p.entry-1)*100;return`<tr><td><a href="${p.url}" target=_blank style="color:#7cc4ff">${p.sym}</a></td><td>$${p.amt}</td><td>${p.entry}</td><td class=${c>=0?'ok':'ko'}>${c.toFixed(1)} %</td></tr>`}).join('')+S.hist.slice(0,10).map(h=>`<tr><td class=sk>${h.sym} (fermé)</td><td colspan=2 class=sk>${h.why}</td><td class=${h.pnl>=0?'ok':'ko'}>${h.pnl.toFixed(2)}$</td></tr>`).join('');
 const v=$('sel').value;$('sel').innerHTML=Object.entries(S.pos).map(([a,p])=>`<option value="${a}">${p.sym}</option>`).join('')||'<option>SOL (aucune position)</option>';if(S.pos[v])$('sel').value=v;drawChart()}

const seenRows=[];
let inCycle=0;async function cycle(){if(inCycle||window.REAL?.busy)return;inCycle=1;try{
 await risk();yields();
 if($('mode').value==='prudent'){await prudent();render();return}
 const ps=await scout();
 for(const p of ps.slice(0,8)){const r=await filter(p);const fail=r.filter(x=>x[1]===false);
  const mk=r.map(x=>`<span class=${x[1]===true?'ok':x[1]===false?'ko':'sk'} title="${x[0]}">${x[1]===true?'✔':x[1]===false?'✘':'–'}</span>`).join('');
  let verdict;
  if(fail.length){S.stats.killed++;verdict='<span class=ko>éliminé</span>';log(`Filter : ${p.baseToken.symbol} éliminé (${fail.map(x=>x[0]).join(', ')})`)}
  else{const sc=analyst(p,r);S.stats.scored++;verdict=`note ${sc}`;log(`Analyst : ${p.baseToken.symbol} note ${sc}/100`);if(sc>=STRAT.analyst)buy(p,sc)}
  seenRows.unshift(`<tr><td>${p.baseToken.symbol}</td><td>$${Math.round((p.marketCap||p.fdv)/1e3)}k</td><td>${mk}</td><td>${verdict}</td></tr>`);
  $('seen').innerHTML='<tr><th>Jeton</th><th>Mcap</th><th>Règles (✔ ok ✘ non – pas de données)</th><th>Résultat</th></tr>'+seenRows.slice(0,40).join('')}
 save()}catch(e){log('Erreur : '+e)}finally{inCycle=0}render()}

$('go').onclick=()=>{running=!running;$('go').textContent=running?'⏸ Pause':'▶ Démarrer';if(running){log(window.REAL&&REAL.on?'Démarrage (RÉEL, signature Phantom).':'Démarrage (simulation).');cycle();timer=setInterval(cycle,window.REAL&&REAL.on?5000:15000)}else clearInterval(timer)};
$('reset').onclick=()=>{if(confirm('Tout remettre à zéro (solde 60 $) ?')){localStorage.removeItem(K);location.reload()}};
if($('mode')){$('mode').value=S.mode||'prudent';$('mode').onchange=()=>{S.mode=$('mode').value;save();log('Stratégie : '+S.mode)};}yields();render();$('log').textContent=S.log.join('\n');
if(location.search.includes('auto'))$('go').click();
