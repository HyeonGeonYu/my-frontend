// src/lib/chartSources.js
import { getWsHub, buildSignalAnnotations } from "./tradeUtils";
import { fetchSignals } from "./tradeUtils";

const PAGE_LIMIT = 1000;
const ONE_DAY_SEC = 86400;

export const MA_BUF_DEFAULT = 99;

// -------------------- shared small utils --------------------

function getDayWindowByOffset(anchorEndUtcSec, offsetDays = 0) {
  const end = Number(anchorEndUtcSec) + Number(offsetDays) * ONE_DAY_SEC;
  return [end - ONE_DAY_SEC, end];
}

function makeCandleCache() {
  // cacheKey -> Map(dayKey -> rows)
  return new Map();
}

function touchDayCache(cache, cacheKey, dayKey, rows, maxDays = 8) {
  if (!cache.has(cacheKey)) cache.set(cacheKey, new Map());
  const symMap = cache.get(cacheKey);

  // LRU-ish
  if (symMap.has(dayKey)) symMap.delete(dayKey);
  symMap.set(dayKey, rows);

  while (symMap.size > maxDays) {
    const firstKey = symMap.keys().next().value;
    symMap.delete(firstKey);
  }
}

function getDayCache(cache, cacheKey, dayKey) {
  const symMap = cache.get(cacheKey);
  if (!symMap) return null;
  return symMap.get(dayKey) || null;
}

// -------------------- caches (namespaced) --------------------
// NOTE: module-scope singleton caches (앱 생명주기 동안 유지, 새로고침 시 초기화)
const candleCache = makeCandleCache(); // cacheKey -> Map(dayOffset->rows)
const signalCache = new Map(); // signalKey -> { markers, notes }

// -------------------- BYBIT REST --------------------

const BYBIT_API_BASE = "https://api.bybit.com";

/**
 * Bybit v5 kline: 특정 window(start~end) + MA buffer까지 커버될 때까지 과거로 페이지네이션
 * - end(ms) 기준으로 과거로 내려가며 list 누적
 * - oldestSec <= wantStartSec 이면 stop
 */
async function fetchCandlesForWindowBybit(symUpper, interval, startSec, endSec, signal, maBuf = MA_BUF_DEFAULT) {
  const wantStartSec = startSec - maBuf * 60;

  let rows = [];
  let endMs = Math.floor(Number(endSec) * 1000);
  let prevEndMs = null;

  for (let page = 0; page < 12; page++) {
    const url = new URL("/v5/market/kline", BYBIT_API_BASE);
    url.searchParams.set("category", "linear");
    url.searchParams.set("symbol", symUpper);
    url.searchParams.set("interval", String(interval));
    url.searchParams.set("limit", String(PAGE_LIMIT));
    url.searchParams.set("end", String(endMs));

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data?.retCode !== 0) throw new Error(`API error (${data?.retCode}): ${data?.retMsg}`);

    const list = data?.result?.list || [];
    if (!list.length) break;

    rows = rows.concat(list);

    // 이번 페이지에서 가장 오래된 ts 찾기
    let minMs = Infinity;
    for (const r of list) {
      const ms = Number(r?.[0]);
      if (Number.isFinite(ms) && ms < minMs) minMs = ms;
    }
    if (!Number.isFinite(minMs)) break;

    const oldestSec = Math.floor(minMs / 1000);
    if (oldestSec <= wantStartSec) break;

    // 다음 페이지: 더 과거로
    prevEndMs = endMs;
    endMs = minMs - 1;

    if (endMs <= 0) break;
    if (prevEndMs != null && endMs >= prevEndMs) break;
  }

  rows.sort((a, b) => Number(a[0]) - Number(b[0]));
  return rows;
}

// -------------------- CFD REST --------------------

const CFD_API_BASE = "https://api.hyeongeonnoil.com";

/**
 * CFD: start~end(+MA buffer) 충분히 커버될 때까지 페이지 로드
 * - nextCursor(end) 기반으로 내려감
 */
async function fetchCandlesForWindowCfd(symUpper, interval, startSec, endSec, signal, maBuf = MA_BUF_DEFAULT) {
  const wantStart = startSec - maBuf * 60;

  let rows = [];
  let nextCursor = null;

  for (let i = 0; i < 12; i++) {
    const url = new URL("/v5/market/candles/with-gaps", CFD_API_BASE);
    url.searchParams.set("symbol", symUpper);
    url.searchParams.set("interval", String(interval));
    url.searchParams.set("limit", String(PAGE_LIMIT));
    if (nextCursor != null) url.searchParams.set("end", String(nextCursor));

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data?.retCode !== 0) throw new Error(`API error (${data?.retCode}): ${data?.retMsg}`);

    const list = data?.result?.list || [];
    if (!list.length) break;

    rows = rows.concat(list);

    let minMs = Infinity;
    for (const r of list) {
      const ms = Number(r?.[0]);
      if (Number.isFinite(ms) && ms < minMs) minMs = ms;
    }

    const oldestSec = Number.isFinite(minMs) ? Math.floor(minMs / 1000) : Infinity;
    if (oldestSec <= wantStart) break;

    nextCursor = data?.result?.nextCursor ?? null;
    if (!nextCursor) break;
  }

  rows.sort((a, b) => Number(a[0]) - Number(b[0]));
  return rows;
}

// -------------------- signals (namespaced) --------------------

async function ensureSignalsNamespaced({ sourceId, symUpper, signalName }) {
  // signalName이 없을 수도 있으니 문자열로 고정
  const sigName = String(signalName || "default");
  const key = `${sourceId}:sig:${sigName}:${symUpper}`;

  if (!signalCache.has(key)) {
    // fetchSignals는 네 프로젝트 유틸을 그대로 사용
    // - coin: signalName="bybit" 같은 식
    // - cfd : signalName="mt5"
    const sigs = await fetchSignals(symUpper, sigName).catch(() => []);
    const { markers, notes } = buildSignalAnnotations(sigs);
    signalCache.set(key, { markers: markers || [], notes: notes || [] });
  }

  return signalCache.get(key);
}

// -------------------- Source factories --------------------

/**
 * Bybit Source
 * - signalName: 기본 "bybit" (필요하면 페이지에서 바꿔서 주입)
 */
export function makeBybitSource({ signalName = "bybit" } = {}) {
  const wsHub = getWsHub("wss://stream.bybit.com/v5/public/linear");
  const id = "bybit";

  return {
    id,
    wsHub,
    signalName,

    // candle cache helpers (optional)
    getDayWindowByOffset,

    getCachedRows(symUpper, dayKey) {
      const cacheKey = `${id}:candle:${symUpper}`;
      return getDayCache(candleCache, cacheKey, dayKey);
    },

    touchCandleCache(symUpper, dayKey, rows) {
      const cacheKey = `${id}:candle:${symUpper}`;
      touchDayCache(candleCache, cacheKey, dayKey, rows, 8);
    },

    // REST
    fetchWindow(symUpper, interval, startSec, endSec, signal, maBuf = MA_BUF_DEFAULT) {
      return fetchCandlesForWindowBybit(symUpper, interval, startSec, endSec, signal, maBuf);
    },

    // Signals (cached)
    async ensureSignals(symUpper) {
      const s = await ensureSignalsNamespaced({ sourceId: id, symUpper, signalName });
      return s || { markers: [], notes: [] };
    },

    // WS topics
    topics(symbol) {
      return [`kline.1.${symbol}`];
    },

    // WS normalize
    normalizeWs(topic, d) {
      // bybit kline payload: d.start may be sec or ms
      const rawStart = Number(d?.start);
      const startSec = Number.isFinite(rawStart)
        ? rawStart > 2e10
          ? Math.floor(rawStart / 1000)
          : Math.floor(rawStart)
        : NaN;
      if (!Number.isFinite(startSec)) return null;

      return {
        type: "kline",
        bar: { time: startSec, open: +d.open, high: +d.high, low: +d.low, close: +d.close },
      };
    },
  };
}

/**
 * CFD Source (HNO)
 * - signalName: "mt5" 고정(원하면 바꿀 수 있게 해둠)
 */
export function makeCfdSource({ signalName = "mt5" } = {}) {
  const wsHub = getWsHub("wss://api.hyeongeonnoil.com/ws");
  const id = "cfd";

  return {
    id,
    wsHub,
    signalName,

    getDayWindowByOffset,

    getCachedRows(symUpper, dayKey) {
      const cacheKey = `${id}:candle:${symUpper}`;
      return getDayCache(candleCache, cacheKey, dayKey);
    },

    touchCandleCache(symUpper, dayKey, rows) {
      const cacheKey = `${id}:candle:${symUpper}`;
      touchDayCache(candleCache, cacheKey, dayKey, rows, 8);
    },

    // REST
    fetchWindow(symUpper, interval, startSec, endSec, signal, maBuf = MA_BUF_DEFAULT) {
      return fetchCandlesForWindowCfd(symUpper, interval, startSec, endSec, signal, maBuf);
    },

    // Signals (cached)
    async ensureSignals(symUpper) {
      const s = await ensureSignalsNamespaced({ sourceId: id, symUpper, signalName });
      return s || { markers: [], notes: [] };
    },

    // WS topics
    topics(symbol) {
      return [`tickers.${symbol}`, `kline.1.${symbol}`];
    },

    // WS normalize
    normalizeWs(topic, d) {
      if (topic?.startsWith("tickers.")) {
        const bid = Number(d?.bid1Price ?? d?.bid);
        const ask = Number(d?.ask1Price ?? d?.ask);
        const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
        const last = Number(d?.lastPrice ?? d?.last ?? d?.price);
        const px = Number.isFinite(mid) ? mid : last;
        if (!Number.isFinite(px)) return null;
        return { type: "price", price: px };
      }

      if (topic?.startsWith("kline.1.")) {
        const rawStart = Number(d?.start);
        const o = Number(d?.open);
        const h = Number(d?.high);
        const l = Number(d?.low);
        const c = Number(d?.close);

        const startMsUtc = Number.isFinite(rawStart) ? (rawStart < 2e10 ? rawStart * 1000 : rawStart) : NaN;
        if (!Number.isFinite(startMsUtc) || ![o, h, l, c].every(Number.isFinite)) return null;

        return {
          type: "kline",
          bar: { time: Math.floor(startMsUtc / 1000), open: o, high: h, low: l, close: c },
        };
      }

      return null;
    },
  };
}