// src/pages/coin.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import AssetPanel from "../components/AssetPanel";
import UnifiedTickerCard from "../components/common/UnifiedTickerCard";
import ChartPanelCore from "../components/common/ChartPanelCore";
import { makeBybitSource } from "../lib/chartSources";
import { QRCodeCanvas } from "qrcode.react";
import { next0650EndBoundaryUtcSec } from "../lib/tradeUtils";
import { createChart, ColorType } from "lightweight-charts";

/* ------------------------- 날짜 라벨 ------------------------- */
function selectedDayLabel(offsetDays = 0) {
    const end = next0650EndBoundaryUtcSec() + offsetDays * 86400;
    const start = end - 86400;
    const kstSec = start + 9 * 3600;
    const d = new Date(kstSec * 1000);
    const month = d.getUTCMonth() + 1;
    const date = d.getUTCDate();
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return `${month}월 ${date}일(${dow})`;
}

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
                현재(지갑):{" "}
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

    const chartRowsKey = useMemo(() => {
        return chartRows.map((r) => `${r.day}:${r.equity}`).join("|");
    }, [chartRows]);

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
    }, [chartRowsKey, loading]);
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

    const walletUsdt = useMemo(() => {
        const v = Number(asset?.wallet?.USDT ?? 0);
        return Number.isFinite(v) ? v : null;
    }, [asset]);

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
                    <EquityHistoryCard currentEquity={walletUsdt} />
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
                        equityUsdt={walletUsdt}
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
                                    <div style={{ fontSize: 12, opacity: 0.85 }}>{selectedDayLabel(dayOffset)}</div>
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
    </div>
    );
}