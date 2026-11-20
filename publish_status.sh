#!/usr/bin/env bash
# Publie trades.json et status.json sur master seulement s'ils ont changé.
# N'ajoute jamais d'autre fichier. Ne plante pas si rien n'a changé.
# Si origin/master a avancé, rebase en gardant la version locale de
# status.json et trades.json, puis retente le push une fois.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

python3 "$ROOT/export_trades.py"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "master" ]]; then
  echo "Refus : publication uniquement depuis master (branche actuelle : $branch)."
  exit 1
fi

# N'ajoute que les deux fichiers publics.
git add -- trades.json status.json

if git diff --cached --quiet -- trades.json status.json; then
  echo "Aucun changement à publier."
  exit 0
fi

# Filet de sécurité : rien d'autre ne doit être en staging à cause de nous.
staged="$(git diff --cached --name-only)"
unexpected="$(printf '%s\n' "$staged" | grep -vE '^(trades\.json|status\.json)$' || true)"
if [[ -n "$unexpected" ]]; then
  echo "Refus : d'autres fichiers sont en staging :"
  printf '%s\n' "$unexpected"
  git restore --staged -- trades.json status.json
  exit 1
fi

git commit -m "maj status et trades"

# En rebase, « theirs » = nos commits locaux (status.json / trades.json à jour).
rebase_master() {
  git fetch origin
  git pull --rebase -X theirs origin master
}

if ! { rebase_master && git push origin master; }; then
  echo "Push refusé, nouvelle tentative après rebase."
  rebase_master
  git push origin master
fi
echo "Publié sur master."
