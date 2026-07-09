// src/lib/strategyParams.js
// 심볼별 전략 파라미터 (K1 / B / 쿨다운 / MA창). 출처: tradingBot bots/trade_config.py
//   (HANDOFF_MASTER v2, 2026-07-09 — 일봉 S3/S4 MA창 심볼×방향별 재배정, 커밋 c5e05b5)
//   s1 = 추세(1분봉)   : TREND_BYBIT ∪ TREND_MT5      (z≥+K1 롱 / z≤−K1 숏) · win 고정 10080(7일)
//   s2 = 역추세(1분봉) : REV_BYBIT  ∪ REV_MT5         (z≤−K1 롱 / z≥+K1 숏) · win 고정 10080(7일)
//   s3 = 추세(일봉)    : FXD_TREND ∪ CRYPTOD_TREND ∪ MT5D_TREND
//   s4 = 역추세(일봉)  : FXD_REV   ∪ CRYPTOD_REV   ∪ MT5D_REV
//   각 방향 = {k:K1, b, cd:쿨다운, w:MA창(일봉만, 일수 60~200)}.
//   전략 없는 심볼/방향은 키 자체를 넣지 않음(차트에 표기 안 함).
export const STRAT_PARAMS = {
  // ── 크립토 (Bybit) ──
  BTCUSDT: {
    s1: { L: { k: 3.2, b: -2.0, cd: "3h" } },
    s2: { L: { k: 3.3, b: -2.0, cd: "3h" }, S: { k: 4.6, b: -0.4, cd: "0.5h" } },
    s3: { L: { k: 2.5, b: -2.0, cd: "2d", w: 90 }, S: { k: 2.4, b: 0.2, cd: "1d", w: 90 } },
    s4: { L: { k: 1.1, b: 0.8, cd: "10d", w: 150 } },
  },
  ETHUSDT: {
    s1: { L: { k: 2.35, b: 1.2, cd: "2.5h" }, S: { k: 3.45, b: -1.8, cd: "3h" } },
    s2: { L: { k: 3.15, b: -1.2, cd: "2h" }, S: { k: 3.3, b: -1.2, cd: "3h" } },
    s3: { L: { k: 2.5, b: -3.0, cd: "1d", w: 60 }, S: { k: 1.6, b: -0.8, cd: "5d", w: 90 } },
    s4: { L: { k: 1.9, b: -0.4, cd: "2d", w: 200 }, S: { k: 2.6, b: 2.2, cd: "1d", w: 200 } },
  },
  SOLUSDT: {
    s1: { L: { k: 3.4, b: -2.0, cd: "3h" }, S: { k: 3.4, b: -2.0, cd: "1.5h" } },
    s2: { L: { k: 3.3, b: 1.8, cd: "3h" } },
    s3: { L: { k: 2.9, b: -3.0, cd: "1d", w: 90 }, S: { k: 1.7, b: 0.2, cd: "2d", w: 90 } },
    s4: { L: { k: 1.8, b: 0.4, cd: "1d", w: 200 } },
  },
  XRPUSDT: {
    s1: { L: { k: 2.55, b: -0.4, cd: "3h" } },
    s2: { L: { k: 3.5, b: -0.4, cd: "2.25h" }, S: { k: 5.0, b: -2.0, cd: "0.5h" } },
    s3: { L: { k: 3.1, b: -3.0, cd: "1d", w: 90 }, S: { k: 1.6, b: -1.4, cd: "5d", w: 90 } },
    s4: { L: { k: 1.6, b: -1.4, cd: "2d", w: 200 }, S: { k: 1.1, b: 0.2, cd: "7d", w: 200 } },
  },
  XAUTUSDT: {
    s1: { L: { k: 3.25, b: -2.0, cd: "2h" }, S: { k: 3.5, b: 0.8, cd: "0.75h" } },
    s2: { L: { k: 2.75, b: -1.8, cd: "3h" } },
  },

  // ── MT5 지수·금속·유가·크립토CFD ──
  BTCUSD: {
    s1: { L: { k: 3.25, b: -2.0, cd: "2.75h" } },
    s2: { L: { k: 3.5, b: -2.0, cd: "2.25h" } },
    s3: { L: { k: 2.5, b: -2.0, cd: "2d", w: 90 }, S: { k: 2.4, b: -0.2, cd: "1d", w: 90 } },
    s4: { L: { k: 1.0, b: -3.0, cd: "5d", w: 200 } },
  },
  ETHUSD: {
    s1: { L: { k: 3.5, b: 1.6, cd: "1.75h" } },
    s3: { L: { k: 2.8, b: -3.0, cd: "1d", w: 60 }, S: { k: 2.0, b: 0.0, cd: "2d", w: 60 } },
    s4: { L: { k: 1.9, b: -0.4, cd: "1d", w: 200 } },
  },
  US100: {
    s1: { L: { k: 2.8, b: -1.8, cd: "2.75h" } },
    s2: { L: { k: 3.25, b: -0.8, cd: "1.5h" } },
    s3: { L: { k: 1.2, b: -1.8, cd: "10d", w: 90 } },
    s4: { L: { k: 2.0, b: -3.0, cd: "1d", w: 150 } },
  },
  JP225: {
    s1: { L: { k: 3.35, b: -2.0, cd: "2h" }, S: { k: 3.25, b: 0.8, cd: "1.25h" } },
    s2: { L: { k: 2.7, b: -2.0, cd: "3h" }, S: { k: 3.8, b: 1.0, cd: "0.75h" } },
    s3: { L: { k: 2.7, b: 1.4, cd: "1d", w: 200 } },
    s4: { L: { k: 2.0, b: -3.0, cd: "1d", w: 200 } },
  },
  HK50: {
    s1: { L: { k: 2.05, b: 0.6, cd: "3h" } },
    s2: { L: { k: 2.6, b: -2.0, cd: "2h" }, S: { k: 3.0, b: 1.6, cd: "1h" } },
    s4: { L: { k: 1.8, b: -3.0, cd: "3d", w: 200 }, S: { k: 2.2, b: 2.0, cd: "1d", w: 150 } },
  },
  GER40: {
    s1: { L: { k: 2.75, b: -1.8, cd: "3h" } },
    s2: { L: { k: 3.5, b: -2.0, cd: "1.25h" } },
    s4: { L: { k: 2.2, b: -3.0, cd: "1d", w: 200 } },
  },
  UK100: {
    s1: { L: { k: 3.25, b: -1.2, cd: "1.75h" }, S: { k: 3.5, b: 0.8, cd: "1h" } },
    s2: { L: { k: 3.35, b: -2.0, cd: "1.5h" }, S: { k: 3.8, b: 1.8, cd: "0.5h" } },
    s4: { L: { k: 1.7, b: -0.8, cd: "2d", w: 90 }, S: { k: 2.3, b: 1.0, cd: "1d", w: 200 } },
  },
  XAUUSD: {
    s1: { L: { k: 3.45, b: -1.8, cd: "1.25h" }, S: { k: 3.2, b: 0.2, cd: "1h" } },
    s2: { L: { k: 2.35, b: -1.8, cd: "3h" } },
    s3: { L: { k: 2.2, b: -1.4, cd: "3d", w: 90 } },
    s4: { L: { k: 2.1, b: -2.2, cd: "1d", w: 90 }, S: { k: 2.8, b: 1.2, cd: "1d", w: 200 } },
  },
  XAGUSD: {
    s1: { L: { k: 2.75, b: -1.2, cd: "3h" }, S: { k: 2.65, b: 1.2, cd: "2h" } },
    s2: { L: { k: 2.85, b: -1.8, cd: "3h" }, S: { k: 3.8, b: -2.0, cd: "1h" } },
    s3: { L: { k: 2.5, b: 0.8, cd: "1d", w: 200 } },
    s4: { L: { k: 2.0, b: -1.0, cd: "1d", w: 90 } },
  },
  WTI: {
    s1: { L: { k: 2.9, b: -1.4, cd: "2.5h" }, S: { k: 3.2, b: 1.8, cd: "1h" } },
    s2: { L: { k: 2.9, b: -2.0, cd: "3h" }, S: { k: 3.4, b: 0.6, cd: "1h" } },
    s3: { L: { k: 1.5, b: -3.0, cd: "7d", w: 90 }, S: { k: 2.3, b: 2.0, cd: "1d", w: 90 } },
    s4: { L: { k: 1.4, b: 0.8, cd: "5d", w: 200 } },
  },

  // ── FX 메이저 (1분=S1/S2, 일봉=S3/S4) ──
  EURUSD: {
    s1: { L: { k: 3.8, b: -1.0, cd: "1h" } },
    s2: { L: { k: 3.7, b: -0.6, cd: "0.75h" } },
    s4: { L: { k: 2.2, b: -0.6, cd: "1d", w: 200 } },
  },
  GBPUSD: {
    s1: { L: { k: 3.4, b: 0.4, cd: "1h" } },
    s2: { L: { k: 3.5, b: -0.4, cd: "1h" } },
    s4: { L: { k: 2.4, b: 1.6, cd: "1d", w: 150 }, S: { k: 2.1, b: 0.6, cd: "1d", w: 150 } },
  },
  AUDUSD: {
    s1: { L: { k: 3.7, b: 2.0, cd: "0.5h" } },
    s2: { L: { k: 3.5, b: -2.0, cd: "1.25h" }, S: { k: 2.8, b: -2.0, cd: "2.25h" } },
    s4: { L: { k: 2.3, b: -2.2, cd: "1d", w: 90 }, S: { k: 1.8, b: 0.2, cd: "3d", w: 90 } },
  },
  USDJPY: {
    s1: { S: { k: 3.0, b: -1.4, cd: "1.5h" } },
    s2: { S: { k: 3.3, b: -0.6, cd: "1.75h" } },
    s3: { L: { k: 2.6, b: -1.0, cd: "1d", w: 120 } },
    s4: { L: { k: 2.1, b: -3.0, cd: "1d", w: 150 } },
  },
  USDCHF: {
    s1: { S: { k: 4.1, b: -2.0, cd: "0.75h" } },
    s2: { S: { k: 3.7, b: -1.6, cd: "0.75h" } },
    s4: { L: { k: 2.3, b: -0.6, cd: "1d", w: 200 }, S: { k: 1.5, b: -0.2, cd: "3d", w: 200 } },
  },
  USDCAD: {
    s2: { S: { k: 3.6, b: -2.0, cd: "0.75h" } },
    s4: { L: { k: 1.9, b: 1.2, cd: "1d", w: 150 }, S: { k: 2.4, b: 0.6, cd: "1d", w: 200 } },
  },
  NZDUSD: {
    s2: { L: { k: 3.6, b: -2.0, cd: "1h" }, S: { k: 3.1, b: -1.0, cd: "2.25h" } },
    s4: { L: { k: 2.2, b: -3.0, cd: "1d", w: 200 }, S: { k: 1.4, b: -1.2, cd: "2d", w: 150 } },
  },
};

export const STRAT_META = {
  s1: { label: "S1 추세·1m", color: "#ffb86c" },
  s2: { label: "S2 역추세·1m", color: "#7ee787" },
  s3: { label: "S3 추세·일", color: "#ffd166" },
  s4: { label: "S4 역추세·일", color: "#5dcaa5" },
};

// 최대보유기간 (s1_max_hold_sec) — v2: 1분(S1/S2)=14일 · 일봉(S3/S4)=15일 전 채널 공통.
export function maxHoldFor(symbol, stratKey) {
  if (stratKey === "s1" || stratKey === "s2") return "14d";
  if (stratKey === "s3" || stratKey === "s4") return "15d";
  return null;
}

// 차트 진입밴드용 K1 세트 — STRAT_PARAMS 단일 소스에서 파생(별도 하드코딩 맵 금지).
//   ChartView k1set 형식 {s1Long,s1Short,s2Long,s2Short}: 색=방향(롱/숏), 선=전략(실선/점선).
//   1분봉 전용(win 공통 10080). 일봉은 방향별 win이 달라 dailyBandSpec 사용.
export function k1setFor(symbol, timeframe = "1m") {
  const p = STRAT_PARAMS[String(symbol || "").toUpperCase()];
  if (!p) return undefined;
  const trend = timeframe === "1D" ? p.s3 : p.s1;
  const rev = timeframe === "1D" ? p.s4 : p.s2;
  const set = {};
  if (trend?.L) set.s1Long = trend.L.k;
  if (trend?.S) set.s1Short = trend.S.k;
  if (rev?.L) set.s2Long = rev.L.k;
  if (rev?.S) set.s2Short = rev.S.k;
  return Object.keys(set).length ? set : undefined;
}

// 일봉 밴드 스펙 — 방향별 {k, w(MA창 일수)}. 슬롯명은 ChartView 밴드 시리즈와 동일
//   (s3→s1 슬롯=실선, s4→s2 슬롯=점선; Long=파랑, Short=주황).
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

// 부호 표시(− 사용) + 칸 텍스트 (일봉은 MA창 병기)
export function fmtParam(d) {
  const b = Number(d.b);
  const bStr = b < 0 ? `−${Math.abs(b)}` : `${b}`;
  return `${d.k}/${bStr}/${d.cd}` + (d.w ? `·MA${d.w}` : "");
}
