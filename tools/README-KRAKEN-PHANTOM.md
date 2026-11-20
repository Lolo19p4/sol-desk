# Dydy-bot — Kraken en lecture seule

Le 4 novembre 2026, un e-mail de Kraken a confirmé la création d’une clé API nommée **Dydy-bot**.
Cela ne confirme pas que les identifiants sont présents sur la machine, ni que le bot tourne.

## Vérification sans transfert

Le script `tools/kraken_readonly.py` interroge seulement les routes Kraken **Balance**, **OpenOrders** et **TradesHistory**.
Il ne dispose d'aucune fonction pour acheter, vendre, retirer ou transférer des fonds.

1. Depuis le site officiel Kraken, vérifier l'existence et les **permissions** de la clé `Dydy-bot`.
2. Si la valeur secrète n'a pas été conservée, créer une **nouvelle clé dédiée et restreinte à la lecture**.
3. Activer uniquement les autorisations nécessaires à la consultation du solde, des ordres et des opérations. **Ne pas autoriser les retraits ni le trading** pour ce script.
4. Configurer les deux variables `KRAKEN_API_KEY` et `KRAKEN_API_SECRET` dans l'environnement **privé de la machine qui lance le script**. Ne jamais les ajouter à GitHub, aux pages web, aux tickets Jira, à Google Drive partagé ou au chat.
5. Lancer `python tools/kraken_readonly.py balance` depuis un environnement autorisé. La réponse est une donnée réelle horodatée, à vérifier depuis Kraken.
6. Facultatif : `python tools/kraken_readonly.py open-orders` et `python tools/kraken_readonly.py trades`.

Le dépôt exclut déjà les fichiers `.env`, `secrets/` et `*.key`. Les sorties du script peuvent révéler des avoirs privés : **ne pas les committer**.

## Phantom et Jupiter ne sont pas Kraken

Phantom est un **portefeuille** : il doit être connecté depuis le navigateur de son propriétaire.
La connexion peut révéler son adresse publique, mais **ne donne pas** le droit de signer un échange.
Jupiter est un protocole Solana : ses positions doivent être vérifiées séparément sur la blockchain ou les API du service.

Le terminal public `crypto-terminal` est **lecture seule** pour l'inventaire des soldes. N'y déployer aucun secret Kraken.
La connexion à Phantom ne doit **jamais** déclencher automatiquement de transaction.

## État du projet

- Identité de la clé Kraken Dydy-bot : **confirmée par l'e-mail**, secret non retrouvé.
- Script de lecture Kraken : **préparé, mais non exécuté avec des identifiants**.
- Bot sur ordinateur : **non confirmé en fonctionnement continu**.
