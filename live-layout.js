/* Mise en page orientée données réelles ; déplace les contrôles existants sans clés ni transactions. */
(function () {
  "use strict";
  const host = document.getElementById("live-wallet");
  if (!host) return;
  const button = document.getElementById("realbtn");
  const wallet = document.getElementById("realbox");
  const swap = document.getElementById("ct_swap");
  const publicWalletInput = document.getElementById("waddr");
  const publicWallet = publicWalletInput && publicWalletInput.closest(".pn");
  const tools = document.createElement("div");
  tools.className = "live-wallet-actions";
  const heading = document.createElement("h2");
  heading.textContent = "Phantom · opérations vérifiables";
  const note = document.createElement("p");
  note.className = "live-note";
  note.textContent = "Le scanner fonctionne sans clé privée. Un échange nécessite une connexion Phantom, un devis valide et une signature sur ton appareil. Dydy n’est pas confirmé comme exécutant autonome.";
  if (button) tools.append(button);
  host.append(heading, note, tools);
  if (wallet) host.append(wallet);
  if (swap) host.append(swap);
  if (publicWallet) host.append(publicWallet);
})();