// src/pages/coin.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import AssetPanel from "../components/AssetPanel";
import UnifiedTickerCard from "../components/common/UnifiedTickerCard";
import ChartPanelCore from "../components/common/ChartPanelCore";
import DailyChartPanel from "../components/common/DailyChartPanel";
import { makeBybitSource } from "../lib/chartSources";
import { QRCodeCanvas } from "qrcode.react";
import { next0650EndBoundaryUtcSec } from "../lib/tradeUtils";
import { getDayLabel } from "../utils/date";
import { createChart, ColorType } from "lightweight-charts";

// ✅ z-score 진입 밴드용 심볼별 K1 (trade_config TREND_BYBIT=S1추세 / REV_BYBIT=S2역추세)
//   값 = MA ± K1·σ 밴드. 없는 방향은 미채택(밴드 안 그림).
const K1_BYBIT = {
    BTCUSDT: { s1Long: 3.2, s2Long: 3.3, s2Short: 4.6 },
    ETHUSDT: { s1Long: 2.35, s1Short: 3.45, s2Long: 3.15, s2Short: 3.3 },
    SOLUSDT: { s1Long: 3.4, s1Short: 3.4, s2Long: 3.3 },
    XRPUSDT: { s1Long: 2.55, s2Long: 3.5, s2Short: 5.0 },
};

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
    const [activeTab, setActiveTab] = useState("overview");

    const tabs = [
        { key: "overview", label: "개요" },
        { key: "model", label: "공통 수식" },
        { key: "s1", label: "S1 추세" },
        { key: "s2", label: "S2 역추세" },
        { key: "live", label: "심볼·라이브" },
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
                        z-score(σ) 기반 2전략 × 2방향(롱+숏). S1=추세, S2=역추세(추매). 모두 라이브.
                    </div>
                </div>

                <div style={{ fontSize: 11, opacity: 0.6, alignSelf: "flex-end" }}>
                    z-score · win 7일 · 양방향 · S2 추매(평단↓) · 포트폴리오 캡 · 14일 청산
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
                {activeTab === "overview" && <LogicOverviewTab />}
                {activeTab === "model" && <LogicModelTab />}
                {activeTab === "s1" && <LogicS1TrendTab />}
                {activeTab === "s2" && <LogicS2ReversionTab />}
                {activeTab === "live" && <LogicLiveTab />}
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

/* ------------------------- S1/S2 (z-score) 전략 설명 ------------------------- */
const LBOX = {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    background: "#101010",
    border: "1px solid #2a2a2a",
    fontSize: 12,
    lineHeight: 1.7,
};
const LWARN = {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    background: "rgba(255,184,108,0.08)",
    border: "1px solid rgba(255,184,108,0.3)",
    fontSize: 12,
    opacity: 0.9,
    lineHeight: 1.6,
};
const LADD = {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    background: "rgba(126,231,135,0.07)",
    border: "1px solid rgba(126,231,135,0.4)",
    fontSize: 12,
    lineHeight: 1.7,
};

function LogicOverviewTab() {
    const cell = { padding: "8px 10px", borderBottom: "1px solid #222", fontSize: 12, verticalAlign: "top" };
    const head = { ...cell, fontWeight: 900, color: "#00ffcc", borderBottom: "1px solid #2a2a2a" };
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>전략 체계 — 2전략 × 2방향</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                가격이 7일 이동평균에서 표준편차(σ) 기준 얼마나 떨어졌는지(z-score)로 진입을 판단합니다.
                자산 성격에 따라 <b>추세(S1)</b>와 <b>역추세(S2)</b>를 적용하고, 채택된 심볼은 롱·숏 양방향으로 운용합니다.
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 440 }}>
                    <thead>
                        <tr>
                            <th style={head}></th>
                            <th style={head}>S1 · 추세 (trend)</th>
                            <th style={head}>S2 · 역추세 (reversion)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ ...cell, fontWeight: 900 }}>롱</td>
                            <td style={cell}>z ≥ +K1 진입 (상승 지속에 베팅)</td>
                            <td style={cell}>z ≤ −K1 진입 (되돌림 상승에 베팅)</td>
                        </tr>
                        <tr>
                            <td style={{ ...cell, fontWeight: 900 }}>숏</td>
                            <td style={cell}>z ≤ −K1 진입 (하락 지속에 베팅)</td>
                            <td style={cell}>z ≥ +K1 진입 (되돌림 하락에 베팅)</td>
                        </tr>
                        <tr>
                            <td style={{ ...cell, fontWeight: 900 }}>대상</td>
                            <td style={cell}>모멘텀 자산<br />SOL·금·은·ETH·BTC·지수</td>
                            <td style={cell}>평균회귀 자산<br />지수·BTC·XRP·WTI·금속</td>
                        </tr>
                        <tr>
                            <td style={{ ...cell, fontWeight: 900 }}>포지션 운용</td>
                            <td style={cell}>독립 다리 스택<br />(추매 없음)</td>
                            <td style={{ ...cell, color: "#7ee787" }}><b>추매(평단↓)</b><br />게임 중첩·게임당 1추매</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85, lineHeight: 1.7 }}>
                <b>핵심 아이디어</b><br />
                • 추세(S1): 이미 한쪽으로 크게 움직인(과열/급락) 자산은 그 방향으로 더 간다고 보고 따라붙음.<br />
                • 역추세(S2): 과하게 벌어진 자산은 평균으로 되돌아온다고 보고 반대로 잡되, 더 벌어지면 한 번 <b>추매</b>해 평단을 낮춤.<br />
                • 같은 z 신호라도 자산군에 따라 추세가 맞는 자산, 역추세가 맞는 자산이 갈립니다.
            </div>
        </div>
    );
}

function LogicModelTab() {
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>공통 모델 (v2)</div>

            <div style={LBOX}>
                <b>지표</b>
                <div>1분봉 기준, win = 10080개(= 7일) 고정</div>
                <div>MA = 최근 7일 종가 이동평균</div>
                <div>σ = 같은 창의 표준편차</div>
                <div><b>z = (현재가 − MA) / σ</b> — 평균에서 몇 σ 떨어졌는지</div>
            </div>

            <div style={LBOX}>
                <b>진입 / 청산 레벨 (진입 시 고정)</b>
                <div>진입: z가 임계 ±K1 도달 (전략·방향별)</div>
                <div>TP/SL = 진입가 기준 ±pct <b>대칭</b>, 손절 우선</div>
                <div>pct = (MA ± B·σ)와 진입가 사이의 거리(%)</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                    B는 양수/음수 모두 가능(목표 밴드를 평균 안쪽/바깥쪽으로 조정). 진입 즉시 TP·SL 가격을
                    못박고, 가격이 그 선에 닿으면 청산하는 단순·기계적 규칙입니다.
                </div>
            </div>

            <div style={LBOX}>
                <b>포지션 운용 (전략별 상이)</b>
                <div>• <b>추세(S1)</b>: 신호 재발생 시 독립 다리로 쌓음(스택), 각 다리가 자기 TP/SL로 따로 청산</div>
                <div>• <b>역추세(S2)</b>: 신호마다 새 게임을 열어 중첩(ontop) + 열린 각 게임에 1회 <b>추매</b>(게임당 ≤2레그, 평단↓·재앵커, 게임 단위 독립 청산)</div>
                <div style={{ marginTop: 4 }}>• 진입 쿨다운: 심볼별로 직전 진입 후 일정 시간 신규/추매 금지</div>
                <div>• 사이징: 진입당 자본 5%, 최대 유효레버리지 10x(≈200랏)까지 — 거래소 최소주문 미달 시 5→10→15→20% 자동 상향</div>
                <div>• 최대보유 14일: 초과 시 TP/SL 미도달이어도 시장가 강제청산</div>
                <div>• 수수료 0.11% 왕복 가정(리포팅)</div>
            </div>

            <MiniLogicChart
                title="z-score 진입 구조"
                lines={[
                    { y: 40, label: "+K1", color: "#ff8080" },
                    { y: 75, label: "+B·σ", color: "#7ee787", dash: "4 4" },
                    { y: 95, label: "MA (z=0)", color: "#ffd166" },
                    { y: 115, label: "−B·σ", color: "#7ee787", dash: "4 4" },
                    { y: 150, label: "−K1", color: "#ff8080" },
                ]}
                points={[
                    { x: 70, y: 95 },
                    { x: 160, y: 60 },
                    { x: 250, y: 42, label: "z=+K1", color: "#ff8080" },
                    { x: 360, y: 120 },
                    { x: 460, y: 150, label: "z=−K1", color: "#ff8080" },
                ]}
                note="±K1 도달이 진입 트리거. 같은 트리거를 추세는 '지속', 역추세는 '되돌림'으로 해석해 방향을 정합니다."
            />
        </div>
    );
}

function LogicS1TrendTab() {
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>S1 · 추세추종 (모멘텀 자산)</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                크게 움직인 방향으로 더 간다고 보고 추종합니다. 채택 심볼은 <b>롱·숏 양방향</b>으로 운용.
            </div>

            <div style={LBOX}>
                <b>추세 롱</b> (z ≥ +K1, 과열에서 상승 지속)
                <div>진입: z ≥ +K1 → 롱</div>
                <div>pct = 1 − (MA + B·σ) / 진입가</div>
                <div>TP = 진입가 × (1 + pct) [위] · SL = 진입가 × (1 − pct) [아래]</div>
            </div>

            <div style={LBOX}>
                <b>추세 숏</b> (z ≤ −K1, 급락에서 하락 지속)
                <div>진입: z ≤ −K1 → 숏</div>
                <div>TP = 진입가 × (1 − pct) [아래] · SL = 진입가 × (1 + pct) [위]</div>
            </div>

            <div style={LBOX}>
                <b>포지션 운용 — 독립 스택 (추매 없음)</b>
                <div>신호가 또 나오면 기존을 건드리지 않고 <b>새 다리</b>로 쌓습니다. 각 다리는 자기 TP/SL로 따로 청산.</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                    추세는 평단을 낮추면(추매) 오히려 손실을 키우는 경향이라 추매를 쓰지 않습니다. 전체 보유 수량은
                    포트폴리오 캡(≈200랏)이 제한합니다.
                </div>
            </div>

            <div style={LWARN}>
                ⚠ 최근 3년은 내내 강세장이라 <b>추세 롱이 주력</b>(예: SOLUSDT 기대 +7.09%, PF 3.22).
                추세 숏은 약세장이 올 때를 대비한 <b>레짐 보완</b> 성격입니다.
            </div>

            <MiniLogicChart
                title="추세 롱 구조 (z ≥ +K1)"
                lines={[
                    { y: 45, label: "TP (위)", color: "#00ffcc" },
                    { y: 80, label: "진입 z≥+K1", color: "#ff8080" },
                    { y: 115, label: "MA", color: "#ffd166" },
                    { y: 150, label: "SL (아래)", color: "#ff8080", dash: "4 4" },
                ]}
                points={[
                    { x: 70, y: 116 },
                    { x: 170, y: 90 },
                    { x: 250, y: 80, label: "진입", color: "#ff8080" },
                    { x: 370, y: 60 },
                    { x: 460, y: 45, label: "TP", color: "#00ffcc" },
                ]}
                note="과열(z≥+K1)에서 롱 진입 → 상승 지속 시 TP. 반대로 밀리면 대칭 거리의 SL에서 손절(손절 우선)."
            />
        </div>
    );
}

function LogicS2ReversionTab() {
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>S2 · 역추세 + 추매 (평균회귀 자산)</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                과하게 벌어지면 평균으로 되돌아온다고 보고 반대로 잡습니다. 더 벌어지면 한 번 <b>추매(평단 낮추기)</b>.
                채택 심볼은 롱·숏 양방향 운용.
            </div>

            <div style={LBOX}>
                <b>역추세 롱</b> (z ≤ −K1, 급락에서 되돌림 상승)
                <div>진입: z ≤ −K1 → 롱 · TP = MA − B·σ [위] · SL = 대칭 [아래]</div>
            </div>

            <div style={LBOX}>
                <b>역추세 숏</b> (z ≥ +K1, 과열에서 되돌림 하락)
                <div>진입: z ≥ +K1 → 숏 · TP = MA + B·σ [아래] · SL = 대칭 [위]</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                    역추세 숏은 K1을 높게(3.0~5.0) 잡아야 유효합니다. 예: XRPUSDT K1 5.0.
                </div>
            </div>

            <div style={LBOX}>
                <b>중첩(ontop) — 한 심볼에 여러 게임 동시보유</b>
                <div>각 진입 = 독립된 <b>"게임"</b>(자기 진입가·TP·SL로 따로 청산).</div>
                <div>쿨다운은 <b>새 게임 여는 간격</b>만 제한 — 이미 열린 게임이 닫히길 기다리지 않음.</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                    큰 하락이 며칠 이어지면 쿨다운 간격으로 게임이 여러 개 겹쳐 열립니다(동시보유 5~14개도 정상).
                    전체 한도는 포트폴리오 캡(≈200랏).
                </div>
            </div>

            <div style={LADD}>
                <b style={{ color: "#7ee787" }}>★ 추매 (평단 낮추기) — S2 역추세 전용</b>
                <div style={{ marginTop: 4 }}>
                    추매는 중첩을 건드리지 않습니다. 새 게임은 평소대로 다 열고, 그 <b>위에</b> 이미 열린 각 게임에 다리를 하나 더 얹습니다.
                </div>
                <div style={{ marginTop: 6 }}>쿨다운을 통과한 z 신호 하나가 동시에:</div>
                <div style={{ paddingLeft: 12 }}>
                    (a) <b>새 게임</b>을 연다 (중첩 유지)<br />
                    (b) 적격(자기 쿨다운 지나고·아직 추매 안 한·열려있는) <b>모든 게임</b>에 1회씩 추매
                </div>
                <div style={{ marginTop: 6 }}>추매되는 게임은:</div>
                <div style={{ paddingLeft: 12 }}>
                    • 새 평단 = 그 게임 진입가들의 단순평균(1:1 균등)<br />
                    • TP = <b>추매 시점</b> 밴드(롱 MA−B·σ / 숏 MA+B·σ)로 재앵커, SL = 새 평단 ±pct 대칭<br />
                    • 게임당 추매 1회(최대 2레그). 두 레그 함께 청산. 14일 한도는 그 게임 첫 진입 기준
                </div>
                <div style={{ marginTop: 6, opacity: 0.8 }}>
                    평단을 낮추면 더 작은 반등에도 TP에 닿아 승률이 오릅니다(역추세 롱 9/12·숏 4/4 자본대비 개선).
                    추세엔 해로워(피라미딩) 추세(S1)는 추매를 쓰지 않습니다.
                </div>
            </div>

            <div style={LWARN}>
                ⚠ 추매는 "공짜 수익"이 아니라 <b>조건부 레버리지</b>입니다. 백테스트(포트폴리오)상 추매를 얹으면
                CAGR +61.7%→+122.1%로 오르지만 투입자본 ≈1.8배·<b>동시노출 4.4→8.35배·실현 MDD −14.3%→−27.6%</b>.
                증거금·청산여력 점검이 필요하고 약세장 OOS는 미검증입니다.
            </div>

            <MiniLogicChart
                title="역추세 롱 + 추매 구조 (z ≤ −K1)"
                lines={[
                    { y: 45, label: "MA", color: "#ffd166" },
                    { y: 75, label: "TP = MA−B·σ", color: "#00ffcc", dash: "4 4" },
                    { y: 105, label: "leg1 진입", color: "#ff8080" },
                    { y: 130, label: "새 평단", color: "#7ee787", dash: "4 4" },
                    { y: 150, label: "leg2 추매", color: "#ff8080" },
                ]}
                points={[
                    { x: 60, y: 80 },
                    { x: 150, y: 106, label: "leg1", color: "#ff8080" },
                    { x: 250, y: 150, label: "leg2(추매)", color: "#ff8080" },
                    { x: 330, y: 130, label: "평단↓", color: "#7ee787" },
                    { x: 460, y: 75, label: "TP(함께청산)", color: "#00ffcc" },
                ]}
                note="한 게임 예시: 더 빠질 때 1회 추매로 평단을 leg1·leg2 중간으로 낮춤 → 밴드 복귀 시 두 레그 함께 익절. 더 빠지면 새 평단 기준 대칭 SL. (이런 게임이 여러 개 중첩될 수 있음)"
            />
        </div>
    );
}

function LogicLiveTab() {
    const cell = { padding: "6px 8px", borderBottom: "1px solid #222", fontSize: 11.5, whiteSpace: "nowrap" };
    const head = { ...cell, fontWeight: 900, color: "#00ffcc" };
    const S1 = [
        ["BTCUSDT", "Bybit", "3.2 / −2.0", "—"],
        ["ETHUSDT", "Bybit", "2.35 / 1.2", "3.45 / −1.8"],
        ["SOLUSDT", "Bybit", "3.4 / −2.0", "3.4 / −2.0"],
        ["XRPUSDT", "Bybit", "2.55 / −0.4", "—"],
        ["US100", "MT5", "2.8 / −1.8", "—"],
        ["JP225", "MT5", "3.35 / −2.0", "3.25 / 0.8"],
        ["HK50", "MT5", "2.05 / 0.6", "—"],
        ["GER40", "MT5", "2.75 / −1.8", "—"],
        ["UK100", "MT5", "3.25 / −1.2", "3.5 / 0.8"],
        ["XAUUSD", "MT5", "3.45 / −1.8", "3.2 / 0.2"],
        ["XAGUSD", "MT5", "2.75 / −1.2", "2.65 / 1.2"],
        ["WTI", "MT5", "2.9 / −1.4", "3.2 / 1.8"],
    ];
    const S2 = [
        ["BTCUSDT", "Bybit", "3.3 / −2.0", "4.6 / −0.4"],
        ["ETHUSDT", "Bybit", "3.15 / −1.2", "3.3 / −1.2"],
        ["SOLUSDT", "Bybit", "3.3 / 1.8", "—"],
        ["XRPUSDT", "Bybit", "3.5 / −0.4", "5.0 / −2.0"],
        ["US100", "MT5", "3.25 / −0.8", "—"],
        ["JP225", "MT5", "2.7 / −2.0", "3.8 / 1.0"],
        ["HK50", "MT5", "2.6 / −2.0", "3.0 / 1.6"],
        ["GER40", "MT5", "3.5 / −2.0", "—"],
        ["UK100", "MT5", "3.35 / −2.0", "3.8 / 1.8"],
        ["XAUUSD", "MT5", "2.35 / −1.8", "—"],
        ["XAGUSD", "MT5", "2.85 / −1.8", "3.8 / −2.0"],
        ["WTI", "MT5", "2.9 / −2.0", "3.4 / 0.6"],
    ];
    const Table = ({ title, rows, accent }) => (
        <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: accent, marginBottom: 4 }}>{title}</div>
            <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 360 }}>
                    <thead>
                        <tr>
                            <th style={head}>심볼</th>
                            <th style={head}>거래소</th>
                            <th style={head}>롱 (K1 / B)</th>
                            <th style={head}>숏 (K1 / B)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i}>
                                <td style={{ ...cell, fontWeight: 800 }}>{r[0]}</td>
                                <td style={{ ...cell, opacity: 0.7 }}>{r[1]}</td>
                                <td style={{ ...cell, color: r[2] === "—" ? "#555" : "#cfcfcf" }}>{r[2]}</td>
                                <td style={{ ...cell, color: r[3] === "—" ? "#555" : "#cfcfcf" }}>{r[3]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>심볼별 파라미터 · 현재 구성</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                값 = <b>K1 / B</b>. "—"는 해당 방향 미채택. 쿨다운·B는 심볼·방향마다 다릅니다.
                동시보유 캡은 200랏(비구속)으로 두고, 실제 한도는 <b>포트폴리오 캡(유효레버 10x ≈ 200랏)</b>이 잡습니다.
            </div>

            <Table title="S1 · 추세 (독립 스택)" rows={S1} accent="#ffb86c" />
            <Table title="S2 · 역추세 (추매 2다리)" rows={S2} accent="#7ee787" />

            <div style={LWARN}>
                ⚠ 파라미터는 3년 in-sample 백테스트(portfolio_sim picks) 기준이며 OOS(약세구간)·포트폴리오
                자본설계 검증은 진행 중입니다. 동시보유 누적 수익률은 과대평가될 수 있어 소액 라이브로 재검증하는 단계입니다.
            </div>
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
    const [timeframe, setTimeframe] = useState("1m"); // "1m" | "1D"

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

                                {/* 타임프레임 토글: 1분봉 / 일봉 */}
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {[
                                        { key: "1m", label: "1분봉" },
                                        { key: "1D", label: "일봉" },
                                    ].map((tf) => {
                                        const on = timeframe === tf.key;
                                        return (
                                            <button
                                                key={tf.key}
                                                onClick={() => setTimeframe(tf.key)}
                                                style={{
                                                    padding: "8px 12px",
                                                    borderRadius: 10,
                                                    border: on ? 0 : "1px solid #2a2a2a",
                                                    background: on ? "#00ffcc" : "#1a1a1a",
                                                    color: on ? "#000" : "#ddd",
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                }}
                                                title={tf.key === "1D" ? "일봉(가격 위주, 최근 365일)" : "1분봉(진입밴드 포함)"}
                                            >
                                                {tf.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {timeframe === "1D" && (
                                    <div style={{ marginTop: 6, fontSize: 11, opacity: 0.6, lineHeight: 1.5 }}>
                                        일봉은 가격 흐름용입니다. z-score 진입밴드는 1분봉 전용(7일 σ 기반)이라 일봉엔 표시되지 않습니다.
                                    </div>
                                )}

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
                                {timeframe === "1D" ? (
                                    <DailyChartPanel
                                        source={bybitSource}
                                        symbol={s.symbol}
                                        anchorEndUtcSec={anchorEndUtcSec}
                                        dayOffset={dayOffset}
                                        lookbackDays={365}
                                    />
                                ) : (
                                    <ChartPanelCore
                                        source={bybitSource}
                                        symbol={s.symbol}
                                        dayOffset={dayOffset}
                                        anchorEndUtcSec={anchorEndUtcSec}
                                        onBounds={onBounds}
                                        onStats={onStats}
                                        k1set={K1_BYBIT[s.symbol]}
                                        crossTimes={metaMap[s.symbol]?.cross_times}
                                        bounds={{ min: -7, max: 0 }}
                                    />
                                )}
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