// src/components/coin/ChartPanel.jsx
import React, {useEffect, useState, useCallback,  useRef} from "react";
import SignalNotesPanel from "../common/SignalNotesPanel";
import ChartView from "../common/ChartView";
import {
    fmtKSTHour,
    sliceWithBuffer,
    calcSMA,
    calcLatestMAValue,
    mergeBars,
    fetchSignals,
    buildSignalAnnotations,
    getWsHub,
    buildCrossMarkers,
    genMinutePlaceholders,
    fmtComma,
} from "../../lib/tradeUtils";

const API_BASE = "https://api.bybit.com";
const PAGE_LIMIT = 1000;

const ONE_DAY_SEC = 86400;
const MA_BUF = 99;
const MAX_1M_BARS = 43200; // 안전 상한(너무 커지면 메모리/성능 이슈)

/* -------------------- CACHE (CFD와 동일한 형태) -------------------- */

// symbol -> Map(dayOffset -> rows)
const candleCache = new Map();
const signalCache = new Map();
const MAX_DAYS_PER_SYMBOL = 8;

function touchCandleCache(symbol, dayKey, rows) {
    const sym = symbol.toUpperCase();
    if (!candleCache.has(sym)) candleCache.set(sym, new Map());
    const symMap = candleCache.get(sym);

    if (symMap.has(dayKey)) symMap.delete(dayKey);
    symMap.set(dayKey, rows);

    while (symMap.size > MAX_DAYS_PER_SYMBOL) {
        const firstKey = symMap.keys().next().value;
        symMap.delete(firstKey);
    }
}

function getCachedRows(symbol, dayKey) {
    const symMap = candleCache.get(symbol.toUpperCase());
    if (!symMap) return null;
    return symMap.get(dayKey) || null;
}

/* -------------------- UTILS -------------------- */

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

/**
 * ✅ Bybit v5 kline: 특정 window(start~end) + MA buffer(이전 99분)까지 커버될 때까지 과거로 페이지네이션
 * - 요청은 end(ms) 기준으로 과거로 내려가며 list를 누적
 * - oldestSec <= wantStartSec 이면 stop
 */
async function fetchCandlesForWindowBybit(symbol, interval, startSec, endSec, signal) {
    const wantStartSec = startSec - MA_BUF * 60;

    let rows = [];
    let endMs = Math.floor(Number(endSec) * 1000);
    let prevEndMs = null;

    for (let page = 0; page < 12; page++) {
        const url = new URL("/v5/market/kline", API_BASE);
        url.searchParams.set("category", "linear");
        url.searchParams.set("symbol", symbol.toUpperCase());
        url.searchParams.set("interval", String(interval));
        url.searchParams.set("limit", String(PAGE_LIMIT));
        url.searchParams.set("end", String(endMs));

        const res = await fetch(url, {signal});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data?.retCode !== 0) throw new Error(`API error (${data?.retCode}): ${data?.retMsg}`);

        const list = data?.result?.list || [];
        if (!list.length) break;

        rows = rows.concat(list);

        // 이번 페이지에서 가장 오래된 ts 찾기
        let minMs = Infinity;
        for (const r of list) {
            const ms = Number(r?.[0]);
            if (Number.isFinite(ms) && ms < minMs) minMs = ms;
        }
        if (!Number.isFinite(minMs)) break;

        const oldestSec = Math.floor(minMs / 1000);
        if (oldestSec <= wantStartSec) break;

        // 다음 페이지: 더 과거로
        prevEndMs = endMs;
        endMs = minMs - 1;

        if (endMs <= 0) break;
        if (prevEndMs != null && endMs >= prevEndMs) break;
    }

    rows.sort((a, b) => Number(a[0]) - Number(b[0]));
    return rows;
}

/* -------------------- COMPONENT -------------------- */

export default function ChartPanel({
                                       symbol, dayOffset, anchorEndUtcSec, // ✅ 부모에서 고정해서 내려받기 (CFD와 통일)
                                       onBounds, onStats, thr, crossTimes, signalName, priceScale,
                                   }) {
    const wsHub = useRef(getWsHub("wss://stream.bybit.com/v5/public/linear")).current;

    const allBarsRef = useRef([]);
    const markersAllRef = useRef([]);
    const notesAllRef = useRef([]);

    const prefetchedRef = useRef(false);
    const prefetchAbortRef = useRef(null); // prefetch 취소용
    const loadSeqRef = useRef(0);

    const [loading, setLoading] = useState(false);

    const [notesView, setNotesView] = useState([]);
    const [displayCandles, setDisplayCandles] = useState([]);
    const [ma100, setMa100] = useState([]);
    const [markers, setMarkers] = useState([]);
    const [visibleRange, setVisibleRange] = useState(null);

    const tickFormatter = useCallback((tsSec) => fmtKSTHour(tsSec), []);

    // ✅ bounds 고정 (-7..0) (coin도 8일치 기준)
    useEffect(() => {
        onBounds?.(symbol, {min: -7, max: 0});
    }, [onBounds, symbol]);

    const renderWindow = useCallback((start, end, resetRange = false) => {
        if (resetRange) setVisibleRange({start, end}); else setVisibleRange((prev) => prev || {start, end});

        const arrAll = allBarsRef.current || [];
        const real = arrAll.filter((b) => b.time >= start && b.time < end);

        // ✅ prefix + suffix placeholder (coin 기존 UX 유지)
        const firstRealTime = real.length ? real[0].time : end;
        const prefixEnd = Math.min(firstRealTime, end);
        const prefixPlaceholders = prefixEnd > start ? genMinutePlaceholders(start, prefixEnd) : [];

        const placeStart = (real.at(-1)?.time ?? start) + 60;
        const placeholders = placeStart < end ? genMinutePlaceholders(placeStart, end) : [];

        setDisplayCandles(prefixPlaceholders.concat(real, placeholders));

        // ✅ MA
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
        const n = (notesAllRef.current || []).filter((x) => x.timeSec >= start && x.timeSec < end);
        setNotesView(n);

        // ✅ stats (window 기준)
        const lastClose = real.length ? real[real.length - 1].close : null;
        const lastMa = calcLatestMAValue(real, 100);

        const prev3 = real.length >= 3 ? real[real.length - 3].close : null;
        const chg3mPct = prev3 && lastClose != null ? ((lastClose - prev3) / prev3) * 100 : null;

        onStats?.(symbol, {ma100_1m: lastMa, chg3mPct});
    }, [crossTimes, onStats, symbol]);

    const ensureSignals = useCallback(async (symUpper) => {
        if (!signalCache.has(symUpper)) {
            const sigs = await fetchSignals(symUpper, signalName || "bybit").catch(() => []);
            const {markers: m, notes} = buildSignalAnnotations(sigs);
            signalCache.set(symUpper, {markers: m || [], notes: notes || []});
        }
        const s = signalCache.get(symUpper);
        markersAllRef.current = s?.markers || [];
        notesAllRef.current = s?.notes || [];
    }, [signalName]);

    // ✅ prefetch: 오늘(0) 로드 완료 후 -1..-7 순서대로 캐시 채움
    const prefetchPastDays = useCallback(async (symUpper) => {
        // 이미 시작했으면 중복 방지
        if (prefetchedRef.current) return;
        prefetchedRef.current = true;

        // 기존 prefetch 취소
        try {
            prefetchAbortRef.current?.abort?.();
        } catch {
        }
        const ac = new AbortController();
        prefetchAbortRef.current = ac;

        for (let offset = -1; offset >= -7; offset--) {
            if (ac.signal.aborted) return;

            const dayKey = String(offset);
            if (getCachedRows(symUpper, dayKey)) continue;

            const [start, end] = getDayWindowByOffset(anchorEndUtcSec, offset);

            try {
                const rows = await fetchCandlesForWindowBybit(symUpper, "1", start, end, ac.signal);
                touchCandleCache(symUpper, dayKey, rows);
            } catch (e) {
                if (e?.name === "AbortError") return; // 정상 취소
                console.warn("[Bybit Prefetch] failed:", symUpper, offset, e);
            }
        }
    }, [anchorEndUtcSec]);

    // ✅ main load: dayOffset 기준 “그 날만” 캐시/로드
    useEffect(() => {
        if (!Number.isFinite(Number(anchorEndUtcSec))) return;

        const symUpper = symbol.toUpperCase();
        const [start, end] = getDayWindowByOffset(anchorEndUtcSec, dayOffset);
        const dayKey = String(dayOffset);

        // 새로운 로드 시퀀스
        const mySeq = ++loadSeqRef.current;

        setLoading(true);
        setVisibleRange({start, end});
        setNotesView([]);
        setDisplayCandles([]);
        setMa100([]);
        setMarkers([]);

        // ✅ 캐시 히트
        const cached = getCachedRows(symUpper, dayKey);
        if (cached) {
            (async () => {
                try {
                    await ensureSignals(symUpper);
                    if (loadSeqRef.current !== mySeq) return;

                    allBarsRef.current = rowsToBars(cached);
                    renderWindow(start, end, true);


                    // ✅ 오늘이면 캐시여도 prefetch 보장
                    if (dayOffset === 0) prefetchPastDays(symUpper);
                } finally {
                    if (loadSeqRef.current === mySeq) setLoading(false);
                }
            })();
            return;
        }

        // ✅ 캐시 미스: fetch
        const ac = new AbortController();
        (async () => {
            try {
                await ensureSignals(symUpper);
                if (loadSeqRef.current !== mySeq) return;

                const rows = await fetchCandlesForWindowBybit(symUpper, "1", start, end, ac.signal);
                if (loadSeqRef.current !== mySeq) return;

                touchCandleCache(symUpper, dayKey, rows);

                let bars = rowsToBars(rows);
                if (bars.length > MAX_1M_BARS) bars = bars.slice(-MAX_1M_BARS);

                allBarsRef.current = bars;
                renderWindow(start, end, true);

                // ✅ 오늘이면 prefetch
                if (dayOffset === 0) prefetchPastDays(symUpper);
            } catch (e) {
                if (e?.name === "AbortError") return; // 정상 취소 (StrictMode / 빠른 이동)
                console.error("[Bybit] load failed:", e);
            } finally {
                if (loadSeqRef.current === mySeq) setLoading(false);
            }
        })();

        return () => ac.abort();
    }, [symbol, dayOffset, anchorEndUtcSec, ensureSignals, renderWindow, prefetchPastDays]);

    // ✅ WS: 현재 window에 대해서만 갱신 (필요 시 cache에도 반영 가능)
    useEffect(() => {
        const TOPIC_1M = `kline.1.${symbol}`;
        const cleanups = [];

        try {
            wsHub.subscribe?.([TOPIC_1M]);
        } catch {
        }
        cleanups.push(() => {
            try {
                wsHub.unsubscribe?.([TOPIC_1M]);
            } catch {
            }
        });

        const off1m = wsHub.addListener?.(TOPIC_1M, (d) => {
            const vr = visibleRange;
            if (!vr?.start || !vr?.end) return;

            const rawStart = Number(d?.start);
            const startSec = Number.isFinite(rawStart) ? rawStart > 2e10 ? Math.floor(rawStart / 1000) : Math.floor(rawStart) : NaN;

            if (!Number.isFinite(startSec)) return;

            const bar = {
                time: startSec, open: +d.open, high: +d.high, low: +d.low, close: +d.close,
            };

            // window 밖이면 굳이 렌더 안 해도 됨 (현재는 무시)
            if (bar.time < vr.start - MA_BUF * 60 || bar.time >= vr.end) return;

            let arr = mergeBars(allBarsRef.current || [], bar);
            if (arr.length > MAX_1M_BARS) arr = arr.slice(-MAX_1M_BARS);
            allBarsRef.current = arr;

            renderWindow(vr.start, vr.end, true);
            // ✅ 여기에서만 현재가 업데이트
            onStats?.(symbol, {price1m: bar.close});
            // stats는 renderWindow에서 처리함
        });

        cleanups.push(() => {
            try {
                off1m?.();
            } catch {
            }
        });

        return () => {
            cleanups.forEach((fn) => {
                try {
                    fn();
                } catch {
                }
            });
        };
    }, [wsHub, symbol, visibleRange, renderWindow]);

    return (<div style={{marginBottom: 28}}>
            <div style={{fontSize: 20, opacity: 0.8, marginBottom: 6}}>
                {symbol}
                <span style={{marginLeft: 10, fontSize: 12, opacity: 0.65}}>
          (dayOffset: {dayOffset})
        </span>
            </div>

            <div style={{width: 1100, maxWidth: "100%", position: "relative"}}>
                {loading ? (<div
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
                    </div>) : null}

                <ChartView
                    height={320}
                    tickFormatter={tickFormatter}
                    displayCandles={displayCandles}
                    ma100={ma100}
                    thr={thr}
                    markers={markers}
                    visibleRange={visibleRange}
                />

                <SignalNotesPanel
                    symbol={symbol}
                    notes={notesView}
                    getPriceText={(n) => (n.price != null ? fmtComma(Number(n.price), priceScale ?? 2) : "—")}
                    collapseKey={`${symbol}:${dayOffset}`}
                />
            </div>
        </div>);
}