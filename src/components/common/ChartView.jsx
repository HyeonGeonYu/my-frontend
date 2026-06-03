// src/components/common/ChartView.jsx

import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { createChart } from "lightweight-charts";
import { fmtKSTFull, getTs, fmtComma } from "../../lib/tradeUtils";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function OverlayLabel({ label: l }) {
    const [hover, setHover] = useState(false);

    if (l.layer === "signal") {
        const up = !!l.up;

        // 작게 조정
        const w = 14;
        const h = 12;

        const points = up
            ? `${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}`
            : `1,1 ${w - 1},1 ${w / 2},${h - 1}`;

        const fill = l.fillColor || l.color || "#aaa";
        const stroke = l.borderColor && l.borderColor !== "none"
            ? l.borderColor
            : "none";

        return (
            <div
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{
                    position: "absolute",
                    left: l.x,
                    top: l.y,
                    transform: "translate(-50%, -50%)",
                    cursor: "pointer",
                    pointerEvents: "auto",
                    zIndex: 1,
                }}
            >
                <svg
                    width={w}
                    height={h}
                    viewBox={`0 0 ${w} ${h}`}
                    style={{
                        display: "block",
                        overflow: "visible",
                        filter: "drop-shadow(0 0 3px rgba(0,0,0,0.9))",
                    }}
                >
                    <polygon
                        points={points}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={l.isExit ? 0 : 1.1}
                        strokeLinejoin="round"
                    />
                </svg>

                {hover && (
                    <div
                        style={{
                            position: "absolute",
                            left: 14,
                            top: -12,
                            minWidth: 260,
                            maxWidth: 520,
                            whiteSpace: "pre-line",
                            padding: "8px 10px",
                            borderRadius: 10,
                            background: "rgba(10,10,10,0.97)",
                            border: "1px solid #333",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 800,
                            lineHeight: 1.45,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                            zIndex: 100,
                        }}
                    >
                        {l.tooltip || ""}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            style={{
                position: "absolute",
                left: l.x,
                top: l.y,
                transform: l.transform || "translate(-50%, -50%)",
                color: l.color,
                fontSize: l.fontSize || 10,
                fontWeight: 800,
                whiteSpace: "nowrap",
                textAlign: l.textAlign || "center",
                maxWidth: "260px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: `
                    0 0 3px #000,
                    0 0 6px #000,
                    0 0 10px #000
                `,
            }}
        >
            {l.text}
        </div>
    );
}
function isTradeSignalMarker(m) {
    const kind = String(m?.kind || "").toUpperCase();
    return kind === "ENTRY" || kind === "EXIT";
}

function isExitSignalMarker(m) {
    return String(m?.kind || "").toUpperCase() === "EXIT";
}

// ▲ = 위 방향 베팅, ▼ = 아래 방향 베팅
function isUpBetMarker(m) {
    const side = String(m?.side || "").toUpperCase();
    const kind = String(m?.kind || "").toUpperCase();

    // LONG 진입 = 상승 베팅
    if (kind === "ENTRY" && side === "LONG") return true;

    // SHORT 청산 = 상승 방향 정리
    if (kind === "EXIT" && side === "SHORT") return true;

    return false;
}

function parseReasonArray(v) {
    if (!v) return [];

    if (Array.isArray(v)) {
        return v.map((x) => String(x || "").trim()).filter(Boolean);
    }

    if (typeof v === "string") {
        try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) {
                return parsed.map((x) => String(x || "").trim()).filter(Boolean);
            }
        } catch {
            return v.split(",").map((x) => x.trim()).filter(Boolean);
        }
    }

    return [];
}

function getMarkerReasons(m) {
    const a = parseReasonArray(m?.reasons);
    if (a.length) return a;

    const b = parseReasonArray(m?.reasons_json);
    if (b.length) return b;

    const c = parseReasonArray(m?.raw_json?.reasons);
    if (c.length) return c;

    const d = parseReasonArray(m?.raw_json?.reasons_json);
    if (d.length) return d;

    return [];
}

function getFirstReason(m) {
    return String(
        m?.firstReason ||
        getMarkerReasons(m)[0] ||
        m?.mode ||
        m?.reason ||
        m?.signalType ||
        ""
    ).trim();
}

function getSignalFillColor(m) {
    const side = String(m?.side || "").toUpperCase();

    if (side === "LONG") return "#22c55e";   // 선명한 초록
    if (side === "SHORT") return "#ef4444";  // 선명한 빨강

    return "#e5e7eb";
}

function getSignalBorderColor(m) {
    const first = getFirstReason(m).toUpperCase();

    if (first.includes("BOOST")) return "#facc15";

    return "none";
}

function fmtSignedNumber(v, digits = 2) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
}

function buildSignalTooltip(m) {
    const side = String(m?.side || "").toUpperCase();
    const kind = String(m?.kind || "").toUpperCase();

    const reasons = getMarkerReasons(m);
    const firstReason = getFirstReason(m);

    const pnlUsdt =
        m?.pnlUsdt ??
        m?.pnl_usdt ??
        m?.exec?.pnl_usdt ??
        m?.raw_json?.pnl_usdt;

    const pnlPct =
        m?.pnl_pct ??
        m?.pnlPct ??
        m?.exec?.pnl_pct ??
        m?.raw_json?.pnl_pct;

    const qty =
        m?.qty ??
        m?.exec?.qty ??
        m?.raw_json?.qty;

    const usdtPctText =
        Number.isFinite(Number(pnlUsdt)) && Number.isFinite(Number(pnlPct))
            ? `${fmtSignedNumber(pnlUsdt, 2)} USDT (${fmtSignedNumber(pnlPct, 2)}%)`
            : Number.isFinite(Number(pnlUsdt))
                ? `${fmtSignedNumber(pnlUsdt, 2)} USDT`
                : Number.isFinite(Number(pnlPct))
                    ? `${fmtSignedNumber(pnlPct, 2)}%`
                    : "";

    const qtyText =
        kind === "ENTRY" && Number.isFinite(Number(qty))
            ? `qty ${Number(qty).toFixed(4)}`
            : "";

    // 예: EXIT LONG · SL(ID 3D) · -29.70 USDT (-4.23%)
    const fallbackMainLine = [
        [kind, side].filter(Boolean).join(" "),
        firstReason,
        usdtPctText || qtyText,
    ].filter(Boolean).join(" · ");

    const detailLine = reasons.length ? reasons.join(", ") : "";

    const mainLine = String(m?.tooltipText || "").trim() || fallbackMainLine;

    return [
        mainLine,
        detailLine,
    ].filter(Boolean).join("\n");
}

function isCrossNumberMarker(m) {
    const text = String(m?.text || "").trim();
    if (/^#?\d+$/.test(text)) return true;

    const color = String(m?.color || "").toLowerCase();
    if (
        color.includes("a78bfa") ||
        color.includes("c084fc") ||
        color.includes("purple") ||
        color.includes("violet")
    ) {
        return true;
    }

    return false;
}

function getOverlayLayer(m) {
    return isCrossNumberMarker(m) ? "cross" : "signal";
}

function normalizeMarkerTimeToCandle(time, candles = []) {
    const t = Number(time);
    if (!Number.isFinite(t)) return null;

    let bestTime = null;
    let bestDiff = Infinity;

    for (const c of candles || []) {
        const ct = Number(c?.time);
        if (!Number.isFinite(ct)) continue;

        const diff = Math.abs(ct - t);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestTime = ct;
        }
    }

    // 1분봉 기준. 90초 이내면 가장 가까운 캔들에 붙임
    if (bestTime != null && bestDiff <= 90) {
        return bestTime;
    }

    return Math.floor(t / 60) * 60;
}


export default function ChartView({
    width = 800,
    height = 320,
    tickFormatter,
    displayCandles,
    ma100,
    thr,
    markers,
    visibleRange,
    onChartReady,
    priceScale = 2,
    priceFormatter,
    loading = false,
}) {
    const wrapRef = useRef(null);
    const chartRef = useRef(null);
    const [overlayLabels, setOverlayLabels] = useState([]);
    // ✅ width/height를 최신값으로 들고있을 ref
    const sizeRef = useRef({ width, height });
    const applyLayoutRef = useRef(() => {
    });
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

        const { width: propW, height: propH } = sizeRef.current || {};
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
            chart.timeScale().setVisibleRange({ from: start, to: end - 60 });
        } catch {
        }
    }, []);


    useEffect(() => {
        sizeRef.current = { width, height };
        requestAnimationFrame(() => applyLayout());
    }, [width, height, applyLayout]);
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


    const rebuildOverlayLabels = useCallback(() => {
        const chart = chartRef.current;
        const candleSeries = candleRef.current;
        const el = wrapRef.current;

        if (!chart || !candleSeries || !el) {
            setOverlayLabels([]);
            return;
        }

        const widthNow = el.clientWidth || 0;
        const heightNow = sizeRef.current?.height || height || 320;

        const labels = [];
        const stackMap = new Map();


        const candleByTime = new Map();

        for (const c of safeCandles || []) {
            const t = Number(c?.time);
            if (Number.isFinite(t)) {
                candleByTime.set(Math.floor(t), c);
            }
        }

        for (const m of safeMarkers) {
            if (!m?.time) continue;

            const isSignal = isTradeSignalMarker(m);
            const isCross = isCrossNumberMarker(m);

            if (!isSignal && !m?.text) continue;
            const markerTime = normalizeMarkerTimeToCandle(m.time, safeCandles);
            if (!Number.isFinite(markerTime)) continue;

            let x = chart.timeScale().timeToCoordinate(markerTime);
            // lightweight-charts가 해당 time 좌표를 못 주는 경우,
            // visibleRange 기준으로 직접 x좌표 계산
            if (x == null || !Number.isFinite(x)) {
                const vr = rangeRef.current;
                const start = Number(vr?.start);
                const end = Number(vr?.end);

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    end > start &&
                    Number.isFinite(Number(m.time))
                ) {
                    const t = Number(markerTime);

                    // 화면 범위 밖이면 표시 안 함
                    if (t < start || t > end) continue;

                    x = ((t - start) / (end - start)) * widthNow;
                }
            }

            if (x == null || !Number.isFinite(x)) continue;

            let rawPrice = Number(
                m.price ??
                m.closePrice ??
                m.entryPrice ??
                m.raw_json?.price ??
                m.raw_json?.close_price ??
                m.raw_json?.entry_price ??
                m.raw_json?.exit_price
            );

            const candle = candleByTime.get(Math.floor(Number(markerTime)));

            if (!Number.isFinite(rawPrice) && candle) {
                if (m.position === "belowBar") {
                    rawPrice = Number(candle.low ?? candle.close);
                } else if (m.position === "aboveBar") {
                    rawPrice = Number(candle.high ?? candle.close);
                } else {
                    rawPrice = Number(candle.close);
                }
            }

            let y = null;

            if (Number.isFinite(rawPrice)) {
                y = candleSeries.priceToCoordinate(rawPrice);
            }

            if (y == null || !Number.isFinite(y)) {
                y = m.position === "belowBar" ? heightNow * 0.65 : heightNow * 0.35;
            }

            // ✅ 보라색 번호 cross marker는 다른 신호 라벨 때문에 밀리지 않게 별도 처리
            let stackIndex = 0;

            if (!isCross) {
                // 긴 ENTRY/EXIT 라벨끼리만 스택
                const stackKey = `${Math.round(x / 110)}_${m.position}`;
                const autoStackIndex = stackMap.get(stackKey) || 0;
                stackMap.set(stackKey, autoStackIndex + 1);

                stackIndex = Number.isFinite(Number(m.stackIndex))
                    ? Math.max(Number(m.stackIndex), autoStackIndex)
                    : autoStackIndex;
            }

            const direction = m.position === "belowBar" ? 1 : -1;

            // ✅ cross 번호는 점 근처, ENTRY/EXIT 라벨은 화살표보다 확실히 위/아래
            const baseGap = isCross ? 16 : 34;

            // ✅ 겹치는 신호도 너무 멀리 안 가게 간격 축소
            const stackGap = isCross ? 0 : 18;

            const yOffset = direction * (baseGap + stackIndex * stackGap);

            const fontSize = 10;
            const estimatedTextWidth = String(m.text || "").length * 7;
            const padX = 8;

            let labelX = x;
            let transform = "translate(-50%, -50%)";
            let textAlign = "center";

            // 왼쪽 밖으로 삐져나갈 것 같으면 왼쪽 정렬
            if (labelX - estimatedTextWidth / 2 < padX) {
                labelX = padX;
                transform = "translate(0, -50%)";
                textAlign = "left";
            }

            // 오른쪽 밖으로 삐져나갈 것 같으면 오른쪽 정렬
            if (labelX + estimatedTextWidth / 2 > widthNow - padX) {
                labelX = widthNow - padX;
                transform = "translate(-100%, -50%)";
                textAlign = "right";
            }

            let labelY = y + yOffset;

            // ✅ ENTRY/EXIT 긴 라벨만 차트 밖 보정
            // cross 번호는 점 근처 고정이 중요해서 반대편으로 튕기지 않게 함
            if (!isCross) {
                if (labelY < 20) {
                    labelY = y + Math.abs(yOffset);
                }

                if (labelY > heightNow - 20) {
                    labelY = y - Math.abs(yOffset);
                }
            }

            labelY = Math.max(20, Math.min(heightNow - 20, labelY));

            labels.push({
                key: `${m.time}_${m.text || m.displayNo || m.signalNo || m.seq || ""}_${stackIndex}`,
                x: isSignal ? x : labelX,
                y: isSignal ? y : labelY,
                text: m.text,
                color: m.color || "#fff",
                fillColor: getSignalFillColor(m),
                borderColor: getSignalBorderColor(m),
                tooltip: isSignal ? buildSignalTooltip(m) : m.text,
                isExit: isExitSignalMarker(m),
                up: isSignal ? isUpBetMarker(m) : false,
                transform,
                textAlign,
                fontSize,
                layer: isSignal ? "signal" : getOverlayLayer(m),
            });
        }

        setOverlayLabels(labels);
    }, [safeMarkers, safeCandles, height]);

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
            layout: { background: { color: "#111" }, textColor: "#ddd" },
            grid: {
                vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" },
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
            localization: {
                timeFormatter: (t) => fmtKSTFull(getTs(t)), priceFormatter: (p) => fmtPrice(p),
            },
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
            priceFormat: { type: "price", precision: ps, minMove },
        });

        maRef.current = chart.addLineSeries({
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            color: "#ffd166",
            priceFormat: { type: "price", precision: ps, minMove },
        });

        upperRef.current = chart.addLineSeries({
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            color: "#9ca3af",
            priceFormat: { type: "price", precision: ps, minMove },
        });

        lowerRef.current = chart.addLineSeries({
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            color: "#9ca3af",
            priceFormat: { type: "price", precision: ps, minMove },
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

        window.addEventListener("resize", kick, { passive: true });
        window.visualViewport?.addEventListener("resize", kick, { passive: true });

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

        const pf = { type: "price", precision: ps, minMove };
        try {
            candleSeries.applyOptions({ priceFormat: pf });
        } catch {
        }
        try {
            maSeries.applyOptions({ priceFormat: pf });
        } catch {
        }
        try {
            upper.applyOptions({ priceFormat: pf });
        } catch {
        }
        try {
            lower.applyOptions({ priceFormat: pf });
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
            upper.setData(safeMA.map((p) => ({ time: p.time, value: p.value * (1 + thr) })));
            lower.setData(safeMA.map((p) => ({ time: p.time, value: p.value * (1 - thr) })));
        } else {
            upper.setData([]);
            lower.setData([]);
        }

        const shapeOnlyMarkers = loading
            ? []
            : safeMarkers
                .map((m) => {
                    const markerTime = normalizeMarkerTimeToCandle(m.time, safeCandles);
                    if (!Number.isFinite(markerTime)) return null;

                    return {
                        ...m,
                        time: markerTime,
                        text: "",
                    };
                })
                .filter(Boolean);

        candleSeries.setMarkers?.(
            shapeOnlyMarkers.filter((m) => !isTradeSignalMarker(m))
        );

        applyLayout();

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                rebuildOverlayLabels();
            });
        });
    }, [safeCandles, safeMA, thr, safeMarkers, loading, applyLayout, rebuildOverlayLabels]);

    useEffect(() => {
        applyLayout();

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                rebuildOverlayLabels();
            });
        });
    }, [visibleRange?.start, visibleRange?.end, applyLayout, rebuildOverlayLabels]);

    const visibleOverlayLabels = loading ? [] : overlayLabels;
    const crossLabels = visibleOverlayLabels.filter((l) => l.layer === "cross");
    const signalLabels = visibleOverlayLabels.filter((l) => l.layer !== "cross");
    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                minWidth: 0,
                height,
                borderRadius: 12,
                overflow: "hidden",
                background: "#111",
            }}
        >
            <div
                ref={wrapRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    minWidth: 0,
                    height,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#111",
                    zIndex: 1,
                }}
            />

            {/* ✅ 크로스타임 번호: 차트 위, 신호 라벨 아래 */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 40,
                    pointerEvents: "none",
                }}
            >
                {crossLabels.map((l) => (
                    <OverlayLabel key={l.key} label={l} />
                ))}
            </div>

            {/* ✅ 매매 신호 라벨: 최상단 */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 70,
                    pointerEvents: "auto",
                }}
            >
                {signalLabels.map((l) => (
                    <OverlayLabel key={l.key} label={l} />
                ))}
            </div>
        </div>
    );
}