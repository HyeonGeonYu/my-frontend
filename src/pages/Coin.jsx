// src/pages/coin.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import AssetPanel from "../components/AssetPanel";
import UnifiedTickerCard from "../components/common/UnifiedTickerCard";
import ChartPanelCore from "../components/common/ChartPanelCore";
import DailyChartPanel from "../components/common/DailyChartPanel";
import BandLegend from "../components/common/BandLegend";
import SymbolStrategyTag from "../components/common/SymbolStrategyTag";
import { minuteBandSpec, STRAT_PARAMS, fmtParam, fmtFade } from "../lib/strategyParams";
import useIsMobile from "../hooks/useIsMobile";
import { makeBybitSource } from "../lib/chartSources";
import { QRCodeCanvas } from "qrcode.react";
import { next0650EndBoundaryUtcSec, positionSizeBySymbol, positionEntriesBySymbol } from "../lib/tradeUtils";
import { getDayLabel } from "../utils/date";
import { createChart, ColorType } from "lightweight-charts";

// 일봉(S3/S4) 신호 스트림 네임스페이스 — 모듈 상수(안정 참조, 재fetch 방지).
// v2(bb1525a)에서 크립토 일봉이 bybit 스트림으로 통합(태그 S3/S4로 구분). cryptod는 통합 전 히스토리용.
const COIN_DAILY_SIGNALS = ["bybit", "cryptod"];

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
        { key: "book", label: "S11 1분봉책" },
        { key: "live", label: "심볼별 전략표" },
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
                        S11 「1분봉책」(z추세·z역추세·급락페이드 3패밀리) + 일봉 S3(추세)·S4(역추세). 구 S1/S2는 드레인(청산만) 중.
                    </div>
                </div>

                <div style={{ fontSize: 11, opacity: 0.6, alignSelf: "flex-end" }}>
                    z-score · 1분 창 6~24h / 일봉 창 60~200d · 롱 SL無 · 14일 청산(S13은 24~72h)
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
                {activeTab === "book" && <Logic1mBookTab />}
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
            <div style={{ fontWeight: 900, marginBottom: 6 }}>전략 체계 — S11 1분봉책(3패밀리) + 일봉(S3/S4)</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                가격이 이동평균에서 표준편차(σ) 기준 얼마나 떨어졌는지(z-score)로 진입을 판단합니다.
                <b>1분봉 = S11 「1분봉책」 하나</b>(내부 3패밀리: z추세·z역추세·급락페이드), <b>일봉 = S3(추세)·S4(역추세)</b>.
                구 S1/S2(7일 창)는 2026-07-12 폐기 — 신규 진입 없이 보유분 청산만 진행(드레인). 아래 표의 방향 정의는 z계열(S11/S12/S3/S4) 공통입니다.
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 440 }}>
                    <thead>
                        <tr>
                            <th style={head}></th>
                            <th style={head}>S11/S3 · 추세 (trend)</th>
                            <th style={head}>S12/S4 · 역추세 (reversion)</th>
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
                • z추세(S11 패밀리/S3): 이미 한쪽으로 크게 움직인(과열/급락) 자산은 그 방향으로 더 간다고 보고 따라붙음.<br />
                • z역추세(S11 패밀리/S4): 과하게 벌어진 자산은 평균으로 되돌아온다고 보고 반대로 잡음(추매 없음 — 구 S2와 다름).<br />
                • 급락페이드(S11 패밀리): 밴드가 아니라 <b>M분 수익률 ≤ −X%</b> 급락 자체를 트리거로 롱 — 시간청산(24~72h) 중심.<br />
                • 같은 z 신호라도 자산군에 따라 추세/역추세 적합이 갈리고, 1분 롱은 SL 없이(no-SL) 운용합니다.
            </div>

            <div style={{
                marginTop: 12, padding: 10, borderRadius: 12,
                background: "rgba(93,202,165,0.07)", border: "1px solid rgba(93,202,165,0.35)",
                fontSize: 12, lineHeight: 1.7,
            }}>
                <b style={{ color: "#5dcaa5" }}>S3 · S4 — 일봉(D1) 채널</b><br />
                같은 추세/역추세를 <b>일봉</b>에 적용한 버전(MA·σ 창 = 심볼×방향별 60~200일). 크립토·지수·금속·유가·FX 메이저에 적용,
                1분봉책과는 <b>별개 신호채널·별개 포지션</b>입니다. 쿨다운 일(日) 단위, 최대보유 15일, 추매 없음.
                심볼별 파라미터는 <b>심볼별 전략표</b> 탭에서 한눈에 볼 수 있습니다.
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
                <div>1분봉책 = 심볼×방향별 win 360~1440분(6~24h) · 일봉 = 60~200일</div>
                <div>MA = 해당 창 종가 이동평균</div>
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
                <div>• <b>z계열(S11/S12/S3/S4)</b>: 신호 재발생 시 독립 게임으로 중첩(ontop), 각 게임이 자기 TP로 따로 청산 · <b>1분 롱은 SL 없음</b>(no-SL, XAUT추세롱·XRP숏만 SL 유지)</div>
                <div>• <b>급락페이드(S11 패밀리)</b>: M분 수익률 ≤ −X% → 롱 · BTC는 되돌림×1.5 익절+48h 캡, 나머지는 시간청산(24~72h) · SL 없음</div>
                <div style={{ marginTop: 4 }}>• 진입 쿨다운: 심볼별로 직전 진입 후 일정 시간 신규/추매 금지</div>
                <div>• 사이징: 진입당 자본 5%, 최대 유효레버리지 10x(≈200랏)까지 — 거래소 최소주문 미달 시 5→10→15→20% 자동 상향</div>
                <div>• 최대보유: 1분 z계열 14일 / 급락페이드 24~72h / 일봉 15일 — 초과 시 강제청산</div>
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

function Logic1mBookTab() {
    return (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>S11 「1분봉책」 — 3패밀리: z추세 · z역추세 · 급락페이드</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                2026-07-12 도입(구 S1/S2 대체). MA·σ 창을 7일 → <b>심볼별 6~24시간</b>으로 줄여 반응속도를 높이고,
                크립토 롱에서 유해했던 손절(SL)을 제거했습니다(no-SL). 무게이트 베이스 자립 + 상장 전기간 연도균형으로 재검증.
            </div>

            <div style={LBOX}>
                <b>패밀리 ① z추세</b> (실선 밴드)
                <div>진입: z ≥ +K1 → 롱 (XRP만 z ≤ −K1 → 숏)</div>
                <div>TP = MA + B·σ 재앵커 · 롱 SL 없음(XAUT추세롱·XRP숏만 SL 유지) · 최대보유 14일</div>
                <div style={{ marginTop: 4, opacity: 0.75 }}>Bybit: BTC(MA24h)·ETH(12h)·SOL(24h)·XAUT(24h) 롱, XRP 숏 · MT5: JP225/US100/GER40/UK100/HK50/XAGUSD/WTI/USDJPY 롱</div>
            </div>

            <div style={LBOX}>
                <b>패밀리 ② z역추세</b> (점선 밴드)
                <div>진입: z ≤ −K1 → 롱 · TP = MA − B·σ · SL 없음 · 최대보유 14일</div>
                <div style={{ marginTop: 4, opacity: 0.75 }}>BTC(MA22h)·XAUT(24h) 롱 온리. <b>추매 없음</b> — 구 S2와 다름.</div>
            </div>

            <div style={LADD}>
                <b style={{ color: "#c084fc" }}>패밀리 ③ 급락페이드</b> (밴드 없음 — 수익률 트리거)
                <div style={{ marginTop: 4 }}>진입: 최근 <b>M분 수익률 ≤ −X%</b> 급락 → 롱 (쿨다운 30분)</div>
                <div>청산: BTC = 되돌림×1.5 익절 + 48h 캡 · 나머지 = 시간청산(24~72h) · SL 없음</div>
                <div style={{ marginTop: 4, opacity: 0.75 }}>
                    Bybit: BTC 60분−4% · ETH 30분−4% · SOL 15분−5%(⚠꼬리 −55%, 저사이징) · XRP 30분−5% ·
                    MT5: JP225 4h−3% · HK50 2h−2% · USDJPY 2h−1%
                </div>
            </div>

            <div style={LWARN}>
                ⚠ 네임스페이스 s11(Bybit)/s11m(MT5)로 구 채널과 장부 분리. 구 S1/S2 보유분은 드레인(청산만) 후 폐기.
                MT5 확장판은 데이터 3.5년(2022 미검증)이라 보수 사이징 등급입니다.
            </div>
        </div>
    );
}

// 심볼별 전략표 — STRAT_PARAMS(단일 소스)에서 자동 생성. 봇 파라미터 갱신 시 함께 바뀜.
const LIVE_GROUPS = [
    { group: "크립토 (Bybit · 1분봉책 ns=s11)", syms: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "XAUTUSDT"] },
    { group: "MT5 지수·금속·유가·크립토CFD (1분봉책 ns=s11m)", syms: ["US100", "JP225", "HK50", "GER40", "UK100", "XAUUSD", "XAGUSD", "WTI", "BTCUSD", "ETHUSD"] },
    { group: "FX 메이저", syms: ["EURUSD", "GBPUSD", "AUDUSD", "USDJPY", "USDCHF", "USDCAD", "NZDUSD"] },
];

function LogicLiveTab() {
    const cell = { padding: "5px 7px", borderBottom: "1px solid #222", fontSize: 11, verticalAlign: "top" };
    const head = { ...cell, fontWeight: 900, color: "#00ffcc", whiteSpace: "nowrap" };

    const ZCell = ({ s }) => {
        if (!s || (!s.L && !s.S)) return <td style={{ ...cell, color: "#444", textAlign: "center" }}>—</td>;
        return (
            <td style={cell}>
                <div style={{ color: s.L ? "#cfcfcf" : "#555" }}>L {s.L ? fmtParam(s.L) : "—"}</div>
                <div style={{ color: s.S ? "#cfcfcf" : "#555", opacity: 0.9 }}>S {s.S ? fmtParam(s.S) : "—"}</div>
            </td>
        );
    };
    const FadeCell = ({ s }) => {
        if (!s || !s.L) return <td style={{ ...cell, color: "#444", textAlign: "center" }}>—</td>;
        return <td style={cell}><div style={{ color: "#cfcfcf" }}>{fmtFade(s.L)}</div></td>;
    };

    return (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>심볼별 파라미터 — S11(3패밀리)·S3·S4 한눈에</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                z계열 칸 = <b>K1 / B / 쿨다운 · MA창</b> (롱 L / 숏 S, "—"=미채택). S13 = 급락 트리거·보유.
                <b> S11(z추세/z역추세/급락페이드) = 1분봉</b>, <b>S3·S4 = 일봉</b>. 빈 칸은 "—".
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
                    <thead>
                        <tr>
                            <th style={head}>심볼</th>
                            <th style={{ ...head, color: "#ffb86c" }}>S11 z추세·1m</th>
                            <th style={{ ...head, color: "#7ee787" }}>S11 z역추세·1m</th>
                            <th style={{ ...head, color: "#c084fc" }}>S11 급락페이드·1m</th>
                            <th style={{ ...head, color: "#ffd166" }}>S3 추세·일</th>
                            <th style={{ ...head, color: "#5dcaa5" }}>S4 역추세·일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {LIVE_GROUPS.map((g) => (
                            <React.Fragment key={g.group}>
                                <tr>
                                    <td colSpan={6} style={{ ...cell, fontWeight: 900, color: "#00ffcc", background: "#0f0f0f", fontSize: 11.5 }}>
                                        {g.group}
                                    </td>
                                </tr>
                                {g.syms.filter((sym) => STRAT_PARAMS[sym]).map((sym) => {
                                    const p = STRAT_PARAMS[sym];
                                    return (
                                        <tr key={sym}>
                                            <td style={{ ...cell, fontWeight: 800, whiteSpace: "nowrap" }}>{sym}</td>
                                            <ZCell s={p.s11} />
                                            <ZCell s={p.s12} />
                                            <FadeCell s={p.s13} />
                                            <ZCell s={p.s3} />
                                            <ZCell s={p.s4} />
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 8, fontSize: 11.5, opacity: 0.75, lineHeight: 1.6 }}>
                • S11 z계열(z추세/z역추세): 게임 중첩, 쿨다운 시간 단위, 최대보유 14일, 롱 SL無. 급락페이드는 셀별 보유(24~72h).<br />
                • 일봉(S3/S4): MA창 심볼×방향별 60~200일, 쿨다운 일(日) 단위, 최대보유 15일, 추매 없음.
            </div>

            <div style={LWARN}>
                ⚠ 파라미터는 백테스트 in-sample 기준(1분봉책은 무게이트·연도균형 재검증 포함)이며,
                MT5 확장판은 데이터 3.5년이라 보수 사이징 전제입니다.
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
    const isMobile = useIsMobile();
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

    // 심볼별 보유 포지션 진입가 (차트 진입가 선 + 테두리용)
    const entriesBySymbol = useMemo(() => positionEntriesBySymbol(asset), [asset]);

    // ✅ 차트 순서 = 포지션 크기(진입금액) 큰 순
    const sortedVisibleSymbols = useMemo(() => {
        const size = positionSizeBySymbol(asset);
        return [...visibleSymbols].sort((a, b) => {
            const sa = size[String(a.symbol).toUpperCase()] || 0;
            const sb = size[String(b.symbol).toUpperCase()] || 0;
            return sb - sa || String(a.symbol).localeCompare(String(b.symbol));
        });
    }, [visibleSymbols, asset]);

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

    return (<div style={{ padding: isMobile ? 8 : 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
        <div
            style={{
                maxWidth: PAGE_MAX_W,
                margin: "0 auto",
                overflowX: isMobile ? "visible" : "auto",
                background: "#111",
            }}
        >
            <div style={{ minWidth: isMobile ? 0 : MIN_MAIN }}>

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
                        gridTemplateColumns: isMobile ? "1fr" : "minmax(360px, 0.85fr) minmax(520px, 1.15fr)",
                        gap: isMobile ? 12 : 24,
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
                {/* ✅ 밴드 범례 (1분봉=S1/S2, 일봉=S3/S4) */}
                <div style={{ maxWidth: PAGE_MAX_W, margin: "0 auto 4px", minWidth: 0 }}>
                    <BandLegend mode={timeframe} />
                </div>

                {/* ✅ 하단: 보기설정/티커(기존 폭 유지) + 차트(그대로) */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 1fr) minmax(260px, 4fr)",
                    gap: isMobile ? 12 : 24,
                    alignItems: "start",
                    minWidth: 0, // ✅ 이거 추가

                }}>
                    {/* 왼쪽 */}
                    <div style={{ minWidth: 0 }}>
                        <div
                            style={{
                                position: isMobile ? "static" : "sticky",
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
                                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                                        {timeframe === "1m" ? getDayLabel(anchorEndUtcSec, dayOffset) : "일봉 · 최근 365일"}
                                    </div>
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

                                {/* 날짜 이동은 1분봉에서만 (일봉은 최근 구간만 보면 됨) */}
                                {timeframe === "1m" && (
                                    <>
                                        <div style={{ height: 10 }} />
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
                                    </>
                                )}
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
                        {sortedVisibleSymbols.map((s) => {
                            const ent = entriesBySymbol[String(s.symbol).toUpperCase()];
                            const hasPos = Array.isArray(ent) && ent.length > 0;
                            return (
                            <div key={s.symbol} style={{
                                width: "100%", minWidth: 0,
                                border: hasPos ? "2px solid #2fe08d" : "2px solid transparent",
                                borderRadius: 12, padding: hasPos ? 4 : 0,
                                boxShadow: hasPos ? "0 0 0 1px rgba(47,224,141,0.25)" : "none",
                            }}>
                                {hasPos && (
                                    <div style={{ fontSize: 11, fontWeight: 800, color: "#2fe08d", marginBottom: 2 }}>
                                        ● 진입중 {ent.map((e) => `${e.side === "SHORT" ? "S" : "L"} @${e.avg.toFixed(e.avg < 10 ? 5 : 1)}`).join(" · ")}
                                    </div>
                                )}
                                <SymbolStrategyTag symbol={s.symbol} timeframe={timeframe} />
                                {timeframe === "1D" ? (
                                    <DailyChartPanel
                                        source={bybitSource}
                                        symbol={s.symbol}
                                        anchorEndUtcSec={anchorEndUtcSec}
                                        dayOffset={0}
                                        lookbackDays={365}
                                        entryLines={ent}
                                        signalNames={COIN_DAILY_SIGNALS}
                                    />
                                ) : (
                                    <ChartPanelCore
                                        source={bybitSource}
                                        symbol={s.symbol}
                                        dayOffset={dayOffset}
                                        anchorEndUtcSec={anchorEndUtcSec}
                                        onBounds={onBounds}
                                        onStats={onStats}
                                        bandSpec={minuteBandSpec(s.symbol)}
                                        entryLines={ent}
                                        crossTimes={metaMap[s.symbol]?.cross_times}
                                        bounds={{ min: -7, max: 0 }}
                                    />
                                )}
                            </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
        <TradingLogicFloatingButton />
    </div>
    );
}