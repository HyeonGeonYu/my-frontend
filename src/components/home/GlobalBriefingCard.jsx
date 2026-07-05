// src/components/home/GlobalBriefingCard.jsx
// 전일 글로벌 브리핑 — 각국 뉴스요약을 종합해 뽑은 핵심 뉴스 5개 (youtube_data.global_briefing).
// News_scrap 전일브리핑.py가 매일 06:55 persist 직후 발행. 없으면 렌더 안 함.
import React from "react";

const CAT_COLOR = {
  "지정학": "#e8913a",
  "경제·시장": "#3a9bdc",
  "정치": "#c084fc",
  "산업·기술": "#2fe08d",
  "사회·기타": "#9aa0a6",
};

const COUNTRY_KO = {
  Korea: "한국", USA: "미국", Japan: "일본", China: "중국",
  Germany: "독일", UK: "영국", India: "인도", HongKong: "홍콩",
};

function fmtDate(d) {
  // "2026-07-07" → "7/7 (화)"
  try {
    const dt = new Date(`${d}T00:00:00+09:00`);
    const day = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
    return `${dt.getMonth() + 1}/${dt.getDate()} (${day})`;
  } catch {
    return d;
  }
}

export default function GlobalBriefingCard({ briefing }) {
  // /youtube 패스스루가 파싱된 객체를 주지만, 문자열로 올 가능성도 방어
  let b = briefing;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch { return null; }
  }
  const items = Array.isArray(b?.items) ? b.items : [];
  if (!items.length) return null;

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto 24px",
        padding: "16px 18px",
        borderRadius: 14,
        background: "#111823",
        border: "1px solid #1f2c3f",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#e8f1ff" }}>
          📌 전일 글로벌 브리핑
        </div>
        <div style={{ fontSize: 12.5, color: "#7d93b2" }}>
          {b.date ? `${fmtDate(b.date)} 각국 보도 종합 · 핵심 ${items.length}선` : "각국 보도 종합"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((it, i) => {
          const cat = String(it.category || "");
          const catColor = CAT_COLOR[cat] || "#9aa0a6";
          const countries = Array.isArray(it.countries) ? it.countries : [];
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div
                style={{
                  flex: "0 0 auto",
                  width: 22, height: 22, borderRadius: 999,
                  background: "#1c2a3f", color: "#7fb3e8",
                  fontSize: 12, fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {it.rank ?? i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#e6edf6", lineHeight: 1.4 }}>
                  {it.title}
                  {cat && (
                    <span
                      style={{
                        marginLeft: 8, fontSize: 10, fontWeight: 800,
                        color: catColor, border: `1px solid ${catColor}55`,
                        borderRadius: 999, padding: "1px 7px",
                        verticalAlign: "middle", whiteSpace: "nowrap",
                      }}
                    >
                      {cat}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "#aebdd0", lineHeight: 1.55, marginTop: 3 }}>
                  {it.summary}
                </div>
                {countries.length > 0 && (
                  <div style={{ fontSize: 10.5, color: "#66788f", marginTop: 4 }}>
                    보도: {countries.map((c) => COUNTRY_KO[c] || c).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
