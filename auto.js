// Analyse des marchés à l'ouverture de la page.
// La connexion au portefeuille et l'activation des propositions restent manuelles.
// Aucun achat, vente, transfert, signature ou clé secrète.
(function(){
  "use strict";
  const start=document.getElementById("go");
  if(start&&!/pause/i.test(start.textContent||""))start.click();
})();
