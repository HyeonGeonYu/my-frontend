// src/components/common/ChartView.jsx

import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { createChart } from "lightweight-charts";
import { fmtKSTFull, getTs, fmtComma } from "../../lib/tradeUtils";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function OverlayLabel({ label: l }) {
    const [hover, setHover] = useState(false);

    if (l.layer === "signal") {
        const up = !!l.up;
        const isExit = !!l.isExit;

        // ✅ 크게 + 진입/청산 구분: 진입=채운 삼각형, 청산=테두리만(속 어두움)
        const w = 17;
        const h = 14;

        const points = up
            ? `${w / 2},1.5 ${w - 1.5},${h - 1.5} 1.5,${h - 1.5}`
            : `1.5,1.5 ${w - 1.5},1.5 ${w / 2},${h - 1.5}`;

        const sideColor = l.fillColor || l.color || "#aaa";
        const boost = l.borderColor && l.borderColor !== "none" ? l.borderColor : null;
        const fill = isExit ? "rgba(17,17,17,0.92)" : sideColor;
        const stroke = boost || (isExit ? sideColor : "rgba(0,0,0,0.6)");
        const strokeW = isExit ? 2 : 1;

        return (
            <div
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onClick={() => setHover((v) => !v)} // ✅ 모바일: 탭으로 툴팁 토글
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
                        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.95))",
                    }}
                >
                    <polygon
                        points={points}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeW}
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

    // ✅ 밴드/태그와 동일한 시각 언어: 파랑=롱, 주황=숏 (캔들 초록/빨강과 겹치지 않아 잘 보임)
    if (side === "LONG") return "#3a9bdc";
    if (side === "SHORT") return "#e8913a";

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
    maSd,
    k1set,
    bandData, // ✅ 사전계산 밴드 {ma?, s1Long?, s1Short?, s2Long?, s2Short?: [{time,value}]}
              //   — 방향별 MA창(win)이 다른 일봉(S3/S4)용. 있으면 maSd×k1set 대신 그대로 사용.
    markers,
    visibleRange,
    onChartReady,
    priceScale = 2,
    priceFormatter,
    loading = false,
    intervalSec = 60,
    entryLines, // [{side:"LONG"|"SHORT", avg:number}] — 보유 포지션 평균 진입가 선
}) {
    const wrapRef = useRef(null);
    const chartRef = useRef(null);
    const [overlayLabels, setOverlayLabels] = useState([]);
    // ✅ width/height를 최신값으로 들고있을 ref
    const sizeRef = useRef({ width, height });
    const applyLayoutRef = useRef(() => {
    });
    const candleRef = useRef(null);
    const maRef = useRef(null);       // 레거시 MA100 (Archive) — ma100 prop
    const upperRef = useRef(null);    // 레거시 thr 밴드 상 (Archive)
    const lowerRef = useRef(null);    // 레거시 thr 밴드 하 (Archive)
    const maSdRef = useRef(null);     // ✅ 7일 MA 앵커 (z-band 모드)
    // ✅ z-score 진입 밴드 4개: 색=방향(파랑 롱/주황 숏), 선=전략(실선 S1추세/점선 S2역추세)
    const bS1LongRef = useRef(null);   // MA + k1·σ  (파랑 실선)
    const bS2ShortRef = useRef(null);  // MA + k1·σ  (주황 점선)
    const bS2LongRef = useRef(null);   // MA − k1·σ  (파랑 점선)
    const bS1ShortRef = useRef(null);  // MA − k1·σ  (주황 실선)
    const entryLineRefs = useRef([]);  // 보유 포지션 평균 진입가 priceLine 들

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

    const intervalSecRef = useRef(intervalSec);
    useEffect(() => {
        intervalSecRef.current = Number.isFinite(Number(intervalSec)) && Number(intervalSec) > 0 ? Number(intervalSec) : 60;
    }, [intervalSec]);

    const safeCandles = useMemo(() => (Array.isArray(displayCandles) ? displayCandles : []), [displayCandles]);
    const safeMA = useMemo(() => (Array.isArray(ma100) ? ma100 : []), [ma100]);
    const safeMaSd = useMemo(() => (Array.isArray(maSd) ? maSd : []), [maSd]);
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

        const isec = intervalSecRef.current || 60;
        const bars = Math.max(1, Math.round((end - start) / isec)); // 봉 간격(초) 기준
        const rawSpacing = (w - 40) / bars;
        const spacing = clamp(rawSpacing, 0.1, 8);

        chart.timeScale().applyOptions({
            rightOffset: 0, barSpacing: spacing, minBarSpacing: 0.1,
        });

        try {
            chart.timeScale().setVisibleRange({ from: start, to: end - isec });
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
                // 같은 캔들 시간+방향끼리만 스택 (픽셀 버킷 X → 정확한 candle time 기준)
                const stackKey = `${markerTime}_${m.position}`;
                const autoStackIndex = stackMap.get(stackKey) || 0;
                stackMap.set(stackKey, autoStackIndex + 1);

                // m.stackIndex(미리 계산된 정확한 값)가 있으면 우선 사용
                stackIndex = Number.isFinite(Number(m.stackIndex))
                    ? Number(m.stackIndex)
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

            // 신호 삼각형(isSignal): 봉 꼬리와 안 겹치게 8px 띄우고, 같은 캔들 중첩 시 16px씩 스택
            const signalY = Math.max(
                10,
                Math.min(heightNow - 10, y + direction * (8 + stackIndex * 16))
            );

            labels.push({
                key: `${m.time}_${m.text || m.displayNo || m.signalNo || m.seq || ""}_${stackIndex}`,
                x: isSignal ? x : labelX,
                y: isSignal ? signalY : labelY,
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

        // 레거시 MA100 라인 (Archive 등 ma100 prop 사용처). Coin/HFM은 ma100 미전달 → 빈 선.
        maRef.current = chart.addLineSeries({
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            color: "#ffd166",
            priceFormat: { type: "price", precision: ps, minMove },
        });
        upperRef.current = chart.addLineSeries({
            lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
            color: "#9ca3af", priceFormat: { type: "price", precision: ps, minMove },
        });
        lowerRef.current = chart.addLineSeries({
            lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
            color: "#9ca3af", priceFormat: { type: "price", precision: ps, minMove },
        });

        // ✅ MA(7일) 앵커 — 얕은 회색 점선 (z-band 모드, maSd prop)
        maSdRef.current = chart.addLineSeries({
            lineWidth: 1, lineStyle: 1, priceLineVisible: false, lastValueVisible: false,
            color: "#6b7280", priceFormat: { type: "price", precision: ps, minMove },
        });

        const BLUE = "#3a9bdc"; // 롱 진입
        const AMBER = "#e8913a"; // 숏 진입
        const mkBand = (color, dashed) => chart.addLineSeries({
            lineWidth: 2,
            lineStyle: dashed ? 2 : 0, // 2=Dashed, 0=Solid
            priceLineVisible: false,
            lastValueVisible: true,
            color,
            priceFormat: { type: "price", precision: ps, minMove },
        });
        bS1LongRef.current = mkBand(BLUE, false);   // S1 추세 롱  (파랑 실선)
        bS2ShortRef.current = mkBand(AMBER, true);  // S2 역추세 숏 (주황 점선)
        bS2LongRef.current = mkBand(BLUE, true);    // S2 역추세 롱 (파랑 점선)
        bS1ShortRef.current = mkBand(AMBER, false); // S1 추세 숏  (주황 실선)

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
        const allLines = [
            maRef.current, upperRef.current, lowerRef.current, maSdRef.current,
            bS1LongRef.current, bS2ShortRef.current, bS2LongRef.current, bS1ShortRef.current,
        ];
        if (!chart || !candleSeries || !maSeries || allLines.some((b) => !b)) return;

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
        for (const b of allLines) {
            try {
                b.applyOptions({ priceFormat: pf });
            } catch {
            }
        }
    }, [priceScale, fmtPrice]);

    // data update
    useEffect(() => {
        const candleSeries = candleRef.current;
        const maSeries = maRef.current;
        const upper = upperRef.current;
        const lower = lowerRef.current;
        const maSdSeries = maSdRef.current;
        const bS1Long = bS1LongRef.current;
        const bS2Short = bS2ShortRef.current;
        const bS2Long = bS2LongRef.current;
        const bS1Short = bS1ShortRef.current;
        if (!candleSeries || !maSeries || !upper || !lower || !maSdSeries ||
            !bS1Long || !bS2Short || !bS2Long || !bS1Short) return;

        candleSeries.setData(safeCandles);

        // 레거시 (Archive): MA100 + thr 밴드. Coin/HFM은 ma100 미전달 → 빈 선.
        maSeries.setData(safeMA);
        if (typeof thr === "number" && isFinite(thr) && thr > 0 && safeMA.length) {
            upper.setData(safeMA.map((p) => ({ time: p.time, value: p.value * (1 + thr) })));
            lower.setData(safeMA.map((p) => ({ time: p.time, value: p.value * (1 - thr) })));
        } else {
            upper.setData([]);
            lower.setData([]);
        }

        if (bandData && typeof bandData === "object") {
            // ✅ 사전계산 밴드 모드 (일봉 S3/S4): 방향별 MA창이 달라 호출측에서 win별로 계산해 주입.
            maSdSeries.setData(Array.isArray(bandData.ma) ? bandData.ma : []);
            bS1Long.setData(Array.isArray(bandData.s1Long) ? bandData.s1Long : []);
            bS2Short.setData(Array.isArray(bandData.s2Short) ? bandData.s2Short : []);
            bS2Long.setData(Array.isArray(bandData.s2Long) ? bandData.s2Long : []);
            bS1Short.setData(Array.isArray(bandData.s1Short) ? bandData.s1Short : []);
        } else {
            // ✅ z-band 모드 (Coin/HFM 1분봉): 7일 MA 앵커 + 밴드 = MA ± K1·σ (공통 win)
            maSdSeries.setData(safeMaSd.map((p) => ({ time: p.time, value: p.ma })));
            const k = k1set || {};
            const band = (k1, sign) =>
                (Number.isFinite(Number(k1)) && safeMaSd.length)
                    ? safeMaSd.map((p) => ({ time: p.time, value: p.ma + sign * Number(k1) * p.sd }))
                    : [];
            bS1Long.setData(band(k.s1Long, +1));   // 추세 롱: z≥+K1 → MA + K1σ
            bS2Short.setData(band(k.s2Short, +1)); // 역추세 숏: z≥+K1 → MA + K1σ
            bS2Long.setData(band(k.s2Long, -1));   // 역추세 롱: z≤−K1 → MA − K1σ
            bS1Short.setData(band(k.s1Short, -1)); // 추세 숏: z≤−K1 → MA − K1σ
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

        // lightweight-charts setMarkers는 time 오름차순 정렬 필수
        // normalizeMarkerTimeToCandle 후 순서가 바뀔 수 있으므로 재정렬
        candleSeries.setMarkers?.(
            shapeOnlyMarkers
                .filter((m) => !isTradeSignalMarker(m))
                .sort((a, b) => Number(a.time) - Number(b.time))
        );

        applyLayout();

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                rebuildOverlayLabels();
            });
        });
    }, [safeCandles, safeMA, thr, safeMaSd, k1set, bandData, safeMarkers, loading, applyLayout, rebuildOverlayLabels]);

    // ✅ 보유 포지션 평균 진입가 선 (priceLine). entryLines 바뀔 때 갱신.
    const entryLinesKey = useMemo(
        () => (Array.isArray(entryLines) ? entryLines : [])
            .map((e) => `${e?.side}:${Number(e?.avg)}`).join("|"),
        [entryLines]
    );
    useEffect(() => {
        const series = candleRef.current;
        if (!series) return;
        for (const l of entryLineRefs.current) { try { series.removePriceLine(l); } catch {} }
        entryLineRefs.current = [];
        const lines = Array.isArray(entryLines) ? entryLines : [];
        for (const e of lines) {
            const px = Number(e?.avg);
            if (!Number.isFinite(px) || px <= 0) continue;
            try {
                const pl = series.createPriceLine({
                    price: px,
                    color: e?.side === "SHORT" ? "#ff6b6b" : "#2fe08d",
                    lineWidth: 1,
                    lineStyle: 2, // dashed
                    axisLabelVisible: true,
                    title: `진입 ${e?.side === "SHORT" ? "S" : "L"}`,
                });
                entryLineRefs.current.push(pl);
            } catch {}
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entryLinesKey, safeCandles.length]);

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