// src/components/common/ChartPanelCore.jsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import ChartView from "./ChartView";
import SignalNotesPanel from "./SignalNotesPanel";
import {
    fmtKSTHour,
    sliceWithBuffer,
    calcSMA,
    calcLatestMAValue,
    mergeBars,
    buildCrossMarkers,
    fmtComma,
} from "../../lib/tradeUtils";

const ONE_DAY_SEC = 86400;
const MA_BUF = 99;
const MAX_1M_BARS = 43200;

// ✅ catch-up (stale cache tail backfill)
const CATCHUP_LOOKBACK_SEC = 2 * 3600; // 최근 2시간만 재조회해서 꼬리(backfill) 채움
const CATCHUP_STALE_SEC = 5 * 60; // 마지막 캔들이 5분 이상 뒤쳐지면 stale로 판단
const CATCHUP_THROTTLE_MS = 30_000; // 30초 이내 중복 fetch 방지

/** ------------------------- digits helpers (rows-first) ------------------------- **/
const digitsCache = new Map(); // key: `${sourceKey}|${symbol}` -> digits

function clampDigits(d) {
    if (!Number.isFinite(d)) return null;
    return Math.min(Math.max(Math.floor(d), 0), 8);
}

// raw string 기준으로 소수점 자리 수를 보존해서 추정 (중요!)
function countDecimalsFromRaw(v) {
    if (v == null) return 0;
    const s = String(v);
    const dot = s.indexOf(".");
    if (dot < 0) return 0;
    const frac = s.slice(dot + 1); // trailing 0 포함
    return frac.length;
}

function inferDigitsFromRows(rows, fallback = 2, {sample = 400, maxDigits = 8} = {}) {
    if (!Array.isArray(rows) || rows.length === 0) return fallback;

    let d = 0;
    const start = Math.max(0, rows.length - sample);
    for (let i = start; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        d = Math.max(
            d,
            countDecimalsFromRaw(r?.[1]),
            countDecimalsFromRaw(r?.[2]),
            countDecimalsFromRaw(r?.[3]),
            countDecimalsFromRaw(r?.[4])
        );
        if (d >= maxDigits) break;
    }

    d = clampDigits(d);
    return Number.isFinite(d) ? d : fallback;
}

// WS bar(Number)용 보조 추정 (rows가 최우선)
function countDecimalsSmart(x) {
    if (x == null) return 0;
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;

    const s = String(n);
    if (s.includes("e") || s.includes("E")) {
        const ss = n.toFixed(12).replace(/0+$/, "");
        const dot = ss.indexOf(".");
        return dot >= 0 ? ss.length - dot - 1 : 0;
    }

    const dot = s.indexOf(".");
    if (dot < 0) return 0;

    const frac = s.slice(dot + 1).replace(/0+$/, "");
    return frac.length;
}

function inferDigitsFromBar(bar) {
    if (!bar) return null;
    const d = Math.max(
        countDecimalsSmart(bar.open),
        countDecimalsSmart(bar.high),
        countDecimalsSmart(bar.low),
        countDecimalsSmart(bar.close)
    );
    return clampDigits(d);
}

/** ------------------------- day window ------------------------- **/
function getDayWindowByOffset(anchorEndUtcSec, offsetDays = 0) {
    const end = Number(anchorEndUtcSec) + Number(offsetDays) * ONE_DAY_SEC;
    return [end - ONE_DAY_SEC, end];
}

function rowsToBars(rows) {
    return (rows || [])
        .filter((r) => r && r[0] != null && r[1] != null && r[2] != null && r[3] != null && r[4] != null)
        .map((r) => ({
            time: Math.floor(Number(r[0]) / 1000),
            open: Number(r[1]),
            high: Number(r[2]),
            low: Number(r[3]),
            close: Number(r[4]),
        }))
        .sort((a, b) => a.time - b.time);
}

// ✅ getCachedRows가 rows/ bars 둘 다일 가능성 방어
function normalizeCachedToBars(cached) {
    if (!cached) return [];
    const first = cached?.[0];

    // rows: [ [ts, o, h, l, c, ...], ... ]
    if (Array.isArray(first)) return rowsToBars(cached);

    // bars: [ {time, open, high, low, close}, ... ]
    if (typeof first === "object" && first?.time != null) {
        return cached
            .map((b) => ({
                time: Number(b.time),
                open: b.open != null ? Number(b.open) : undefined,
                high: b.high != null ? Number(b.high) : undefined,
                low: b.low != null ? Number(b.low) : undefined,
                close: b.close != null ? Number(b.close) : undefined,
            }))
            .filter((b) => Number.isFinite(b.time))
            .sort((a, b) => a.time - b.time);
    }

    return [];
}

export default function ChartPanelCore({
                                           source,
                                           symbol,
                                           dayOffset,
                                           anchorEndUtcSec,

                                           // UI/Behavior
                                           bounds = {min: -7, max: 0},
                                           width,
                                           height = 320,

                                           thr,
                                           crossTimes,

                                           // formatters
                                           tickFormatter = (tsSec) => fmtKSTHour(tsSec),

                                           // ✅ override only (없으면 rows 기반 auto)
                                           priceScale, // number | undefined

                                           // callbacks
                                           onBounds,
                                           onStats,
                                       }) {
    const wsHub = source?.wsHub;

    const allBarsRef = useRef([]);
    const markersAllRef = useRef([]);
    const notesAllRef = useRef([]);

    const lastCatchupMsRef = useRef(0);
    const prefetchedRef = useRef(false);
    const prefetchAbortRef = useRef(null);
    const loadSeqRef = useRef(0);

    const [loading, setLoading] = useState(false);

    const [notesView, setNotesView] = useState([]);
    const [displayCandles, setDisplayCandles] = useState([]);
    const [ma100, setMa100] = useState([]);
    const [markers, setMarkers] = useState([]);
    const [visibleRange, setVisibleRange] = useState(null);

    // WS에서 stale 방지
    const visibleRangeRef = useRef(null);
    useEffect(() => {
        visibleRangeRef.current = visibleRange;
    }, [visibleRange]);

    // bounds 전달
    useEffect(() => {
        const b = {min: Number(bounds?.min ?? -7), max: Number(bounds?.max ?? 0)};
        onBounds?.(symbol, b);
    }, [onBounds, symbol, bounds?.min, bounds?.max]);

    // symbol/source 바뀌면 prefetch 상태/진행중 작업 리셋
    useEffect(() => {
        prefetchedRef.current = false;
        try {
            prefetchAbortRef.current?.abort?.();
        } catch {
        }
    }, [symbol, source]);

    /** ✅ key for digits cache */
    const sourceKey = source?.key || source?.name || source?.id || "src";
    const digitsKey = useMemo(() => `${sourceKey}|${String(symbol || "").toUpperCase()}`, [sourceKey, symbol]);

    /** ✅ digits state (rows-first) */
    const [autoDigits, setAutoDigits] = useState(() => {
        const ov = clampDigits(priceScale);
        if (Number.isFinite(ov)) return ov;
        const cached = digitsCache.get(digitsKey);
        return Number.isFinite(cached) ? cached : 2;
    });

    // override가 있으면 즉시 적용
    useEffect(() => {
        const ov = clampDigits(priceScale);
        if (Number.isFinite(ov)) {
            digitsCache.set(digitsKey, ov);
            setAutoDigits(ov);
        }
    }, [priceScale, digitsKey]);

    /** ✅ unified price text formatter for notes */
    const getPriceText = useCallback(
        (n) => (n?.price != null ? fmtComma(Number(n.price), autoDigits) : "—"),
        [autoDigits]
    );

    const ensureSignals = useCallback(
        async (symUpper) => {
            const s = await source.ensureSignals(symUpper).catch(() => ({markers: [], notes: []}));
            markersAllRef.current = s?.markers || [];
            notesAllRef.current = s?.notes || [];
        },
        [source]
    );

    const renderWindow = useCallback(
        (start, end, resetRange = false) => {
            if (resetRange) setVisibleRange({start, end});
            else setVisibleRange((prev) => prev || {start, end});

            const arrAll = allBarsRef.current || [];
            const real = arrAll.filter((b) => b.time >= start && b.time < end).sort((a, b) => a.time - b.time);

            // ✅ full fill (시각용)
            const filled = [];
            let ri = 0;
            for (let t = start; t < end; t += 60) {
                const r = real[ri];
                if (r && Math.floor(r.time / 60) * 60 === t) {
                    filled.push(r);
                    ri++;
                } else {
                    filled.push({time: t});
                }
            }
            setDisplayCandles(filled);

            // ✅ MA series
            const forMa = sliceWithBuffer(arrAll, start, end, MA_BUF);
            const ma = calcSMA(forMa, 100).filter((p) => p.time >= start && p.time < end);
            setMa100(ma);

            // ✅ markers
            const base = (markersAllRef.current || []).filter((x) => x.time >= start && x.time < end);
            const cross = buildCrossMarkers(Array.isArray(crossTimes) ? crossTimes : [], start, end);
            const mergedMarkers = [...base, ...cross].sort((a, b) => {
                if (a.time !== b.time) return a.time - b.time;
                return String(a.text || "").localeCompare(String(b.text || ""));
            });
            setMarkers(mergedMarkers);

            // ✅ notes
            const n = (notesAllRef.current || []).filter((x) => {
                const t = Number(x?.timeSec);
                return Number.isFinite(t) && t >= start && t < end;
            });
            setNotesView(n);

            // ✅ stats
            const lastClose = real.length ? real[real.length - 1].close : null;
            const ma100Latest = calcLatestMAValue(real, 100);

            const prev3 = real.length >= 3 ? real[real.length - 3].close : null;
            const chg3mPct = prev3 && lastClose != null ? ((lastClose - prev3) / prev3) * 100 : null;

            onStats?.(symbol, {ma100: ma100Latest, chg3mPct, priceScale: autoDigits});
        },
        [crossTimes, onStats, symbol, autoDigits]
    );

    // ✅ prefetch
    const prefetchPastDays = useCallback(
        async (symUpper) => {
            if (prefetchedRef.current) return;
            prefetchedRef.current = true;
            try {
                prefetchAbortRef.current?.abort?.();
            } catch {
            }
            const ac = new AbortController();
            prefetchAbortRef.current = ac;

            const minOffset = Number(bounds?.min ?? -7);

            for (let offset = -1; offset >= minOffset; offset--) {
                if (ac.signal.aborted) return;

                const dayKey = String(offset);
                if (source.getCachedRows(symUpper, dayKey)) continue;

                const [start, end] = getDayWindowByOffset(anchorEndUtcSec, offset);

                try {
                    const rows = await source.fetchWindow(symUpper, "1", start, end, ac.signal, MA_BUF);
                    if (ac.signal.aborted) return;

                    // ✅ digits cache warm
                    const ov = clampDigits(priceScale);
                    if (!Number.isFinite(ov)) {
                        const prev = digitsCache.get(digitsKey) ?? 2;
                        const d = inferDigitsFromRows(rows, prev);
                        digitsCache.set(digitsKey, Math.max(prev, d));
                    }

                    source.touchCandleCache(symUpper, dayKey, rows);
                } catch (e) {
                    if (e?.name === "AbortError") return;
                    console.warn("[ChartPanelCore prefetch] failed:", symUpper, offset, e);
                }
            }
        },
        [anchorEndUtcSec, bounds?.min, source, digitsKey, priceScale]
    );

    // ✅ MAIN LOAD
    useEffect(() => {
        if (!Number.isFinite(Number(anchorEndUtcSec))) return;
        if (!source) return;

        const symUpper = symbol.toUpperCase();
        const [start, end] = getDayWindowByOffset(anchorEndUtcSec, dayOffset);
        const dayKey = String(dayOffset);

        const mySeq = ++loadSeqRef.current;

        setLoading(true);
        setVisibleRange({start, end});
        setNotesView([]);
        setDisplayCandles([]);
        setMa100([]);
        setMarkers([]);

        const cached = source.getCachedRows(symUpper, dayKey);
        const ac = new AbortController();

        (async () => {
            try {
                await ensureSignals(symUpper);
                if (loadSeqRef.current !== mySeq) return;

                const ov = clampDigits(priceScale);

                if (cached) {
                    // ✅ digits 확정 (rows-first)
                    if (!Number.isFinite(ov)) {
                        const prev = digitsCache.get(digitsKey) ?? 2;
                        const d = Array.isArray(cached?.[0]) ? inferDigitsFromRows(cached, prev) : prev; // cached가 bars면 rows 추정 불가
                        const nextD = Math.max(prev, d);
                        digitsCache.set(digitsKey, nextD);
                        setAutoDigits((p) => Math.max(Number.isFinite(p) ? p : 0, nextD));
                        onStats?.(symbol, {priceScale: nextD});
                    } else {
                        digitsCache.set(digitsKey, ov);
                        setAutoDigits(ov);
                        onStats?.(symbol, {priceScale: ov});
                    }

                    allBarsRef.current = normalizeCachedToBars(cached);
                    renderWindow(start, end, true);

                    // ✅ today(0) 캐시가 stale이면 tail catch-up
                    if (dayOffset === 0) {
                        const nowSec = Math.floor(Date.now() / 1000);

                        const bars0 = allBarsRef.current || [];
                        const lastTime = bars0.length ? Number(bars0[bars0.length - 1].time) : null;

                        // ✅ "지금 시각에 해당하는 마지막 1분봉" 기준으로 stale 판단(휴장/비거래 구간 과도 호출 방지)
                        const expectedLatest = Math.min(end - 60, nowSec - (nowSec % 60));

                        const stale =
                            Number.isFinite(lastTime) &&
                            expectedLatest >= start &&
                            expectedLatest < end &&
                            expectedLatest - lastTime > CATCHUP_STALE_SEC;

                        const canRun = Date.now() - (lastCatchupMsRef.current || 0) > CATCHUP_THROTTLE_MS;

                        if (stale && canRun) {
                            lastCatchupMsRef.current = Date.now();

                            const from = Math.max(start - MA_BUF * 60, lastTime - CATCHUP_LOOKBACK_SEC);
                            const to = end;

                            (async () => {
                                try {
                                    const tailRows = await source.fetchWindow(symUpper, "1", from, to, ac.signal, MA_BUF);
                                    if (loadSeqRef.current !== mySeq) return;

                                    let merged = allBarsRef.current || [];
                                    const tailBars = rowsToBars(tailRows);

                                    for (const b of tailBars) merged = mergeBars(merged, b);
                                    if (merged.length > MAX_1M_BARS) merged = merged.slice(-MAX_1M_BARS);

                                    allBarsRef.current = merged;

                                    // ✅ 캐시도 최신 tailRows로 갱신 (다음 로딩에 다시 비는 것 방지)
                                    try {
                                        source.touchCandleCache?.(symUpper, dayKey, tailRows);
                                    } catch {
                                    }

                                    renderWindow(start, end, true);

                                    if (merged.length) {
                                        onStats?.(symbol, {price: merged[merged.length - 1].close});
                                    }
                                } catch (e) {
                                    if (e?.name === "AbortError") return;
                                    console.warn("[ChartPanelCore catchup] failed:", symUpper, e);
                                }
                            })();
                        }
                    }

                    if (dayOffset === 0) prefetchPastDays(symUpper);
                    return;
                }

                const rows = await source.fetchWindow(symUpper, "1", start, end, ac.signal, MA_BUF);
                if (loadSeqRef.current !== mySeq) return;

                // ✅ rows 기반 digits 확정
                if (!Number.isFinite(ov)) {
                    const prev = digitsCache.get(digitsKey) ?? 2;
                    const d = inferDigitsFromRows(rows, prev);
                    const nextD = Math.max(prev, d);
                    digitsCache.set(digitsKey, nextD);
                    setAutoDigits((p) => Math.max(Number.isFinite(p) ? p : 0, nextD));
                    onStats?.(symbol, {priceScale: nextD});
                } else {
                    digitsCache.set(digitsKey, ov);
                    setAutoDigits(ov);
                    onStats?.(symbol, {priceScale: ov});
                }

                source.touchCandleCache(symUpper, dayKey, rows);

                let bars = rowsToBars(rows);
                if (bars.length > MAX_1M_BARS) bars = bars.slice(-MAX_1M_BARS);
                allBarsRef.current = bars;

                renderWindow(start, end, true);

                if (dayOffset === 0) prefetchPastDays(symUpper);
            } catch (e) {
                if (e?.name === "AbortError") return;
                console.error("[ChartPanelCore] load failed:", e);
            } finally {
                if (loadSeqRef.current === mySeq) setLoading(false);
            }
        })();

        return () => {
            try {
                ac.abort();
            } catch {
            }
        };
    }, [
        symbol,
        dayOffset,
        anchorEndUtcSec,
        ensureSignals,
        renderWindow,
        prefetchPastDays,
        source,
        digitsKey,
        priceScale,
        onStats,
    ]);

    // ✅ WS
    useEffect(() => {
        if (!wsHub || !source) return;

        const topics = source.topics(symbol);
        const cleanups = [];

        try {
            wsHub.subscribe?.(topics);
        } catch {
        }
        cleanups.push(() => {
            try {
                wsHub.unsubscribe?.(topics);
            } catch {
            }
        });

        const offs = topics.map((tp) =>
            wsHub.addListener?.(tp, (d) => {
                const ev = source.normalizeWs(tp, d);
                if (!ev) return;

                if (ev.type === "price") {
                    onStats?.(symbol, {price: ev.price, priceScale: autoDigits});
                    return;
                }

                if (ev.type === "kline") {
                    const vr = visibleRangeRef.current;
                    if (!vr?.start || !vr?.end) return;

                    const bar = ev.bar;
                    if (bar.time < vr.start - MA_BUF * 60 || bar.time >= vr.end) return;

                    // ✅ WS bar로 digits 상향 보정(필요 시)
                    const ov = clampDigits(priceScale);
                    if (!Number.isFinite(ov)) {
                        const d2 = inferDigitsFromBar(bar);
                        if (Number.isFinite(d2) && d2 > autoDigits) {
                            digitsCache.set(digitsKey, d2);
                            setAutoDigits(d2);
                            onStats?.(symbol, {priceScale: d2});
                        }
                    }

                    let arr = mergeBars(allBarsRef.current || [], bar);
                    if (arr.length > MAX_1M_BARS) arr = arr.slice(-MAX_1M_BARS);
                    allBarsRef.current = arr;

                    renderWindow(vr.start, vr.end, true);

                    onStats?.(symbol, {price: bar.close, priceScale: autoDigits});
                }
            })
        );

        cleanups.push(() => {
            offs.forEach((off) => {
                try {
                    off?.();
                } catch {
                }
            });
        });

        return () => {
            cleanups.forEach((fn) => {
                try {
                    fn();
                } catch {
                }
            });
        };
    }, [wsHub, source, symbol, renderWindow, onStats, autoDigits, digitsKey, priceScale]);

    // unmount 시 prefetch 취소
    useEffect(() => {
        return () => {
            try {
                prefetchAbortRef.current?.abort?.();
            } catch {
            }
        };
    }, []);

    return (
        <div style={{marginBottom: 28}}>
            <div style={{fontSize: 20, opacity: 0.8, marginBottom: 6}}>
                {symbol}
                <span style={{marginLeft: 10, fontSize: 12, opacity: 0.65}}>(dayOffset: {dayOffset})</span>
                <span style={{marginLeft: 10, fontSize: 12, opacity: 0.5}}>(digits: {autoDigits})</span>
            </div>

            <div style={{width: width ?? "100%", maxWidth: "100%", position: "relative"}}>
                {loading ? (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 5,
                            fontWeight: 800,
                            borderRadius: 12,
                            backdropFilter: "blur(2px)",
                        }}
                    >
                        로딩중...
                    </div>
                ) : null}

                <ChartView
                    width={typeof width === "number" ? width : undefined}
                    height={height}
                    tickFormatter={tickFormatter}
                    displayCandles={displayCandles}
                    ma100={ma100}
                    thr={thr}
                    markers={markers}
                    priceScale={autoDigits}
                    visibleRange={visibleRange}
                />

                <SignalNotesPanel
                    symbol={symbol}
                    notes={notesView}
                    getPriceText={getPriceText}
                    collapseKey={`${symbol}:${dayOffset}`}
                />
            </div>
        </div>
    );
}