/* Adapté du swap Jupiter du Terminal Crypto : mêmes frais 3 % et même compte de frais. */
// ===== Échange Jupiter (Swap API v2 /build) avec frais du site =====
// Les frais vont sur le compte USDC de Loïc (propriétaire BSxnWLQadUHMW3uS1uiG7EbEdLbdfdX72Wq4RJ7bd13q).
const FEE_ACCOUNT = "FdmsMDUwUQ5fcouLXKrwuc8gLuMLYVm5qxtuYHa7bmeg";
const FEE_BPS = 300; // 3 %
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JETONS = [
  ["SOL","So11111111111111111111111111111111111111112",9],
  ["JUP","JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",6],
  ["BONK","DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",5],
  ["WIF","EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",6],
  ["TRUMP","6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",6],
  ["RAY","4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",6],
  // Mint USDT tradable côté Jupiter (novembre 2026)
  ["USDT","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",6]
];
const API = "https://api.jup.ag/swap/v2/build";
(function(){
const $=id=>document.getElementById(id);
let wallet=null, sens="achat", busy=false;
function setBusy(v){
  busy=v;
  ["ct_devisBtn","ct_echanger","ct_connect","ct_btnAchat","ct_btnVente","ct_jeton","ct_montant"].forEach(id=>{
    const el=$(id);if(el)el.disabled=!!v;
  });
}
$("ct_frais").textContent="Frais du site : "+(FEE_BPS/100).toLocaleString("fr-FR")+" % par échange (payés en USDC), + frais réseau Solana";
$("ct_jeton").innerHTML=JETONS.map((j,i)=>`<option value="${i}">${j[0]}</option>`).join("");
function majSens(){
  $("ct_btnAchat").classList.toggle("on",sens==="achat");
  $("ct_btnVente").classList.toggle("on",sens==="vente");
  $("ct_btnAchat").setAttribute("aria-pressed",sens==="achat"?"true":"false");
  $("ct_btnVente").setAttribute("aria-pressed",sens==="vente"?"true":"false");
  $("ct_lblMontant").textContent=sens==="achat"?"Je paie (USDC)":"Je vends (quantité de "+JETONS[$("ct_jeton").value][0]+")";
  $("ct_devis").textContent="";
}
$("ct_btnAchat").onclick=()=>{sens="achat";majSens()};
$("ct_btnVente").onclick=()=>{sens="vente";majSens()};
$("ct_jeton").onchange=majSens;majSens();
window.ajouterJeton=function(sym,mint,dec){
  const clean=(sym||"TOKEN").replace(/[<>&"']/g,"").slice(0,16);
  let i=JETONS.findIndex(j=>j[1]===mint);
  if(i<0){JETONS.push([clean,mint,Number(dec)||6]);i=JETONS.length-1;$("ct_jeton").insertAdjacentHTML("beforeend",`<option value="${i}">${clean}</option>`)}
  $("ct_jeton").value=i;sens="achat";majSens();
  if(!$("ct_montant").value)$("ct_montant").value="10";
  $("ct_swap").scrollIntoView({behavior:"smooth"});
  msg("Vérifiez le prix puis échangez. Token risqué !",true);
};
function msg(t,err){$("ct_swapMsg").textContent=t;$("ct_swapMsg").className=err?"err":""}
function provider(){return window.phantom&&window.phantom.solana&&window.phantom.solana.isPhantom?window.phantom.solana:null}
$("ct_connect").onclick=async()=>{
  const p=provider();
  if(!p){location.href="https://phantom.app/ul/browse/"+encodeURIComponent(location.href)+"?ref="+encodeURIComponent(location.origin);return}
  try{
    const r=await p.connect();
    wallet=r.publicKey.toString();
    $("ct_connect").textContent="Phantom connecté : "+wallet.slice(0,4)+"…"+wallet.slice(-4);
    msg("Connecté. Vous pouvez voir le prix et échanger.");
  }catch(e){msg("Connexion refusée",true)}
};
function params(){
  const j=JETONS[$("ct_jeton").value],n=parseFloat(String($("ct_montant").value).replace(",","."));
  if(!(n>0))throw new Error("Entrez un montant");
  if(n>1e12)throw new Error("Montant trop élevé");
  const inMint=sens==="achat"?USDC:j[1],outMint=sens==="achat"?j[1]:USDC,dec=sens==="achat"?6:j[2];
  return {j,inMint,outMint,amount:BigInt(Math.round(n*10**dec)).toString()};
}
function errJup(d,status){
  const t=(d&&(d.error||d.message||d.errorMessage))||("Erreur Jupiter "+status);
  if(/not tradable|TOKEN_NOT_TRADABLE/i.test(t))return "Ce jeton n'est pas échangeable pour l'instant";
  if(/insufficient|balance/i.test(t))return "Solde insuffisant pour cet échange";
  if(/slippage/i.test(t))return "Slippage trop élevé, réessayez";
  return t;
}
async function build(taker){
  const p=params();
  const q=new URLSearchParams({
    inputMint:p.inMint,outputMint:p.outMint,amount:p.amount,taker,
    slippageBps:"100",platformFeeBps:String(FEE_BPS),feeAccount:FEE_ACCOUNT
  });
  const r=await fetch(API+"?"+q,{cache:"no-store"});
  if(r.status===429)throw new Error("Jupiter est saturé, réessayez dans 1 minute");
  let d=null;try{d=await r.json()}catch(_){throw new Error("Réponse Jupiter invalide")}
  if(!r.ok||d.error||!d.swapInstruction)throw new Error(errJup(d,r.status));
  return {p,d};
}
$("ct_devisBtn").onclick=async()=>{
  if(busy)return;
  try{
    setBusy(true);msg("Calcul du prix…");
    const {p,d}=await build(wallet||"9yj3zvLS3fDMqi1F8zhkaWfq8TZpZWHe6cz1Sgt7djXf");
    const outDec=sens==="achat"?p.j[2]:6,inDec=sens==="achat"?6:p.j[2];
    const recu=Number(d.outAmount)/10**outDec,donne=Number(d.inAmount)/10**inDec;
    const usdc=sens==="achat"?donne:recu/(1-FEE_BPS/1e4),fee=usdc*FEE_BPS/1e4;
    const impact=d.priceImpactPct!=null?` · Impact prix : ${(+d.priceImpactPct).toLocaleString("fr-FR",{maximumFractionDigits:3})} %`:"";
    $("ct_devis").innerHTML=`Vous recevez ≈ <b>${recu.toLocaleString("fr-FR",{maximumFractionDigits:6})} ${sens==="achat"?p.j[0]:"USDC"}</b><br>Frais du site : ${fee.toLocaleString("fr-FR",{maximumFractionDigits:4})} USDC (${(FEE_BPS/100).toLocaleString("fr-FR")} %)${impact}`;
    msg("Prix calculé. Vous pouvez échanger.");
  }catch(e){msg("⚠ "+(e.message||"Erreur"),true)}
  finally{setBusy(false)}
};
$("ct_echanger").onclick=async()=>{
  if(busy)return;
  try{
    if(!wallet){msg("Connectez d'abord Phantom",true);return}
    if(!window.solanaWeb3){msg("Bibliothèque Solana encore en chargement, réessayez",true);return}
    setBusy(true);msg("Préparation…");
    const {d}=await build(wallet);const W=window.solanaWeb3;
    const ix=x=>new W.TransactionInstruction({
      programId:new W.PublicKey(x.programId),
      keys:x.accounts.map(a=>({pubkey:new W.PublicKey(a.pubkey),isSigner:a.isSigner,isWritable:a.isWritable})),
      data:Uint8Array.from(atob(x.data),c=>c.charCodeAt(0))
    });
    const list=[
      W.ComputeBudgetProgram.setComputeUnitLimit({units:600000}),
      ...(d.computeBudgetInstructions||[]).map(ix),
      ...(d.setupInstructions||[]).map(ix),
      ix(d.swapInstruction),
      ...(d.cleanupInstruction?[ix(d.cleanupInstruction)]:[]),
      ...(d.otherInstructions||[]).map(ix),
      ...(d.tipInstruction?[ix(d.tipInstruction)]:[])
    ];
    const alts=Object.entries(d.addressesByLookupTableAddress||{}).map(([k,v])=>new W.AddressLookupTableAccount({
      key:new W.PublicKey(k),
      state:{deactivationSlot:BigInt("18446744073709551615"),lastExtendedSlot:0,lastExtendedSlotStartIndex:0,addresses:v.map(a=>new W.PublicKey(a))}
    }));
    const raw=d.blockhashWithMetadata&&d.blockhashWithMetadata.blockhash;
    if(!raw)throw new Error("Blockhash manquant");
    const hash=new W.PublicKey(Uint8Array.from(raw)).toBase58();
    const m=new W.TransactionMessage({payerKey:new W.PublicKey(wallet),recentBlockhash:hash,instructions:list}).compileToV0Message(alts);
    const tx=new W.VersionedTransaction(m);msg("Validez dans Phantom…");
    const r=await provider().signAndSendTransaction(tx);
    const sig=r.signature||r;
    $("ct_swapMsg").innerHTML=`✅ Échange envoyé ! <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">Voir sur Solscan</a>`;
    $("ct_swapMsg").className="";
  }catch(e){
    const m=e&&(e.message||e.error||e.toString())||"Échange annulé";
    msg("⚠ "+m,true);
  }finally{setBusy(false)}
};
})();
