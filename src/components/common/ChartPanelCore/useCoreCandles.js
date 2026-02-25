// src/components/common/ChartPanelCore/useCoreCandles.js
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  sliceWithBuffer,
  calcSMA,
  calcLatestMAValue,
  mergeBars,
  fmtComma,
} from "../../../lib/tradeUtils";

import {
  MA_BUF,
  MAX_1M_BARS,
  digitsCache,
  clampDigits,
  inferDigitsFromRows,
  inferDigitsFromBar,
  getDayWindowByOffset,
  rowsToBars,
  normalizeCachedToBars,
} from "./coreUtils";

// ✅ catch-up (stale cache tail backfill)
const CATCHUP_LOOKBACK_SEC = 2 * 3600; // 최근 2시간만 재조회해서 꼬리(backfill) 채움
const CATCHUP_STALE_SEC = 5 * 60; // 마지막 캔들이 5분 이상 뒤쳐지면 stale로 판단
const CATCHUP_THROTTLE_MS = 30_000; // 30초 이내 중복 fetch 방지

export default function useCoreCandles({
  // identity
  source,
  symbol,
  dayOffset,
  anchorEndUtcSec,

  // UI/Behavior
  bounds,

  // overrides
  priceScale,

  // signals injection
  ensureSignals,
  getMarkersForWindow,
  getNotesForWindow,

  // callbacks
  onBounds,
  onStats,
}) {
  const wsHub = source?.wsHub;

  const allBarsRef = useRef([]);
  const lastCatchupMsRef = useRef(0);
  const prefetchedRef = useRef(false);
  const prefetchAbortRef = useRef(null);
  const loadSeqRef = useRef(0);

  const [loading, setLoading] = useState(false);

  const [notesView, setNotesView] = useState([]);
  const [displayCandles, setDisplayCandles] = useState([]);
  const [ma100, setMa100] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [visibleRange, setVisibleRange] = useState(null);

  // WS에서 stale 방지
  const visibleRangeRef = useRef(null);
  useEffect(() => {
    visibleRangeRef.current = visibleRange;
  }, [visibleRange]);

  // bounds 전달
  useEffect(() => {
    const b = {min: Number(bounds?.min ?? -7), max: Number(bounds?.max ?? 0)};
    onBounds?.(symbol, b);
  }, [onBounds, symbol, bounds?.min, bounds?.max]);

  // symbol/source 바뀌면 prefetch 상태/진행중 작업 리셋
  useEffect(() => {
    prefetchedRef.current = false;
    try {
      prefetchAbortRef.current?.abort?.();
    } catch {}
  }, [symbol, source]);

  /** ✅ key for digits cache */
  const sourceKey = source?.key || source?.name || source?.id || "src";
  const digitsKey = useMemo(
    () => `${sourceKey}|${String(symbol || "").toUpperCase()}`,
    [sourceKey, symbol]
  );

  /** ✅ digits state (rows-first) */
  const [autoDigits, setAutoDigits] = useState(() => {
    const ov = clampDigits(priceScale);
    if (Number.isFinite(ov)) return ov;
    const cached = digitsCache.get(digitsKey);
    return Number.isFinite(cached) ? cached : 2;
  });

  // override가 있으면 즉시 적용
  useEffect(() => {
    const ov = clampDigits(priceScale);
    if (Number.isFinite(ov)) {
      digitsCache.set(digitsKey, ov);
      setAutoDigits(ov);
    }
  }, [priceScale, digitsKey]);

  /** ✅ unified price text formatter for notes */
  const getPriceText = useCallback(
    (n) => (n?.price != null ? fmtComma(Number(n.price), autoDigits) : "—"),
    [autoDigits]
  );

  const renderWindow = useCallback(
    (start, end, resetRange = false) => {
      if (resetRange) setVisibleRange({start, end});
      else setVisibleRange((prev) => prev || {start, end});

      const arrAll = allBarsRef.current || [];
      const real = arrAll.filter((b) => b.time >= start && b.time < end).sort((a, b) => a.time - b.time);

      // ✅ full fill (시각용)
      const filled = [];
      let ri = 0;
      for (let t = start; t < end; t += 60) {
        const r = real[ri];
        if (r && Math.floor(r.time / 60) * 60 === t) {
          filled.push(r);
          ri++;
        } else {
          filled.push({time: t});
        }
      }
      setDisplayCandles(filled);

      // ✅ MA series
      const forMa = sliceWithBuffer(arrAll, start, end, MA_BUF);
      const ma = calcSMA(forMa, 100).filter((p) => p.time >= start && p.time < end);
      setMa100(ma);

      // ✅ markers (signals hook 주입)
      try {
        const mm = typeof getMarkersForWindow === "function" ? getMarkersForWindow(start, end) : [];
        setMarkers(mm);
      } catch {
        setMarkers([]);
      }

      // ✅ notes (signals hook 주입)
      try {
        const nn = typeof getNotesForWindow === "function" ? getNotesForWindow(start, end) : [];
        setNotesView(nn);
      } catch {
        setNotesView([]);
      }

      // ✅ stats
      const lastClose = real.length ? real[real.length - 1].close : null;
      const ma100Latest = calcLatestMAValue(real, 100);

      const prev3 = real.length >= 3 ? real[real.length - 3].close : null;
      const chg3mPct = prev3 && lastClose != null ? ((lastClose - prev3) / prev3) * 100 : null;

      onStats?.(symbol, {ma100: ma100Latest, chg3mPct, priceScale: autoDigits});
    },
    [getMarkersForWindow, getNotesForWindow, onStats, symbol, autoDigits]
  );

  // ✅ prefetch
  const prefetchPastDays = useCallback(
    async (symUpper) => {
      if (prefetchedRef.current) return;
      prefetchedRef.current = true;

      try {
        prefetchAbortRef.current?.abort?.();
      } catch {}

      const ac = new AbortController();
      prefetchAbortRef.current = ac;

      const minOffset = Number(bounds?.min ?? -7);

      for (let offset = -1; offset >= minOffset; offset--) {
        if (ac.signal.aborted) return;

        const dayKey = String(offset);
        if (source.getCachedRows(symUpper, dayKey)) continue;

        const [start, end] = getDayWindowByOffset(anchorEndUtcSec, offset);

        try {
          const rows = await source.fetchWindow(symUpper, "1", start, end, ac.signal, MA_BUF);
          if (ac.signal.aborted) return;

          // ✅ digits cache warm
          const ov = clampDigits(priceScale);
          if (!Number.isFinite(ov)) {
            const prev = digitsCache.get(digitsKey) ?? 2;
            const d = inferDigitsFromRows(rows, prev);
            digitsCache.set(digitsKey, Math.max(prev, d));
          }

          source.touchCandleCache(symUpper, dayKey, rows);
        } catch (e) {
          if (e?.name === "AbortError") return;
          console.warn("[ChartPanelCore prefetch] failed:", symUpper, offset, e);
        }
      }
    },
    [anchorEndUtcSec, bounds?.min, source, digitsKey, priceScale]
  );

  // ✅ MAIN LOAD
  useEffect(() => {
    if (!Number.isFinite(Number(anchorEndUtcSec))) return;
    if (!source) return;

    const symUpper = String(symbol || "").toUpperCase();
    const [start, end] = getDayWindowByOffset(anchorEndUtcSec, dayOffset);
    const dayKey = String(dayOffset);

    const mySeq = ++loadSeqRef.current;

    setLoading(true);
    setVisibleRange({start, end});
    setNotesView([]);
    setDisplayCandles([]);
    setMa100([]);
    setMarkers([]);

    const cached = source.getCachedRows(symUpper, dayKey);
    const ac = new AbortController();

    (async () => {
      try {
        // ✅ signals 먼저
        if (typeof ensureSignals === "function") {
          await ensureSignals(symUpper);
          if (loadSeqRef.current !== mySeq) return;
        }

        const ov = clampDigits(priceScale);

        if (cached) {
          // ✅ digits 확정 (rows-first)
          if (!Number.isFinite(ov)) {
            const prev = digitsCache.get(digitsKey) ?? 2;
            const d = Array.isArray(cached?.[0]) ? inferDigitsFromRows(cached, prev) : prev;
            const nextD = Math.max(prev, d);
            digitsCache.set(digitsKey, nextD);
            setAutoDigits((p) => Math.max(Number.isFinite(p) ? p : 0, nextD));
            onStats?.(symbol, {priceScale: nextD});
          } else {
            digitsCache.set(digitsKey, ov);
            setAutoDigits(ov);
            onStats?.(symbol, {priceScale: ov});
          }

          allBarsRef.current = normalizeCachedToBars(cached);
          renderWindow(start, end, true);

          // ✅ today(0) 캐시가 stale이면 tail catch-up
          if (dayOffset === 0) {
            const nowSec = Math.floor(Date.now() / 1000);

            const bars0 = allBarsRef.current || [];
            const lastTime = bars0.length ? Number(bars0[bars0.length - 1].time) : null;

            const expectedLatest = Math.min(end - 60, nowSec - (nowSec % 60));

            const stale =
              Number.isFinite(lastTime) &&
              expectedLatest >= start &&
              expectedLatest < end &&
              expectedLatest - lastTime > CATCHUP_STALE_SEC;

            const canRun = Date.now() - (lastCatchupMsRef.current || 0) > CATCHUP_THROTTLE_MS;

            if (stale && canRun) {
              lastCatchupMsRef.current = Date.now();

              const from = Math.max(start - MA_BUF * 60, lastTime - CATCHUP_LOOKBACK_SEC);
              const to = end;

              (async () => {
                try {
                  const tailRows = await source.fetchWindow(symUpper, "1", from, to, ac.signal, MA_BUF);
                  if (loadSeqRef.current !== mySeq) return;

                  let merged = allBarsRef.current || [];
                  const tailBars = rowsToBars(tailRows);

                  for (const b of tailBars) merged = mergeBars(merged, b);
                  if (merged.length > MAX_1M_BARS) merged = merged.slice(-MAX_1M_BARS);

                  allBarsRef.current = merged;

                  // ✅ 캐시도 최신 tailRows로 갱신
                  try {
                    source.touchCandleCache?.(symUpper, dayKey, tailRows);
                  } catch {}

                  renderWindow(start, end, true);

                  if (merged.length) {
                    onStats?.(symbol, {price: merged[merged.length - 1].close});
                  }
                } catch (e) {
                  if (e?.name === "AbortError") return;
                  console.warn("[ChartPanelCore catchup] failed:", symUpper, e);
                }
              })();
            }
          }

          if (dayOffset === 0) prefetchPastDays(symUpper);
          return;
        }

        const rows = await source.fetchWindow(symUpper, "1", start, end, ac.signal, MA_BUF);
        if (loadSeqRef.current !== mySeq) return;

        // ✅ rows 기반 digits 확정
        if (!Number.isFinite(ov)) {
          const prev = digitsCache.get(digitsKey) ?? 2;
          const d = inferDigitsFromRows(rows, prev);
          const nextD = Math.max(prev, d);
          digitsCache.set(digitsKey, nextD);
          setAutoDigits((p) => Math.max(Number.isFinite(p) ? p : 0, nextD));
          onStats?.(symbol, {priceScale: nextD});
        } else {
          digitsCache.set(digitsKey, ov);
          setAutoDigits(ov);
          onStats?.(symbol, {priceScale: ov});
        }

        source.touchCandleCache(symUpper, dayKey, rows);

        let bars = rowsToBars(rows);
        if (bars.length > MAX_1M_BARS) bars = bars.slice(-MAX_1M_BARS);
        allBarsRef.current = bars;

        renderWindow(start, end, true);

        if (dayOffset === 0) prefetchPastDays(symUpper);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error("[ChartPanelCore] load failed:", e);
      } finally {
        if (loadSeqRef.current === mySeq) setLoading(false);
      }
    })();

    return () => {
      try {
        ac.abort();
      } catch {}
    };
  }, [
    symbol,
    dayOffset,
    anchorEndUtcSec,
    ensureSignals,
    renderWindow,
    prefetchPastDays,
    source,
    digitsKey,
    priceScale,
    onStats,
  ]);

  // ✅ WS
  useEffect(() => {
    if (!wsHub || !source) return;

    const topics = source.topics(symbol);
    const cleanups = [];

    try {
      wsHub.subscribe?.(topics);
    } catch {}
    cleanups.push(() => {
      try {
        wsHub.unsubscribe?.(topics);
      } catch {}
    });

    const offs = topics.map((tp) =>
      wsHub.addListener?.(tp, (d) => {
        const ev = source.normalizeWs(tp, d);
        if (!ev) return;

        if (ev.type === "price") {
          onStats?.(symbol, {price: ev.price, priceScale: autoDigits});
          return;
        }

        if (ev.type === "kline") {
          const vr = visibleRangeRef.current;
          if (!vr?.start || !vr?.end) return;

          const bar = ev.bar;
          if (bar.time < vr.start - MA_BUF * 60 || bar.time >= vr.end) return;

          // ✅ WS bar로 digits 상향 보정(필요 시)
          const ov = clampDigits(priceScale);
          if (!Number.isFinite(ov)) {
            const d2 = inferDigitsFromBar(bar);
            if (Number.isFinite(d2) && d2 > autoDigits) {
              digitsCache.set(digitsKey, d2);
              setAutoDigits(d2);
              onStats?.(symbol, {priceScale: d2});
            }
          }

          let arr = mergeBars(allBarsRef.current || [], bar);
          if (arr.length > MAX_1M_BARS) arr = arr.slice(-MAX_1M_BARS);
          allBarsRef.current = arr;

          renderWindow(vr.start, vr.end, true);

          onStats?.(symbol, {price: bar.close, priceScale: autoDigits});
        }
      })
    );

    cleanups.push(() => {
      offs.forEach((off) => {
        try {
          off?.();
        } catch {}
      });
    });

    return () => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [wsHub, source, symbol, renderWindow, onStats, autoDigits, digitsKey, priceScale]);

  // unmount 시 prefetch 취소
  useEffect(() => {
    return () => {
      try {
        prefetchAbortRef.current?.abort?.();
      } catch {}
    };
  }, []);

  return {
    loading,
    notesView,
    displayCandles,
    ma100,
    markers,
    visibleRange,
    autoDigits,
    getPriceText,
  };
}