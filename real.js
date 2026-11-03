// MODE RÉEL : rien n'est signé automatiquement. Aucune clé stockée. Chaque transaction passe par Phantom.
(function(){
const JUP='https://lite-api.jup.ag',USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',SOLM='So11111111111111111111111111111111111111112';
const MAJ={SOL:SOLM,BTC:'3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',ETH:'7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'};
const NAME={[SOLM]:'SOL',[MAJ.BTC]:'wBTC',[MAJ.ETH]:'wETH',[USDC]:'USDC'};
const LK='soldesk_real_limits',PK='soldesk_real_day';
const L={pct:100,loss:Infinity,slip:1,pru:false};try{localStorage.removeItem(LK)}catch(e){}
const R=window.REAL={on:false,MAJ,pk:null,bal:{},pend:{},stopped:false,pos:JSON.parse(localStorage.getItem('soldesk_real_pos')||'{}')};
const el=id=>document.getElementById(id);
const sp=()=>localStorage.setItem('soldesk_real_pos',JSON.stringify(R.pos));
const RK='soldesk_real_on',ss=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}},gs=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
function setReal(on,quiet){R.on=on;ss(RK,on?'1':null);const b=document.querySelector('.badge');
 el('realbox').style.display=on?'block':'none';
 el('realbtn').textContent=on?'Revenir en simulation':'Passer en RÉEL';
 b.textContent=on?'RÉEL':'SIM';b.style.background=on?'#14532d':'';b.style.color=on?'#4ade80':'';
 showWal();if(!quiet)log(on?'MODE RÉEL activé (validation dans Phantom).':'Retour en simulation.')}
function showWal(){const w=R.watch||gs('soldesk_watch'),s=a=>a.slice(0,4)+'…'+a.slice(-4);
 el('wal').innerHTML=R.pk?'<span class=ok>Connecté : '+s(R.pk)+'</span>':(w?'Portefeuille enregistré : <b>'+s(w)+'</b> (lecture seule) — appuie sur Connecter Phantom pour signer':'Non connecté');
 const rb=el('rbal');if(rb)rb.innerHTML=(R.pk||w)?el('wbal').innerHTML:''}
el('realbtn').onclick=()=>{if(R.on){setReal(false);return}setReal(true)};
const prov=()=>window.phantom?.solana?.isPhantom?window.phantom.solana:(window.solana?.isPhantom?window.solana:null);
el('conn').onclick=async()=>{const p=prov();const inPh=/Phantom/i.test(navigator.userAgent)||!!(window.phantom&&window.phantom.solana)||!!(window.solana&&window.solana.isPhantom);
 if(!p){if(/Android|iPhone/i.test(navigator.userAgent)&&!inPh&&!(()=>{try{const v=sessionStorage.getItem('phr');sessionStorage.setItem('phr','1');return v}catch(e){return 1}})()){location.href='https://phantom.app/ul/browse/'+encodeURIComponent(location.href)+'?ref='+encodeURIComponent(location.origin)}else alert(inPh?'Phantom pas encore prêt : réessaie dans 2 secondes.':'Phantom non trouvé. Installe l’extension Phantom ou ouvre cette page dans l’appli Phantom.');return}
 try{const r=await p.connect();R.pk=r.publicKey.toString();showWal();hook(p);log('Phantom connecté '+R.pk.slice(0,4)+'…');await bal()}catch(e){el('wal').innerHTML='<span class=ko>Connexion Phantom échouée : '+String(e&&e.message||e).replace(/</g,'&lt;')+'</span>'}};
async function price(ids){const d=await j(JUP+'/price/v3?ids='+ids.join(','));return d||{}}
async function bal(){const W=R.pk||R.watch;if(!W)return;const d=await j(JUP+'/ultra/v1/balances/'+W);if(!d){el('wbal').innerHTML='<span class=sk>Soldes indisponibles</span>';return}
 R.bal={};for(const[k,v]of Object.entries(d)){const m=k==='SOL'?SOLM:k;if(v.uiAmount>0)R.bal[m]={ui:v.uiAmount,raw:v.amount}}
 const pr=await price(Object.keys(R.bal).slice(0,50));let tot=0;
 const rows=Object.entries(R.bal).map(([m,b])=>{const u=pr[m]?.usdPrice?b.ui*pr[m].usdPrice:null;if(u)tot+=u;return`<tr><td>${NAME[m]||m.slice(0,6)+'…'}</td><td>${b.ui.toLocaleString('fr-FR',{maximumFractionDigits:6})}</td><td>${u==null?'–':'$'+u.toFixed(2)}</td></tr>`});
 R.tot=tot;R.px=pr;el('wbal').innerHTML=`<b>Portefeuille : $${tot.toFixed(2)}</b><table>${rows.join('')}</table>`;showWal();
 const dk=new Date().toDateString();let D=JSON.parse(localStorage.getItem(PK)||'{}');if(D.dk!==dk||D.pk!==W){D={dk,pk:W,start:tot};localStorage.setItem(PK,JSON.stringify(D))}
 const dd=D.start?(tot/D.start-1)*100:0;R.stopped=false;
 el('rstat').innerHTML=`Début de journée : $${(+D.start).toFixed(2)} · Variation : <span class=${dd>=0?'ok':'ko'}>${dd.toFixed(2)} %</span>`+(R.stopped?` <b class=ko>— PERTE MAX DU JOUR ATTEINTE : bot arrêté jusqu'à demain</b>`:'');
 // stops réels -6 % / suiveur
 for(const[m,P]of Object.entries(R.pos)){const px=pr[m]?.usdPrice;if(!px)continue;if(!R.bal[m]){delete R.pos[m];continue}P.peak=Math.max(P.peak,px);const ch=px/P.entry-1;
  }sp()}
const MIN=0,FEE=1e7;R.cool={};R.st={};
// calcule le trade proposé (montant brut) ou la raison de ne rien proposer
R.plan=(sym,mint,bull,bear)=>{const px=(R.px||{})[mint]?.usdPrice,tot=R.tot||0,cap=tot*L.pct/100;
 if(!bull&&!bear)return{r:'pas de signal'};
 if(bear){const b=R.bal[mint];if(!b)return{r:'pas de signal (rien à vendre)'};if(!px)return{r:'prix indisponible'};
  const dec=+b.raw/b.ui,free=+b.raw-(mint===SOLM?FEE:0);let raw=free;
  const usd=raw/dec*px;if(raw<=0)return{r:'solde trop petit (il faut plus de 0,01 SOL)'};return{side:'sell',raw,usd}}
 const u=R.bal[USDC];if(!u)return{r:'signal achat mais pas d’USDC'};if(R.pos[mint])return{r:'déjà en position'};
 const raw=+u.raw,usd=raw/1e6;if(raw<=0)return{r:'solde trop petit'};return{side:'buy',raw,usd}};
R.check=(sym,mint,bull,bear,why)=>{if(!R.on)return;const P=R.plan(sym,mint,bull,bear);const t=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
 R.st[sym]=`${sym} : signal ${bear?'baisse':bull?'hausse':'neutre'} (${why}) → `+(P.side?`${P.side==='buy'?'achat':'vente'} ~${P.usd.toFixed(2)} $ proposé`:P.r);
 el('rchk').innerHTML='Dernier contrôle '+t+'<br>'+Object.values(R.st).join('<br>');
 if(P.side)R.signal(sym,mint,P.side,why,P.raw)};
R.cool={};// ROTATION : tout le portefeuille va sur l'actif qui monte le plus (SOL, wBTC, wETH), sinon USDC
const TK={SOL:SOLM,BTC:MAJ.BTC,ETH:MAJ.ETH,USDC};const NM={SOL:'SOL',BTC:'wBTC',ETH:'wETH',USDC:'USDC'};
R.pick=list=>{const up=list.filter(x=>x.bull).sort((a,b)=>b.force-a.force);return up.length?up[0].s:'USDC'};
R.free=s=>{const m=TK[s],b=R.bal[m];if(!b)return 0;return Math.max(0,+b.raw-(m===SOLM?FEE:0))};
R.val=s=>{const m=TK[s],b=R.bal[m],px=s==='USDC'?1:(R.px||{})[m]?.usdPrice;if(!b||!px)return 0;return R.free(s)/(+b.raw/b.ui)*px};
R.rotate=list=>{if(!R.on)return;const tgt=R.pick(list);const t=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
 const det=list.map(x=>`${NM[x.s]} : ${x.bull?'hausse':'pas de hausse'} (${x.why}, force ${x.force.toFixed(2)})`).join('<br>');
 const src=Object.keys(TK).filter(s=>s!==tgt&&R.val(s)>0.01).sort((a,b)=>R.val(b)-R.val(a))[0];
 let msg;if(!src)msg=R.val(tgt)>0?`on garde ${NM[tgt]}`:'solde trop petit';
 else{msg=`rotation ${NM[src]} → ${NM[tgt]} (~${R.val(src).toFixed(2)} $)`;R.swap(src,tgt,'rotation vers '+NM[tgt])}
 el('rchk').innerHTML=`Dernier contrôle ${t} — cible : <b>${NM[tgt]}</b> → ${msg}<br>${det}`};
R.swap=(src,tgt,why)=>{const k=src+'>'+tgt;if(R.busy||R.pend[k]||Date.now()-(R.cool[k]||0)<3e5)return;
 R.pend[k]={sym:NM[src]+' → '+NM[tgt],src,tgt,why,side:'swap'};log(`RÉEL : ${why} — ouverture de Phantom`);drawP();exec(k)};
R.signal=(sym,mint,side,why,raw)=>{if(R.busy||Date.now()-(R.cool[side+mint]||0)<3e5)return;if(!R.on)return;const k=side+mint;if(R.pend[k])return;
 if(side==='buy'){if(R.stopped){log('RÉEL : signal '+sym+' ignoré (perte max du jour)');return}if(L.pru&&!Object.values(MAJ).includes(mint)){log('RÉEL : '+sym+' ignoré (mode Prudent uniquement)');return}if(R.pos[mint])return}
 else if(!R.bal[mint])return;
 R.pend[k]={sym,mint,side,why,raw,t:Date.now()};log(`RÉEL : signal ${side==='buy'?'ACHAT':'VENTE'} ${sym} (${why}) — ouverture de Phantom`);drawP();exec(k)};
function drawP(){const v=Object.entries(R.pend);el('pend').innerHTML=v.length?v.map(([k,p])=>`<div style="margin:4px 0">${p.side==='buy'?'🟢 Acheter':'🔴 Vendre'} <b>${p.sym}</b> (${p.why}) — en attente de ta signature dans Phantom</div>`).join(''):'<span class=sk>Aucun pour l’instant.</span>';
 document.querySelectorAll('.val').forEach(b=>b.onclick=()=>exec(b.dataset.k));document.querySelectorAll('.ign').forEach(b=>b.onclick=()=>{delete R.pend[b.dataset.k];drawP()})}
async function quote(inM,outM,amt){const u=`${JUP}/swap/v1/quote?inputMint=${inM}&outputMint=${outM}&amount=${amt}&slippageBps=${Math.round(L.slip*100)}`;let q=await j(u);for(let i=0;i<3&&(!q||q.error);i++){await new Promise(z=>setTimeout(z,2500*(i+1)));q=await j(u)}
 if(!q||q.error)throw'Pas de devis Jupiter';if(+q.priceImpactPct*100>L.slip)throw'Impact de prix '+(q.priceImpactPct*100).toFixed(2)+' % > limite';return q}
R.quote=quote;
async function exec(k){const p=R.pend[k];if(!p||R.busy)return;R.busy=1;const pv=prov();try{
 if(!R.pk||!pv)throw'Connecte Phantom d’abord';
 await bal();let q;
 if(p.side==='swap'){await bal();const amt=R.free(p.src);if(amt<=0)throw'Rien à échanger';q=await quote(TK[p.src],TK[p.tgt],amt)}
 else if(p.side==='buy'){const u=R.bal[USDC];if(!u)throw'Pas d’USDC';const amt=+u.raw;q=await quote(USDC,p.mint,amt)}
 else{const b=R.bal[p.mint];if(!b)throw'Rien à vendre';let amt=+b.raw-(p.mint===SOLM?FEE:0);if(p.raw)amt=Math.min(amt,p.raw);if(amt<=0)throw'Rien à vendre';q=await quote(p.mint,USDC,amt)}
 const out=p.side==='swap'?`${p.sym} (reçu ~${(+q.outAmount/10**({USDC:6,SOL:9,BTC:8,ETH:8}[p.tgt])).toPrecision(4)} ${NM[p.tgt]})`:p.side==='buy'?`${(+q.inAmount/1e6).toFixed(2)} USDC → ${p.sym}`:`${p.sym} → ${(+q.outAmount/1e6).toFixed(2)} USDC`;
 log('RÉEL : devis Jupiter '+out+' — signe dans Phantom');
 const sw=()=>fetch(JUP+'/swap/v1/swap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quoteResponse:q,userPublicKey:R.pk,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true})}).then(r=>r.json()).catch(e=>({error:e.message}));
 let s=await sw();for(let i=0;i<3&&!s.swapTransaction;i++){await new Promise(z=>setTimeout(z,2500*(i+1)));s=await sw()}
 if(!s.swapTransaction)throw'Jupiter n’a pas construit la transaction ('+(s.error||s.message||JSON.stringify(s).slice(0,120))+')';
 const tx=solanaWeb3.VersionedTransaction.deserialize(Uint8Array.from(atob(s.swapTransaction),c=>c.charCodeAt(0)));
 const {signature}=await pv.signAndSendTransaction(tx);
 log(`RÉEL : transaction envoyée ${p.sym} — https://solscan.io/tx/${signature}`);
 if(p.side==='swap'){}else if(p.side==='buy'){const pr=await price([p.mint]);R.pos[p.mint]={sym:p.sym,entry:pr[p.mint]?.usdPrice||0,peak:pr[p.mint]?.usdPrice||0}}else delete R.pos[p.mint];sp();
 delete R.pend[k];drawP();setTimeout(bal,15000)}catch(e){delete R.pend[k];drawP();R.cool[k]=Date.now();log('RÉEL : trade '+p.sym+' non fait ('+(e.message||e)+')')}finally{R.busy=0;R.cool[k]=Date.now()}}
setInterval(()=>{if(R.pk||R.watch)bal()},30000);
let hooked=0;function hook(p){if(hooked||!p.on)return;hooked=1;p.on('disconnect',()=>{R.pk=null;showWal()});p.on('accountChanged',k=>{R.pk=k?k.toString():null;showWal();bal()})}
if(gs(RK)==='1')setReal(true,true);
(function auto(n){const p=prov();if(p){p.connect({onlyIfTrusted:true}).then(r=>{R.pk=r.publicKey.toString();showWal();hook(p);log('Phantom reconnecté '+R.pk.slice(0,4)+'…');bal()}).catch(()=>{})}else if(n<10)setTimeout(()=>auto(n+1),300)})(0);
const WK='soldesk_watch';R.watch=localStorage.getItem(WK);
const short=a=>a.slice(0,4)+'…'+a.slice(-4);
function wshow(){el('wmsg').innerHTML=R.watch?`<span class=ok>Portefeuille enregistré (lecture seule)</span> : <b>${short(R.watch)}</b>`:'<span class=sk>Aucun portefeuille enregistré.</span>'}
el('wsave').onclick=()=>{const v=el('waddr').value.trim();el('waddr').value='';
 if(v.length>44||/\s/.test(v)||v.startsWith('[')){el('wmsg').innerHTML='<b class=ko>⛔ Ne colle jamais ta clé privée ou ta phrase secrète. Rien n’a été enregistré.</b>';return}
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)){el('wmsg').innerHTML='<span class=ko>Adresse Solana invalide.</span>';return}
 R.watch=v;localStorage.setItem(WK,v);wshow();showWal();log('Portefeuille enregistré (lecture seule) '+short(v));bal()};
el('wdel').onclick=()=>{R.watch=null;localStorage.removeItem(WK);el('wbal').innerHTML='';wshow()};
wshow();if(R.watch)bal();
// Rendement USDC en RÉEL : conseil seulement
setInterval(()=>{if(R.on&&el('yc')&&!el('yc').innerHTML.includes('RÉEL'))el('yc').innerHTML='<b>RÉEL : conseil</b> — meilleur taux Aave USDC : '+(rates[0]?rates[0].chain+' ('+rates[0].apy.toFixed(2)+' %)':'(données indisponibles)')+'.<br>'+el('yc').innerHTML},1000);
})();
