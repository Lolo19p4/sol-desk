/* État vérifiable du terminal : lecture seule, aucune opération ni clé secrète. */
(function () {
  "use strict";
  const root = document.getElementById("live-summary");
  if (!root) return;
  const fmtDate = value => {
    const d = new Date(value);
    return Number.isFinite(d.getTime())
      ? d.toLocaleString("fr-FR", {timeZone:"Europe/Paris", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"})
      : "date inconnue";
  };
  const ageMinutes = value => {
    const t = Date.parse(value || "");
    return Number.isFinite(t) ? (Date.now() - t) / 60000 : Infinity;
  };
  const money = value => Number.isFinite(value)
    ? value.toLocaleString("fr-FR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " $"
    : "—";
  async function read(name) {
    const response = await fetch(name + "?_=" + Date.now(), {cache:"no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }
  function card(title, value, detail, state) {
    const item = document.createElement("div");
    item.className = "live-card " + (state || "");
    const t = document.createElement("small"), v = document.createElement("strong"), d = document.createElement("span");
    t.textContent = title; v.textContent = value; d.textContent = detail;
    item.append(t,v,d);
    return item;
  }
  let busy = false;
  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      const [stat, signal, journal] = await Promise.allSettled([
        read("status.json"), read("market_signals.json"), read("trades.json")
      ]);
      const s = stat.status === "fulfilled" ? stat.value : null;
      const m = signal.status === "fulfilled" ? signal.value : null;
      const j = journal.status === "fulfilled" ? journal.value : null;
      const checks = ageMinutes(s && s.dernier_passage);
      const scan = ageMinutes(m && m.checked_at);
      const count = s && Number.isSafeInteger(s.nb_positions) && s.nb_positions >= 0 ? s.nb_positions : null;
      const botState = checks > 30 ? "ancien" : "recent";
      const marketState = scan > 20 || (m && m.status === "error") ? "ancien" : "recent";
      const cards = document.createElement("div");
      cards.className = "live-cards";
      cards.append(
        card("POSITIONS PUBLIÉES", count === null ? "—" : String(count),
             s ? "Déclarées le " + fmtDate(s.dernier_passage) + " · positions actuelles non vérifiées" : "Fichier bot indisponible", botState),
        card("ÉTAT DU BOT", checks <= 30 ? "Signal récent" : "Non confirmé",
             s ? "Dernier passage publié : " + fmtDate(s.dernier_passage) : "Impossible de lire status.json", botState),
        card("RADAR DES MARCHÉS", scan <= 20 && m && m.status !== "error" ? "Actualisé" : "Données anciennes",
             m ? "SOL / BTC / ETH · " + fmtDate(m.checked_at) + " · aucun ordre envoyé" : "Signaux indisponibles", marketState),
        card("BOT DYDY / ORDRES", "Non vérifiés",
             "Aucune preuve ici d'une session d'exécution ou d'une signature Phantom.", "ancien")
      );
      if (j && j.resume && Number.isFinite(Number(j.resume.pnl_total_usd))) {
        const line = document.createElement("p");
        line.className = "live-note";
        line.textContent = "Journal historique déclaré : " + money(Number(j.resume.pnl_total_usd)) +
          " de P&L · " + (j.resume.nb_trades ?? "—") +
          " opérations · dernière mise à jour " + fmtDate(j.maj) +
          ". Ce journal ne prouve pas la détention actuelle des positions.";
        cards.append(line);
      }
      root.replaceChildren(cards);
    } catch (e) {
      root.textContent = "État public indisponible : aucune position ni activité du bot ne peut être confirmée.";
    } finally { busy = false; }
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();