// src/pages/coin.jsx
import React, {useEffect, useState, useMemo, useCallback} from "react";
import AssetPanel from "../components/AssetPanel";
import promoImgUrl from "../assets/bybit_copytrading_zannavi.png";
import UnifiedTickerCard from "../components/common/UnifiedTickerCard";
import ChartPanelCore from "../components/common/ChartPanelCore";
import {makeBybitSource} from "../lib/chartSources";

import {next0650EndBoundaryUtcSec} from "../lib/tradeUtils";

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
function CopyTradingInfoBanner() {
    const inviteCode = "YLPQEAX";
    const startDate = "2026-02-01";

    const box = {
        padding: 14,
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(0,255,204,0.14), rgba(0,0,0,0))",
        border: "1px solid #2a2a2a",
        marginBottom: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    };

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
    };

    const codeStyle = {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontWeight: 800,
        letterSpacing: 0.5,
    };

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteCode);
            alert("초대코드가 복사되었습니다: " + inviteCode);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = inviteCode;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            alert("초대코드가 복사되었습니다: " + inviteCode);
        }
    };

    return (
        <div style={box}>
            <div style={{fontWeight: 900, fontSize: 14, marginBottom: 8}}>카피트레이딩 계정 안내</div>

            <div style={{display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
        <span style={pill}>
          시작일: <b>{startDate}</b>
        </span>

                <span style={pill}>
          Bybit code: <span style={codeStyle}>Code:{inviteCode}</span>
        </span>

                <button
                    onClick={onCopy}
                    title="초대코드 복사"
                    style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #2a2a2a",
                        background: "#00ffcc",
                        color: "#000",
                        fontWeight: 900,
                        cursor: "pointer",
                        fontSize: 12,
                    }}
                >
                    초대코드 복사
                </button>
            </div>

            <div style={{marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.5}}>
                * 본 화면의 자산/성과 표시는 카피트레이딩 계정 기준으로 집계됩니다.
            </div>

            <div style={{marginTop: 12}}>
                <img
                    src={promoImgUrl}
                    alt="Bybit copytrading promo"
                    style={{
                        display: "block",
                        borderRadius: 14,
                        border: "1px solid #2a2a2a",
                        maxWidth: "100%",
                        height: "auto",
                    }}
                />
            </div>

            <details style={{marginTop: 10}}>
                <summary style={{cursor: "pointer", fontSize: 12, opacity: 0.9}}>⚠️ 리스크 고지 (KR / EN / 中文)</summary>

                <div style={{marginTop: 10, fontSize: 12, lineHeight: 1.6, opacity: 0.85}}>
                    <div style={{fontWeight: 800, marginBottom: 4}}>KR</div>
                    <div>
                        본 페이지는 카피트레이딩 계정 정보를 공유하기 위한 것이며, 참여 여부는 이용자의 자율적
                        판단에 따릅니다. 카피트레이딩은 손실 또는 청산이 발생할 수 있고, 과거 성과는 미래 수익을
                        보장하지 않습니다. 모든 투자 결과에 대한 책임은 이용자 본인에게 있습니다.
                    </div>

                    <div style={{height: 10}}/>

                    <div style={{fontWeight: 800, marginBottom: 4}}>EN</div>
                    <div>
                        This page is intended to share information about a copy trading account. Participation is
                        entirely at
                        the user's own discretion. Copy trading involves the risk of loss or liquidation, and past
                        performance
                        does not guarantee future results. You are solely responsible for all investment decisions and
                        outcomes.
                    </div>

                    <div style={{height: 10}}/>

                    <div style={{fontWeight: 800, marginBottom: 4}}>中文</div>
                    <div>
                        本页面用于分享跟单交易账户相关信息，是否参与由用户自行决定。跟单交易存在亏损或强制平仓的风险，
                        过往业绩不代表未来表现。所有投资决策及其结果均由用户本人承担责任。
                    </div>
                </div>
            </details>
        </div>
    );
}

/* ------------------------- threshold meta ------------------------- */
async function fetchThresholdMeta(symbol, ns) {
    const qs = new URLSearchParams({symbol: String(symbol || "")});
    if (ns) qs.set("name", String(ns));
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
    const [dayOffset, setDayOffset] = useState(0);

    /* ------------------------- config ------------------------- */
    const [configState, setConfigState] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [anchorEndUtcSec] = useState(() => next0650EndBoundaryUtcSec());
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

    // threshold/meta 네임스페이스
    const ns = useMemo(() => {
        return String(configState?.name || configState?.exchange || "bybit").toLowerCase();
    }, [configState]);

    // asset 네임스페이스
    const assetNs = useMemo(() => "agent:CopyZannavi:u7c9f14d2a1:BYBIT", []);
    // ------------------------- chart source (bybit) -------------------------
    const bybitSource = useMemo(() => makeBybitSource({signalName: ns}), [ns]);

    /* ------------------------- asset ------------------------- */
    const [asset, setAsset] = useState({wallet: {USDT: 0}, positions: {}});

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`/api/asset?ns=${encodeURIComponent(assetNs)}`, {cache: "no-store"});
                const j = res.ok ? await res.json() : null;
                if (!alive || !j) return;
                setAsset(j.asset);
            } catch {
            }
        })();
        return () => {
            alive = false;
        };
    }, [assetNs]);

    /* ------------------------- symbols ------------------------- */
    const symbolsConfig = useMemo(() => {
        const symbols = extractSymbolsFromConfig(configState);
        return symbols.map((sym) => ({symbol: sym, market: "linear"}));
    }, [configState]);

    const symbolsReady = symbolsConfig.length > 0;
    const requiredSymbols = useMemo(() => symbolsConfig.map((s) => s.symbol), [symbolsConfig]);

    /* ------------------------- stats ------------------------- */
    const [statsMap, setStatsMap] = useState({});
    const onStats = useCallback((symbol, stats) => {
        setStatsMap((prev) => ({
            ...prev,
            [symbol]: {...prev[symbol], ...stats},
        }));
    }, []);

    /* ------------------------- threshold/meta ------------------------- */
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

    /* ------------------------- bounds (dayOffset clamp) ------------------------- */
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
                    <span style={{opacity: 0.75}}>잠시 후 다시 시도해 주세요. 문제가 계속되면 운영자에게 문의해 주세요.</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
            <CopyTradingInfoBanner/>
            <AssetPanel asset={asset} statsBySymbol={statsMap} config={configState}/>

            <div style={{display: "grid", gridTemplateColumns: "320px 1fr", gap: 24}}>
                {/* 왼쪽 */}
                <div>
                    <div style={{
                        position: "sticky",
                        top: 12,
                        zIndex: 5,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1
                    }}>
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
                            <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline"}}>
                                <div style={{fontWeight: 700, marginBottom: 10}}>보기 설정</div>
                                <div style={{fontSize: 12, opacity: 0.85}}>{selectedDayLabel(dayOffset)}</div>
                            </div>

                            {/* 1분봉 버튼 (지금은 고정이지만 UI 유지) */}
                            <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
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

                            <div style={{height: 10}}/>

                            {/* 이전/오늘/다음 */}
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
                        </div>
                    </div>

                    {/* 티커 카드 */}
                    <div style={{display: "grid", gap: 12}}>
                        {symbolsConfig.map((s) => {
                            const sym = s.symbol;
                            const st = statsMap[sym];
                            const meta = (metaMap[sym] || {});
                            const ps = typeof st?.priceScale === "number" ? st.priceScale : 2;

                            const price = st?.price;
                            const ma100 = st?.ma100;
                            const chg3mPct = st?.chg3mPct;


                            return (
                                <UnifiedTickerCard
                                    key={sym}
                                    symbol={sym}
                                    price={price ?? null}
                                    ma100={ma100 ?? null}
                                    chg3mPct={chg3mPct ?? null}
                                    ps={ps}
                                    meta={meta}
                                    closesUnit="minutes"
                                />
                            );
                        })}
                    </div>
                </div>

                {/* 오른쪽 */}
                <div>
                    {symbolsConfig.map((s) => (
                        <ChartPanelCore
                            key={s.symbol}
                            source={bybitSource}
                            symbol={s.symbol}
                            dayOffset={dayOffset}
                            anchorEndUtcSec={anchorEndUtcSec}
                            onBounds={onBounds}
                            onStats={onStats}
                            thr={metaMap[s.symbol]?.ma_threshold}
                            crossTimes={metaMap[s.symbol]?.cross_times}
                            bounds={{min: -7, max: 0}}
                            width={1100}
                            // getPriceText 통일까지 원하면 여기서 넘기지 말고 Core 기본값 사용하면 됨.
                            // 코인만 priceScale 반영하고 싶다면 아래처럼 넘길 수 있음:
                            // getPriceText={(n) => (n?.price != null ? fmtComma(Number(n.price), priceScaleMap[s.symbol] ?? 2) : "—")}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}