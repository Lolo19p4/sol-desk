// v30 : page = affichage Mode Prudent v2 seulement.
// Ne démarre plus le bot navigateur, ne clique plus RÉEL, ne touche à aucun fonds.
(function(){
  var $=function(i){return document.getElementById(i)};
  ['go','realbtn','reset','conn'].forEach(function(i){var e=$(i); if(e) e.style.display='none';});
  var rb=$('realbox'); if(rb) rb.style.display='none';
})();
