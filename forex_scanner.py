#!/usr/bin/env python3
import os
import sys
import json
import time
from urllib.parse import urlencode
from urllib.request import urlopen, Request

API_URL = "https://www.alphavantage.co/query"

HELP = """
Simple Forex Scanner (Alpha Vantage)

Usage:
  forex_scanner.py EURUSD GBPUSD USDJPY
  forex_scanner.py --pairs EURUSD,GBPUSD,USDJPY

Environment:
  ALPHAVANTAGE_API_KEY  Your Alpha Vantage API key (required if --api-key not provided)

Options:
  --pairs P1,P2,...     Comma-separated pairs (6-letter, slash optional)
  --api-key KEY         Provide API key via CLI instead of environment
  --sleep SECONDS       Sleep between requests (default 15 to respect free tier)
  -h, --help            Show help

Examples:
  ALPHAVANTAGE_API_KEY=YOUR_KEY forex_scanner.py EURUSD GBPUSD
  forex_scanner.py --api-key YOUR_KEY --pairs EUR/USD,USDJPY
""".strip()

def parse_args(argv):
    if not argv or any(a in ("-h", "--help") for a in argv):
        print(HELP)
        sys.exit(0)

    api_key = None
    pairs = []
    sleep_seconds = 15

    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--api-key" and i + 1 < len(argv):
            api_key = argv[i + 1]
            i += 2
        elif a == "--pairs" and i + 1 < len(argv):
            pairs += [s.strip() for s in argv[i + 1].split(",") if s.strip()]
            i += 2
        elif a == "--sleep" and i + 1 < len(argv):
            sleep_seconds = int(argv[i + 1])
            i += 2
        else:
            if a.startswith("-"):
                print(f"Unknown option: {a}", file=sys.stderr)
                print(HELP)
                sys.exit(1)
            pairs.append(a)
            i += 1

    if not api_key:
        api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    if not api_key:
        print("Error: Missing API key. Set ALPHAVANTAGE_API_KEY or pass --api-key.", file=sys.stderr)
        sys.exit(1)

    if not pairs:
        print("Error: Provide pairs as positional args or --pairs.", file=sys.stderr)
        sys.exit(1)

    # Normalize pairs: remove '/', uppercase, ensure 6 letters
    norm_pairs = []
    for p in pairs:
        s = p.replace("/", "").upper().strip()
        if len(s) != 6:
            print(f"Warning: Skipping invalid pair '{p}'", file=sys.stderr)
            continue
        norm_pairs.append(s)

    if not norm_pairs:
        print("Error: No valid pairs after normalization.", file=sys.stderr)
        sys.exit(1)

    return api_key, norm_pairs, sleep_seconds


def fetch_rate(from_ccy: str, to_ccy: str, api_key: str):
    query = {
        "function": "CURRENCY_EXCHANGE_RATE",
        "from_currency": from_ccy,
        "to_currency": to_ccy,
        "apikey": api_key,
    }
    url = f"{API_URL}?{urlencode(query)}"
    req = Request(url, headers={"User-Agent": "forex-scanner/1.0"})
    with urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    payload = data.get("Realtime Currency Exchange Rate", {})
    return {
        "pair": f"{from_ccy}{to_ccy}",
        "from": from_ccy,
        "to": to_ccy,
        "exchangeRate": float(payload.get("5. Exchange Rate")) if payload.get("5. Exchange Rate") else None,
        "bidPrice": float(payload.get("8. Bid Price")) if payload.get("8. Bid Price") else None,
        "askPrice": float(payload.get("9. Ask Price")) if payload.get("9. Ask Price") else None,
        "lastRefreshed": payload.get("6. Last Refreshed"),
        "raw": payload or data,
    }


def main():
    api_key, pairs, sleep_seconds = parse_args(sys.argv[1:])

    results = []
    for idx, p in enumerate(pairs):
        frm, to = p[:3], p[3:]
        try:
            res = fetch_rate(frm, to, api_key)
            results.append(res)
            print(f"{res['pair']}: rate={res['exchangeRate']} bid={res['bidPrice']} ask={res['askPrice']} time={res['lastRefreshed']}")
        except Exception as e:
            print(f"{p}: ERROR {e}", file=sys.stderr)
        # Respect free tier: up to 5 requests/min, sleep between calls
        if idx < len(pairs) - 1 and sleep_seconds > 0:
            time.sleep(sleep_seconds)

    # Print JSON summary at the end to stdout as well
    print(json.dumps({"results": results, "fetchedAt": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, indent=2))


if __name__ == "__main__":
    main()
