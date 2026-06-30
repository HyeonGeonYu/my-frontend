// src/components/common/SymbolStrategyTag.jsx
// 차트 위에 그 심볼이 어떤 전략(S1~S4)에 속하고 파라미터(K/B/쿨다운)가 얼만지 한 줄로 표기.
import React from "react";
import { STRAT_PARAMS, STRAT_META, fmtParam } from "../../lib/strategyParams";

export default function SymbolStrategyTag({ symbol }) {
  const p = STRAT_PARAMS[String(symbol || "").toUpperCase()];
  if (!p) return null;

  const parts = [];
  for (const key of ["s1", "s2", "s3", "s4"]) {
    const s = p[key];
    if (!s) continue;
    const dirs = [];
    if (s.L) dirs.push(`L ${fmtParam(s.L)}`);
    if (s.S) dirs.push(`S ${fmtParam(s.S)}`);
    if (dirs.length) parts.push({ key, dirs });
  }
  if (!parts.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 10.5, lineHeight: 1.5, marginBottom: 4 }}>
      {parts.map(({ key, dirs }) => (
        <span key={key} style={{ color: STRAT_META[key].color, whiteSpace: "nowrap" }}>
          <b>{STRAT_META[key].label}</b>{" "}
          <span style={{ color: "#cfcfcf" }}>{dirs.join(" / ")}</span>
        </span>
      ))}
      <span style={{ color: "#666", fontSize: 9.5 }}>· K1/B/쿨다운</span>
    </div>
  );
}
