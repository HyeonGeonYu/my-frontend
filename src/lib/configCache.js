// src/lib/configCache.js
// /api/config(=Redis hgetall trading:{name}:config)를 클라에서 캐시.
//   봇 설정이라 거의 불변인데 매 마운트마다 새로 읽던 것 → TTL 캐시로 Redis 읽기 절감.
const TTL_MS = 5 * 60 * 1000; // 5분
const _cache = new Map(); // name -> { ts, promise, data }

export async function fetchConfigCached(name = "bybit", { force = false } = {}) {
  const key = String(name || "bybit");
  const now = Date.now();
  const hit = _cache.get(key);
  if (!force && hit) {
    if (hit.data && now - hit.ts < TTL_MS) return hit.data;
    if (hit.promise) return hit.promise;
  }
  const url = name ? `/api/config?name=${encodeURIComponent(name)}` : "/api/config";
  const promise = (async () => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`config fetch failed: ${r.status}`);
    const j = await r.json();
    _cache.set(key, { ts: Date.now(), promise: null, data: j });
    return j;
  })().catch((e) => {
    _cache.delete(key);
    throw e;
  });
  _cache.set(key, { ts: now, promise, data: hit?.data || null });
  return promise;
}
