import React from "react";
import {fmtComma} from "../../lib/tradeUtils";

/**
 * 심볼 티커 카드: 심볼 / 가격 / MA100 대비 / 3분 변화.
 * (MA100 전략 은퇴 2026-06-29 — 임계·진입/청산밴드·목표크로스 표시 제거.)
 */
export default function UnifiedTickerCard({
                                              symbol,
                                              price,
                                              ma100,
                                              chg3mPct,
                                              ps = 2,
                                          }) {
    const has = typeof price === "number" && typeof ma100 === "number" && ma100 !== 0;
    const deltaPct = has ? price / ma100 - 1 : null;
    const up = deltaPct != null ? deltaPct >= 0 : null;

    return (
        <div
            style={{
                padding: "16px 18px",
                borderRadius: 14,
                background: "#1a1a1a",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
        >
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline"}}>
                <div style={{fontSize: 14, opacity: 0.9}}>{symbol}</div>
            </div>
            <div style={{fontSize: 28, fontWeight: 700, marginTop: 4}}>
                {price != null ? fmtComma(price, ps) : "—"}
            </div>

            <div
                style={{
                    marginTop: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                }}
            >
        <span style={{color: up == null ? "#aaa" : up ? "#2fe08d" : "#ff6b6b"}}>
          MA100 {" "}
            {deltaPct != null
                ? `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct * 100).toFixed(2)}%`
                : "--"}
        </span>

                <span style={{opacity: 0.6}}>·</span>

                <span style={{color: chg3mPct == null ? "#aaa" : chg3mPct >= 0 ? "#2fe08d" : "#ff6b6b"}}>
          3M{" "}
                    {chg3mPct != null ? `${chg3mPct >= 0 ? "+" : ""}${chg3mPct.toFixed(3)}%` : "—"}
        </span>
            </div>
        </div>
    );
}
