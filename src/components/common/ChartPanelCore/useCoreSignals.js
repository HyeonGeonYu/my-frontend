// src/components/common/ChartPanelCore/useCoreSignals.js
import { useCallback, useRef } from "react";
import { buildCrossMarkers } from "../../../lib/tradeUtils";
import { signalsRepo } from "../../../lib/signalsRepo";
import { getNetPnlPctFromSignal, fmtSignedPct } from "./coreUtils";


function parseReasonsJson(v) {
    if (!v) return [];

    if (Array.isArray(v)) return v;

    if (typeof v === "string") {
        try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

function getSignalType(item, exec) {
    const candidates = [
        item?.reasons,
        item?.reasons_json,
        item?.raw_json?.reasons,
        item?.raw_json?.reasons_json,
        exec?.reasons,
        exec?.reasons_json,
        exec?.raw_json?.reasons,
        exec?.raw_json?.reasons_json,
    ];

    for (const c of candidates) {
        const arr = Array.isArray(c) ? c : parseReasonsJson(c);
        if (arr.length > 0) {
            return String(arr[0] || "").trim();
        }
    }

    return String(
        item?.mode ||
        item?.reason ||
        item?.signalType ||
        item?.raw_json?.mode ||
        item?.raw_json?.reason ||
        item?.raw_json?.signalType ||
        exec?.mode ||
        exec?.reason ||
        exec?.signalType ||
        exec?.raw_json?.mode ||
        exec?.raw_json?.reason ||
        exec?.raw_json?.signalType ||
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
    const signalType = getSignalType(item, exec);

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


function getReasonList(item, exec) {
    const candidates = [
        item?.reasons,
        item?.reasons_json,
        item?.raw_json?.reasons,
        item?.raw_json?.reasons_json,
        exec?.reasons,
        exec?.reasons_json,
        exec?.raw_json?.reasons,
        exec?.raw_json?.reasons_json,
    ];

    for (const c of candidates) {
        const arr = Array.isArray(c) ? c : parseReasonsJson(c);
        if (arr.length > 0) {
            return arr.map((x) => String(x || "").trim()).filter(Boolean);
        }
    }

    const one = getSignalType(item, exec);
    return one ? [one] : [];
}

function getFirstReason(item, exec) {
    const arr = getReasonList(item, exec);
    return arr[0] || "";
}

function getEntryExitTag(item, exec) {
    const kind = String(item?.kind || exec?.kind || "").toUpperCase();

    const reasons = getReasonList(item, exec);
    const reasonText = reasons.join(", ");

    // ENTRY 쪽: reason 안에 #ENTRY 4 같은 게 있으면 추출
    if (kind === "ENTRY") {
        const m = reasonText.match(/#ENTRY\s*\d+/i);
        return m ? m[0].toUpperCase().replace(/\s+/, " ") : "";
    }

    // EXIT 쪽: #EXIT 3,4/4 같은 게 있으면 추출
    if (kind === "EXIT") {
        const m = reasonText.match(/#EXIT\s*[\d,\s]+\/\d+/i);
        return m ? m[0].toUpperCase().replace(/\s+/g, " ") : "";
    }

    return "";
}

function appendExecText(item, execMap) {
    const key = getSignalKey(item);
    const exec = key ? execMap.get(key) : null;

    const baseText = buildBaseArchiveLikeText(item, exec);
    const extraText = buildExecText(item, exec || {});

    const fullText = [
        baseText,
        extraText,
    ].filter(Boolean).join(" · ");

    const firstReason = getFirstReason(item, exec);
    const entryExitTag = getEntryExitTag(item, exec);

    return {
        ...item,
        exec,
        qty: toNumOrNull(exec?.qty),
        pnlUsdt: toNumOrNull(exec?.pnl_usdt),

        // 차트 위에는 설명 안 띄움. 번호는 window에서 다시 붙임.
        text: "",

        // 새 컬럼용
        firstReason,
        entryExitTag,

        // hover용 전체 설명
        tooltipText: fullText,

        // 패널 마지막 컬럼은 첫 reason만
        noteText: firstReason,
    };
}

function getSignalTime(x) {
    const t = Number(x?.time ?? x?.timeSec ?? 0);
    return Number.isFinite(t) ? t : 0;
}

function assignWindowSignalNumbers(items = [], { markerText = true } = {}) {
    return [...items]
        .sort((a, b) => {
            const ta = getSignalTime(a);
            const tb = getSignalTime(b);
            if (ta !== tb) return ta - tb;

            return String(a?.tooltipText || a?.noteText || a?.text || "").localeCompare(
                String(b?.tooltipText || b?.noteText || b?.text || "")
            );
        })
        .map((item, idx) => {
            const no = idx + 1;

            const rawTooltip =
                item?.tooltipText ||
                item?.noteText ||
                item?.text ||
                "";

            return {
                ...item,
                signalNo: no,
                no,
                seq: no,
                order: no,
                displayNo: `#${no}`,

                // 차트 위 번호만
                text: markerText ? `#${no}` : "",

                // hover에는 번호 + 전체 설명
                tooltipText: [`#${no}`, rawTooltip].filter(Boolean).join(" · "),

                // 패널 마지막 컬럼은 유지: firstReason만
                noteText: item?.noteText || item?.firstReason || "",
            };
        });
}

function withSignalNumbers(items = []) {
    return [...items]
        .sort((a, b) => {
            const ta = Number(a?.time ?? a?.timeSec ?? 0);
            const tb = Number(b?.time ?? b?.timeSec ?? 0);

            if (ta !== tb) return ta - tb;

            return String(a?.tooltipText || a?.noteText || "").localeCompare(
                String(b?.tooltipText || b?.noteText || "")
            );
        })
        .map((item, idx) => {
            const no = idx + 1;
            const tooltipText = item?.tooltipText || item?.noteText || "";

            return {
                ...item,
                signalNo: no,

                text: `#${no}`,

                // ✅ hover에서는 번호 포함된 설명이 뜨게
                tooltipText: [`#${no}`, tooltipText].filter(Boolean).join(" · "),
                noteText: [`#${no}`, tooltipText].filter(Boolean).join(" · "),
            };
        });
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
                notesAllRef.current = (s?.notes || []).map((n) =>
                    appendExecText(n, execMap)
                );
            }
        },
        [source, dayOffset]
    );

    const getMarkersForWindow = useCallback(
        (start, end) => {
            const baseRaw = (markersAllRef.current || []).filter((x) => {
                const t = Number(x?.time);
                return Number.isFinite(t) && t >= start && t < end;
            });

            // ✅ 오늘/현재 차트 윈도우 기준으로 번호 부여
            const base = assignWindowSignalNumbers(baseRaw, { markerText: true });

            const cross = buildCrossMarkers(
                Array.isArray(crossTimes) ? crossTimes : [],
                start,
                end
            );

            // ✅ cross는 매매 시그널이 아니므로 번호 부여 X
            return [...base, ...cross].sort((a, b) => {
                const ta = Number(a?.time ?? 0);
                const tb = Number(b?.time ?? 0);
                if (ta !== tb) return ta - tb;

                return String(a?.text || "").localeCompare(String(b?.text || ""));
            });
        },
        [crossTimes]
    );

    const getNotesForWindow = useCallback((start, end) => {
        const rows = (notesAllRef.current || []).filter((x) => {
            const t = Number(x?.timeSec ?? x?.time);
            return Number.isFinite(t) && t >= start && t < end;
        });

        // ✅ 패널도 오늘/현재 차트 윈도우 기준 번호
        return assignWindowSignalNumbers(rows, { markerText: false });
    }, []);

    return { ensureSignals, getMarkersForWindow, getNotesForWindow };
}