//src/components/archive/ArchiveChartView.jsx

import React, { useMemo } from "react";
import ChartView from "../common/ChartView";

function inferPriceScale(candles = [], trades = []) {
    const nums = [];

    for (const c of candles) {
        nums.push(c.open, c.high, c.low, c.close);
    }

    for (const t of trades) {
        nums.push(t.price, t.raw_json?.price, t.raw_json?.entry_price);
    }

    let maxDigits = 2;

    for (const v of nums) {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;

        const s = String(v);
        const dot = s.indexOf(".");
        if (dot >= 0) {
            const digits = s.slice(dot + 1).replace(/0+$/, "").length;
            maxDigits = Math.max(maxDigits, digits);
        }
    }

    return Math.min(Math.max(maxDigits, 2), 6);
}

function fmtKSTHour(tsSec) {
    const kst = new Date(Number(tsSec) * 1000 + 9 * 60 * 60 * 1000);
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mm = String(kst.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function markerStyle(kind, side) {
    const k = String(kind || "").toUpperCase();
    const s = String(side || "").toUpperCase();

    // LONG 진입: 아래에서 위로
    if (k === "ENTRY" && s === "LONG") {
        return {
            position: "belowBar", shape: "arrowUp", color: "#00ccff",
        };
    }

    // LONG 청산: 위에서 아래로
    if (k === "EXIT" && s === "LONG") {
        return {
            position: "aboveBar", shape: "arrowDown", color: "#ffcc00",
        };
    }

    // SHORT 진입: 위에서 아래로
    if (k === "ENTRY" && s === "SHORT") {
        return {
            position: "aboveBar", shape: "arrowDown", color: "#ff77aa",
        };
    }

    // SHORT 청산: 아래에서 위로
    if (k === "EXIT" && s === "SHORT") {
        return {
            position: "belowBar", shape: "arrowUp", color: "#ffaa00",
        };
    }

    return {
        position: "aboveBar", shape: "circle", color: "#aaa",
    };
}

function buildMarkers(trades = []) {
    return trades
        .map((t) => {
            const raw = t.raw_json || {};
            const tsMs = Number(raw.ts_ms || raw.timestamp_ms);
            if (!Number.isFinite(tsMs)) return null;

            const time = Math.floor(tsMs / 1000);
            const kind = String(t.kind || raw.kind || "").toUpperCase();
            const side = String(t.side || raw.side || "").toUpperCase();

            const style = markerStyle(kind, side);

            return {
                time,
                position: style.position,
                color: style.color,
                shape: style.shape,
                text: `${kind || "SIGNAL"}${side ? ` ${side}` : ""}`,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);
}

function calcSMA(rows = [], period = 100) {
    const out = [];
    let sum = 0;

    for (let i = 0; i < rows.length; i++) {
        const close = Number(rows[i].close);
        if (!Number.isFinite(close)) continue;

        sum += close;

        if (i >= period) {
            sum -= Number(rows[i - period].close);
        }

        if (i >= period - 1) {
            out.push({
                time: rows[i].time, value: sum / period,
            });
        }
    }

    return out;
}

function getMaThreshold(thresholds = {}, symbol) {
    const sym = String(symbol || "").toUpperCase();
    const item = thresholds?.[sym];

    if (item == null) return null;

    if (typeof item === "number") {
        return Number.isFinite(item) ? item : null;
    }

    if (typeof item === "string") {
        const n = Number(item);
        return Number.isFinite(n) ? n : null;
    }

    if (typeof item === "object") {
        const n = Number(item.ma_threshold ?? item.maThreshold ?? item.new ?? item.value);
        return Number.isFinite(n) ? n : null;
    }

    return null;
}


export default function ArchiveChartView({
    candles = [], trades = [], symbol, thresholds = {}, height = 360,
}) {
    const displayCandles = useMemo(() => {
        return (Array.isArray(candles) ? candles : [])
            .map((c) => ({
                time: Number(c.timeSec || Math.floor(Number(c.tsMs) / 1000)),
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
            }))
            .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
            .sort((a, b) => a.time - b.time);
    }, [candles]);

    const markers = useMemo(() => buildMarkers(trades), [trades]);

    const visibleRange = useMemo(() => {
        if (!displayCandles.length) return null;

        // API에서 MA100 계산용으로 앞 100분을 더 가져오므로,
        // 화면 시작은 buffer 이후인 100번째 캔들부터 잡음.
        const MA_BUFFER_BARS = 100;

        const start = displayCandles.length > MA_BUFFER_BARS ? displayCandles[MA_BUFFER_BARS].time : displayCandles[0].time;

        const end = displayCandles[displayCandles.length - 1].time + 60;

        return { start, end };
    }, [displayCandles]);

    const priceScale = useMemo(() => inferPriceScale(candles, trades), [candles, trades]);

    const ma100 = useMemo(() => {
        return calcSMA(displayCandles, 100);
    }, [displayCandles]);

    const thr = useMemo(() => {
        return getMaThreshold(thresholds, symbol);
    }, [thresholds, symbol]);


    if (!displayCandles.length) {
        return (<div
            style={{
                height,
                borderRadius: 12,
                border: "1px solid #333",
                background: "#111",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#777",
            }}
        >
            차트 데이터 없음
        </div>);
    }

    return (<div
        style={{
            borderRadius: 12, border: "1px solid #333", background: "#111", overflow: "hidden",
        }}
    >
        <div
            style={{
                padding: "8px 10px",
                fontSize: 12,
                color: "#aaa",
                borderBottom: "1px solid #222",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
            }}
        >
            <span>1m candles: {displayCandles.length}</span>
            <span>
                {fmtKSTHour(visibleRange?.start ?? displayCandles[0].time)} ~{" "}
                {fmtKSTHour(displayCandles[displayCandles.length - 1].time)}
            </span>
            <span>signals: {markers.length}</span>
            <span>
                MA100 ± {typeof thr === "number" ? `${(thr * 100).toFixed(2)}%` : "-"}
            </span>
        </div>

        <ChartView
            height={height}
            displayCandles={displayCandles}
            ma100={ma100}
            thr={thr}
            markers={markers}
            visibleRange={visibleRange}
            priceScale={priceScale}
            tickFormatter={fmtKSTHour}
        />
    </div>);
}