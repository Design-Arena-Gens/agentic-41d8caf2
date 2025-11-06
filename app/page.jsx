"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
];

function normalizePairsString(pairsStr) {
  return pairsStr
    .split(",")
    .map((s) => s.trim().toUpperCase().replaceAll("/", ""))
    .filter(Boolean)
    .join(",");
}

export default function HomePage() {
  const [pairs, setPairs] = useState(DEFAULT_PAIRS.join(","));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const normalizedPairs = useMemo(() => normalizePairsString(pairs), [pairs]);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rates?pairs=${encodeURIComponent(normalizedPairs)}`, {
        cache: "no-cache",
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      setData(json.results || []);
      setLastUpdated(json.fetchedAt || new Date().toISOString());
    } catch (err) {
      setError(err.message || "Failed to fetch rates");
    } finally {
      setLoading(false);
    }
  }, [normalizedPairs]);

  useEffect(() => {
    fetchRates();
  }, []); // initial load

  return (
    <div className="container">
      <h1>Forex Scanner</h1>
      <p className="subtitle">Live exchange rates via Alpha Vantage</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input
            type="text"
            placeholder="Pairs (e.g. EURUSD, GBPUSD, USDJPY)"
            value={pairs}
            onChange={(e) => setPairs(e.target.value)}
          />
          <button onClick={fetchRates} disabled={loading}>
            {loading ? "Fetching..." : "Fetch Rates"}
          </button>
          <button
            className="secondary"
            disabled={loading}
            onClick={() => setPairs(DEFAULT_PAIRS.join(","))}
          >
            Reset Pairs
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <small className="muted">
            Tip: Separate pairs with commas. Slash is optional (e.g. EUR/USD).
          </small>
        </div>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="badge">Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "-"}</span>
          </div>
          <div>
            <button className="secondary" onClick={fetchRates} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Rate</th>
              <th>Bid</th>
              <th>Ask</th>
              <th>Source Time</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <small className="muted">No data yet</small>
                </td>
              </tr>
            )}
            {data.map((row) => (
              <tr key={row.pair}>
                <td>{row.pair}</td>
                <td>{row.exchangeRate ?? '-'}</td>
                <td>{row.bidPrice ?? '-'}</td>
                <td>{row.askPrice ?? '-'}</td>
                <td>{row.lastRefreshed ? new Date(row.lastRefreshed).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12 }}>
          <small className="muted">
            Note: Alpha Vantage free tier has rate limits (5 requests/min). Fetch fewer pairs or retry.
          </small>
        </div>
      </div>
    </div>
  );
}
