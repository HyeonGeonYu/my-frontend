// src/components/common/TimeframeToggle.jsx
// 차트별 타임프레임 토글(1분봉/일봉) — 페이지 일괄 토글 대체(2026-08-13).
//   각 차트 카드 우상단에 붙어 그 차트만 전환한다.
import React from "react";

export default function TimeframeToggle({ value, onChange }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, flex: "0 0 auto" }}>
      {[
        { key: "1m", label: "1분봉" },
        { key: "1D", label: "일봉" },
      ].map((tf) => {
        const on = value === tf.key;
        return (
          <button
            key={tf.key}
            onClick={() => onChange?.(tf.key)}
            title={tf.key === "1D" ? "일봉(가격 위주, 최근 365일)" : "1분봉(진입밴드 포함)"}
            style={{
              padding: "3px 10px",
              borderRadius: 8,
              border: on ? 0 : "1px solid #2a2a2a",
              background: on ? "#00ffcc" : "#1a1a1a",
              color: on ? "#000" : "#bbb",
              fontWeight: 800,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {tf.label}
          </button>
        );
      })}
    </span>
  );
}
