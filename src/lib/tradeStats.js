// src/lib/tradeStats.js
// 매매 전적 통계 (최근 N일) — 시그널 스트림(EXIT + pnl_pct + reasons=전략태그) 기반.
//   데이터: /api/signals (ns별 스트림, 봇 보존 35일) — trade_records 대신 시그널을 쓰는 이유:
//   ① EXIT에 pnl_pct·전략태그가 이미 실림(조인 불필요) ② MT5 trade_record의 pnl_usdt는
//   호가통화·계약크기 미반영이라 스케일이 틀림 → 수익률(%) × 진입비중으로 기여도 추정이 정확.
//
// 유니버스 3분류(봇 bots/state/universe.py 미러): crypto=Bybit 전체 / mt5=MT5 비환율 / fx=환율 7종.
// 진입비중(WEIGHTS)은 tradingBot trade_config entry_percent_by_strategy 미러(×레버50 = notional%).
//   ⚠️ 봇 사이징 변경 시 함께 갱신할 것. (2026-07-16 U2×3.5/U3×2.3 상향 반영, 2026-07-21 작성)

import { signalsRepo } from "./signalsRepo";

export const STATS_DAYS = 30;
const STATS_LIMIT = 3000;

// 환율 7종 — 봇 FX_SYMBOLS 미러
export const FX_SYMBOLS = new Set([
  "USDJPY", "EURUSD", "GBPUSD", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
]);

// 전략 태그 → 패밀리 라벨 (봇 utils/logger.py _STRAT_KR 미러, 2026-07-21 텔레그램과 통일).
//   책 배지(S11/S22/S33/구)가 소속을 말해주므로 라벨은 패밀리명만.
const STRAT_KR = {
  S1: "추세", S2: "역추세", S3: "추세", S4: "역추세",
  S11: "추세", S12: "역추세", S13: "급락페이드", S14: "ewz추세", S15: "유동성스윕",
};

// ns → 소속 책 {code, tf}. S11=1분봉책 / S22=4시간봉책 / S33=일봉책 / 구=드레인 중 구 1분 채널.
//   bybit/mt5 ns는 일봉(s3/s4)과 구 1분(s1/s2)이 공존 → 전략으로 분기.
function bookOf(ns, strat) {
  const n = String(ns || "").toLowerCase();
  if (n === "s11" || n === "s11m") return { code: "S11", tf: "1분" };
  if (n === "s22" || n === "s22m") return { code: "S22", tf: "4h" };
  if (n === "fxd" || n === "cryptod" || n === "mt5d") return { code: "S33", tf: "일봉" };
  if (n === "bybit" || n === "mt5") {
    return strat === "S3" || strat === "S4"
      ? { code: "S33", tf: "일봉" }
      : { code: "구", tf: "1분" };
  }
  return { code: n, tf: "" };
}

// 페이지별 유니버스 결정 (심볼 기반 — 봇 universe_of 미러)
function universeOf(page, symbol) {
  if (page === "coin") return "크립토";
  return FX_SYMBOLS.has(String(symbol || "").toUpperCase()) ? "환율" : "MT5";
}

// 전략별 진입비중(자산 대비 notional %) — 기여도 = Σ(pnl_pct × weight/100).
// coin = Bybit executor: s1~s4 2% / s11~s14 5%
// cfd  = MT5 executor:  s1/s2 2% / 책(s11~s15) 비FX 3.5%·FX 2.3%(WTI 4h페이드 1.75%)
//        / 일봉(s3/s4) 비FX 7%·FX 11.5%
function entryWeightPct(page, ns, strat, symbol) {
  const isFx = FX_SYMBOLS.has(String(symbol || "").toUpperCase());
  if (page === "coin") {
    if (strat === "S11" || strat === "S12" || strat === "S13" || strat === "S14") return 5;
    return 2; // S1/S2(구)·S3/S4(일봉)
  }
  // cfd
  if (strat === "S1" || strat === "S2") return 2;
  if (strat === "S3" || strat === "S4") return isFx ? 11.5 : 7;
  // 책(S11~S15)
  if (strat === "S13" && String(symbol).toUpperCase() === "WTI" &&
      String(ns).toLowerCase() === "s22m") return 1.75; // WTI 4h페이드 절반 규칙
  return isFx ? 2.3 : 3.5;
}

function reasonsOf(sig) {
  const r = sig?.reasons_json;
  if (Array.isArray(r)) return r;
  if (typeof r === "string") {
    try {
      const a = JSON.parse(r);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }
  return [];
}

function stratOf(sig) {
  const r0 = String(reasonsOf(sig)[0] || "");
  const base = r0.split("_")[0].toUpperCase();
  return /^S\d+$/.test(base) ? base : null;
}

function emptyBucket() {
  return { games: 0, wins: 0, withPnl: 0, contribPct: 0, sumPnlPct: 0 };
}

function addTo(bucket, pnlPct, weightPct) {
  bucket.games += 1;
  if (pnlPct !== null && Number.isFinite(pnlPct)) {
    bucket.withPnl += 1;
    if (pnlPct > 0) bucket.wins += 1;
    bucket.contribPct += (pnlPct / 100) * weightPct;
    bucket.sumPnlPct += pnlPct;
  }
}

function finalize(bucket) {
  return {
    games: bucket.games,
    wins: bucket.wins,
    withPnl: bucket.withPnl,
    winRatePct: bucket.withPnl > 0 ? (bucket.wins / bucket.withPnl) * 100 : null,
    contribPct: bucket.contribPct,
    // 게임당 평균 수익률(포지션 기준 pnl_pct 단순평균 — 진입비중 미반영)
    avgPnlPct: bucket.withPnl > 0 ? bucket.sumPnlPct / bucket.withPnl : null,
  };
}

/**
 * 최근 STATS_DAYS일 매매 전적 집계.
 * @param {"coin"|"cfd"} page
 * @param {string[]} nsList 시그널 네임스페이스 목록
 * @returns {Promise<{total, groups:[{universe, total, rows:[{key,label,...}]}], missingPnl:number}>}
 */
export async function loadTradeStats(page, nsList) {
  const loaded = await Promise.all(
    nsList.map((name) =>
      signalsRepo
        .load8d({ name, days: STATS_DAYS, limit: STATS_LIMIT })
        .then((d) => ({ ns: name, signals: d?.signals || [] }))
        .catch(() => ({ ns: name, signals: [] }))
    )
  );

  const total = emptyBucket();
  // universe -> { total, rows: Map(전략 rowKey -> bucket+meta), symRows: Map(심볼 -> bucket+meta) }
  const groups = new Map();

  for (const { ns, signals } of loaded) {
    for (const sig of signals) {
      if (String(sig?.kind || "").toUpperCase() !== "EXIT") continue;
      const strat = stratOf(sig);
      if (!strat) continue;

      const symbol = String(sig?.symbol || "").toUpperCase();
      const pnl = sig?.pnl_pct !== null && sig?.pnl_pct !== undefined ? Number(sig.pnl_pct) : null;
      const w = entryWeightPct(page, ns, strat, symbol);
      const uni = universeOf(page, symbol);
      const book = bookOf(ns, strat);
      const rowKey = `${book.code}·${strat}`;
      const label = STRAT_KR[strat] || strat;

      if (!groups.has(uni)) groups.set(uni, { total: emptyBucket(), rows: new Map(), symRows: new Map() });
      const g = groups.get(uni);
      if (!g.rows.has(rowKey)) {
        g.rows.set(rowKey, { key: rowKey, label, strat, book: book.code, tf: book.tf, ...emptyBucket() });
      }
      if (!g.symRows.has(symbol)) {
        g.symRows.set(symbol, { key: symbol, label: symbol, ...emptyBucket() });
      }

      addTo(total, pnl, w);
      addTo(g.total, pnl, w);
      addTo(g.rows.get(rowKey), pnl, w);
      addTo(g.symRows.get(symbol), pnl, w);
    }
  }

  // 유니버스 표시 순서: 크립토 / MT5 / 환율
  const order = ["크립토", "MT5", "환율"];
  const outGroups = [...groups.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([universe, g]) => ({
      universe,
      total: finalize(g.total),
      rows: [...g.rows.values()]
        .map((r) => ({ key: r.key, label: r.label, strat: r.strat, book: r.book, tf: r.tf, ...finalize(r) }))
        .sort((a, b) => Math.abs(b.contribPct) - Math.abs(a.contribPct)),
      symRows: [...g.symRows.values()]
        .map((r) => ({ key: r.key, label: r.label, ...finalize(r) }))
        .sort((a, b) => Math.abs(b.contribPct) - Math.abs(a.contribPct)),
    }));

  const fin = finalize(total);
  return {
    total: fin,
    groups: outGroups,
    missingPnl: fin.games - fin.withPnl,
  };
}
