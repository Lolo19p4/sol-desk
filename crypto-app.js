/* Terminal Crypto intégré (adapté de crypto-terminal app.js v7) */
(function(){
const CG="https://api.coingecko.com/api/v3";
const BASE=["bitcoin","ethereum","solana","litecoin","zora"];
const BIN={bitcoin:"BTCEUR",ethereum:"ETHEUR",solana:"SOLEUR",litecoin:"LTCEUR"};
let liste=JSON.parse(localStorage.getItem("ct_liste")||"null")||BASE.slice();
let data={},sel="bitcoin",jours=1,majBusy=false;
const $=id=>document.getElementById(id);
const eur=v=>v==null||Number.isNaN(+v)?"—":(+v).toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:v<1?6:2});
function etat(t,e){const el=$("ct_etat");if(!el)return;el.textContent=t;el.className=e?"err":""}
async function get(u){
  const r=await fetch(u,{cache:"no-store"});
  if(r.status===429)throw new Error("Trop de demandes, on réessaie bientôt");
  if(!r.ok)throw new Error("Erreur "+r.status);
  return r.json();
}
function carte(c){
  const p=c.price_change_percentage_24h,d=document.createElement("div");
  d.className="c";d.dataset.id=c.id||"";
  d.innerHTML=`<div><button type="button" class="star" aria-label="Favori">${liste.includes(c.id)?"★":"☆"}</button><b>${(c.symbol||"").toUpperCase()}</b> ${c.name||""}</div><div class="prix">${eur(c.current_price)}<br><span class="${p>=0?"up":"down"}">${p==null||Number.isNaN(+p)?"":(p>=0?"▲ +":"▼ ")+(+p).toFixed(2)+" %"}</span></div>`;
  d.querySelector(".star").onclick=e=>{e.stopPropagation();basculer(c.id)};
  d.onclick=()=>choisir(c.id,c.name);
  return d;
}
function basculer(id){
  liste=liste.includes(id)?liste.filter(x=>x!==id):[...liste,id];
  localStorage.setItem("ct_liste",JSON.stringify(liste));
  maj();
}
function peindreListe(){
  const box=$("ct_liste");if(!box)return;
  const ids=liste.slice();
  const exist=[...box.children];
  const same=exist.length===ids.length&&exist.every((el,i)=>el.dataset.id===ids[i]);
  if(same){
    exist.forEach((el,i)=>{
      const c=data[ids[i]]||{id:ids[i],name:ids[i]};
      const p=c.price_change_percentage_24h;
      const prix=el.querySelector(".prix");
      if(prix)prix.innerHTML=`${eur(c.current_price)}<br><span class="${p>=0?"up":"down"}">${p==null||Number.isNaN(+p)?"":(p>=0?"▲ +":"▼ ")+(+p).toFixed(2)+" %"}</span>`;
      const star=el.querySelector(".star");
      if(star)star.textContent=liste.includes(c.id)?"★":"☆";
    });
    return;
  }
  box.replaceChildren(...ids.map(i=>data[i]||{id:i,name:i}).map(carte));
}
async function maj(){
  if(majBusy)return;majBusy=true;
  try{
    const top=await get(`${CG}/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=20`);
    top.forEach(c=>data[c.id]=c);
    const manq=liste.filter(i=>!data[i]||!top.find(t=>t.id===i));
    if(manq.length){(await get(`${CG}/coins/markets?vs_currency=eur&ids=${manq.join(",")}`)).forEach(c=>data[c.id]=c)}
    $("ct_top").replaceChildren(...top.map(carte));
    etat("Mis à jour à "+new Date().toLocaleTimeString("fr-FR"));
  }catch(e){
    etat("⚠ CoinGecko : "+e.message+" — prix Binance utilisés",true);
    await secours();
  }
  peindreListe();
  majBusy=false;
}
async function graph(){
  try{
    const d=await get(`${CG}/coins/${sel}/market_chart?vs_currency=eur&days=${jours}`);
    dessine((d.prices||[]).map(p=>p[1]));
  }catch(e){
    try{
      const s=SECOURS[sel];if(!s)throw e;
      const iv={1:"15m",7:"2h",30:"8h",365:"3d"}[jours]||"15m";
      const k=await get(`${BV}/klines?symbol=${s[0]}EUR&interval=${iv}&limit=120`);
      dessine(k.map(x=>+x[4]));
    }catch(_){etat("⚠ Graphique indisponible, nouvel essai bientôt",true)}
  }
}
function dessine(v){
  const cv=$("ct_canvas");if(!cv)return;
  if(!v||!v.length||v.every(x=>x==null||Number.isNaN(+x))){
    const x=cv.getContext("2d");if(!x)return;
    const r=devicePixelRatio||1,W=Math.max(1,cv.clientWidth)*r,H=Math.max(1,cv.clientHeight)*r;
    cv.width=W;cv.height=H;x.clearRect(0,0,W,H);x.fillStyle="#888";x.font=`${16*r}px monospace`;x.fillText("Pas de données",12*r,28*r);return;
  }
  const r=devicePixelRatio||1,W=Math.max(1,cv.clientWidth)*r,H=Math.max(1,cv.clientHeight)*r;
  cv.width=W;cv.height=H;
  const x=cv.getContext("2d"),mn=Math.min(...v),mx=Math.max(...v),up=v[v.length-1]>=v[0];
  x.clearRect(0,0,W,H);
  x.strokeStyle=up?"#3f6":"#f55";x.lineWidth=3*r;x.beginPath();
  v.forEach((p,i)=>{const X=i/(v.length-1||1)*W,Y=H-10*r-(p-mn)/(mx-mn||1)*(H-50*r);i?x.lineTo(X,Y):x.moveTo(X,Y)});
  x.stroke();
  x.fillStyle="#fff";x.font=`${18*r}px monospace`;
  x.fillText("max "+eur(mx),5,22*r);x.fillText("min "+eur(mn),5,H-14*r);
}
function choisir(id,nom){
  sel=id;$("ct_titreGraph").textContent=nom||id;graph();
  const g=$("ct_graph");if(g)window.scrollTo({top:g.offsetTop-10,behavior:"smooth"});
}
document.querySelectorAll("#ct_graph .periodes button").forEach(b=>b.onclick=()=>{
  jours=+b.dataset.j;
  document.querySelectorAll("#ct_graph .periodes button").forEach(o=>{
    const on=o===b;o.classList.toggle("on",on);o.setAttribute("aria-pressed",on?"true":"false");
  });
  graph();
});
const b1=document.querySelector('#ct_graph [data-j="1"]');if(b1){b1.classList.add("on");b1.setAttribute("aria-pressed","true")}
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
let t,num=0;
function montre(list,msg){
  const r=$("ct_resultats");if(!r)return;
  if(msg){const d=document.createElement("div");d.className="msg";d.textContent=msg;r.replaceChildren(d,...list.map(carte))}
  else r.replaceChildren(...list.map(carte));
}
async function chercher(){
  const q=norm($("ct_recherche").value),n=++num;if(!q){$("ct_resultats").replaceChildren();return}
  if(!Object.keys(data).length)await secours();
  const loc=Object.values(data).filter(c=>norm(c.name).includes(q)||norm(c.symbol).includes(q)||norm(c.id).includes(q))
    .sort((a,b)=>(norm(b.symbol)===q)-(norm(a.symbol)===q)||(a.market_cap_rank||9999)-(b.market_cap_rank||9999)).slice(0,8);
  montre(loc,loc.length?"":"Recherche en cours…");
  try{
    const r=await get(`${CG}/search?query=${encodeURIComponent(q)}`);if(n!==num)return;
    const ids=r.coins.slice(0,8).map(c=>c.id).filter(id=>!loc.find(c=>c.id===id));
    if(ids.length){(await get(`${CG}/coins/markets?vs_currency=eur&ids=${ids.join(",")}`)).forEach(c=>data[c.id]=c)}
    if(n!==num)return;
    const all=[...loc,...ids.map(i=>data[i]).filter(Boolean)].slice(0,10);
    montre(all,all.length?"":"Aucun résultat pour « "+$("ct_recherche").value+" »");
  }catch(e){
    if(n!==num)return;
    montre(loc,loc.length?"":(e.message.startsWith("Trop")?"Recherche en ligne saturée, réessaie dans 1 minute":"Aucun résultat"));
  }
}
$("ct_recherche").oninput=()=>{clearTimeout(t);t=setTimeout(chercher,400)};
$("ct_form").onsubmit=e=>{e.preventDefault();clearTimeout(t);$("ct_recherche").blur();chercher()};
const BV="https://data-api.binance.vision/api/v3";
const SECOURS={bitcoin:["BTC","Bitcoin"],ethereum:["ETH","Ethereum"],solana:["SOL","Solana"],litecoin:["LTC","Litecoin"],ripple:["XRP","XRP"],binancecoin:["BNB","BNB"],dogecoin:["DOGE","Dogecoin"],cardano:["ADA","Cardano"],tron:["TRX","TRON"],chainlink:["LINK","Chainlink"],"avalanche-2":["AVAX","Avalanche"]};
async function secours(){
  try{
    const ids=Object.keys(SECOURS);
    const r=await get(`${BV}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(ids.map(k=>SECOURS[k][0]+"EUR")))}`);
    r.forEach(t=>{
      const id=ids.find(k=>SECOURS[k][0]+"EUR"===t.symbol);
      if(!id)return;
      data[id]=Object.assign(data[id]||{},{id,symbol:SECOURS[id][0],name:SECOURS[id][1],current_price:+t.lastPrice,price_change_percentage_24h:+t.priceChangePercent});
    });
    if(!$("ct_top").children.length)$("ct_top").replaceChildren(...Object.values(data).filter(c=>c.current_price!=null).map(carte));
  }catch(e){etat("⚠ Prix indisponibles, nouvel essai dans 1 minute",true)}
}
try{
  const ws=new WebSocket("wss://data-stream.binance.vision/stream?streams="+Object.values(BIN).map(s=>s.toLowerCase()+"@miniTicker").join("/"));
  ws.onmessage=m=>{
    try{
      const d=JSON.parse(m.data).data,id=Object.keys(BIN).find(k=>BIN[k]===d.s);
      if(!id||!data[id])return;
      data[id].current_price=+d.c;
      data[id].price_change_percentage_24h=(+d.c-+d.o)/(+d.o||1)*100;
    }catch(_){}
  };
  setInterval(peindreListe,3000);
}catch(e){}
window.addEventListener("resize",()=>{clearTimeout(window.__ctgto);window.__ctgto=setTimeout(graph,200)});
maj();graph();setInterval(maj,60000);setInterval(graph,300000);

})();
