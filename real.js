// MODE RÉEL : rien n'est signé automatiquement. Aucune clé stockée. Chaque transaction passe par Phantom.
(function(){
const JUP='https://lite-api.jup.ag',USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',SOLM='So11111111111111111111111111111111111111112';
const MAJ={SOL:SOLM,BTC:'3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',ETH:'7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'};
const XT={BONK:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',WIF:'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',RAY:'4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',LTC:'cbLTC4T5NpzSUtQ7ekgEMZGaUPVJY1ko6BUikqa4gGf'};
const NAME={[SOLM]:'SOL',[MAJ.BTC]:'wBTC',[MAJ.ETH]:'wETH',[USDC]:'USDC',[XT.BONK]:'BONK',[XT.WIF]:'WIF',[XT.RAY]:'RAY',[XT.LTC]:'cbLTC'};
const LK='soldesk_real_limits',PK='soldesk_real_day';
const L={pct:25,loss:5,slip:0.5,pru:true}; // plafond 25 %, protection jour 5 %, glissement 0,5 %; clés jamais enregistrées.
const R=window.REAL={on:false,MAJ,pk:null,bal:{},pend:{},stopped:false,pos:JSON.parse(localStorage.getItem('soldesk_real_pos')||'{}')};
const el=id=>document.getElementById(id);
const sp=()=>localStorage.setItem('soldesk_real_pos',JSON.stringify(R.pos));
const RK='soldesk_real_on',ss=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}},gs=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
function setReal(on,quiet){R.on=on;ss(RK,on?'1':'0');const b=document.querySelector('.badge');
 el('realbox').style.display=on?'block':'none';
 el('realbtn').textContent=on?'Mettre les propositions en pause':'Activer les propositions Phantom';
 b.textContent=on?'PHANTOM ACTIF':'PHANTOM EN PAUSE';b.style.background=on?'#14532d':'';b.style.color=on?'#4ade80':'';
 if(!on&&R.pend&&Object.keys(R.pend).length){R.pend={};drawP()}
 showWal();if(!quiet)log(on?'Signaux actifs ; toute opération exige une validation distincte dans Phantom.':'Signaux suspendus.')}
function showWal(){const w=R.watch||gs('soldesk_watch'),s=a=>a.slice(0,4)+'…'+a.slice(-4);
 el('wal').innerHTML=R.pk?'<span class=ok>Connecté : '+s(R.pk)+'</span>':(w?'Portefeuille enregistré : <b>'+s(w)+'</b> (lecture seule) — appuie sur Connecter Phantom pour signer':'Non connecté');
 const rb=el('rbal');if(rb)rb.innerHTML=(R.pk||w)?el('wbal').innerHTML:''}
el('realbtn').onclick=()=>{if(R.on){setReal(false);return}setReal(true)};
const prov=()=>window.phantom?.solana?.isPhantom?window.phantom.solana:(window.solana?.isPhantom?window.solana:null);
el('conn').onclick=async()=>{const p=prov();const inPh=/Phantom/i.test(navigator.userAgent)||!!(window.phantom&&window.phantom.solana)||!!(window.solana&&window.solana.isPhantom);
 if(!p){if(/Android|iPhone/i.test(navigator.userAgent)&&!inPh&&!(()=>{try{const v=sessionStorage.getItem('phr');sessionStorage.setItem('phr','1');return v}catch(e){return 1}})()){location.href='https://phantom.app/ul/browse/'+encodeURIComponent(location.href)+'?ref='+encodeURIComponent(location.origin)}else alert(inPh?'Phantom pas encore prêt : réessaie dans 2 secondes.':'Phantom non trouvé. Installe l’extension Phantom ou ouvre cette page dans l’appli Phantom.');return}
 try{const r=await p.connect();R.pk=r.publicKey.toString();showWal();hook(p);log('Phantom connecté '+R.pk.slice(0,4)+'…');await bal()}catch(e){el('wal').innerHTML='<span class=ko>Connexion Phantom échouée : '+String(e&&e.message||e).replace(/</g,'&lt;')+'</span>'}};
async function price(ids){const d=await j(JUP+'/price/v3?ids='+ids.join(','));return d||{}}
async function bal(){const W=R.pk||R.watch;if(!W)return;R.balWallet=null;R.balComplete=false;const d=await j(JUP+'/ultra/v1/balances/'+W);if(!d){el('wbal').innerHTML='<span class=sk>Soldes indisponibles</span>';return}
 R.bal={};for(const[k,v]of Object.entries(d)){const m=k==='SOL'?SOLM:k;if(v.uiAmount>0)R.bal[m]={ui:v.uiAmount,raw:v.amount}}
 const pr=await price(Object.keys(R.bal).slice(0,50));let tot=0;
 R.balComplete=Object.keys(R.bal).every(m=>m===USDC||!!(pr[m]&&Number.isFinite(+pr[m].usdPrice)&&+pr[m].usdPrice>0));R.balWallet=W;R.balAt=Date.now();
 const rows=Object.entries(R.bal).map(([m,b])=>{const u=m===USDC?b.ui:pr[m]?.usdPrice?b.ui*pr[m].usdPrice:null;if(u!=null)tot+=u;return`<tr><td>${NAME[m]||m.slice(0,6)+'…'}</td><td>${b.ui.toLocaleString('fr-FR',{maximumFractionDigits:6})}</td><td>${u==null?'–':'$'+u.toFixed(2)}</td></tr>`});
 R.tot=tot;R.px=pr;el('wbal').innerHTML=`<b>Montant valorisé : ${tot.toFixed(2)}${R.balComplete?'':' (incomplet, achats bloqués)'}</b><table>${rows.join('')}</table>`;showWal();
 const dk=new Date().toDateString();let D=JSON.parse(localStorage.getItem(PK)||'{}');if(D.dk!==dk||D.pk!==W){D={dk,pk:W,start:tot};localStorage.setItem(PK,JSON.stringify(D))}
 if(R.balComplete&&tot>0&&!D.baselineVerified){D.start=tot;D.baselineVerified=true}
 const dd=R.balComplete&&D.baselineVerified&&D.start>0?(tot/D.start-1)*100:null;
 if(dd!=null&&dd<=-L.loss)D.halt=true;
 R.stopped=!!D.halt;
 localStorage.setItem(PK,JSON.stringify(D));
 el('rstat').innerHTML=`Début de journée : $${(+D.start).toFixed(2)} · Variation : <span class=${dd>=0?'ok':'ko'}>${dd==null?'non calculable':dd.toFixed(2)+' %'}</span>`+(R.stopped?` <b class=ko>— PERTE MAX DU JOUR ATTEINTE : bot arrêté jusqu'à demain</b>`:'');
 // Aucun stop automatique garanti lorsque la page n'est plus ouverte.
 for(const[m,P]of Object.entries(R.pos)){const px=pr[m]?.usdPrice;if(!px)continue;if(!R.bal[m]){delete R.pos[m];continue}P.peak=Math.max(P.peak,px);const ch=px/P.entry-1;
  }sp()}
const MIN=8,FEE=5e7;R.cool={};R.st={};
// calcule le trade proposé (montant brut) ou la raison de ne rien proposer
R.plan=(sym,mint,bull,bear)=>{const px=(R.px||{})[mint]?.usdPrice,tot=R.tot||0,cap=tot*L.pct/100;
 if(!bull&&!bear)return{r:'pas de signal'};
 if(!R.pk||R.balWallet!==R.pk)return{r:'Connecter Phantom pour valider une opération'};
 if(!R.balComplete||Date.now()-(R.balAt||0)>60000)return{r:'Solde et valorisation non vérifiés'};
 if(bear){const b=R.bal[mint];if(!b)return{r:'pas de signal (rien à vendre)'};if(!px)return{r:'prix indisponible'};
  const dec=+b.raw/b.ui,free=+b.raw-(mint===SOLM?FEE:0);let raw=free;
  const usd=raw/dec*px;if(raw<=0)return{r:'solde trop petit (il faut plus de 0,03 SOL)'};return{side:'sell',raw,usd}}
 const u=R.bal[USDC];if(!u)return{r:'signal achat mais pas d’USDC'};if(R.pos[mint])return{r:'déjà en position'};
 if(R.stopped)return{r:'coupe-circuit journalier déclenché'};
 const raw=Math.floor(Math.min(+u.raw,cap*1e6)),usd=raw/1e6;
 if(raw<=0||usd<MIN)return{r:'taille autorisée inférieure à '+MIN+' USDC'};return{side:'buy',raw,usd}};
R.check=(sym,mint,bull,bear,why)=>{if(!R.on)return;const P=R.plan(sym,mint,bull,bear);const t=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
 R.st[sym]=`${sym} : signal ${bear?'baisse':bull?'hausse':'neutre'} (${why}) → `+(P.side?`${P.side==='buy'?'achat':'vente'} ~${P.usd.toFixed(2)} $ proposé`:P.r);
 el('rchk').innerHTML='Dernier contrôle '+t+'<br>'+Object.values(R.st).join('<br>');
 if(P.side)R.signal(sym,mint,P.side,why,P.raw)};
R.cool={};// ROTATION : tout le portefeuille va sur l'actif qui monte le plus (SOL, wBTC, wETH), sinon USDC
const TK={SOL:SOLM,BTC:MAJ.BTC,ETH:MAJ.ETH,USDC,...XT};const NM={SOL:'SOL',BTC:'wBTC',ETH:'wETH',USDC:'USDC',BONK:'BONK',WIF:'WIF',RAY:'RAY',LTC:'cbLTC'};
R.TK=TK;R.NM=NM;R.NAME=NAME;R.SC={};R.DEC={};
R.pick=list=>{const up=(list||[]).filter(x=>x&&x.bull&&['SOL','BTC','ETH'].includes(x.s)&&Number.isFinite(+x.force)).sort((a,b)=>b.force-a.force);return up.length?up[0].s:null};
R.free=s=>{const m=TK[s],b=R.bal[m];if(!b)return 0;return Math.max(0,+b.raw-(m===SOLM?FEE:0))};
R.val=s=>{const m=TK[s],b=R.bal[m],px=s==='USDC'?1:(R.px||{})[m]?.usdPrice;if(!b||!px)return 0;return R.free(s)/(+b.raw/b.ui)*px};
R.rotate=list=>{
 if(!R.on)return;
 const tgt=R.pick(list),t=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),box=el('rchk');
 if(!tgt){box.textContent='Dernier contrôle '+t+' — aucun signal confirmé. Portefeuille conservé.';return}
 if(!R.pk||R.balWallet!==R.pk||!R.balComplete||Date.now()-(R.balAt||0)>60000||R.stopped){
  box.textContent='Dernier contrôle '+t+' — '+tgt+' repéré, ordre bloqué car fonds ou protection non vérifiés.';return
 }
 const amount=R.val('USDC');
 if(!(Number.isFinite(amount)&&amount>=MIN)){box.textContent='Dernier contrôle '+t+' — '+tgt+' repéré, USDC insuffisants.';return}
 box.textContent='Dernier contrôle '+t+' — candidat '+tgt+' ; achat plafonné et validation Phantom requise.';
 R.swap('USDC',tgt,'signal confirmé '+tgt);
};
R.swap=(src,tgt,why)=>{const k=src+'>'+tgt;if(!R.on||src!=='USDC'||!['SOL','BTC','ETH'].includes(tgt)||R.busy||!R.pk||R.balWallet!==R.pk||!R.balComplete||Date.now()-(R.balAt||0)>60000||R.stopped||Object.keys(R.pend).length>=2||R.pend[k]||Date.now()-(R.cool[k]||0)<6e5)return;
 R.pend[k]={sym:NM[src]+' → '+NM[tgt],src,tgt,why,side:'swap',t:Date.now()};log('Rotation détectée : '+why+' — examen manuel requis.');drawP()};
R.signal=(sym,mint,side,why,raw)=>{if(R.busy||!R.on||!R.pk||R.balWallet!==R.pk||!R.balComplete||Object.keys(R.pend).length>=2||Date.now()-(R.cool[side+mint]||0)<6e5)return;const k=side+mint;if(R.pend[k])return;
 if(side==='buy'){if(R.stopped){log('RÉEL : signal '+sym+' ignoré (perte max du jour)');return}if(L.pru&&!Object.values(MAJ).includes(mint)){log('RÉEL : '+sym+' ignoré (mode Prudent uniquement)');return}if(R.pos[mint])return}
 else if(!R.bal[mint])return;
 R.pend[k]={sym,mint,side,why,raw,t:Date.now()};log('Signal '+(side==='buy'?'achat':'vente')+' '+sym+' ('+why+') — en attente de validation explicite.');drawP()};
function drawP(){
 const root=el('pend');root.replaceChildren();const entries=Object.entries(R.pend);
 if(!entries.length){root.textContent='Aucune opération en attente.';return}
 for(const [key,p] of entries){
  const row=document.createElement('div');row.style.margin='8px 0';
  const title=document.createElement('span');title.textContent=(p.side==='buy'?'Achat : ':p.side==='sell'?'Vente : ':'Échange : ')+p.sym+' ('+p.why+') — validation Phantom obligatoire. ';
  const accept=document.createElement('button');accept.type='button';accept.textContent='Examiner et signer';accept.onclick=()=>exec(key);
  const ignore=document.createElement('button');ignore.type='button';ignore.textContent='Ignorer';ignore.onclick=()=>{delete R.pend[key];drawP()};
  row.append(title,accept,' ',ignore);root.appendChild(row);
 }
}
async function quote(inM,outM,amt,sl){sl=sl||L.slip;const u=`${JUP}/swap/v1/quote?inputMint=${inM}&outputMint=${outM}&amount=${amt}&slippageBps=${Math.round(sl*100)}`;let q=await j(u);for(let i=0;i<3&&(!q||q.error);i++){await new Promise(z=>setTimeout(z,2500*(i+1)));q=await j(u)}
 if(!q||q.error)throw'Pas de devis Jupiter';if(!Number.isFinite(+q.priceImpactPct)||Math.abs(+q.priceImpactPct)*100>0.5)throw'Impact de prix non vérifié ou > 0,5 %';return q}
R.quote=quote;
async function exec(k){const p=R.pend[k];if(!p||R.busy||!R.on)return;const intendedWallet=R.pk;R.busy=1;const pv=prov();try{
 if(!R.pk||!pv)throw'Connecte Phantom d’abord';
 if(Date.now()-(p.t||0)>120000)throw'Signal périmé : il faut attendre un nouveau signal';
 await bal();if(R.balWallet!==R.pk||!R.balComplete||Date.now()-(R.balAt||0)>60000)throw'Solde actuel non vérifiable pour Phantom';
 if(R.stopped&&p.side!=='sell')throw'Coupe-circuit journalier : achat ou rotation désactivé';
 let q;
 if(p.side==='swap'){const free=R.free(p.src),value=R.val(p.src),cap=(R.tot||0)*L.pct/100;
  if(!(free>0&&value>0&&cap>=MIN))throw'Solde vérifié ou capital insuffisant';
  const amt=Math.floor(free*Math.min(1,cap/value));if(!(amt>0))throw'Taille insuffisante';q=await quote(TK[p.src],TK[p.tgt],amt,L.slip)}
 else if(p.side==='buy'){const u=R.bal[USDC];if(!u)throw'Pas d’USDC';const pendingCap=Number.isFinite(+p.raw)&&+p.raw>0?+p.raw:Infinity;const amt=Math.min(+u.raw,pendingCap,Math.floor((R.tot||0)*L.pct/100*1e6));if(amt<MIN*1e6)throw'Taille autorisée insuffisante';q=await quote(USDC,p.mint,amt,L.slip)}
 else{const b=R.bal[p.mint];if(!b)throw'Rien à vendre';let amt=+b.raw-(p.mint===SOLM?FEE:0);if(p.raw)amt=Math.min(amt,p.raw);if(amt<=0)throw'Rien à vendre';q=await quote(p.mint,USDC,amt)}
 const out=p.side==='swap'?`${p.sym} (reçu ~${(+q.outAmount/10**({USDC:6,SOL:9,BTC:8,ETH:8,BONK:5,WIF:6,RAY:6,LTC:8,...R.DEC}[p.tgt])).toPrecision(4)} ${NM[p.tgt]})`:p.side==='buy'?`${(+q.inAmount/1e6).toFixed(2)} USDC → ${p.sym}`:`${p.sym} → ${(+q.outAmount/1e6).toFixed(2)} USDC`;
 log('RÉEL : devis Jupiter '+out+' — signe dans Phantom');
 const sw=()=>fetch(JUP+'/swap/v1/swap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quoteResponse:q,userPublicKey:R.pk,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true})}).then(r=>r.json()).catch(e=>({error:e.message}));
 let s=await sw();for(let i=0;i<3&&!s.swapTransaction;i++){await new Promise(z=>setTimeout(z,2500*(i+1)));s=await sw()}
 if(!s.swapTransaction)throw'Jupiter n’a pas construit la transaction ('+(s.error||s.message||JSON.stringify(s).slice(0,120))+')';
 if(!R.on||R.pk!==intendedWallet||R.balWallet!==intendedWallet||(R.stopped&&p.side!=='sell'))throw'Opération bloquée : mode arrêté, portefeuille changé ou coupe-circuit actif';
  const tx=solanaWeb3.VersionedTransaction.deserialize(Uint8Array.from(atob(s.swapTransaction),c=>c.charCodeAt(0)));
 const {signature}=await pv.signAndSendTransaction(tx);
 log(`RÉEL : transaction envoyée ${p.sym} — https://solscan.io/tx/${signature}`);
 if(p.side==='swap'){}else if(p.side==='buy'){const pr=await price([p.mint]);R.pos[p.mint]={sym:p.sym,entry:pr[p.mint]?.usdPrice||0,peak:pr[p.mint]?.usdPrice||0}}else delete R.pos[p.mint];sp();
 delete R.pend[k];drawP();setTimeout(bal,15000)}catch(e){delete R.pend[k];drawP();R.cool[k]=Date.now();log('RÉEL : trade '+p.sym+' non fait ('+(e.message||e)+')')}finally{R.busy=0;R.cool[k]=Date.now()}}
setInterval(()=>{if(R.pk||R.watch)bal()},30000);
let hooked=0;function hook(p){if(hooked||!p.on)return;hooked=1;p.on('disconnect',()=>{R.pk=null;showWal()});p.on('accountChanged',k=>{R.pk=k?k.toString():null;showWal();bal()})}
setReal(false,true); // ancienne activation forcée non reprise après rechargement
(function auto(n){const p=prov();if(p){p.connect({onlyIfTrusted:true}).then(r=>{R.pk=r.publicKey.toString();showWal();hook(p);log('Phantom reconnecté '+R.pk.slice(0,4)+'…');bal()}).catch(()=>{})}else if(n<10)setTimeout(()=>auto(n+1),300)})(0);
const WK='soldesk_watch';const DEF_W='FoFjucbrcvAK8bqYM3W4iKkorFJD6b2YuSScT2CzActx';R.watch=gs(WK)||DEF_W;
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
