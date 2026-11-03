# Sol Desk — Terminal (SIMULATION uniquement)
Tableau de bord de trading **fictif** (paper trading). Aucun portefeuille, aucune clé, aucun vrai ordre. Solde fictif 60 $, état dans le navigateur (localStorage).

- **Prudent** (par défaut) : SOL, BTC, ETH (bougies 5 min Coinbase), achat si EMA20 > EMA50 et RSI 45–70, vente si RSI > 75 ou tendance baisse.
- **Risqué** : memecoins Solana via DexScreener + RugCheck (8 règles, note 0–100, achat à 70+).
- Risk : stop -6 %, stop suiveur après +12 % (15 % sous le plus haut). Max 30 % du solde par position, plusieurs positions en même temps.
- Agent 7 « Rendement USDC » : le cash libre (moins 90 % de réserve) est placé fictivement sur le pool Aave v3 USDC au meilleur taux (DefiLlama), intérêts à la seconde, changement de pool seulement si +0,5 point.

⚠️ Les memecoins sont très risqués : on peut tout perdre.

## Inspiration / prochaines étapes
Cryptofeed (flux temps réel), CCXT (accès aux bourses), Freqtrade (bot complet), VectorBT (backtests rapides), TA-Lib (indicateurs), skfolio (portefeuille), QuantStats (rapports de performance), DuckDB (stockage/analyse des historiques), APScheduler (tâches planifiées), Lightweight Charts (graphiques, déjà utilisé).

## Mode RÉEL (optionnel, désactivé par défaut)
Activation seulement après avoir coché « Je comprends les risques, c’est de l’argent réel » puis « Passer en RÉEL ». Connexion Phantom dans le navigateur. Le bot propose des trades ; **chaque transaction est signée par l'utilisateur dans Phantom** (Jupiter swap API). Aucune clé, aucune signature automatique. Limites fixes : 30 % de la valeur du portefeuille par trade, perte max 20 %/jour (bot arrêté), SOL/wBTC/wETH seulement, glissement max 1 %, minimum 0,50 $, 0,02 SOL gardé pour les frais. Le rendement USDC n'est qu'un conseil en mode réel.

### Rotation (mode RÉEL)
À chaque contrôle (toutes les 15 s, page ouverte, bouton Démarrer) :
1. Les bots calculent pour SOL, wBTC et wETH la tendance (EMA9 vs EMA21, bougies 1 min Coinbase) et le RSI 14.
2. Un actif est « en hausse » si EMA9 > EMA21 et RSI entre 40 et 80. La « force » = écart EMA9/EMA21 en %.
3. Cible = l'actif en hausse le plus fort ; si aucun n'est en hausse, cible = USDC.
4. Si le portefeuille tient autre chose que la cible, tout est échangé vers la cible via Jupiter (glissement 1 %), en gardant toujours 0,02 SOL pour les frais.
5. Phantom s'ouvre automatiquement ; l'utilisateur signe chaque transaction. Si une transaction est refusée, la même rotation n'est pas reproposée pendant 5 min.
