// src/pages/coin.jsx
import React, {useEffect, useState, useMemo, useCallback} from "react";
import AssetPanel from "../components/AssetPanel";

import TickerCard from "../components/coin/TickerCard";
import ChartPanel from "../components/coin/ChartPanel";

import {next0650EndBoundaryUtcSec, fetchPriceScaleBybitCached} from "../lib/tradeUtils";

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

/* ------------------------- threshold meta ------------------------- */
async function fetchThresholdMeta(symbol, ns) {
    const qs = new URLSearchParams({symbol: String(symbol || "")});
    if (ns) qs.set("name", String(ns)); // 기존 API가 name 파라미터 받는다면 유지

    const url = `/api/thresholds?${qs.toString()}`;
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) return null;
    return (await res.json()) || null;
}

/* ------------------------- symbols 추출 유틸 ------------------------- */
function extractSymbolsFromConfig(cfgRaw) {
    const root = cfgRaw?.config ?? cfgRaw;
    if (!root) return [];

    const normalize = (raw) => {
        if (typeof raw === "string") {
            raw = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
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
                const s =
                    it.symbol ??
                    it.sym ??
                    it.name ??
                    it.ticker ??
                    it.pair ??
                    it.market ??
                    it.code ??
                    null;
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
        const raw =
            obj.symbols ??
            obj.trade_symbols ??
            obj.target_symbols ??
            obj.targets ??
            obj.pairs ??
            obj.markets ??
            obj.instruments ??
            obj.watchlist ??
            null;
        return normalize(raw);
    };

    let symbols = pickFrom(root);
    if (symbols.length) return symbols;

    const candidates = [
        root.bybit,
        root.mt5,
        root.bot,
        root.bots,
        root.strategy,
        root.strategies,
        root.config,
        root.settings,
        root.params,
    ];
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
    const [interval, setInterval_] = useState("1");
    const [dayOffset, setDayOffset] = useState(0);

    /* ------------------------- config ------------------------- */
    const [configState, setConfigState] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await fetch("/api/config", {cache: "no-store"});
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

    // ✅ namespace (플랫폼/봇 네임스페이스)
    const ns = useMemo(() => {
        return String(configState?.name || configState?.exchange || "bybit").toLowerCase();
    }, [configState]);

    /* ------------------------- asset ------------------------- */
    const [asset, setAsset] = useState({wallet: {USDT: 0}, positions: {}});

    useEffect(() => {
        let alive = true;

        // config가 아직이면 기본 bybit로 1번 때리는 게 싫으면 여기서 return 시켜도 됨
        // if (!configLoaded) return;

        (async () => {
            try {
                const res = await fetch(`/api/asset?ns=${encodeURIComponent(ns)}`, {cache: "no-store"});
                const j = res.ok ? await res.json() : null;
                if (!alive || !j) return;
                setAsset(j.asset);
            } catch {
            }
        })();

        return () => {
            alive = false;
        };
    }, [ns]);

    /* ------------------------- symbols ------------------------- */
    const symbolsConfig = useMemo(() => {
        const symbols = extractSymbolsFromConfig(configState);
        return symbols.map((sym) => ({symbol: sym, market: "linear"}));
    }, [configState]);

    const symbolsReady = symbolsConfig.length > 0;

    /* ------------------------- stats / meta ------------------------- */
    const [statsMap, setStatsMap] = useState({});
    const onStats = useCallback((symbol, stats) => {
        setStatsMap((prev) => ({
            ...prev,
            [symbol]: {...prev[symbol], ...stats},
        }));
    }, []);

    const [metaMap, setMetaMap] = useState({});
    useEffect(() => {
        let alive = true;
        if (!symbolsReady) return;

        (async () => {
            try {
                const results = await Promise.all(
                    symbolsConfig.map((s) => fetchThresholdMeta(s.symbol, ns).catch(() => null))
                );
                if (!alive) return;

                const merged = {};
                results.forEach((m, i) => {
                    if (m) merged[symbolsConfig[i].symbol] = m;
                });
                setMetaMap((prev) => ({...prev, ...merged}));
            } catch {
            }
        })();

        return () => {
            alive = false;
        };
    }, [symbolsConfig, symbolsReady, ns]);

    /* ------------------------- priceScale (decimals) ------------------------- */
    const [priceScaleMap, setPriceScaleMap] = useState({});

    useEffect(() => {
        let alive = true;
        if (!symbolsReady) return;

        (async () => {
            try {
                const results = await Promise.all(
                    symbolsConfig.map((s) => fetchPriceScaleBybitCached(s.symbol, s.market || "linear"))
                );
                if (!alive) return;

                const merged = {};
                results.forEach((ps, i) => {
                    merged[symbolsConfig[i].symbol] = (typeof ps === "number" ? ps : null);
                });

                setPriceScaleMap((prev) => ({...prev, ...merged}));
            } catch {
            }
        })();

        return () => {
            alive = false;
        };
    }, [symbolsConfig, symbolsReady]);

    /* ------------------------- bounds (dayOffset clamp) ------------------------- */
    const requiredSymbols = useMemo(() => symbolsConfig.map((s) => s.symbol), [symbolsConfig]);

    const [perSymbolBounds, setPerSymbolBounds] = useState({});
    const onBounds = useCallback((symbol, bounds) => {
        setPerSymbolBounds((prev) => ({...prev, [symbol]: bounds}));
    }, []);

    const {minOffset, maxOffset, boundsReady} = useMemo(() => {
        if (!symbolsReady) return {minOffset: 0, maxOffset: 0, boundsReady: false};

        const haveAll = requiredSymbols.every((sym) => perSymbolBounds[sym]);
        if (!haveAll) return {minOffset: 0, maxOffset: 0, boundsReady: false};

        const values = requiredSymbols.map((sym) => perSymbolBounds[sym]);
        const minCommon = Math.max(...values.map((b) => b.min ?? 0));
        const maxCommon = Math.min(...values.map((b) => b.max ?? 0));
        return {minOffset: minCommon, maxOffset: maxCommon, boundsReady: true};
    }, [perSymbolBounds, requiredSymbols, symbolsReady]);

    useEffect(() => {
        if (interval !== "1" || !boundsReady) return;
        setDayOffset((d) => Math.min(Math.max(d, minOffset), maxOffset));
    }, [interval, boundsReady, minOffset, maxOffset]);

    const atMin = interval === "1" && boundsReady && dayOffset <= minOffset;
    const atMax = interval === "1" && boundsReady && dayOffset >= maxOffset;

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
        return (
            <div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
                <div style={{opacity: 0.85}}>config 로딩중...</div>
            </div>
        );
    }

    if (!symbolsReady) {
        return (
            <div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
                <div
                    style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "#1a1a1a",
                        border: "1px solid #2a2a2a",
                        lineHeight: 1.6,
                    }}
                >
                    심볼 목록을 불러오지 못했어요.
                    <br/>
                    <span style={{opacity: 0.75}}>
            잠시 후 다시 시도해 주세요. 문제가 계속되면 운영자에게 문의해 주세요.
          </span>
                </div>
            </div>
        );
    }

    return (
        <div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
            <AssetPanel asset={asset} statsBySymbol={statsMap} config={configState}/>

            <div style={{display: "grid", gridTemplateColumns: "320px 1fr", gap: 24}}>
                {/* 왼쪽 */}
                <div>
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
                            <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline"}}>
                                <div style={{fontWeight: 700, marginBottom: 10}}>보기 설정</div>
                                {interval === "1" &&
                                    <div style={{fontSize: 12, opacity: 0.85}}>{selectedDayLabel(dayOffset)}</div>}
                            </div>

                            <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                                <button
                                    onClick={() => {
                                        setInterval_("1");
                                        setDayOffset(0);
                                    }}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 10,
                                        border: 0,
                                        background: interval === "1" ? "#00ffcc" : "#2a2a2a",
                                        color: interval === "1" ? "#000" : "#fff",
                                        fontWeight: 700,
                                    }}
                                >
                                    1분봉
                                </button>
                                <button
                                    onClick={() => setInterval_("D")}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 10,
                                        border: 0,
                                        background: interval === "D" ? "#00ffcc" : "#2a2a2a",
                                        color: interval === "D" ? "#000" : "#fff",
                                        fontWeight: 700,
                                    }}
                                >
                                    1일봉
                                </button>
                            </div>

                            {interval === "1" && (
                                <>
                                    <div style={{height: 10}}/>
                                    <div style={{display: "flex", gap: 8}}>
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

                    <div style={{display: "grid", gap: 12}}>
                        {symbolsConfig.map((s) => (
                            <TickerCard
                                key={s.symbol}
                                symbol={s.symbol}
                                interval={interval}
                                stats={statsMap[s.symbol]}
                                meta={{...(metaMap[s.symbol] || {}), price_scale: priceScaleMap[s.symbol]}}
                            />
                        ))}
                    </div>
                </div>

                {/* 오른쪽 */}
                <div>
                    {symbolsConfig.map((s) => (
                        <ChartPanel
                            key={s.symbol}
                            symbol={s.symbol}
                            globalInterval={interval}
                            dayOffset={dayOffset}
                            onBounds={onBounds}
                            onStats={onStats}
                            thr={metaMap[s.symbol]?.ma_threshold}
                            crossTimes={metaMap[s.symbol]?.cross_times}
                            signalName={ns} //
                            priceScale={priceScaleMap[s.symbol]}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
