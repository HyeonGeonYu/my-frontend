// src/pages/coin.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import AssetPanel from "../components/AssetPanel";
import UnifiedTickerCard from "../components/common/UnifiedTickerCard";
import ChartPanelCore from "../components/common/ChartPanelCore";
import { makeBybitSource } from "../lib/chartSources";
import { QRCodeCanvas } from "qrcode.react";
import { next0650EndBoundaryUtcSec } from "../lib/tradeUtils";
import { getDayLabel } from "../utils/date";
import { createChart, ColorType } from "lightweight-charts";

/* ------------------------- 상단 배너 ------------------------- */
function CopyTradingInfoBanner({ inviteUrl, startDate, startUsdt, equityUsdt, qrSize = 92 }) {
    const fmt = (n, d = 2) => typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : "—";

    const pnl = typeof equityUsdt === "number" ? equityUsdt - startUsdt : null;
    const pnlPct = typeof equityUsdt === "number" && startUsdt > 0 ? ((equityUsdt - startUsdt) / startUsdt) * 100 : null;

    const pill = {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        fontSize: 12,
        opacity: 0.95,
        whiteSpace: "nowrap",
    };

    const box = {
        padding: 18,
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(0,255,204,0.15), rgba(0,0,0,0))",
        border: "1px solid #2a2a2a",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
    };

    return (<div style={box}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 14 }}>
            카피트레이딩 계정 안내
        </div>

        {/* ✅ 1) 시작일 / 시작돈 / 현재 : 3줄 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={pill}>
                시작일: <b>{startDate}</b>
            </div>

            <div style={pill}>
                시작돈: <b>{fmt(startUsdt, 2)} USDT</b>
            </div>

            <div style={pill}>
                현재(평가):{" "}
                <b>
                    {typeof equityUsdt === "number" ? `${fmt(equityUsdt, 2)} USDT` : "—"}
                    {typeof pnl === "number" && typeof pnlPct === "number" ? ` (${pnl >= 0 ? "+" : ""}${fmt(pnl, 2)} / ${pnlPct >= 0 ? "+" : ""}${fmt(pnlPct, 2)}%)` : ""}
                </b>
            </div>
        </div>

        {/* ✅ 2) 둘째 줄: QR + 바로 참여 버튼 */}
        <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Bybit 초대 링크로 이동"
                style={{ background: "#fff", padding: 10, borderRadius: 12 }}
            >
                <QRCodeCanvas value={inviteUrl} size={qrSize} includeMargin />
            </a>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Bybit 바로 참여"
                    style={{
                        padding: "10px 14px",
                        borderRadius: 14,
                        border: "1px solid #2a2a2a",
                        background: "#00ffcc",
                        color: "#000",
                        fontWeight: 900,
                        cursor: "pointer",
                        fontSize: 14,
                        width: 140,
                        textAlign: "center",
                        textDecoration: "none",
                        display: "inline-block",
                        boxSizing: "border-box",
                    }}
                >
                    바로 참여하기
                </a>

                <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                    QR 또는 버튼을 누르면 Bybit 초대 페이지로 이동합니다.
                </div>
            </div>
        </div>

        {/* ✅ 3) 아래: 원래 경고문구 복원 + 한/중/일/EN */}
        <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.9 }}>
                ⚠️ 리스크 고지 (KR / 中文 / 日本語 / EN)
            </summary>

            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, opacity: 0.85 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>KR</div>
                <div>
                    본 페이지는 카피트레이딩 계정 정보를 공유하기 위한 것이며, 참여 여부는 이용자의 자율적 판단에 따릅니다.
                    카피트레이딩은 손실 또는 청산이 발생할 수 있고, 과거 성과는 미래 수익을 보장하지 않습니다.
                    모든 투자 결과에 대한 책임은 이용자 본인에게 있습니다.
                </div>

                <div style={{ height: 10 }} />

                <div style={{ fontWeight: 800, marginBottom: 4 }}>中文</div>
                <div>
                    本页面用于分享跟单交易账户相关信息，是否参与由用户自行决定。跟单交易存在亏损或强制平仓的风险，
                    过往业绩不代表未来表现。所有投资决策及其结果均由用户本人承担责任。
                </div>

                <div style={{ height: 10 }} />

                <div style={{ fontWeight: 800, marginBottom: 4 }}>日本語</div>
                <div>
                    本ページはコピートレード口座の情報共有を目的としています。参加の可否は利用者の判断に委ねられます。
                    コピートレードには損失や強制決済のリスクがあり、過去の実績は将来の成果を保証しません。
                    投資判断および結果の責任は利用者ご本人にあります。
                </div>

                <div style={{ height: 10 }} />

                <div style={{ fontWeight: 800, marginBottom: 4 }}>EN</div>
                <div>
                    This page is intended to share information about a copy trading account, and participation is entirely at the user's own discretion.
                    Copy trading involves risks, including potential losses or liquidation, and past performance does not guarantee future results.
                    All investment decisions and their outcomes are the sole responsibility of the user.
                </div>
            </div>
        </details>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            * 본 화면의 자산/성과 표시는 카피트레이딩 계정 기준으로 집계됩니다.
        </div>
    </div>);
}

/* ------------------------- 평가 USDT 히스토리 카드 ------------------------- */
function EquityHistoryCard({ currentEquity }) {
    const chartRef = React.useRef(null);
    const [rangeDays, setRangeDays] = useState(7);
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(false);

    // ✅ 90일치를 한 번에 가져와서 7/30/90을 클라이언트에서 잘라 씀
    useEffect(() => {
        let alive = true;

        function toNum(v) {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        }

        function normalizeDay(raw) {
            if (!raw) return "";

            const s = String(raw);

            // 20260511
            if (/^\d{8}$/.test(s)) return s;

            // 2026-05-11
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                return s.replaceAll("-", "");
            }

            // ISO timestamp
            const d = new Date(s);
            if (!Number.isNaN(d.getTime())) {
                const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                const y = kst.getUTCFullYear();
                const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
                const dd = String(kst.getUTCDate()).padStart(2, "0");
                return `${y}${m}${dd}`;
            }

            return s;
        }

        function pickEquityUsdt(item) {
            return (
                toNum(item?.asset?.equityUsdt) ??
                toNum(item?.asset?.equity_usdt) ??
                toNum(item?.asset?.equity) ??
                toNum(item?.asset?.wallet?.USDT) ??
                null
            );
        }

        (async () => {
            setLoading(true);

            try {
                const collected = [];
                let total = 0;

                // Archive가 page당 5개라면 90일은 최대 18페이지
                // 여유 있게 25페이지까지 가져옴
                for (let page = 1; page <= 25; page += 1) {
                    const res = await fetch(`/api/list?page=${page}`, {
                        cache: "no-store",
                    });

                    const json = await res.json();

                    if (!res.ok || !json?.ok) {
                        throw new Error(json?.error || `archive list failed: page ${page}`);
                    }

                    const arr = Array.isArray(json.data) ? json.data : [];
                    total = Number(json.total || total || 0);

                    collected.push(...arr);

                    if (arr.length === 0) break;
                    if (collected.length >= 90) break;
                    if (total > 0 && collected.length >= total) break;
                }

                const rows = collected
                    .map((item) => {
                        const day = normalizeDay(
                            item?.day ||
                            item?.date ||
                            item?.created_at ||
                            item?.updated_at
                        );

                        const equityUsdt = pickEquityUsdt(item);

                        return {
                            day,
                            date: day,
                            equityUsdt,
                        };
                    })
                    .filter((r) => r.day && r.equityUsdt != null)
                    .sort((a, b) => a.day.localeCompare(b.day))
                    .slice(-90);

                if (!alive) return;
                setAllRows(rows);
            } catch (e) {
                console.error("EquityHistoryCard /api/list error", e);
                if (alive) setAllRows([]);
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    const normalizedRows = useMemo(() => {
        return [...allRows]
            .map((r) => ({
                day: String(r.day || r.date || ""),
                equity: Number(r.equityUsdt ?? r.equity_usdt ?? r.equity ?? 0),
            }))
            .filter((r) => r.day && Number.isFinite(r.equity) && r.equity > 0)
            .sort((a, b) => a.day.localeCompare(b.day));
    }, [allRows]);

    const availableCount = normalizedRows.length;

    const hasCurrentEquity =
        typeof currentEquity === "number" &&
        Number.isFinite(currentEquity) &&
        currentEquity > 0;

    const displayableCount = availableCount + (hasCurrentEquity ? 1 : 0);

    const canUseRange = useCallback(
        (d) => {
            if (d === 7) return displayableCount > 0;

            // 30일은 7일 범위보다 더 볼 데이터가 있을 때 활성
            if (d === 30) return displayableCount > 7;

            // 90일은 30일 범위보다 더 볼 데이터가 있을 때 활성
            if (d === 90) return displayableCount > 30;

            return false;
        },
        [displayableCount]
    );

    const chartRows = useMemo(() => {
        const hasNow =
            typeof currentEquity === "number" &&
            Number.isFinite(currentEquity) &&
            currentEquity > 0;

        // NOW를 붙일 거면 과거 저장 데이터는 rangeDays - 1개만 사용
        const savedLimit = hasNow ? Math.max(0, rangeDays - 1) : rangeDays;

        let arr = normalizedRows.slice(-savedLimit);

        if (hasNow) {
            arr = [...arr, { day: "NOW", equity: currentEquity }];
        }

        return arr;
    }, [normalizedRows, rangeDays, currentEquity]);


    const minEq = useMemo(() => {
        if (!chartRows.length) return 0;
        return Math.min(...chartRows.map((r) => r.equity));
    }, [chartRows]);

    const maxEq = useMemo(() => {
        if (!chartRows.length) return 0;
        return Math.max(...chartRows.map((r) => r.equity));
    }, [chartRows]);

    const first = chartRows[0]?.equity ?? null;
    const last = chartRows[chartRows.length - 1]?.equity ?? null;
    const diff = first != null && last != null ? last - first : null;
    const diffPct = first > 0 && diff != null ? (diff / first) * 100 : null;


    const fmt = (n, d = 2) =>
        typeof n === "number" && Number.isFinite(n)
            ? n.toLocaleString(undefined, {
                minimumFractionDigits: d,
                maximumFractionDigits: d,
            })
            : "—";

    const btnStyle = (active, disabled) => ({
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${active ? "#00ffcc" : "#333"}`,
        background: active ? "#00ffcc" : "#1a1a1a",
        color: active ? "#000" : "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12,
        opacity: disabled ? 0.35 : 1,
    });
    useEffect(() => {
        if (!chartRef.current) return;
        if (loading) return;
        if (!chartRows.length) return;

        const el = chartRef.current;
        el.innerHTML = "";

        const chart = createChart(el, {
            width: el.clientWidth || 300,
            height: 140,
            layout: {
                background: { type: ColorType.Solid, color: "#0f0f0f" },
                textColor: "#aaa",
            },
            grid: {
                vertLines: { color: "#1f1f1f" },
                horzLines: { color: "#1f1f1f" },
            },
            rightPriceScale: {
                borderColor: "#333",
            },
            timeScale: {
                borderColor: "#333",
                timeVisible: false,
            },
            crosshair: {
                mode: 1,
            },
        });

        const lineSeries = chart.addLineSeries({
            color: "#00ffcc",
            lineWidth: 3,
            priceFormat: {
                type: "price",
                precision: 2,
                minMove: 0.01,
            },
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

                    // KST 기준 날짜를 UTC timestamp로 대충 맞춤
                    time = Math.floor(new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).getTime() / 1000);
                } else {
                    time = Math.floor(Date.now() / 1000) - (chartRows.length - idx) * 86400;
                }

                return {
                    time,
                    value: Number(r.equity),
                };
            })
            .filter((x) => Number.isFinite(x.time) && Number.isFinite(x.value))
            .sort((a, b) => a.time - b.time);

        lineSeries.setData(data);
        chart.timeScale().fitContent();

        const resize = () => {
            chart.applyOptions({
                width: el.clientWidth || 300,
                height: 140,
            });
            chart.timeScale().fitContent();
        };

        window.addEventListener("resize", resize);

        return () => {
            window.removeEventListener("resize", resize);
            chart.remove();
        };
    }, [chartRows, loading]);
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 16,
                background: "#151515",
                border: "1px solid #2a2a2a",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                width: "100%",
                minHeight: 260,
                boxSizing: "border-box",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>평가 USDT</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>
                        저장 {availableCount}일 · 현재 포함 {chartRows.length}개
                    </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                    {[7, 30, 90].map((d) => {
                        const disabled = loading || !canUseRange(d);
                        const active = rangeDays === d;

                        return (
                            <button
                                key={d}
                                onClick={() => {
                                    if (!disabled) setRangeDays(d);
                                }}
                                disabled={disabled}
                                style={btnStyle(active, disabled)}
                                title={
                                    disabled
                                        ? `${d}일 보기에는 저장 데이터가 부족합니다.`
                                        : `${d}일 보기`
                                }
                            >
                                {d}일
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                    {fmt(last, 2)} <span style={{ fontSize: 13, opacity: 0.75 }}>USDT</span>
                </div>

                <div
                    style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: diff == null ? "#aaa" : diff >= 0 ? "#16a34a" : "#dc2626",
                        fontWeight: 800,
                    }}
                >
                    {diff == null
                        ? "변화 없음"
                        : `${diff >= 0 ? "+" : ""}${fmt(diff, 2)} USDT / ${diffPct >= 0 ? "+" : ""}${fmt(diffPct, 2)}%`}
                </div>
            </div>

            <div
                style={{
                    marginTop: 12,
                    height: 140,
                    borderRadius: 12,
                    background: "#0f0f0f",
                    border: "1px solid #242424",
                    padding: 0,
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
            >
                {loading ? (
                    <div style={{ fontSize: 12, opacity: 0.7, padding: 10 }}>불러오는 중...</div>
                ) : chartRows.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.7, padding: 10 }}>
                        저장된 평가 USDT 데이터가 없습니다.
                    </div>
                ) : (
                    <div ref={chartRef} style={{ width: "100%", height: "100%" }} />
                )}
            </div>

            <div
                style={{
                    marginTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    opacity: 0.65,
                }}
            >
                <span>min {fmt(minEq, 2)}</span>
                <span>max {fmt(maxEq, 2)}</span>
            </div>
        </div>
    );
}

/* ------------------------- 트레이딩 로직 설명 탭 ------------------------- */
function TradingLogicTabs() {
    const [activeTab, setActiveTab] = useState("formula");

    const tabs = [
        { key: "formula", label: "기준 수식" },
        { key: "entry", label: "진입" },
        { key: "boost", label: "BOOST" },
        { key: "exit", label: "청산" },
        { key: "risk", label: "리스크 컨트롤" },
    ];

    const wrapStyle = {
        padding: 16,
        borderRadius: 16,
        background: "#151515",
        border: "1px solid #2a2a2a",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        width: "100%",
        boxSizing: "border-box",
    };

    const btnStyle = (active) => ({
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? "#00ffcc" : "#333"}`,
        background: active ? "rgba(0,255,204,0.13)" : "#1a1a1a",
        color: active ? "#00ffcc" : "#ddd",
        fontWeight: 900,
        fontSize: 12,
        cursor: "pointer",
    });

    return (
        <div style={wrapStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>트레이딩 로직 설명</div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                        LONG 기준 설명입니다. SHORT은 같은 조건을 반대 방향으로 적용합니다.
                    </div>
                </div>

                <div style={{ fontSize: 11, opacity: 0.6, alignSelf: "flex-end" }}>
                    MA100 · momentum · BOOST · RISK CONTROL
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        style={btnStyle(activeTab === t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div style={{ marginTop: 14 }}>
                {activeTab === "formula" && <LogicFormulaTab />}
                {activeTab === "entry" && <LogicEntryTab />}
                {activeTab === "boost" && <LogicBoostTab />}
                {activeTab === "exit" && <LogicExitTab />}
                {activeTab === "risk" && <LogicRiskTab />}
            </div>
        </div>
    );
}

function TradingLogicFloatingButton() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                style={{
                    position: "fixed",
                    right: 18,
                    bottom: 18,
                    zIndex: 1000,
                    padding: "11px 14px",
                    borderRadius: 999,
                    border: "1px solid #00ffcc",
                    background: "rgba(0,255,204,0.16)",
                    color: "#00ffcc",
                    fontWeight: 900,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                    backdropFilter: "blur(8px)",
                }}
                title="트레이딩 로직 설명 보기"
            >
                전략 설명
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 2000,
                        background: "rgba(0,0,0,0.72)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 18,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "min(980px, 96vw)",
                            maxHeight: "88vh",
                            overflowY: "auto",
                            borderRadius: 18,
                            background: "#111",
                            border: "1px solid #2a2a2a",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
                        }}
                    >
                        <div
                            style={{
                                position: "sticky",
                                top: 0,
                                zIndex: 1,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 14px",
                                background: "rgba(17,17,17,0.94)",
                                borderBottom: "1px solid #2a2a2a",
                                backdropFilter: "blur(8px)",
                            }}
                        >
                            <div style={{ fontWeight: 900, fontSize: 15 }}>
                                트레이딩 로직 설명
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                style={{
                                    border: "1px solid #333",
                                    background: "#1a1a1a",
                                    color: "#fff",
                                    borderRadius: 10,
                                    padding: "7px 10px",
                                    fontWeight: 900,
                                    cursor: "pointer",
                                }}
                            >
                                닫기
                            </button>
                        </div>

                        <div style={{ padding: 14 }}>
                            <TradingLogicTabs />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}


function MiniLogicChart({ title, lines = [], points = [], note }) {
    const W = 560;
    const H = 190;

    return (
        <div
            style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                background: "#0f0f0f",
                border: "1px solid #282828",
                overflow: "hidden",
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
                {title}
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 680 }}>
                <line x1="48" y1="30" x2="520" y2="30" stroke="#222" />
                <line x1="48" y1="70" x2="520" y2="70" stroke="#222" />
                <line x1="48" y1="110" x2="520" y2="110" stroke="#222" />
                <line x1="48" y1="150" x2="520" y2="150" stroke="#222" />

                {lines.map((ln, idx) => (
                    <g key={idx}>
                        <line
                            x1="48"
                            y1={ln.y}
                            x2="520"
                            y2={ln.y}
                            stroke={ln.color || "#aaa"}
                            strokeWidth="2"
                            strokeDasharray={ln.dash || ""}
                        />
                        <text x="6" y={ln.y + 4} fill={ln.color || "#aaa"} fontSize="11">
                            {ln.label}
                        </text>
                    </g>
                ))}

                {points.length > 1 && (
                    <polyline
                        fill="none"
                        stroke="#eee"
                        strokeWidth="2"
                        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                    />
                )}

                {points.map((p, idx) => (
                    <g key={idx}>
                        <circle cx={p.x} cy={p.y} r="4" fill={p.color || "#00ffcc"} />
                        {p.label && (
                            <text x={p.x + 7} y={p.y - 7} fill={p.color || "#00ffcc"} fontSize="11">
                                {p.label}
                            </text>
                        )}
                    </g>
                ))}
            </svg>

            {note && (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
                    {note}
                </div>
            )}
        </div>
    );
}

function LogicFormulaTab() {
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div><b>MA100</b> = 최근 100개 캔들의 평균 가격</div>
            <div><b>ma_thr_eff</b> = MA100에서 얼마나 벗어나야 신호로 볼지 정한 기준 거리</div>
            <div><b>ma_thr_eff / 2</b> = MA100 기준 거리의 절반</div>

            <div style={{ marginTop: 10 }}>
                예시: <b>MA100 = 100</b>, <b>ma_thr_eff = 0.6%</b>
            </div>

            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                <li>LONG INIT 기준 = 100 × (1 - 0.006) = <b>99.4</b></li>
                <li>SCALE_IN 기존 기준 = 100 × (1 - 0.003) = <b>99.7</b> + 하락 모멘텀</li>
                <li>SCALE_IN 추가 기준 = 100 × (1 - 0.006) = <b>99.4</b> 도달</li>
                <li>NORMAL 청산 기준 = 100 × (1 + 0.006) = <b>100.6</b></li>
                <li>SHORT은 위/아래 방향만 반대로 적용</li>
            </ul>

            <MiniLogicChart
                title="MA100 기준선 예시"
                lines={[
                    { y: 45, label: "100.6", color: "#00ffcc" },
                    { y: 85, label: "100.0", color: "#ffd166" },
                    { y: 115, label: "99.7", color: "#7ee787", dash: "4 4" },
                    { y: 145, label: "99.4", color: "#ff8080" },
                ]}
                points={[
                    { x: 80, y: 82 },
                    { x: 170, y: 110 },
                    { x: 260, y: 146, label: "LONG INIT", color: "#ff8080" },
                    { x: 360, y: 118, label: "SCALE 기준", color: "#7ee787" },
                    { x: 470, y: 45, label: "청산", color: "#00ffcc" },
                ]}
                note="ma_thr_eff / 2는 MA100 기준 이격의 절반입니다. SCALE_IN은 기존의 절반 기준+모멘텀 또는 ma_thr_eff 전체 도달 기준으로 발생합니다."
            />
        </div>
    );
}

function LogicEntryTab() {
    const conditionBox = {
        marginTop: 8,
        padding: 10,
        borderRadius: 12,
        background: "#101010",
        border: "1px solid #2a2a2a",
        fontSize: 12,
        lineHeight: 1.7,
    };

    const andStyle = {
        display: "inline-block",
        margin: "4px 0",
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,255,204,0.12)",
        border: "1px solid rgba(0,255,204,0.35)",
        color: "#00ffcc",
        fontWeight: 900,
        fontSize: 11,
    };

    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>LONG 진입</div>

            <div style={conditionBox}>
                <b>INIT</b>
                <div>1. 포지션이 없음</div>
                <div style={andStyle}>AND</div>
                <div>2. price &lt; MA100 × (1 - ma_thr_eff)</div>
                <div style={andStyle}>AND</div>
                <div>3. 3분 모멘텀 &lt; -momentum_threshold</div>
            </div>

            <div style={conditionBox}>
                <b>INIT2 / INIT3</b>
                <div>1. INIT 이후 15분 이내</div>
                <div style={andStyle}>AND</div>
                <div>2. INIT2: price ≤ INIT_PRICE × (1 - ma_thr_eff)</div>
                <div>3. INIT3: price ≤ INIT_PRICE × (1 - ma_thr_eff × 2)</div>
            </div>

            <div style={conditionBox}>
                <b>SCALE_IN</b>
                <div>1. 최근 진입 후 30분 경과</div>
                <div style={andStyle}>AND</div>
                <div>2. price &lt; newest_entry</div>
                <div style={andStyle}>AND</div>
                <div>3. 아래 둘 중 하나 만족</div>
                <div style={{
                    display: "inline-block",
                    margin: "4px 0",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(255,184,108,0.12)",
                    border: "1px solid rgba(255,184,108,0.35)",
                    color: "#ffb86c",
                    fontWeight: 900,
                    fontSize: 11,
                }}>
                    OR
                </div>
                <div style={{ paddingLeft: 12 }}>
                    A. 기존 기준: price ≤ MA100 × (1 - ma_thr_eff / 2) AND 3분 모멘텀 &lt; -momentum_threshold<br />
                    B. 추가 기준: price ≤ MA100 × (1 - ma_thr_eff)
                </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                예시: ma_thr_eff = 0.6%라면 SCALE_IN은 MA100 -0.3% + 하락 모멘텀 또는 MA100 -0.6% 도달 시 발생합니다.
            </div>

            <MiniLogicChart
                title="LONG 단계 진입 예시"
                lines={[
                    { y: 50, label: "MA100", color: "#ffd166" },
                    { y: 95, label: "INIT", color: "#ff8080" },
                    { y: 125, label: "INIT2", color: "#ff8080", dash: "4 4" },
                    { y: 155, label: "INIT3", color: "#ff8080", dash: "4 4" },
                ]}
                points={[
                    { x: 60, y: 55 },
                    { x: 140, y: 96, label: "INIT", color: "#ff8080" },
                    { x: 240, y: 125, label: "INIT2", color: "#ff8080" },
                    { x: 340, y: 155, label: "INIT3", color: "#ff8080" },
                    { x: 460, y: 118 },
                ]}
                note="진입 조건은 대부분 AND 조건입니다. 가격 조건과 모멘텀 조건을 동시에 만족해야 합니다."
            />
        </div>
    );
}

function LogicBoostTab() {
    const conditionBox = {
        marginTop: 8,
        padding: 10,
        borderRadius: 12,
        background: "#101010",
        border: "1px solid #2a2a2a",
        fontSize: 12,
        lineHeight: 1.7,
    };

    const andStyle = {
        display: "inline-block",
        margin: "4px 0",
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,255,204,0.12)",
        border: "1px solid rgba(0,255,204,0.35)",
        color: "#00ffcc",
        fontWeight: 900,
        fontSize: 11,
    };

    const orStyle = {
        display: "inline-block",
        margin: "4px 0",
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(255,184,108,0.12)",
        border: "1px solid rgba(255,184,108,0.35)",
        color: "#ffb86c",
        fontWeight: 900,
        fontSize: 11,
    };

    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>BOOST 진입</div>

            <div style={conditionBox}>
                <b>BOOST_ENTRY</b>
                <div>1. anchor = INIT 또는 SCALE_IN</div>
                <div style={andStyle}>AND</div>
                <div>2. anchor 발생 후 2분~15분 사이</div>
                <div style={andStyle}>AND</div>
                <div>3. 같은 anchor 기준 누적 BOOST 진입 수 &lt; 2</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                    * BOOST가 청산되어도 같은 INIT/SCALE_IN anchor로는 최대 2회까지만 재진입 가능합니다.
                </div>
                <div style={andStyle}>AND</div>
                <div>4. 마지막 BOOST 이후 5분 이상 경과</div>
                <div style={andStyle}>AND</div>
                <div>5. 아래 둘 중 하나 만족</div>
                <div style={orStyle}>OR</div>
                <div style={{ paddingLeft: 12 }}>
                    A. 3분 모멘텀 &lt; -momentum_threshold<br />
                    B. price ≤ anchor_entry
                </div>
            </div>

            <div style={conditionBox}>
                <b>BOOST 청산</b>
                <div>1. anchor + BOOST 평균가 기준 +0.3% → 해당 BOOST 묶음 청산</div>
                <div style={orStyle}>OR</div>
                <div>2. anchor 후 20분 경과 + price ≥ anchor+BOOST 평균가 → BOOST 정리</div>
                <div style={orStyle}>OR</div>
                <div>3. anchor 후 30분 경과 → BOOST 강제 청산</div>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                SHORT은 반대로 적용됩니다. 상승 모멘텀 또는 price ≥ anchor_entry이면 BOOST 후보가 됩니다.
            </div>

            <MiniLogicChart
                title="BOOST 시간 구조"
                lines={[
                    { y: 95, label: "anchor", color: "#ffd166" },
                ]}
                points={[
                    { x: 60, y: 95, label: "Anchor", color: "#ffd166" },
                    { x: 120, y: 120, label: "2분", color: "#aaa" },
                    { x: 190, y: 135, label: "BOOST1", color: "#00ffcc" },
                    { x: 310, y: 150, label: "BOOST2", color: "#00ffcc" },
                    { x: 400, y: 118, label: "15분", color: "#aaa" },
                    { x: 455, y: 100, label: "20분", color: "#ffb86c" },
                    { x: 510, y: 82, label: "30분", color: "#ff8080" },
                ]}
                note="2분 전에는 BOOST 진입 금지, 15분 이후에는 신규 BOOST 금지, 20분 이후에는 실패 BOOST 정리 조건, 30분 이후에는 강제 정리입니다."
            />
        </div>
    );
}

function LogicExitTab() {
    const conditionBox = {
        marginTop: 8,
        padding: 10,
        borderRadius: 12,
        background: "#101010",
        border: "1px solid #2a2a2a",
        fontSize: 12,
        lineHeight: 1.7,
    };

    const andStyle = {
        display: "inline-block",
        margin: "4px 0",
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,255,204,0.12)",
        border: "1px solid rgba(0,255,204,0.35)",
        color: "#00ffcc",
        fontWeight: 900,
        fontSize: 11,
    };

    const orStyle = {
        display: "inline-block",
        margin: "4px 0",
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(255,184,108,0.12)",
        border: "1px solid rgba(255,184,108,0.35)",
        color: "#ffb86c",
        fontWeight: 900,
        fontSize: 11,
    };

    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>청산 기준</div>

            <div style={conditionBox}>
                <b>STOP_LOSS / TAKE_PROFIT</b>
                <div>STOP_LOSS: oldest 손익률 ≤ -(ma_thr_eff × 7)</div>
                <div>TAKE_PROFIT: oldest 손익률 ≥ ma_thr_eff × 2</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                    예시: oldest_entry = 100, ma_thr_eff = 0.6%라면 SL은 95.8 이하, TP는 101.2 이상입니다.
                </div>
            </div>

            <div style={conditionBox}>
                <b>NORMAL</b>
                <div>1. newest 진입 후 30분 초과</div>
                <div style={andStyle}>AND</div>
                <div>2. price ≥ MA100 × (1 + ma_thr_eff)</div>
                <div>결과: 전체 청산</div>
            </div>

            <div style={conditionBox}>
                <b>SCALE_OUT</b>
                <div>1. 포지션 2개 이상</div>
                <div style={andStyle}>AND</div>
                <div>2. scale out 쿨다운이 끝난 상태</div>
                <div style={andStyle}>AND</div>
                <div>3. price와 prev_entry 비교에 따라 아래 기준 적용</div>

                <div style={orStyle}>CASE</div>

                <div style={{ paddingLeft: 12 }}>
                    A. price ≥ prev_entry인 경우<br />
                    → price ≥ MA100 × (1 + ma_thr_eff / 2)
                    <br /><br />
                    B. price &lt; prev_entry인 경우<br />
                    → price ≥ MA100 × (1 + ma_thr_eff × 2 / 3)
                </div>

                <div style={{ marginTop: 6 }}>
                    결과: newest 1개 청산
                </div>

                <div style={{ marginTop: 6, opacity: 0.75 }}>
                    prev_entry보다 유리한 가격이면 더 빠르게 일부 청산하고, 아직 prev_entry를 회복하지 못한 경우에는
                    더 높은 MA100 회복 기준을 요구한 뒤 리스크 축소 목적으로 newest 포지션만 줄입니다.
                </div>
            </div>

            <div style={conditionBox}>
                <b>NEAR_TOUCH</b>
                <div>1. newest 진입 후 30분 이내</div>
                <div style={andStyle}>AND</div>
                <div>2. 아래 둘 중 하나 만족</div>
                <div style={orStyle}>OR</div>
                <div style={{ paddingLeft: 12 }}>
                    A. price ≥ MA100 × (1 - exit_easing)<br />
                    B. price ≥ newest_entry × (1 + ma_thr_eff × 0.7)
                </div>
                <div>결과: newest 1개 청산</div>
            </div>

            <MiniLogicChart
                title="TP / SL 예시"
                lines={[
                    { y: 45, label: "TP", color: "#00ffcc" },
                    { y: 95, label: "Entry", color: "#ffd166" },
                    { y: 150, label: "SL", color: "#ff8080" },
                ]}
                points={[
                    { x: 80, y: 95, label: "진입" },
                    { x: 180, y: 130 },
                    { x: 280, y: 100 },
                    { x: 390, y: 70 },
                    { x: 470, y: 45, label: "TP", color: "#00ffcc" },
                ]}
                note="TP/SL은 oldest 포지션 기준 손익률로 계산됩니다."
            />

            <MiniLogicChart
                title="NORMAL / SCALE_OUT / NEAR_TOUCH 회복 청산"
                lines={[
                    { y: 45, label: "NORMAL", color: "#00ffcc" },
                    { y: 75, label: "SCALE_OUT", color: "#7ee787", dash: "4 4" },
                    { y: 105, label: "MA100", color: "#ffd166" },
                    { y: 135, label: "NEAR_TOUCH", color: "#ffb86c", dash: "4 4" },
                ]}
                points={[
                    { x: 70, y: 155, label: "진입" },
                    { x: 160, y: 142, label: "30분 이내" },
                    { x: 250, y: 135, label: "NEAR", color: "#ffb86c" },
                    { x: 350, y: 75, label: "SCALE", color: "#7ee787" },
                    { x: 470, y: 45, label: "NORMAL", color: "#00ffcc" },
                ]}
                note="NEAR_TOUCH는 진입 직후 빠른 회복 청산, SCALE_OUT은 여러 포지션 중 최신 포지션 일부 청산, NORMAL은 MA100 목표선 회복 시 전체 청산입니다."
            />
        </div>
    );
}

function LogicRiskTab() {
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>RISK CONTROL 청산</div>

            <ul style={{ paddingLeft: 18 }}>
                <li><b>조건</b>: 보유 포지션 5개 이상</li>
                <li><b>수익 기준</b>: price ≥ 전체 평균가 × 1.003</li>
                <li><b>청산 대상</b>: oldest부터 일부 청산</li>
            </ul>

            <div
                style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                    gap: 8,
                    fontSize: 12,
                }}
            >
                {[
                    ["5개", "1개 청산"],
                    ["6개", "2개 청산"],
                    ["7개", "3개 청산"],
                    ["8개", "4개 청산"],
                    ["9개", "4개 청산"],
                    ["10개", "5개 청산"],
                ].map(([n, txt]) => (
                    <div
                        key={n}
                        style={{
                            padding: 10,
                            borderRadius: 12,
                            background: "#101010",
                            border: "1px solid #2a2a2a",
                        }}
                    >
                        <div style={{ fontWeight: 900, color: "#00ffcc" }}>{n}</div>
                        <div style={{ opacity: 0.8 }}>{txt}</div>
                    </div>
                ))}
            </div>

            <MiniLogicChart
                title="RISK CONTROL 예시"
                lines={[
                    { y: 70, label: "+0.3%", color: "#00ffcc" },
                    { y: 105, label: "평균가", color: "#ffd166" },
                ]}
                points={[
                    { x: 70, y: 150, label: "1" },
                    { x: 145, y: 135, label: "2" },
                    { x: 220, y: 120, label: "3" },
                    { x: 295, y: 110, label: "4" },
                    { x: 370, y: 105, label: "평균" },
                    { x: 465, y: 70, label: "청산", color: "#00ffcc" },
                ]}
                note="5개 이상 쌓인 상태에서 전체 평균가보다 0.3% 이상 유리해지면 oldest부터 일부 포지션을 줄입니다."
            />
        </div>
    );
}


/* ------------------------- threshold meta ------------------------- */
async function fetchThresholdMeta(symbol, ns) {
    const qs = new URLSearchParams({ symbol: String(symbol || "") });
    if (ns) qs.set("name", String(ns));
    const url = `/api/thresholds?${qs.toString()}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) || null;
}

/* ------------------------- symbols 추출 유틸 ------------------------- */
function extractSymbolsFromConfig(cfgRaw) {
    const root = cfgRaw?.config ?? cfgRaw;
    if (!root) return [];

    const normalize = (raw) => {
        if (typeof raw === "string") {
            raw = raw
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
        }
        if (!Array.isArray(raw)) return [];

        const out = [];
        for (const it of raw) {
            if (it == null) continue;
            if (typeof it === "string" || typeof it === "number") {
                out.push(String(it));
                continue;
            }
            if (typeof it === "object") {
                const s = it.symbol ?? it.sym ?? it.name ?? it.ticker ?? it.pair ?? it.market ?? it.code ?? null;
                if (s) out.push(String(s));
            }
        }

        return out
            .map((s) => String(s).trim())
            .filter(Boolean)
            .map((s) => s.toUpperCase());
    };

    const pickFrom = (obj) => {
        if (!obj || typeof obj !== "object") return [];
        const raw = obj.symbols ?? obj.trade_symbols ?? obj.target_symbols ?? obj.targets ?? obj.pairs ?? obj.markets ?? obj.instruments ?? obj.watchlist ?? null;
        return normalize(raw);
    };

    let symbols = pickFrom(root);
    if (symbols.length) return symbols;

    const candidates = [root.bybit, root.mt5, root.bot, root.bots, root.strategy, root.strategies, root.config, root.settings, root.params,];
    for (const c of candidates) {
        symbols = pickFrom(c);
        if (symbols.length) return symbols;
    }

    const seen = new Set();
    const stack = [root];
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (seen.has(cur)) continue;
        seen.add(cur);

        symbols = pickFrom(cur);
        if (symbols.length) return symbols;

        for (const v of Object.values(cur)) {
            if (v && typeof v === "object") stack.push(v);
        }
    }

    return [];
}

export default function Coin() {
    const [dayOffset, setDayOffset] = useState(0);

    /* ------------------------- config ------------------------- */
    const [configState, setConfigState] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [anchorEndUtcSec] = useState(() => next0650EndBoundaryUtcSec());

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await fetch("/api/config", { cache: "no-store" });
                if (!r.ok) return;
                const j = await r.json();
                if (alive) setConfigState(j?.config ?? j);
            } catch {
            } finally {
                if (alive) setConfigLoaded(true);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // asset 네임스페이스
    const assetNs = useMemo(() => "agent:CopyZannavi:u7c9f14d2a1:BYBIT", []);

    // signals 네임스페이스
    const signalNs = useMemo(() => {
        return String(configState?.name || configState?.exchange || "bybit").trim();
    }, [configState]);

    const bybitSource = useMemo(() => makeBybitSource({ signalName: signalNs }), [signalNs]);

    const symbolsConfig = useMemo(() => {
        const symbols = extractSymbolsFromConfig(configState);
        return symbols.map((sym) => ({ symbol: sym, market: "linear" }));
    }, [configState]);

    const [selectedSymbol, setSelectedSymbol] = useState(null);

    const visibleSymbols = useMemo(() => {
        if (!selectedSymbol) return symbolsConfig;
        return symbolsConfig.filter((s) => s.symbol === selectedSymbol);
    }, [symbolsConfig, selectedSymbol]);


    const symbolsReady = symbolsConfig.length > 0;
    const requiredSymbols = useMemo(() => symbolsConfig.map((s) => s.symbol), [symbolsConfig]);
    const requiredSymbolsKey = useMemo(() => requiredSymbols.join(","), [requiredSymbols]);
    /* ------------------------- asset ------------------------- */
    const [asset, setAsset] = useState({ wallet: { USDT: 0 }, positions: {} });

    useEffect(() => {
        let alive = true;
        if (!symbolsReady) return;

        (async () => {
            try {
                const symbolsQs = requiredSymbolsKey ? `&symbols=${encodeURIComponent(requiredSymbolsKey)}` : "";

                const res = await fetch(`/api/asset?ns=${encodeURIComponent(assetNs)}${symbolsQs}`, { cache: "no-store" });

                const j = res.ok ? await res.json() : null;
                if (!alive || !j) return;
                setAsset(j.asset);
            } catch {
            }
        })();

        return () => {
            alive = false;
        };
    }, [assetNs, symbolsReady, requiredSymbolsKey]);

    /* ------------------------- stats ------------------------- */
    const [statsMap, setStatsMap] = useState({});
    const onStats = useCallback((symbol, stats) => {
        setStatsMap((prev) => ({
            ...prev, [symbol]: { ...prev[symbol], ...stats },
        }));
    }, []);

    /* ------------------------- threshold/meta ------------------------- */
    const [metaMap, setMetaMap] = useState({});
    useEffect(() => {
        let alive = true;
        if (!symbolsReady) return;

        (async () => {
            try {
                const results = await Promise.all(symbolsConfig.map((s) => fetchThresholdMeta(s.symbol, signalNs).catch(() => null)));
                if (!alive) return;

                const merged = {};
                results.forEach((m, i) => {
                    if (m) merged[symbolsConfig[i].symbol] = m;
                });
                setMetaMap((prev) => ({ ...prev, ...merged }));
            } catch {
            }
        })();

        return () => {
            alive = false;
        };
    }, [symbolsConfig, symbolsReady, signalNs]);

    /* ------------------------- equity (현재 평가액) ------------------------- */
    const START_USDT = 500;

    const equityUsdt = useMemo(() => {
        const wallet = Number(asset?.wallet?.USDT ?? 0);
        if (!Number.isFinite(wallet)) return null;

        const positions = asset?.positions || {};
        let unrealized = 0;

        for (const [symbol, posBySide] of Object.entries(positions)) {
            const sym = String(symbol || "").toUpperCase();
            const price = Number(statsMap?.[sym]?.price);

            if (!Number.isFinite(price) || price <= 0) continue;
            if (!posBySide || typeof posBySide !== "object") continue;

            for (const side of ["LONG", "SHORT"]) {
                const sidePos = posBySide?.[side];
                if (!sidePos || typeof sidePos !== "object") continue;

                const entries = Array.isArray(sidePos.entries) ? sidePos.entries : [];

                // entries가 있으면 lot별 평가
                if (entries.length > 0) {
                    for (const e of entries) {
                        const qty = Number(e.qty ?? e.qty_total ?? 0);
                        const entry = Number(e.price ?? e.entry_price ?? 0);

                        if (!Number.isFinite(qty) || qty <= 0) continue;
                        if (!Number.isFinite(entry) || entry <= 0) continue;

                        if (side === "LONG") {
                            unrealized += (price - entry) * qty;
                        } else {
                            unrealized += (entry - price) * qty;
                        }
                    }

                    continue;
                }

                // entries가 없을 때 fallback
                const qty = Number(sidePos.qty ?? 0);
                const entry = Number(sidePos.price ?? sidePos.entry_price ?? sidePos.avg_price ?? 0);

                if (!Number.isFinite(qty) || qty <= 0) continue;
                if (!Number.isFinite(entry) || entry <= 0) continue;

                if (side === "LONG") {
                    unrealized += (price - entry) * qty;
                } else {
                    unrealized += (entry - price) * qty;
                }
            }
        }

        return wallet + unrealized;
    }, [asset, statsMap]);

    /* ------------------------- bounds (dayOffset clamp) ------------------------- */
    const [perSymbolBounds, setPerSymbolBounds] = useState({});
    const onBounds = useCallback((symbol, bounds) => {
        setPerSymbolBounds((prev) => ({ ...prev, [symbol]: bounds }));
    }, []);

    const { minOffset, maxOffset, boundsReady } = useMemo(() => {
        if (!symbolsReady) return { minOffset: 0, maxOffset: 0, boundsReady: false };

        const haveAll = requiredSymbols.every((sym) => perSymbolBounds[sym]);
        if (!haveAll) return { minOffset: 0, maxOffset: 0, boundsReady: false };

        const values = requiredSymbols.map((sym) => perSymbolBounds[sym]);
        const minCommon = Math.max(...values.map((b) => b.min ?? 0));
        const maxCommon = Math.min(...values.map((b) => b.max ?? 0));
        return { minOffset: minCommon, maxOffset: maxCommon, boundsReady: true };
    }, [perSymbolBounds, requiredSymbols, symbolsReady]);

    useEffect(() => {
        if (!boundsReady) return;
        setDayOffset((d) => Math.min(Math.max(d, minOffset), maxOffset));
    }, [boundsReady, minOffset, maxOffset]);

    const atMin = boundsReady && dayOffset <= minOffset;
    const atMax = boundsReady && dayOffset >= maxOffset;

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

    /* ------------------------- UI ------------------------- */
    if (!configLoaded) {
        return (<div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
            <div style={{ opacity: 0.85 }}>config 로딩중...</div>
        </div>);
    }

    if (!symbolsReady) {
        return (<div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
            <div
                style={{
                    padding: 14, borderRadius: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", lineHeight: 1.6,
                }}
            >
                심볼 목록을 불러오지 못했어요.
                <br />
                <span style={{ opacity: 0.75 }}>잠시 후 다시 시도해 주세요. 문제가 계속되면 운영자에게 문의해 주세요.</span>
            </div>
        </div>);
    }

    const PAGE_MAX_W = 1460;
    const MIN_LEFT = 260;
    const MIN_RIGHT = 260;
    const GAP = 24;
    const MIN_MAIN = MIN_LEFT + MIN_RIGHT + GAP; // 544
    const inviteUrl = "https://i.bybit.com/1ulbabnd?action=inviteToCopy";
    const startDate = "2026-02-01";

    return (<div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
        <div
            style={{
                maxWidth: PAGE_MAX_W,
                margin: "0 auto",
                overflowX: "auto",
                background: "#111",
            }}
        >
            <div style={{ minWidth: MIN_MAIN }}>

                {/* ✅ 상단 1줄: 평가 USDT 그래프 전체폭 */}
                <div
                    style={{
                        maxWidth: PAGE_MAX_W,
                        margin: "0 auto 18px",
                        minWidth: 0,
                    }}
                >
                    <EquityHistoryCard currentEquity={equityUsdt} />
                </div>

                {/* ✅ 상단 2줄: 계정 안내 + 자산/포지션 카드 */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(360px, 0.85fr) minmax(520px, 1.15fr)",
                        gap: 24,
                        alignItems: "start",
                        justifyContent: "center",
                        maxWidth: PAGE_MAX_W,
                        margin: "0 auto 18px",
                        minWidth: 0,
                    }}
                >
                    <CopyTradingInfoBanner
                        inviteUrl={inviteUrl}
                        startDate={startDate}
                        startUsdt={START_USDT}
                        equityUsdt={equityUsdt}
                        qrSize={82}
                    />

                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <AssetPanel asset={asset} statsBySymbol={statsMap} config={configState} />
                    </div>
                </div>
                {/* ✅ 하단: 보기설정/티커(기존 폭 유지) + 차트(그대로) */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(260px, 1fr) minmax(260px, 4fr)",
                    gap: 24,
                    alignItems: "start",
                    minWidth: 0, // ✅ 이거 추가

                }}>
                    {/* 왼쪽 */}
                    <div style={{ minWidth: 0 }}>
                        <div
                            style={{
                                position: "sticky",
                                top: 12,
                                zIndex: 5,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                            }}
                        >
                            <div
                                style={{
                                    padding: "14px 16px",
                                    borderRadius: 14,
                                    background: "#1a1a1a",
                                    marginBottom: 14,
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                                }}
                            >
                                {/* 헤더: 제목 + 날짜 */}
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline"
                                }}>
                                    <div style={{ fontWeight: 700, marginBottom: 10 }}>보기 설정</div>
                                    <div style={{ fontSize: 12, opacity: 0.85 }}>{getDayLabel(anchorEndUtcSec, dayOffset)}</div>
                                </div>

                                {/* 1분봉 버튼 */}
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                                        title="오늘(0)로 이동"
                                    >
                                        1분봉
                                    </button>
                                </div>

                                <div style={{ height: 10 }} />

                                {/* 이전/오늘/다음 */}
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        onClick={() => setDayOffset((d) => Math.max(minOffset, d - 1))}
                                        disabled={!boundsReady || atMin}
                                        style={disBtnStyle(!boundsReady || atMin)}
                                        title="전날 보기"
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
                                        title="오늘 보기"
                                    >
                                        오늘
                                    </button>

                                    <button
                                        onClick={() => setDayOffset((d) => Math.min(maxOffset, d + 1))}
                                        disabled={!boundsReady || atMax}
                                        style={disBtnStyle(!boundsReady || atMax)}
                                        title="다음날 보기"
                                    >
                                        다음날 ▶
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 티커 카드 */}
                        <div style={{ display: "grid", gap: 12 }}>
                            {symbolsConfig.map((s) => {
                                const sym = s.symbol;
                                const st = statsMap[sym];
                                const meta = metaMap[sym] || {};
                                const ps = typeof st?.priceScale === "number" ? st.priceScale : 2;
                                const active = selectedSymbol === sym;

                                return (
                                    <div
                                        key={sym}
                                        style={{
                                            width: "100%",
                                            cursor: "pointer",
                                            opacity: selectedSymbol && !active ? 0.45 : 1,
                                            border: active ? "1px solid #00ffcc" : "1px solid transparent",
                                            borderRadius: 12,
                                        }}
                                        onClick={() => setSelectedSymbol((prev) => prev === sym ? null : sym)}
                                    >
                                        <UnifiedTickerCard
                                            symbol={sym}
                                            price={st?.price ?? null}
                                            ma100={st?.ma100 ?? null}
                                            chg3mPct={st?.chg3mPct ?? null}
                                            ps={ps}
                                            meta={meta}
                                            closesUnit="minutes"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 오른쪽 */}
                    <div style={{ minWidth: 0, display: "grid", gap: 12 }}>
                        {visibleSymbols.map((s) => (
                            <div key={s.symbol} style={{ width: "100%", minWidth: 0 }}>
                                <ChartPanelCore
                                    source={bybitSource}
                                    symbol={s.symbol}
                                    dayOffset={dayOffset}
                                    anchorEndUtcSec={anchorEndUtcSec}
                                    onBounds={onBounds}
                                    onStats={onStats}
                                    thr={metaMap[s.symbol]?.ma_threshold}
                                    crossTimes={metaMap[s.symbol]?.cross_times}
                                    bounds={{ min: -7, max: 0 }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        <TradingLogicFloatingButton />
    </div>
    );
}