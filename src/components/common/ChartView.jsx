import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { createChart } from "lightweight-charts";
import { fmtKSTFull, getTs } from "../../lib/tradeUtils";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function ChartView({
  width = 800,
  height = 320,
  tickFormatter,
  displayCandles,
  ma100,
  thr,
  markers,
  visibleRange, // {start,end}
  onChartReady,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const maRef = useRef(null);
  const upperRef = useRef(null);
  const lowerRef = useRef(null);

  const tickFmtRef = useRef(tickFormatter);
  useEffect(() => { tickFmtRef.current = tickFormatter; }, [tickFormatter]);

  const rangeRef = useRef(visibleRange);
  useEffect(() => { rangeRef.current = visibleRange; }, [visibleRange]);

  const safeCandles = useMemo(() => (Array.isArray(displayCandles) ? displayCandles : []), [displayCandles]);
  const safeMA = useMemo(() => (Array.isArray(ma100) ? ma100 : []), [ma100]);
  const safeMarkers = useMemo(() => (Array.isArray(markers) ? markers : []), [markers]);

  const applyLayout = useCallback(() => {
    const chart = chartRef.current;
    const el = wrapRef.current;
    const vr = rangeRef.current;
    if (!chart || !el || !vr) return;

    const start = vr.start;
    const end = vr.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;

    const w = el.clientWidth || width;

    // ✅ 핵심: DPR(브라우저 줌) 변하면 applyOptions만으론 부족한 경우가 있음 → resize로 캔버스 재생성
    chart.resize(w, height);

    const bars = Math.max(1, Math.round((end - start) / 60)); // 1분봉 기준
    const rawSpacing = (w - 40) / bars;

    // ✅ 너무 커지거나 너무 작아지면 setVisibleRange가 “못 들어가서” 일부만 보이는 현상 생김 → clamp
    const spacing = clamp(rawSpacing, 0.1, 3.5); // max는 취향(2.5~5 사이 추천)

    chart.timeScale().applyOptions({
      rightOffset: 0,
      barSpacing: spacing,
      minBarSpacing: 0.1,
    });

    try {
      chart.timeScale().setVisibleRange({ from: start, to: end - 60 });
    } catch {}
  }, [width, height]);

  // init
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    try { chartRef.current?.remove(); } catch {}
    chartRef.current = null;

    const chart = createChart(el, {
      width,
      height,
      autoSize: false,
      layout: { background: { color: "#111" }, textColor: "#ddd" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        barSpacing: 0.5,
        minBarSpacing: 0.1,
        tickMarkFormatter: (t) => {
          const ts = typeof t === "number" ? t : t?.timestamp ? t.timestamp : 0;
          const fn = tickFmtRef.current;
          return typeof fn === "function" ? fn(ts) : String(ts);
        },
        lockVisibleTimeRangeOnResize: true,
        fixLeftEdge: true,
      },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      localization: { timeFormatter: (t) => fmtKSTFull(getTs(t)) },
      handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
      handleScale: { axisDoubleClickReset: false, axisPressedMouseMove: false, mouseWheel: false, pinch: false },
    });

    candleRef.current = chart.addCandlestickSeries({
      upColor: "#2fe08d",
      downColor: "#ff6b6b",
      borderUpColor: "#2fe08d",
      borderDownColor: "#ff6b6b",
      wickUpColor: "#2fe08d",
      wickDownColor: "#ff6b6b",
    });

    maRef.current = chart.addLineSeries({ lineWidth: 2, priceLineVisible: false, lastValueVisible: true, color: "#ffd166" });
    upperRef.current = chart.addLineSeries({ lineWidth: 1, priceLineVisible: false, lastValueVisible: false, color: "#9ca3af" });
    lowerRef.current = chart.addLineSeries({ lineWidth: 1, priceLineVisible: false, lastValueVisible: false, color: "#9ca3af" });

    chartRef.current = chart;
    onChartReady?.(chart);

    // ✅ 컨테이너 크기 변할 때(레이아웃 변화) + 브라우저 줌에서 visualViewport/RO가 잡히는 케이스 처리
    let raf = 0;
    const kick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyLayout);
    };

    const ro = new ResizeObserver(kick);
    ro.observe(el);

    window.addEventListener("resize", kick, { passive: true });
    window.visualViewport?.addEventListener("resize", kick, { passive: true });

    // ✅ DPR 변화(줌) 보정: 이때도 resize로 캔버스 다시 만들어줘야 “복구”됨
    let lastDpr = window.devicePixelRatio || 1;
    const dprTimer = setInterval(() => {
      const dpr = window.devicePixelRatio || 1;
      if (dpr !== lastDpr) {
        lastDpr = dpr;
        kick();
      }
    }, 200);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", kick);
      window.visualViewport?.removeEventListener("resize", kick);
      clearInterval(dprTimer);
      try { chart.remove(); } catch {}
    };
  }, [width, height, applyLayout, onChartReady]);

  // data update
  useEffect(() => {
    const candleSeries = candleRef.current;
    const maSeries = maRef.current;
    const upper = upperRef.current;
    const lower = lowerRef.current;
    if (!candleSeries || !maSeries || !upper || !lower) return;

    candleSeries.setData(safeCandles);
    maSeries.setData(safeMA);

    if (typeof thr === "number" && isFinite(thr) && thr > 0 && safeMA.length) {
      upper.setData(safeMA.map((p) => ({ time: p.time, value: p.value * (1 + thr) })));
      lower.setData(safeMA.map((p) => ({ time: p.time, value: p.value * (1 - thr) })));
    } else {
      upper.setData([]);
      lower.setData([]);
    }

    candleSeries.setMarkers?.(safeMarkers);
    applyLayout(); // ✅ 갱신 후에도 항상 하루를 “한 화면”에
  }, [safeCandles, safeMA, thr, safeMarkers, applyLayout]);

  useEffect(() => { applyLayout(); }, [visibleRange?.start, visibleRange?.end, applyLayout]);

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        height,
        borderRadius: 12,
        overflow: "hidden",
        background: "#111",
      }}
    />
  );
}
