import React, {useEffect, useMemo, useState} from "react";
import {fmtKSTFull, fmtKSTHMS} from "../../lib/tradeUtils";

/**
 * notes: [{ key, seq, timeSec, side, kind, price, reasons }]
 * getPriceText: (note) => string
 */
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
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <div style={{fontWeight: 700, fontSize: 13, opacity: 0.9}}>
                    {symbol} · 시그널 설명 ({list.length})
                    {titleSuffix ?
                        <span style={{marginLeft: 8, opacity: 0.65, fontWeight: 500}}>{titleSuffix}</span> : null}
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
                <div style={{fontSize: 12, opacity: 0.7, marginTop: 8}}/>
            ) : list.length === 0 ? (
                <div style={{fontSize: 12, opacity: 0.7, marginTop: 8}}>시그널 없음</div>
            ) : (
                <div style={{display: "grid", gap: 8, marginTop: 8}}>
                    {list.map((n) => {
                        const side = String(n.side || "").toUpperCase();
                        const kind = String(n.kind || "").toUpperCase();
                        const sideColor = side === "LONG" ? "#16a34a" : side === "SHORT" ? "#dc2626" : "#9ca3af";

                        const priceTxt = typeof getPriceText === "function" ? getPriceText(n) : (n.price != null ? String(n.price) : "—");
                        const timeTxt = n.timeSec ? fmtKSTHMS(n.timeSec) : "";
                        const reasonsTxt =
                            (Array.isArray(n.reasons) && n.reasons.length ? n.reasons.join(", ") : "") ||
                            (Array.isArray(n.reasons_json) && n.reasons_json.length ? n.reasons_json.join(", ") : "") ||
                            (typeof n.reasons === "string" && n.reasons.trim() ? n.reasons.trim() : "") ||
                            "";

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
                                        gridTemplateColumns: "6ch 9ch 8ch 9ch 14ch 1fr",
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
                                        `#${n.seq}`,
                                        timeTxt,
                                        side,
                                        kind,
                                        priceTxt,
                                        n.timeSec ? fmtKSTFull(n.timeSec) : "",
                                        reasonsTxt,
                                    ].filter(Boolean).join(" · ")}
                                >
                                    <b style={{opacity: 0.95}}>#{n.seq}</b>
                                    <span>{timeTxt}</span>
                                    <span style={{color: sideColor, fontWeight: 700}}>{side}</span>
                                    <span style={{opacity: 0.85}}>{kind}</span>
                                    <span>{priceTxt}</span>
                                    <span style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        opacity: reasonsTxt ? 0.9 : 0.6
                                    }}>
                    {reasonsTxt || "—"}
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
