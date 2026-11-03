// v26 SCANNER (RÉEL) : cherche les jetons Solana qui montent (GeckoTerminal), filtre anti-arnaque, ajoute les meilleurs à la rotation.
// Aucune clé, aucune signature ici : il ne fait que lire des API publiques et des devis Jupiter.
(function(){
const GT='https://api.geckoterminal.com/api/v2',RPC='https://api.mainnet-beta.solana.com',JUP='https://lite-api.jup.ag',USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const T22='TokenzQdBNbLqP5VEhdkAS6EtFNwCb2EB4yF4bFUH5vcg',SK='soldesk_scan',MAXP=2;
const R=window.REAL;if(!R)return;
const ema=(v,n)=>{const k=2/(n+1);let e=v[0];return v.map(x=>e=x*k+e*(1-k))};
function rsi(v,n=14){let g=0,l=0;for(let i=v.length-n;i<v.length;i++){const d=v[i]-v[i-1];d>0?g+=d:l-=d}return l?100-100/(1+g/l):100}
async function gj(u,o){try{const r=await fetch(u,o);if(!r.ok)return null;return await r.json()}catch(e){return null}}
const esc=t=>String(t).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
// jetons retenus (gardés en mémoire pour pouvoir revendre même s'ils sortent du classement)
let KEEP={};try{KEEP=JSON.parse(localStorage.getItem(SK)||'{}')}catch(e){}
const saveK=()=>{try{localStorage.setItem(SK,JSON.stringify(KEEP))}catch(e){}};
const SIG={},REJ={},rows={};let busy=0,last=0;
function reg(k){const t=KEEP[k];R.TK[k]=t.mint;R.NM[k]=t.sym;R.NAME[t.mint]=t.sym;R.SC[k]=1;R.DEC[k]=t.dec}
Object.keys(KEEP).forEach(reg);
async function mintInfo(m){const d=await gj(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[m,{encoding:'jsonParsed'}]})});
 const v=d?.result?.value;if(!v)return null;const i=v.data?.parsed?.info;if(!i)return null;
 const ext=i.extensions||[],fee=ext.find(x=>x.extension==='transferFeeConfig');
 const bps=fee?Math.max(+(fee.state?.newerTransferFee?.transferFeeBasisPoints||0),+(fee.state?.olderTransferFee?.transferFeeBasisPoints||0)):0;
 return{mintA:i.mintAuthority,freezeA:i.freezeAuthority,dec:i.decimals,t22:v.owner===T22,fee:bps}}
async function roundTrip(m){const a=await gj(`${JUP}/swap/v1/quote?inputMint=${USDC}&outputMint=${m}&amount=10000000&slippageBps=200`);if(!a||a.error||!a.outAmount)return null;
 await new Promise(z=>setTimeout(z,400));const b=await gj(`${JUP}/swap/v1/quote?inputMint=${m}&outputMint=${USDC}&amount=${a.outAmount}&slippageBps=200`);if(!b||b.error)return null;
 return(1-(+b.outAmount)/1e7)*100}
async function momentum(k){const t=KEEP[k];const d=await gj(`${GT}/networks/solana/pools/${t.pool}/ohlcv/minute?aggregate=1&limit=100`);
 const L=d?.data?.attributes?.ohlcv_list;if(!L||L.length<30){SIG[k]=null;return}
 const cl=L.slice().reverse().map(x=>+x[4]),a=ema(cl,9).at(-1),b=ema(cl,21).at(-1),r=rsi(cl);
 SIG[k]={s:k,bull:a>b&&r>40&&r<80,force:(a/b-1)*100,why:'scanner, 1 min GeckoTerminal EMA9/21, RSI '+r.toFixed(0)+', 24h '+(t.h24>=0?'+':'')+t.h24.toFixed(0)+' %',t:Date.now()}}
async function scan(){if(busy||!R.on)return;busy=1;last=Date.now();try{
 const d=await gj(`${GT}/networks/solana/trending_pools?page=1`);const P=d?.data||[];
 const seen={},cand=[];
 for(const p of P){const a=p.attributes,m=(p.relationships?.base_token?.data?.id||'').replace('solana_','');if(!m||seen[m]||Object.values(R.MAJ).includes(m)||m===USDC)continue;seen[m]=1;
  const sym=(a.name||'?').split(' / ')[0].trim().slice(0,12),h24=+(a.price_change_percentage?.h24||0),liq=+a.reserve_in_usd||0,vol=+(a.volume_usd?.h24||0),age=(Date.now()-Date.parse(a.pool_created_at))/36e5;
  const c={m,sym,h24,liq,vol,age,pool:a.address};
  let why=null;if(liq<1e5)why='liquidité $'+Math.round(liq/1e3)+'k < 100k';else if(vol<2e5)why='volume 24h $'+Math.round(vol/1e3)+'k < 200k';else if(!(age>=24))why='pool trop jeune ('+age.toFixed(0)+' h < 24 h)';else if(h24<=0)why='ne monte pas (24h '+h24.toFixed(0)+' %)';
  if(why){rows[m]={...c,ok:false,why};continue}cand.push(c)}
 cand.sort((a,b)=>b.h24-a.h24);let picked=0;
 for(const c of cand){if(picked>=MAXP){rows[c.m]={...c,ok:false,why:'pas dans les '+MAXP+' meilleurs'};continue}
  if(REJ[c.m]&&Date.now()-REJ[c.m].t<6e5){rows[c.m]={...c,ok:false,why:REJ[c.m].why};continue}
  const mi=await mintInfo(c.m);let why=null;
  if(!mi)why='infos du jeton illisibles';else if(mi.mintA)why='le créateur peut encore créer des jetons (mint non révoqué)';else if(mi.freezeA)why='le créateur peut bloquer les jetons (freeze non révoqué)';else if(mi.t22&&mi.fee>0)why='taxe sur les transferts ('+(mi.fee/100)+' %)';
  if(!why){const rt=await roundTrip(c.m);if(rt==null)why='pas de devis Jupiter';else if(rt>=3)why='aller-retour 10 $ perd '+rt.toFixed(1)+' % (≥ 3 %)';else c.rt=rt}
  if(why){REJ[c.m]={t:Date.now(),why};rows[c.m]={...c,ok:false,why};continue}
  let k=c.sym.toUpperCase().replace(/[^A-Z0-9]/g,'')||'TOK';if(R.TK[k]&&R.TK[k]!==c.m)k=k+'_'+c.m.slice(0,4);
  KEEP[k]={mint:c.m,sym:c.sym,dec:mi.dec,pool:c.pool,h24:c.h24,t:Date.now()};reg(k);picked++;
  rows[c.m]={...c,ok:true,why:'retenu · aller-retour −'+c.rt.toFixed(2)+' %'}}
 // on retire les anciens jetons non détenus et plus retenus
 const now=Object.values(rows).filter(r=>r.ok).map(r=>r.m);
 for(const k of Object.keys(KEEP)){const t=KEEP[k];if(now.includes(t.mint))continue;if(R.bal?.[t.mint])continue;delete KEEP[k];delete SIG[k];delete R.TK[k];delete R.SC[k]}
 saveK();for(const k of Object.keys(KEEP))await momentum(k);
 log('Scanner : '+Object.keys(rows).length+' jetons regardés, retenus : '+(Object.keys(KEEP).map(k=>KEEP[k].sym).join(', ')||'aucun'));
}catch(e){log('Scanner : erreur '+e)}finally{busy=0;draw()}}
function draw(){let b=document.getElementById('scanrules');const r=document.getElementById('rules');if(!r)return;
 if(!b){b=document.createElement('div');b.id='scanrules';r.parentNode.appendChild(b)}
 const L=Object.values(rows).sort((a,b)=>(b.ok-a.ok)||(b.h24-a.h24)).slice(0,14);
 b.innerHTML='<h2 style="margin-top:10px">Scanner · jetons qui montent</h2>'+(L.length?L.map(x=>{const k=Object.keys(KEEP).find(k=>KEEP[k].mint===x.m),s=k&&SIG[k];
  return `<div class="rule"><span><b>${esc(x.sym)}</b> <span class=${x.h24>=0?'ok':'ko'}>${x.h24>=0?'+':''}${x.h24.toFixed(0)} %</span> · ${esc(x.why)}${s?' · '+(s.bull?'<span class=ok>signal hausse</span>':'pas de signal'):''}</span><span class=${x.ok?'ok':'ko'}>${x.ok?'✔':'✘'}</span></div>`}).join(''):'<span class=sk>'+(R.on?'Premier scan en cours…':'Scanner actif seulement en RÉEL.')+'</span>')+'<span class=sk>Filtres : liquidité ≥ 100k $, volume 24h ≥ 200k $, pool ≥ 24 h, mint et freeze révoqués, pas de taxe, aller-retour 10 $ &lt; 3 %. Glissement max 2 % sur ces jetons.</span>'}
window.SCAN={signals:()=>Object.values(SIG).filter(x=>x&&Date.now()-x.t<18e4&&R.TK[x.s]),scan,rows,KEEP};
setInterval(()=>{if(R.on&&Date.now()-last>6e4)scan();draw()},5000);setTimeout(scan,3000);
})();
