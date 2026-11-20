/* Indicateurs calculés exclusivement sur les ventes enregistrées dans trades.json.
 * Aucune estimation de solde, aucun ajustement rétroactif ni stratégie d'achat.
 */
(function(root){
"use strict";
function analyze(input){
 const rows=Array.isArray(input)?input:[];
 const per={},valid=rows.filter(t=>t&&t.sens==="vente"&&typeof t.pnl_usd==="number"&&Number.isFinite(t.pnl_usd));
 valid.forEach(t=>{
  const key=String(t.actif||"Inconnu").slice(0,30);
  const p=per[key]||(per[key]={asset:key,trades:0,wins:0,losses:0,zeros:0,pnl:0,gain:0,loss:0});
  p.trades++;p.pnl+=t.pnl_usd;
  if(t.pnl_usd>0){p.wins++;p.gain+=t.pnl_usd}
  else if(t.pnl_usd<0){p.losses++;p.loss-=t.pnl_usd}
  else p.zeros++;
 });
 const assets=Object.values(per).sort((a,b)=>a.pnl-b.pnl);
 const wins=valid.filter(t=>t.pnl_usd>0),losses=valid.filter(t=>t.pnl_usd<0);
 const gain=wins.reduce((s,t)=>s+t.pnl_usd,0),loss=-losses.reduce((s,t)=>s+t.pnl_usd,0);
 let streak=0,maxStreak=0;
 const chron=valid.slice().sort((a,b)=>{
  const x=Date.parse(a.date||""),y=Date.parse(b.date||"");
  return (Number.isFinite(x)?x:0)-(Number.isFinite(y)?y:0)
 });
 for(const t of chron){
  if(t.pnl_usd<0){streak++;maxStreak=Math.max(maxStreak,streak)}
  else streak=0;
 }
 const last=chron.at(-1);
 return {
  allRecords:rows.length,closed:valid.length,wins:wins.length,losses:losses.length,
  winRate:valid.length?wins.length/valid.length:null,
  pnl:gain-loss,grossGain:gain,grossLoss:loss,
  profitFactor:loss>0?gain/loss:null,
  avgWin:wins.length?gain/wins.length:null,
  avgLoss:losses.length?-loss/losses.length:null,
  maxLossStreak:maxStreak,lastClosedAt:last?.date||null,assets
 };
}
const API={analyze};
root.SolDeskPerformance=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:this);
