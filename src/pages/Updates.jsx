// src/pages/Updates.jsx
// 트레이딩봇 전략 업데이트 기록 — 날짜별 업데이트 노트 (데이터: src/lib/updateNotes.js)
import React from "react";
import { UPDATE_NOTES } from "../lib/updateNotes";
import useIsMobile from "../hooks/useIsMobile";

const TAG_COLORS = {
  "대개편": "#ff6b6b",
  S11: "#ffb86c", S12: "#7ee787", S13: "#c084fc",
  S1: "#9aa0a6", S2: "#9aa0a6",
  S3: "#ffd166", S4: "#5dcaa5",
};

function fmtDate(d) {
  try {
    const dt = new Date(`${d}T00:00:00+09:00`);
    const day = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
    return `${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()} (${day})`;
  } catch {
    return d;
  }
}

export default function Updates() {
  const isMobile = useIsMobile();
  const notes = [...UPDATE_NOTES].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div style={{ padding: isMobile ? "12px 8px" : "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc", fontSize: isMobile ? 22 : undefined }}>🛠 전략 업데이트 기록</h1>
      <p style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
        트레이딩봇 전략 변경 이력 — 최신순. 현재 라이브: <b>S11/S12/S13(1분봉책)</b> + <b>S3/S4(일봉)</b>.
      </p>

      <div style={{ maxWidth: 860, marginTop: 20, display: "grid", gap: 14 }}>
        {notes.map((n) => (
          <div
            key={n.date + n.title}
            style={{
              padding: "14px 16px", borderRadius: 14,
              background: "#171717", border: "1px solid #262626",
              boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 900, color: "#00ffcc", whiteSpace: "nowrap" }}>
                {fmtDate(n.date)}
              </span>
              <span style={{ fontSize: 15.5, fontWeight: 900 }}>{n.title}</span>
              <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>
                {(n.tags || []).map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 10, fontWeight: 800,
                      color: TAG_COLORS[t] || "#9aa0a6",
                      border: `1px solid ${(TAG_COLORS[t] || "#9aa0a6")}55`,
                      borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </span>
            </div>

            <ul style={{ margin: "10px 0 2px", paddingLeft: 18, display: "grid", gap: 5 }}>
              {(n.items || []).map((it, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: "#cfd6df" }}>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
