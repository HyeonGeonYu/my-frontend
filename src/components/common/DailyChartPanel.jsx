// src/components/common/DailyChartPanel.jsx
// 일봉(1D) 차트 패널 — 캔들 + 90일 MA·σ 기반 S3/S4 진입밴드(MA±K1·σ).
// 복잡한 useCoreCandles(1분봉 전용)를 건드리지 않고 ChartView를 재사용한다.
import React, { useEffect, useMemo, useRef, useState } from "react";

import ChartView from "./ChartView";
import { calcRollingMaSd, fetchSignals, isDailySignal, buildSignalAnnotations } from "../../lib/tradeUtils";
import { k1setFor } from "../../lib/strategyParams";
import { rowsToBars, inferDigitsFromRows } from "./ChartPanelCore/coreUtils";

const DAY_SEC = 86400;
const BAND_WIN = 90; // 일봉 MA·σ 창 = 90일 (봇 S3/S4와 동일)

export default function DailyChartPanel({
  source,
  symbol,
  anchorEndUtcSec,
  dayOffset = 0,
  lookbackDays = 365,
  entryLines,
  signalNames,
  width,
  height = 320,
}) {
  const [bars, setBars] = useState([]);
  const [maSd, setMaSd] = useState([]); // 90일 롤링 {time, ma, sd}
  const [markers, setMarkers] = useState([]); // 일봉(S3/S4) 신호 마커
  const [range, setRange] = useState(null);
  const [digits, setDigits] = useState(2);
  const [loading, setLoading] = useState(false);

  // S3(추세)/S4(역추세) 일봉 밴드 K1 — STRAT_PARAMS 단일 소스에서 파생.
  const k1set = useMemo(() => k1setFor(symbol, "1D"), [symbol]);

  const wrapRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(null);

  useEffect(() => {
    if (!source || !Number.isFinite(Number(anchorEndUtcSec))) return;
    const ac = new AbortController();
    setLoading(true);
    setBars([]);
    setMaSd([]);
    setMarkers([]);

    (async () => {
      try {
        const sym = String(symbol || "").toUpperCase();
        const end = Number(anchorEndUtcSec) + Number(dayOffset) * DAY_SEC;
        const start = end - lookbackDays * DAY_SEC;
        // 90일 σ에 창 앞쪽 90봉 필요 → maBuf 넉넉히(일봉 단위). interval "D".
        const rows = await source.fetchWindow(
          sym, "D", start, end, ac.signal, BAND_WIN + 10
        );
        if (ac.signal.aborted) return;

        // CFD with-gaps 등에서 빈 OHLC(갭) 행이 올 수 있어 유효 봉만 사용.
        const all = rowsToBars(rows).filter(
          (b) => Number.isFinite(b.close) && Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low)
        );
        const ms = calcRollingMaSd(all, BAND_WIN);
        const barsVisible = all.filter((b) => b.time >= start && b.time < end);

        setDigits(inferDigitsFromRows(rows, 2));
        setBars(barsVisible);
        setMaSd(ms.filter((p) => p.time >= start && p.time < end));
        setRange({ start, end });

        // 일봉 신호(S3/S4) 마커 — 지정 네임스페이스 스트림에서 읽어 일봉봉에 스냅.
        const names = Array.isArray(signalNames) ? signalNames : (signalNames ? [signalNames] : []);
        if (names.length && barsVisible.length) {
          const lists = await Promise.all(
            names.map((nm) => fetchSignals(sym, nm, Math.min(lookbackDays, 250)).catch(() => []))
          );
          if (ac.signal.aborted) return;
          const daily = lists.flat().filter(isDailySignal);
          const built = buildSignalAnnotations(daily).markers || [];
          const barTimes = barsVisible.map((b) => b.time).sort((a, b) => a - b);
          const snap = (t) => { let c = null; for (const bt of barTimes) { if (bt <= t) c = bt; else break; } return c; };
          setMarkers(
            built.map((m) => ({ ...m, time: snap(m.time) })).filter((m) => m.time != null)
          );
        }
      } catch (e) {
        if (e?.name !== "AbortError") console.warn("[DailyChartPanel] load failed:", symbol, e);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [source, symbol, anchorEndUtcSec, dayOffset, lookbackDays, signalNames]);

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
          (일봉 · MA90·σ90 · S3/S4 밴드 · 최근 {lookbackDays}일)
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
          maSd={maSd}
          k1set={k1set}
          entryLines={entryLines}
          visibleRange={range}
          intervalSec={DAY_SEC}
          priceScale={digits}
          markers={markers}
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
