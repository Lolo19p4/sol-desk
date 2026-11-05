/* adapté de crypto-terminal memes.js v7 */
(function(){
const $=id=>document.getElementById(id),EXCL=["SOL","USDC","USDT","WSOL"];
const fmt=n=>n>=1e9?(n/1e9).toFixed(1)+" Md $":n>=1e6?(n/1e6).toFixed(1)+" M $":n>=1e3?(n/1e3).toFixed(0)+" k $":n.toFixed(0)+" $";
const px=n=>n<0.0001?n.toExponential(2):n.toLocaleString("fr-FR",{maximumFractionDigits:n<1?6:2});
function age(t){const h=(Date.now()-new Date(t))/36e5;return h<1?Math.round(h*60)+" min":h<48?Math.round(h)+" h":Math.round(h/24)+" j"}
async function charge(type){$("ct_memeListe").textContent="Chargement…";
 try{const d=await(await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/${type}?include=base_token`)).json();
 const tk={};(d.included||[]).forEach(t=>tk[t.id]=t.attributes);const vus=new Set();
 const L=d.data.map(p=>({a:p.attributes,t:tk[p.relationships.base_token.data.id]})).filter(x=>x.t&&+x.a.reserve_in_usd>=20000&&!EXCL.includes(x.t.symbol.toUpperCase())&&!vus.has(x.t.address)&&vus.add(x.t.address)).slice(0,15);
 if(!L.length){$("ct_memeListe").textContent="Aucun token avec assez de liquidité pour l'instant.";return}
 $("ct_memeListe").innerHTML=L.map((x,i)=>{const c=+x.a.price_change_percentage.h24;const s=x.t.symbol.replace(/[<>"&]/g,"");
  return `<div class="meme">${x.t.image_url&&x.t.image_url!=="missing.png"?`<img src="${x.t.image_url}" alt="" loading="lazy" width="40" height="40">`:""}<div class="nm"><b>${s}</b><br>${px(+x.a.base_token_price_usd)} $ <span class="${c>=0?"up":"dn"}">${c>=0?"+":""}${c.toLocaleString("fr-FR",{maximumFractionDigits:1})} %</span></div><button type="button" data-i="${i}">Acheter</button><div class="st">Volume 24 h : ${fmt(+x.a.volume_usd.h24)} · Liquidité : ${fmt(+x.a.reserve_in_usd)} · Âge : ${age(x.a.pool_created_at)}</div></div>`}).join("");
 $("ct_memeListe").querySelectorAll("button").forEach(b=>b.onclick=()=>{const x=L[b.dataset.i];window.ctAjouterJeton&&window.ctAjouterJeton(x.t.symbol,x.t.address,x.t.decimals)});
 }catch(e){$("ct_memeListe").textContent="Données indisponibles, réessayez dans un instant."}}
$("ct_mTend").onclick=()=>{$("ct_mTend").classList.add("on");$("ct_mNew").classList.remove("on");charge("trending_pools")};
$("ct_mNew").onclick=()=>{$("ct_mNew").classList.add("on");$("ct_mTend").classList.remove("on");charge("new_pools")};
charge("trending_pools");
})();