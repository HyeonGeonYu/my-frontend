import React, {useEffect, useMemo, useRef, useCallback} from "react";
import {createChart} from "lightweight-charts";
import {fmtKSTFull, getTs, fmtComma} from "../../lib/tradeUtils";

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

                                      // ✅ 추가: 심볼별 소수점 (precision)
                                      priceScale = 2, // e.g. 2,3,4...
                                      priceFormatter, // (num) => string (optional)
                                  }) {
    const wrapRef = useRef(null);
    const chartRef = useRef(null);

    // ✅ width/height를 최신값으로 들고있을 ref
    const sizeRef = useRef({width, height});
    const applyLayoutRef = useRef(() => {
    });
    useEffect(() => {
        sizeRef.current = {width, height};
        requestAnimationFrame(() => applyLayoutRef.current());
    }, [width, height, applyLayout]);

    const candleRef = useRef(null);
    const maRef = useRef(null);
    const upperRef = useRef(null);
    const lowerRef = useRef(null);

    const tickFmtRef = useRef(tickFormatter);
    useEffect(() => {
        tickFmtRef.current = tickFormatter;
    }, [tickFormatter]);

    const rangeRef = useRef(visibleRange);
    useEffect(() => {
        rangeRef.current = visibleRange;
    }, [visibleRange]);

    const priceScaleRef = useRef(priceScale);
    useEffect(() => {
        priceScaleRef.current = Number.isFinite(Number(priceScale)) ? Number(priceScale) : 2;
    }, [priceScale]);

    const priceFormatterRef = useRef(priceFormatter);
    useEffect(() => {
        priceFormatterRef.current = priceFormatter;
    }, [priceFormatter]);

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

        const {width: propW, height: propH} = sizeRef.current || {};
        const w = Math.floor(el.getBoundingClientRect().width || el.clientWidth || propW || 800);
        const h = propH || 320;

        chart.resize(w, h);

        const bars = Math.max(1, Math.round((end - start) / 60)); // 1분봉 기준
        const rawSpacing = (w - 40) / bars;
        const spacing = clamp(rawSpacing, 0.1, 3.5);

        chart.timeScale().applyOptions({
            rightOffset: 0, barSpacing: spacing, minBarSpacing: 0.1,
        });

        try {
            chart.timeScale().setVisibleRange({from: start, to: end - 60});
        } catch {
        }
    }, []);

    useEffect(() => {
        applyLayoutRef.current = applyLayout;
    }, [applyLayout]);

    // ✅ 공통 가격 포맷터
    const fmtPrice = useCallback((v) => {
        const fn = priceFormatterRef.current;
        if (typeof fn === "function") return fn(v);

        const ps = priceScaleRef.current ?? 2;
        const n = Number(v);
        if (!Number.isFinite(n)) return "—";
        return fmtComma(n, ps);
    }, []);

    // init
    // init (✅ mount-only)
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;

        try {
            chartRef.current?.remove();
        } catch {
        }
        chartRef.current = null;

        const ps = Number.isFinite(Number(priceScaleRef.current)) ? Number(priceScaleRef.current) : 2;
        const minMove = Math.pow(10, -ps);

        const initialW = Math.floor(el.getBoundingClientRect().width || el.clientWidth || 800);
        const initialH = sizeRef.current?.height || 320;

        const chart = createChart(el, {
            width: initialW,
            height: initialH,
            autoSize: false,
            layout: {background: {color: "#111"}, textColor: "#ddd"},
            grid: {
                vertLines: {color: "rgba(255,255,255,0.06)"}, horzLines: {color: "rgba(255,255,255,0.06)"},
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
            rightPriceScale: {borderVisible: false},
            crosshair: {mode: 1},
            localization: {
                timeFormatter: (t) => fmtKSTFull(getTs(t)), priceFormatter: (p) => fmtPrice(p),
            },
            handleScroll: {mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false},
            handleScale: {axisDoubleClickReset: false, axisPressedMouseMove: false, mouseWheel: false, pinch: false},
        });

        candleRef.current = chart.addCandlestickSeries({
            upColor: "#2fe08d",
            downColor: "#ff6b6b",
            borderUpColor: "#2fe08d",
            borderDownColor: "#ff6b6b",
            wickUpColor: "#2fe08d",
            wickDownColor: "#ff6b6b",
            priceFormat: {type: "price", precision: ps, minMove},
        });

        maRef.current = chart.addLineSeries({
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            color: "#ffd166",
            priceFormat: {type: "price", precision: ps, minMove},
        });

        upperRef.current = chart.addLineSeries({
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            color: "#9ca3af",
            priceFormat: {type: "price", precision: ps, minMove},
        });

        lowerRef.current = chart.addLineSeries({
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            color: "#9ca3af",
            priceFormat: {type: "price", precision: ps, minMove},
        });

        chartRef.current = chart;
        onChartReady?.(chart);

        let raf = 0;
        const kick = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(applyLayout);
        };

        const ro = new ResizeObserver(kick);
        ro.observe(el);

        window.addEventListener("resize", kick, {passive: true});
        window.visualViewport?.addEventListener("resize", kick, {passive: true});

        let lastDpr = window.devicePixelRatio || 1;
        const dprTimer = setInterval(() => {
            const dpr = window.devicePixelRatio || 1;
            if (dpr !== lastDpr) {
                lastDpr = dpr;
                kick();
            }
        }, 200);

        // ✅ mount 직후 1번 레이아웃 적용
        kick();

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener("resize", kick);
            window.visualViewport?.removeEventListener("resize", kick);
            clearInterval(dprTimer);
            try {
                chart.remove();
            } catch {
            }
        };
        // ✅ width/height/applyLayout 넣지 마! (재생성 방지)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ priceScale/formatter가 바뀌면 chart localization / series priceFormat 갱신
    useEffect(() => {
        const chart = chartRef.current;
        const candleSeries = candleRef.current;
        const maSeries = maRef.current;
        const upper = upperRef.current;
        const lower = lowerRef.current;
        if (!chart || !candleSeries || !maSeries || !upper || !lower) return;

        const ps = Number.isFinite(Number(priceScale)) ? Number(priceScale) : 2;
        const minMove = Math.pow(10, -ps);

        try {
            chart.applyOptions({
                localization: {
                    priceFormatter: (p) => fmtPrice(p),
                },
            });
        } catch {
        }

        const pf = {type: "price", precision: ps, minMove};
        try {
            candleSeries.applyOptions({priceFormat: pf});
        } catch {
        }
        try {
            maSeries.applyOptions({priceFormat: pf});
        } catch {
        }
        try {
            upper.applyOptions({priceFormat: pf});
        } catch {
        }
        try {
            lower.applyOptions({priceFormat: pf});
        } catch {
        }
    }, [priceScale, fmtPrice]);

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
            upper.setData(safeMA.map((p) => ({time: p.time, value: p.value * (1 + thr)})));
            lower.setData(safeMA.map((p) => ({time: p.time, value: p.value * (1 - thr)})));
        } else {
            upper.setData([]);
            lower.setData([]);
        }

        candleSeries.setMarkers?.(safeMarkers);
        applyLayout();
    }, [safeCandles, safeMA, thr, safeMarkers, applyLayout]);

    useEffect(() => {
        applyLayout();
    }, [visibleRange?.start, visibleRange?.end, applyLayout]);

    return (<div
        ref={wrapRef}
        style={{
            width: "100%", minWidth: 0,     // ✅ 추가: shrink 허용
            height, borderRadius: 12, overflow: "hidden", background: "#111",
        }}
    />);
}