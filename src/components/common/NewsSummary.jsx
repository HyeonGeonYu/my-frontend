import React, { useState } from "react";

/* -------------------------------------------------------------------------- */
/* 옛 텍스트 요약(summary_result) -> 구조화 items 파서                          */
/* 새 데이터는 summary_items(구조화)를 그대로 쓰고, 과거 데이터만 이 파서로 폴백  */
/* 기대 포맷:                                                                   */
/*   1. 🗞️ 제목                                                                 */
/*   ✅ 한줄 요약: ...                                                           */
/*   🔥 주요 쟁점:                                                              */
/*       1) ...                                                                 */
/*       2) ...                                                                 */
/* -------------------------------------------------------------------------- */
const ITEM_START_RE = /^\s*(\d+)\s*\.\s*(?:🗞️|📰)?\s*(.*\S)?\s*$/;
const SUMMARY_RE = /^\s*✅?\s*한\s*줄\s*요약\s*[:：]\s*(.*)$/;
const POINTS_HEADER_RE = /^\s*🔥?\s*주요\s*쟁점\s*[:：]?\s*$/;
const POINT_RE = /^\s*(?:\(?\d+\s*[).]|[-•·*])\s*(.+\S)\s*$/;

export function parseSummaryText(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text.replace(/\r/g, "").split("\n");
  const items = [];
  let cur = null;
  let section = null; // "points" = 주요 쟁점 목록 안

  const push = () => {
    if (cur && (cur.title || cur.summary || cur.points.length)) items.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const mItem = line.match(ITEM_START_RE);
    // 아이템 시작은 "N." (마침표) + 🗞️/📰 가 있는 줄로 판단.
    // 주요 쟁점은 "N)" (괄호)라서 여기에 걸리지 않음.
    if (mItem && /🗞️|📰/.test(line)) {
      push();
      cur = {
        rank: Number(mItem[1]) || items.length + 1,
        title: (mItem[2] || "").replace(/^\[|\]$/g, "").trim(),
        summary: "",
        points: [],
      };
      section = null;
      continue;
    }

    if (!cur) continue; // 첫 아이템 전 잡소리는 무시

    const mSum = line.match(SUMMARY_RE);
    if (mSum) {
      cur.summary = mSum[1].trim();
      section = null;
      continue;
    }

    if (POINTS_HEADER_RE.test(line)) {
      section = "points";
      continue;
    }

    const mPoint = line.match(POINT_RE);
    if (mPoint) {
      cur.points.push(mPoint[1].trim());
      section = "points";
      continue;
    }

    // 마커 없는 줄: 직전 맥락에 이어붙임
    if (section === "points" && cur.points.length) {
      cur.points[cur.points.length - 1] += " " + line;
    } else if (cur.summary) {
      cur.summary += " " + line;
    } else if (!cur.title) {
      cur.title = line;
    } else {
      cur.summary = line;
    }
  }
  push();
  return items;
}

/* -------------------------------------------------------------------------- */
/* 단일 뉴스 아코디언 항목                                                      */
/* -------------------------------------------------------------------------- */
function SummaryItem({ item, index }) {
  const [open, setOpen] = useState(false);

  const rank = item.rank ?? index + 1;
  const title = item.title || `뉴스 ${rank}`;
  const points = Array.isArray(item.points) ? item.points : [];
  const hasDetail = !!item.summary || points.length > 0;

  return (
    <div
      style={{
        border: "1px solid #3a3a3a",
        borderRadius: "8px",
        marginBottom: "6px",
        backgroundColor: "#222",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 10px",
          background: "none",
          border: "none",
          color: "#fff",
          textAlign: "left",
          cursor: hasDetail ? "pointer" : "default",
          fontSize: "13px",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: "#00ffcc22",
            border: "1px solid #00ffcc",
            color: "#00ffcc",
            fontSize: "11px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {rank}
        </span>
        <span style={{ flex: 1, lineHeight: 1.35 }}>{title}</span>
        {hasDetail && (
          <span style={{ flexShrink: 0, color: "#888", fontSize: "11px" }}>
            {open ? "▲" : "▼"}
          </span>
        )}
      </button>

      {open && hasDetail && (
        <div style={{ padding: "0 10px 10px 38px", fontSize: "12.5px" }}>
          {item.summary && (
            <div style={{ color: "#9fdcff", marginBottom: points.length ? "6px" : 0 }}>
              ✅ {item.summary}
            </div>
          )}
          {points.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: "16px", color: "#ddd" }}>
              {points.map((p, i) => (
                <li key={i} style={{ marginBottom: "3px", lineHeight: 1.4 }}>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 뉴스 요약 아코디언                                                           */
/* - items(구조화) 우선, 없으면 summaryText(옛 텍스트)를 파싱해서 폴백           */
/* - 둘 다 비면 emptyText / 파싱 실패 시 원문 텍스트 그대로 표시                 */
/* -------------------------------------------------------------------------- */
export default function NewsSummary({ items: itemsProp, summaryText, emptyText = "요약 없음" }) {
  const items =
    Array.isArray(itemsProp) && itemsProp.length
      ? itemsProp
      : parseSummaryText(summaryText);

  if (items.length > 0) {
    return (
      <div>
        {items.map((item, idx) => (
          <SummaryItem key={idx} item={item} index={idx} />
        ))}
      </div>
    );
  }

  if (summaryText) {
    // 파싱이 안 되는 옛 포맷은 원문 텍스트 그대로 폴백
    return (
      <div style={{ fontSize: "13px", whiteSpace: "pre-wrap", color: "#ddd" }}>
        {summaryText}
      </div>
    );
  }

  return <div style={{ fontSize: "13px", color: "#888" }}>{emptyText}</div>;
}
