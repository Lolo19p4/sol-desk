/* Échanges réels Solana : Jupiter Swap v2 /order + /execute, signature Phantom.
 * Lecture gratuite sans clé, 0 % de commission propre à Sol Desk.
 * Chaque envoi est volontaire et exige une signature sur l'appareil.
 * Ni phrase secrète, ni clé privée, ni envoi automatique.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BASE="https://api.jup.ag/swap/v2";
const TOKENS=[
  ["SOL","So11111111111111111111111111111111111111112",9],
  ["JUP","JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",6],
  ["BONK","DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",5],
  ["WIF","EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",6],
  ["TRUMP","6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",6],
  ["RAY","4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",6],
  ["USDT","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",6],
  ["wBTC","3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",8],
  ["wETH","7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",8]
];
const provider=()=>window.phantom?.solana?.isPhantom?window.phantom.solana:(window.solana?.isPhantom?window.solana:null);
const format=(n,d=6)=>Number(n).toLocaleString("fr-FR",{maximumFractionDigits:d});
const root=$("ct_swap");
if(!root)return;
let wallet=null,side="achat",busy=false,lastQuote=null;
const ids=["ct_devisBtn","ct_echanger","ct_connect","ct_btnAchat","ct_btnVente","ct_jeton","ct_montant"];
const fee=$("ct_frais");
if(fee)fee.textContent="Commission Sol Desk : 0 % · frais réseau et frais Jupiter éventuels affichés par le devis. Vérifie toujours les montants dans Phantom.";
const selection=$("ct_jeton");
selection.replaceChildren(...TOKENS.map((row,i)=>{const opt=document.createElement("option");opt.value=String(i);opt.textContent=row[0];return opt;}));
const setBusy=b=>{busy=b;for(const id of ids){const el=$(id);if(el)el.disabled=b;}};
const msg=(t,err=false)=>{const e=$("ct_swapMsg");if(e){e.textContent=t;e.className=err?"err":"";}};
function current(){
  const token=TOKENS[Number(selection.value)];
  const raw=String($("ct_montant").value||"").trim().replace(",",".");
  if(!/^\d+(?:\.\d+)?$/.test(raw))throw Error("Montant invalide : indique un nombre positif.");
  const n=Number(raw);if(!Number.isFinite(n)||n<=0||n>1e9)throw Error("Montant hors limites.");
  const decimals=side==="achat"?6:token[2];
  const [integer,fraction=""]=raw.split(".");
  if(fraction.length>decimals)throw Error("Maximum "+decimals+" décimales pour cet actif.");
  const amount=BigInt(integer)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,"0")||"0");
  if(amount<=0n)throw Error("Montant trop faible.");
  return {token,side,amount:amount.toString(),
    inputMint:side==="achat"?USDC:token[1],
    outputMint:side==="achat"?token[1]:USDC,
    outputDecimals:side==="achat"?token[2]:6,
    inputDecimals:decimals};
}
function updateSide(){
  $("ct_btnAchat").classList.toggle("on",side==="achat");
  $("ct_btnVente").classList.toggle("on",side==="vente");
  $("ct_lblMontant").textContent=side==="achat"?"Je paie en USDC":"Je vends (quantité de "+TOKENS[Number(selection.value)][0]+")";
  $("ct_devis").textContent="";lastQuote=null;
}
$("ct_btnAchat").onclick=()=>{side="achat";updateSide();};
$("ct_btnVente").onclick=()=>{side="vente";updateSide();};
selection.onchange=updateSide;
$("ct_montant").addEventListener("input",()=>{lastQuote=null;$("ct_devis").textContent="";});
updateSide();
window.ajouterJeton=(symbol,mint,decimals)=>{
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(mint))) {msg("Adresse de token invalide",true);return;}
  let i=TOKENS.findIndex(t=>t[1]===mint);
  if(i<0){i=TOKENS.length;TOKENS.push([String(symbol||"TOKEN").replace(/[<>&"']/g,"").slice(0,16),mint,Number(decimals)||6]);
    const o=document.createElement("option");o.value=String(i);o.textContent=TOKENS[i][0];selection.append(o);}
  selection.value=String(i);side="achat";updateSide();
  root.scrollIntoView({behavior:"smooth",block:"start"});
  msg("Jeton sélectionné. Vérifie son contrat et demande un devis avant de signer.");
};
window.SolDeskOpenSwap=(symbol,mint,requestedSide)=>{
  window.ajouterJeton(symbol,mint,TOKENS.find(t=>t[1]===mint)?.[2]||6);
  side=requestedSide==="sell"?"vente":"achat";updateSide();
  $("ct_montant").value="";msg("Proposition transférée vers l'échange manuel. Indique le montant souhaité, vérifie le devis, puis confirme dans Phantom.");
};
async function order(input,taker){
  const qs=new URLSearchParams({inputMint:input.inputMint,outputMint:input.outputMint,amount:input.amount});
  if(taker)qs.set("taker",taker);
  // Les appels sans clé sont limités par Jupiter : pas de boucle agressive ni de retry d'envoi.
  let response;
  try{response=await fetch(BASE+"/order?"+qs,{cache:"no-store"});}
  catch(e){throw Error("Jupiter inaccessible depuis ce navigateur : "+(e.message||e));}
  let data={};
  try{data=await response.json();}catch(e){throw Error("Réponse Jupiter invalide (HTTP "+response.status+").");}
  if(!response.ok||data.error||data.errorCode)
    throw Error("Jupiter HTTP "+response.status+" : "+(data.errorMessage||data.error||data.message||"aucun itinéraire disponible"));
  if(!/^[0-9]+$/.test(String(data.outAmount||"")))throw Error("Aucun devis Jupiter exploitable.");
  return data;
}
function preview(input,result){
  const amount=Number(result.outAmount)/10**input.outputDecimals;
  const received=input.side==="achat"?input.token[0]:"USDC";
  const feeBps=Number(result.feeBps);
  const desc="Reçu estimé : "+format(amount)+" "+received+" · route "+String(result.router||"Jupiter")+
    (Number.isFinite(feeBps)?" · frais Jupiter "+format(feeBps/100,2)+" %":"")+
    " · prix non garanti jusqu'à la signature.";
  $("ct_devis").textContent=desc;return desc;
}
$("ct_devisBtn").onclick=async()=>{
  if(busy)return;
  setBusy(true);
  try{msg("Recherche d'un devis réel Jupiter…");
    const input=current();const data=await order(input);
    lastQuote={input,shown:data,time:Date.now()};
    preview(input,data);
    msg("Devis obtenu. L'échange n'est pas exécuté tant que tu ne l'as pas signé.");
  }catch(e){msg("⚠ "+String(e.message||e),true);}
  finally{setBusy(false);}
};
$("ct_connect").onclick=async()=>{
  if(busy)return;
  const p=provider();
  if(!p){
    const deep="https://phantom.app/ul/browse/"+encodeURIComponent(location.href)+"?ref="+encodeURIComponent(location.origin);
    msg("Phantom non détecté : ouverture du terminal dans le navigateur Phantom.");
    location.href=deep;return;
  }
  try{const response=await p.connect();wallet=response.publicKey.toString();
    $("ct_connect").textContent="Phantom "+wallet.slice(0,5)+"…"+wallet.slice(-4);
    msg("Phantom connecté. Tu peux consulter un devis ; tout envoi exigera une signature.");
  }catch(e){msg("Connexion Phantom non autorisée : "+(e.message||e),true);}
};
function base64(bytes){
  let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
  return btoa(binary);
}
$("ct_echanger").onclick=async()=>{
  if(busy)return;
  const p=provider();
  if(!p){msg("Connecte Phantom dans son navigateur intégré.",true);return;}
  try{
    const input=current();
    if(!lastQuote||Date.now()-lastQuote.time>45000||
      JSON.stringify(lastQuote.input)!==JSON.stringify(input))
      throw Error("Devis absent, modifié ou périmé : actualise le devis avant de signer.");
    if(!window.solanaWeb3?.VersionedTransaction)throw Error("Bibliothèque Solana indisponible.");
    const r=await p.connect();const signer=r.publicKey.toString();
    if(wallet&&wallet!==signer)throw Error("Le portefeuille Phantom a changé : reconnecte-le et redemande un devis.");
    wallet=signer;
    setBusy(true);msg("Construction d'un nouvel ordre avec Jupiter…");
    const data=await order(input,signer);
    if(!data.transaction||!data.requestId)throw Error("Route impossible à exécuter : "+(data.errorMessage||"devis non signable"));
    const previous=BigInt(lastQuote.shown.outAmount),fresh=BigInt(data.outAmount);
    // La signature doit se baser sur un prix aussi bon que le devis ou au plus 1 % inférieur.
    if(previous>0n&&fresh*100n<previous*99n)throw Error("Le montant reçu a baissé de plus de 1 % : redemande un devis.");
    const expected=Number(data.outAmount)/10**input.outputDecimals;
    const asset=input.side==="achat"?input.token[0]:"USDC";
    if(!window.confirm("Autoriser dans Phantom un échange réel sur Solana ?\nMontant estimé reçu : "+format(expected)+" "+asset+"\nAucune commission Sol Desk. Frais Jupiter/réseau éventuels.")){
      msg("Échange non validé.");return;
    }
    const bytes=Uint8Array.from(atob(data.transaction),c=>c.charCodeAt(0));
    const tx=window.solanaWeb3.VersionedTransaction.deserialize(bytes);
    if(!p.signTransaction)throw Error("Phantom ne permet pas la signature séparée. Utilise Jupiter officiel.");
    msg("Vérifie le détail et signe dans Phantom…");
    const signed=await p.signTransaction(tx);
    const signedTransaction=base64(signed.serialize());
    if(p.publicKey.toString()!==signer)throw Error("Portefeuille changé : opération annulée.");
    msg("Transaction signée, transmission à Jupiter…");
    // Un seul POST : ne pas doubler l'opération en cas d'état réseau inconnu.
    const response=await fetch(BASE+"/execute",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({signedTransaction,requestId:data.requestId})
    });
    let result={};try{result=await response.json();}catch(e){}
    if(result.signature){
      const link=document.createElement("a");link.href="https://solscan.io/tx/"+encodeURIComponent(result.signature);
      link.target="_blank";link.rel="noopener noreferrer";link.textContent="Voir la transaction sur Solscan";
      const status=$("ct_swapMsg");status.replaceChildren(document.createTextNode(
        result.status==="Success"?"Échange confirmé par Jupiter. ":"État de l'envoi incertain : vérifie sur Solscan. "),link);
    }else{msg("Résultat Jupiter non confirmé (HTTP "+response.status+"). Vérifie le portefeuille avant de réessayer.",true);}
    lastQuote=null;
  }catch(e){msg("⚠ "+String(e.message||e)+" Si tu as déjà signé, vérifie Phantom avant toute nouvelle tentative.",true);}
  finally{setBusy(false);}
};
})();
