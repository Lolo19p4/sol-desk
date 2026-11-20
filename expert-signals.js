/* Alertes avancées en lecture seule. Aucune signature ni ordre.
 * Statut basé sur des cours Binance avec horodatage, indicateurs clôturés.
 * La cassure du prix instantané n'est pas une cassure 1 h confirmée.
 */
(function(root){
"use strict";
function valid(n){return typeof n==="number"&&Number.isFinite(n)&&n>0}
function evaluate(input){
 const x=input||{}, now=Number.isFinite(x.now)?x.now:Date.now();
 const price=x.price, high=x.ph24, scanAt=x.scanAt, priceAt=x.priceAt;
 if(!valid(price)||!valid(high)||!Number.isFinite(scanAt)||!Number.isFinite(priceAt)||
 now-scanAt>120000||now-priceAt>90000||scanAt>now+10000||priceAt>now+10000){
  return {code:"SOURCE_INDISPONIBLE",label:"Données à actualiser",color:"ko",distancePct:null,
   reason:"Aucune alerte exploitable sans bougies et prix récents."};
 }
 const dist=(price/high-1)*100;
 if(!x.reg4h||!x.croise){
  return {code:"REGIME_INSUFFISANT",label:"Tendance non confirmée",color:"sk",distancePct:dist,
   reason:"Le prix monte peut-être, mais les filtres EMA 4 h ne sont pas tous validés."};
 }
 if(!x.pause6h){
  return {code:"PAUSE",label:"Délai après vente",color:"sk",distancePct:dist,
   reason:"Rachat bloqué par la règle des six heures après la dernière vente."};
 }
 if(x.confirmed){
  return {code:"CONFIRME_1H",label:"Cassure confirmée 1 h",color:"ok",distancePct:dist,
   reason:"Les filtres sur bougies clôturées sont validés. Vérifier le portefeuille et les risques."};
 }
 if(dist>=0){
  return {code:"CASSURE_INTRA",label:"Cassure en cours — non confirmée",color:"ok",distancePct:dist,
   reason:"Le dernier prix dépasse le plus haut des 24 h précédentes, mais la bougie 1 h n'est pas clôturée."};
 }
 if(dist>=-1){
  return {code:"PROCHE",label:"Proche d’une cassure",color:"ok",distancePct:dist,
   reason:"Le prix est à moins de 1 % du plus haut 24 h. Surveiller la clôture 1 h."};
 }
 return {code:"ATTENTE",label:"En attente",color:"sk",distancePct:dist,
  reason:"Cassure 24 h non atteinte ; hausse seule insuffisante."};
}
root.SolDeskExpert={evaluate:evaluate,version:"1.0"};
})(typeof window!=="undefined"?window:this);
