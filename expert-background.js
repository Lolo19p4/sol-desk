// Signaux publiés par GitHub Actions. Lecture publique, sans connexion au wallet.
(function(){
"use strict";
const box=document.getElementById('expert-background');
if(!box)return;
const url='https://raw.githubusercontent.com/Lolo19p4/sol-desk/master/market_signals.json?t=';
function fmt(x,d=2){return typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('fr-FR',{maximumFractionDigits:d}):'—'}
async function load(){
 let data;try{
  const resp=await fetch(url+Date.now(),{cache:'no-store'});
  if(!resp.ok)throw Error('Publication non disponible (HTTP '+resp.status+')');
  data=await resp.json();
 }catch(e){box.textContent='Dernier contrôle automatique : indisponible. '+(e.message||e);return}
 const t=Date.parse(data.checked_at),age=Date.now()-t;
 if(!Number.isFinite(t)||age>15*60000||age< -5*60000||data.status==='error'){
  box.textContent='Contrôle du marché non vérifiable ou périmé. Date publiée : '+(data.checked_at||'inconnue')+'. Aucune occasion de trading ne peut être confirmée.';return
 }
 const title=document.createElement('p');
 title.textContent='Contrôle depuis GitHub, sans téléphone : '+new Date(t).toLocaleString('fr-FR')+' · '+(data.status==='ok'?'3 marchés reçus':'données partielles')+'. Aucun ordre envoyé.';
 const table=document.createElement('table'),thead=document.createElement('thead'),trh=document.createElement('tr');
 for(const x of ['Actif','Dernier cours','Écart du haut 24 h','Signal']){const th=document.createElement('th');th.textContent=x;trh.appendChild(th)}thead.appendChild(trh);table.appendChild(thead);
 const body=document.createElement('tbody');
 for(const asset of ['SOL','BTC','ETH']){
  const x=data.assets?.[asset]||{},tr=document.createElement('tr');
  for(const v of [asset,(x.status==='ok'?fmt(x.price,4)+' $':'—'),(x.status==='ok'?fmt(x.distance_pct)+' %':'—'),x.code||'SOURCE_INDISPONIBLE']){
   const td=document.createElement('td');td.textContent=v;tr.appendChild(td);
  }body.appendChild(tr)
 }
 table.appendChild(body);box.replaceChildren(title,table);
}
load();setInterval(()=>{if(!document.hidden)load()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
})();
