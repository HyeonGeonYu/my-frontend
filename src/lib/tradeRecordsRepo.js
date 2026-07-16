// src/lib/tradeRecordsRepo.js
// 거래기록을 "네임스페이스당 1회"만 로드해 캐시하고, 심볼 필터는 클라에서.
//   기존엔 차트(심볼)마다 /api/tradeRecords를 따로 호출 → 같은 통짜 스트림을 심볼 수만큼 재읽기.
//   tradeRecords Redis 키는 ns 단위 스트림 하나이므로 1회 로드로 충분.
const DEFAULT_DAYS = 10;
const DEFAULT_LIMIT = 1000;
const STALE_MS = 30_000; // 30초 내 재요청은 캐시 재사용

const _cache = new Map(); // key(ns|days|limit) -> { ts, promise, data }

function _key(ns, days, limit) {
  return `${ns}|${days}|${limit}`;
}

async function _fetch(ns, days, limit) {
  const qs = new URLSearchParams({ ns, days: String(days), limit: String(limit) });
  const res = await fetch(`/api/tradeRecords?${qs.toString()}`, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.retCode !== 0) {
    throw new Error(json?.retMsg || json?.error || "tradeRecords fetch failed");
  }
  const records = Array.isArray(json.records) ? json.records : [];
  const bySymbol = new Map();
  for (const r of records) {
    const sym = String(r?.symbol || "").toUpperCase();
    if (!sym) continue;
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym).push(r);
  }
  return { records, bySymbol };
}

export const tradeRecordsRepo = {
  async load(ns, { days = DEFAULT_DAYS, limit = DEFAULT_LIMIT, force = false } = {}) {
    if (!ns) return { records: [], bySymbol: new Map() };
    const key = _key(ns, days, limit);
    const now = Date.now();
    const hit = _cache.get(key);
    if (!force && hit) {
      if (hit.data && now - hit.ts < STALE_MS) return hit.data;
      if (hit.promise) return hit.promise;
    }
    const promise = (async () => {
      const data = await _fetch(ns, days, limit);
      _cache.set(key, { ts: Date.now(), promise: null, data });
      return data;
    })().catch((e) => {
      // 실패 시 캐시 무효화(다음 호출 재시도)
      _cache.delete(key);
      throw e;
    });
    _cache.set(key, { ts: now, promise, data: hit?.data || null });
    return promise;
  },

  // 심볼 필터된 배열 (ns당 캐시 공유)
  async getForSymbol(ns, symbol, opts = {}) {
    const data = await this.load(ns, opts).catch(() => ({ bySymbol: new Map() }));
    const sym = String(symbol || "").toUpperCase();
    return data.bySymbol.get(sym) || [];
  },

  clear() {
    _cache.clear();
  },
};
