const DS='https://api.dexscreener.com',RC='https://api.rugcheck.xyz/v1';
const K='soldesk_v1';
let S=JSON.parse(localStorage.getItem(K)||'null')||{bal:60,pos:{},hist:[],stats:{seen:0,killed:0,scored:0,trades:0,wins:0,losses:0},done:{},log:[]};
const save=()=>localStorage.setItem(K,JSON.stringify(S));
const $=id=>document.getElementById(id);
const series={};let running=false,timer;
function log(m){S.log.unshift(new Date().toLocaleTimeString('fr-FR')+'  '+m);S.log=S.log.slice(0,300);save();$('log').textContent=S.log.join('\n')}
function lit(i){document.querySelectorAll('.ag').forEach((e,j)=>e.classList.toggle('on',j===i))}
async function j(u){try{const r=await fetch(u);if(!r.ok)throw r.status;return await r.json()}catch(e){return null}}
const chart=LightweightCharts.createChart($('chart'),{layout:{background:{color:'#121a23'},textColor:'#d6e2ee'},grid:{vertLines:{color:'#1f2a36'},horzLines:{color:'#1f2a36'}},timeScale:{timeVisible:true,secondsVisible:true}});
const line=chart.addLineSeries({color:'#4ade80'});
new ResizeObserver(()=>chart.applyOptions({width:$('chart').clientWidth})).observe($('chart'));
$('sel').onchange=drawChart;
function drawChart(){const a=$('sel').value;const p=S.pos[a];line.setData(p?p.pts:[])}

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

function buy(p,score){lit(3);const a=p.baseToken.address,amt=+(S.bal*0.08).toFixed(2),px=+p.priceUsd;
 if(amt<0.5||!px||S.pos[a])return;S.bal-=amt;
 S.pos[a]={sym:p.baseToken.symbol,pair:p.pairAddress,entry:px,peak:px,amt,score,url:p.url,pts:[{time:Math.floor(Date.now()/1e3),value:px}]};
 S.stats.trades++;log(`Executor : ACHAT FICTIF ${p.baseToken.symbol} ${amt}$ @ ${px} (note ${score})`);save()}

const MAJ=['SOL','BTC','ETH'];
const ema=(v,n)=>{const k=2/(n+1);let e=v[0];return v.map(x=>e=x*k+e*(1-k))};
function rsi(v,n=14){let g=0,l=0;for(let i=v.length-n;i<v.length;i++){const d=v[i]-v[i-1];d>0?g+=d:l-=d}return l?100-100/(1+g/l):100}
async function candles(s){const c=await j(`https://api.exchange.coinbase.com/products/${s}-USD/candles?granularity=300`);return c?c.reverse():null}
async function prudent(){lit(0);for(const s of MAJ){const c=await candles(s);if(!c){log('Scout : prix '+s+' indisponible');continue}
 S.stats.seen++;const cl=c.map(x=>x[4]),px=cl.at(-1),e20=ema(cl,20).at(-1),e50=ema(cl,50).at(-1),r=rsi(cl);lit(2);S.stats.scored++;
 const k='MAJ_'+s,P=S.pos[k];
 if(P){if(r>75||e20<e50){close(k,px,r>75?'RSI > 75':'tendance baisse')}}
 else if(e20>e50&&r>45&&r<70){lit(3);const amt=+(S.bal*0.08).toFixed(2);if(amt>=0.5){S.bal-=amt;S.pos[k]={sym:s,major:1,entry:px,peak:px,amt,score:Math.round(r),url:'https://www.coinbase.com/price/'+s.toLowerCase(),pts:c.slice(-100).map(x=>({time:x[0],value:x[4]}))};S.stats.trades++;log(`Executor : ACHAT FICTIF ${s} ${amt}$ @ ${px} (EMA20>EMA50, RSI ${r.toFixed(0)})`)}}
 else{S.stats.killed++;log(`Analyst : ${s} pas d'achat (RSI ${r.toFixed(0)}, tendance ${e20>e50?'hausse':'baisse'})`)}}save()}
function close(k,px,why){const P=S.pos[k],ch=px/P.entry-1,val=P.amt*(1+ch);S.bal+=val;const pnl=val-P.amt;pnl>=0?S.stats.wins++:S.stats.losses++;
 S.hist.unshift({sym:P.sym,pnl,why,t:Date.now()});log(`Risk : VENTE FICTIVE ${P.sym} (${why}) ${pnl>=0?'+':''}${pnl.toFixed(2)}$`);delete S.pos[k]}
async function riskMaj(){for(const k of Object.keys(S.pos).filter(k=>S.pos[k].major)){const c=await candles(S.pos[k].sym);if(!c)continue;const P=S.pos[k],px=c.at(-1)[4],t=c.at(-1)[0];
 if(t>P.pts.at(-1).time)P.pts.push({time:t,value:px});P.peak=Math.max(P.peak,px);const ch=px/P.entry-1;
 if(ch<=-0.06)close(k,px,'stop -6 %');else if(P.peak/P.entry-1>=0.12&&px<=P.peak*0.85)close(k,px,'stop suiveur')}}
let yT=0;async function yields(){if(Date.now()-yT<6e5)return;yT=Date.now();const d=await j('https://yields.llama.fi/pools');
 if(!d?.data){$('yield').innerHTML='<span class=sk>Données indisponibles</span>';return}
 const r=d.data.filter(p=>p.project==='aave-v3'&&p.symbol==='USDC').sort((a,b)=>b.tvlUsd-a.tvlUsd).slice(0,8);
 $('yield').innerHTML=r.length?'<table><tr><th>Réseau</th><th>APY</th><th>Dépôts</th></tr>'+r.map(p=>`<tr><td>${p.chain}</td><td class=ok>${p.apy.toFixed(2)} %</td><td>$${(p.tvlUsd/1e6).toFixed(0)}M</td></tr>`).join('')+'</table><div class=sk>Source : DefiLlama. Taux variables, pas garantis.</div>':'<span class=sk>Données indisponibles</span>'}
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

function render(){lit(5);$('bal').textContent='$'+S.bal.toFixed(2);const s=S.stats;
 const inPos=Object.values(S.pos).reduce((a,p)=>a+p.amt*(p.pts.at(-1).value/p.entry),0);
 $('stats').innerHTML=`<span>Vus <b>${s.seen}</b></span><span>Éliminés <b>${s.killed}</b></span><span>Notés <b>${s.scored}</b></span><span>Trades <b>${s.trades}</b></span><span>Gagnés <b class=ok>${s.wins}</b></span><span>Perdus <b class=ko>${s.losses}</b></span><span>En position <b>$${inPos.toFixed(2)}</b></span>`;
 $('pos').innerHTML='<tr><th>Jeton</th><th>Mise</th><th>Entrée</th><th>Var.</th></tr>'+Object.values(S.pos).map(p=>{const c=(p.pts.at(-1).value/p.entry-1)*100;return`<tr><td><a href="${p.url}" target=_blank style="color:#7cc4ff">${p.sym}</a></td><td>$${p.amt}</td><td>${p.entry}</td><td class=${c>=0?'ok':'ko'}>${c.toFixed(1)} %</td></tr>`}).join('')+S.hist.slice(0,10).map(h=>`<tr><td class=sk>${h.sym} (fermé)</td><td colspan=2 class=sk>${h.why}</td><td class=${h.pnl>=0?'ok':'ko'}>${h.pnl.toFixed(2)}$</td></tr>`).join('');
 const v=$('sel').value;$('sel').innerHTML=Object.entries(S.pos).map(([a,p])=>`<option value="${a}">${p.sym}</option>`).join('')||'<option>Aucune position</option>';if(S.pos[v])$('sel').value=v;drawChart()}

const seenRows=[];
async function cycle(){try{
 await risk();yields();
 if($('mode').value==='prudent'){await prudent();render();return}
 const ps=await scout();
 for(const p of ps.slice(0,8)){const r=await filter(p);const fail=r.filter(x=>x[1]===false);
  const mk=r.map(x=>`<span class=${x[1]===true?'ok':x[1]===false?'ko':'sk'} title="${x[0]}">${x[1]===true?'✔':x[1]===false?'✘':'–'}</span>`).join('');
  let verdict;
  if(fail.length){S.stats.killed++;verdict='<span class=ko>éliminé</span>';log(`Filter : ${p.baseToken.symbol} éliminé (${fail.map(x=>x[0]).join(', ')})`)}
  else{const sc=analyst(p,r);S.stats.scored++;verdict=`note ${sc}`;log(`Analyst : ${p.baseToken.symbol} note ${sc}/100`);if(sc>=70)buy(p,sc)}
  seenRows.unshift(`<tr><td>${p.baseToken.symbol}</td><td>$${Math.round((p.marketCap||p.fdv)/1e3)}k</td><td>${mk}</td><td>${verdict}</td></tr>`);
  $('seen').innerHTML='<tr><th>Jeton</th><th>Mcap</th><th>Règles (✔ ok ✘ non – pas de données)</th><th>Résultat</th></tr>'+seenRows.slice(0,40).join('')}
 save()}catch(e){log('Erreur : '+e)}render()}

$('go').onclick=()=>{running=!running;$('go').textContent=running?'⏸ Pause':'▶ Démarrer';if(running){log('Démarrage (simulation).');cycle();timer=setInterval(cycle,30000)}else clearInterval(timer)};
$('reset').onclick=()=>{if(confirm('Tout remettre à zéro (solde 60 $) ?')){localStorage.removeItem(K);location.reload()}};
$('mode').value=S.mode||'prudent';$('mode').onchange=()=>{S.mode=$('mode').value;save();log('Stratégie : '+S.mode)};yields();render();$('log').textContent=S.log.join('\n');
