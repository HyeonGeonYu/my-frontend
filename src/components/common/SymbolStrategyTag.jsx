// src/components/common/SymbolStrategyTag.jsx
// 차트 위에 그 심볼의 전략(S11/S12/S13·S3/S4)·파라미터를 표기.
// ✅ 차트 밴드와 동일한 시각 언어: 색=방향(파랑 롱/주황 숏), 선=전략(실선 추세/점선 역추세).
//    현재 타임프레임에 없는 전략(1m이면 S3/S4, 일봉이면 S11~S13)은 흐리게.
//    S13(급락페이드)은 밴드가 없어 선 견본 대신 ↘ 아이콘.
import React from "react";
import { STRAT_PARAMS, STRAT_META, fmtParam, fmtFade, maxHoldFor } from "../../lib/strategyParams";

const BLUE = "#3a9bdc";   // 롱 진입 (BandLegend·ChartView 밴드와 동일)
const AMBER = "#e8913a";  // 숏 진입

// 밴드 선 견본: 방향색 + 전략 선스타일
function Swatch({ color, dashed }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 16,
        verticalAlign: "middle",
        borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        marginRight: 3,
      }}
    />
  );
}

const MINUTE_KEYS = new Set(["s11", "s12", "s13"]);

export default function SymbolStrategyTag({ symbol, timeframe }) {
  const p = STRAT_PARAMS[String(symbol || "").toUpperCase()];
  if (!p) return null;

  const rows = [];
  for (const key of ["s11", "s12", "s13", "s3", "s4"]) {
    const s = p[key];
    if (!s || (!s.L && !s.S)) continue;
    rows.push({ key, s });
  }
  if (!rows.length) return null;

  // 현재 차트에 그려지는 전략인지 (1m=S11~S13, 1D=S3/S4). timeframe 없으면 전부 강조.
  const activeOn = (key) => {
    if (timeframe === "1m") return MINUTE_KEYS.has(key);
    if (timeframe === "1D") return key === "s3" || key === "s4";
    return true;
  };
  const dashedOf = (key) => key === "s12" || key === "s4"; // 역추세=점선 (차트와 동일)

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 10.5, lineHeight: 1.6, marginBottom: 4 }}>
      {rows.map(({ key, s }) => {
        const active = activeOn(key);
        const isFade = key === "s13";
        const dashed = dashedOf(key);
        const hold = maxHoldFor(symbol, key);
        return (
          <span key={key} style={{ whiteSpace: "nowrap", opacity: active ? 1 : 0.38 }}>
            <b style={{ color: "#cfcfcf" }}>{STRAT_META[key].label}</b>{" "}
            {s.L && (
              <span style={{ color: BLUE }}>
                {isFade ? <span style={{ marginRight: 2 }}>↘</span> : <Swatch color={BLUE} dashed={dashed} />}
                롱 {isFade ? fmtFade(s.L) : fmtParam(s.L)}
              </span>
            )}
            {s.L && s.S && <span style={{ color: "#555" }}> · </span>}
            {s.S && (
              <span style={{ color: AMBER }}>
                {isFade ? <span style={{ marginRight: 2 }}>↗</span> : <Swatch color={AMBER} dashed={dashed} />}
                숏 {isFade ? fmtFade(s.S) : fmtParam(s.S)}
              </span>
            )}
            {hold && <span style={{ color: "#8a8a8a" }}> 보유≤{hold}</span>}
          </span>
        );
      })}
      <span style={{ color: "#666", fontSize: 9.5 }}>· K1/B/쿨다운·MA창 · 색=방향(파랑 롱/주황 숏) · 실선=추세/점선=역추세 · S13=수익률 트리거(밴드 없음)</span>
    </div>
  );
}
