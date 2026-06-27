// src/components/common/DailyChartPanel.jsx
// 일봉(1D) 차트 패널 — 가격 위주(캔들 + 일봉 MA). z-score 진입밴드는 1분봉 전용이라 여기엔 없음.
// 복잡한 useCoreCandles(1분봉 전용)를 건드리지 않고 ChartView를 재사용한다.
import React, { useEffect, useRef, useState } from "react";

import ChartView from "./ChartView";
import { calcSMA } from "../../lib/tradeUtils";
import { rowsToBars, inferDigitsFromRows } from "./ChartPanelCore/coreUtils";

const DAY_SEC = 86400;

export default function DailyChartPanel({
  source,
  symbol,
  anchorEndUtcSec,
  dayOffset = 0,
  lookbackDays = 365,
  maWin = 60,
  width,
  height = 320,
}) {
  const [bars, setBars] = useState([]);
  const [ma, setMa] = useState([]);
  const [range, setRange] = useState(null);
  const [digits, setDigits] = useState(2);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(null);

  useEffect(() => {
    if (!source || !Number.isFinite(Number(anchorEndUtcSec))) return;
    const ac = new AbortController();
    setLoading(true);
    setBars([]);
    setMa([]);

    (async () => {
      try {
        const end = Number(anchorEndUtcSec) + Number(dayOffset) * DAY_SEC;
        const start = end - lookbackDays * DAY_SEC;
        // maBuf = MA 창만큼 더(일봉 단위). interval "D".
        const rows = await source.fetchWindow(
          String(symbol || "").toUpperCase(), "D", start, end, ac.signal, maWin + 5
        );
        if (ac.signal.aborted) return;

        const all = rowsToBars(rows);
        const maAll = calcSMA(all, maWin);

        setDigits(inferDigitsFromRows(rows, 2));
        setBars(all.filter((b) => b.time >= start && b.time < end));
        setMa(maAll.filter((p) => p.time >= start && p.time < end));
        setRange({ start, end });
      } catch (e) {
        if (e?.name !== "AbortError") console.warn("[DailyChartPanel] load failed:", symbol, e);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [source, symbol, anchorEndUtcSec, dayOffset, lookbackDays, maWin]);

  // 컨테이너 폭 추적 (ChartPanelCore와 동일 정책)
  const fixedWidth = typeof width === "number" ? width : null;
  useEffect(() => {
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
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedWidth]);

  const chartWidth = fixedWidth ?? measuredWidth ?? undefined;

  return (
    <div style={{ marginBottom: 28, minWidth: 0 }}>
      <div style={{ fontSize: 20, opacity: 0.8, marginBottom: 6 }}>
        {symbol}
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.6 }}>
          (일봉 · MA{maWin} · 최근 {lookbackDays}일)
        </span>
      </div>

      <div ref={wrapRef} style={{ width: fixedWidth ?? "100%", maxWidth: "100%", position: "relative", minWidth: 0 }}>
        {loading ? (
          <div
            style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 200, fontWeight: 800, borderRadius: 12, backdropFilter: "blur(2px)",
            }}
          >
            로딩중...
          </div>
        ) : null}

        <ChartView
          width={chartWidth}
          height={height}
          displayCandles={bars}
          ma100={ma}
          visibleRange={range}
          intervalSec={DAY_SEC}
          priceScale={digits}
          markers={[]}
          loading={loading}
          tickFormatter={(tsSec) => {
            const d = new Date(Number(tsSec) * 1000);
            return `${d.getFullYear() % 100}/${d.getMonth() + 1}/${d.getDate()}`;
          }}
        />
      </div>
    </div>
  );
}
