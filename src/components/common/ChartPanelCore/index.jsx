// src/components/common/ChartPanelCore/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

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
    ma100,
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

    // 창 리사이즈에서도 한번 더 안전하게
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
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
              zIndex: 5,
              fontWeight: 800,
              borderRadius: 12,
              backdropFilter: "blur(2px)",
            }}
          >
            로딩중...
          </div>
        ) : null}

        <ChartView
          // ✅ 핵심: 숫자 width를 내려줘야 ChartView가 resize 가능
          width={chartWidth}
          height={height}
          tickFormatter={tickFormatter}
          displayCandles={displayCandles}
          ma100={ma100}
          thr={thr}
          markers={markers}
          priceScale={autoDigits}
          visibleRange={visibleRange}
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