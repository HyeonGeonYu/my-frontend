// src/components/cfd/TickerCard.jsx
import React from "react";
import { fmtComma } from "../../lib/tradeUtils";

export default function TickerCard({ symbol, stats, meta }) {
  // CFD stats shape
  const price = stats?.price ?? null;
  const ma100 = stats?.ma100 ?? null;
  const chg3mPct = stats?.chg3mPct ?? null;

  const has = typeof price === "number" && typeof ma100 === "number" && ma100 !== 0;
  const deltaPct = has ? price / ma100 - 1 : null;
  const up = deltaPct != null ? deltaPct >= 0 : null;

  // meta shape (coin과 동일 endpoint 사용)
  const thr = meta?.ma_threshold ?? null;
  const momThr = meta?.momentum_threshold ?? null;
  const exitThr = meta?.exit_threshold ?? null;
  const tCross = meta?.target_cross ?? null;
  const closesNum = meta?.closes_num ?? null;

  const maLower = has && thr != null ? ma100 * (1 - thr) : null;
  const maUpper = has && thr != null ? ma100 * (1 + thr) : null;

  const exitLower = has && exitThr != null ? ma100 * (1 - exitThr) : null;
  const exitUpper = has && exitThr != null ? ma100 * (1 + exitThr) : null;

  // CFD는 1분봉 고정이니까 closes_num은 분 기준이면 "일"로 환산
  const closesDays =
    typeof closesNum === "number" ? Math.max(1, Math.round(closesNum / 1440)) : null;

  const thrPct = thr != null ? (thr * 100).toFixed(2) : null;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "#1a1a1a",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>{symbol}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          진입&nbsp;{thrPct != null ? `±${thrPct}%` : "—"}
          <span style={{ opacity: 0.6 }}>&nbsp;·&nbsp;</span>
          급변&nbsp;{momThr != null ? (momThr * 100).toFixed(3) + "%" : "—"}
        </div>
      </div>

      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
        {price != null ? fmtComma(price, 1) : "—"}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span style={{ color: up == null ? "#aaa" : up ? "#2fe08d" : "#ff6b6b" }}>
          MA100 대비{" "}
          {deltaPct != null
            ? `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct * 100).toFixed(2)}%`
            : "--"}
        </span>

        <span style={{ opacity: 0.6 }}>·</span>

        <span style={{ color: chg3mPct == null ? "#aaa" : chg3mPct >= 0 ? "#2fe08d" : "#ff6b6b" }}>
          3분전{" "}
          {chg3mPct != null ? `${chg3mPct >= 0 ? "+" : ""}${chg3mPct.toFixed(3)}%` : "—"}
        </span>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, opacity: 0.9 }}>
        <div>
          • 진입목표 : {maLower != null ? fmtComma(maLower, 1) : "—"} /{" "}
          {maUpper != null ? fmtComma(maUpper, 1) : "—"}
        </div>
        <div>
          • 30분내 청산 : {exitUpper != null ? fmtComma(exitUpper, 1) : "—"} /{" "}
          {exitLower != null ? fmtComma(exitLower, 1) : "—"} (
          {exitThr != null ? `${(exitThr * 100).toFixed(3)}%` : "—"})
        </div>
        <div>
          • 목표 크로스: {tCross != null ? tCross : "—"}회 /{" "}
          {closesDays != null ? `${closesDays}일` : "—"}
        </div>
      </div>
    </div>
  );
}
