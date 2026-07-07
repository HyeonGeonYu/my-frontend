// src/components/common/Mt5EquityHistoryCard.jsx
// CFD(MT5 데모) 일일 평가액 추이 — Coin의 EquityHistoryCard와 동일 UX.
// 데이터: /api/mt5-equity (News_scrap persist가 매일 06:55 기록한 Redis 해시).
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createChart, ColorType } from "lightweight-charts";

export default function Mt5EquityHistoryCard({ currentEquity }) {
    const chartRef = useRef(null);
    const [rangeDays, setRangeDays] = useState(7);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/mt5-equity", { cache: "no-store" });
                const j = await res.json();
                if (!alive) return;
                setRows(Array.isArray(j?.rows) ? j.rows : []);
            } catch (e) {
                console.error("Mt5EquityHistoryCard error", e);
                if (alive) setRows([]);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const normalized = useMemo(
        () => rows
            .map((r) => ({ day: String(r.day).replaceAll("-", ""), equity: Number(r.equity) }))
            .filter((r) => /^\d{8}$/.test(r.day) && Number.isFinite(r.equity) && r.equity > 0)
            .sort((a, b) => a.day.localeCompare(b.day))
            .slice(-90),
        [rows]
    );

    const hasNow = typeof currentEquity === "number" && Number.isFinite(currentEquity) && currentEquity > 0;
    const displayableCount = normalized.length + (hasNow ? 1 : 0);

    const canUseRange = useCallback((d) => {
        if (d === 7) return displayableCount > 0;
        if (d === 30) return displayableCount > 7;
        if (d === 90) return displayableCount > 30;
        return false;
    }, [displayableCount]);

    const chartRows = useMemo(() => {
        const savedLimit = hasNow ? Math.max(0, rangeDays - 1) : rangeDays;
        let arr = normalized.slice(-savedLimit);
        if (hasNow) arr = [...arr, { day: "NOW", equity: currentEquity }];
        return arr;
    }, [normalized, rangeDays, hasNow, currentEquity]);

    const first = chartRows[0]?.equity ?? null;
    const last = chartRows[chartRows.length - 1]?.equity ?? null;
    const diff = first != null && last != null ? last - first : null;
    const diffPct = first > 0 && diff != null ? (diff / first) * 100 : null;

    const fmt = (n, d = 2) =>
        typeof n === "number" && Number.isFinite(n)
            ? n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
            : "—";

    const btnStyle = (active, disabled) => ({
        padding: "6px 10px", borderRadius: 999,
        border: `1px solid ${active ? "#00ffcc" : "#333"}`,
        background: active ? "#00ffcc" : "#1a1a1a",
        color: active ? "#000" : "#fff",
        fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12, opacity: disabled ? 0.35 : 1,
    });

    useEffect(() => {
        if (!chartRef.current || loading || !chartRows.length) return;
        const el = chartRef.current;
        el.innerHTML = "";

        const chart = createChart(el, {
            width: el.clientWidth || 300,
            height: 140,
            layout: { background: { type: ColorType.Solid, color: "#0f0f0f" }, textColor: "#aaa" },
            grid: { vertLines: { color: "#1f1f1f" }, horzLines: { color: "#1f1f1f" } },
            rightPriceScale: { borderColor: "#333" },
            timeScale: { borderColor: "#333", timeVisible: false },
            crosshair: { mode: 1 },
        });
        const lineSeries = chart.addLineSeries({
            color: "#00ffcc", lineWidth: 3,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        });

        const data = chartRows
            .map((r, idx) => {
                let time;
                if (r.day === "NOW") {
                    time = Math.floor(Date.now() / 1000);
                } else if (/^\d{8}$/.test(String(r.day))) {
                    const y = Number(String(r.day).slice(0, 4));
                    const m = Number(String(r.day).slice(4, 6));
                    const d = Number(String(r.day).slice(6, 8));
                    time = Math.floor(new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).getTime() / 1000);
                } else {
                    time = Math.floor(Date.now() / 1000) - (chartRows.length - idx) * 86400;
                }
                return { time, value: Number(r.equity) };
            })
            .filter((x) => Number.isFinite(x.time) && Number.isFinite(x.value))
            .sort((a, b) => a.time - b.time);

        lineSeries.setData(data);
        chart.timeScale().fitContent();

        const resize = () => {
            chart.applyOptions({ width: el.clientWidth || 300, height: 140 });
            chart.timeScale().fitContent();
        };
        window.addEventListener("resize", resize);
        return () => { window.removeEventListener("resize", resize); chart.remove(); };
    }, [chartRows, loading]);

    return (
        <div
            style={{
                padding: 16, borderRadius: 16, background: "#151515",
                border: "1px solid #2a2a2a", boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                width: "100%", minHeight: 260, boxSizing: "border-box", marginBottom: 14,
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>평가 USD (MT5 데모)</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>
                        저장 {normalized.length}일 · 현재 포함 {chartRows.length}개
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    {[7, 30, 90].map((d) => {
                        const disabled = loading || !canUseRange(d);
                        return (
                            <button
                                key={d}
                                onClick={() => { if (!disabled) setRangeDays(d); }}
                                disabled={disabled}
                                style={btnStyle(rangeDays === d, disabled)}
                                title={disabled ? `${d}일 보기에는 저장 데이터가 부족합니다.` : `${d}일 보기`}
                            >
                                {d}일
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                    {fmt(last, 2)} <span style={{ fontSize: 13, opacity: 0.75 }}>USD</span>
                </div>
                <div
                    style={{
                        marginTop: 4, fontSize: 12, fontWeight: 800,
                        color: diff == null ? "#aaa" : diff >= 0 ? "#16a34a" : "#dc2626",
                    }}
                >
                    {diff == null
                        ? "변화 없음"
                        : `${diff >= 0 ? "+" : ""}${fmt(diff, 2)} USD / ${diffPct >= 0 ? "+" : ""}${fmt(diffPct, 2)}%`}
                </div>
            </div>

            <div
                ref={chartRef}
                style={{
                    marginTop: 12, height: 140, borderRadius: 12,
                    background: "#0f0f0f", border: "1px solid #242424",
                    overflow: "hidden",
                }}
            />
        </div>
    );
}
