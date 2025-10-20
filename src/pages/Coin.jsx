// src/pages/Coin.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createChart } from "lightweight-charts";

/* ─────────────────────────────────────────────────────────
 * WS Hub: 전역 싱글톤. 한 커넥션으로 다중 토픽 영구 구독/디스패치
 * ───────────────────────────────────────────────────────── */
const WS_URL_LINEAR = "wss://stream.bybit.com/v5/public/linear";

class WsHub {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.pendingTopics = new Set(); // subscribe까지 보낸 토픽
    this.handlers = new Map();      // topic -> Set<fn>
    this.queue = [];                // 연결 전에 요청된 토픽
  this.statusHandlers = new Set();           // ← 추가
  this._connect();
  }
  _emitStatus() {                              // ← 추가
    this.statusHandlers.forEach(fn => { try { fn(this.connected); } catch {} });
  }
   onStatus(fn) {                               // ← 추가 (구독)
    this.statusHandlers.add(fn);
    // 현재 상태 즉시 전달
    try { fn(this.connected); } catch {}
    return () => this.statusHandlers.delete(fn); // 언구독
  }
  _connect() {
    if (this.ws) return;
    this.ws = new WebSocket(WS_URL_LINEAR);
    this.ws.onopen = () => {
      this.connected = true;
      this._emitStatus();                      // ← 추가
      if (this.queue.length) {
        const args = [...new Set(this.queue)];
        this.ws.send(JSON.stringify({ op: "subscribe", args }));
        args.forEach(t => this.pendingTopics.add(t));
        this.queue = [];
      }
    };
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data || "{}");
        const topic = msg.topic;
        if (!topic) return;
        const set = this.handlers.get(topic);
        if (!set || set.size === 0) return;
        const payload = Array.isArray(msg.data) ? msg.data[0] : msg.data;
        set.forEach(fn => { try { fn(payload); } catch {} });
      } catch {}
    };
    this.ws.onclose = () => {
      this.ws = null;
      this.connected = false;
      this._emitStatus();
      setTimeout(() => this._connect(), 1000); // 재연결
    };
    this.ws.onerror = () => { try { this.ws?.close(); } catch {} };
  }
  ensureSubscribe(topic) {
    if (this.pendingTopics.has(topic)) return;
    if (this.connected) {
      this.ws?.send(JSON.stringify({ op: "subscribe", args: [topic] }));
      this.pendingTopics.add(topic);
    } else {
      this.queue.push(topic);
    }
  }
  addListener(topic, fn) {
    this.ensureSubscribe(topic);
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    this.handlers.get(topic).add(fn);
    // off 함수 반환
    return () => {
      const set = this.handlers.get(topic);
      if (set) set.delete(fn);
    };
  }
}
const wsHub = new WsHub();

/* ─────────────────────────────────────────────────────────
 * 시간/포맷 유틸
 * ───────────────────────────────────────────────────────── */
const KST_OFFSET_SEC = 9 * 3600;
const DAY_SEC = 24 * 3600;

function calcLatestMAValue(bars, period = 100) {
  if (!Array.isArray(bars) || bars.length < period) return null;
  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    sum += Number(bars[i].close ?? bars[i].c ?? bars[i].value ?? 0);
  }
  return sum / period;
}

// 마지막 바 기준 "KST 06:50" 세션 시작(UTC초)
function getAnchorKst0650UtcSec(bars) {
  if (!bars?.length) return null;
  const lastUtc = bars[bars.length - 1].time;
  const kst = lastUtc + KST_OFFSET_SEC;
  const SIX50 = 6 * 3600 + 50 * 60;
  const sessionStartKst = Math.floor((kst - SIX50) / DAY_SEC) * DAY_SEC + SIX50;
  return sessionStartKst - KST_OFFSET_SEC; // 다시 UTC
}

// 세션 키 (YYYY-MM-DD, 06:50 anchor)
function sessionKeyKST_0650(tsSec) {
  const kst = tsSec + KST_OFFSET_SEC;
  const SIX50 = 6 * 3600 + 50 * 60;
  const sessionStartKst = Math.floor((kst - SIX50) / DAY_SEC) * DAY_SEC + SIX50;
  const d = new Date((sessionStartKst - KST_OFFSET_SEC) * 1000);
  const yyyy = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric" });
  const mm = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit" });
  const dd = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", day: "2-digit" });
  return `${yyyy}-${mm}-${dd}`;
}

const getTs = (t) =>
  typeof t === "number" ? t : t && typeof t.timestamp === "number" ? t.timestamp : 0;

const fmtKSTFull = (tsSec) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(tsSec * 1000);

const fmtKSTMonth = (tsSec) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit" })
    .format(tsSec * 1000);

const fmtKSTHour = (tsSec) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit" })
    .format(tsSec * 1000);

// KST 06:50 시작 ~ +24h 윈도우(UTC초)
function getWindowRangeUtcFromBars(bars, offsetDays) {
  const anchor0650Utc = getAnchorKst0650UtcSec(bars);
  if (anchor0650Utc == null) return [0, 0];
  const startUtc = anchor0650Utc + offsetDays * DAY_SEC;
  return [startUtc, startUtc + DAY_SEC];
}

function mergeBars(prev, bar) {
  if (!prev?.length) return [bar];
  const last = prev[prev.length - 1];
  if (bar.time === last.time) return prev.slice(0, -1).concat(bar);
  if (bar.time > last.time) return prev.concat(bar);
  const idx = prev.findIndex((x) => x.time === bar.time);
  if (idx >= 0) {
    const next = prev.slice();
    next[idx] = bar;
    return next;
  }
  return prev;
}

// MA100 시퀀스
function calcSMA(bars, period = 100) {
  const out = [];
  let sum = 0;
  const q = [];
  for (const b of bars) {
    const v = Number(b.close ?? b.c ?? b.value ?? 0);
    q.push(v);
    sum += v;
    if (q.length > period) sum -= q.shift();
    if (q.length === period) out.push({ time: b.time, value: sum / period });
  }
  return out;
}

// MA 정확도 위한 웜업 슬라이스
function sliceWithBuffer(bars, start, end, buffer = 99) {
  if (!bars.length) return [];
  let i = bars.findIndex((b) => b.time >= start);
  if (i === -1) i = bars.length;
  const from = Math.max(0, i - buffer);
  const toIdx = bars.findIndex((b) => b.time >= end);
  const j = toIdx === -1 ? bars.length : toIdx;
  return bars.slice(from, j);
}

/* ─────────────────────────────────────────────────────────
 * 시그널 API 도우미
 * ───────────────────────────────────────────────────────── */
async function fetchSignals(symbol) {
  const url = `/api/signals?symbol=${symbol}&days=7`;
  const res = await fetch(url, { cache: "no-store" });
  const j = await res.json();
  return Array.isArray(j?.signals) ? j.signals : [];
}

function buildSignalAnnotations(sigs) {
  const items = sigs
    .map((s) => {
      const ts = s.ts || s.time || s.timeSec;
      const timeSec = s.timeSec ? Number(s.timeSec) : Math.floor(new Date(ts).getTime() / 1000);
      const sessionKey = sessionKeyKST_0650(timeSec);
      return { ...s, timeSec, sessionKey };
    })
    .sort((a, b) => a.timeSec - b.timeSec);

  const bySession = new Map();
  for (const s of items) {
    if (!bySession.has(s.sessionKey)) bySession.set(s.sessionKey, []);
    bySession.get(s.sessionKey).push(s);
  }

  const annotated = [];
  for (const list of bySession.values()) {
    list.sort((a, b) => a.timeSec - b.timeSec).forEach((s, idx) => {
      annotated.push({ ...s, seq: idx + 1 });
    });
  }
  annotated.sort((a, b) => a.timeSec - b.timeSec);

  const markers = [];
  const notes = [];
  for (const s of annotated) {
    const isEntry = s.kind === "ENTRY";
    const isExit = s.kind === "EXIT";
    const isLong = s.side === "LONG";
    const isShort = s.side === "SHORT";

    let position = "aboveBar";
    let color = "#ffd166";
    let shape = "arrowDown";
    if (isEntry && isLong) { position = "belowBar"; color = "#2fe08d"; shape = "arrowUp"; }
    if (isEntry && isShort) { position = "aboveBar"; color = "#ff6b6b"; shape = "arrowDown"; }
    if (isExit && isLong) { position = "aboveBar"; color = "#2fe08d"; shape = "arrowDown"; }
    if (isExit && isShort) { position = "belowBar"; color = "#ff6b6b"; shape = "arrowUp"; }

    markers.push({ time: s.timeSec, position, color, shape, text: `#${s.seq}` });
    notes.push({
      key: `${s.sessionKey}#${s.seq}`,
      timeSec: s.timeSec,
      sessionKey: s.sessionKey,
      seq: s.seq,
      kind: s.kind,
      side: s.side,
      price: s.price,
      reasons: Array.isArray(s.reasons) ? s.reasons : [],
    });
  }
  return { markers, notes };
}

/* ─────────────────────────────────────────────────────────
 * 티커 카드: 현재 인터벌(1분/D)에 맞는 MA100 기준으로 퍼센트 표시
 * ───────────────────────────────────────────────────────── */
function TickerCard({ symbol, interval, stats, connected }) {
  // stats: { price1m, ma100_1m, priceD, ma100_D }
  const price = interval === "D" ? stats?.priceD : stats?.price1m;
  const ma100 = interval === "D" ? stats?.ma100_D : stats?.ma100_1m;

  const has = typeof price === "number" && typeof ma100 === "number" && ma100 !== 0;
  const deltaPct = has ? ((price / ma100 - 1) * 100) : null;
  const up = deltaPct != null ? deltaPct >= 0 : null;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "#1a1a1a",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.9 }}>{symbol}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
        {price != null ? price : "—"}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 700,
          color: up == null ? "#aaa" : (up ? "#2fe08d" : "#ff6b6b"),
        }}
      >
        MA100 대비 {deltaPct != null ? `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct).toFixed(2)}%` : "--"}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * 차트 패널
 * ───────────────────────────────────────────────────────── */
function ChartPanel({ symbol, globalInterval, dayOffset, onBounds, onStats }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const maSeriesRef = useRef(null);
  const roRef = useRef(null);
  const allBarsRef = useRef([]);   // 1분봉
  const dailyBarsRef = useRef([]); // 일봉
  const markersAllRef = useRef([]); // 7일치 마커 전체
  const notesAllRef = useRef([]);   // 7일치 노트 전체
  const [notesView, setNotesView] = useState([]);
  const versionRef = useRef(0);
  const dayOffsetRef = useRef(dayOffset);
  useEffect(() => { dayOffsetRef.current = dayOffset; }, [dayOffset]);

  function applyMarkersAndNotes(bars, dayOff, interval) {
    if (!seriesRef.current) return;
    const allM = markersAllRef.current || [];
    const allN = notesAllRef.current || [];
    if (interval === "1") {
      const [start, end] = getWindowRangeUtcFromBars(bars, dayOff);
      const m = allM.filter((x) => x.time >= start && x.time < end);
      const n = allN.filter((x) => x.timeSec >= start && x.timeSec < end);
      seriesRef.current.setMarkers(m);
      setNotesView(n);
    } else {
      seriesRef.current.setMarkers([]);
      setNotesView([]);
    }
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const myVersion = ++versionRef.current;

    // cleanup 콜렉션(리스너 해제용)
    const cleanups = [];
    const lastBoundsRef = { current: null };

    // 기존 리소스 정리
    try { roRef.current?.disconnect(); } catch {}
    try { chartRef.current?.remove(); } catch {}
    chartRef.current = null;
    seriesRef.current = null;
    maSeriesRef.current = null;
    markersAllRef.current = [];
    notesAllRef.current = [];
    setNotesView([]);

    // 차트 생성
    const width = Math.max(320, el.clientWidth || 0);
    const chart = createChart(el, {
      width,
      height: 300,
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
    });

    const MAX_1M_BARS = 43200;

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

    if (versionRef.current !== myVersion) {
      chart.remove();
      return;
    }
    chartRef.current = chart;
    seriesRef.current = candleSeries;
    maSeriesRef.current = maSeries;

    // 리사이즈 옵저버
    const ro = new ResizeObserver(() => {
      if (versionRef.current !== myVersion) return;
      if (!chartRef.current || !wrapRef.current) return;
      const w = Math.max(320, wrapRef.current.clientWidth || 0);
      chartRef.current.applyOptions({ width: w });
    });
    ro.observe(el);
    roRef.current = ro;

    (async () => {
      try {
        const limit = globalInterval === "1" ? 10080 : 300;
        const restPath = `/api/klines?symbol=${symbol}&interval=${globalInterval}&limit=${limit}`;
        const resp = await fetch(restPath, { cache: "no-store" });
        const json = await resp.json();
        if (!resp.ok || json?.retCode !== 0) throw new Error(`bad response: ${resp.status}`);

        const rows = Array.isArray(json?.list) ? json.list : [];
        const normalized = rows.map((r) => {
          let t = Number(r.time);
          if (t > 1e12) t = Math.floor(t / 1000);
          return { time: t, open: +r.open, high: +r.high, low: +r.low, close: +r.close };
        });
        const dedup = new Map();
        for (const b of normalized) dedup.set(b.time, b);
        const bars = [...dedup.values()].sort((a, b) => a.time - b.time);

        if (versionRef.current !== myVersion) return;

        // 시그널 로드
        const sigs = await fetchSignals(symbol);
        const { markers, notes } = buildSignalAnnotations(sigs);
        markersAllRef.current = markers;
        notesAllRef.current = notes;

        if (globalInterval === "1") {
          // ── 1분봉 초기 세팅
          allBarsRef.current = bars;
          const [start, end] = getWindowRangeUtcFromBars(bars, 0);
          const priceSlice = bars.filter((b) => b.time >= start && b.time < end);
          const forMa = sliceWithBuffer(bars, start, end, 99);
          const ma100 = calcSMA(forMa, 100).filter((p) => p.time >= start && p.time < end);

          if (priceSlice.length > 0) {
            candleSeries.setData(priceSlice);
            maSeries.setData(ma100);
            const from = priceSlice[0].time;
            const to = priceSlice[priceSlice.length - 1].time;
            chartRef.current?.timeScale().setVisibleRange({ from, to });

            // 카드용 최신(항상 전체 1분봉 기준)
            const lastCloseAll = bars.length ? bars[bars.length - 1].close : null;
            const lastMaAll = calcLatestMAValue(bars, 100);
            onStats?.(symbol, { price1m: lastCloseAll, ma100_1m: lastMaAll });
          } else {
            candleSeries.setData([]);
            maSeries.setData([]);
            chartRef.current?.timeScale().fitContent();
          }

          applyMarkersAndNotes(bars, 0, "1");

          // bounds 계산
          const hasData = (off) => {
            const [s, e] = getWindowRangeUtcFromBars(bars, off);
            if (!s && !e) return false;
            return bars.some((b) => b.time >= s && b.time < e);
          };
          let min = 0, max = 0;
          while (hasData(min - 1)) min -= 1;
          while (hasData(max + 1)) max += 1;
          onBounds?.(symbol, { min, max });

          // ✅ 1분봉 WS 리스너 등록 (허브 사용)
          const TOPIC_1M = `kline.1.${symbol}`;
          const off1m = wsHub.addListener(TOPIC_1M, (d) => {
            const bar = {
              time: Math.floor(Number(d.start) / 1000),
              open: +d.open, high: +d.high, low: +d.low, close: +d.close,
            };
            // 원본 머지 + 오래된 것 슬라이스
            let arr = mergeBars(allBarsRef.current || [], bar);
            if (arr.length > MAX_1M_BARS) arr = arr.slice(-MAX_1M_BARS);
            allBarsRef.current = arr;

            // 현재 dayOffset 윈도우 갱신
            const [wStart, wEnd] = getWindowRangeUtcFromBars(arr, dayOffsetRef.current);
            const priceSliceWS = arr.filter((b) => b.time >= wStart && b.time < wEnd);
            const forMaWS = sliceWithBuffer(arr, wStart, wEnd, 99);
            const ma100WS = calcSMA(forMaWS, 100).filter((p) => p.time >= wStart && p.time < wEnd);

            if (priceSliceWS.length) {
              seriesRef.current?.setData(priceSliceWS);
              maSeriesRef.current?.setData(ma100WS);
            }

            // 카드용 최신(항상 최신 1분봉 기반)
            const lastClose = arr.length ? arr[arr.length - 1].close : null;
            const lastMa = calcLatestMAValue(arr, 100);
            onStats?.(symbol, { price1m: lastClose, ma100_1m: lastMa });

            // 마커/노트
            applyMarkersAndNotes(arr, dayOffsetRef.current, "1");

            // bounds 필요 시 갱신
            const hasDataDyn = (off) => {
              const [s, e] = getWindowRangeUtcFromBars(arr, off);
              if (!s && !e) return false;
              return arr.some((b) => b.time >= s && b.time < e);
            };
            let newMin = 0, newMax = 0;
            while (hasDataDyn(newMin - 1)) newMin -= 1;
            while (hasDataDyn(newMax + 1)) newMax += 1;
            const nowBounds = `${newMin}:${newMax}`;
            if (lastBoundsRef.current !== nowBounds) {
              lastBoundsRef.current = nowBounds;
              onBounds?.(symbol, { min: newMin, max: newMax });
            }
          });
          cleanups.push(off1m);

        } else {
          // ── 일봉 초기 세팅
          dailyBarsRef.current = bars;
          candleSeries.setData(bars);
          maSeries.setData(calcSMA(bars, 100));
          chartRef.current?.timeScale().fitContent();

          // 카드: 일봉 기준
          const lastCloseD = bars.length ? bars[bars.length - 1].close : null;
          const lastMaD = calcLatestMAValue(bars, 100);
          onStats?.(symbol, { priceD: lastCloseD, ma100_D: lastMaD });

          // ✅ 일봉 WS 리스너 등록
          const TOPIC_1D = `kline.D.${symbol}`;
          const off1d = wsHub.addListener(TOPIC_1D, (d) => {
            const bar = {
              time: Math.floor(Number(d.start) / 1000),
              open: +d.open, high: +d.high, low: +d.low, close: +d.close,
            };
            dailyBarsRef.current = mergeBars(dailyBarsRef.current || [], bar);
            seriesRef.current?.update(bar);
            maSeriesRef.current?.setData(calcSMA(dailyBarsRef.current, 100));

            // 카드: 일봉 기준
            const lastClose = dailyBarsRef.current.length
              ? dailyBarsRef.current[dailyBarsRef.current.length - 1].close
              : null;
            const lastMa = calcLatestMAValue(dailyBarsRef.current, 100);
            onStats?.(symbol, { priceD: lastClose, ma100_D: lastMa });

            // 일봉은 마커를 전체/세션없이 유지
            applyMarkersAndNotes(dailyBarsRef.current, 0, "D");
          });
          cleanups.push(off1d);
        }
      } catch (e) {
        console.error("[REST] failed", e);
      }
    })();

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      maSeriesRef.current = null;
      allBarsRef.current = [];
      dailyBarsRef.current = [];
      markersAllRef.current = [];
      notesAllRef.current = [];
      setNotesView([]);
      // 허브에서 리스너만 해제(소켓은 계속 유지)
      cleanups.forEach(fn => { try { fn(); } catch {} });
    };
  }, [symbol, globalInterval, onBounds, onStats]);

  // 1분봉에서 날짜 이동 시 재세팅
  useEffect(() => {
    if (!seriesRef.current || globalInterval !== "1") return;
    const bars = allBarsRef.current || [];
    if (!bars.length) return;
    const [start, end] = getWindowRangeUtcFromBars(bars, dayOffset);
    const priceSlice = bars.filter((b) => b.time >= start && b.time < end);
    const forMa = sliceWithBuffer(bars, start, end, 99);
    const ma100 = calcSMA(forMa, 100).filter((p) => p.time >= start && p.time < end);
    seriesRef.current.setData(priceSlice);
    maSeriesRef.current?.setData(ma100);
    if (priceSlice.length > 0) {
      const from = priceSlice[0].time;
      const to = priceSlice[priceSlice.length - 1].time;
      chartRef.current?.timeScale().setVisibleRange({ from, to });
    } else {
      chartRef.current?.timeScale().fitContent();
    }
    applyMarkersAndNotes(bars, dayOffset, "1");
  }, [dayOffset, globalInterval]);

  // 표시 범위 표기(1분봉일 때만)
  const [sUtc, eUtc] = useMemo(() => {
    const bars = globalInterval === "1" ? allBarsRef.current || [] : dailyBarsRef.current || [];
    return globalInterval === "1" ? getWindowRangeUtcFromBars(bars, dayOffset) : [0, 0];
  }, [dayOffset, globalInterval]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
        {symbol} · {globalInterval === "1" ? "1분봉" : "1일봉"} · MA100 ·{" "}
        <code>{globalInterval === "D" ? `kline.D.${symbol}` : "kline.1.${symbol}`"}</code>
      </div>
      <div
        ref={wrapRef}
        style={{
          width: "100%",
          height: 300,
          borderRadius: 12,
          overflow: "hidden",
          background: "#111",
        }}
      />
      {globalInterval === "1" && sUtc ? (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
          보기(KST): {fmtKSTFull(sUtc)} ~ {fmtKSTFull(eUtc)}
        </div>
      ) : null}

      {/* ▼ 시그널 설명 패널 */}
      <div
        style={{
          marginTop: 10,
          background: "#161616",
          border: "1px solid #262626",
          borderRadius: 12,
          padding: "10px 12px",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, opacity: 0.9 }}>
          {symbol} · 시그널 설명 {notesView.length ? `(${notesView.length})` : ""}
        </div>
        {notesView.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>표시 구간에 시그널 없음</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {notesView.map((n) => {
              const side = String(n.side || "").toUpperCase();
              const sideColor = side === "LONG" ? "#16a34a" : side === "SHORT" ? "#dc2626" : "#9ca3af";
              const reasonsTxt = n.reasons?.length ? ` (${n.reasons.join(", ")})` : "";
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
                      gridTemplateColumns: "6ch 6ch 7ch 14ch 1fr",
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
                      `${n.kind} ${side}`,
                      n.price,
                      fmtKSTFull(n.timeSec),
                      reasonsTxt,
                    ].filter(Boolean).join(" · ")}
                  >
                    <b style={{ opacity: 0.95 }}>#{n.seq}</b>
                    <span style={{ opacity: 0.85 }}>{n.kind}</span>
                    <span style={{ color: sideColor, fontWeight: 700 }}>{side}</span>
                    <span>{n.price}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", fontFamily: "inherit" }}>
                      {fmtKSTFull(n.timeSec)}{reasonsTxt}
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
 * 페이지
 * ───────────────────────────────────────────────────────── */
export default function Coin() {
  const [interval, setInterval_] = useState("1"); // "1" | "D"
  const [dayOffset, setDayOffset] = useState(0);

  // 카드용 최신 수치 저장: 1분봉과 일봉을 모두 저장해두고, 표시만 interval에 따라 고름
  const [statsMap, setStatsMap] = useState({}); // { [symbol]: { price1m, ma100_1m, priceD, ma100_D } }
  const onStats = useCallback((symbol, stats) => {
    setStatsMap(prev => ({ ...prev, [symbol]: { ...prev[symbol], ...stats } }));
  }, []);

  const symbols = [
    { symbol: "BTCUSDT", market: "linear" },
    { symbol: "ETHUSDT", market: "linear" },
    { symbol: "XAUTUSDT", market: "linear" },
  ];
  const requiredSymbols = symbols.map((s) => s.symbol);

  // 각 심볼 별 이동 가능 오프셋 범위 수집
  const [perSymbolBounds, setPerSymbolBounds] = useState({});
  const onBounds = useCallback((symbol, bounds) => {
    setPerSymbolBounds(prev => ({ ...prev, [symbol]: bounds }));
  }, []);

  // 세 차트 모두 공통 범위
  const { minOffset, maxOffset, boundsReady } = useMemo(() => {
    const haveAll = requiredSymbols.every((sym) => perSymbolBounds[sym]);
    if (!haveAll) return { minOffset: 0, maxOffset: 0, boundsReady: false };
    const values = requiredSymbols.map((sym) => perSymbolBounds[sym]);
    const minCommon = Math.max(...values.map((b) => b.min ?? 0));
    const maxCommon = Math.min(...values.map((b) => b.max ?? 0));
    return { minOffset: minCommon, maxOffset: maxCommon, boundsReady: true };
  }, [perSymbolBounds, requiredSymbols]);
  const [wsConnected, setWsConnected] = useState(false);
    useEffect(() => {
  const off = wsHub.onStatus(setWsConnected);  // 허브 연결 상태 구독
  return () => off();
}, []);
  // 공통 범위 바뀌면 dayOffset 클램프
  useEffect(() => {
    if (interval !== "1" || !boundsReady) return;
    setDayOffset(d => Math.min(Math.max(d, minOffset), maxOffset));
  }, [interval, boundsReady, minOffset, maxOffset]);

  const atMin = interval === "1" && boundsReady && dayOffset <= minOffset;
  const atMax = interval === "1" && boundsReady && dayOffset >= maxOffset;

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
    <div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc", marginBottom: 8 }}>멀티 차트 · 시그널 표시</h1>
        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
  WS 연결 상태: {wsConnected ? "✅ 연결됨" : "❌ 끊김 (자동 재연결 중)"}
</div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
        {/* 왼쪽: 티커 카드들 + 컨트롤 */}
        <div>
          <div
            style={{
              position: "sticky",
              top: 12,
              zIndex: 5,
              padding: "14px 16px",
              borderRadius: 14,
              background: "#1a1a1a",
              marginBottom: 14,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>보기 설정</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setInterval_("1");
                  setDayOffset(0);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: 0,
                  background: interval === "1" ? "#00ffcc" : "#2a2a2a",
                  color: interval === "1" ? "#000" : "#fff",
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
                  background: interval === "D" ? "#00ffcc" : "#2a2a2a",
                  color: interval === "D" ? "#000" : "#fff",
                  fontWeight: 700,
                }}
              >
                1일봉
              </button>
            </div>

            {interval === "1" && (
              <>
                <div style={{ height: 10 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setDayOffset((d) => Math.max(minOffset, d - 1))}
                    disabled={!boundsReady || atMin}
                    style={disBtnStyle(!boundsReady || atMin)}
                  >
                    ◀ 전날
                  </button>
                  <button
                    onClick={() => setDayOffset(0)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: 0,
                      background: "#00ffcc",
                      color: "#000",
                      fontWeight: 700,
                    }}
                  >
                    오늘
                  </button>
                  <button
                    onClick={() => setDayOffset((d) => Math.min(maxOffset, d + 1))}
                    disabled={!boundsReady || atMax}
                    style={disBtnStyle(!boundsReady || atMax)}
                  >
                    다음날 ▶
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 티커 카드 3개 */}
          <div style={{ display: "grid", gap: 12 }}>
            {symbols.map((s) => (
              <TickerCard
                key={s.symbol}
                symbol={s.symbol}
                interval={interval}
                stats={statsMap[s.symbol]}
                 connected={wsConnected}
              />
            ))}
          </div>
        </div>

        {/* 오른쪽: 세로 스택 차트 3개 */}
        <div>
          <ChartPanel
            symbol="BTCUSDT"
            globalInterval={interval}
            dayOffset={dayOffset}
            onBounds={onBounds}
            onStats={onStats}
          />
          <ChartPanel
            symbol="ETHUSDT"
            globalInterval={interval}
            dayOffset={dayOffset}
            onBounds={onBounds}
            onStats={onStats}
          />
          <ChartPanel
            symbol="XAUTUSDT"
            globalInterval={interval}
            dayOffset={dayOffset}
            onBounds={onBounds}
            onStats={onStats}
          />
        </div>
      </div>
    </div>
  );
}
