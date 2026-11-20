// Sol Desk : scanner lancé à l'ouverture, trading uniquement selon
// l'état volontairement choisi par le propriétaire dans Phantom.
// Ne force plus le trading ni ne masque les commandes de pause.
(function(){
  var go=document.getElementById('go');
  if(go&&go.textContent.indexOf('Pause')<0){
    go.click(); // lance le module de lecture des marchés tant que la page est ouverte
  }
  // real.js gère déjà la reconnexion Phantom avec onlyIfTrusted.
  // Aucun clic automatique sur Passer en RÉEL ou sur un ordre.
  // Aucune transaction ne sera signée sans Phantom.
})();
