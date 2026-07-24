// src/components/common/EntryStrategyChips.jsx
// 보유 포지션 entries를 전략별 칩으로 표시 — "1분 z추세 ×2 · 4h 페이드 ×1" 식.
//   sigMap(entry_signal_id→전략)이 아직 로딩 전이면 아무것도 안 그림.
import React from "react";
import { groupEntriesByStrategy } from "../../lib/entryStrategies";
import { fmtComma, fmtKSTMonth } from "../../lib/tradeUtils";

export default function EntryStrategyChips({ entries, sigMap, fontSize = 10.5 }) {
  if (!sigMap || !Array.isArray(entries) || entries.length === 0) return null;
  const groups = groupEntriesByStrategy(entries, sigMap);
  if (!groups.length) return null;

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, verticalAlign: "middle" }}>
      {groups.map((g) => (
        <span
          key={g.label}
          title={`${g.label} — ${g.count}게임 · 수량 ${fmtComma(g.qty, 3)} · 평균가 ${fmtComma(g.avg, null)}${g.lastTs ? ` · 최근진입 ${fmtKSTMonth(Math.floor(g.lastTs / 1000))}` : ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "1px 7px",
            borderRadius: 999,
            background: "#141414",
            border: `1px solid ${g.color}55`,
            color: "#cfcfcf",
            fontSize,
            fontWeight: 800,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: g.color, flex: "0 0 auto" }} />
          {g.label}
          {g.count > 1 && <span style={{ opacity: 0.75 }}>×{g.count}</span>}
        </span>
      ))}
    </span>
  );
}
