// src/components/cfd/CfdChartPanel.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ChartView from "../common/ChartView";
import SignalNotesPanel from "../common/SignalNotesPanel";
import {
  getWsHub,
  mergeBars,
  fmtKSTHour,
  buildCrossMarkers,
  fmtComma,
  sliceWithBuffer,
} from "../../lib/tradeUtils";
import { fetchSignals, buildSignalAnnotations } from "../../lib/tradeUtils";

const API_BASE = "https://api.hyeongeonnoil.com";
const PAGE_LIMIT = 1000;

const MA_BUF = 99;
const ONE_DAY_SEC = 86400;

/* -------------------- CACHE -------------------- */
// symbol -> Map(dayOffset -> rows)
const candleCache = new Map();
const signalCache = new Map();
const MAX_DAYS_PER_SYMBOL = 8;

function touchCandleCache(symbol, dayKey, rows) {
  const sym = symbol.toUpperCase();
  if (!candleCache.has(sym)) candleCache.set(sym, new Map());
  const symMap = candleCache.get(sym);

  // LRU-ish
  if (symMap.has(dayKey)) symMap.delete(dayKey);
  symMap.set(dayKey, rows);

  while (symMap.size > MAX_DAYS_PER_SYMBOL) {
    const firstKey = symMap.keys().next().value;
    symMap.delete(firstKey);
  }
}

function getCachedRows(symbol, dayKey) {
  const symMap = candleCache.get(symbol.toUpperCase());
  if (!symMap) return null;
  return symMap.get(dayKey) || null;
}

/* -------------------- UTILS -------------------- */

function getDayWindowByOffset(anchorEndUtcSec, offsetDays = 0) {
  const end = Number(anchorEndUtcSec) + Number(offsetDays) * ONE_DAY_SEC;
  return [end - ONE_DAY_SEC, end];
}

function rowsToBars(rows) {
  return (rows || [])
    .filter((r) => r && r[0] != null && r[1] != null && r[2] != null && r[3] != null && r[4] != null)
    .map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
    }))
    .sort((a, b) => a.time - b.time);
}

function calcSMAFromCandles(candles, win = 100) {
  const out = [];
  let sum = 0;
  const q = [];
  for (const c of candles) {
    const v = Number(c?.close);
    if (!Number.isFinite(v)) continue;
    q.push(v);
    sum += v;
    if (q.length > win) sum -= q.shift();
    if (q.length === win) out.push({ time: c.time, value: sum / win });
  }
  return out;
}

function buildStats(bars) {
  if (!bars?.length) return { ma100: null, chg3mPct: null };

  let ma100 = null;
  if (bars.length >= 100) {
    let sum = 0;
    for (let i = bars.length - 100; i < bars.length; i++) sum += bars[i].close;
    ma100 = sum / 100;
  }

  let chg3mPct = null;
  if (bars.length >= 3) {
    const last = bars[bars.length - 1]?.close ?? null;
    const prev3 = bars[bars.length - 3]?.close;
    if (prev3 && last != null) chg3mPct = ((last - prev3) / prev3) * 100;
  }

  return { ma100, chg3mPct };
}

// ✅ start~end(+MA buffer) 충분히 커버될 때까지 페이지 로드
async function fetchCandlesForWindow(symbol, interval, startSec, endSec, signal) {
  const wantStart = startSec - MA_BUF * 60;

  let rows = [];
  let nextCursor = null;

  for (let i = 0; i < 12; i++) {
    const url = new URL("/v5/market/candles/with-gaps", API_BASE);
    url.searchParams.set("symbol", symbol.toUpperCase());
    url.searchParams.set("interval", String(interval));
    url.searchParams.set("limit", String(PAGE_LIMIT));
    if (nextCursor != null) url.searchParams.set("end", String(nextCursor));

    const res = await fetch(url, signal ? { signal } : undefined);
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

/* -------------------- COMPONENT -------------------- */

export default function CfdChartPanel({
  symbol,
  dayOffset,
  anchorEndUtcSec,
  thr,
  crossTimes,
  onStats,
  onBounds,
}) {
  const wsHub = useMemo(() => getWsHub("wss://api.hyeongeonnoil.com/ws"), []);

  const allBarsRef = useRef([]);
  const markersAllRef = useRef([]);
  const notesAllRef = useRef([]);

  const [loading, setLoading] = useState(false);
  const [displayCandles, setDisplayCandles] = useState([]);
  const [ma100, setMa100] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [visibleRange, setVisibleRange] = useState(null);
  const [notesView, setNotesView] = useState([]);

  // StrictMode / 빠른 이동에서도 안전하게: "이번 로드" 식별자
  const loadSeqRef = useRef(0);

  // prefetch 중복 방지 + 취소 컨트롤
  const prefetchedRef = useRef(false);
  const prefetchAbortRef = useRef(null);

  useEffect(() => {
    onBounds?.(symbol, { min: -6, max: 0 });
  }, [onBounds, symbol]);

  const ensureSignals = useCallback(async (symUpper) => {
    if (!signalCache.has(symUpper)) {
      const sigs = await fetchSignals(symUpper, "mt5").catch(() => []);
      const { markers, notes } = buildSignalAnnotations(sigs);
      signalCache.set(symUpper, { markers: markers || [], notes: notes || [] });
    }
    const s = signalCache.get(symUpper);
    markersAllRef.current = s?.markers || [];
    notesAllRef.current = s?.notes || [];
  }, []);

  const renderWindow = useCallback(
    (start, end) => {
      const real = (allBarsRef.current || []).filter((b) => b.time >= start && b.time < end).sort((a, b) => a.time - b.time);

      // 1분 placeholder 채우기
      const filled = [];
      let ri = 0;
      for (let t = start; t < end; t += 60) {
        const r = real[ri];
        if (r && Math.floor(r.time / 60) * 60 === t) {
          filled.push(r);
          ri++;
        } else {
          filled.push({ time: t });
        }
      }
      setDisplayCandles(filled);

      const forMa = sliceWithBuffer(allBarsRef.current || [], start, end, MA_BUF);
      const ma = calcSMAFromCandles(forMa, 100).filter((p) => p.time >= start && p.time < end);
      setMa100(ma);

      const base = (markersAllRef.current || []).filter((x) => x.time >= start && x.time < end);
      const cross = buildCrossMarkers(Array.isArray(crossTimes) ? crossTimes : [], start, end);
      const merged = [...base, ...cross].sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return String(a.text || "").localeCompare(String(b.text || ""));
      });
      setMarkers(merged);

      const nv = (notesAllRef.current || []).filter((n) => {
        const t = Number(n?.timeSec);
        return Number.isFinite(t) && t >= start && t < end;
      }).sort((a, b) => Number(a?.timeSec || 0) - Number(b?.timeSec || 0));
      setNotesView(nv);

      onStats?.(symbol, buildStats(real));
    },
    [crossTimes, onStats, symbol]
  );

  // ✅ 오늘 로드 끝나면 백그라운드로 -1..-7 순차 prefetch
  const prefetchPastDays = useCallback(
    async (symUpper) => {
      // 이미 시작했으면 중복 방지
      if (prefetchedRef.current) return;
      prefetchedRef.current = true;

      // 기존 프리패치 있으면 취소
      try { prefetchAbortRef.current?.abort(); } catch {}
      const ac = new AbortController();
      prefetchAbortRef.current = ac;

      for (let offset = -1; offset >= -7; offset--) {
        if (ac.signal.aborted) return;

        const dayKey = String(offset);
        if (getCachedRows(symUpper, dayKey)) continue;

        const [start, end] = getDayWindowByOffset(anchorEndUtcSec, offset);

        try {
          const rows = await fetchCandlesForWindow(symUpper, "1", start, end, ac.signal);
          if (ac.signal.aborted) return;
          touchCandleCache(symUpper, dayKey, rows);
        } catch (e) {
          if (e?.name === "AbortError") return;
          // prefetch는 실패해도 UX에 치명적이지 않게 조용히
          console.warn(`[CFD prefetch] failed offset=${offset}`, e);
        }
      }
    },
    [anchorEndUtcSec]
  );

  /* -------------------- MAIN LOAD (dayOffset / symbol) -------------------- */
  useEffect(() => {
    if (!Number.isFinite(Number(anchorEndUtcSec))) return;

    const symUpper = symbol.toUpperCase();
    const [start, end] = getDayWindowByOffset(anchorEndUtcSec, dayOffset);
    const dayKey = String(dayOffset);

    const mySeq = ++loadSeqRef.current;

    // UI reset (이전 차트 잔상 제거)
    setLoading(true);
    setVisibleRange({ start, end });
    setDisplayCandles([]);
    setMa100([]);
    setMarkers([]);
    setNotesView([]);

    // dayOffset가 0(오늘)으로 돌아오면 프리패치를 다시 허용하지는 않음(페이지 유지 동안 1회)
    // 만약 "오늘 눌렀을 때마다 다시 프리패치" 원하면 여기서 prefetchedRef.current=false 처리하면 됨.
    // 지금은 1회만 돌리는게 안전.
    // prefetchedRef.current = false; // <- 원하면 활성화

    const cached = getCachedRows(symUpper, dayKey);
    const ac = new AbortController();

    (async () => {
      try {
        await ensureSignals(symUpper);

        // ✅ 캐시 히트면 fetch 없이 즉시 렌더
        if (cached) {
          if (loadSeqRef.current !== mySeq) return;
          allBarsRef.current = rowsToBars(cached);
          renderWindow(start, end);

          // ✅ 오늘이면 캐시여도 프리패치 시작
          if (dayOffset === 0) prefetchPastDays(symUpper);
          return;
        }

        // ✅ 캐시 미스면 fetch
        const rows = await fetchCandlesForWindow(symUpper, "1", start, end, ac.signal);
        if (loadSeqRef.current !== mySeq) return;

        touchCandleCache(symUpper, dayKey, rows);
        allBarsRef.current = rowsToBars(rows);
        renderWindow(start, end);

        // ✅ 오늘이면 fetch 끝난 직후 프리패치
        if (dayOffset === 0) prefetchPastDays(symUpper);
      } catch (e) {
        if (e?.name === "AbortError") return; // dev StrictMode / 빠른 이동 정상
        console.error("[CFD] load failed:", e);
      } finally {
        if (loadSeqRef.current === mySeq) setLoading(false);
      }
    })();

    return () => {
      try { ac.abort(); } catch {}
    };
  }, [symbol, dayOffset, anchorEndUtcSec, ensureSignals, renderWindow, prefetchPastDays]);

  /* -------------------- WS (현재 window만 갱신) -------------------- */
  useEffect(() => {
    const tTopic = `tickers.${symbol}`;
    const kTopic = `kline.1.${symbol}`;
    const topics = [tTopic, kTopic];

    try { wsHub.subscribe?.(topics); } catch {}

    const offT = wsHub.addListener?.(tTopic, (d) => {
      const bid = Number(d?.bid1Price ?? d?.bid);
      const ask = Number(d?.ask1Price ?? d?.ask);
      const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
      const last = Number(d?.lastPrice ?? d?.last ?? d?.price);
      const px = Number.isFinite(mid) ? mid : last;
      if (!Number.isFinite(px)) return;
      onStats?.(symbol, { price: px });
    });

    const offK = wsHub.addListener?.(kTopic, (d) => {
      const vr = visibleRange;
      if (!vr?.start || !vr?.end) return;

      const rawStart = Number(d?.start);
      const o = Number(d?.open);
      const h = Number(d?.high);
      const l = Number(d?.low);
      const c = Number(d?.close);

      const startMsUtc = Number.isFinite(rawStart) ? (rawStart < 2e10 ? rawStart * 1000 : rawStart) : NaN;
      if (!Number.isFinite(startMsUtc) || ![o, h, l, c].every(Number.isFinite)) return;

      const bar = { time: Math.floor(startMsUtc / 1000), open: o, high: h, low: l, close: c };
      allBarsRef.current = mergeBars(allBarsRef.current || [], bar);

      // 현재 윈도우만 다시 렌더
      renderWindow(vr.start, vr.end);
    });

    return () => {
      try { wsHub.unsubscribe?.(topics); } catch {}
      try { offT?.(); } catch {}
      try { offK?.(); } catch {}
    };
  }, [wsHub, symbol, onStats, visibleRange, renderWindow]);

  // 컴포넌트 unmount 시 prefetch 중이면 취소
  useEffect(() => {
    return () => {
      try { prefetchAbortRef.current?.abort(); } catch {}
    };
  }, []);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 20, opacity: 0.8, marginBottom: 6 }}>
        {symbol}
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.65 }}>
          (dayOffset: {dayOffset})
        </span>
      </div>

      <div style={{ width: 800, maxWidth: "100%", position: "relative" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
              fontWeight: 800,
              borderRadius: 12,
              backdropFilter: "blur(2px)",
            }}
          >
            로딩중...
          </div>
        )}

        <ChartView
          width={800}
          height={320}
          tickFormatter={(ts) => fmtKSTHour(ts)}
          displayCandles={displayCandles}
          ma100={ma100}
          thr={thr}
          markers={markers}
          visibleRange={visibleRange}
        />

        <SignalNotesPanel
          symbol={symbol}
          notes={notesView}
          getPriceText={(n) => (n.price != null ? fmtComma(n.price) : "—")}
          collapseKey={`${symbol}:${dayOffset}`}
        />
      </div>
    </div>
  );
}