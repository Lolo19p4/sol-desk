#!/usr/bin/env python3
"""Exporte un trades.json public depuis l'état et le journal du bot.

Lit auto_state.json et journal_auto.md à côté de ce script (ou indiqués
en arguments). N'écrit que des champs publics : date, actif, sens,
montants, prix, lien Solscan, motif, gain/perte.
Aucune clé, aucun secret, aucun chemin local.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE_PATH = HERE / "auto_state.json"
JOURNAL_PATH = HERE / "journal_auto.md"
OUT_PATH = HERE / "trades.json"

SIG_RE = re.compile(r"\b([1-9A-HJ-NP-Za-km-z]{86,90})\b")
URL_RE = re.compile(r"https://solscan\.io/tx/([1-9A-HJ-NP-Za-km-z]{80,90})")
PATH_RE = re.compile(r"(?:(?:/home|/workspace|/Users|/var|/etc)[^\s,;)]+|(?:[A-Za-z]:\\)[^\s,;)]+)")
SECRET_RE = re.compile(
    r"(?i)(api[_-]?key|secret|seed|private[_-]?key|mnemonic|bearer\s+\S+|password)\s*[:=]\s*\S+"
)

ACTIF_MAP = {
    "SOL": "SOL",
    "JUP": "JUP",
    "RAY": "RAY",
    "WIF": "WIF",
    "BONK": "BONK",
    "ETH": "ETH",
    "WETH": "ETH",
    "BTC": "BTC",
    "WBTC": "BTC",
    "PERCOLATOR": "Percolator",
}

# Échecs (0 reçu) et dépôts : jamais des trades.
SKIP_TX = {
    "5WDQwdvM7dUJDs6hnnCREVJabgc4Tb4M7wNF4D9aXTcVQV2ZaH9v1zFpkuZxBEwKq3rZqVyXymVYjFtbigWFfHxf",
    "LpeKxHnr5jr534kKAXh76GB1FD6R5Cv5gXwHX3qR3aQStU4DpKTdULf9JxFJZPa65jbEz437BEyxXS1iP5yjPZS",
}


def iso_paris(s):
    if not s:
        return None
    s = str(s).strip()
    s = s.replace(" (Paris)", "").replace(" (Europe/Paris)", "")
    m = re.match(
        r"^(\d{2})/(\d{2})/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?",
        s,
    )
    if m:
        d, mo, y, h, mi, sec = m.groups()
        return f"{y}-{mo}-{d}T{int(h or 0):02d}:{int(mi or 0):02d}:{int(sec or 0):02d}+01:00"
    m = re.match(
        r"^(\d{2})/(\d{2})(?:/(\d{4}))?[ T](\d{1,2}):(\d{2})(?::(\d{2}))?",
        s,
    )
    if m:
        d, mo, y, h, mi, sec = m.groups()
        y = y or "2026"
        return f"{y}-{mo}-{d}T{int(h):02d}:{int(mi):02d}:{int(sec or 0):02d}+01:00"
    m = re.match(
        r"^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?([+-]\d{2}:\d{2}|Z)?",
        s,
    )
    if m:
        day, hm, sec, off = m.groups()
        sec = sec or "00"
        off = "+01:00" if (not off or off == "Z") else off
        return f"{day}T{hm}:{sec}{off}"
    return None


def now_paris():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S+01:00")


def clean_text(s):
    if s is None:
        return None
    t = str(s)
    t = PATH_RE.sub("", t)
    t = SECRET_RE.sub("", t)
    t = re.sub(r"auto_state\.json", "", t)
    t = re.sub(r"\s+", " ", t).strip(" -–,;")
    return t or None


def to_num(x):
    if x is None or isinstance(x, bool):
        return None
    if isinstance(x, (int, float)):
        return float(x) if not isinstance(x, int) or abs(x) >= 1000 else (int(x) if float(x) == int(x) and abs(x) >= 1 and abs(x - int(x)) < 1e-12 else float(x))
    if isinstance(x, str):
        t = x.strip().replace("\u00a0", " ").replace(" ", "").replace(",", ".")
        t = re.sub(r"[^\d.\-eE+]", "", t)
        if t in ("", ".", "-", "+"):
            return None
        try:
            return float(t)
        except ValueError:
            return None
    return None


def round_num(x, n=8):
    if x is None:
        return None
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    if not (x == x):  # NaN
        return None
    r = round(x, n)
    if abs(r) >= 1 and abs(r - round(r, 2)) < 1e-8 and n >= 2:
        # keep more precision for crypto qty if needed; caller decides
        pass
    if r == int(r) and abs(r) < 1e12:
        return int(r)
    return r


def norm_actif(name):
    if not name:
        return None
    t = str(name).strip()
    if re.search(r"\d", t):
        return None
    key = t.upper().replace(" ", "")
    return ACTIF_MAP.get(key)


def solscan(tx):
    if not tx:
        return None
    tx = str(tx).strip()
    if tx.startswith("http"):
        m = URL_RE.search(tx)
        return f"https://solscan.io/tx/{m.group(1)}" if m else None
    if SIG_RE.fullmatch(tx):
        return f"https://solscan.io/tx/{tx}"
    return None


def tx_id(link_or_sig):
    if not link_or_sig:
        return None
    m = URL_RE.search(str(link_or_sig)) or SIG_RE.search(str(link_or_sig))
    return m.group(1) if m else None


def make_trade(
    date,
    actif,
    sens,
    qte=None,
    usdc=None,
    prix=None,
    tx=None,
    motif=None,
    pnl_usd=None,
    pnl_pct=None,
    paye=None,
):
    sig = tx_id(tx)
    if sig in SKIP_TX:
        return None
    actif = norm_actif(actif)
    if not actif or sens not in ("achat", "vente"):
        return None
    qte = round_num(qte, 9)
    usdc = round_num(usdc, 6)
    prix = round_num(prix, 8)
    if prix is None and qte and usdc and qte != 0:
        prix = round_num(usdc / qte, 8)
    if sens == "achat":
        pnl_usd = None
        pnl_pct = None
    row = {
        "date": iso_paris(date) if looks_like_date(date) or (isinstance(date, str) and iso_paris(date)) else None,
        "actif": actif,
        "sens": sens,
        "qte": qte,
        "usdc": usdc,
        "prix": prix,
        "solscan": solscan(sig) if sig else None,
        "motif": clean_text(motif),
        "pnl_usd": round_num(pnl_usd, 4),
        "pnl_pct": round_num(pnl_pct, 2),
    }
    if paye:
        row["paye"] = paye
    return row


def add(rows, trade):
    if not trade:
        return
    rows.append(trade)


# ---------- auto_state ----------

def looks_like_date(s):
    if s is None or isinstance(s, (int, float, bool)):
        return False
    return iso_paris(str(s)) is not None and not str(s).replace(".", "", 1).isdigit()


def from_origin_buy(origin, motif=None):
    if not isinstance(origin, dict):
        return None
    date = None
    for k in ("date", "date_entree", "ouverte", "entree"):
        v = origin.get(k)
        if looks_like_date(v):
            date = v
            break
    actif = origin.get("actif")
    qte = origin.get("qte") or origin.get("qte_vendue")
    usdc = origin.get("cout_usdc") or origin.get("cout")
    prix = origin.get("prix_entree")
    if prix is None and isinstance(origin.get("entree"), (int, float)):
        prix = origin.get("entree")
    tx = origin.get("tx")
    note = motif or origin.get("demande") or origin.get("note")
    return make_trade(date, actif, "achat", qte, usdc, prix, tx, note)


def walk_state(state, rows):
    # Scanner Percolator close + we still need the buy from journal
    sc = state.get("scanner_dernier") or {}
    if sc.get("tx"):
        add(
            rows,
            make_trade(
                sc.get("cloture"),
                sc.get("actif"),
                "vente",
                None,
                sc.get("recu_usdc"),
                None,
                sc.get("tx"),
                sc.get("motif"),
                (float(sc["recu_usdc"]) - float(sc["cout_usdc"]))
                if sc.get("recu_usdc") is not None and sc.get("cout_usdc") is not None
                else None,
                sc.get("pnl_pct"),
            ),
        )

    # Swap test
    sw = state.get("dernier_swap_test") or {}
    if sw.get("tx"):
        add(
            rows,
            make_trade(
                sw.get("date"),
                "SOL",
                "achat",
                sw.get("recu_sol"),
                1.5,
                None,
                sw.get("tx"),
                "Swap test USDC vers SOL",
            ),
        )

    # Grille last trade (others come from journal)
    gr = (state.get("grille") or {}).get("dernier_trade") or {}
    if gr.get("tx"):
        sens_raw = str(gr.get("sens") or "")
        qte = None
        usdc = None
        m = re.search(
            r"vente\s+([\d,.\s]+)\s*SOL\s*->\s*([\d,.\s]+)\s*USDC",
            sens_raw,
            re.I,
        )
        if m:
            qte = to_num(m.group(1))
            usdc = to_num(m.group(2))
        add(
            rows,
            make_trade(
                gr.get("date"),
                "SOL",
                "vente",
                qte,
                usdc,
                gr.get("prix"),
                gr.get("tx"),
                "Vente palier de la grille",
                gr.get("pnl_usd"),
                gr.get("pnl_pct"),
            ),
        )

    # Clôtures du 5/11 (ventes groupées, achats via journal / origines)
    c5 = state.get("clotures_05_11_1656") or {}
    date5 = c5.get("date")
    motif5 = c5.get("motif")
    for actif, rec in c5.items():
        if actif in ("date", "motif") or not isinstance(rec, dict):
            continue
        add(
            rows,
            make_trade(
                date5,
                actif,
                "vente",
                rec.get("qte"),
                rec.get("recu_usdc"),
                rec.get("prix_sortie"),
                rec.get("tx"),
                motif5,
                rec.get("pnl_usd"),
                rec.get("pnl_pct"),
            ),
        )

    # Positions manuelles / auto clôturées (achat + vente)
    for bloc in (state.get("cloture_manuel") or {}).values():
        if not isinstance(bloc, dict):
            continue
        add(rows, from_origin_buy(bloc, bloc.get("demande") or bloc.get("note")))
        add(
            rows,
            make_trade(
                bloc.get("cloture") or bloc.get("date_sortie"),
                bloc.get("actif"),
                "vente",
                bloc.get("qte"),
                bloc.get("recu_usdc"),
                None,
                bloc.get("tx_sortie"),
                bloc.get("motif"),
                (float(bloc["recu_usdc"]) - float(bloc["cout_usdc"]))
                if bloc.get("recu_usdc") is not None and bloc.get("cout_usdc") is not None
                else None,
                bloc.get("pnl_pct"),
            ),
        )

    def close_block(bloc, default_actif=None):
        if not isinstance(bloc, dict) or not (bloc.get("tx") or bloc.get("tx_sortie")):
            return
        origin = bloc.get("position_origine") or bloc.get("position") or {}
        if isinstance(origin, dict) and origin.get("tx"):
            buy_motif = origin.get("demande") or origin.get("note") or None
            add(rows, from_origin_buy({**origin, "actif": origin.get("actif") or default_actif or bloc.get("actif")}, buy_motif))
            # TP partiel
            tp = origin.get("tp_partiel_fait")
            if isinstance(tp, dict) and tp.get("tx"):
                add(
                    rows,
                    make_trade(
                        tp.get("date"),
                        origin.get("actif") or bloc.get("actif"),
                        "vente",
                        tp.get("jup_vendus") or tp.get("qte"),
                        tp.get("usdc_recu") or tp.get("recu_usdc"),
                        None,
                        tp.get("tx"),
                        "Vente partielle 40 % (objectif atteint)",
                    ),
                )
        actif = bloc.get("actif") or (origin.get("actif") if isinstance(origin, dict) else None) or default_actif
        qte = bloc.get("qte_vendue") or bloc.get("jup_vendus") or bloc.get("qte")
        if qte is None and isinstance(origin, dict):
            qte = origin.get("qte") or origin.get("qte_vendue")
        if actif and str(actif).upper() == "JUP" and bloc.get("jup_vendus"):
            qte = bloc.get("jup_vendus")
        usdc = bloc.get("usdc_recu") or bloc.get("recu_usdc")
        cout = bloc.get("cout_usdc") or bloc.get("cout") or bloc.get("cout_usdc_vendu")
        if cout is None and isinstance(origin, dict):
            cout = origin.get("cout_usdc") or origin.get("cout")
        pnl_usd = bloc.get("pnl_usd")
        if pnl_usd is None and usdc is not None and cout is not None:
            pnl_usd = float(usdc) - float(cout)
        add(
            rows,
            make_trade(
                bloc.get("date") or bloc.get("cloture"),
                actif,
                "vente",
                qte,
                usdc,
                bloc.get("prix_moyen") or bloc.get("prix_sortie"),
                bloc.get("tx") or bloc.get("tx_sortie"),
                bloc.get("motif"),
                pnl_usd,
                bloc.get("pnl_pct"),
            ),
        )

    for key in (
        "cloture_sol_manuel_18_11",
        "cloture_sol_manuel_18_11_1828",
        "cloture_auto_jup_18_11_1945",
        "cloture_sol_manuel_jup_18_11_1946",
        "cloture_jup_18_11_2040",
        "cloture_jup_19_11_0700",
    ):
        default = "JUP" if "jup" in key else "SOL"
        close_block(state.get(key) or {}, default)

    for bloc in (state.get("clotures_reactif") or {}).values():
        close_block(bloc)

    # Open positions still in state (none expected)
    for pos in state.get("positions") or []:
        if isinstance(pos, dict) and pos.get("tx"):
            add(rows, from_origin_buy(pos))


# ---------- journal ----------

HEAD_RE = re.compile(r"^##\s+(.+?)\s*$")
DATE_IN_HEAD = re.compile(
    r"("
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2})?"
    r"|"
    r"\d{2}/\d{2}/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?"
    r"|"
    r"\d{2}/\d{2}(?:/\d{4})?\s+\d{1,2}:\d{2}"
    r")"
)

FR_NUM = r"\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?"


def parse_fr_num(s):
    if not s:
        return None
    return to_num(s)


def heading_date(title):
    m = DATE_IN_HEAD.search(title or "")
    return iso_paris(m.group(1)) if m else None


def guess_sens(text):
    t = text.lower()
    if any(w in t for w in ("échec", "echec", "dépôt reçu", "depot recu", "pas un trade")):
        return None
    # vente before achat if both (e.g. long recap)
    vente = bool(re.search(r"\b(vente|vends|sortie|sorti|clôture|cloture)\b", t))
    achat = bool(re.search(r"\b(achat|acheté|achetee|entrée|entree)\b", t)) or "trade :" in t or "trade :" in t
    if "->" in text or "→" in text:
        # direction helps
        if re.search(r"USDC\s*(?:→|->)\s*", text, re.I) and not re.search(r"(?:→|->)\s*[\d,.\s]+\s*USDC", text, re.I):
            achat = True
        if re.search(r"(?:→|->)\s*[\d,.\s]+\s*USDC", text, re.I):
            vente = True
    if vente and not achat:
        return "vente"
    if achat and not vente:
        return "achat"
    if vente and achat:
        # prefer the arrow direction of the actual fill
        if re.search(r"(?:→|->)\s*[\d,.\s]+\s*USDC", text, re.I):
            return "vente"
        if re.search(r"USDC\s*(?:→|->)", text, re.I):
            return "achat"
        return "vente"
    return None


def guess_actif(text):
    asset = r"(wETH|WETH|wBTC|WBTC|Percolator|ETH|BTC|SOL|JUP|RAY|WIF|BONK)"
    patterns = [
        r"(?:→|->)\s*[\d,.\s]+\s+" + asset + r"\b",
        r"\bACHAT\s+" + asset + r"\b",
        r"\bVENTE\s+(?:40%\s+)?" + asset + r"\b",
        r"\bSORTIE\s+" + asset + r"\b",
        asset + r"\s*(?:→|->|@)",
        r"\b" + asset + r"\b",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            a = norm_actif(m.group(1))
            if a:
                return a
    return None


def extract_leg(text, sens, actif):
    """Qté de l'actif et montant USDC, d'après les flèches."""
    t = text.replace("→", "->")
    qte = usdc = prix = paye = None
    asset = r"(?:wETH|WETH|wBTC|WBTC|Percolator|ETH|BTC|SOL|JUP|RAY|WIF|BONK)"

    m = re.search(
        "(" + FR_NUM + r")\s*USDC\s*->\s*(" + FR_NUM + r")\s*(" + asset + r")\b",
        t,
        re.I,
    )
    if m:
        usdc = parse_fr_num(m.group(1))
        qte = parse_fr_num(m.group(2))
        actif = norm_actif(m.group(3)) or actif

    m = re.search(
        "(" + FR_NUM + r")\s*(" + asset + r")\s*->\s*(" + FR_NUM + r")\s*USDC",
        t,
        re.I,
    )
    if m:
        qte = parse_fr_num(m.group(1))
        actif = norm_actif(m.group(2)) or actif
        usdc = parse_fr_num(m.group(3))

    m = re.search(
        "(" + FR_NUM + r")\s*SOL\b(?:(?!->).){0,80}->\s*(" + FR_NUM + r")\s*(" + asset + r")\b",
        t,
        re.I,
    )
    if m and usdc is None:
        paye = m.group(1).replace(" ", "").replace("\u00a0", "") + " SOL"
        qte = parse_fr_num(m.group(2))
        actif = norm_actif(m.group(3)) or actif

    m = re.search(r"@\s*~?\s*(" + FR_NUM + r")\s*\$?", t)
    if m:
        prix = parse_fr_num(m.group(1))
    else:
        m = re.search(
            r"(?:prix(?:\s+moyen)?|entrée|entree)\s*[~≈]?\s*(" + FR_NUM + r")\s*\$?",
            t,
            re.I,
        )
        if m:
            prix = parse_fr_num(m.group(1))
        else:
            m = re.search(r"à\s*~?\s*(" + FR_NUM + r")\s*\$", t, re.I)
            if m:
                prix = parse_fr_num(m.group(1))

    pnl_usd = pnl_pct = None
    m = re.search(
        r"(?:P&?L|PnL|gain|perte)\s*[≈~]?\s*([+\-]?\s*" + FR_NUM + r")\s*\$",
        t,
        re.I,
    )
    if m:
        pnl_usd = parse_fr_num(m.group(1))
        if re.search(r"\bperte\b", t, re.I) and pnl_usd and pnl_usd > 0:
            pnl_usd = -pnl_usd
    m = re.search(r"co[uû]t\s+(" + FR_NUM + r")", t, re.I)
    if m and usdc is not None and pnl_usd is None:
        cout = parse_fr_num(m.group(1))
        if cout is not None:
            pnl_usd = round(usdc - cout, 4)
            if cout:
                pnl_pct = round((usdc - cout) / cout * 100, 2)
    # Pourcentage seulement s'il est collé à un P&L / coût, pas un objectif +8 %
    if pnl_pct is None and (pnl_usd is not None or re.search(r"(?i)p&?l|pnl|co[uû]t", t)):
        m = re.search(r"([+\-]\s*" + FR_NUM + r")\s*%", t)
        if m:
            pnl_pct = parse_fr_num(m.group(1))
    return actif, qte, usdc, prix, paye, pnl_usd, pnl_pct



def tidy_motif(s):
    s = clean_text(s)
    if not s:
        return None
    s = re.sub(r"^(?:##\s*)?(?:\d{4}-)?\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2})?\s*[—-]\s*", "", s)
    s = re.sub(r"^##\s*[^—]+—\s*", "", s)
    s = re.sub(r"(?i)\s*Tx\s*:?\s*https://solscan\.io/tx/\S+", "", s)
    s = re.sub(r"(?i)\s*Tx\s*:?\s*[1-9A-HJ-NP-Za-km-z]{80,90}\S*", "", s)
    s = re.sub(r"(?i)\s*\(meta\.err null\)", "", s)
    s = re.sub(r"\s+", " ", s).strip(" -–,;")
    return s or None


def motif_from(text, heading):
    h = heading or ""
    m = re.search(r"—\s*(.+)$", h)
    base = tidy_motif(m.group(1)) if m else tidy_motif(h)
    body = re.sub(r"(?i)(?:Tx|tx)\s*:?\s*[1-9A-HJ-NP-Za-km-z]{80,90}.*$", "", text).strip()
    body = tidy_motif(body)
    if base and len(base) <= 160 and re.search(r"(?i)achat|vente|sortie|stop|demande|grille|cassure|scanner|swap", base):
        return base
    if body and len(body) <= 220:
        return body
    if body:
        cut = body[:220]
        return cut.rsplit(" ", 1)[0] if " " in cut else cut
    return base


def from_journal(text, rows):
    lines = text.splitlines()
    heading = ""
    # Group consecutive lines in a section; also extract per-line trades
    buf_lines = []
    current_date = None

    def flush_block(block, date, head):
        if not block:
            return
        blob = "\n".join(block)
        # skip pure status
        if re.search(r"AUCUN TRADE", blob) and not SIG_RE.search(blob) and not URL_RE.search(blob):
            return
        # Find all signatures in the block, map each to its line
        for line in block:
            low = line.lower()
            if any(h in low for h in ("dépôt reçu", "pas un trade du bot", "échec confirmé", "aucun usdc dépensé")):
                # still skip deposit / fail even if sig present
                continue
            if "ne plus renvoyer" in low or "a bien été prévenu" in low or "a été prévenu" in low:
                continue
            sigs = URL_RE.findall(line) + SIG_RE.findall(line)
            if not sigs:
                continue
            # unique preserve order
            seen = set()
            uniq = []
            for s in sigs:
                if s not in seen:
                    seen.add(s)
                    uniq.append(s)
            for sig in uniq:
                ctx = line
                only_tx = bool(re.search(r"(?i)^\s*-?\s*Tx\s*:?\s*[1-9A-HJ-NP-Za-km-z]{80,90}", line.strip())) or len(re.sub(SIG_RE, "", line).strip()) < 24
                if only_tx or re.match(r"^\s*-?\s*(Tx|tx)\s*:", line) or len(line) < 80:
                    idx = block.index(line)
                    prevs = [block[i] for i in range(max(0, idx - 3), idx)]
                    ctx = " ".join(prevs + [line])
                sens = guess_sens(ctx) or guess_sens(head) or guess_sens(blob)
                actif = guess_actif(ctx) or guess_actif(head)
                actif, qte, usdc, prix, paye, pnl_usd, pnl_pct = extract_leg(ctx, sens, actif)
                if not actif:
                    actif = guess_actif(head)
                motif_src = line
                if len(re.sub(SIG_RE, "", line).strip()) < 24:
                    # ligne quasi-uniquement une signature : prendre la dernière ligne parlante
                    for prev in reversed(prevs if "prevs" in dir() or True else []):
                        pass
                    # prevs may not exist; rebuild
                    try:
                        idx = block.index(line)
                        for prev in reversed(block[max(0, idx-3):idx]):
                            if re.search(r"(?i)achat|vente|sortie|trade|usdc|stop|demande|grille|cassure|scanner", prev):
                                motif_src = prev
                                break
                    except ValueError:
                        motif_src = ctx
                else:
                    motif_src = ctx if re.search(r"(?i)achat|vente|sortie|trade", ctx) and len(ctx) < 280 else line
                motif = motif_from(motif_src, head)
                add(
                    rows,
                    make_trade(date, actif, sens or "achat", qte, usdc, prix, sig, motif, pnl_usd, pnl_pct, paye),
                )

    for line in lines:
        hm = HEAD_RE.match(line)
        if hm:
            flush_block(buf_lines, current_date, heading)
            heading = hm.group(1)
            current_date = heading_date(heading)
            buf_lines = []
            # A heading itself can be a trade line
            if SIG_RE.search(line) or URL_RE.search(line) or re.search(r"\b(ACHAT|VENTE|SORTIE|TRADE)\b", line):
                buf_lines.append(line)
            continue
        buf_lines.append(line)
    flush_block(buf_lines, current_date, heading)


def merge(rows):
    """Deduplicate by Solscan tx. Prefer the richest record. One vente per tx (combined close)."""
    by = {}
    no_tx = []
    for r in rows:
        link = r.get("solscan")
        if not link:
            no_tx.append(r)
            continue
        sig = tx_id(link)
        prev = by.get(sig)
        if not prev:
            by[sig] = r
            continue
        # Prefer record with more filled fields, and larger usdc for same sens (combined)
        def score(x):
            filled = sum(1 for k in ("date", "actif", "sens", "qte", "usdc", "prix", "motif", "pnl_usd", "pnl_pct") if x.get(k) not in (None, ""))
            usdc = abs(x.get("usdc") or 0)
            qte = abs(x.get("qte") or 0)
            return (filled, usdc, qte)

        # Ne pas écraser un champ déjà rempli (l'état structuré est ajouté en premier).
        for k, v in r.items():
            cur = by[sig].get(k)
            if k == "date" and not looks_like_date(cur) and looks_like_date(v):
                by[sig][k] = iso_paris(v) or v
                continue
            if k in ("qte", "usdc") and isinstance(v, (int, float)) and isinstance(cur, (int, float)):
                if abs(v) > abs(cur):
                    by[sig][k] = v
                    if k == "usdc":
                        for f in ("pnl_usd", "pnl_pct", "prix", "motif"):
                            if r.get(f) not in (None, ""):
                                by[sig][f] = r[f]
                continue
            if cur in (None, "") and v not in (None, ""):
                by[sig][k] = v
    out = list(by.values()) + no_tx
    def key(r):
        d = r.get("date")
        if not isinstance(d, str):
            d = ""
        return d, 0 if r.get("sens") == "achat" else 1, r.get("solscan") or ""
    out.sort(key=key)
    # Final hygiene
    clean = []
    for r in out:
        if not r.get("actif") or not r.get("sens"):
            continue
        if r.get("solscan") is None and r.get("qte") is None and r.get("usdc") is None:
            continue
        # drop leftover empty paye
        if "paye" in r and not r["paye"]:
            r = {k: v for k, v in r.items() if k != "paye"}
        r["motif"] = tidy_motif(r.get("motif"))
        if not r["motif"]:
            r["motif"] = ("Achat " if r["sens"] == "achat" else "Vente ") + r["actif"]
        if r.get("sens") == "vente" and r.get("prix") and r.get("qte") and r.get("usdc"):
            implied = r["usdc"] / r["qte"] if r["qte"] else None
            if implied and abs(r["prix"] - implied) / max(abs(implied), 1e-12) > 0.5:
                r["prix"] = round(implied, 8)
        clean.append(r)
    return clean


def enrich_sell_pnl(rows):
    for r in rows:
        if r.get("sens") != "vente":
            continue
        # leave recorded values; nothing to invent
        if r.get("pnl_usd") is None and r.get("pnl_pct") is None:
            pass
    return rows


def stats(trades):
    ventes = [t for t in trades if t.get("sens") == "vente" and t.get("pnl_usd") is not None]
    gagnants = sum(1 for t in ventes if t["pnl_usd"] > 0)
    perdants = sum(1 for t in ventes if t["pnl_usd"] < 0)
    total = round(sum(t["pnl_usd"] for t in ventes), 4)
    return {
        "nb_trades": len(trades),
        "nb_ventes_avec_pnl": len(ventes),
        "gagnants": gagnants,
        "perdants": perdants,
        "pnl_total_usd": total,
    }


def main():
    state_path = Path(sys.argv[1]) if len(sys.argv) > 1 else STATE_PATH
    journal_path = Path(sys.argv[2]) if len(sys.argv) > 2 else JOURNAL_PATH
    out_path = Path(sys.argv[3]) if len(sys.argv) > 3 else OUT_PATH

    rows = []
    if state_path.exists():
        state = json.loads(state_path.read_text())
        walk_state(state, rows)
    else:
        print(f"Avertissement : {state_path} introuvable", file=sys.stderr)
        state = {}

    if journal_path.exists():
        from_journal(journal_path.read_text(), rows)
    else:
        print(f"Avertissement : {journal_path} introuvable", file=sys.stderr)

    trades = enrich_sell_pnl(merge(rows))
    # Never leak paths
    payload = {
        "maj": now_paris(),
        "fuseau": "Europe/Paris",
        "mode": {
            "nom": "Cassure 24 h + régime 4 h (variante C)",
            "actifs": ["SOL", "ETH", "BTC"],
            "taille_pct": 47,
            "max_positions": 2,
            "execution": "Jupiter direct, glissement 1 %",
            "conditions_achat": [
                "Clôture 4 h supérieure à l'EMA50 4 h",
                "EMA9 4 h supérieure à l'EMA21 4 h",
                "Clôture 1 h supérieure au plus haut des 24 heures précédentes",
                "Pas de vente du même actif depuis moins de 6 heures",
            ],
        },
        "positions_ouvertes": [],
        "resume": stats(trades),
        "trades": trades,
    }
    # If state has open positions, export public fields only
    ouvertes = []
    for pos in state.get("positions") or []:
        if not isinstance(pos, dict):
            continue
        ouvertes.append(
            {
                "date": iso_paris(pos.get("date") or pos.get("entree") or pos.get("ouverte")),
                "actif": norm_actif(pos.get("actif")),
                "qte": round_num(pos.get("qte"), 9),
                "usdc": round_num(pos.get("cout_usdc") or pos.get("cout"), 6),
                "prix": round_num(pos.get("prix_entree") or (pos.get("entree") if isinstance(pos.get("entree"), (int, float)) else None), 8),
                "solscan": solscan(pos.get("tx")),
                "motif": clean_text(pos.get("demande") or pos.get("note") or pos.get("motif")),
            }
        )
    payload["positions_ouvertes"] = [p for p in ouvertes if p.get("actif")]

    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    # Safety net
    if PATH_RE.search(text) or SECRET_RE.search(text):
        raise SystemExit("Refus d'écrire : un chemin local ou un secret a été détecté dans la sortie.")
    if any(s in text.upper() for s in ("PRIVATE KEY", "BEGIN RSA", "API_KEY", "SECRET_KEY")):
        raise SystemExit("Refus d'écrire : un motif sensible a été détecté dans la sortie.")
    out_path.write_text(text)
    print(f"Écrit {out_path} — {len(trades)} trades, {payload['resume']}")


if __name__ == "__main__":
    main()
