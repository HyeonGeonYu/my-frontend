// api/kline.js  (CommonJS, Vercel Serverless Function)

module.exports.config = {
  runtime: "nodejs18.x",
  // ⚠️ Vercel 서버리스에 icn1(서울) 없음 → 가까운 리전 우선순위로
  regions: ["hnd1", "sin1", "iad1"], // 도쿄 / 싱가포르 / 버지니아
};

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const interval = q.interval || "1";     // "1" | "D"
    const limit = q.limit || "300";
    const symbol = q.symbol || "BTCUSDT";
    const category = q.category || "linear";

    const qs = new URLSearchParams({ category, symbol, interval, limit }).toString();
    const upstream = `https://api.bybit.com/v5/market/kline?${qs}`;

    // ▶︎ WAF 403 회피: 브라우저스러운 헤더 명시
    const r = await fetch(upstream, {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        // 일반 크롬 UA (임의 커스텀 UA 대신 실제 브라우저 UA가 통과율 좋음)
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
        // referer 넣으면 더 잘 통과되는 환경도 있음 (선택)
        // referer: "https://your-domain.vercel.app/",
      },
      cache: "no-store",
    });

    const ctype = r.headers.get("content-type") || "";
    const bodyText = await r.text();

    if (!r.ok || !ctype.includes("application/json")) {
      // 프런트에서 확인하기 쉽게 502와 함께 상세 반환
      return res.status(502).json({
        retCode: -1,
        retMsg: "Upstream not JSON",
        upstreamStatus: r.status,
        upstreamContentType: ctype,
        upstream,
        preview: bodyText.slice(0, 300),
      });
    }

    const json = JSON.parse(bodyText);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(json);
  } catch (e) {
    // 함수 자체 에러
    return res.status(500).json({ retCode: -1, retMsg: e?.message || "proxy error" });
  }
};
