# Sol Desk — Terminal (SIMULATION uniquement)
Tableau de bord de trading **fictif** (paper trading). Aucun portefeuille, aucune clé, aucun vrai ordre. Solde fictif 60 $, état dans le navigateur (localStorage).

- **Prudent** (par défaut) : SOL, BTC, ETH (bougies 5 min Coinbase), achat si EMA20 > EMA50 et RSI 45–70, vente si RSI > 75 ou tendance baisse.
- **Risqué** : memecoins Solana via DexScreener + RugCheck (8 règles, note 0–100, achat à 70+).
- Risk : stop -6 %, stop suiveur après +12 % (15 % sous le plus haut). Max 8 % du solde par position, plusieurs positions en même temps.
- Agent 7 « Rendement USDC » : le cash libre (moins 24 % de réserve) est placé fictivement sur le pool Aave v3 USDC au meilleur taux (DefiLlama), intérêts à la seconde, changement de pool seulement si +0,5 point.

⚠️ Les memecoins sont très risqués : on peut tout perdre.

## Inspiration / prochaines étapes
Cryptofeed (flux temps réel), CCXT (accès aux bourses), Freqtrade (bot complet), VectorBT (backtests rapides), TA-Lib (indicateurs), skfolio (portefeuille), QuantStats (rapports de performance), DuckDB (stockage/analyse des historiques), APScheduler (tâches planifiées), Lightweight Charts (graphiques, déjà utilisé).
