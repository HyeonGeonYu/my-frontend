// src/pages/Cfd.jsx
import React, {useEffect, useState, useMemo, useCallback, useRef} from "react";
import ChartPanelCore from "../components/common/ChartPanelCore";
import DailyChartPanel from "../components/common/DailyChartPanel";
import AssetPanel from "../components/AssetPanel";
import BandLegend from "../components/common/BandLegend";
import SymbolStrategyTag from "../components/common/SymbolStrategyTag";
import { k1setFor } from "../lib/strategyParams";
import {makeCfdSource} from "../lib/chartSources";
import UnifiedTickerCard from "../components/common/UnifiedTickerCard";
import {next0650EndBoundaryUtcSec, sortSymbolsByPosition, positionEntriesBySymbol} from "../lib/tradeUtils";
import { getDayLabel } from "../utils/date";

// MT5(CFD·FX) 계정 — 데모/모의계좌. 자산은 USD 표시. (Bybit은 agent:CopyZannavi:...:BYBIT)
const MT5_ASSET_NS = "agent:CopyZannaviMT5:u8f3a9c1e7b:MT5";

// 일봉(S3/S4) 신호 스트림 네임스페이스 — 모듈 상수(안정 참조). FX 일봉=fxd, MT5 비환율 일봉=mt5d.
const CFD_DAILY_SIGNALS = ["fxd", "mt5d"];

// ✅ z-score 진입 밴드용 K1 — STRAT_PARAMS 단일 소스에서 파생(k1setFor). 별도 하드코딩 맵 금지.
//   HFM 브로커 심볼 별칭은 canonical(US100 등)로 정규화 후 조회.
const MT5_ALIAS = {
    USTEC: "US100", NAS100: "US100", US100CASH: "US100",
    JPN225: "JP225", JP225CASH: "JP225",
    DE40: "GER40", GER30: "GER40", DE30: "GER40",
    FTSE100: "UK100", UK100CASH: "UK100",
    HSI: "HK50", HK50CASH: "HK50",
    USOIL: "WTI", XTIUSD: "WTI", CL: "WTI", WTIUSD: "WTI",
};
function canonMt5(sym) {
    const u = String(sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return MT5_ALIAS[u] || u;
}
function resolveK1Mt5(sym) {
    return k1setFor(canonMt5(sym), "1m");
}


/* ------------------------- symbols 추출 유틸 ------------------------- */
function extractSymbolsFromConfig(cfg) {
    const arr = cfg?.symbols;
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => String(s).trim()).filter(Boolean).map((s) => s.toUpperCase());
}

/* ------------------------- threshold meta ------------------------- */
async function fetchThresholdMeta(symbol, name) {
    const qs = new URLSearchParams({symbol: String(symbol || "")});
    if (name) qs.set("name", String(name));
    const url = `/api/thresholds?${qs.toString()}`;

    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) return null;
    return (await res.json()) || null;
}

export default function Cfd() {
    /* ------------------------- config ------------------------- */
    const [configState, setConfigState] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    // MT5 자산 (데모/USD) — symbols보다 먼저 선언(차트 목록·정렬에서 참조)
    const [asset, setAsset] = useState({wallet: {USD: 0}, positions: {}});

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await fetch("/api/config?name=mt5", {cache: "no-store"});
                const j = r.ok ? await r.json() : null;
                if (!alive) return;
                setConfigState(j?.config ?? j);
            } finally {
                if (alive) setConfigLoaded(true);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // ✅ 차트 심볼 = mt5 config(지수/금속) ∪ 자산 포지션 심볼(FX 등) — FX 포지션도 차트·현재가 받게
    const symbols = useMemo(() => {
        const cfg = extractSymbolsFromConfig(configState);
        const pos = Object.keys(asset?.positions || {}).map((s) => String(s).toUpperCase());
        return [...new Set([...cfg, ...pos])];
    }, [configState, asset]);
    const symbolsReady = symbols.length > 0;

    const [selectedSymbol, setSelectedSymbol] = useState(null);
    const [timeframe, setTimeframe] = useState("1m"); // "1m" | "1D"

    /* ------------------------- threshold meta ------------------------- */
    const [metaMap, setMetaMap] = useState({});

    useEffect(() => {
        let alive = true;
        if (!symbolsReady) return;

        (async () => {
            try {
                const namespace = "mt5";
                const results = await Promise.all(symbols.map((s) => fetchThresholdMeta(s, namespace).catch(() => null)));
                if (!alive) return;

                const merged = {};
                results.forEach((m, i) => {
                    if (m) merged[symbols[i]] = m;
                });
                setMetaMap((prev) => ({...prev, ...merged}));
            } catch {
            }
        })();

        return () => {
            alive = false;
        };
    }, [symbols, symbolsReady]);

    /* ------------------------- min + sorting + visibility ------------------------- */
    const minMaThreshold = useMemo(() => {
        const n = Number(configState?.min_ma_threshold);
        return Number.isFinite(n) ? n : null;
    }, [configState]);

    // ✅ 차트/티커 순서 = 포지션 크기(진입금액) 큰 순 (포지션 없으면 뒤로, 알파벳)
    const symbolsSortedByMa = useMemo(
        () => sortSymbolsByPosition(symbols, asset),
        [symbols, asset]
    );

   const {filteredSymbols} = useMemo(() => {
        const visible = [];
        const hidden = [];

        for (const s of symbolsSortedByMa) {
            const tRaw = metaMap[s]?.ma_threshold;

            // ✅ sigma(S1/S2) 전환 후 mt5는 basic ma_threshold가 없음(null) → 숨기지 말고 표시.
            //   (옛 basic 전략 때만 쓰던 min 게이트. ma_threshold가 실제 양수일 때만 적용)
            if (tRaw == null) {
                visible.push(s);
                continue;
            }

            const t = Number(tRaw);

            if (!Number.isFinite(t)) {
                visible.push(s);
                continue;
            }

            if (Number.isFinite(minMaThreshold) && t < minMaThreshold) {
                hidden.push({
                    symbol: s,
                    reason: `min 미만 (${t.toFixed(4)} < ${minMaThreshold.toFixed(4)})`,
                });
                continue;
            }

            visible.push(s);
        }

        return {filteredSymbols: visible, hiddenSymbols: hidden};
    }, [symbolsSortedByMa, metaMap, minMaThreshold]);

    const visibleSymbols = useMemo(() => {
    if (!selectedSymbol) return filteredSymbols;
    return filteredSymbols.filter((s) => s === selectedSymbol);
}, [filteredSymbols, selectedSymbol]);

    /* ------------------------- stats from panels ------------------------- */
    const [symbolStatsMap, setSymbolStatsMap] = useState({});
    const onStats = useCallback((symbol, stats) => {
        setSymbolStatsMap((prev) => ({...prev, [symbol]: {...prev[symbol], ...stats}}));
    }, []);

    /* ------------------------- MT5 자산 (데모/USD) — fetch ------------------------- */
    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const res = await fetch(`/api/asset?ns=${encodeURIComponent(MT5_ASSET_NS)}&wallet=USD`, {cache: "no-store"});
                const j = await res.json();
                if (alive && j?.asset) setAsset(j.asset);
            } catch (e) {
                // 무시 (다음 주기에 재시도)
            }
        };
        load();
        const t = setInterval(load, 15000);
        return () => { alive = false; clearInterval(t); };
    }, []);

    // ✅ 자산 포지션 심볼(FX 등)의 현재가 — CFD 차트(지수/금속)엔 없으니 직접 받아와 미실현 PnL 채움.
    const posKey = useMemo(
        () => Object.keys(asset?.positions || {}).map((s) => String(s).toUpperCase()).sort().join(","),
        [asset]
    );
    const [fxPriceMap, setFxPriceMap] = useState({});
    useEffect(() => {
        const syms = posKey ? posKey.split(",") : [];
        if (!syms.length) return;
        let alive = true;
        const load = async () => {
            const out = {};
            await Promise.all(syms.map(async (s) => {
                try {
                    const path = encodeURIComponent("/v5/market/candles/with-gaps");
                    const r = await fetch(`/api/cfd?_path=${path}&symbol=${encodeURIComponent(s)}&interval=1&limit=30`, {cache: "no-store"});
                    const j = await r.json();
                    const list = j?.result?.list || [];
                    let px = null;
                    for (const row of list) { const c = Number(row?.[4]); if (Number.isFinite(c)) { px = c; break; } }
                    if (px != null) out[s] = {price: px};
                } catch {}
            }));
            if (alive && Object.keys(out).length) setFxPriceMap((prev) => ({...prev, ...out}));
        };
        load();
        const t = setInterval(load, 15000);
        return () => { alive = false; clearInterval(t); };
    }, [posKey]);

    // 자산 패널용 통합 stats: 차트에서 온 가격 + FX 직접 받은 가격
    const assetStats = useMemo(() => ({...fxPriceMap, ...symbolStatsMap}), [fxPriceMap, symbolStatsMap]);

    // 심볼별 보유 포지션 진입가 (차트 진입가 선 + 테두리용)
    const entriesBySymbol = useMemo(() => positionEntriesBySymbol(asset), [asset]);

    /* ------------------------- dayOffset + anchorEnd ------------------------- */
    // ✅ anchorEndUtcSec는 "이 페이지를 보는 시점" 기준으로 고정
    const [anchorEndUtcSec] = useState(() => next0650EndBoundaryUtcSec());
    const [dayOffset, setDayOffset] = useState(0);

    // ------------------------- chart source (cfd/mt5) -------------------------
    const cfdSourceRef = useRef({key: null, source: null});
    const cfdKey = "cfd:mt5";

    if (cfdSourceRef.current.key !== cfdKey) {
        cfdSourceRef.current = {
            key: cfdKey, source: makeCfdSource({signalName: "mt5"}),
        };
    }
    const cfdSource = cfdSourceRef.current.source;

    const minOffset = -7;
    const maxOffset = 0;

    useEffect(() => {
        setDayOffset((d) => Math.min(Math.max(d, minOffset), maxOffset));
    }, [minOffset, maxOffset]);

    const atMin = dayOffset <= minOffset;
    const atMax = dayOffset >= maxOffset;

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
        return (<div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
            <div style={{opacity: 0.85}}>config 로딩중...</div>
        </div>);
    }

    if (!symbolsReady) {
        return (<div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
            <div
                style={{
                    padding: 14, borderRadius: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", lineHeight: 1.6,
                }}
            >
                loading...
            </div>
        </div>);
    }
    const PAGE_MAX_W = 1460;
    const MIN_LEFT = 260;   // 왼쪽(티커/보기설정) 최소폭
    const MIN_RIGHT = 260;  // 오른쪽(차트 영역) 최소폭
    const GAP = 24;
    const MIN_MAIN = MIN_LEFT + MIN_RIGHT + GAP; // ✅ main 최소폭
    return (
        <div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
            {/* ✅ Coin처럼: maxWidth + overflowX + 내부 minWidth */}
            <div
                style={{
                    maxWidth: PAGE_MAX_W,
                    margin: "0 auto",
                    overflowX: "auto",
                    background: "#111",
                }}
            >
                <div style={{minWidth: MIN_MAIN}}>
                    <div style={{fontWeight: 800, fontSize: 18, marginBottom: 10, opacity: 0.95}}>
                        CFD 차트 <span style={{opacity: 0.6, fontWeight: 700}}>({symbols.join(" / ")})</span>
                    </div>

                    {/* ✅ 상단: 데모 라벨 + 자산/포지션 카드 (코인처럼 상단 배치) */}
                    <div style={{marginBottom: 18, maxWidth: 560}}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            marginBottom: 8, padding: "3px 9px", borderRadius: 999,
                            background: "rgba(255,184,108,0.14)", border: "1px solid rgba(255,184,108,0.4)",
                            color: "#ffb86c", fontWeight: 800, fontSize: 11,
                        }}>
                            ⚠ 데모(모의) 계좌 · MT5
                        </div>
                        <AssetPanel asset={asset} statsBySymbol={assetStats} config={configState} walletCcy="USD" />
                    </div>

                    <BandLegend mode={timeframe} />

                    {/* ✅ Coin처럼 minmax 기반 2컬럼 */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: `minmax(${MIN_LEFT}px, 1fr) minmax(${MIN_RIGHT}px, 4fr)`,
                            gap: GAP,
                            alignItems: "start",
                            minWidth: 0,
                        }}
                    >
                        {/* 왼쪽 */}
                        <div style={{minWidth: 0}}>
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
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline"
                                    }}>
                                        <div style={{fontWeight: 700, marginBottom: 10}}>보기 설정</div>
                                        <div style={{fontSize: 12, opacity: 0.85}}>
                                            {timeframe === "1m" ? (
                                                <>
                                                    {getDayLabel(anchorEndUtcSec, dayOffset)}
                                                    <span style={{opacity: 0.65}}> (dayOffset: {dayOffset})</span>
                                                </>
                                            ) : "일봉 · 최근 365일"}
                                        </div>
                                    </div>

                                    {/* 타임프레임 토글: 1분봉 / 일봉 */}
                                    <div style={{display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10}}>
                                        {[
                                            {key: "1m", label: "1분봉"},
                                            {key: "1D", label: "일봉"},
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
                                        <div style={{marginBottom: 10, fontSize: 11, opacity: 0.6, lineHeight: 1.5}}>
                                            일봉은 가격 흐름용입니다. z-score 진입밴드는 1분봉 전용(7일 σ 기반)이라 일봉엔 표시되지 않습니다.
                                        </div>
                                    )}

                                    {/* 날짜 이동은 1분봉에서만 (일봉은 최근 구간만) */}
                                    {timeframe === "1m" && (
                                        <div style={{display: "flex", gap: 8}}>
                                            <button
                                                onClick={() => setDayOffset((d) => Math.max(minOffset, d - 1))}
                                                disabled={atMin}
                                                style={disBtnStyle(atMin)}
                                                title="전날"
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
                                                title="오늘"
                                            >
                                                오늘
                                            </button>

                                            <button
                                                onClick={() => setDayOffset((d) => Math.min(maxOffset, d + 1))}
                                                disabled={atMax}
                                                style={disBtnStyle(atMax)}
                                                title="다음날"
                                            >
                                                다음날 ▶
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 티커 카드 */}
                            <div style={{display: "grid", gap: 12}}>
    {filteredSymbols.map((sym) => {
        const st = symbolStatsMap[sym];
        const meta = metaMap[sym];
        const ps = typeof st?.priceScale === "number" ? st.priceScale : 2;
        const active = selectedSymbol === sym;

        return (
            <div
                key={sym}
                onClick={() => setSelectedSymbol((prev) => prev === sym ? null : sym)}
                style={{
                    width: "100%",
                    cursor: "pointer",
                    opacity: selectedSymbol && !active ? 0.45 : 1,
                    border: active ? "1px solid #00ffcc" : "1px solid transparent",
                    borderRadius: 12,
                }}
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
                        <div style={{minWidth: 0, display: "grid", gap: 12}}>
                            {visibleSymbols.map((s) => {
                                const ent = entriesBySymbol[String(s).toUpperCase()];
                                const hasPos = Array.isArray(ent) && ent.length > 0;
                                return (
                                <div key={s} style={{
                                    width: "100%", minWidth: 0,
                                    // ✅ 진입중(보유 포지션) 표시 테두리
                                    border: hasPos ? "2px solid #2fe08d" : "2px solid transparent",
                                    borderRadius: 12, padding: hasPos ? 4 : 0,
                                    boxShadow: hasPos ? "0 0 0 1px rgba(47,224,141,0.25)" : "none",
                                }}>
                                    {hasPos && (
                                        <div style={{fontSize: 11, fontWeight: 800, color: "#2fe08d", marginBottom: 2}}>
                                            ● 진입중 {ent.map((e) => `${e.side === "SHORT" ? "S" : "L"} @${e.avg.toFixed(e.avg < 10 ? 5 : 2)}`).join(" · ")}
                                        </div>
                                    )}
                                    <SymbolStrategyTag symbol={s} />
                                    {timeframe === "1D" ? (
                                        <DailyChartPanel
                                            source={cfdSource}
                                            symbol={s}
                                            anchorEndUtcSec={anchorEndUtcSec}
                                            dayOffset={0}
                                            lookbackDays={365}
                                            entryLines={ent}
                                            signalNames={CFD_DAILY_SIGNALS}
                                        />
                                    ) : (
                                        <ChartPanelCore
                                            source={cfdSource}
                                            symbol={s}
                                            dayOffset={dayOffset}
                                            anchorEndUtcSec={anchorEndUtcSec}
                                            k1set={resolveK1Mt5(s)}
                                            bandsEnabled={!!resolveK1Mt5(s)}
                                            entryLines={ent}
                                            crossTimes={metaMap[s]?.cross_times}
                                            onStats={onStats}
                                            bounds={{min: -7, max: 0}}
                                        />
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}