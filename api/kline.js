export default async function handler(req, res) {
  try {
    const { interval = "1", limit = "300", symbol = "BTCUSDT", category = "linear" } = req.query;
    const qs = new URLSearchParams({ category, symbol, interval, limit });
    const upstream = `https://api.bybit.com/v5/market/kline?${qs.toString()}`;

    const r = await fetch(upstream, { headers: { accept: "application/json" } });
    const txt = await r.text();

    if (!r.headers.get("content-type")?.includes("application/json")) {
      return res.status(502).json({ retCode: -1, retMsg: "Upstream not JSON", preview: txt.slice(0, 200) });
    }

    const json = JSON.parse(txt);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ retCode: -1, retMsg: e?.message ?? "proxy error" });
  }
}
