// src/pages/Coin.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { createChart } from "lightweight-charts";

/** ─────────────────────────────────────────────────────────
 * 공통 유틸
 * ───────────────────────────────────────────────────────── */
const KST_OFFSET_SEC = 9 * 3600;
const DAY_SEC = 24 * 3600;

// tsSec(UTC seconds) → "세션 anchor 날짜(YYYY-MM-DD, KST 06:50 기준)"를 돌려줌
function sessionKeyKST_0650(tsSec) {
  // KST로 옮겨서 06:50 오프셋을 뺀 뒤 day 경계로 내림
  const kst = tsSec + KST_OFFSET_SEC;
  const sessionStartKst = Math.floor((kst - (6*3600 + 50*60)) / DAY_SEC) * DAY_SEC + (6*3600 + 50*60);
  // 라벨은 보기 좋게 KST 날짜(YYYY-MM-DD)로
  const d = new Date((sessionStartKst - KST_OFFSET_SEC) * 1000); // 다시 UTC 기준 Date
  const yyyy = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric" });
  const mm   = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit" });
  const dd   = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", day: "2-digit" });
  return `${yyyy}-${mm}-${dd}`;
}


const getTs = (t) =>
  typeof t === "number" ? t : t && typeof t.timestamp === "number" ? t.timestamp : 0;

const fmtUSD = (v) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);

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
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit" }).format(
    tsSec * 1000
  );

const fmtKSTHour = (tsSec) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
    hour: "2-digit",
  }).format(tsSec * 1000);

// 마지막 바 기준 KST 00:00(anchor) → UTC초
function getAnchorKstMidnightUtcSec(bars) {
  if (!bars?.length) return null;
  const lastUtc = bars[bars.length - 1].time;
  const lastKst = lastUtc + KST_OFFSET_SEC;
  const kstMidnight = Math.floor(lastKst / DAY_SEC) * DAY_SEC;
  return kstMidnight - KST_OFFSET_SEC;
}
// KST 06:50 시작 ~ +24h 윈도우(UTC초)
function getWindowRangeUtcFromBars(bars, offsetDays) {
  const anchorMidnightUtc = getAnchorKstMidnightUtcSec(bars);
  if (anchorMidnightUtc == null) return [0, 0];
  const startKst =
    anchorMidnightUtc + KST_OFFSET_SEC + (6 * 3600 + 50 * 60) + offsetDays * DAY_SEC;
  const startUtc = startKst - KST_OFFSET_SEC;
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

// MA100 계산(클라이언트)
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

/** ─────────────────────────────────────────────────────────
 * 시그널 도우미
 * ───────────────────────────────────────────────────────── */
async function fetchSignals(symbol) {
  const url = `/api/signals?symbol=${symbol}&days=7`;
  const res = await fetch(url, { cache: "no-store" });
  const j = await res.json();
  return Array.isArray(j?.signals) ? j.signals : [];
}

/** 시그널을 날짜별로 그룹 → (1,2,3…) 순번 부여 → 마커/노트 생성 */
function buildSignalAnnotations(sigs) {
  const items = sigs
    .map((s) => {
      const ts = s.ts || s.time || s.timeSec;
      const timeSec = s.timeSec ? Number(s.timeSec) : Math.floor(new Date(ts).getTime() / 1000);
      const sessionKey = sessionKeyKST_0650(timeSec);  // ← 세션 기준 키
      return { ...s, timeSec, sessionKey };
    })
    .sort((a, b) => a.timeSec - b.timeSec);

  // 세션별로 순번(1,2,3…)
  const bySession = new Map();
  for (const s of items) {
    if (!bySession.has(s.sessionKey)) bySession.set(s.sessionKey, []);
    bySession.get(s.sessionKey).push(s);
  }

  const annotated = [];
  for (const [_, list] of bySession.entries()) {
    // 세션 내부에서도 시간순 보장
    list.sort((a, b) => a.timeSec - b.timeSec).forEach((s, idx) => {
      annotated.push({ ...s, seq: idx + 1 });
    });
  }
  annotated.sort((a, b) => a.timeSec - b.timeSec);

  // 마커 & 노트 생성
  const markers = [];
  const notes = [];
  for (const s of annotated) {
    const isEntry = s.kind === "ENTRY";
    const isExit  = s.kind === "EXIT";
    const isLong  = s.side === "LONG";
    const isShort = s.side === "SHORT";

    let position = "aboveBar";
    let color = "#ffd166";
    let shape = "arrowDown";
    if (isEntry && isLong)  { position = "belowBar"; color = "#2fe08d"; shape = "arrowUp"; }
    if (isEntry && isShort) { position = "aboveBar"; color = "#ff6b6b"; shape = "arrowDown"; }
    if (isExit  && isLong)  { position = "aboveBar"; color = "#2fe08d"; shape = "arrowDown"; }
    if (isExit  && isShort) { position = "belowBar"; color = "#ff6b6b"; shape = "arrowUp"; }

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


/** ─────────────────────────────────────────────────────────
 * 티커 카드 (WS)
 * props: { symbol, market: 'linear'|'spot' }
 * ───────────────────────────────────────────────────────── */
function TickerCard({ symbol, market = "linear" }) {
  const [connected, setConnected] = useState(false);
  const [price, setPrice] = useState(null);
  const [changePct, setChangePct] = useState(null);
  const [mark, setMark] = useState(null);
  const [funding, setFunding] = useState(null);

  useEffect(() => {
    const wsUrl =
      market === "spot"
        ? "wss://stream.bybit.com/v5/public/spot"
        : "wss://stream.bybit.com/v5/public/linear";
    const topic = `tickers.${symbol}`;
    let timer = null;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ op: "subscribe", args: [topic] }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data || "{}");
        if (msg.topic === topic && msg.data) {
          const d = Array.isArray(msg.data) ? msg.data[0] : msg.data;
          if (d?.lastPrice) setPrice(parseFloat(d.lastPrice));
          if (d?.price24hPcnt) setChangePct(parseFloat(d.price24hPcnt) * 100);
          if (d?.markPrice) setMark(parseFloat(d.markPrice));
          if (d?.fundingRate) setFunding(parseFloat(d.fundingRate) * 100);
        }
      } catch {}
    };
    ws.onclose = () => {
      setConnected(false);
      timer = setTimeout(() => {
        // 필요하면 자동 재접속 구현
      }, 1000);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
    return () => {
      if (timer) clearTimeout(timer);
      try {
        ws.close();
      } catch {}
    };
  }, [symbol, market]);

  const up = (changePct ?? 0) >= 0;

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
        {price != null ? fmtUSD(price) : "—"}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 700,
          color: up ? "#2fe08d" : "#ff6b6b",
        }}
      >
        24h {up ? "▲" : "▼"}{" "}
        {changePct != null ? `${Math.abs(changePct).toFixed(2)}%` : "--"}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 8, opacity: 0.9 }}>
        <div>마크: {mark != null ? fmtUSD(mark) : "--"}</div>
        {market === "linear" && (
          <div>펀딩: {funding != null ? `${funding.toFixed(4)}%` : "--"}</div>
        )}
        <div style={{ opacity: 0.7, marginTop: 6 }}>연결: {connected ? "✅" : "❌"}</div>
      </div>
    </div>
  );
}

/** ─────────────────────────────────────────────────────────
 * 차트 패널 (심볼 1개)
 * props: { symbol, globalInterval, dayOffset }
 *  - 1분봉: REST 10080개 로드, WS 없음, 시그널=윈도우 필터
 *  - 1일봉: REST 300개 + WS 유지, 시그널=7일 전체
 *  - 시그널: 마커엔 #순번만, 아래 패널에 상세(reasons) 나열
 * ───────────────────────────────────────────────────────── */
function ChartPanel({ symbol, globalInterval, dayOffset }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const maSeriesRef = useRef(null);
  const roRef = useRef(null);
  const wsRef = useRef(null);
  const allBarsRef = useRef([]);  // 1분봉 원본 (10080)
  const dailyBarsRef = useRef([]); // 일봉 원본
  const markersAllRef = useRef([]); // 7일치 마커 전체
  const notesAllRef = useRef([]);   // 7일치 노트 전체
  const [notesView, setNotesView] = useState([]); // 현재 보여줄 노트
  const versionRef = useRef(0);

  // 마커+노트 적용
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
      seriesRef.current.setMarkers(allM);
      setNotesView(allN);
    }
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const myVersion = ++versionRef.current;

    // 정리
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    try { roRef.current?.disconnect(); } catch {}
    roRef.current = null;
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

    // 리사이즈
    const ro = new ResizeObserver(() => {
      if (versionRef.current !== myVersion) return;
      if (!chartRef.current || !wrapRef.current) return;
      const w = Math.max(320, wrapRef.current.clientWidth || 0);
      chartRef.current.applyOptions({ width: w });
    });
    ro.observe(el);
    roRef.current = ro;

    // REST 초기 로드
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

        // 시그널 불러와서 번호부여 → 마커/노트 만들기
        const sigs = await fetchSignals(symbol);
        const { markers, notes } = buildSignalAnnotations(sigs);
        markersAllRef.current = markers;
        notesAllRef.current = notes;

        if (globalInterval === "1") {
          allBarsRef.current = bars;
          const [start, end] = getWindowRangeUtcFromBars(bars, 0);
          const priceSlice = bars.filter((b) => b.time >= start && b.time < end);
          const forMa = sliceWithBuffer(bars, start, end, 99);
          const ma100 = calcSMA(forMa, 100).filter((p) => p.time >= start && p.time < end);

          candleSeries.setData(priceSlice);
          maSeries.setData(ma100);
          chartRef.current?.timeScale().setVisibleRange({ from: start, to: end });

          // 마커/노트 적용(윈도우 필터)
          applyMarkersAndNotes(allBarsRef.current, 0, "1");
        } else {
          // 일봉
          dailyBarsRef.current = bars;
          candleSeries.setData(bars);
          maSeries.setData(calcSMA(bars, 100));
          chartRef.current?.timeScale().fitContent();

          // 마커/노트 적용(7일 전체)
          applyMarkersAndNotes(dailyBarsRef.current, 0, "D");
        }
      } catch (e) {
        console.error("[REST] failed", e);
      }
    })();

    // 1일봉만 WS
    if (globalInterval === "D") {
      const wsUrl = "wss://stream.bybit.com/v5/public/linear";
      const TOPIC = `kline.D.${symbol}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (versionRef.current !== myVersion) return;
        ws.send(JSON.stringify({ op: "subscribe", args: [TOPIC] }));
      };
      ws.onmessage = (e) => {
        if (versionRef.current !== myVersion || !seriesRef.current) return;
        try {
          const msg = JSON.parse(e.data || "{}");
          if (msg.topic === TOPIC && msg.data) {
            const d = Array.isArray(msg.data) ? msg.data[0] : msg.data;
            const bar = {
              time: Math.floor(Number(d.start) / 1000),
              open: +d.open,
              high: +d.high,
              low: +d.low,
              close: +d.close,
            };
            dailyBarsRef.current = mergeBars(dailyBarsRef.current || [], bar);
            seriesRef.current.update(bar);
            maSeriesRef.current?.setData(calcSMA(dailyBarsRef.current, 100));

            // 마커/노트는 그대로(7일) 유지
            applyMarkersAndNotes(dailyBarsRef.current, 0, "D");
          }
        } catch {}
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    }

    return () => {
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
      try { roRef.current?.disconnect(); } catch {}
      roRef.current = null;
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      maSeriesRef.current = null;
      allBarsRef.current = [];
      dailyBarsRef.current = [];
      markersAllRef.current = [];
      notesAllRef.current = [];
      setNotesView([]);
    };
  }, [symbol, globalInterval]);

  // 1분봉에서 날짜 이동 시: 데이터/MA/마커/노트 재세팅
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
    seriesRef.current.setMarkers([]); // 깜빡임 방지 초기화
    chartRef.current?.timeScale().setVisibleRange({ from: start, to: end });
    applyMarkersAndNotes(bars, dayOffset, "1");
  }, [dayOffset, globalInterval]);

  // 표시 범위 표기(1분봉일 때만)
  const [sUtc, eUtc] = useMemo(() => {
    const bars =
      globalInterval === "1" ? allBarsRef.current || [] : dailyBarsRef.current || [];
    return globalInterval === "1" ? getWindowRangeUtcFromBars(bars, dayOffset) : [0, 0];
  }, [dayOffset, globalInterval]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
        {symbol} · {globalInterval === "1" ? "1분봉" : "1일봉"} · MA100 ·{" "}
        <code>{globalInterval === "D" ? `kline.D.${symbol}` : "REST only"}</code>
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
          보기(KST): {fmtKSTFull(sUtc + KST_OFFSET_SEC)} ~ {fmtKSTFull(eUtc + KST_OFFSET_SEC)}
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
            {notesView.map((n) => (
              <div
                key={n.key}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "#1b1b1b",
                  border: "1px solid #2a2a2a",
                }}
              >
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <b>#{n.seq}</b>{" "}
                  <span style={{ opacity: 0.9 }}>
                    · {n.kind} {n.side} @ {fmtUSD(n.price)} · {fmtKSTFull(n.timeSec + KST_OFFSET_SEC)}
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {n.reasons.map((r, i) => (
                    <li key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** ─────────────────────────────────────────────────────────
 * 페이지
 * ───────────────────────────────────────────────────────── */
export default function Coin() {
  // 공통 인터벌 (세 차트 동기)
  const [interval, setInterval_] = useState("1"); // "1" | "D"
  const [dayOffset, setDayOffset] = useState(0); // 1분봉 전/다음날
  // 왼쪽 카드용 심볼 세트
  const symbols = [
    { symbol: "BTCUSDT", market: "linear" },
    { symbol: "ETHUSDT", market: "linear" },
    { symbol: "XAUTUSDT", market: "spot" }, // XAUTUSDT가 spot일 가능성 대비
  ];

  return (
    <div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc", marginBottom: 8 }}>멀티 차트 · 시그널 표시</h1>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
        {/* 왼쪽: 티커 카드들 + 컨트롤 */}
        <div>
          {/* 컨트롤 */}
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
                    onClick={() => setDayOffset((d) => d - 1)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: 0,
                      background: "#2a2a2a",
                      color: "#fff",
                      fontWeight: 700,
                    }}
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
                    onClick={() => setDayOffset((d) => d + 1)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: 0,
                      background: "#2a2a2a",
                      color: "#fff",
                      fontWeight: 700,
                    }}
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
              <TickerCard key={s.symbol} symbol={s.symbol} market={s.market} />
            ))}
          </div>
        </div>

        {/* 오른쪽: 세로 스택 차트 3개 */}
        <div>
          <ChartPanel symbol="BTCUSDT" globalInterval={interval} dayOffset={dayOffset} />
          <ChartPanel symbol="ETHUSDT" globalInterval={interval} dayOffset={dayOffset} />
          <ChartPanel symbol="XAUTUSDT" globalInterval={interval} dayOffset={dayOffset} />
        </div>
      </div>
    </div>
  );
}
