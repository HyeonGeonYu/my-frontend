import React from "react";
import { fmtComma, buildPositionRows, calcEquityUSDT } from "../lib/tradeUtils";

export default function AssetPanel({ asset, statsBySymbol }) {
  const wallet = +(asset?.wallet?.USDT ?? 0);
  const { rows } = buildPositionRows(asset, statsBySymbol);
  const equity = calcEquityUSDT(asset, statsBySymbol);

  return (
    <div style={{  top: 12, zIndex: 10, padding: 14, borderRadius: 14, background: "#1a1a1a", marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><div style={{ fontSize:12, opacity:.8 }}>지갑(USDT)</div><div style={{ fontSize:22, fontWeight:800 }}>{fmtComma(wallet, 1)}</div></div>
        <div><div style={{ fontSize:12, opacity:.8 }}>평가액</div><div style={{ fontSize:22, fontWeight:800 }}>{fmtComma(equity, 1)}</div></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight:700, marginBottom:8 }}>포지션</div>
        {rows.length === 0 ? (
          <div style={{ fontSize:12, opacity:.7 }}>보유 포지션 없음</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"10ch 7ch 9ch 11ch 11ch 11ch 8ch", columnGap:10, rowGap:6, fontSize:12 }}>
            <div style={{ opacity:.65 }}>심볼</div><div style={{ opacity:.65 }}>방향</div>
            <div style={{ opacity:.65, textAlign:"right" }}>수량</div>
            <div style={{ opacity:.65, textAlign:"right" }}>평균가</div>
            <div style={{ opacity:.65, textAlign:"right" }}>현재가</div>
            <div style={{ opacity:.65, textAlign:"right" }}>P&amp;L</div>
            <div style={{ opacity:.65, textAlign:"right" }}>%</div>
            {rows.map((r,i)=>(
              <React.Fragment key={`${r.sym}-${r.side}-${i}`}>
                <div>{r.sym}</div>
                <div style={{ fontWeight:700, color:r.side==="LONG"?"#16a34a":"#dc2626" }}>{r.side}</div>
                <div style={{ textAlign:"right" }}>{fmtComma(r.qty,3)}</div>
                <div style={{ textAlign:"right" }}>{fmtComma(r.avg,1)}</div>
                <div style={{ textAlign:"right" }}>{r.px!=null?fmtComma(r.px,1):"—"}</div>
                <div style={{ textAlign:"right", color:r.pnl>=0?"#2fe08d":"#ff6b6b", fontWeight:700 }}>{fmtComma(r.pnl,2)}</div>
                <div style={{ textAlign:"right", color:(r.pnlPct??0)>=0?"#2fe08d":"#ff6b6b" }}>{r.pnlPct!=null?`${r.pnlPct.toFixed(2)}%`:"—"}</div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
