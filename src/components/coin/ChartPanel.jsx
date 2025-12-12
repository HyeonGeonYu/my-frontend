// src/components/coin/ChartPanel.jsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createChart } from "lightweight-charts";

import {
  fmtKSTFull,
  fmtKSTHour,
  fmtKSTMonth,
  fmtKSTHMS,
  getTs,
  sliceWithBuffer,
  calcSMA,
  calcLatestMAValue,
  mergeBars,
  fetchAllKlines,
  fetchSignals,
  buildSignalAnnotations,
  getWsHub,
  next0650EndBoundaryUtcSec,
  genMinutePlaceholders,
  fmtComma,
} from "../../lib/tradeUtils";

// "YYYY-MM-DD HH:MM:SS" 를 KST(+09:00) 기준 초단위로
function parseKstToEpochSec(s) {
  if (!s) return NaN;
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const withTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}+09:00`;
  const t = Date.parse(withTz);
  return Number.isFinite(t) ? Math.floor(t / 1000) : NaN;
}

// cross_times -> lightweight-charts markers
function buildCrossMarkers(crossTimesArr, fromSec, toSec) {
  if (!Array.isArray(crossTimesArr) || crossTimesArr.length === 0) return [];
  const MARKER_COLOR = "#a78bfa";

  const items = crossTimesArr
    .map((c, idx) => ({
      idx: idx + 1,
      dir: String(c.dir || "").toUpperCase(),
      ts: c.time ? parseKstToEpochSec(String(c.time)) : NaN,
    }))
    .filter((x) => Number.isFinite(x.ts))
    .sort((a, b) => a.ts - b.ts);

  const out = [];
  for (const it of items) {
    if (it.ts < fromSec || it.ts >= toSec) continue;
    out.push({
      time: it.ts,
      position: it.dir === "UP" ? "aboveBar" : "belowBar",
      shape: "circle",
      color: MARKER_COLOR,
      text: String(it.idx),
    });
  }
  return out;
}

export default function ChartPanel({
  symbol,
  globalInterval,
  dayOffset,
  onBounds,
  onStats,
  thr,
  crossTimes,
  signalName,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const maSeriesRef = useRef(null);
  const maUpperSeriesRef = useRef(null);
  const maLowerSeriesRef = useRef(null);

  const allBarsRef = useRef([]);
  const dailyBarsRef = useRef([]);
  const markersAllRef = useRef([]);
  const notesAllRef = useRef([]);

  const [notesView, setNotesView] = useState([]);
  const [notesCollapsed, setNotesCollapsed] = useState(true);

  const versionRef = useRef(0);
  const dayOffsetRef = useRef(dayOffset);
const wsHub = useRef(getWsHub("wss://stream.bybit.com/v5/public/linear")).current;

  useEffect(() => setNotesCollapsed(true), [dayOffset]);
  useEffect(() => { dayOffsetRef.current = dayOffset; }, [dayOffset]);

  const getDayWindowByOffset = useCallback((offsetDays = 0) => {
    const end = next0650EndBoundaryUtcSec() + offsetDays * 86400;
    return [end - 86400, end];
  }, []);

  const renderDayWindow = useCallback(
    (arrAll, resetRange = false) => {
      if (!chartRef.current || !seriesRef.current) return;

      const [start, end] = getDayWindowByOffset(dayOffsetRef.current);

      const real = (arrAll || []).filter((b) => b.time >= start && b.time < end);

      const firstRealTime = real.length ? real[0].time : end;
      const prefixEnd = Math.min(firstRealTime, end);
      const prefixPlaceholders = prefixEnd > start ? genMinutePlaceholders(start, prefixEnd) : [];

      const nowSec = Math.floor(Date.now() / 1000);
      const placeStart = Math.max(nowSec + 60, (real.at(-1)?.time ?? start) + 60);
      const placeholders = placeStart < end ? genMinutePlaceholders(placeStart, end) : [];

      const priceSlice = prefixPlaceholders.concat(real, placeholders);

      const forMa = sliceWithBuffer(arrAll, start, end, 99);
      const ma100 = calcSMA(forMa, 100).filter((p) => p.time >= start && p.time < end);

      seriesRef.current?.setData(priceSlice);
      maSeriesRef.current?.setData(ma100);

      if (typeof thr === "number" && isFinite(thr) && thr > 0) {
        maUpperSeriesRef.current?.setData(ma100.map((p) => ({ time: p.time, value: p.value * (1 + thr) })));
        maLowerSeriesRef.current?.setData(ma100.map((p) => ({ time: p.time, value: p.value * (1 - thr) })));
      } else {
        maUpperSeriesRef.current?.setData([]);
        maLowerSeriesRef.current?.setData([]);
      }

      if (resetRange) {
        try {
          chartRef.current?.timeScale?.()?.setVisibleRange({ from: start, to: end - 60 });
        } catch {}
      }

      const base = (markersAllRef.current || []).filter((x) => x.time >= start && x.time < end);
      const cross = buildCrossMarkers(crossTimes || [], start, end);

      const m = [...base, ...cross].sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return String(a.text || "").localeCompare(String(b.text || ""));
      });

      const n = (notesAllRef.current || []).filter((x) => x.timeSec >= start && x.timeSec < end);

      seriesRef.current.setMarkers(m);
      setNotesView(n);
    },
    [getDayWindowByOffset, thr, crossTimes]
  );

  const CHART_HEIGHT = 320;
  const CHART_WIDTH = 800;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const myVersion = ++versionRef.current;
    const cleanups = [];

    try { chartRef.current?.remove(); } catch {}
    chartRef.current = null;
    seriesRef.current = null;
    maSeriesRef.current = null;

    markersAllRef.current = [];
    notesAllRef.current = [];
    setNotesView([]);

    const chart = createChart(el, {
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      autoSize: false,
      layout: { background: { color: "#111" }, textColor: "#ddd" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (t) => {
          const ts = typeof t === "number" ? t : t?.timestamp ? t.timestamp : 0;
          return globalInterval === "D" ? fmtKSTMonth(ts) : fmtKSTHour(ts);
        },
        lockVisibleTimeRangeOnResize: true,
        fixLeftEdge: true,
      },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      localization: { timeFormatter: (t) => fmtKSTFull(getTs(t)) },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisDoubleClickReset: false, axisPressedMouseMove: false, mouseWheel: false, pinch: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#2fe08d",
      downColor: "#ff6b6b",
      borderUpColor: "#2fe08d",
      borderDownColor: "#ff6b6b",
      wickUpColor: "#2fe08d",
      wickDownColor: "#ff6b6b",
    });
    const maSeries = chart.addLineSeries({ lineWidth: 2, priceLineVisible: false, lastValueVisible: true, color: "#ffd166" });
    const maUpperSeries = chart.addLineSeries({ lineWidth: 1, priceLineVisible: false, lastValueVisible: false, color: "#9ca3af" });
    const maLowerSeries = chart.addLineSeries({ lineWidth: 1, priceLineVisible: false, lastValueVisible: false, color: "#9ca3af" });

    if (versionRef.current !== myVersion) {
      chart.remove();
      return;
    }

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    maSeriesRef.current = maSeries;
    maUpperSeriesRef.current = maUpperSeries;
    maLowerSeriesRef.current = maLowerSeries;

    const MAX_1M_BARS = 43200;

    (async () => {
      try {
        const limit = globalInterval === "1" ? 8 * 1440 : 1000;
        const bars = await fetchAllKlines(symbol, globalInterval, limit);
        if (versionRef.current !== myVersion) return;

        const sigs = await fetchSignals(symbol, signalName || "bybit").catch(() => []);
        const { markers, notes } = buildSignalAnnotations(sigs);

        markersAllRef.current = markers;
        notesAllRef.current = notes;

        if (globalInterval === "1") {
          allBarsRef.current = bars;
          renderDayWindow(allBarsRef.current, false);

          const lastCloseAll = bars.length ? bars[bars.length - 1].close : null;
          const lastMaAll = calcLatestMAValue(bars, 100);

          const prev3 = bars.length >= 3 ? bars[bars.length - 3].close : null;
          const chg3mPct = prev3 && lastCloseAll != null ? ((lastCloseAll - prev3) / prev3) * 100 : null;

          onStats?.(symbol, { price1m: lastCloseAll, ma100_1m: lastMaAll, chg3mPct });
          onBounds?.(symbol, { min: -7, max: 0 });

          const TOPIC_1M = `kline.1.${symbol}`;
          const off1m = wsHub.addListener(TOPIC_1M, (d) => {
            const bar = {
              time: Math.floor(Number(d.start) / 1000),
              open: +d.open,
              high: +d.high,
              low: +d.low,
              close: +d.close,
            };

            let arr = mergeBars(allBarsRef.current || [], bar);
            if (arr.length > MAX_1M_BARS) arr = arr.slice(-MAX_1M_BARS);
            allBarsRef.current = arr;

            renderDayWindow(allBarsRef.current, true);

            const lastClose = arr.length ? arr[arr.length - 1].close : null;
            const lastMa = calcLatestMAValue(arr, 100);

            const prev3m = arr.length >= 3 ? arr[arr.length - 3].close : null;
            const chg3m = prev3m && lastClose != null ? ((lastClose - prev3m) / prev3m) * 100 : null;

            onStats?.(symbol, { price1m: lastClose, ma100_1m: lastMa, chg3mPct: chg3m });
          });

          cleanups.push(off1m);
        } else {
          dailyBarsRef.current = bars;
          candleSeries.setData(bars);
          maSeries.setData(calcSMA(bars, 100));
          chart.timeScale().fitContent();

          const lastCloseD = bars.length ? bars[bars.length - 1].close : null;
          const lastMaD = calcLatestMAValue(bars, 100);
          onStats?.(symbol, { priceD: lastCloseD, ma100_D: lastMaD });

          const TOPIC_1D = `kline.D.${symbol}`;
          const off1d = wsHub.addListener(TOPIC_1D, (d) => {
            const bar = {
              time: Math.floor(Number(d.start) / 1000),
              open: +d.open,
              high: +d.high,
              low: +d.low,
              close: +d.close,
            };

            dailyBarsRef.current = mergeBars(dailyBarsRef.current || [], bar);
            seriesRef.current?.update(bar);
            maSeriesRef.current?.setData(calcSMA(dailyBarsRef.current, 100));

            const lastClose = dailyBarsRef.current.length ? dailyBarsRef.current[dailyBarsRef.current.length - 1].close : null;
            const lastMa = calcLatestMAValue(dailyBarsRef.current, 100);
            onStats?.(symbol, { priceD: lastClose, ma100_D: lastMa });
          });

          cleanups.push(off1d);
        }
      } catch (e) {
        console.error("[REST] failed", e);
      }
    })();

    return () => {
      cleanups.forEach((fn) => { try { fn(); } catch {} });
      try { chart.remove(); } catch {}
    };
  }, [symbol, globalInterval, signalName, onBounds, onStats, renderDayWindow]);

  useEffect(() => {
    if (!seriesRef.current || globalInterval !== "1") return;
    if (chartRef.current && allBarsRef.current?.length) renderDayWindow(allBarsRef.current, true);
  }, [dayOffset, globalInterval, renderDayWindow]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 20, opacity: 0.8, marginBottom: 6 }}>{symbol}</div>

      <div
        ref={wrapRef}
        style={{
          width: CHART_WIDTH,
          height: CHART_HEIGHT,
          borderRadius: 12,
          overflow: "hidden",
          background: "#111",
        }}
      />

      <div
        style={{
          marginTop: 10,
          background: "#161616",
          border: "1px solid #262626",
          borderRadius: 12,
          padding: "10px 12px",
          width: CHART_WIDTH,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.9 }}>
            {symbol} · 시그널 설명 ({notesView.length})
          </div>
          <button
            onClick={() => setNotesCollapsed((v) => !v)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #2a2a2a",
              background: "#1f1f1f",
              color: "#ddd",
              fontSize: 12,
              cursor: "pointer",
            }}
            title={notesCollapsed ? "펼치기" : "접기"}
          >
            {notesCollapsed ? "펼치기 ⌄" : "접기 ⌃"}
          </button>
        </div>

        {notesCollapsed ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }} />
        ) : notesView.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>시그널 없음</div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {notesView.map((n) => {
              const side = String(n.side || "").toUpperCase();
              const kind = String(n.kind || "").toUpperCase();
              const sideColor = side === "LONG" ? "#16a34a" : side === "SHORT" ? "#dc2626" : "#9ca3af";

              const priceTxt = n.price != null ? fmtComma(n.price) : "—";
              const timeTxt = n.timeSec ? fmtKSTHMS(n.timeSec) : "";
              const reasonsTxt = n.reasons?.length ? `${n.reasons.join(", ")}` : "";

              return (
                <div key={n.key} style={{ padding: "8px 10px", borderRadius: 10, background: "#1b1b1b", border: "1px solid #2a2a2a" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "6ch 9ch 8ch 9ch 14ch 1fr",
                      columnGap: 12,
                      alignItems: "baseline",
                      fontSize: 12,
                      lineHeight: 1.5,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontVariantNumeric: "tabular-nums",
                    }}
                    title={[
                      `#${n.seq}`,
                      timeTxt,
                      side,
                      kind,
                      priceTxt,
                      fmtKSTFull(n.timeSec),
                      reasonsTxt,
                    ].filter(Boolean).join(" · ")}
                  >
                    <b style={{ opacity: 0.95 }}>#{n.seq}</b>
                    <span>{timeTxt}</span>
                    <span style={{ color: sideColor, fontWeight: 700 }}>{side}</span>
                    <span style={{ opacity: 0.85 }}>{kind}</span>
                    <span>{priceTxt}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", opacity: reasonsTxt ? 0.9 : 0.6 }}>
                      {reasonsTxt || "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
