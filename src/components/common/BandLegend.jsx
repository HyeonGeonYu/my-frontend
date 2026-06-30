// src/components/common/BandLegend.jsx
// z-score 진입 밴드 범례: 색=방향(파랑 롱/주황 숏), 선=전략(실선 S1추세/점선 S2역추세).
// (S3/S4는 일봉 FX 채널 — 1분봉 차트엔 밴드 없음)
import React from "react";

const BLUE = "#3a9bdc";   // 롱 진입
const AMBER = "#e8913a";  // 숏 진입
const GRAY = "#9aa0a6";

function Item({ color, dashed, label }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#cfcfcf", whiteSpace: "nowrap" }}>
            <span style={{ width: 22, borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }} />
            {label}
        </span>
    );
}

export default function BandLegend() {
    return (
        <div
            style={{
                display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center",
                padding: "8px 12px", marginBottom: 12,
                background: "#141414", border: "1px solid #262626", borderRadius: 10,
            }}
        >
            <span style={{ fontSize: 11.5, fontWeight: 900, color: "#888" }}>진입 밴드 (MA ± K1·σ)</span>
            <Item color={BLUE} dashed={false} label="파랑 = 롱 진입" />
            <Item color={AMBER} dashed={false} label="주황 = 숏 진입" />
            <Item color={GRAY} dashed={false} label="실선 = S1 추세" />
            <Item color={GRAY} dashed={true} label="점선 = S2 역추세" />
            <span style={{ fontSize: 11, color: "#666", whiteSpace: "nowrap" }}>
                · 회색 점선 = MA(7일) · S3/S4(일봉 FX)는 1분봉 밴드 없음
            </span>
        </div>
    );
}
