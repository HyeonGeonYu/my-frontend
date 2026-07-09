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
  bandsEnabled = true,
  entryLines,
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
    bandLoading,
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
    bandsEnabled,
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
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.6 }}>
          (1분봉 · 밴드 MA·σ 7일=10080봉)
        </span>
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.45 }}>
          (dayOffset: {dayOffset} · digits: {autoDigits})
        </span>
        {(() => {
          const hasK1 = k1set && Object.values(k1set).some((v) => Number.isFinite(Number(v)));
          if (!hasK1 || loading || (Array.isArray(maSd) && maSd.length > 0)) return null;
          // maSd 비어있음: 백필 진행중이면 '로딩중', 끝났는데도 없으면 '데이터 부족'
          const isLoading = !!bandLoading;
          return (
            <span
              style={{
                marginLeft: 10, fontSize: 11, fontWeight: 700,
                color: isLoading ? "#9ca3af" : "#ffb86c",
                background: isLoading ? "rgba(156,163,175,0.12)" : "rgba(255,184,108,0.12)",
                border: `1px solid ${isLoading ? "rgba(156,163,175,0.35)" : "rgba(255,184,108,0.35)"}`,
                borderRadius: 8, padding: "2px 7px",
              }}
              title={isLoading
                ? "밴드용 7일(10080봉) 히스토리를 받는 중입니다."
                : "7일 σ(10080봉) 계산에 필요한 1분봉이 부족합니다 — 휴장이거나 데이터 히스토리가 짧을 때."}
            >
              {isLoading ? "밴드 로딩중…" : "밴드: 데이터 부족"}
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
          entryLines={entryLines}
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