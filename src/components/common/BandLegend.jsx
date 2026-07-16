// src/components/common/BandLegend.jsx
// z-score 진입 밴드 범례: 색=방향(파랑 롱/주황 숏), 선=전략(실선 추세/점선 역추세).
// 1분봉=S11(3패밀리), 4시간=S22(별도), 일봉=S33(추세/역추세).
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

export default function BandLegend({ mode = "1m" }) {
    const daily = mode === "1D";
    return (
        <div
            style={{
                display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center",
                padding: "8px 12px", marginBottom: 12,
                background: "#141414", border: "1px solid #262626", borderRadius: 10,
            }}
        >
            <span style={{ fontSize: 11.5, fontWeight: 900, color: "#888" }}>
                진입 밴드 (MA ± K1·σ{daily ? ", MA창 심볼·방향별 60~200일" : ", MA창 심볼별 6~24시간"})
            </span>
            <Item color={BLUE} dashed={false} label="파랑 = 롱 진입" />
            <Item color={AMBER} dashed={false} label="주황 = 숏 진입" />
            <Item color={GRAY} dashed={false} label={daily ? "실선 = S33 추세" : "실선 = S11 z추세"} />
            <Item color={GRAY} dashed={true} label={daily ? "점선 = S33 역추세" : "점선 = S11 z역추세"} />
            {!daily && <Item color="#c084fc" dashed={true} label="보라 점선 = 급락페이드 트리거(M분 전 가격 −X%)" />}
            <span style={{ fontSize: 11.5, color: "#cfcfcf", whiteSpace: "nowrap" }}>
                신호: <span style={{ color: BLUE }}>▲</span>/<span style={{ color: AMBER }}>▼</span> 진입(채움) · 테두리만 = 청산 · 탭하면 상세
            </span>
            <span style={{ fontSize: 11, color: "#666", whiteSpace: "nowrap" }}>
                {daily
                    ? "· 회색 점선 = MA(최단 창) · 각 밴드는 자기 MA창 기준"
                    : "· 회색 점선 = MA(최단 창) · 가격이 보라선 아래로 떨어지면 페이드 롱 트리거"}
            </span>
        </div>
    );
}
