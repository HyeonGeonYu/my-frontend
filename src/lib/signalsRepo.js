// src/lib/signalsRepo.js
import { next0650EndBoundaryUtcSec } from "./tradeUtils";

// 8일치 고정(너가 말한 조건)
const DEFAULT_DAYS = 8;
const DEFAULT_LIMIT = 500;

// 캐시 키: name|days|limit
const _cache = new Map(); // key -> { ts, promise, data }
const STALE_MS = 30_000; // 30초 내 재요청은 캐시 재사용(원하면 0으로)

function _cacheKey({ name = "bybit", days = DEFAULT_DAYS, limit = DEFAULT_LIMIT }) {
  return `${String(name || "bybit").toLowerCase()}|${days}|${limit}`;
}

// KST 세션 dayKey 계산 (06:50 기준, start(=end-24h) 기준으로 dayKey)
function _dayKeyFromTsMs(tsMs) {
  if (!Number.isFinite(tsMs)) return null;

  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const SESSION_START_MIN = 6 * 60 + 50;

  const kstMs = tsMs + KST_OFFSET_MS;
  const d = new Date(kstMs);

  // KST 기준 날짜/시각을 UTC 메서드로 읽는다(축 맞춤)
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  let day = d.getUTCDate();
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();

  // 06:50 이전이면 세션 dayKey는 전날
  if (mins < SESSION_START_MIN) {
    const prev = new Date(Date.UTC(y, m, day) - 86400 * 1000);
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth();
    day = prev.getUTCDate();
  }

  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 특정 dayOffset(0=오늘 세션, -1=어제...)에 해당하는 [startMs, endMs) 구하기
export function getSessionRangeUtcMs(dayOffset = 0) {
  const endUtcSec = next0650EndBoundaryUtcSec() + dayOffset * 86400;
  const startUtcSec = endUtcSec - 86400;
  return { startMs: startUtcSec * 1000, endMs: endUtcSec * 1000 };
}

function _upper(x) {
  return x == null ? undefined : String(x).toUpperCase();
}

// pnl_pct null-safe + 숫자화
function _numOrNull(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).trim();
  if (!s) return null;
  const m = s.match(/^([+-]?\d+(\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function _parsePnlFromReasons(reasons) {
  if (!Array.isArray(reasons)) return null;
  for (const r of reasons) {
    const s = String(r);
    const m = s.match(/pnl=([+-]?\d+(\.\d+)?)%/i);
    if (m) {
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

// API에서 이미 정규화하지만, repo에서도 한번 더 안전하게 normalize
function normalizeSignal(s) {
  const ts_ms = Number.isFinite(Number(s?.ts_ms)) ? Number(s.ts_ms) : undefined;

  const symbol = s?.symbol ? _upper(s.symbol) : undefined;
  const side = s?.side ? _upper(s.side) : undefined;
  const kind = s?.kind ? _upper(s.kind) : undefined;

  let pnl_pct =
    _numOrNull(s?.pnl_pct) ?? _numOrNull(s?.pnlPct) ?? _numOrNull(s?.pnl);

  if (pnl_pct === null) pnl_pct = _parsePnlFromReasons(s?.reasons_json);

  const day_key = ts_ms ? _dayKeyFromTsMs(ts_ms) : null;

  return {
    ...s,
    ts_ms,
    symbol,
    side,
    kind,
    pnl_pct, // number|null
    day_key,
  };
}

// 100 기준 compounding summary (프론트에서 사용)
export function calcDaySummary(signals, startValue = 100) {
  let v = startValue;
  let withPnl = 0;
  let missingPnl = 0;

  const sorted = [...(signals || [])].sort((a, b) => (a.ts_ms || 0) - (b.ts_ms || 0));

  for (const it of sorted) {
    const p = it?.pnl_pct;
    if (p === null || p === undefined || !Number.isFinite(Number(p))) {
      const k = String(it?.kind || "").toUpperCase();
      if (k === "EXIT" || k.includes("SL") || k.includes("TP")) missingPnl++;
      continue;
    }
    v *= 1 + Number(p) / 100;
    withPnl++;
  }

  return {
    start_value: startValue,
    end_value: v,
    pnl_total_pct: v - startValue,
    count_with_pnl: withPnl,
    count_missing_pnl: missingPnl,
  };
}

// ✅ 핵심: 8일치 한 번 로드
async function fetchSignals8d({ name = "bybit", days = DEFAULT_DAYS, limit = DEFAULT_LIMIT }) {
  const qs = new URLSearchParams();
  qs.set("name", String(name || "bybit"));
  qs.set("days", String(days));
  qs.set("limit", String(limit));
  // 필요한 경우 debug=1 넣고 확인 가능
  // qs.set("debug", "1");

  const res = await fetch(`/api/signals?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`signals api failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (data?.retCode !== 0) {
    throw new Error(data?.retMsg || "signals api retCode != 0");
  }
  const raw = Array.isArray(data?.signals) ? data.signals : [];
  return raw.map(normalizeSignal);
}

// 인덱스(심볼별, day_key별) 구축
function buildIndexes(signals) {
  const bySymbol = new Map(); // sym -> Signal[]
  const byDayKey = new Map(); // day_key -> Signal[]
  const bySymbolDay = new Map(); // `${sym}|${day_key}` -> Signal[]

  for (const s of signals) {
    const sym = s.symbol || "UNKNOWN";
    const dk = s.day_key || "UNKNOWN";

    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym).push(s);

    if (!byDayKey.has(dk)) byDayKey.set(dk, []);
    byDayKey.get(dk).push(s);

    const k = `${sym}|${dk}`;
    if (!bySymbolDay.has(k)) bySymbolDay.set(k, []);
    bySymbolDay.get(k).push(s);
  }

  // 각 버킷 정렬(오래된→최신)
  for (const arr of bySymbol.values()) arr.sort((a, b) => (a.ts_ms || 0) - (b.ts_ms || 0));
  for (const arr of byDayKey.values()) arr.sort((a, b) => (a.ts_ms || 0) - (b.ts_ms || 0));
  for (const arr of bySymbolDay.values()) arr.sort((a, b) => (a.ts_ms || 0) - (b.ts_ms || 0));

  return { bySymbol, byDayKey, bySymbolDay };
}

export const signalsRepo = {
  // ✅ 8일치 로드 + 캐시
  async load8d({ name = "bybit", days = DEFAULT_DAYS, limit = DEFAULT_LIMIT, force = false } = {}) {
    const key = _cacheKey({ name, days, limit });
    const now = Date.now();

    const hit = _cache.get(key);
    if (!force && hit) {
      // stale 정책
      if (hit.data && now - hit.ts < STALE_MS) return hit.data;
      if (hit.promise) return hit.promise;
    }

    const promise = (async () => {
      const signals = await fetchSignals8d({ name, days, limit });

      const idx = buildIndexes(signals);
      const symbols = Array.from(idx.bySymbol.keys()).filter((s) => s !== "UNKNOWN").sort();

      const data = {
        name,
        days,
        limit,
        signals,
        symbols,
        ...idx,
      };

      _cache.set(key, { ts: Date.now(), promise: null, data });
      return data;
    })();

    _cache.set(key, { ts: now, promise, data: hit?.data || null });
    return promise;
  },

  // 특정 symbol + dayOffset로 바로 뽑기 편의 함수
  async getForChart({ name = "bybit", symbol, dayOffset = 0, days = DEFAULT_DAYS, limit = DEFAULT_LIMIT } = {}) {
    const data = await this.load8d({ name, days, limit });
    const { startMs, endMs } = getSessionRangeUtcMs(dayOffset);
    const sym = symbol ? String(symbol).toUpperCase() : null;

    const arr = sym ? (data.bySymbol.get(sym) || []) : data.signals;
    return arr.filter((s) => (s.ts_ms || 0) >= startMs && (s.ts_ms || 0) < endMs);
  },

  clear() {
    _cache.clear();
  },
};