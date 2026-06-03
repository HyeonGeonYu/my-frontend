import React, { useEffect, useMemo, useState } from "react";
import { fmtKSTFull } from "../../lib/tradeUtils";

/**
 * notes: [{ key, seq, timeSec, side, kind, price, reasons }]
 * getPriceText: (note) => string
 */

function fmtKSTHM(sec) {
    const t = Number(sec);
    if (!Number.isFinite(t)) return "";

    const d = new Date((t + 9 * 3600) * 1000);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
}

function getFirstReasonText(n) {
    if (n?.firstReason) return String(n.firstReason);

    if (Array.isArray(n?.reasons) && n.reasons.length) {
        return String(n.reasons[0] || "");
    }

    if (Array.isArray(n?.reasons_json) && n.reasons_json.length) {
        return String(n.reasons_json[0] || "");
    }

    if (typeof n?.reasons === "string" && n.reasons.trim()) {
        try {
            const parsed = JSON.parse(n.reasons);
            if (Array.isArray(parsed) && parsed.length) {
                return String(parsed[0] || "");
            }
        } catch {
            return n.reasons.split(",")[0].trim();
        }
    }

    return String(n?.noteText || "");
}

function getEntryExitTagText(n) {
    return String(n?.entryExitTag || "").trim();
}

export default function SignalNotesPanel({
    symbol,
    notes,
    getPriceText,
    titleSuffix, // optional: "(show: ...)" 같은거 붙이고 싶으면
    defaultCollapsed = true,
    collapseKey, // window가 바뀌면 자동 접기용(coin dayOffset / cfd effectiveSessionKey)
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    useEffect(() => {
        if (collapseKey != null) setCollapsed(true);
    }, [collapseKey]);

    const list = useMemo(() => (Array.isArray(notes) ? notes : []), [notes]);

    return (
        <div
            style={{
                marginTop: 10,
                background: "#161616",
                border: "1px solid #262626",
                borderRadius: 12,
                padding: "10px 12px",
                width: "100%",
                boxSizing: "border-box",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.9 }}>
                    {symbol} · 시그널 설명 ({list.length})
                    {titleSuffix ?
                        <span style={{ marginLeft: 8, opacity: 0.65, fontWeight: 500 }}>{titleSuffix}</span> : null}
                </div>

                <button
                    onClick={() => setCollapsed((v) => !v)}
                    style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #2a2a2a",
                        background: "#1f1f1f",
                        color: "#ddd",
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                    title={collapsed ? "펼치기" : "접기"}
                >
                    {collapsed ? "펼치기 ⌄" : "접기 ⌃"}
                </button>
            </div>

            {collapsed ? (
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }} />
            ) : list.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>시그널 없음</div>
            ) : (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {list.map((n) => {
                        const side = String(n.side || "").toUpperCase();
                        const kind = String(n.kind || "").toUpperCase();
                        const sideColor = side === "LONG" ? "#16a34a" : side === "SHORT" ? "#dc2626" : "#9ca3af";

                        const priceTxt = typeof getPriceText === "function" ? getPriceText(n) : (n.price != null ? String(n.price) : "—");
                        const timeTxt = n.timeSec ? fmtKSTHM(n.timeSec) : "";
                        const entryExitTagTxt = getEntryExitTagText(n);
                        const reasonTxt = getFirstReasonText(n);

                        return (
                            <div
                                key={n.key}
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 10,
                                    background: "#1b1b1b",
                                    border: "1px solid #2a2a2a",
                                }}
                            >
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "6ch 7ch 8ch 9ch 14ch 16ch 1fr",
                                        columnGap: 12,
                                        alignItems: "baseline",
                                        fontSize: 12,
                                        lineHeight: 1.5,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                    title={[
                                        n.displayNo || `#${n.signalNo || n.seq || n.no || ""}`,
                                        timeTxt,
                                        side,
                                        kind,
                                        priceTxt,
                                        entryExitTagTxt,
                                        reasonTxt,
                                        n.tooltipText,
                                        n.timeSec ? fmtKSTFull(n.timeSec) : "",
                                    ].filter(Boolean).join(" · ")}
                                >
                                    <b style={{ opacity: 0.95 }}>
                                        {n.displayNo || `#${n.signalNo || n.seq || n.no || ""}`}
                                    </b>

                                    <span>{timeTxt}</span>

                                    <span style={{ color: sideColor, fontWeight: 700 }}>
                                        {side}
                                    </span>

                                    <span style={{ opacity: 0.85 }}>
                                        {kind}
                                    </span>

                                    <span>{priceTxt}</span>

                                    {/* 새 컬럼: #ENTRY 4 / #EXIT 3,4/4 */}
                                    <span
                                        style={{
                                            opacity: entryExitTagTxt ? 0.95 : 0.45,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {entryExitTagTxt || "—"}
                                    </span>

                                    {/* 마지막 설명: 첫 번째 reason만 */}
                                    <span
                                        style={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            opacity: reasonTxt ? 0.9 : 0.6,
                                        }}
                                    >
                                        {reasonTxt || "—"}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
