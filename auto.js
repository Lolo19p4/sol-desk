// Sol Desk : scanner réel au chargement, pas de commande financière automatique.
// Chaque ordre reste une proposition jusqu'au clic distinct « Examiner et signer ».
(function(){
  "use strict";
  const el=id=>document.getElementById(id);
  const btn=el("realbtn"),start=el("go");
  if(window.REAL&&!window.REAL.on&&btn&&localStorage.getItem('soldesk_real_on')!=='0')btn.click();
  if(start&&!/pause/i.test(start.textContent||""))start.click();
  // Ni forçage répété de mode, ni démarrage automatique des tests historiques.
  // Une connexion Phantom doit être autorisée directement dans Phantom.
})();
