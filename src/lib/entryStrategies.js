// src/lib/entryStrategies.js
// 보유 포지션의 각 진입(lot)이 "어느 전략 셀에서 들어온 것인지" 매핑.
//   포지션 entries[].entry_signal_id ↔ 신호 스트림 ENTRY의 signal_id 매칭.
//   전략 구분은 (ns, reasons 태그) 조합 — 같은 태그라도 책(ns)에 따라 다른 전략.
//     s11/s11m: S11(z추세)·S12(z역추세)·S13(급락페이드) — 1분봉책
//     s22/s22m: S11·S12·S13 + S14(ewz추세)·S15(유동성스윕) — 4시간봉책
//     bybit/mt5: S3/S4(일봉책 통합) + 구 1분 S1/S2(드레인)
//     cryptod/mt5d/fxd: 일봉 구채널(S3/S4, 드레인·히스토리)
import { signalsRepo } from "./signalsRepo";

// 신호 스트림 보존기간(keep_days=35, bots/state/signals.py)과 동일 — 최대보유(15일)보다 길어
//   열려있는 모든 lot의 ENTRY 신호가 이 창 안에 있음.
const LOOKBACK_DAYS = 35;
const LOAD_LIMIT = 3000;

const TAG_LABEL = {
  S1: "S1", S2: "S2", // 구채널 — 옛 의미(추세/역추세) 표기가 소스마다 갈려 태그 그대로 노출
  S3: "추세", S4: "역추세",
  S11: "z추세", S12: "z역추세", S13: "급락페이드",
  S14: "ewz추세", S15: "유동성스윕",
};

// 칩 색 — LogicLiveTab/차트 범례와 같은 계열 유지
export const TAG_COLOR = {
  S1: "#8a8a8a", S2: "#8a8a8a",
  S3: "#ffd166", S4: "#5dcaa5",
  S11: "#ffb86c", S12: "#7ee787", S13: "#c084fc",
  S14: "#4cc9f0", S15: "#e8913a",
};

function bookOf(ns, tag) {
  const n = String(ns || "").toLowerCase();
  if (n === "s11" || n === "s11m") return "1분";
  if (n === "s22" || n === "s22m") return "4h";
  if (n === "cryptod" || n === "mt5d" || n === "fxd") return "일봉(구)";
  if (n === "bybit" || n === "mt5" || n === "s1" || n === "s2") {
    return tag === "S3" || tag === "S4" ? "일봉" : "구채널";
  }
  return n;
}

export function entryStrategyLabel(ns, tag) {
  const t = String(tag || "").toUpperCase();
  return `${bookOf(ns, t)} ${TAG_LABEL[t] || t}`;
}

// ENTRY 신호의 reasons에서 전략 태그 추출 — ENTRY reasons는 [tag] 또는 [tag,"ADD"] 형태.
function tagOfSignal(sig) {
  let r = sig?.reasons_json ?? sig?.reasons;
  if (typeof r === "string") {
    try { r = JSON.parse(r); } catch { r = [r]; }
  }
  if (!Array.isArray(r)) return null;
  for (const x of r) {
    const m = String(x).trim().toUpperCase().match(/^S\d{1,2}$/);
    if (m) return m[0];
  }
  return null;
}

/**
 * nsList의 신호 스트림에서 ENTRY들을 모아 signal_id → {ns, tag, label, color, ts_ms} 맵 생성.
 * signalsRepo 캐시(30s stale)를 그대로 타므로 재호출 부담 적음.
 */
export async function loadEntryStrategyMap(nsList = []) {
  const results = await Promise.all(
    nsList.map((name) =>
      signalsRepo.load8d({ name, days: LOOKBACK_DAYS, limit: LOAD_LIMIT }).catch(() => null)
    )
  );
  const map = new Map();
  results.forEach((data, i) => {
    if (!data) return;
    const ns = nsList[i];
    for (const s of data.signals || []) {
      if (String(s?.kind || "").toUpperCase() !== "ENTRY") continue;
      const sid = s?.signal_id;
      if (!sid) continue;
      const tag = tagOfSignal(s);
      if (!tag) continue;
      map.set(String(sid), {
        ns,
        tag,
        label: entryStrategyLabel(ns, tag),
        color: TAG_COLOR[tag] || "#8a8a8a",
        ts_ms: s?.ts_ms,
      });
    }
  });
  return map;
}

/**
 * 포지션 entries([{qty, price, ts, entry_signal_id}])를 전략별로 묶는다.
 * 반환: [{label, color, count, qty, avg, lastTs}] — 수량합 큰 순.
 * 매칭 실패(신호 만료 등)는 "기타"로 묶음.
 */
export function groupEntriesByStrategy(entries, sigMap) {
  const groups = new Map();
  for (const e of entries || []) {
    const qty = Math.abs(Number(e?.qty) || 0);
    const px = Number(e?.price) || 0;
    if (qty <= 0) continue;
    const meta = sigMap?.get(String(e?.entry_signal_id || ""));
    const key = meta ? meta.label : "기타";
    if (!groups.has(key)) {
      groups.set(key, { label: key, color: meta?.color || "#8a8a8a", count: 0, qty: 0, pxq: 0, lastTs: 0 });
    }
    const g = groups.get(key);
    g.count += 1;
    g.qty += qty;
    g.pxq += qty * px;
    g.lastTs = Math.max(g.lastTs, Number(e?.ts) || 0);
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, avg: g.qty > 0 ? g.pxq / g.qty : null }))
    .sort((a, b) => b.qty * (b.avg || 0) - a.qty * (a.avg || 0));
}
