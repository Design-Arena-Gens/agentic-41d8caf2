import { NextResponse } from 'next/server';

const AV_ENDPOINT = 'https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE';

function parsePair(raw) {
  const s = raw.trim().toUpperCase().replaceAll('/', '');
  if (s.length !== 6) return null;
  return { from: s.slice(0, 3), to: s.slice(3) };
}

async function fetchPair(from, to, apiKey) {
  const url = `${AV_ENDPOINT}&from_currency=${encodeURIComponent(from)}&to_currency=${encodeURIComponent(to)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Alpha Vantage error ${res.status}`);
  const json = await res.json();
  const payload = json["Realtime Currency Exchange Rate"] || {};
  return {
    pair: `${from}${to}`,
    from,
    to,
    exchangeRate: payload["5. Exchange Rate"] ? Number(payload["5. Exchange Rate"]) : null,
    bidPrice: payload["8. Bid Price"] ? Number(payload["8. Bid Price"]) : null,
    askPrice: payload["9. Ask Price"] ? Number(payload["9. Ask Price"]) : null,
    lastRefreshed: payload["6. Last Refreshed"] || null,
    information: json["Information"] || null,
    note: json["Note"] || null,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pairsParam = (searchParams.get('pairs') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (pairsParam.length === 0) {
      return NextResponse.json({ error: 'Missing pairs query parameter' }, { status: 400 });
    }

    const apiKey = searchParams.get('apiKey') || process.env.ALPHAVANTAGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Server missing ALPHAVANTAGE_API_KEY. Provide ?apiKey=...' }, { status: 400 });
    }

    const parsed = pairsParam.map(parsePair).filter(Boolean);
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No valid pairs provided' }, { status: 400 });
    }

    // Respect free-tier limits: do sequential fetches to avoid hitting burst limits.
    const results = [];
    for (const { from, to } of parsed) {
      try {
        const r = await fetchPair(from, to, apiKey);
        results.push(r);
      } catch (err) {
        results.push({ pair: `${from}${to}`, error: err.message });
      }
    }

    return NextResponse.json({
      results,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}
