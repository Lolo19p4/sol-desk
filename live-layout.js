/* Connexions et commandes visibles : marché en lecture seule, Phantom toujours signé par l'utilisateur. */
(function(){
  "use strict";
  const root=document.getElementById("live-wallet");
  if(!root)return;
  const byId=id=>document.getElementById(id);
  const actions=document.createElement("div");
  actions.className="live-wallet-actions";
  const h=document.createElement("h2");
  h.textContent="Phantom, Dydy et échanges";
  const info=document.createElement("p");
  info.className="live-note";
  info.textContent="Les cours et alertes se chargent automatiquement à l'ouverture. Pour les propositions de trades, active Phantom : le contrôle s'effectue dans ce navigateur et chaque échange demande ta signature. Aucune exécution autonome de Dydy n'est actuellement vérifiée.";
  root.append(h,info);
  const toggle=byId("realbtn"),run=byId("go"),refresh=byId("expert-refresh");
  if(toggle)actions.append(toggle);
  if(run){run.textContent="Démarrer le suivi Phantom";actions.append(run);}
  if(refresh){refresh.textContent="Actualiser le radar";actions.append(refresh);}
  root.append(actions);
  const wallet=byId("realbox"),swap=byId("ct_swap"),winput=byId("waddr");
  const watch=winput&&winput.closest(".pn");
  if(wallet)root.append(wallet);
  if(swap)root.append(swap);
  if(watch)root.append(watch);
  const ext=document.createElement("p");
  ext.className="live-note";
  const a=document.createElement("a");
  a.href="https://jup.ag/swap/SOL-USDC";a.target="_blank";a.rel="noopener noreferrer";
  a.textContent="Ouvrir Jupiter officiel pour échanger avec Phantom";
  ext.append("Si l'interface d'échange locale affiche une erreur, ",a,". Vérifie le site avant de signer.");
  root.append(ext);
})();