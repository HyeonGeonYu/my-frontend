// src/components/common/ChartPanelCore/useCoreSignals.js
import { useCallback, useRef } from "react";
import { buildCrossMarkers } from "../../../lib/tradeUtils";
import { signalsRepo } from "../../../lib/signalsRepo";
import { getNetPnlPctFromSignal, fmtSignedPct } from "./coreUtils";

function withPnlPctText(item) {
    const kind = String(item?.kind || "").toUpperCase();
    if (kind !== "EXIT") return item;

    const netPnlPct = getNetPnlPctFromSignal(item);
    const pnlPctText = fmtSignedPct(netPnlPct, 2);

    if (!pnlPctText) return item;

    const oldText = String(item?.text || item?.label || "").trim();

    // 이미 같은 문구가 있으면 중복 방지
    if (oldText.includes(pnlPctText)) return item;

    return {
        ...item,
        netPnlPct,
        text: oldText ? `${oldText} · ${pnlPctText}` : pnlPctText,
    };
}


function getSignalType(item) {
    const reasons = item?.reasons;

    if (Array.isArray(reasons) && reasons.length > 0) {
        return String(reasons[0] || "").trim();
    }

    return String(
        item?.mode ||
        item?.reason ||
        item?.signalType ||
        ""
    ).trim();
}

function getKindSideText(item, exec) {
    const kind = String(item?.kind || exec?.kind || "").toUpperCase();
    const side = String(item?.side || exec?.side || "").toUpperCase();

    if (!kind && !side) return "";

    return [kind, side].filter(Boolean).join(" ");
}

function buildBaseArchiveLikeText(item, exec) {
    const kindSide = getKindSideText(item, exec);
    const signalType = getSignalType(item);

    return [
        kindSide,
        signalType,
    ].filter(Boolean).join(" · ");
}

const TRADE_RECORDS_NS = "agent:CopyZannavi:u7c9f14d2a1:BYBIT";

function toNumOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function fmtSignedUsdt(v, digits = 2) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return `${n >= 0 ? "+" : ""}${n.toFixed(digits)} USDT`;
}

function getSignalKey(x) {
    return String(
        x?.signal_id ||
        x?.exit_signal_id ||
        x?.entry_signal_id ||
        x?.close_open_signal_id ||
        x?.signalKey ||
        x?._id ||
        x?.id ||
        ""
    );
}

function makeTradeRecordMap(records = []) {
    const map = new Map();

    for (const r of records || []) {
        const keys = [
            r?.signal_id,
            r?.exit_signal_id,
            r?.entry_signal_id,
            r?.close_open_signal_id,
            r?.signalKey,
            r?._id,
            r?.id,
        ]
            .map((v) => String(v || "").trim())
            .filter(Boolean);

        for (const k of keys) {
            map.set(k, r);
        }
    }

    return map;
}

function buildExecText(item, exec) {
    const kind = String(item?.kind || exec?.kind || "").toUpperCase();

    const qty = toNumOrNull(exec?.qty);

    const rawPnlUsdt = exec?.pnl_usdt;
    const pnlUsdt = toNumOrNull(rawPnlUsdt);

    // ✅ pnl_usdt가 없거나 0이면 USDT 표시 안 함
    const hasPnlUsdt =
        rawPnlUsdt !== null &&
        rawPnlUsdt !== undefined &&
        rawPnlUsdt !== "" &&
        Number.isFinite(pnlUsdt) &&
        Math.abs(pnlUsdt) > 1e-9;

    const netPnlPct = kind === "EXIT" ? getNetPnlPctFromSignal(item) : null;
    const pctText = fmtSignedPct(netPnlPct, 2);
    const usdtText = hasPnlUsdt ? fmtSignedUsdt(pnlUsdt, 2) : null;

    if (kind === "ENTRY") {
        return Number.isFinite(qty) && qty > 0 ? qty.toFixed(4) : null;
    }

    if (kind === "EXIT") {
        if (usdtText && pctText) return `${usdtText} (${pctText})`;
        if (usdtText) return usdtText;
        if (pctText) return pctText;
        return null;
    }

    return null;
}

function appendExecText(item, execMap) {
    const key = getSignalKey(item);
    const exec = key ? execMap.get(key) : null;

    const baseText = buildBaseArchiveLikeText(item, exec);
    const extraText = buildExecText(item, exec || {});

    const finalText = [
        baseText,
        extraText,
    ].filter(Boolean).join(" · ");

    if (!finalText) {
        return item;
    }

    return {
        ...item,
        exec,
        qty: toNumOrNull(exec?.qty),
        pnlUsdt: toNumOrNull(exec?.pnl_usdt),
        text: finalText,
    };
}

async function fetchTradeRecordsForChart({ symbol, dayOffset }) {
    const qs = new URLSearchParams({
        ns: TRADE_RECORDS_NS,
        symbol: String(symbol || "").toUpperCase(),
        days: "10",
        limit: "1000",
    });

    // api가 dayOffset을 아직 안 쓰고 days 기반이면 없어도 됨.
    // 만들어둔 api가 dayOffset 지원하면 같이 넘겨도 됨.
    qs.set("dayOffset", String(dayOffset || 0));

    const res = await fetch(`/api/tradeRecords?${qs.toString()}`, {
        cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.retCode !== 0) {
        throw new Error(json?.retMsg || json?.error || "tradeRecords fetch failed");
    }

    return Array.isArray(json.records) ? json.records : [];
}

export default function useCoreSignals({ source, dayOffset, crossTimes }) {
    const markersAllRef = useRef([]);
    const notesAllRef = useRef([]);

    const ensureSignals = useCallback(
        async (symUpper) => {
            // 1) 기존 마커는 그대로
            const s = await source.ensureSignals(symUpper).catch(() => ({ markers: [], notes: [] }));

            let tradeRecords = [];
            try {
                tradeRecords = await fetchTradeRecordsForChart({
                    symbol: symUpper,
                    dayOffset,
                });
            } catch {
                tradeRecords = [];
            }

            const execMap = makeTradeRecordMap(tradeRecords);

            markersAllRef.current = (s?.markers || []).map((m) => appendExecText(m, execMap));

            // 2) notes는 repo 기반 우선
            try {
                const raw = source?.signalName || source?.name || source?.key || "bybit";
                const name = String(raw).split(":").pop().toLowerCase(); // "cfd:mt5" -> "mt5"
                const dayNotes = await signalsRepo.getForChart({
                    name,
                    symbol: symUpper,
                    dayOffset,
                    days: 8,
                    limit: 500,
                });

                notesAllRef.current = (dayNotes || []).map((x) =>
                    appendExecText(
                        {
                            ...x,
                            timeSec: Number.isFinite(Number(x?.ts_ms))
                                ? Math.floor(Number(x.ts_ms) / 1000)
                                : Number(x?.timeSec),
                        },
                        execMap
                    )
                );
            } catch {
                notesAllRef.current = (s?.notes || []).map((n) => appendExecText(n, execMap));
            }
        },
        [source, dayOffset]
    );

    const getMarkersForWindow = useCallback(
        (start, end) => {
            const base = (markersAllRef.current || []).filter((x) => x.time >= start && x.time < end);
            const cross = buildCrossMarkers(Array.isArray(crossTimes) ? crossTimes : [], start, end);

            return [...base, ...cross].sort((a, b) => {
                if (a.time !== b.time) return a.time - b.time;
                return String(a.text || "").localeCompare(String(b.text || ""));
            });
        },
        [crossTimes]
    );

    const getNotesForWindow = useCallback((start, end) => {
        return (notesAllRef.current || []).filter((x) => {
            const t = Number(x?.timeSec);
            return Number.isFinite(t) && t >= start && t < end;
        });
    }, []);

    return { ensureSignals, getMarkersForWindow, getNotesForWindow };
}