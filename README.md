# Sol Desk — Mode Prudent v2

Tableau de bord d’affichage du **Mode Prudent v2** (Grok Bot Terminal). Même look que l’ancien terminal ; les paramètres affichés sont ceux du bot autonome.

## Paramètres actifs (v2 — 05/11/2026)
- Taille **25–30 %** du capital dispo, réserve **≥ 0,05 SOL**, aucune entrée si capital **&lt; 10 $**
- Entrée : prix &gt; **EMA50 4 h** montante sur 24 h ; **EMA9 &gt; EMA21** en 5 min ; **RSI 15 min 40–70**
- Préférence dip : près EMA21 5 min / RSI 40–55 ; jamais RSI &gt; 65 ; vérifier cause si pump 24 h &gt; 5 %
- Sortie : stop **−4 %** ; dès **+8 %**, trailing **3 %** sous le plus haut
- Univers : **SOL → wBTC → wETH** tant que capital &lt; 100 $ ; memecoins ensuite (liq ≥150k, vol24h ≥1M, shield.js OK, frais compte &lt;1 %)
- Coupe-circuit : **2 pertes d’affilée** ou drawdown jour **&gt; 8 %**

## Affichage seulement
Cette page **ne déplace aucun fonds** et n’exécute pas les trades. Les ordres partent du bot autonome (routine). Aucune clé privée dans le dépôt.

Lien : https://lolo19p4.github.io/sol-desk/?v=30
