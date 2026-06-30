// src/lib/strategyParams.js
// 심볼별 전략 파라미터 (K1 / B / 쿨다운). 출처: tradingBot trade_config.py
//   s1 = 추세(1분봉, TREND_*) · s2 = 역추세(1분봉, REV_*)
//   s3 = 추세(일봉, FXD_TREND) · s4 = 역추세(일봉, FXD_REV)
//   각 방향 = {k:K1, b, cd:쿨다운(표시문자열)}.
export const STRAT_PARAMS = {
  // ── 크립토 (1분봉) ──
  BTCUSDT: { s1: { L: { k: 3.2, b: -2.0, cd: "3h" } }, s2: { L: { k: 3.3, b: -2.0, cd: "3h" }, S: { k: 4.6, b: -0.4, cd: "0.5h" } } },
  ETHUSDT: { s1: { L: { k: 2.35, b: 1.2, cd: "2.5h" }, S: { k: 3.45, b: -1.8, cd: "3h" } }, s2: { L: { k: 3.15, b: -1.2, cd: "2h" }, S: { k: 3.3, b: -1.2, cd: "3h" } } },
  SOLUSDT: { s1: { L: { k: 3.4, b: -2.0, cd: "3h" }, S: { k: 3.4, b: -2.0, cd: "1.5h" } }, s2: { L: { k: 3.3, b: 1.8, cd: "3h" } } },
  XRPUSDT: { s1: { L: { k: 2.55, b: -0.4, cd: "3h" } }, s2: { L: { k: 3.5, b: -0.4, cd: "2.25h" }, S: { k: 5.0, b: -2.0, cd: "0.5h" } } },

  // ── 지수·금속·유가 (1분봉) ──
  US100: { s1: { L: { k: 2.8, b: -1.8, cd: "2.75h" } }, s2: { L: { k: 3.25, b: -0.8, cd: "1.5h" } } },
  JP225: { s1: { L: { k: 3.35, b: -2.0, cd: "2h" }, S: { k: 3.25, b: 0.8, cd: "1.25h" } }, s2: { L: { k: 2.7, b: -2.0, cd: "3h" }, S: { k: 3.8, b: 1.0, cd: "0.75h" } } },
  HK50: { s1: { L: { k: 2.05, b: 0.6, cd: "3h" } }, s2: { L: { k: 2.6, b: -2.0, cd: "2h" }, S: { k: 3.0, b: 1.6, cd: "1h" } } },
  GER40: { s1: { L: { k: 2.75, b: -1.8, cd: "3h" } }, s2: { L: { k: 3.5, b: -2.0, cd: "1.25h" } } },
  UK100: { s1: { L: { k: 3.25, b: -1.2, cd: "1.75h" }, S: { k: 3.5, b: 0.8, cd: "1h" } }, s2: { L: { k: 3.35, b: -2.0, cd: "1.5h" }, S: { k: 3.8, b: 1.8, cd: "0.5h" } } },
  XAUUSD: { s1: { L: { k: 3.45, b: -1.8, cd: "1.25h" }, S: { k: 3.2, b: 0.2, cd: "1h" } }, s2: { L: { k: 2.35, b: -1.8, cd: "3h" } } },
  XAGUSD: { s1: { L: { k: 2.75, b: -1.2, cd: "3h" }, S: { k: 2.65, b: 1.2, cd: "2h" } }, s2: { L: { k: 2.85, b: -1.8, cd: "3h" }, S: { k: 3.8, b: -2.0, cd: "1h" } } },
  WTI: { s1: { L: { k: 2.9, b: -1.4, cd: "2.5h" }, S: { k: 3.2, b: 1.8, cd: "1h" } }, s2: { L: { k: 2.9, b: -2.0, cd: "3h" }, S: { k: 3.4, b: 0.6, cd: "1h" } } },

  // ── FX 메이저 (일봉) ──
  EURUSD: { s3: { L: { k: 2.1, b: -1.4, cd: "3d" } }, s4: { L: { k: 2.0, b: -1.2, cd: "3d" } } },
  GBPUSD: { s4: { L: { k: 2.8, b: 1.4, cd: "1d" }, S: { k: 2.0, b: -1.8, cd: "3d" } } },
  USDJPY: { s3: { L: { k: 2.5, b: -2.0, cd: "2d" } }, s4: { L: { k: 2.3, b: -0.2, cd: "3d" } } },
  AUDUSD: { s4: { L: { k: 2.6, b: -0.2, cd: "1d" }, S: { k: 1.9, b: -1.6, cd: "7d" } } },
  USDCAD: { s3: { L: { k: 2.7, b: 0.2, cd: "1d" } }, s4: { L: { k: 1.8, b: -1.6, cd: "3d" } } },
  USDCHF: { s4: { L: { k: 2.8, b: -1.2, cd: "1d" }, S: { k: 2.2, b: 0.0, cd: "3d" } } },
  NZDUSD: { s3: { L: { k: 2.5, b: 0.8, cd: "1d" } }, s4: { L: { k: 2.3, b: 1.4, cd: "3d" }, S: { k: 1.0, b: -2.0, cd: "10d" } } },
};

export const STRAT_META = {
  s1: { label: "S1 추세·1m", color: "#ffb86c" },
  s2: { label: "S2 역추세·1m", color: "#7ee787" },
  s3: { label: "S3 추세·일", color: "#ffd166" },
  s4: { label: "S4 역추세·일", color: "#5dcaa5" },
};

// 부호 표시(− 사용) + 칸 텍스트
export function fmtParam(d) {
  const b = Number(d.b);
  const bStr = b < 0 ? `−${Math.abs(b)}` : `${b}`;
  return `${d.k}/${bStr}/${d.cd}`;
}
