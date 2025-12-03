// src/components/AssetPanel.jsx
import React from "react";
import { fmtComma, buildPositionRows, calcEquityUSDT } from "../lib/tradeUtils";

// 퍼센트 출력 유틸
const pctStr = (v, digits = 2) =>
  v == null || Number.isNaN(+v) ? "—" : `${(+v).toFixed(digits)}%`;

export default function AssetPanel({ asset, statsBySymbol, config }) {
  const wallet = +(asset?.wallet?.USDT ?? 0);
  const { rows } = buildPositionRows(asset, statsBySymbol); // rows: [{ sym, side, qty, avg, px, pnl, pnlPct }, ...]
  const equity = calcEquityUSDT(asset, statsBySymbol);

  // 헤더에 쓰는 "총진입 %" = Σ(|qty|*avg) / 지갑 * 100
  const totalEntryNotional = rows.reduce((acc, r) => {
    const qty = Math.abs(+r.qty || 0);
    const avg = +r.avg || 0;
    return acc + qty * avg;
  }, 0);
  const totalEntryPct = wallet > 0 ? (totalEntryNotional / wallet) * 100 : 0;

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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>지갑(USDT)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {fmtComma(wallet, 1)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>평가액</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {fmtComma(equity, 1)}
          </div>
        </div>
      </div>

      {/* 거래 설정 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>거래 설정</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ opacity: 0.8 }}>최대 진입</div>
            {/* 25 → 2500% 만 표기 */}
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {pctStr(
                +(config?.max_effective_leverage ?? 0) * 100,
                0
              )}
            </div>
          </div>
          <div>
            <div style={{ opacity: 0.8 }}>1회 진입(%)</div>
            {/* entry_percent * leverage 를 퍼센트로 표기 (예: 5*50=250%) */}
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {pctStr(
                (+(config?.entry_percent ?? 0)) *
                  (+(config?.leverage ?? 1)),
                0
              )}
            </div>
          </div>
          <div>
            <div style={{ opacity: 0.8 }}>기본청산(%)</div>
            {/* 소수점 2자리까지 */}
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {pctStr(
                (+(config?.default_exit_ma_threshold ?? -0.0005)) *
                  100,
                2
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 포지션 헤더: 총진입 %만 표기 */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>
          포지션{" "}
          <span style={{ opacity: 0.7 }}>
            (
            {`총진입 : ${fmtComma(
              totalEntryNotional,
              1
            )} USDT (${totalEntryPct.toFixed(1)}%)`}
            )
          </span>
        </div>
      </div>

      {/* 포지션 테이블 */}
      <div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            보유 포지션 없음
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "10ch 7ch 9ch 11ch 11ch 11ch 8ch 12ch 11ch",
              columnGap: 10,
              rowGap: 6,
              fontSize: 12,
            }}
          >
            {/* 헤더 */}
            <div style={{ opacity: 0.65 }}>심볼</div>
            <div style={{ opacity: 0.65 }}>방향</div>
            <div style={{ opacity: 0.65, textAlign: "right" }}>수량</div>
            <div style={{ opacity: 0.65, textAlign: "right" }}>평균가</div>
            <div style={{ opacity: 0.65, textAlign: "right" }}>현재가</div>
            <div style={{ opacity: 0.65, textAlign: "right" }}>P&amp;L</div>
            <div style={{ opacity: 0.65, textAlign: "right" }}>%</div>
            <div style={{ opacity: 0.65, textAlign: "right" }}>
              진입 USDT
            </div>
            <div style={{ opacity: 0.65, textAlign: "right" }}>
              진입 %
            </div>

            {/* 데이터 */}
            {rows.map((r, i) => {
              const qty = Math.abs(+r.qty || 0);
              const avg = +r.avg || 0;
              const rowEntryUSDT = qty * avg; // 평균가*수량
              const rowEntryPct =
                wallet > 0 ? (rowEntryUSDT / wallet) * 100 : 0;

              return (
                <React.Fragment
                  key={`${r.sym}-${r.side}-${i}`}
                >
                  <div>{r.sym}</div>
                  <div
                    style={{
                      fontWeight: 700,
                      color:
                        r.side === "LONG"
                          ? "#16a34a"
                          : "#dc2626",
                    }}
                  >
                    {r.side}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {fmtComma(r.qty, 3)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {fmtComma(r.avg, 1)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {r.px != null ? fmtComma(r.px, 1) : "—"}
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      color:
                        r.pnl >= 0 ? "#2fe08d" : "#ff6b6b",
                      fontWeight: 700,
                    }}
                  >
                    {fmtComma(r.pnl, 2)}
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      color:
                        (r.pnlPct ?? 0) >= 0
                          ? "#2fe08d"
                          : "#ff6b6b",
                    }}
                  >
                    {r.pnlPct != null
                      ? `${r.pnlPct.toFixed(2)}%`
                      : "—"}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {fmtComma(rowEntryUSDT, 1)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {`${rowEntryPct.toFixed(1)}%`}
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
