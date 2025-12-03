// src/pages/coin.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createChart } from "lightweight-charts";
import AssetPanel from "../components/AssetPanel";

import {
  fmtComma,
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
  wsHub,
  next0650EndBoundaryUtcSec,
  genMinutePlaceholders,
} from "../lib/tradeUtils";

/* ─────────────────────────────────────────────────────────
 * TickerCard
 * ───────────────────────────────────────────────────────── */
function TickerCard({ symbol, interval, stats, meta }) {
  const price = interval === "D" ? stats?.priceD : stats?.price1m;
  const ma100 = interval === "D" ? stats?.ma100_D : stats?.ma100_1m;
  const chg3mPct = interval === "D" ? null : stats?.chg3mPct;

  const has =
    typeof price === "number" &&
    typeof ma100 === "number" &&
    ma100 !== 0;
  const deltaPct = has ? price / ma100 - 1 : null;
  const up = deltaPct != null ? deltaPct >= 0 : null;

  const thr = meta?.ma_threshold ?? null;
  const momThr = meta?.momentum_threshold ?? null;
  const exitThr = meta?.exit_threshold ?? null;
  const tCross = meta?.target_cross ?? null;
  const closesNum = meta?.closes_num ?? null;
  const maLower = has && thr != null ? ma100 * (1 - thr) : null;
  const maUpper = has && thr != null ? ma100 * (1 + thr) : null;
  const exitLower =
    has && exitThr != null ? ma100 * (1 - exitThr) : null;
  const exitUpper =
    has && exitThr != null ? ma100 * (1 + exitThr) : null;

  const closesDays =
    interval === "1" && typeof closesNum === "number"
      ? Math.max(1, Math.round(closesNum / 1440))
      : null;
  const thrPct = thr != null ? (thr * 100).toFixed(2) : null;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "#1a1a1a",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      {/* 상단 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.9 }}>{symbol}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          진입&nbsp;
          {thrPct != null ? `±${thrPct}%` : "—"}
          <span style={{ opacity: 0.6 }}>&nbsp;·&nbsp;</span>
          급변&nbsp;
          {momThr != null
            ? (momThr * 100).toFixed(3) + "%"
            : "—"}
        </div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          marginTop: 4,
        }}
      >
        {price != null ? fmtComma(price, 1) : "—"}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span
          style={{
            color:
              up == null
                ? "#aaa"
                : up
                ? "#2fe08d"
                : "#ff6b6b",
          }}
        >
          MA100 대비{" "}
          {deltaPct != null
            ? `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(
                deltaPct * 100
              ).toFixed(2)}%`
            : "--"}
        </span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span
          style={{
            color:
              chg3mPct == null
                ? "#aaa"
                : chg3mPct >= 0
                ? "#2fe08d"
                : "#ff6b6b",
          }}
        >
          3분전{" "}
          {chg3mPct != null
            ? `${chg3mPct >= 0 ? "+" : ""}${chg3mPct.toFixed(
                3
              )}%`
            : "—"}
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          lineHeight: 1.6,
          opacity: 0.9,
        }}
      >
        <div>
          • 진입목표 :{" "}
          {maLower != null
            ? fmtComma(maLower, 1)
            : "—"}{" "}
          /{" "}
          {maUpper != null
            ? fmtComma(maUpper, 1)
            : "—"}{" "}
        </div>
        <div>
          • 30분내 청산 :{" "}
          {exitUpper != null
            ? fmtComma(exitUpper, 1)
            : "—"}
          /
          {exitLower != null
            ? fmtComma(exitLower, 1)
            : "—"}{" "}
          (
          {exitThr != null
            ? `${(exitThr * 100).toFixed(3)}%`
            : "—"}
          )
        </div>
        <div>
          • 목표 크로스:{" "}
          {tCross != null ? tCross : "—"}회 /{" "}
          {interval === "1"
            ? closesDays != null
              ? `${closesDays}일`
              : "—"
            : closesNum != null
            ? `${closesNum}일`
            : "—"}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * 유틸
 * ───────────────────────────────────────────────────────── */

// "YYYY-MM-DD HH:MM:SS" 를 KST(+09:00) 기준 초단위로
function parseKstToEpochSec(s) {
  if (!s) return NaN;
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const withTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso)
    ? iso
    : `${iso}+09:00`;
  const t = Date.parse(withTz);
  return Number.isFinite(t) ? Math.floor(t / 1000) : NaN;
}

// cross_times -> lightweight-charts markers
function buildCrossMarkers(crossTimesArr, fromSec, toSec) {
  if (!Array.isArray(crossTimesArr) || crossTimesArr.length === 0)
    return [];
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

/* ─────────────────────────────────────────────────────────
 * ChartPanel
 * ───────────────────────────────────────────────────────── */
function ChartPanel({
  symbol,
  globalInterval,
  dayOffset,
  onBounds,
  onStats,
  thr,
  crossTimes,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const maSeriesRef = useRef(null);
  const maUpperSeriesRef = useRef(null);
  const maLowerSeriesRef = useRef(null);
  const roRef = useRef(null);
  const allBarsRef = useRef([]); // 1분봉 전체
  const dailyBarsRef = useRef([]); // 일봉 전체
  const markersAllRef = useRef([]);
  const notesAllRef = useRef([]);

  const [notesView, setNotesView] = useState([]);
  const [notesCollapsed, setNotesCollapsed] = useState(true);
  const versionRef = useRef(0);
  const dayOffsetRef = useRef(dayOffset);

  useEffect(() => {
    setNotesCollapsed(true);
  }, [dayOffset]);

  useEffect(() => {
    dayOffsetRef.current = dayOffset;
  }, [dayOffset]);

  // 하루 윈도우 계산(UTC초)
  const getDayWindowByOffset = useCallback((offsetDays = 0) => {
    const end =
      next0650EndBoundaryUtcSec() + offsetDays * 86400;
    return [end - 86400, end];
  }, []);

  // 하루 범위 렌더
  const renderDayWindow = useCallback(
    (arrAll, resetRange = false) => {
      if (!chartRef.current || !seriesRef.current) return;
      const [start, end] = getDayWindowByOffset(
        dayOffsetRef.current
      );

      const real = (arrAll || []).filter(
        (b) => b.time >= start && b.time < end
      );

      // 앞쪽 빈 캔들
      const firstRealTime = real.length ? real[0].time : end;
      const prefixEnd = Math.min(firstRealTime, end);
      const prefixPlaceholders =
        prefixEnd > start
          ? genMinutePlaceholders(start, prefixEnd)
          : [];

      // 뒤쪽 미래 빈 캔들
      const nowSec = Math.floor(Date.now() / 1000);
      const placeStart = Math.max(
        nowSec + 60,
        (real.at(-1)?.time ?? start) + 60
      );
      const placeholders =
        placeStart < end
          ? genMinutePlaceholders(placeStart, end)
          : [];

      const priceSlice = prefixPlaceholders.concat(
        real,
        placeholders
      );

      const forMa = sliceWithBuffer(arrAll, start, end, 99);
      const ma100 = calcSMA(forMa, 100).filter(
        (p) => p.time >= start && p.time < end
      );

      seriesRef.current?.setData(priceSlice);
      maSeriesRef.current?.setData(ma100);

      if (
        typeof thr === "number" &&
        isFinite(thr) &&
        thr > 0
      ) {
        const maUpper = ma100.map((p) => ({
          time: p.time,
          value: p.value * (1 + thr),
        }));
        const maLower = ma100.map((p) => ({
          time: p.time,
          value: p.value * (1 - thr),
        }));
        maUpperSeriesRef.current?.setData(maUpper);
        maLowerSeriesRef.current?.setData(maLower);
      } else {
        maUpperSeriesRef.current?.setData([]);
        maLowerSeriesRef.current?.setData([]);
      }

      if (resetRange) {
        try {
          const ts = chartRef.current?.timeScale?.();
          if (ts && start && end) {
            ts.setVisibleRange({
              from: start,
              to: end - 60,
            });
          }
        } catch (e) {
          console.warn("setVisibleRange failed:", e);
        }
      }

      const applyMarkersAndNotes = (barsReal) => {
        const base = (markersAllRef.current || []).filter(
          (x) => x.time >= start && x.time < end
        );
        const cross = buildCrossMarkers(
          crossTimes || [],
          start,
          end
        );
        const m = [...base, ...cross].sort((a, b) => {
          if (a.time !== b.time) return a.time - b.time;
          const posOrder = {
            belowBar: 0,
            inBar: 1,
            aboveBar: 2,
          };
          const pa = posOrder[a.position] ?? 1;
          const pb = posOrder[b.position] ?? 1;
          if (pa !== pb) return pa - pb;
          const na = Number(a.text),
            nb = Number(b.text);
          if (
            Number.isFinite(na) &&
            Number.isFinite(nb)
          )
            return na - nb;
          return String(a.text || "").localeCompare(
            String(b.text || "")
          );
        });

        const n = (notesAllRef.current || []).filter(
          (x) =>
            x.timeSec >= start && x.timeSec < end
        );
        seriesRef.current.setMarkers(m);
        setNotesView(n);
      };

      applyMarkersAndNotes(real);
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

    try {
      roRef.current?.disconnect();
    } catch {}
    try {
      chartRef.current?.remove();
    } catch {}
    chartRef.current = null;
    seriesRef.current = null;
    maSeriesRef.current = null;
    markersAllRef.current = [];
    notesAllRef.current = [];
    setNotesView([]);

    const width = CHART_WIDTH;
    const chart = createChart(el, {
      width,
      height: CHART_HEIGHT,
      autoSize: false,
      layout: {
        background: { color: "#111" },
        textColor: "#ddd",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (t) => {
          const ts =
            typeof t === "number"
              ? t
              : t?.timestamp
              ? t.timestamp
              : 0;
          return globalInterval === "D"
            ? fmtKSTMonth(ts)
            : fmtKSTHour(ts);
        },
        lockVisibleTimeRangeOnResize: true,
        fixLeftEdge: true,
      },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      localization: {
        timeFormatter: (t) => fmtKSTFull(getTs(t)),
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisDoubleClickReset: false,
        axisPressedMouseMove: false,
        mouseWheel: false,
        pinch: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#2fe08d",
      downColor: "#ff6b6b",
      borderUpColor: "#2fe08d",
      borderDownColor: "#ff6b6b",
      wickUpColor: "#2fe08d",
      wickDownColor: "#ff6b6b",
    });
    const maSeries = chart.addLineSeries({
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      color: "#ffd166",
    });
    const maUpperSeries = chart.addLineSeries({
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      color: "#9ca3af",
    });
    const maLowerSeries = chart.addLineSeries({
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      color: "#9ca3af",
    });

    if (versionRef.current !== myVersion) {
      chart.remove();
      return;
    }
    chartRef.current = chart;
    seriesRef.current = candleSeries;
    maSeriesRef.current = maSeries;
    maUpperSeriesRef.current = maUpperSeries;
    maLowerSeriesRef.current = maLowerSeries;

    roRef.current = null;

    const MAX_1M_BARS = 43200;

    (async () => {
      try {
        const limit = globalInterval === "1" ? 8 * 1440 : 1000;
        const bars = await fetchAllKlines(
          symbol,
          globalInterval,
          limit
        );
        if (versionRef.current !== myVersion) return;

        const sigs = await fetchSignals(symbol).catch(
          () => []
        );
        const { markers, notes } = buildSignalAnnotations(
          sigs
        );
        markersAllRef.current = markers;
        notesAllRef.current = notes;

        if (globalInterval === "1") {
          allBarsRef.current = bars;
          renderDayWindow(allBarsRef.current, false);

          const lastCloseAll = bars.length
            ? bars[bars.length - 1].close
            : null;
          const lastMaAll = calcLatestMAValue(bars, 100);
          const prev3 =
            bars.length >= 3
              ? bars[bars.length - 3].close
              : null;
          const chg3mPct =
            prev3 && lastCloseAll != null
              ? ((lastCloseAll - prev3) / prev3) * 100
              : null;
          onStats?.(symbol, {
            price1m: lastCloseAll,
            ma100_1m: lastMaAll,
            chg3mPct,
          });

          const WINDOW_DAYS = 7;
          onBounds?.(symbol, {
            min: -WINDOW_DAYS,
            max: 0,
          });

          const TOPIC_1M = `kline.1.${symbol}`;
          const off1m = wsHub.addListener(
            TOPIC_1M,
            (d) => {
              const bar = {
                time: Math.floor(Number(d.start) / 1000),
                open: +d.open,
                high: +d.high,
                low: +d.low,
                close: +d.close,
              };
              let arr = mergeBars(
                allBarsRef.current || [],
                bar
              );
              if (arr.length > MAX_1M_BARS)
                arr = arr.slice(-MAX_1M_BARS);
              allBarsRef.current = arr;

              renderDayWindow(allBarsRef.current, true);

              const lastClose = arr.length
                ? arr[arr.length - 1].close
                : null;
              const lastMa =
                calcLatestMAValue(arr, 100);
              const prev3m =
                arr.length >= 3
                  ? arr[arr.length - 3].close
                  : null;
              const chg3m =
                prev3m && lastClose != null
                  ? ((lastClose - prev3m) / prev3m) *
                    100
                  : null;
              onStats?.(symbol, {
                price1m: lastClose,
                ma100_1m: lastMa,
                chg3mPct: chg3m,
              });
            }
          );
          cleanups.push(off1m);
        } else {
          dailyBarsRef.current = bars;
          candleSeries.setData(bars);
          maSeries.setData(calcSMA(bars, 100));
          chartRef.current?.timeScale().fitContent();

          const lastCloseD = bars.length
            ? bars[bars.length - 1].close
            : null;
          const lastMaD = calcLatestMAValue(bars, 100);
          onStats?.(symbol, {
            priceD: lastCloseD,
            ma100_D: lastMaD,
          });

          const TOPIC_1D = `kline.D.${symbol}`;
          const off1d = wsHub.addListener(
            TOPIC_1D,
            (d) => {
              const bar = {
                time: Math.floor(Number(d.start) / 1000),
                open: +d.open,
                high: +d.high,
                low: +d.low,
                close: +d.close,
              };
              dailyBarsRef.current = mergeBars(
                dailyBarsRef.current || [],
                bar
              );
              seriesRef.current?.update(bar);
              maSeriesRef.current?.setData(
                calcSMA(dailyBarsRef.current, 100)
              );

              const lastClose =
                dailyBarsRef.current.length
                  ? dailyBarsRef.current[
                      dailyBarsRef.current.length - 1
                    ].close
                  : null;
              const lastMa = calcLatestMAValue(
                dailyBarsRef.current,
                100
              );
              onStats?.(symbol, {
                priceD: lastClose,
                ma100_D: lastMa,
              });
            }
          );
          cleanups.push(off1d);
        }
      } catch (e) {
        console.error("[REST] failed", e);
      }
    })();

    return () => {
      try {
        roRef.current?.disconnect();
      } catch {}
      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      maSeriesRef.current = null;
      maUpperSeriesRef.current = null;
      maLowerSeriesRef.current = null;
      allBarsRef.current = [];
      dailyBarsRef.current = [];
      markersAllRef.current = [];
      notesAllRef.current = [];
      setNotesView([]);
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [
    symbol,
    globalInterval,
    onBounds,
    onStats,
    renderDayWindow,
    getDayWindowByOffset,
  ]);

  useEffect(() => {
    if (!seriesRef.current || globalInterval !== "1") return;
    if (chartRef.current && allBarsRef.current?.length) {
      renderDayWindow(allBarsRef.current, true);
    }
  }, [dayOffset, globalInterval, renderDayWindow]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 20,
          opacity: 0.8,
          marginBottom: 6,
        }}
      >
        {symbol}
      </div>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              opacity: 0.9,
            }}
          >
            {symbol} · 시그널 설명 ({notesView.length})
          </div>
          <button
            onClick={() =>
              setNotesCollapsed((v) => !v)
            }
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
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              marginTop: 8,
            }}
          />
        ) : notesView.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              marginTop: 8,
            }}
          >
            시그널 없음
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 8,
              marginTop: 8,
            }}
          >
            {notesView.map((n) => {
              const side = String(
                n.side || ""
              ).toUpperCase();
              const kind = String(
                n.kind || ""
              ).toUpperCase();
              const sideColor =
                side === "LONG"
                  ? "#16a34a"
                  : side === "SHORT"
                  ? "#dc2626"
                  : "#9ca3af";
              const priceTxt =
                n.price != null
                  ? fmtComma(n.price)
                  : "—";
              const timeTxt = n.timeSec
                ? fmtKSTHMS(n.timeSec)
                : "";
              const reasonsTxt = n.reasons?.length
                ? `${n.reasons.join(", ")}`
                : "";

              return (
                <div
                  key={n.key}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "#1b1b1b",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "6ch 9ch 8ch 9ch 14ch 1fr",
                      columnGap: 12,
                      alignItems: "baseline",
                      fontSize: 12,
                      lineHeight: 1.5,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontVariantNumeric:
                        "tabular-nums",
                    }}
                    title={[
                      `#${n.seq}`,
                      timeTxt,
                      side,
                      kind,
                      priceTxt,
                      fmtKSTFull(n.timeSec),
                      reasonsTxt,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <b style={{ opacity: 0.95 }}>
                      #{n.seq}
                    </b>
                    <span>{timeTxt}</span>
                    <span
                      style={{
                        color: sideColor,
                        fontWeight: 700,
                      }}
                    >
                      {side}
                    </span>
                    <span
                      style={{ opacity: 0.85 }}
                    >
                      {kind}
                    </span>
                    <span>{priceTxt}</span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontFamily: "inherit",
                        opacity: reasonsTxt
                          ? 0.9
                          : 0.6,
                      }}
                    >
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

/* ─────────────────────────────────────────────────────────
 * 페이지 컨테이너
 * ───────────────────────────────────────────────────────── */

const DEFAULT_SYMBOLS = [
  { symbol: "BTCUSDT", market: "linear" },
  { symbol: "ETHUSDT", market: "linear" },
  { symbol: "XAUTUSDT", market: "linear" },
];

function selectedDayLabel(offsetDays = 0) {
  const end =
    next0650EndBoundaryUtcSec() + offsetDays * 86400;
  const start = end - 86400;
  const kstSec = start + 9 * 3600;
  const d = new Date(kstSec * 1000);
  const month = d.getUTCMonth() + 1;
  const date = d.getUTCDate();
  const dow = ["일", "월", "화", "수", "목", "금", "토"][
    d.getUTCDay()
  ];
  return `${month}월 ${date}일(${dow})`;
}

async function fetchThresholdMeta(symbol) {
  const url = `/api/thresholds?symbol=${symbol}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const j = await res.json();
  return j || null;
}

export default function Coin() {
  const [interval, setInterval_] = useState("1");
  const [dayOffset, setDayOffset] = useState(0);

  // 자산
  const [asset, setAsset] = useState({
    wallet: { USDT: 0 },
    positions: {},
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/asset", {
          cache: "no-store",
        });
        const j = res.ok ? await res.json() : null;
        if (!alive || !j) return;
        setAsset(j.asset);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  // config (Redis에서 읽어오는 /api/config 사용)
  const [configState, setConfigState] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/config", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setConfigState(j);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 심볼 목록: config.symbols 있으면 우선 사용
  const symbolsConfig = useMemo(() => {
    const arr = configState?.symbols;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map((sym) => ({
        symbol: sym,
        market: "linear",
      }));
    }
    return DEFAULT_SYMBOLS;
  }, [configState]);

  const [statsMap, setStatsMap] = useState({});
  const onStats = useCallback((symbol, stats) => {
    setStatsMap((prev) => ({
      ...prev,
      [symbol]: { ...prev[symbol], ...stats },
    }));
  }, []);

  const [metaMap, setMetaMap] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const results = await Promise.all(
          symbolsConfig.map((s) =>
            fetchThresholdMeta(s.symbol).catch(() => null)
          )
        );
        if (!alive) return;
        const merged = {};
        results.forEach((m, i) => {
          if (m) merged[symbolsConfig[i].symbol] = m;
        });
        setMetaMap((prev) => ({ ...prev, ...merged }));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [symbolsConfig]);

  const requiredSymbols = useMemo(
    () => symbolsConfig.map((s) => s.symbol),
    [symbolsConfig]
  );

  const [perSymbolBounds, setPerSymbolBounds] = useState({});
  const onBounds = useCallback((symbol, bounds) => {
    setPerSymbolBounds((prev) => ({
      ...prev,
      [symbol]: bounds,
    }));
  }, []);

  const { minOffset, maxOffset, boundsReady } = useMemo(() => {
    const haveAll = requiredSymbols.every(
      (sym) => perSymbolBounds[sym]
    );
    if (!haveAll)
      return {
        minOffset: 0,
        maxOffset: 0,
        boundsReady: false,
      };
    const values = requiredSymbols.map(
      (sym) => perSymbolBounds[sym]
    );
    const minCommon = Math.max(
      ...values.map((b) => b.min ?? 0)
    );
    const maxCommon = Math.min(
      ...values.map((b) => b.max ?? 0)
    );
    return {
      minOffset: minCommon,
      maxOffset: maxCommon,
      boundsReady: true,
    };
  }, [perSymbolBounds, requiredSymbols]);

  useEffect(() => {
    if (interval !== "1" || !boundsReady) return;
    setDayOffset((d) =>
      Math.min(Math.max(d, minOffset), maxOffset)
    );
  }, [interval, boundsReady, minOffset, maxOffset]);

  const atMin =
    interval === "1" &&
    boundsReady &&
    dayOffset <= minOffset;
  const atMax =
    interval === "1" &&
    boundsReady &&
    dayOffset >= maxOffset;

  const disBtnStyle = (disabled) => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: 0,
    background: disabled ? "#222" : "#2a2a2a",
    color: "#fff",
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div
      style={{
        padding: 24,
        color: "#fff",
        background: "#111",
        minHeight: "100vh",
      }}
    >
      <AssetPanel
        asset={asset}
        statsBySymbol={statsMap}
        config={configState}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 24,
        }}
      >
        {/* 왼쪽: 티커 카드 + 컨트롤 */}
        <div>
          <div
            style={{
              position: "sticky",
              top: 12,
              zIndex: 5,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "#1a1a1a",
                marginBottom: 14,
                boxShadow:
                  "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  보기 설정
                </div>
                {interval === "1" && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.85,
                    }}
                  >
                    {selectedDayLabel(dayOffset)}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => {
                    setInterval_("1");
                    setDayOffset(0);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    background:
                      interval === "1"
                        ? "#00ffcc"
                        : "#2a2a2a",
                    color:
                      interval === "1"
                        ? "#000"
                        : "#fff",
                    fontWeight: 700,
                  }}
                >
                  1분봉
                </button>
                <button
                  onClick={() => setInterval_("D")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    background:
                      interval === "D"
                        ? "#00ffcc"
                        : "#2a2a2a",
                    color:
                      interval === "D"
                        ? "#000"
                        : "#fff",
                    fontWeight: 700,
                  }}
                >
                  1일봉
                </button>
              </div>

              {interval === "1" && (
                <>
                  <div style={{ height: 10 }} />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <button
                      onClick={() =>
                        setDayOffset((d) =>
                          Math.max(minOffset, d - 1)
                        )
                      }
                      disabled={
                        !boundsReady || atMin
                      }
                      style={disBtnStyle(
                        !boundsReady || atMin
                      )}
                      title="전날 보기"
                    >
                      ◀ 전날
                    </button>
                    <button
                      onClick={() =>
                        setDayOffset(0)
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: 0,
                        background: "#00ffcc",
                        color: "#000",
                        fontWeight: 700,
                      }}
                      title="오늘 보기"
                    >
                      오늘
                    </button>
                    <button
                      onClick={() =>
                        setDayOffset((d) =>
                          Math.min(maxOffset, d + 1)
                        )
                      }
                      disabled={
                        !boundsReady || atMax
                      }
                      style={disBtnStyle(
                        !boundsReady || atMax
                      )}
                      title="다음날 보기"
                    >
                      다음날 ▶
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 티커 카드들 */}
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {symbolsConfig.map((s) => (
              <TickerCard
                key={s.symbol}
                symbol={s.symbol}
                interval={interval}
                stats={statsMap[s.symbol]}
                meta={metaMap[s.symbol]}
              />
            ))}
          </div>
        </div>

        {/* 오른쪽: 차트들 */}
        <div>
          {symbolsConfig.map((s) => (
            <ChartPanel
              key={s.symbol}
              symbol={s.symbol}
              globalInterval={interval}
              dayOffset={dayOffset}
              onBounds={onBounds}
              onStats={onStats}
              thr={metaMap[s.symbol]?.ma_threshold}
              crossTimes={
                metaMap[s.symbol]?.cross_times
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
