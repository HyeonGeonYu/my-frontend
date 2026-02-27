// src/components/AssetPanel.jsx
import React, {useMemo, useState} from "react";
import {fmtComma, buildPositionRows, calcEquityUSDT} from "../lib/tradeUtils";

// 퍼센트 출력 유틸
const pctStr = (v, digits = 2) =>
    v == null || Number.isNaN(+v) ? "—" : `${(+v).toFixed(digits)}%`;

export default function AssetPanel({asset, statsBySymbol, config}) {
    const wallet = +(asset?.wallet?.USDT ?? 0);
    const {rows} = buildPositionRows(asset, statsBySymbol);
    const equity = calcEquityUSDT(asset, statsBySymbol);

    // ✅ 진입 표시 모드 토글: "usdt" | "qty"
    const [entryMode, setEntryMode] = useState("usdt");

    // ✅ 합계 (총진입/총 PnL)
    const totals = useMemo(() => {
        let entryUSDT = 0;
        let pnl = 0;

        for (const r of rows) {
            const qty = Math.abs(+r.qty || 0);
            const avg = +r.avg || 0;
            entryUSDT += qty * avg;

            const rpnl = +r.pnl || 0;
            pnl += rpnl;
        }

        const entryPct = wallet > 0 ? (entryUSDT / wallet) * 100 : 0;

        // pnlPct는 "지갑 대비"로 계산 (원하면 entryUSDT 기준으로 바꿀 수도 있음)
        const pnlPct = wallet > 0 ? (pnl / wallet) * 100 : 0;

        return {entryUSDT, entryPct, pnl, pnlPct};
    }, [rows, wallet]);

    const pnlColor = totals.pnl >= 0 ? "#2fe08d" : "#ff6b6b";

    return (
        <div
            style={{
                top: 12,
                zIndex: 10,
                padding: 14,
                borderRadius: 14,
                background: "#1a1a1a",
                marginBottom: 14,
            }}
        >
            {/* 상단: 지갑/평가액 */}
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
                <div>
                    <div style={{fontSize: 12, opacity: 0.8}}>지갑(USDT)</div>
                    <div style={{fontSize: 22, fontWeight: 800}}>{fmtComma(wallet, 1)}</div>
                </div>
                <div>
                    <div style={{fontSize: 12, opacity: 0.8}}>평가액</div>
                    <div style={{fontSize: 22, fontWeight: 800}}>{fmtComma(equity, 1)}</div>
                </div>
            </div>

            {/* 거래 설정 */}
            <div style={{marginTop: 14}}>
                <div style={{fontWeight: 700, marginBottom: 8}}>거래 설정</div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 10,
                        fontSize: 12,
                    }}
                >
                    <div>
                        <div style={{opacity: 0.8}}>최대 진입</div>
                        <div style={{fontSize: 18, fontWeight: 800}}>
                            {pctStr(+(config?.max_effective_leverage ?? 0) * 100, 0)}
                        </div>
                    </div>
                    <div>
                        <div style={{opacity: 0.8}}>1회 진입(%)</div>
                        <div style={{fontSize: 18, fontWeight: 800}}>
                            {pctStr((+(config?.entry_percent ?? 0)) * (+(config?.leverage ?? 1)), 0)}
                        </div>
                    </div>
                    <div>
                        <div style={{opacity: 0.8}}>기본청산(%)</div>
                        <div style={{fontSize: 18, fontWeight: 800}}>
                            {pctStr((+(config?.default_exit_ma_threshold ?? -0.0005)) * 100, 2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* 포지션 헤더: 총진입 + 총 PnL */}
            <div style={{marginTop: 16, marginBottom: 8}}>
                <div style={{fontWeight: 800, marginBottom: 6}}>
                    포지션
                </div>

                <div style={{opacity: 0.8, fontSize: 13}}>
                    총진입 : {fmtComma(totals.entryUSDT, 1)} USDT
                    {" "}
                    ({totals.entryPct.toFixed(1)}%)
                </div>

                <div
                    style={{
                        marginTop: 4,
                        fontSize: 14,
                        fontWeight: 800,
                        color: pnlColor,
                    }}
                >
                    P&L : {totals.pnl >= 0 ? "+" : ""}
                    {fmtComma(totals.pnl, 2)}
                    {" "}
                    ({totals.pnlPct >= 0 ? "+" : ""}
                    {totals.pnlPct.toFixed(2)}%)
                </div>
            </div>

            {/* 포지션 테이블 */}
            <div>
                {rows.length === 0 ? (
                    <div style={{fontSize: 12, opacity: 0.7}}>보유 포지션 없음</div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            // ✅ 현재가 제거 + P&L(%) 합치기 + 진입(토글) 합치기
                            gridTemplateColumns: "10ch 7ch 9ch 11ch 16ch 18ch",
                            columnGap: 10,
                            rowGap: 6,
                            fontSize: 12,
                            alignItems: "center",
                        }}
                    >
                        {/* 헤더 */}
                        <div style={{opacity: 0.65}}>심볼</div>
                        <div style={{opacity: 0.65}}>방향</div>
                        <div style={{opacity: 0.65, textAlign: "right"}}>수량</div>
                        <div style={{opacity: 0.65, textAlign: "right"}}>평균가</div>
                        <div style={{opacity: 0.65, textAlign: "right"}}>P&amp;L(%)</div>
                        <div style={{opacity: 0.65, textAlign: "right", cursor: "pointer"}}
                             title="클릭하면 진입 표시가 USDT ↔ 수량으로 바뀝니다."
                             onClick={() => setEntryMode((m) => (m === "usdt" ? "qty" : "usdt"))}
                        >
                            진입 {entryMode === "usdt" ? "USDT(%)" : "수량(%)"}
                        </div>

                        {/* 데이터 */}
                        {rows.map((r, i) => {
                            const qtyAbs = Math.abs(+r.qty || 0);
                            const avg = +r.avg || 0;

                            const rowEntryUSDT = qtyAbs * avg;
                            const rowEntryPct = wallet > 0 ? (rowEntryUSDT / wallet) * 100 : 0;

                            const pnl = +r.pnl || 0;
                            const pnlPct = r.pnlPct != null ? +r.pnlPct : null;

                            const pnlText =
                                pnlPct == null
                                    ? `${pnl >= 0 ? "+" : ""}${fmtComma(pnl, 2)}`
                                    : `${pnl >= 0 ? "+" : ""}${fmtComma(pnl, 2)}(${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`;

                            const entryText =
                                entryMode === "usdt"
                                    ? `${fmtComma(rowEntryUSDT, 1)} (${rowEntryPct.toFixed(1)}%)`
                                    : `${fmtComma(qtyAbs, 3)} (${rowEntryPct.toFixed(1)}%)`;

                            return (
                                <React.Fragment key={`${r.sym}-${r.side}-${i}`}>
                                    <div>{r.sym}</div>

                                    <div
                                        style={{
                                            fontWeight: 700,
                                            color: r.side === "LONG" ? "#16a34a" : "#dc2626",
                                        }}
                                    >
                                        {r.side}
                                    </div>

                                    <div style={{textAlign: "right"}}>{fmtComma(r.qty, 3)}</div>
                                    <div style={{textAlign: "right"}}>{fmtComma(r.avg, 1)}</div>

                                    <div
                                        style={{
                                            textAlign: "right",
                                            color: pnl >= 0 ? "#2fe08d" : "#ff6b6b",
                                            fontWeight: 800,
                                        }}
                                    >
                                        {pnlText}
                                    </div>

                                    <div
                                        style={{
                                            textAlign: "right",
                                            cursor: "pointer",
                                            userSelect: "none",
                                            fontWeight: 800,
                                        }}
                                        title="클릭하면 진입 표시가 USDT ↔ 수량으로 바뀝니다."
                                        onClick={() => setEntryMode((m) => (m === "usdt" ? "qty" : "usdt"))}
                                    >
                                        {entryText}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}