// api/kline.js  (CommonJS)
module.exports.config = {
  regions: ["icn1", "hnd1", "sin1"], // vercel.json에도 있으므로 중복 OK
};

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const interval = q.interval || "1";
    const limit = q.limit || "300";
    const symbol = q.symbol || "BTCUSDT";
    const category = q.category || "linear";

    const qs = new URLSearchParams({ category, symbol, interval, limit }).toString();
    const upstream = `https://api.bybit.com/v5/market/kline?${qs}`;

    // 일부 환경에서 헤더 없으면 HTML/차단 응답 → 헤더 명시
    const r = await fetch(upstream, {
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "user-agent": "my-frontend-on-vercel/1.0",
      },
      cache: "no-store",
    });

    const bodyText = await r.text();

    // 항상 JSON으로 응답 (502 방지)
    try {
      const json = JSON.parse(bodyText);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(json);
    } catch (e) {
      return res.status(200).json({
        retCode: -1,
        retMsg: "Upstream not JSON",
        upstreamStatus: r.status,
        upstreamContentType: r.headers.get("content-type"),
        preview: bodyText.slice(0, 300),
        upstream,
      });
    }
  } catch (e) {
    // 함수 에러도 200 JSON으로(프론트에서 retCode로 처리)
    return res.status(200).json({ retCode: -1, retMsg: e?.message || "proxy error" });
  }
};
