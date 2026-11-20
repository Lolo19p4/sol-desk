#!/usr/bin/env python3
"""Dydy-bot: vérification réelle, en lecture seule, des fonds Kraken.

Ne crée pas de clé, n'envoie pas d'ordre, ne déplace pas de fonds.
N'inclut jamais de clés dans GitHub ou la sortie.
Nécessite KRAKEN_API_KEY et KRAKEN_API_SECRET dans les variables
d'environnement de la machine d'exécution (pas dans le navigateur).
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE_URL = "https://api.kraken.com"
ALLOWED_ENDPOINTS = {
    "balance": "/0/private/Balance",
    "open-orders": "/0/private/OpenOrders",
    "trades": "/0/private/TradesHistory",
}


def signed_post(path, api_key, api_secret):
    """Requête privée Kraken authentifiée, uniquement sur la liste autorisée."""
    if path not in ALLOWED_ENDPOINTS.values():
        raise ValueError("Point de terminaison non autorisé")
    nonce = str(time.time_ns())
    body = urlencode({"nonce": nonce}).encode("ascii")
    key = base64.b64decode(api_secret.strip(), validate=True)
    digest = hashlib.sha256(nonce.encode("ascii") + body).digest()
    sig = base64.b64encode(
        hmac.new(key, path.encode("ascii") + digest, hashlib.sha512).digest()
    ).decode("ascii")
    request = Request(
        BASE_URL + path,
        data=body,
        headers={
            "API-Key": api_key.strip(),
            "API-Sign": sig,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "SolDesk-Dydy-ReadOnly/1.0",
        },
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        data = json.load(response)
    errors = data.get("error") or []
    if errors:
        # Ne pas imprimer d'en-têtes ni de payloads potentiellement sensibles.
        raise RuntimeError("Réponse Kraken : " + "; ".join(str(x) for x in errors))
    return data.get("result") or {}


def main():
    if len(sys.argv) > 2 or (len(sys.argv) == 2 and sys.argv[1] not in ALLOWED_ENDPOINTS):
        print("Usage : python tools/kraken_readonly.py [balance|open-orders|trades]", file=sys.stderr)
        return 2
    operation = sys.argv[1] if len(sys.argv) == 2 else "balance"
    api_key = os.environ.get("KRAKEN_API_KEY", "")
    api_secret = os.environ.get("KRAKEN_API_SECRET", "")
    if not api_key or not api_secret:
        print(
            "Connexion Kraken inactive : KRAKEN_API_KEY ou KRAKEN_API_SECRET "
            "manquant dans l'environnement local. Ne les colle pas dans le chat "
            "ni dans les fichiers GitHub.",
            file=sys.stderr,
        )
        return 2
    try:
        result = signed_post(ALLOWED_ENDPOINTS[operation], api_key, api_secret)
    except (ValueError, RuntimeError, HTTPError, URLError, TimeoutError) as exc:
        print("Lecture du compte non confirmée : " + str(exc), file=sys.stderr)
        return 1
    report = {
        "source": "Kraken private REST API",
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "operation": operation,
        "verified_by": "authenticated API response",
        "data": result,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
