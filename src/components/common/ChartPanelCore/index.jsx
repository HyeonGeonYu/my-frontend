// src/components/common/ChartPanelCore/index.jsx
import React, { useEffect, useRef, useState } from "react";

import ChartView from "../ChartView";
import SignalNotesPanel from "../SignalNotesPanel";
import { fmtKSTHour } from "../../../lib/tradeUtils";

import useCoreSignals from "./useCoreSignals";
import useCoreCandles from "./useCoreCandles";

export default function ChartPanelCore({
  source,
  symbol,
  dayOffset,
  anchorEndUtcSec,

  // UI/Behavior
  bounds = { min: -7, max: 0 },
  width,
  height = 320,

  thr,
  k1set,
  crossTimes,

  // formatters
  tickFormatter = (tsSec) => fmtKSTHour(tsSec),

  // ✅ override only (없으면 rows 기반 auto)
  priceScale, // number | undefined

  // callbacks
  onBounds,
  onStats,
}) {
  const { ensureSignals, getMarkersForWindow, getNotesForWindow } =
    useCoreSignals({ source, dayOffset, crossTimes });

  const {
    loading,
    notesView,
    displayCandles,
    maSd,
    markers,
    visibleRange,
    autoDigits,
    getPriceText,
  } = useCoreCandles({
    source,
    symbol,
    dayOffset,
    anchorEndUtcSec,
    bounds,
    priceScale,
    ensureSignals,
    getMarkersForWindow,
    getNotesForWindow,
    onBounds,
    onStats,
  });

  // ✅ container width tracking
  const wrapRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(null);

  const fixedWidth = typeof width === "number" ? width : null;

  useEffect(() => {
    // width를 숫자로 강제 지정한 경우는 관측할 필요 없음
    if (fixedWidth) {
      setMeasuredWidth(fixedWidth);
      return;
    }

    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.floor(el.clientWidth || 0);
      if (w > 0) setMeasuredWidth(w);
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [fixedWidth]);

  const chartWidth = fixedWidth ?? measuredWidth ?? undefined;

  return (
    <div style={{ marginBottom: 28, minWidth: 0 }}>
      <div style={{ fontSize: 20, opacity: 0.8, marginBottom: 6 }}>
        {symbol}
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.65 }}>
          (dayOffset: {dayOffset})
        </span>
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.5 }}>
          (digits: {autoDigits})
        </span>
        {(() => {
          const hasK1 = k1set && Object.values(k1set).some((v) => Number.isFinite(Number(v)));
          const noBand = hasK1 && !loading && Array.isArray(maSd) && maSd.length === 0;
          if (!noBand) return null;
          return (
            <span
              style={{
                marginLeft: 10, fontSize: 11, fontWeight: 700,
                color: "#ffb86c", background: "rgba(255,184,108,0.12)",
                border: "1px solid rgba(255,184,108,0.35)", borderRadius: 8, padding: "2px 7px",
              }}
              title="7일 σ(10080봉) 계산에 필요한 1분봉이 부족합니다 — 휴장(주말/야간)이거나 데이터 히스토리가 짧을 때 발생."
            >
              밴드: 데이터 부족(휴장/히스토리)
            </span>
          );
        })()}
      </div>

      {/* ✅ 여기 ref를 달아야 실제 폭 측정 가능 */}
      <div ref={wrapRef} style={{ width: fixedWidth ?? "100%", maxWidth: "100%", position: "relative", minWidth: 0 }}>
        {loading ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              fontWeight: 800,
              borderRadius: 12,
              backdropFilter: "blur(2px)",
            }}
          >
            로딩중...
          </div>
        ) : null}

        <ChartView
          width={chartWidth}
          height={height}
          tickFormatter={tickFormatter}
          displayCandles={displayCandles}
          maSd={maSd}
          k1set={k1set}
          markers={markers}
          priceScale={autoDigits}
          visibleRange={visibleRange}
          loading={loading}
        />

        <SignalNotesPanel
          symbol={symbol}
          notes={notesView}
          getPriceText={getPriceText}
          collapseKey={`${symbol}:${dayOffset}`}
        />
      </div>
    </div>
  );
}