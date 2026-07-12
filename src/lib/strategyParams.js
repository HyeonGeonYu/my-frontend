// src/lib/strategyParams.js
// 심볼별 전략 파라미터. 출처: tradingBot bots/trade_config.py (권위원본)
//   (HANDOFF_MASTER v4 §2-A′, 2026-07-12 — S11 「1분봉책」 도입, 구 S1/S2 드레인·폐기. 커밋 29bdfbd)
//
//   s11 = z추세(1분봉책)   : S11_TREND ∪ S11M_TREND  (z≥+K1 롱 / z≤−K1 숏) · 창 심볼별 6~24시간(분)
//   s12 = z역추세(1분봉책) : S11_REV                  (z≤−K1 롱)            · 창 22~24시간(분)
//   s13 = 급락페이드       : S11_FADE ∪ S11M_FADE     (M분 수익률≤−X% → 롱) · 밴드 없음(수익률 트리거)
//   s3  = 추세(일봉)       : FXD_TREND ∪ CRYPTOD_TREND ∪ MT5D_TREND
//   s4  = 역추세(일봉)     : FXD_REV   ∪ CRYPTOD_REV   ∪ MT5D_REV
//
//   z계열 방향 = {k:K1, b, cd:쿨다운, w:MA창 수치(s11/s12=분, s3/s4=일), wl:MA창 표시라벨}.
//   s13 방향  = {m:트리거 분, drop:하락률, hold:보유 표시, retr?:되돌림 익절 배수}.
//   구 S1/S2는 드레인 중(신규진입 없음) → 표기 제외.
export const STRAT_PARAMS = {
  // ── 크립토 (Bybit, ns=s11) ──
  BTCUSDT: {
    s11: { L: { k: 6.0, b: 0.0, cd: "3h", w: 1440, wl: "24h" } },
    s12: { L: { k: 5.0, b: -1.0, cd: "1h", w: 1320, wl: "22h" } },
    s13: { L: { m: 60, drop: 0.04, retr: 1.5, hold: "48h", cd: "0.5h" } },
    s3: { L: { k: 2.5, b: -2.0, cd: "2d", w: 90, wl: "90d" }, S: { k: 2.4, b: 0.2, cd: "1d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.1, b: 0.8, cd: "10d", w: 150, wl: "150d" } },
  },
  ETHUSDT: {
    s11: { L: { k: 6.0, b: -3.0, cd: "3h", w: 720, wl: "12h" } },
    s13: { L: { m: 30, drop: 0.04, hold: "24h", cd: "0.5h" } },
    s3: { L: { k: 2.5, b: -3.0, cd: "1d", w: 60, wl: "60d" }, S: { k: 1.6, b: -0.8, cd: "5d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.9, b: -0.4, cd: "2d", w: 200, wl: "200d" }, S: { k: 2.6, b: 2.2, cd: "1d", w: 200, wl: "200d" } },
  },
  SOLUSDT: {
    s11: { L: { k: 5.5, b: 2.5, cd: "3h", w: 1440, wl: "24h" } },
    s13: { L: { m: 15, drop: 0.05, hold: "24h", cd: "0.5h" } },
    s3: { L: { k: 2.9, b: -3.0, cd: "1d", w: 90, wl: "90d" }, S: { k: 1.7, b: 0.2, cd: "2d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.8, b: 0.4, cd: "1d", w: 200, wl: "200d" } },
  },
  XRPUSDT: {
    s11: { S: { k: 5.0, b: -0.5, cd: "1h", w: 720, wl: "12h" } },
    s13: { L: { m: 30, drop: 0.05, hold: "24h", cd: "0.5h" } },
    s3: { L: { k: 3.1, b: -3.0, cd: "1d", w: 90, wl: "90d" }, S: { k: 1.6, b: -1.4, cd: "5d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.6, b: -1.4, cd: "2d", w: 200, wl: "200d" }, S: { k: 1.1, b: 0.2, cd: "7d", w: 200, wl: "200d" } },
  },
  XAUTUSDT: {
    s11: { L: { k: 4.0, b: -2.5, cd: "1h", w: 1440, wl: "24h" } },
    s12: { L: { k: 4.25, b: -3.0, cd: "3h", w: 1440, wl: "24h" } },
  },

  // ── MT5 지수·금속·유가·크립토CFD (1분봉책 ns=s11m) ──
  BTCUSD: {
    s3: { L: { k: 2.5, b: -2.0, cd: "2d", w: 90, wl: "90d" }, S: { k: 2.4, b: -0.2, cd: "1d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.0, b: -3.0, cd: "5d", w: 200, wl: "200d" } },
  },
  ETHUSD: {
    s3: { L: { k: 2.8, b: -3.0, cd: "1d", w: 60, wl: "60d" }, S: { k: 2.0, b: 0.0, cd: "2d", w: 60, wl: "60d" } },
    s4: { L: { k: 1.9, b: -0.4, cd: "1d", w: 200, wl: "200d" } },
  },
  US100: {
    s11: { L: { k: 5.25, b: -2.5, cd: "1h", w: 720, wl: "12h" } },
    s3: { L: { k: 1.2, b: -1.8, cd: "10d", w: 90, wl: "90d" } },
    s4: { L: { k: 2.0, b: -3.0, cd: "1d", w: 150, wl: "150d" } },
  },
  JP225: {
    s11: { L: { k: 4.0, b: -1.5, cd: "3h", w: 1440, wl: "24h" } },
    s13: { L: { m: 240, drop: 0.03, hold: "48h", cd: "0.5h" } },
    s3: { L: { k: 2.7, b: 1.4, cd: "1d", w: 200, wl: "200d" } },
    s4: { L: { k: 2.0, b: -3.0, cd: "1d", w: 200, wl: "200d" } },
  },
  HK50: {
    s11: { L: { k: 5.75, b: -3.0, cd: "1h", w: 360, wl: "6h" } },
    s13: { L: { m: 120, drop: 0.02, hold: "72h", cd: "0.5h" } },
    s4: { L: { k: 1.8, b: -3.0, cd: "3d", w: 200, wl: "200d" }, S: { k: 2.2, b: 2.0, cd: "1d", w: 150, wl: "150d" } },
  },
  GER40: {
    s11: { L: { k: 3.75, b: -3.0, cd: "3h", w: 1440, wl: "24h" } },
    s4: { L: { k: 2.2, b: -3.0, cd: "1d", w: 200, wl: "200d" } },
  },
  UK100: {
    s11: { L: { k: 3.75, b: -3.0, cd: "3h", w: 1440, wl: "24h" } },
    s4: { L: { k: 1.7, b: -0.8, cd: "2d", w: 90, wl: "90d" }, S: { k: 2.3, b: 1.0, cd: "1d", w: 200, wl: "200d" } },
  },
  XAUUSD: {
    s3: { L: { k: 2.2, b: -1.4, cd: "3d", w: 90, wl: "90d" } },
    s4: { L: { k: 2.1, b: -2.2, cd: "1d", w: 90, wl: "90d" }, S: { k: 2.8, b: 1.2, cd: "1d", w: 200, wl: "200d" } },
  },
  XAGUSD: {
    s11: { L: { k: 4.75, b: -2.5, cd: "1h", w: 1320, wl: "22h" } },
    s3: { L: { k: 2.5, b: 0.8, cd: "1d", w: 200, wl: "200d" } },
    s4: { L: { k: 2.0, b: -1.0, cd: "1d", w: 90, wl: "90d" } },
  },
  WTI: {
    s11: { L: { k: 4.5, b: -2.0, cd: "3h", w: 720, wl: "12h" } },
    s3: { L: { k: 1.5, b: -3.0, cd: "7d", w: 90, wl: "90d" }, S: { k: 2.3, b: 2.0, cd: "1d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.4, b: 0.8, cd: "5d", w: 200, wl: "200d" } },
  },

  // ── FX 메이저 ──
  EURUSD: {
    s4: { L: { k: 2.2, b: -0.6, cd: "1d", w: 200, wl: "200d" } },
  },
  GBPUSD: {
    s4: { L: { k: 2.4, b: 1.6, cd: "1d", w: 150, wl: "150d" }, S: { k: 2.1, b: 0.6, cd: "1d", w: 150, wl: "150d" } },
  },
  AUDUSD: {
    s4: { L: { k: 2.3, b: -2.2, cd: "1d", w: 90, wl: "90d" }, S: { k: 1.8, b: 0.2, cd: "3d", w: 90, wl: "90d" } },
  },
  USDJPY: {
    s11: { L: { k: 4.5, b: -2.5, cd: "1h", w: 1440, wl: "24h" } },
    s13: { L: { m: 120, drop: 0.01, hold: "48h", cd: "0.5h" } },
    s3: { L: { k: 2.6, b: -1.0, cd: "1d", w: 120, wl: "120d" } },
    s4: { L: { k: 2.1, b: -3.0, cd: "1d", w: 150, wl: "150d" } },
  },
  USDCHF: {
    s4: { L: { k: 2.3, b: -0.6, cd: "1d", w: 200, wl: "200d" }, S: { k: 1.5, b: -0.2, cd: "3d", w: 200, wl: "200d" } },
  },
  USDCAD: {
    s4: { L: { k: 1.9, b: 1.2, cd: "1d", w: 150, wl: "150d" }, S: { k: 2.4, b: 0.6, cd: "1d", w: 200, wl: "200d" } },
  },
  NZDUSD: {
    s4: { L: { k: 2.2, b: -3.0, cd: "1d", w: 200, wl: "200d" }, S: { k: 1.4, b: -1.2, cd: "2d", w: 150, wl: "150d" } },
  },
};

export const STRAT_META = {
  s11: { label: "S11 z추세·1m", color: "#ffb86c" },
  s12: { label: "S11 z역추세·1m", color: "#7ee787" },
  s13: { label: "S11 급락페이드·1m", color: "#c084fc" },
  s3: { label: "S3 추세·일", color: "#ffd166" },
  s4: { label: "S4 역추세·일", color: "#5dcaa5" },
};

// 최대보유기간 — v4: s11/s12=14일 · s13=셀별(hold에 표기) · 일봉(S3/S4)=15일.
export function maxHoldFor(symbol, stratKey) {
  if (stratKey === "s11" || stratKey === "s12") return "14d";
  if (stratKey === "s3" || stratKey === "s4") return "15d";
  return null; // s13은 방향 데이터의 hold를 표시
}

// 1분봉 밴드 스펙 — 방향별 {k, w(분)}. 슬롯: s11→실선(s1슬롯), s12→점선(s2슬롯). s13은 밴드 없음.
export function minuteBandSpec(symbol) {
  const p = STRAT_PARAMS[String(symbol || "").toUpperCase()];
  if (!p) return undefined;
  const out = {};
  const put = (slot, d) => {
    if (d && Number.isFinite(Number(d.k)) && Number.isFinite(Number(d.w))) out[slot] = { k: Number(d.k), w: Number(d.w) };
  };
  put("s1Long", p.s11?.L);
  put("s1Short", p.s11?.S);
  put("s2Long", p.s12?.L);
  put("s2Short", p.s12?.S);
  return Object.keys(out).length ? out : undefined;
}

// 일봉 밴드 스펙 — 방향별 {k, w(일)}. 슬롯: s3→실선, s4→점선.
export function dailyBandSpec(symbol) {
  const p = STRAT_PARAMS[String(symbol || "").toUpperCase()];
  if (!p) return undefined;
  const out = {};
  const put = (slot, d) => {
    if (d && Number.isFinite(Number(d.k))) out[slot] = { k: Number(d.k), w: Number(d.w) || 90 };
  };
  put("s1Long", p.s3?.L);
  put("s1Short", p.s3?.S);
  put("s2Long", p.s4?.L);
  put("s2Short", p.s4?.S);
  return Object.keys(out).length ? out : undefined;
}

// z계열 파라미터 표시: K1/B/쿨다운·MA창
export function fmtParam(d) {
  const b = Number(d.b);
  const bStr = b < 0 ? `−${Math.abs(b)}` : `${b}`;
  return `${d.k}/${bStr}/${d.cd}` + (d.wl ? `·MA${d.wl}` : "");
}

// s13(급락페이드) 표시: "60분 −4% → 롱 · 보유≤48h (·되돌림×1.5)"
export function fmtFade(d) {
  const dropPct = `${(Number(d.drop) * 100).toFixed(0)}%`;
  const retr = d.retr ? ` ·되돌림×${d.retr}` : "";
  return `${d.m}분 −${dropPct}↘ 롱 · 보유≤${d.hold}${retr}`;
}
