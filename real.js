// MODE RÉEL : rien n'est signé automatiquement. Aucune clé stockée. Chaque transaction passe par Phantom.
(function(){
const JUP='https://lite-api.jup.ag',USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',SOLM='So11111111111111111111111111111111111111112';
const MAJ={SOL:SOLM,BTC:'3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',ETH:'7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'};
const NAME={[SOLM]:'SOL',[MAJ.BTC]:'wBTC',[MAJ.ETH]:'wETH',[USDC]:'USDC'};
const LK='soldesk_real_limits',PK='soldesk_real_day';
const L=Object.assign({pct:8,loss:10,slip:1,pru:true},JSON.parse(localStorage.getItem(LK)||'{}'));
const R=window.REAL={on:false,MAJ,pk:null,bal:{},pend:{},stopped:false,pos:JSON.parse(localStorage.getItem('soldesk_real_pos')||'{}')};
const el=id=>document.getElementById(id);
const sp=()=>localStorage.setItem('soldesk_real_pos',JSON.stringify(R.pos));
function lim(){for(const[k,id,mx]of[['pct','lpct',50],['loss','lloss',50],['slip','lslip',3]]){let v=+el(id).value;if(!(v>0))v=L[k];L[k]=Math.min(v,mx);el(id).value=L[k]}L.pru=el('lpru').checked;localStorage.setItem(LK,JSON.stringify(L))}
['lpct','lloss','lslip','lpru'].forEach(id=>el(id).onchange=lim);
el('lpct').value=L.pct;el('lloss').value=L.loss;el('lslip').value=L.slip;el('lpru').checked=L.pru;
el('realbtn').onclick=()=>{if(R.on){R.on=false;el('realbox').style.display='none';el('realbtn').textContent='Passer en RÉEL';document.querySelector('.badge').textContent="SIMULATION — PAS D'ARGENT RÉEL";log('Retour en simulation.');return}
 const t=prompt('MODE RÉEL : de vrais fonds peuvent être perdus.\nChaque trade devra être signé par toi dans Phantom.\nTape exactement : JE COMPRENDS LES RISQUES');
 if(t!=='JE COMPRENDS LES RISQUES'){alert('Pas confirmé : on reste en simulation.');return}
 R.on=true;el('realbox').style.display='block';el('realbtn').textContent='Revenir en simulation';const b=document.querySelector('.badge');b.textContent='MODE RÉEL — VALIDATION MANUELLE';b.style.background='#b91c1c';b.style.color='#fff';log('MODE RÉEL activé (validation manuelle dans Phantom).')};
const prov=()=>window.phantom?.solana?.isPhantom?window.phantom.solana:(window.solana?.isPhantom?window.solana:null);
el('conn').onclick=async()=>{const p=prov();if(!p){if(/Android|iPhone/i.test(navigator.userAgent)){location.href='https://phantom.app/ul/browse/'+encodeURIComponent(location.href)+'?ref='+encodeURIComponent(location.origin)}else alert('Phantom non trouvé. Installe l’extension Phantom ou ouvre cette page dans l’appli Phantom.');return}
 try{const r=await p.connect();R.pk=r.publicKey.toString();el('wal').textContent='Connecté : '+R.pk.slice(0,4)+'…'+R.pk.slice(-4);log('Phantom connecté '+R.pk.slice(0,4)+'…');await bal()}catch(e){alert('Connexion refusée.')}};
async function price(ids){const d=await j(JUP+'/price/v3?ids='+ids.join(','));return d||{}}
async function bal(){if(!R.pk)return;const d=await j(JUP+'/ultra/v1/balances/'+R.pk);if(!d){el('wbal').innerHTML='<span class=sk>Soldes indisponibles</span>';return}
 R.bal={};for(const[k,v]of Object.entries(d)){const m=k==='SOL'?SOLM:k;if(v.uiAmount>0)R.bal[m]={ui:v.uiAmount,raw:v.amount}}
 const pr=await price(Object.keys(R.bal).slice(0,50));let tot=0;
 const rows=Object.entries(R.bal).map(([m,b])=>{const u=pr[m]?.usdPrice?b.ui*pr[m].usdPrice:null;if(u)tot+=u;return`<tr><td>${NAME[m]||m.slice(0,6)+'…'}</td><td>${b.ui.toLocaleString('fr-FR',{maximumFractionDigits:6})}</td><td>${u==null?'–':'$'+u.toFixed(2)}</td></tr>`});
 el('wbal').innerHTML=`<b>Portefeuille : $${tot.toFixed(2)}</b><table>${rows.join('')}</table>`;
 const dk=new Date().toDateString();let D=JSON.parse(localStorage.getItem(PK)||'{}');if(D.dk!==dk||D.pk!==R.pk){D={dk,pk:R.pk,start:tot};localStorage.setItem(PK,JSON.stringify(D))}
 const dd=D.start?(tot/D.start-1)*100:0;R.stopped=dd<=-L.loss;
 el('rstat').innerHTML=`Début de journée : $${(+D.start).toFixed(2)} · Variation : <span class=${dd>=0?'ok':'ko'}>${dd.toFixed(2)} %</span>`+(R.stopped?` <b class=ko>— PERTE MAX DU JOUR ATTEINTE : bot arrêté jusqu'à demain</b>`:'');
 // stops réels -6 % / suiveur
 for(const[m,P]of Object.entries(R.pos)){const px=pr[m]?.usdPrice;if(!px)continue;if(!R.bal[m]){delete R.pos[m];continue}P.peak=Math.max(P.peak,px);const ch=px/P.entry-1;
  if(ch<=-0.06)R.signal(P.sym,m,'sell','stop -6 %');else if(P.peak/P.entry-1>=0.12&&px<=P.peak*0.85)R.signal(P.sym,m,'sell','stop suiveur')}sp()}
R.signal=(sym,mint,side,why)=>{if(!R.on)return;const k=side+mint;if(R.pend[k])return;
 if(side==='buy'){if(R.stopped){log('RÉEL : signal '+sym+' ignoré (perte max du jour)');return}if(L.pru&&!Object.values(MAJ).includes(mint)){log('RÉEL : '+sym+' ignoré (mode Prudent uniquement)');return}if(R.pos[mint])return}
 else if(!R.bal[mint])return;
 R.pend[k]={sym,mint,side,why,t:Date.now()};log(`RÉEL : signal ${side==='buy'?'ACHAT':'VENTE'} ${sym} (${why}) — à valider`);drawP()};
function drawP(){const v=Object.entries(R.pend);el('pend').innerHTML=v.length?v.map(([k,p])=>`<div style="margin:4px 0">${p.side==='buy'?'🟢 Acheter':'🔴 Vendre'} <b>${p.sym}</b> (${p.why}) <button data-k="${k}" class=val>Valider ce trade</button> <button data-k="${k}" class="grey ign">Ignorer</button></div>`).join(''):'<span class=sk>Aucun pour l’instant.</span>';
 document.querySelectorAll('.val').forEach(b=>b.onclick=()=>exec(b.dataset.k));document.querySelectorAll('.ign').forEach(b=>b.onclick=()=>{delete R.pend[b.dataset.k];drawP()})}
async function quote(inM,outM,amt){const q=await j(`${JUP}/swap/v1/quote?inputMint=${inM}&outputMint=${outM}&amount=${amt}&slippageBps=${Math.round(L.slip*100)}`);
 if(!q||q.error)throw'Pas de devis Jupiter';if(+q.priceImpactPct*100>L.slip)throw'Impact de prix '+(q.priceImpactPct*100).toFixed(2)+' % > limite';return q}
R.quote=quote;
async function exec(k){const p=R.pend[k];const pv=prov();try{
 if(!R.pk||!pv)throw'Connecte Phantom d’abord';if(p.side==='buy'&&R.stopped)throw'Perte max du jour atteinte';
 await bal();let q;
 if(p.side==='buy'){const u=R.bal[USDC];if(!u)throw'Pas d’USDC dans le portefeuille';const amt=Math.floor(+u.raw*L.pct/100);if(amt<1e6)throw'Montant trop petit (< 1 USDC)';q=await quote(USDC,p.mint,amt)}
 else{const b=R.bal[p.mint];let amt=+b.raw;if(p.mint===SOLM)amt-=1e7;if(amt<=0)throw'Rien à vendre';q=await quote(p.mint,USDC,amt)}
 const out=p.side==='buy'?`${(+q.inAmount/1e6).toFixed(2)} USDC → ${p.sym}`:`${p.sym} → ${(+q.outAmount/1e6).toFixed(2)} USDC`;
 if(!confirm(`Devis Jupiter : ${out}\nGlissement max ${L.slip} %.\nPhantom va s’ouvrir : vérifie et signe toi-même.`))return;
 const s=await fetch(JUP+'/swap/v1/swap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quoteResponse:q,userPublicKey:R.pk,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true})}).then(r=>r.json());
 if(!s.swapTransaction)throw'Jupiter n’a pas construit la transaction';
 const tx=solanaWeb3.VersionedTransaction.deserialize(Uint8Array.from(atob(s.swapTransaction),c=>c.charCodeAt(0)));
 const {signature}=await pv.signAndSendTransaction(tx);
 log(`RÉEL : transaction envoyée ${p.sym} — https://solscan.io/tx/${signature}`);
 if(p.side==='buy'){const pr=await price([p.mint]);R.pos[p.mint]={sym:p.sym,entry:pr[p.mint]?.usdPrice||0,peak:pr[p.mint]?.usdPrice||0}}else delete R.pos[p.mint];sp();
 delete R.pend[k];drawP();setTimeout(bal,15000)}catch(e){alert('Trade non fait : '+(e.message||e));log('RÉEL : trade '+p.sym+' non fait ('+(e.message||e)+')')}}
setInterval(()=>{if(R.on&&R.pk)bal()},30000);
// Rendement USDC en RÉEL : conseil seulement
setInterval(()=>{if(R.on&&el('yc')&&!el('yc').innerHTML.includes('RÉEL'))el('yc').innerHTML='<b class=ko>RÉEL : conseil seulement</b>, aucun fond déplacé. Aave USDC n’existe pas sur Solana : le meilleur taux est sur '+(rates[0]?rates[0].chain+' ('+rates[0].apy.toFixed(2)+' %)':'(données indisponibles)')+'.<br>'+el('yc').innerHTML},1000);
})();
