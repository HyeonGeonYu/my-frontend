// src/pages/Cfd.jsx
import React, {useEffect, useState, useMemo, useCallback} from "react";
import CfdChartPanel from "../components/cfd/CfdChartPanel";
import TickerCard from "../components/cfd/TickerCard";

/* ------------------------- symbols 추출 유틸 (coin.jsx 동일) ------------------------- */
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

function sessionKeyLabel(sessionKey) {
    if (!sessionKey) return "—";
    const d = new Date(`${sessionKey}T00:00:00.000Z`);
    const month = d.getUTCMonth() + 1;
    const date = d.getUTCDate();
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return `${month}월 ${date}일(${dow})`;
}

export default function Cfd() {
    /* ------------------------- config ------------------------- */
    const [configState, setConfigState] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);

    const signalName = useMemo(() => {
        return configState?.name || configState?.exchange || "mt5_signal";
    }, [configState]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await fetch("/api/config?name=mt5_signal", {cache: "no-store"});
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

    /* ------------------------- threshold meta ------------------------- */
    const [metaMap, setMetaMap] = useState({});

    useEffect(() => {
        let alive = true;
        if (!symbolsReady) return;

        (async () => {
            try {
                const namespace = "mt5_signal";
                const results = await Promise.all(
                    symbols.map((s) => fetchThresholdMeta(s, namespace).catch(() => null))
                );
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
    }, [symbols, symbolsReady, signalName]);

    /* ------------------------- min + sorting + visibility ------------------------- */
    const minMaThreshold = useMemo(() => {
        const n = Number(configState?.min_ma_threshold);
        return Number.isFinite(n) ? n : null;
    }, [configState]);

    // metaMap 기반 ma_threshold로 정렬(내림차순). meta 없으면 뒤로.
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

    // ✅ 표시/숨김 분리
    // 정책:
    // - meta가 없으면(확인중) => 숨김 목록에 넣고 "확인중"으로 표시
    // - meta가 있고 min 미만 => 숨김 목록에 넣고 "min 미만"으로 표시
    // - meta가 있고 min 이상 => visible
    const {visibleSymbols, hiddenSymbols} = useMemo(() => {
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

        return {visibleSymbols: visible, hiddenSymbols: hidden};
    }, [symbolsSortedByMa, metaMap, minMaThreshold]);

    /* ------------------------- stats from panels ------------------------- */
    const [symbolStatsMap, setSymbolStatsMap] = useState({});
    const onStats = useCallback((symbol, stats) => {
        setSymbolStatsMap((prev) => ({...prev, [symbol]: {...prev[symbol], ...stats}}));
    }, []);

    /* ------------------------- session keys aggregation ------------------------- */
    const [sessionKeysBySymbol, setSessionKeysBySymbol] = useState({});
    const onSessionKeys = useCallback((symbol, keys) => {
        setSessionKeysBySymbol((prev) => ({...prev, [symbol]: keys || []}));
    }, []);

    const allSessionKeys = useMemo(() => {
        const set = new Set();
        Object.values(sessionKeysBySymbol).forEach((arr) => (arr || []).forEach((k) => set.add(k)));
        return Array.from(set).sort();
    }, [sessionKeysBySymbol]);

    const [sessionIndex, setSessionIndex] = useState(0);
    const allSessionKeysLen = allSessionKeys.length;

    useEffect(() => {
        if (!allSessionKeysLen) return;
        setSessionIndex(allSessionKeysLen - 1);
    }, [allSessionKeysLen]);
    const selectedDate = allSessionKeys[sessionIndex] || null;

    const atMin = sessionIndex <= 0;
    const atMax = sessionIndex >= allSessionKeys.length - 1;

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
                    config에서 symbols를 못 가져왔어.
                    <br/>
                    <span style={{opacity: 0.75}}>
            개발자 콘솔(F12)에서 <b>/api/config?name=mt5_signal</b> 응답을 확인해봐.
          </span>
                </div>
            </div>
        );
    }

    return (
        <div style={{padding: 24, color: "#fff", background: "#111", minHeight: "100vh"}}>
            <div style={{fontWeight: 800, fontSize: 18, marginBottom: 10, opacity: 0.95}}>
                CFD 세션 차트 <span style={{opacity: 0.6, fontWeight: 700}}>({symbols.join(" / ")})</span>
            </div>

            {/* ✅ 숨김 안내 */}
            <div style={{marginBottom: 14}}>
                <div
                    style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "#151515",
                        border: "1px solid #262626",
                        fontSize: 13,
                        lineHeight: 1.5,
                    }}
                >
                    <div style={{display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap"}}>
                        <div style={{fontWeight: 700}}>
                            표시 기준:{" "}
                            <span style={{opacity: 0.85}}>
                ma_threshold ≥{" "}
                                {Number.isFinite(minMaThreshold) ? minMaThreshold : "—"}
              </span>
                        </div>
                        <div style={{opacity: 0.85}}>
                            표시: <b>{visibleSymbols.length}</b>개 / 숨김: <b>{hiddenSymbols.length}</b>개
                        </div>
                    </div>

                    {hiddenSymbols.length > 0 ? (
                        <div style={{marginTop: 8, opacity: 0.9}}>
                            <div style={{fontWeight: 700, marginBottom: 6}}>숨김 목록</div>
                            <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
                                {hiddenSymbols.map((x) => (
                                    <span
                                        key={x.symbol}
                                        style={{
                                            padding: "6px 10px",
                                            borderRadius: 999,
                                            background: "#1f1f1f",
                                            border: "1px solid #2d2d2d",
                                            fontSize: 12,
                                            opacity: 0.95,
                                        }}
                                        title={x.reason}
                                    >
                    <b style={{marginRight: 6}}>{x.symbol}</b>
                    <span style={{opacity: 0.7}}>{x.reason}</span>
                  </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

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
                                <div style={{fontSize: 12, opacity: 0.85}}>
                                    {selectedDate ? sessionKeyLabel(selectedDate) : "—"}
                                    {selectedDate ? <span style={{opacity: 0.65}}> ({selectedDate})</span> : null}
                                </div>
                            </div>

                            <div style={{display: "flex", gap: 8}}>
                                <button
                                    onClick={() => setSessionIndex((i) => Math.max(0, i - 1))}
                                    disabled={!allSessionKeys.length || atMin}
                                    style={disBtnStyle(!allSessionKeys.length || atMin)}
                                    title="이전 세션"
                                >
                                    ◀ 이전
                                </button>

                                <button
                                    onClick={() => setSessionIndex(allSessionKeys.length ? allSessionKeys.length - 1 : 0)}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 10,
                                        border: 0,
                                        background: "#00ffcc",
                                        color: "#000",
                                        fontWeight: 700,
                                    }}
                                    title="최신 세션"
                                >
                                    최신
                                </button>

                                <button
                                    onClick={() => setSessionIndex((i) => Math.min(allSessionKeys.length - 1, i + 1))}
                                    disabled={!allSessionKeys.length || atMax}
                                    style={disBtnStyle(!allSessionKeys.length || atMax)}
                                    title="다음 세션"
                                >
                                    다음 ▶
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ✅ 왼쪽 카드도 visible만 */}
                    <div style={{display: "grid", gap: 12}}>
                        {visibleSymbols.map((s) => (
                            <TickerCard key={s} symbol={s} stats={symbolStatsMap[s]} meta={metaMap[s]}/>
                        ))}
                    </div>

                    {/* visible이 0이면 안내 */}
                    {visibleSymbols.length === 0 ? (
                        <div
                            style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 12,
                                background: "#151515",
                                border: "1px solid #262626",
                                opacity: 0.9,
                                fontSize: 13,
                            }}
                        >
                            현재 표시 조건(ma_threshold ≥ {Number.isFinite(minMaThreshold) ? minMaThreshold.toFixed(4) : "—"})을
                            만족하는 심볼이 없어.
                        </div>
                    ) : null}
                </div>

                {/* 오른쪽 */}
                <div>
                    {visibleSymbols.map((s) => (
                        <CfdChartPanel
                            key={s}
                            symbol={s}
                            sessionKey={selectedDate}
                            thr={metaMap[s]?.ma_threshold}
                            crossTimes={metaMap[s]?.cross_times}
                            onStats={onStats}
                            onSessionKeys={onSessionKeys}
                        />
                    ))}

                    {/* 차트가 0이면 안내 */}
                    {visibleSymbols.length === 0 ? (
                        <div
                            style={{
                                padding: 16,
                                borderRadius: 14,
                                background: "#151515",
                                border: "1px solid #262626",
                                opacity: 0.9,
                                fontSize: 14,
                            }}
                        >
                            표시할 차트가 없어. (min_ma_threshold 기준 미달 또는 아직 확인중)
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
