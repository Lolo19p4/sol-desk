# Mode Prudent v2 (05/11/2026 10:20 Paris)
Changements vs v1 : RSI15 40-70 (au lieu de 45-70) ; confirmation 1 min supprimée (5 min seule suffit). Tout le reste inchangé.
- Taille 25-30 % du capital disponible, réserve >= 0,05 SOL, aucune entrée si capital < 10 $.
- Entrée : prix > EMA50 4 h ET EMA50 4 h montante sur 24 h ; EMA9 > EMA21 en 5 min ; RSI 15 min entre 40 et 70.
- Sortie : stop fixe −4 % ; dès +8 %, trailing stop 3 % sous le plus haut.
- Univers : SOL, wBTC, wETH tant que capital < 100 $. Memecoins ensuite seulement : liquidité >= 150 k$, volume 24 h >= 1 M$, shield.js OK, frais d'ouverture de compte < 1 % du trade.
- Circuit-breaker : 2 pertes d'affilée ou drawdown jour > 8 %.
- Une entrée max par passage. Paramètres lisibles dans auto_state.json → prudent_params.
Testés et rejetés (moins bons sur 120 j) : stop ATR (1,5/2/3×), stop 3 %, trailing plus serré (+3/1,5, +4/2, +5/3), TP fixe 4 % ou 6 %, RSI 45-65 / 50-70, suppression pente EMA50.
