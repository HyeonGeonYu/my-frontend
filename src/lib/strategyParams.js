// src/lib/strategyParams.js
// 심볼별 전략 파라미터. 출처: tradingBot bots/trade_config.py (권위원본, 프로그램 대조).
//   3책 구조: S11 「1분봉책」 · S22 「4시간봉책」 · S33 「일봉책」.
//   이 표는 프론트 차트가 그리는 1분/일봉 밴드용 — s11/s12/s13(1분봉책)·s3/s4(일봉책=S33).
//   s11=z추세·s12=z역추세(1분) {k:K1,b,cd,w:MA창(분),wl:라벨} · s13=급락페이드 {m:트리거봉,drop,hold,retr?}
//   s3=일봉추세·s4=일봉역추세 {k,b,cd,w:MA창(일),wl} · 드레인(K≥90)·기각 셀은 제외.
//   h4 = S22 4시간봉책(2026-08-29 표기 추가 — 전 심볼 공백이었음): 하위키 동일 패밀리
//     s11/s12(z) {k,b,cd,w:봉수,wl:일수} · s13(페이드) {m:"시간",drop,hold,retr?} ·
//     s14(ewz) {s:ewz창,k,cd,hold,rev?} · s15(유동성스윕) {n:저점창봉수,hold,cd}.
//     4h 전용 차트가 없어 밴드는 안 그리고 표기만(일봉 차트에서 강조).
export const STRAT_PARAMS = {
// ── 크립토 (Bybit) ──
  BTCUSDT: {
    s11: { L: { k: 6, b: 0, cd: "3h", w: 1440, wl: "24h" } },
    s12: { L: { k: 5, b: -1, cd: "1h", w: 1320, wl: "22h" } },
    s13: { L: { m: 60, drop: 0.04, retr: 1.5, hold: "48h", cd: "0.5h" } },
    s3: { L: { k: 2.5, b: -2, cd: "2d", w: 90, wl: "90d" }, S: { k: 2.4, b: 0.2, cd: "1d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.1, b: 0.8, cd: "10d", w: 150, wl: "150d" } },
    h4: { s11: { L: { k: 3.25, b: -2.5, cd: "24h", w: 240, wl: "40d" } } },
  },
  ETHUSDT: {
    s11: { L: { k: 6, b: -3, cd: "3h", w: 720, wl: "12h" } },
    s13: { L: { m: 30, drop: 0.04, hold: "24h", cd: "0.5h" } },
    s3: { L: { k: 2.5, b: -3, cd: "1d", w: 60, wl: "60d" }, S: { k: 1.6, b: -0.8, cd: "5d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.9, b: -0.4, cd: "2d", w: 200, wl: "200d" }, S: { k: 2.6, b: 2.2, cd: "1d", w: 200, wl: "200d" } },
    h4: { s14: { L: { s: 200, k: 3, cd: "24h", hold: "15d" }, S: { s: 50, k: 2.5, cd: "24h", hold: "3d" } } },
  },
  SOLUSDT: {
    s11: { L: { k: 5.5, b: 2.5, cd: "3h", w: 1440, wl: "24h" } },
    s13: { L: { m: 15, drop: 0.05, hold: "24h", cd: "0.5h" } },
    s3: { L: { k: 2.9, b: -3, cd: "1d", w: 90, wl: "90d" }, S: { k: 1.7, b: 0.2, cd: "2d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.8, b: 0.4, cd: "1d", w: 200, wl: "200d" } },
    h4: {
      s12: { L: { k: 2.75, b: -1, cd: "24h", w: 240, wl: "40d" } },
      s14: { L: { s: 20, k: 3, cd: "24h", hold: "10d" } },
    },
  },
  XRPUSDT: {
    s11: { S: { k: 5, b: -0.5, cd: "1h", w: 720, wl: "12h" } },
    s13: { L: { m: 30, drop: 0.05, hold: "24h", cd: "0.5h" } },
    s3: { L: { k: 3.1, b: -3, cd: "1d", w: 90, wl: "90d" }, S: { k: 1.6, b: -1.4, cd: "5d", w: 90, wl: "90d" } },
    s4: { L: { k: 1.6, b: -1.4, cd: "2d", w: 200, wl: "200d" }, S: { k: 1.1, b: 0.2, cd: "7d", w: 200, wl: "200d" } },
    h4: {
      s11: { L: { k: 4, b: -3, cd: "12h", w: 240, wl: "40d" } },
      s12: { L: { k: 3, b: 1.5, cd: "12h", w: 240, wl: "40d" } },
      s13: { L: { m: "48h", drop: 0.15, retr: 1.5, hold: "10d", cd: "24h" } },
    },
  },
  XAUTUSDT: {
    s11: { L: { k: 4, b: -2.5, cd: "1h", w: 1440, wl: "24h" } },
    s12: { L: { k: 4.25, b: -3, cd: "3h", w: 1440, wl: "24h" } },
    // 2026-08-29: 24/7 토큰금 프록시(PAXG 6y+빗파 XAUT 6.6y) 재스윕 채택 셀
    h4: { s13: { L: { m: "24h", drop: 0.02, retr: 1.5, hold: "15d", cd: "24h" } } },
  },

  // ── MT5 지수·금속·유가·크립토CFD ──
  BTCUSD: {
    s11: { L: { k: 6, b: 0, cd: "3h", w: 1440, wl: "24h" } },
    s12: { L: { k: 5, b: -1, cd: "1h", w: 1320, wl: "22h" } },
    s13: { L: { m: 60, drop: 0.04, retr: 1.5, hold: "48h", cd: "0.5h" } },
    s3: { L: { k: 2.5, b: -2, cd: "2d", w: 90, wl: "90d" }, S: { k: 2.4, b: -0.2, cd: "1d", w: 90, wl: "90d" } },
    s4: { L: { k: 1, b: -3, cd: "5d", w: 200, wl: "200d" } },
  },
  ETHUSD: {
    s11: { L: { k: 6, b: -3, cd: "3h", w: 720, wl: "12h" } },
    s13: { L: { m: 30, drop: 0.04, hold: "24h", cd: "0.5h" } },
    s3: { L: { k: 2.8, b: -3, cd: "1d", w: 60, wl: "60d" }, S: { k: 2, b: 0, cd: "2d", w: 60, wl: "60d" } },
    s4: { L: { k: 1.9, b: -0.4, cd: "1d", w: 200, wl: "200d" } },
  },
  US100: {
    s11: { L: { k: 5.5, b: -3, cd: "3h", w: 1440, wl: "24h" } },
    s4: { L: { k: 2, b: -3, cd: "1d", w: 150, wl: "150d" } },
    h4: {
      s12: { L: { k: 3, b: 1, cd: "12h", w: 180, wl: "30d" } },
      s13: { L: { m: "120h", drop: 0.07, retr: 1.5, hold: "5d", cd: "24h" } },
    },
  },
  US500: {
    // 2026-08-27 신규 편입 3셀: 1분 역추롱 + 4h 역추롱·추세롱
    s12: { L: { k: 4.6, b: -3.8, cd: "1h", w: 4320, wl: "3d" } },
    h4: {
      s11: { L: { k: 2.6, b: 0.25, cd: "48h", w: 120, wl: "20d" } },
      s12: { L: { k: 3.5, b: 2, cd: "12h", w: 130, wl: "22d" } },
    },
  },
  JP225: {
    s11: { L: { k: 4, b: -1.5, cd: "3h", w: 1440, wl: "24h" } },
    s13: { L: { m: 240, drop: 0.03, hold: "48h", cd: "0.5h" } },
    s3: { L: { k: 2.7, b: 1.4, cd: "1d", w: 200, wl: "200d" } },
    s4: { L: { k: 2, b: -3, cd: "1d", w: 200, wl: "200d" } },
    h4: {
      s11: { L: { k: 3, b: 1, cd: "12h", w: 120, wl: "20d" } },
      s13: { L: { m: "72h", drop: 0.05, hold: "10d", cd: "24h" } },
      s15: { L: { n: 120, hold: "10d", cd: "24h" } },
    },
  },
  HK50: {
    s12: { L: { k: 3.5, b: 2, cd: "1h", w: 2880, wl: "48h" } },
    s13: { L: { m: 120, drop: 0.02, hold: "72h", cd: "0.5h" } },
    s4: { L: { k: 1.8, b: -3, cd: "3d", w: 200, wl: "200d" }, S: { k: 2.2, b: 2, cd: "1d", w: 150, wl: "150d" } },
    h4: {
      s11: { L: { k: 3, b: -2, cd: "12h", w: 180, wl: "30d" } },
      s12: { L: { k: 3, b: 1, cd: "12h", w: 180, wl: "30d" } },
    },
  },
  GER40: {
    s11: { L: { k: 3.75, b: -3, cd: "3h", w: 1440, wl: "24h" } },
    s4: { L: { k: 2.6, b: -3, cd: "1d", w: 90, wl: "90d" } },
  },
  UK100: {
    s11: { L: { k: 3.75, b: -3, cd: "3h", w: 1440, wl: "24h" } },
    s4: { L: { k: 1.7, b: -0.8, cd: "2d", w: 90, wl: "90d" }, S: { k: 2.3, b: 1, cd: "5d", w: 250, wl: "250d" } },
    h4: { s13: { L: { m: "48h", drop: 0.03, hold: "10d", cd: "24h" } } },
  },
  XAUUSD: {
    s3: { L: { k: 2.6, b: 0.2, cd: "3d", w: 150, wl: "150d" } },
    s4: { S: { k: 2.8, b: 1.2, cd: "1d", w: 200, wl: "200d" } },
    h4: { s13: { L: { m: "24h", drop: 0.03, hold: "10d", cd: "24h" } } },
  },
  XAGUSD: {
    s11: { L: { k: 4.75, b: -2.5, cd: "1h", w: 1320, wl: "22h" } },
    s3: { L: { k: 2.9, b: 1, cd: "5d", w: 250, wl: "250d" } },
    h4: { s14: { L: { s: 200, k: 2.5, rev: true, cd: "24h", hold: "5d" }, S: { s: 50, k: 3, cd: "24h", hold: "3d" } } },
  },
  WTI: {
    s11: { L: { k: 4.5, b: -2, cd: "3h", w: 720, wl: "12h" } },
    s3: { S: { k: 2.3, b: 2, cd: "1d", w: 90, wl: "90d" } },
    h4: { s13: { L: { m: "24h", drop: 0.07, hold: "10d", cd: "24h" } } },
  },

  // ── FX 메이저 ──
  EURUSD: {
    s4: { L: { k: 2.9, b: -0.6, cd: "1d", w: 120, wl: "120d" } },
  },
  GBPUSD: {
    s4: { L: { k: 2.4, b: 1.6, cd: "1d", w: 150, wl: "150d" }, S: { k: 2.1, b: 0.6, cd: "1d", w: 150, wl: "150d" } },
  },
  AUDUSD: {
    s4: { L: { k: 2.6, b: -3, cd: "3d", w: 200, wl: "200d" }, S: { k: 1.8, b: 0.2, cd: "3d", w: 90, wl: "90d" } },
    h4: { s12: { S: { k: 3, b: -2, cd: "12h", w: 30, wl: "5d" } } },
  },
  USDJPY: {
    s11: { L: { k: 4.5, b: -2.5, cd: "1h", w: 1440, wl: "24h" } },
    s13: { L: { m: 120, drop: 0.01, hold: "48h", cd: "0.5h" } },
    s3: { L: { k: 2.9, b: -1.4, cd: "5d", w: 120, wl: "120d" } },
    s4: { L: { k: 2.1, b: -3, cd: "1d", w: 150, wl: "150d" } },
    h4: { s12: { L: { k: 2.5, b: 1, cd: "12h", w: 120, wl: "20d" } } },
  },
  USDCHF: {
    s4: { L: { k: 2.3, b: -0.6, cd: "1d", w: 200, wl: "200d" } },
  },
  USDCAD: {
    s4: { L: { k: 2.3, b: 1.8, cd: "1d", w: 200, wl: "200d" } },
    h4: { s15: { L: { n: 120, hold: "10d", cd: "24h" } } },
  },
  NZDUSD: {
    s4: { L: { k: 2.9, b: -3, cd: "1d", w: 250, wl: "250d" }, S: { k: 1.4, b: -1.2, cd: "2d", w: 150, wl: "150d" } },
    h4: { s12: { S: { k: 3, b: -1, cd: "24h", w: 60, wl: "10d" } } },
  },
};

export const STRAT_META = {
  s11: { label: "S11 z추세·1m", color: "#ffb86c" },
  s12: { label: "S11 z역추세·1m", color: "#7ee787" },
  s13: { label: "S11 급락페이드·1m", color: "#c084fc" },
  s3: { label: "S33 추세·일", color: "#ffd166" },
  s4: { label: "S33 역추세·일", color: "#5dcaa5" },
};

// S22 4시간봉책 라벨 (h4 하위키용)
export const H4_META = {
  s11: { label: "S22 z추세·4h" },
  s12: { label: "S22 z역추세·4h" },
  s13: { label: "S22 급락페이드·4h" },
  s14: { label: "S22 ewz추세·4h" },
  s15: { label: "S22 유동성스윕·4h" },
};

// h4 셀 파라미터 표기 (z계열은 fmtParam 재사용, 나머지는 여기서)
export function fmtH4(key, d) {
  if (key === "s13") {
    const retr = d.retr ? ` ·되돌림×${d.retr}` : "";
    return `${d.m} −${(Number(d.drop) * 100).toFixed(0)}%↘ 롱 · 보유≤${d.hold}${retr}`;
  }
  if (key === "s14") {
    return `ewz s${d.s}·K${d.k}${d.rev ? "(rev)" : ""}/${d.cd} · 보유≤${d.hold}`;
  }
  if (key === "s15") {
    return `저점 ${d.n}봉 이탈→복귀/${d.cd} · 보유≤${d.hold}`;
  }
  return fmtParam(d) + (d.hold ? ` · 보유≤${d.hold}` : "");
}

// 최대보유기간 — v4: s11/s12=14일 · s13=셀별(hold에 표기) · 일봉(S3/S4)=15일.
export function maxHoldFor(symbol, stratKey) {
  if (stratKey === "s11" || stratKey === "s12") return "14d";
  if (stratKey === "s3" || stratKey === "s4") return "15d";
  return null; // s13은 방향 데이터의 hold를 표시
}

// ⚠️ 스펙 결과는 심볼별로 캐시해 항상 같은 객체 참조를 반환 — 렌더마다 새 객체를 만들면
//    effect 의존성이 매번 바뀌어 무한 refetch 루프(ERR_INSUFFICIENT_RESOURCES)가 남.
const _minuteSpecCache = new Map();
const _dailySpecCache = new Map();

// 1분봉 밴드 스펙 — 방향별 {k, w(분)}. 슬롯: s11→실선(s1슬롯), s12→점선(s2슬롯). s13은 밴드 없음.
export function minuteBandSpec(symbol) {
  const sym = String(symbol || "").toUpperCase();
  if (_minuteSpecCache.has(sym)) return _minuteSpecCache.get(sym);
  const p = STRAT_PARAMS[sym];
  let result;
  if (p) {
    const out = {};
    const put = (slot, d) => {
      if (d && Number.isFinite(Number(d.k)) && Number.isFinite(Number(d.w))) out[slot] = { k: Number(d.k), w: Number(d.w) };
    };
    put("s1Long", p.s11?.L);
    put("s1Short", p.s11?.S);
    put("s2Long", p.s12?.L);
    put("s2Short", p.s12?.S);
    // 급락페이드 트리거선: 시점별 트리거가 = M분 전 종가 × (1 − drop). 밴드와 별도 특수 슬롯.
    if (p.s13?.L && Number.isFinite(Number(p.s13.L.m)) && Number.isFinite(Number(p.s13.L.drop))) {
      out.fade = { m: Number(p.s13.L.m), drop: Number(p.s13.L.drop) };
    }
    result = Object.keys(out).length ? out : undefined;
  }
  _minuteSpecCache.set(sym, result);
  return result;
}

// 일봉 밴드 스펙 — 방향별 {k, w(일)}. 슬롯: s3→실선, s4→점선.
export function dailyBandSpec(symbol) {
  const sym = String(symbol || "").toUpperCase();
  if (_dailySpecCache.has(sym)) return _dailySpecCache.get(sym);
  const p = STRAT_PARAMS[sym];
  let result;
  if (p) {
    const out = {};
    const put = (slot, d) => {
      if (d && Number.isFinite(Number(d.k))) out[slot] = { k: Number(d.k), w: Number(d.w) || 90 };
    };
    put("s1Long", p.s3?.L);
    put("s1Short", p.s3?.S);
    put("s2Long", p.s4?.L);
    put("s2Short", p.s4?.S);
    result = Object.keys(out).length ? out : undefined;
  }
  _dailySpecCache.set(sym, result);
  return result;
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
