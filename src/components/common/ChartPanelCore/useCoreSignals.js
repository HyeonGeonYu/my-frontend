// src/components/common/ChartPanelCore/useCoreSignals.js
import {useCallback, useRef} from "react";
import {buildCrossMarkers} from "../../../lib/tradeUtils";
import {signalsRepo} from "../../../lib/signalsRepo";

export default function useCoreSignals({source, dayOffset, crossTimes}) {
    const markersAllRef = useRef([]);
    const notesAllRef = useRef([]);

    const ensureSignals = useCallback(
        async (symUpper) => {
            // 1) 기존 마커는 그대로
            const s = await source.ensureSignals(symUpper).catch(() => ({markers: [], notes: []}));
            markersAllRef.current = s?.markers || [];

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

                notesAllRef.current = (dayNotes || []).map((x) => ({
                    ...x,
                    timeSec: Number.isFinite(Number(x?.ts_ms))
                        ? Math.floor(Number(x.ts_ms) / 1000)
                        : Number(x?.timeSec),
                }));
            } catch {
                notesAllRef.current = s?.notes || [];
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

    return {ensureSignals, getMarkersForWindow, getNotesForWindow};
}