// src/components/cfd/CfdChartPanel.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createChart } from "lightweight-charts";
import {
  getWsHub,
  mergeBars,
  fmtKSTFull,
  fmtKSTHour,
  fmtKSTHMS,
  fmtComma,
  getTs,
} from "../../lib/tradeUtils";
import { fetchSignals, buildSignalAnnotations } from "../../lib/tradeUtils";

const API_BASE = "https://api.hyeongeonnoil.com";
const PAGE_LIMIT = 1000;

// ✅ 8일치(버퍼 포함) 로딩
const TARGET_CANDLE_COUNT = 8 * 1440;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC → KST
const SESSION_START_MIN = 6 * 60 + 50; // KST 06:50

/* ------------------------- helpers ------------------------- */

// UTC ms → 세션 날짜(KST 기준) "YYYY-MM-DD"
function getSessionKeyFromUtcMs(msUtc) {
  const msKst = msUtc + KST_OFFSET_MS;
  const d = new Date(msKst);

  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const minutes = h * 60 + m;

  let sessionDate;
  if (minutes >= SESSION_START_MIN) sessionDate = d;
  else sessionDate = new Date(msKst - 24 * 60 * 60 * 1000);

  const year = sessionDate.getUTCFullYear();
  const month = sessionDate.getUTCMonth() + 1;
  const day = sessionDate.getUTCDate();
  const pad = (n) => (n < 10 ? "0" + n : "" + n);

  return `${year}-${pad(month)}-${pad(day)}`;
}

// "YYYY-MM-DD HH:MM:SS" 를 KST(+09:00) 기준 초단위
function parseKstToEpochSec(s) {
  if (!s) return NaN;
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const withTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}+09:00`;
  const t = Date.parse(withTz);
  return Number.isFinite(t) ? Math.floor(t / 1000) : NaN;
}

// cross_times -> markers
function buildCrossMarkers(crossTimesArr, fromSec, toSec) {
  if (!Array.isArray(crossTimesArr) || crossTimesArr.length === 0) return [];
  const MARKER_COLOR = "#a78bfa";

  const items = crossTimesArr
    .map((c, idx) => ({
      idx: idx + 1,
      dir: String(c?.dir || "").toUpperCase(),
      ts: c?.time ? parseKstToEpochSec(String(c.time)) : NaN,
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

// sessionKey("YYYY-MM-DD") -> 해당 세션의 시작/끝 (UTC sec)
// 세션 시작: KST 06:50
function getSessionWindowUtcSec(sessionKey) {
  if (!sessionKey) return [NaN, NaN];

  const [y, m, d] = String(sessionKey)
    .split("-")
    .map((v) => Number(v));

  if (![y, m, d].every(Number.isFinite)) return [NaN, NaN];

  const startMsUtc = Date.UTC(y, m - 1, d, 6, 50, 0) - KST_OFFSET_MS;
  const start = Math.floor(startMsUtc / 1000);
  const end = start + 86400;
  return [start, end];
}

// rows(list) -> sessionGroups
function groupBySessionKstWithGaps(rows) {
  const groups = {};

  for (const row of rows) {
    const [msUtc, o, h, l, c] = row;

    const sessionKey = getSessionKeyFromUtcMs(msUtc);
    const timeSec = Math.floor(msUtc / 1000);

    if (!groups[sessionKey]) groups[sessionKey] = [];

    if (o == null || h == null || l == null || c == null) {
      groups[sessionKey].push({ time: timeSec }); // whitespace
    } else {
      groups[sessionKey].push({ time: timeSec, open: o, high: h, low: l, close: c });
    }
  }

  for (const k of Object.keys(groups)) groups[k].sort((a, b) => a.time - b.time);
  return groups;
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

function calcLatestMAFromRows(rows, period = 100) {
  const closes = (rows || []).filter((r) => r?.[4] != null).map((r) => Number(r[4]));
  if (closes.length < period) return null;

  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}

function buildSymbolStats(rows) {
  const valid = (rows || []).filter((r) => r?.[4] != null);
  if (!valid.length) return { price: null, ma100: null, chg3mPct: null };

  const lastClose = Number(valid[valid.length - 1][4]);
  const ma100 = calcLatestMAFromRows(valid, 100);

  let chg3mPct = null;
  if (valid.length >= 3) {
    const prev3 = Number(valid[valid.length - 3][4]);
    if (prev3) chg3mPct = ((lastClose - prev3) / prev3) * 100;
  }
  return { price: lastClose, ma100, chg3mPct };
}

async function fetchPagedCandles(symbol, interval, targetCount) {
  let allRows = [];
  let nextCursor = null;

  while (allRows.length < targetCount) {
    const url = new URL("/v5/market/candles/with-gaps", API_BASE);
    url.searchParams.set("symbol", symbol.toUpperCase());
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    if (nextCursor != null) url.searchParams.set("end", String(nextCursor));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.retCode !== 0) throw new Error(`API error (${data.retCode}): ${data.retMsg}`);

    const result = data.result || {};
    const rows = result.list || [];
    if (!rows.length) break;

    allRows = allRows.concat(rows);
    nextCursor = result.nextCursor;
    if (nextCursor == null) break;
  }

  allRows.sort((a, b) => a[0] - b[0]);
  if (allRows.length > targetCount) allRows = allRows.slice(allRows.length - targetCount);
  return allRows;
}

// ✅ coin의 sliceWithBuffer(세션 시작 전 99개 캔들 버퍼)
function sliceWithBuffer(all, start, end, bufferBars = 99) {
  if (!Array.isArray(all) || !all.length) return [];
  const inRange = all.filter((b) => b.time >= start && b.time < end);
  const before = all.filter((b) => b.time < start);
  const buf = before.slice(Math.max(0, before.length - bufferBars));
  return buf.concat(inRange);
}

/* ------------------------- Component ------------------------- */
export default function CfdChartPanel({
  symbol,
  sessionKey, // 레거시 입력(부모)
  thr,
  crossTimes,
  onStats,
  onSessionKeys,
  onBounds,
}) {
  const wsHub = useMemo(() => getWsHub("wss://api.hyeongeonnoil.com/ws"), []);

  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const maSeriesRef = useRef(null);
  const maUpperSeriesRef = useRef(null);
  const maLowerSeriesRef = useRef(null);

  const markersAllRef = useRef([]);
  const rowsRef = useRef([]);
  const allRealCandlesRef = useRef([]);

  const [sessionGroups, setSessionGroups] = useState({});

  // ✅ 부모 sessionKey가 꼬이거나 groups에 없을 때도 “최근 세션”으로 fallback
  const [effectiveSessionKey, setEffectiveSessionKey] = useState(sessionKey || "");

  // UI notes
  const [notesView, setNotesView] = useState([]);
  const visibleNotes = useMemo(() => {
    if (!effectiveSessionKey) return [];
    const [start, end] = getSessionWindowUtcSec(effectiveSessionKey);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

    return (notesView || [])
      .filter((n) => {
        const t = Number(n?.timeSec);
        return Number.isFinite(t) && t >= start && t < end;
      })
      .sort((a, b) => Number(a?.timeSec || 0) - Number(b?.timeSec || 0));
  }, [notesView, effectiveSessionKey]);

  const [notesCollapsed, setNotesCollapsed] = useState(true);
  useEffect(() => setNotesCollapsed(true), [sessionKey, effectiveSessionKey]);

  // ✅ sessionGroups -> 최근 7개만 부모로 전달 + bounds도 -6..0로 고정
  const lastKeysSigRef = useRef("");
  useEffect(() => {
    const keys = Object.keys(sessionGroups || {}).sort();
    if (!keys.length) return;

    const last7 = keys.slice(-7);
    const sig = last7.join("|");

    if (typeof onSessionKeys === "function" && sig !== lastKeysSigRef.current) {
      lastKeysSigRef.current = sig;
      onSessionKeys(symbol, last7);
    }

    if (typeof onBounds === "function") {
      onBounds(symbol, { min: -6, max: 0 });
    }

    const want = sessionKey && keys.includes(sessionKey) ? sessionKey : last7[last7.length - 1];
    setEffectiveSessionKey(want);
  }, [sessionGroups, onSessionKeys, onBounds, symbol, sessionKey]);

  const pushStatsUp = useCallback(() => {
    if (typeof onStats !== "function") return;
    const stats = buildSymbolStats(rowsRef.current || []);
    onStats(symbol, stats);
  }, [onStats, symbol]);

  const CHART_HEIGHT = 320;
  const CHART_WIDTH = 800;

  /* ------------------------- chart init ------------------------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    try {
      chartRef.current?.remove();
    } catch {}
    chartRef.current = null;
    seriesRef.current = null;
    maSeriesRef.current = null;
    maUpperSeriesRef.current = null;
    maLowerSeriesRef.current = null;

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
        lockVisibleTimeRangeOnResize: true,
        fixLeftEdge: true,
        tickMarkFormatter: (t) => {
          const ts = typeof t === "number" ? t : t?.timestamp ? t.timestamp : 0;
          return fmtKSTHour(ts);
        },
      },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      localization: { timeFormatter: (t) => fmtKSTFull(getTs(t)) },
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

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    maSeriesRef.current = maSeries;
    maUpperSeriesRef.current = maUpperSeries;
    maLowerSeriesRef.current = maLowerSeries;

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      const w = wrapRef.current.clientWidth || CHART_WIDTH;
      chart.applyOptions({ width: w });
    });
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      try {
        chart.remove();
      } catch {}
    };
  }, [symbol]);

  /* ------------------------- initial REST load ------------------------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const sigs = await fetchSignals(symbol, "mt5_signal").catch(() => []);
        const { markers, notes } = buildSignalAnnotations(sigs);
        setNotesView(notes);
        markersAllRef.current = markers || [];

        const rows = await fetchPagedCandles(symbol, "1", TARGET_CANDLE_COUNT);
        if (!alive) return;

        rowsRef.current = rows;

        allRealCandlesRef.current = (rows || [])
          .filter((r) => r && r[1] != null && r[2] != null && r[3] != null && r[4] != null)
          .map((r) => ({
            time: Math.floor(Number(r[0]) / 1000),
            open: Number(r[1]),
            high: Number(r[2]),
            low: Number(r[3]),
            close: Number(r[4]),
          }))
          .sort((a, b) => a.time - b.time);

        const groups = groupBySessionKstWithGaps(rows);
        setSessionGroups(groups);

        pushStatsUp();
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [symbol, pushStatsUp]);

  /* ------------------------- selected candles ------------------------- */
  const selectedCandles = useMemo(() => {
    if (!effectiveSessionKey) return [];

    const raw = sessionGroups?.[effectiveSessionKey] || [];
    const [start, end] = getSessionWindowUtcSec(effectiveSessionKey);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

    const real = raw
      .filter((c) => c && c.time >= start && c.time < end && c.open != null)
      .sort((a, b) => a.time - b.time);

    const filled = [];
    let ri = 0;
    for (let t = start; t < end; t += 60) {
      const r = real[ri];
      if (r && Math.floor(r.time / 60) * 60 === t) {
        filled.push(r);
        ri++;
      } else {
        filled.push({ time: t }); // whitespace
      }
    }
    return filled;
  }, [sessionGroups, effectiveSessionKey]);

  /* ------------------------- WS via wsHub ------------------------- */
  useEffect(() => {
    const tTopic = `tickers.${symbol}`;
    const kTopic = `kline.1.${symbol}`;
    const topics = [tTopic, kTopic];

    try {
      wsHub.subscribe?.(topics);
    } catch {}

    const offT = wsHub.addListener?.(tTopic, (d) => {
  const bid = Number(d?.bid1Price ?? d?.bid);
  const ask = Number(d?.ask1Price ?? d?.ask);

  const mid =
    Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;

  const last = Number(d?.lastPrice ?? d?.last ?? d?.price);

  const px = Number.isFinite(mid) ? mid : last;
  if (!Number.isFinite(px)) return;

  onStats?.(symbol, { price: px });
});


    const offK = wsHub.addListener?.(kTopic, (d) => {
      const rawStart = Number(d?.start);
      const o = Number(d?.open);
      const h = Number(d?.high);
      const l = Number(d?.low);
      const c = Number(d?.close);

      const startMsUtc = Number.isFinite(rawStart) ? (rawStart < 2e10 ? rawStart * 1000 : rawStart) : NaN;
      if (!Number.isFinite(startMsUtc) || ![o, h, l, c].every(Number.isFinite)) return;

      const row = [startMsUtc, o, h, l, c];
      const rows = rowsRef.current || [];
      let nextRows = rows;

      if (rows.length && rows[rows.length - 1][0] === startMsUtc) {
        nextRows = rows.slice(0, -1).concat([row]);
      } else {
        nextRows = rows.concat([row]);
        if (nextRows.length > TARGET_CANDLE_COUNT) nextRows = nextRows.slice(-TARGET_CANDLE_COUNT);
      }
      rowsRef.current = nextRows;

      allRealCandlesRef.current = (nextRows || [])
        .filter((r) => r && r[1] != null && r[2] != null && r[3] != null && r[4] != null)
        .map((r) => ({
          time: Math.floor(Number(r[0]) / 1000),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
        }))
        .sort((a, b) => a.time - b.time);

      const timeSec = Math.floor(startMsUtc / 1000);
      const candle = { time: timeSec, open: o, high: h, low: l, close: c };
      const sk = getSessionKeyFromUtcMs(startMsUtc);

      setSessionGroups((prev) => {
        const old = prev?.[sk] || [];
        const merged = mergeBars(old, candle);
        return { ...(prev || {}), [sk]: merged };
      });

      pushStatsUp();
    });

    return () => {
      try {
        wsHub.unsubscribe?.(topics);
      } catch {}
      try {
        offT?.();
      } catch {}
      try {
        offK?.();
      } catch {}
    };
  }, [wsHub, symbol, onStats, pushStatsUp]);

  /* ------------------------- draw (candles + MA + env + markers) ------------------------- */
  useEffect(() => {
    const candleSeries = seriesRef.current;
    const maSeries = maSeriesRef.current;
    const maUpper = maUpperSeriesRef.current;
    const maLower = maLowerSeriesRef.current;

    if (!candleSeries || !maSeries || !maUpper || !maLower) return;
    if (!effectiveSessionKey) return;

    candleSeries.setData(selectedCandles || []);

    const [start, end] = getSessionWindowUtcSec(effectiveSessionKey);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    const forMa = sliceWithBuffer(allRealCandlesRef.current || [], start, end, 99);
    const ma100 = calcSMAFromCandles(forMa, 100).filter((p) => p.time >= start && p.time < end);
    maSeries.setData(ma100);

    if (typeof thr === "number" && isFinite(thr) && thr > 0) {
      maUpper.setData(ma100.map((p) => ({ time: p.time, value: p.value * (1 + thr) })));
      maLower.setData(ma100.map((p) => ({ time: p.time, value: p.value * (1 - thr) })));
    } else {
      maUpper.setData([]);
      maLower.setData([]);
    }

    const arr = Array.isArray(crossTimes) ? crossTimes : [];
    const base = (markersAllRef.current || []).filter((x) => x.time >= start && x.time < end);
    const cross = buildCrossMarkers(arr, start, end);

    const merged = [...base, ...cross].sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return String(a.text || "").localeCompare(String(b.text || ""));
    });

    if (typeof candleSeries.setMarkers === "function") {
      candleSeries.setMarkers(merged);
    }
  }, [selectedCandles, thr, crossTimes, effectiveSessionKey]);

  /* ------------------------- visible range ------------------------- */
  useEffect(() => {
    if (!effectiveSessionKey) return;
    const [start, end] = getSessionWindowUtcSec(effectiveSessionKey);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    try {
      chartRef.current?.timeScale?.()?.setVisibleRange({ from: start, to: end - 60 });
    } catch {}
  }, [effectiveSessionKey, symbol]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 20, opacity: 0.8, marginBottom: 6 }}>
        {symbol}
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.65 }}>
          (show: {effectiveSessionKey || "—"} / loaded: {TARGET_CANDLE_COUNT})
        </span>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.9 }}>
            {symbol} · 시그널 설명 ({visibleNotes.length})
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
        ) : visibleNotes.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>시그널 없음</div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {visibleNotes.map((n) => {
              const side = String(n.side || "").toUpperCase();
              const kind = String(n.kind || "").toUpperCase();
              const sideColor = side === "LONG" ? "#16a34a" : side === "SHORT" ? "#dc2626" : "#9ca3af";

              const priceTxt = n.price != null ? fmtComma(n.price) : "—";
              const timeTxt = n.timeSec ? fmtKSTHMS(n.timeSec) : "";
              const reasonsTxt = n.reasons?.length ? `${n.reasons.join(", ")}` : "";

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
                    ]
                      .filter(Boolean)
                      .join(" · ")}
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
