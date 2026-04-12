// src/pages/Cfd.jsx
import React, {useEffect, useState, useMemo, useCallback, useRef} from "react";
import ChartPanelCore from "../components/common/ChartPanelCore";
import {makeCfdSource} from "../lib/chartSources";
import UnifiedTickerCard from "../components/common/UnifiedTickerCard";
import {next0650EndBoundaryUtcSec} from "../lib/tradeUtils";
import StreamsCenter from "../components/common/StreamsCenter";


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

/* ------------------------- day label (KST 06:50 경계 기반) ------------------------- */
function selectedDayLabelFromAnchor(anchorEndUtcSec, offsetDays = 0) {
    const end = Number(anchorEndUtcSec) + Number(offsetDays) * 86400;
    const start = end - 86400;

    // start를 KST로 바꿔서 날짜 라벨
    const kstSec = start + 9 * 3600;
    const d = new Date(kstSec * 1000);
    const month = d.getUTCMonth() + 1;
    const date = d.getUTCDate();
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return `${month}월 ${date}일(${dow})`;
}

export default function Cfd() {
    /* ------------------------- config ------------------------- */
    const [configState, setConfigState] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);

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

    const symbols = useMemo(() => extractSymbolsFromConfig(configState), [configState]);
    const symbolsReady = symbols.length > 0;

    const [selectedSymbol, setSelectedSymbol] = useState(null);

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

    const symbolsSortedByMa = useMemo(() => {
        const arr = [...symbols];
        arr.sort((a, b) => {
            const ta = Number(metaMap[a]?.ma_threshold);
            const tb = Number(metaMap[b]?.ma_threshold);

            const aOk = Number.isFinite(ta);
            const bOk = Number.isFinite(tb);
            if (!aOk && !bOk) return a.localeCompare(b);
            if (!aOk) return 1;
            if (!bOk) return -1;

            return tb - ta;
        });
        return arr;
    }, [symbols, metaMap]);

   const {filteredSymbols} = useMemo(() => {
        const visible = [];
        const hidden = [];

        for (const s of symbolsSortedByMa) {
            const tRaw = metaMap[s]?.ma_threshold;
            const t = Number(tRaw);

            if (!Number.isFinite(t)) {
                hidden.push({symbol: s, reason: "확인중"});
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

                    {/* ✅ StreamsCenter도 main 최소폭 기준으로 */}
                    <div style={{marginBottom: 14, minWidth: MIN_MAIN, marginLeft: "auto", marginRight: "auto"}}>
                        <StreamsCenter
                            source={cfdSource}
                            anchorEndUtcSec={anchorEndUtcSec}
                            dayOffset={dayOffset}
                            onDayOffsetChange={setDayOffset}
                            bounds={{min: -7, max: 0}}
                            priceScale={2}
                        />
                    </div>

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
                                            {selectedDayLabelFromAnchor(anchorEndUtcSec, dayOffset)}
                                            <span style={{opacity: 0.65}}> (dayOffset: {dayOffset})</span>
                                        </div>
                                    </div>

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
                            {visibleSymbols.map((s) => (
                                <div key={s} style={{width: "100%", minWidth: 0}}>
                                    <ChartPanelCore
                                        source={cfdSource}
                                        symbol={s}
                                        dayOffset={dayOffset}
                                        anchorEndUtcSec={anchorEndUtcSec}
                                        thr={metaMap[s]?.ma_threshold}
                                        crossTimes={metaMap[s]?.cross_times}
                                        onStats={onStats}
                                        bounds={{min: -7, max: 0}}
                                        // ✅ width props는 빼는게 Coin과 동일한 정책(부모 폭에 맞게 자연 확장)
                                        // width={CHART_W}
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