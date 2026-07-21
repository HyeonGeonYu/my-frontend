// src/pages/Updates.jsx
// 트레이딩봇 전략 업데이트 기록 — 날짜별 업데이트 노트 (데이터: src/lib/updateNotes.js)
import React from "react";
import { UPDATE_NOTES } from "../lib/updateNotes";
import useIsMobile from "../hooks/useIsMobile";

const TAG_COLORS = {
  "대개편": "#ff6b6b",
  S11: "#ffb86c", S12: "#7ee787", S13: "#c084fc",
  S22: "#3a9bdc", S33: "#5dcaa5",
  S1: "#9aa0a6", S2: "#9aa0a6",
  S3: "#ffd166", S4: "#5dcaa5",
  "리스크": "#f0883e", "프론트": "#00ffcc",
  "검증": "#9fb4cc", "재검증": "#9fb4cc",
  MT5: "#8ab4f8", FX: "#7ee787",
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
        트레이딩봇 전략 변경 이력 — 최신순. 현재 라이브: <b>S11 1분봉책</b> · <b>S22 4시간봉책</b> · <b>S33 일봉책</b>.
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {n.icon && (
                <span style={{ fontSize: 26, lineHeight: 1.2, flexShrink: 0 }}>{n.icon}</span>
              )}
              <div style={{ minWidth: 0 }}>
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
                {n.summary && (
                  <div style={{ marginTop: 4, fontSize: 12.5, color: "#9fb4cc", lineHeight: 1.5 }}>
                    {n.summary}
                  </div>
                )}
              </div>
            </div>

            {/* ✅ 핵심 수치 칩 */}
            {(n.stats || []).length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {n.stats.map((s, si) => (
                  <div
                    key={si}
                    style={{
                      padding: "7px 12px", borderRadius: 10,
                      background: "#101418", border: "1px solid #24303a",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#00ffcc", whiteSpace: "nowrap" }}>{s.v}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 1 }}>{s.k}</div>
                  </div>
                ))}
              </div>
            )}

            <ul style={{ margin: "10px 0 2px", paddingLeft: 4, display: "grid", gap: 5, listStyle: "none" }}>
              {(n.items || []).map((it, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: "#cfd6df" }}>
                  {it}
                </li>
              ))}
            </ul>

            {(n.tables || []).map((t, ti) => (
              <div key={ti} style={{ marginTop: 10 }}>
                {t.title && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#9fb4cc", marginBottom: 5 }}>{t.title}</div>
                )}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 420 }}>
                    <thead>
                      <tr>
                        {(t.headers || []).map((h, hi) => (
                          <th
                            key={hi}
                            style={{
                              padding: "5px 8px", textAlign: "left", fontSize: 11.5,
                              color: "#00ffcc", fontWeight: 900,
                              borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(t.rows || []).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((c, ci) => (
                            <td
                              key={ci}
                              style={{
                                padding: "5px 8px", fontSize: 12, color: "#cfd6df",
                                borderBottom: "1px solid #1f1f1f", verticalAlign: "top",
                                fontWeight: ci === 0 ? 800 : 400,
                                whiteSpace: ci === 0 ? "nowrap" : "normal",
                              }}
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
