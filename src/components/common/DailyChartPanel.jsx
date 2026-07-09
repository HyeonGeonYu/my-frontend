// src/components/common/DailyChartPanel.jsx
// 일봉(1D) 차트 패널 — 캔들 + S3/S4 진입밴드(MA±K1·σ).
// ✅ HANDOFF_MASTER v2: MA창(win)이 심볼×방향별(60~200일) → 방향별로 각자 win의 롤링 MA·σ 계산해
//    ChartView bandData로 주입. 복잡한 useCoreCandles(1분봉 전용)를 건드리지 않고 ChartView 재사용.
import React, { useEffect, useMemo, useRef, useState } from "react";

import ChartView from "./ChartView";
import { calcRollingMaSd, fetchSignals, isDailySignal, buildSignalAnnotations } from "../../lib/tradeUtils";
import { dailyBandSpec } from "../../lib/strategyParams";
import { rowsToBars, inferDigitsFromRows } from "./ChartPanelCore/coreUtils";

const DAY_SEC = 86400;

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
  const [bandData, setBandData] = useState(null); // {ma, s1Long, s1Short, s2Long, s2Short}
  const [markers, setMarkers] = useState([]); // 일봉(S3/S4) 신호 마커
  const [range, setRange] = useState(null);
  const [digits, setDigits] = useState(2);
  const [loading, setLoading] = useState(false);

  // S3/S4 방향별 {k, w} — STRAT_PARAMS 단일 소스에서 파생.
  const spec = useMemo(() => dailyBandSpec(symbol), [symbol]);
  const maxWin = useMemo(
    () => Math.max(90, ...Object.values(spec || {}).map((d) => d.w || 90)),
    [spec]
  );
  const winsLabel = useMemo(() => {
    const ws = [...new Set(Object.values(spec || {}).map((d) => d.w || 90))].sort((a, b) => a - b);
    return ws.length ? `MA${ws.join("/")}` : "MA—";
  }, [spec]);

  const wrapRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(null);

  useEffect(() => {
    if (!source || !Number.isFinite(Number(anchorEndUtcSec))) return;
    const ac = new AbortController();
    setLoading(true);
    setBars([]);
    setBandData(null);
    setMarkers([]);

    (async () => {
      try {
        const sym = String(symbol || "").toUpperCase();
        const end = Number(anchorEndUtcSec) + Number(dayOffset) * DAY_SEC;
        const start = end - lookbackDays * DAY_SEC;
        // 가장 큰 win(최대 200일) σ에 창 앞쪽 봉 필요 → maBuf 넉넉히(일봉 단위). interval "D".
        const rows = await source.fetchWindow(
          sym, "D", start, end, ac.signal, maxWin + 10
        );
        if (ac.signal.aborted) return;

        // CFD with-gaps 등에서 빈 OHLC(갭) 행이 올 수 있어 유효 봉만 사용.
        const all = rowsToBars(rows).filter(
          (b) => Number.isFinite(b.close) && Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low)
        );
        const barsVisible = all.filter((b) => b.time >= start && b.time < end);

        // ✅ 방향별 win으로 각자 롤링 MA·σ 계산 → 밴드/앵커 데이터 (win별 계산은 1회씩 캐시)
        if (spec) {
          const msByWin = new Map();
          const msFor = (w) => {
            if (!msByWin.has(w)) {
              msByWin.set(w, calcRollingMaSd(all, w).filter((p) => p.time >= start && p.time < end));
            }
            return msByWin.get(w);
          };
          const bd = {};
          for (const [slot, d] of Object.entries(spec)) {
            const sign = (slot === "s1Long" || slot === "s2Short") ? +1 : -1; // 위쪽 밴드=+K1σ
            bd[slot] = msFor(d.w || 90).map((p) => ({ time: p.time, value: p.ma + sign * d.k * p.sd }));
          }
          // 회색 MA 앵커 = 가장 짧은 win(가장 반응 빠른 기준선)
          const minWin = Math.min(...Object.values(spec).map((d) => d.w || 90));
          bd.ma = msFor(minWin).map((p) => ({ time: p.time, value: p.ma }));
          setBandData(bd);
        }

        setDigits(inferDigitsFromRows(rows, 2));
        setBars(barsVisible);
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
  }, [source, symbol, anchorEndUtcSec, dayOffset, lookbackDays, signalNames, spec, maxWin]);

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
          (일봉 · {winsLabel} · S3/S4 밴드 · 최근 {lookbackDays}일)
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
          bandData={bandData}
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
