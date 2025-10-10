// src/pages/Coin.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

export default function Coin() {
  // ====== UI 상태 ======
  const [interval, setInterval_] = useState("1"); // "1" (1분) | "D" (1일)

  // 가격 패널(티커) 상태
  const [connected, setConnected] = useState(false);
  const [price, setPrice] = useState(null);
  const [changePct, setChangePct] = useState(null);
  const [mark, setMark] = useState(null);
  const [funding, setFunding] = useState(null);
  const up = (changePct ?? 0) >= 0;
  const fmtUSD = (v) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

  // ====== 차트 refs ======
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);

  // ====== WS refs (티커/캔들 분리) ======
  const wsTickerRef = useRef(null);
  const wsKlineRef = useRef(null);

  // 세대 토큰 (StrictMode/HMR 안전)
  const versionRef = useRef(0);

  // ─────────────────────────────────────────
  // 1) 실시간 티커 (현재가/24h/마크/펀딩)
  // ─────────────────────────────────────────
  useEffect(() => {
    const wsUrl = "wss://stream.bybit.com/v5/public/linear";
    const TICKER = "tickers.BTCUSDT";
    let reconnectTimer = null;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsTickerRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ op: "subscribe", args: [TICKER] }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data || "{}");
          if (msg.topic === TICKER && msg.data) {
            const d = Array.isArray(msg.data) ? msg.data[0] : msg.data;
            if (d?.lastPrice) setPrice(parseFloat(d.lastPrice));
            if (d?.price24hPcnt) setChangePct(parseFloat(d.price24hPcnt) * 100); // 0.0123 → 1.23%
            if (d?.markPrice) setMark(parseFloat(d.markPrice));
            if (d?.fundingRate) setFunding(parseFloat(d.fundingRate) * 100);     // -0.0001 → -0.01%
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { wsTickerRef.current?.close(); } catch {}
      wsTickerRef.current = null;
    };
  }, []); // ★ 티커는 interval과 무관하게 한 번만

  // ─────────────────────────────────────────
  // 2) 차트 생성/파괴 + REST 초기 300개 + WS 실시간
  // ─────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const myVersion = ++versionRef.current;

    // 이전 자원 정리
    try { wsKlineRef.current?.close(); } catch {}
    wsKlineRef.current = null;
    try { roRef.current?.disconnect(); } catch {}
    roRef.current = null;
    try { chartRef.current?.remove(); } catch {}
    chartRef.current = null;
    seriesRef.current = null;

    // 차트 만들기
    const width = Math.max(320, el.clientWidth || 0);
    const chart = createChart(el, {
      width,
      height: 360,
      layout: { background: { color: "#111" }, textColor: "#ddd" },
      grid: { vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
      timeScale: { timeVisible: true, secondsVisible: interval === "1" },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#2fe08d",
      downColor: "#ff6b6b",
      borderUpColor: "#2fe08d",
      borderDownColor: "#ff6b6b",
      wickUpColor: "#2fe08d",
      wickDownColor: "#ff6b6b",
    });

    if (versionRef.current !== myVersion) {
      chart.remove();
      return;
    }
    chartRef.current = chart;
    seriesRef.current = series;

    // (가시성 확인용) 더미 2캔들 — 곧 실제 데이터로 덮임
    series.setData([
      { time: Math.floor(Date.now()/1000) - 120, open: 64000, high: 64100, low: 63900, close: 64050 },
      { time: Math.floor(Date.now()/1000) -  60, open: 64050, high: 64200, low: 64000, close: 64180 },
    ]);

    // 리사이즈 대응
    const ro = new ResizeObserver(() => {
      if (versionRef.current !== myVersion) return;
      if (!chartRef.current || !wrapRef.current) return;
      const w = Math.max(320, wrapRef.current.clientWidth || 0);
      chartRef.current.applyOptions({ width: w });
    });
    ro.observe(el);
    roRef.current = ro;

    // 초기 300개 (REST)
    (async () => {
      try {
        const restPath = `/api/kline?category=linear&symbol=BTCUSDT&interval=${interval}&limit=300`;
        const resp = await fetch(restPath);
        const txt = await resp.text();

        // JSON 아닌 경우(리라이트/경로 문제) 바로 확인
        if (!resp.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Not JSON: " + txt.slice(0, 200));
        }

        const json = JSON.parse(txt);
        const rows = json?.result?.list || [];
        const data = rows
          .map(r => ({
            time: Math.floor(Number(r[0]) / 1000),
            open: Number(r[1]),
            high: Number(r[2]),
            low:  Number(r[3]),
            close:Number(r[4]),
          }))
          .reverse();

        if (versionRef.current === myVersion && seriesRef.current && data.length) {
          seriesRef.current.setData(data);
        }
      } catch (e) {
        console.error("[REST] failed", e);
        console.warn("kline REST failed", e);
      }
    })();


    // 실시간 Kline WS
    const wsUrl = "wss://stream.bybit.com/v5/public/linear";
    const TOPIC = `kline.${interval}.BTCUSDT`;
    const ws = new WebSocket(wsUrl);
    wsKlineRef.current = ws;

    ws.onopen = () => {
      if (versionRef.current !== myVersion) return;
      ws.send(JSON.stringify({ op: "subscribe", args: [TOPIC] }));
    };
    ws.onmessage = (e) => {
      if (versionRef.current !== myVersion) return;
      try {
        const msg = JSON.parse(e.data || "{}");
        if (msg.topic === TOPIC && msg.data && seriesRef.current) {
          const d = Array.isArray(msg.data) ? msg.data[0] : msg.data;
          const bar = {
            time: Math.floor(Number(d.start) / 1000),
            open: Number(d.open),
            high: Number(d.high),
            low:  Number(d.low),
            close:Number(d.close),
          };
          seriesRef.current.update(bar);
        }
      } catch {}
    };

    // cleanup는 다음 세대 시작에서 일괄 정리
  }, [interval]);

  return (
    <div style={{ padding: "24px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc", marginBottom: 8 }}>비트코인 선물 실시간 (Bybit · BTCUSDT)</h1>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* 왼쪽: 가격 카드 (티커 실시간 유지) */}
        <div style={{
          flex: "0 0 320px",
          padding: "20px 24px",
          borderRadius: 16,
          background: "#1a1a1a",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)"
        }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>현재가 (USDT≈USD)</div>
          <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>
            {price != null ? fmtUSD(price) : "불러오는 중…"}
          </div>
          <div style={{
            marginTop: 10, fontSize: 16, fontWeight: 600,
            color: up ? "#2fe08d" : "#ff6b6b"
          }}>
            24h {up ? "▲" : "▼"} {changePct != null ? `${Math.abs(changePct).toFixed(2)}%` : "--"}
          </div>
          <hr style={{ border: 0, borderTop: "1px solid #2a2a2a", margin: "16px 0" }} />
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <div>마크가격: {mark != null ? fmtUSD(mark) : "--"}</div>
            <div>펀딩비: {funding != null ? `${funding.toFixed(4)}%` : "--"}</div>
            <div style={{ opacity: 0.7, marginTop: 8 }}>연결: {connected ? "✅" : "❌"}</div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              onClick={() => setInterval_("1")}
              style={{
                padding: "8px 12px", borderRadius: 10, border: 0,
                background: interval === "1" ? "#00ffcc" : "#2a2a2a", color: "#000", fontWeight: 700
              }}
            >1분봉</button>
            <button
              onClick={() => setInterval_("D")}
              style={{
                padding: "8px 12px", borderRadius: 10, border: 0,
                background: interval === "D" ? "#00ffcc" : "#2a2a2a", color: "#000", fontWeight: 700
              }}
            >1일봉</button>
          </div>
        </div>

        {/* 오른쪽: 차트 */}
        <div style={{ flex: "1 1 520px", minWidth: 520 }}>
          <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
            차트: {interval === "1" ? "1분봉 (최근 300개)" : "1일봉 (최근 300개)"} · REST 초기 로드 + WS 실시간
            · 토픽: <code>{`kline.${interval}.BTCUSDT`}</code>
          </div>
          <div
            ref={wrapRef}
            style={{ width: "100%", height: 360, borderRadius: 12, overflow: "hidden", background: "#111" }}
          />
        </div>
      </div>
    </div>
  );
}
