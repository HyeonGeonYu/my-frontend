// src/components/common/ChartPanelCore/useCoreCandles.js
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  sliceWithBuffer,
  calcSMA,
  calcRollingMaSd,
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
import { bandHistGet, bandHistSet } from "../../../lib/bandHistCache";

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
  // ✅ v4(1분봉책): 슬롯별 {k, w(분)} — s1Long/s1Short=S11(실선), s2Long/s2Short=S12(점선).
  //   심볼×방향별 MA창(6~24h)이 달라 win별 롤링 MA·σ를 각각 계산. 없으면 밴드 비활성(캔들만).
  bandSpec,

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
  const [maSd, setMaSd] = useState([]); // ✅ 최단 win 롤링 {time, ma, sd} — 배지/앵커 판단용
  const [bandData, setBandData] = useState(null); // ✅ 슬롯별 사전계산 밴드 {ma, s1Long, ...}
  const [bandLoading, setBandLoading] = useState(false); // ✅ 밴드 히스토리 백필 진행중
  const [markers, setMarkers] = useState([]);
  const [visibleRange, setVisibleRange] = useState(null);

  // ⚠️ bandSpec 참조 안정화 — 호출측이 렌더마다 새 객체를 넘겨도 내용이 같으면 같은 참조 유지.
  //   (참조가 흔들리면 renderWindow→로드 effect가 매 렌더 재실행 → 무한 refetch 폭주)
  const bandSpecKey = JSON.stringify(bandSpec || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spec = useMemo(() => bandSpec || null, [bandSpecKey]);

  // 밴드 스펙에서 창 크기(분) 파생 — 백필 버퍼/충분조건에 사용.
  //   z 슬롯의 w(분)와 fade 트리거의 m(분) 중 최댓값만큼 과거봉 필요.
  const bandsEnabled = !!(spec && Object.keys(spec).length);
  const maxWin = useMemo(() => {
    if (!bandsEnabled) return 0;
    const wins = Object.entries(spec).map(([slot, d]) =>
      slot === "fade" ? Number(d.m) || 0 : Number(d.w) || 0
    );
    return Math.max(...wins, 0);
  }, [spec, bandsEnabled]);

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

      // ✅ z-score 밴드 — 슬롯별 win(분)이 달라 win별 롤링 MA·σ 각각 계산 → bandData.
      if (bandsEnabled) {
        const forBand = sliceWithBuffer(arrAll, start, end, maxWin);
        const msByWin = new Map();
        const msFor = (w) => {
          if (!msByWin.has(w)) {
            msByWin.set(w, calcRollingMaSd(forBand, w).filter((p) => p.time >= start && p.time < end));
          }
          return msByWin.get(w);
        };
        const bd = {};
        const zSlots = Object.entries(spec).filter(([slot]) => slot !== "fade");
        for (const [slot, d] of zSlots) {
          const sign = (slot === "s1Long" || slot === "s2Short") ? +1 : -1; // z≥+K1 슬롯=위 밴드
          bd[slot] = msFor(Number(d.w)).map((p) => ({ time: p.time, value: p.ma + sign * Number(d.k) * p.sd }));
        }
        // 급락페이드 트리거선: 각 시점 t의 트리거가 = close(t − m분) × (1 − drop).
        //   현재가가 이 선 이하로 떨어지면 페이드 롱 트리거(쿨다운 별개).
        if (spec.fade) {
          const mSec = Number(spec.fade.m) * 60;
          const dropMul = 1 - Number(spec.fade.drop);
          const closeByTime = new Map();
          for (const b of forBand) if (Number.isFinite(b?.close)) closeByTime.set(b.time, b.close);
          const line = [];
          for (const b of forBand) {
            if (b.time < start || b.time >= end) continue;
            const past = closeByTime.get(b.time - mSec);
            if (Number.isFinite(past)) line.push({ time: b.time, value: past * dropMul });
          }
          bd.fade = line;
        }
        if (zSlots.length) {
          const minWin = Math.min(...zSlots.map(([, d]) => Number(d.w) || Infinity));
          const msMin = msFor(minWin);
          bd.ma = msMin.map((p) => ({ time: p.time, value: p.ma })); // 회색 앵커 = 최단 창 MA
          setMaSd(msMin); // 배지(로딩중/데이터부족) 판단용
        } else {
          bd.ma = [];
          setMaSd(bd.fade || []); // fade 전용 심볼: 배지 판단은 fade 라인 존재로
        }
        setBandData(bd);
      } else {
        setBandData(null);
        setMaSd([]);
      }

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

      onStats?.(symbol, {price: lastClose, ma100: ma100Latest, chg3mPct, priceScale: autoDigits});
    },
    [getMarkersForWindow, getNotesForWindow, onStats, symbol, autoDigits, spec, bandsEnabled, maxWin]
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
    setMaSd([]);
    setBandLoading(!!bandsEnabled); // 밴드 켜진 심볼이면 일단 '로딩중'으로 시작(아래 백필 끝나면 false)
    setMarkers([]);

    const cached = source.getCachedRows(symUpper, dayKey);
    const ac = new AbortController();

    // ✅ z-band 히스토리 백필 (공용) — 닫힌 과거봉은 IndexedDB 캐시(TTL 8일)에서 먼저 시도,
    //   미스일 때만 REST fetch. 버퍼는 심볼의 최대 win(분) 기준(v4: 6~24h — 구 7일 대비 대폭 축소).
    const backfillBands = async () => {
      try {
        const beforeCnt = (allBarsRef.current || []).filter((b) => b.time < start).length;
        if (beforeCnt >= maxWin) return;

        const cacheKey = `${sourceKey}:${symUpper}:hist:${start}:${maxWin}`;
        const histStart = start - maxWin * 60;

        let histBars = await bandHistGet(cacheKey);
        if (loadSeqRef.current !== mySeq) return;

        if (!histBars) {
          const histRows = await source.fetchWindow(symUpper, "1", start, end, ac.signal, maxWin);
          if (loadSeqRef.current !== mySeq) return;
          histBars = rowsToBars(histRows);
          // 닫힌 과거봉([start-maxWin, start))만 캐시 — 불변이라 TTL 만료 전까지 재사용 안전.
          //   부분 실패 방어: 절반 이상 확보됐을 때만 저장(휴장 갭은 절반 미만으로 안 떨어짐).
          const closed = histBars.filter((b) => b.time >= histStart && b.time < start);
          if (closed.length >= maxWin * 0.5) bandHistSet(cacheKey, closed);
          try { source.touchCandleCache?.(symUpper, dayKey, histRows); } catch {}
        }

        // ⚠️ mergeBars는 '과거' 봉을 버림(append/update 전용) → time 기준 union으로 병합.
        const byTime = new Map();
        for (const b of (allBarsRef.current || [])) byTime.set(b.time, b);
        for (const b of histBars) byTime.set(b.time, b);
        let merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
        if (merged.length > MAX_1M_BARS) merged = merged.slice(-MAX_1M_BARS);
        allBarsRef.current = merged;
        renderWindow(start, end, true);
      } catch (e) {
        if (e?.name !== "AbortError") console.warn("[ChartPanelCore band-backfill] failed:", symUpper, e);
      } finally {
        if (loadSeqRef.current === mySeq) setBandLoading(false);
      }
    };

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

          // ✅ z-band 백필: 캐시(prefetch=99봉 버퍼)는 7일 σ를 못 그림 → 공용 backfillBands(IndexedDB 캐시 우선).
          if (bandsEnabled) backfillBands();

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

        // ✅ 캔들은 작은 버퍼로 빨리 받아 즉시 표시(무거운 7일 fetch가 캔들을 막지 않게).
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

        renderWindow(start, end, true);  // 캔들 즉시 표시 (밴드는 아래 백그라운드로)

        // ✅ z-band 7일 히스토리는 백그라운드 백필 — 캔들 표시를 막지 않음(IndexedDB 캐시 우선).
        if (bandsEnabled) backfillBands();

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
    bandsEnabled,
    maxWin,
    sourceKey,
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
    maSd,
    bandData,
    bandLoading,
    markers,
    visibleRange,
    autoDigits,
    getPriceText,
  };
}