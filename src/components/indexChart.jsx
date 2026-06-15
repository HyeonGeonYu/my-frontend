import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import 'dayjs/locale/ko';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("ko");

const chartLinesConfig = {
  10: [
    { dataKey: "envelope10_upper", stroke: "#00c853" },
    { dataKey: "envelope10_lower", stroke: "#ff5252" },
  ],
  3: [
    { dataKey: "envelope3_upper", stroke: "#00c853" },
    { dataKey: "envelope3_lower", stroke: "#ff5252" },
  ],
};

// getLabelMap은 컴포넌트 외부에 정의해 매 렌더마다 재생성 방지
function getLabelMap(data) {
  const firstDaysByMonth = {};
  const firstDaysByYear = {};

  for (let i = 0; i < data.length; i++) {
    const d = dayjs(data[i].date);
    const m = d.month();
    const y = d.year();

    const monthKey = `${y}-${m}`;
    const yearKey = `${y}`;

    if (!firstDaysByMonth[monthKey]) {
      firstDaysByMonth[monthKey] = d.format("YYYY-MM-DD");
    }

    if (!firstDaysByYear[yearKey]) {
      firstDaysByYear[yearKey] = d.format("YYYY-MM-DD");
    }
  }

  return { firstDaysByMonth, firstDaysByYear };
}

const getPrettyName = (key) => {
  const map = {
    close: "종가",
    ma100: "이평선(100일)",
    envelope10_upper: "이평선 +10%",
    envelope10_lower: "이평선 -10%",
    envelope3_upper: "이평선 +3%",
    envelope3_lower: "이평선 -3%",
  };
  return map[key] || key;
};

function IndexChart({ processedData, dataName, envelope }) {
  const processedTime = processedData?.processed_time;
  const processedKST = dayjs.utc(processedTime).tz("Asia/Seoul");
  const howLongAgo = processedKST.fromNow();
  const data = processedData.data;

  // ── 모든 Hook은 early return 앞에 위치해야 함 (Rules of Hooks) ──
  const hasShortRatio = (data || []).some(d => d.short_ratio !== undefined);
  const lastItem = data?.length ? data[data.length - 1] : null;

  const [customTooltip, setCustomTooltip] = useState(null);
  const { firstDaysByMonth, firstDaysByYear } = useMemo(() => getLabelMap(data || []), [data]);

  const chartLines = useMemo(() => [
    { dataKey: "close", stroke: "#FFA500", strokeWidth: 3, yAxisId: "left" },
    { dataKey: "ma100", stroke: "#00bfff", yAxisId: "left" },
    ...(chartLinesConfig[envelope]?.map(line => ({ ...line, yAxisId: "left" })) || []),
    ...(hasShortRatio
      ? [{ dataKey: "short_ratio", stroke: "rgba(136, 132, 216, 0.1)", yAxisId: "right", strokeDasharray: "5 3", strokeWidth: 0.01 }]
      : [])
  ], [envelope, hasShortRatio]);

  useEffect(() => {
    if (!data?.length) return;
    const last = data[data.length - 1];
    setCustomTooltip(prev => prev ?? {
      label: last.date,
      payload: chartLines.map(({ dataKey, stroke }) => ({
        dataKey,
        value: last[dataKey],
        color: stroke,
      })),
    });
  }, [data, chartLines]);

  const handleMouseMove = useCallback((e) => {
    if (!e?.isTooltipActive || !e?.activePayload?.length) return;
    const byKey = Object.fromEntries(e.activePayload.map(p => [p.dataKey, p.value]));
    setCustomTooltip({
      label: e.activeLabel,
      payload: chartLines.map(({ dataKey, stroke }) => ({
        dataKey,
        value: byKey[dataKey],
        color: stroke,
      })),
    });
  }, [chartLines]);

  const handleMouseLeave = useCallback(() => {
    if (!lastItem) return;
    setCustomTooltip({
      label: lastItem.date,
      payload: chartLines.map(({ dataKey, stroke }) => ({
        dataKey,
        value: lastItem[dataKey],
        color: stroke,
      })),
    });
  }, [chartLines, lastItem]);

  // ── Hook 이후에 early return ──
  if (!data?.length) {
    return <p>Loading chart data...</p>;
  }

  const close = lastItem?.close ?? 0;
  const ma100 = lastItem?.ma100;
  const diff = Math.abs(close - (ma100 ?? close));
  const maxDiff = (ma100 ?? close) * 0.1;
  const intensity = Math.min(1, maxDiff > 0 ? diff / maxDiff : 0);

  const baseColor = close > (ma100 ?? close) ? "0, 195, 83" : "255, 82, 82";
  const borderColor = `rgba(${baseColor}, ${0.4 + intensity * 0.6})`;

  const prevClose = data.length >= 2 ? (data[data.length - 2]?.close ?? close) : close;
  const diffValue = close - prevClose;
  const diffPercentage = close > 0 ? ((diffValue / close) * 100).toFixed(2) : "0.00";
  const diffColor = diffValue >= 0 ? "#00c853" : "#ff5252";

  const Cell = ({
    label,
    value,
    color = "#fff",
    background,
    align = "left",
    border = false,
  }) => (
    <div style={{
      padding: "6px 10px",
      color,
      backgroundColor: background || undefined,
      borderRight: border ? "2px solid #444" : undefined,
      borderBottom: "2px solid #444",
      textAlign: align,
      display: "flex",
      alignItems: "center",
      justifyContent: align === "right" ? "flex-end" : "flex-start",
      minHeight: "30px"
    }}>
      {label ?? (value !== undefined ? value : "-")}
    </div>
  );

  const formatXAxis = (tickItem) => {
    const date = dayjs(tickItem);
    const currentMonthKey = `${date.year()}-${date.month()}`;
    const currentYearKey = `${date.year()}`;

    if (firstDaysByYear[currentYearKey] === date.format("YYYY-MM-DD")) {
      return date.format("YY/MM");
    }

    if (firstDaysByMonth[currentMonthKey] === date.format("YYYY-MM-DD")) {
      return date.format("MM");
    }
  };

  const safeFixed = (v, d = 2) => (typeof v === "number" && isFinite(v) ? v.toFixed(d) : "-");

  return (
    <div style={{
      background: "#222",
      padding: "20px",
      borderRadius: "12px",
      color: "#fff",
      width: "100%",
      maxWidth: "500px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      border: `2px solid ${borderColor}`
    }}>
      <div style={{ width: "100%", textAlign: "right", marginBottom: "10px" }}>
        <span style={{ fontSize: "0.8rem", color: "#aaa", whiteSpace: "nowrap" }}>
          업데이트: {howLongAgo}
        </span>
      </div>
      <h2 style={{ marginBottom: "5px", color: "#00ffcc", textAlign: "center" }}>
        {dataName}
      </h2>

      <div style={{ textAlign: "center", color: diffColor, fontSize: "0.9rem" }}>
        <span style={{ display: "inline-block", minWidth: "100px" }}>
          종가: <strong>{safeFixed(close)}</strong>
        </span>
        <span style={{
          display: "inline-block",
          minWidth: "100px",
          fontWeight: Math.abs(Number(diffPercentage)) >= 3 ? "bold" : "normal"
        }}>
          {(() => {
            const isPositive = diffValue >= 0;
            const absValue = Math.abs(diffValue);
            const absPercent = Math.abs(Number(diffPercentage));
            const symbol = absPercent >= 3
              ? (isPositive ? '↑' : '↓')
              : (isPositive ? '▲' : '▼');
            return `${symbol} ${absValue.toFixed(2)}`;
          })()}
        </span>
        <span style={{ display: "inline-block", minWidth: "100px" }}>
          ({Number(diffPercentage) >= 0 ? '+' : ''}{diffPercentage}%)
        </span>
      </div>

      <div style={{ width: "100%" }}>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={data}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <CartesianGrid stroke="#666" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              ticks={Object.values(firstDaysByMonth)}
              tickFormatter={(tickItem) => formatXAxis(tickItem)}
              tick={{ fill: "#fff", fontSize: 12 }}
            />

            <YAxis
              yAxisId="left"
              domain={["auto", "auto"]}
              tick={{ fill: "#fff", fontSize: 12 }}
              label={{
                value: "가격",
                angle: -90,
                position: "insideLeft",
                fill: "#fff",
                style: { textAnchor: "middle" }
              }}
            />

            {hasShortRatio && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 'auto']}
                ticks={[0, 0.05, 0.1]}
                tick={{ fill: "#fff", fontSize: 12 }}
                label={{
                  value: "공매도 비율 (%)",
                  angle: 90,
                  position: "insideRight",
                  fill: "#fff",
                  style: { textAnchor: "middle" }
                }}
              />
            )}

            {chartLines
              .filter(line => line.dataKey !== 'short_ratio')
              .map(({ dataKey, stroke, strokeWidth = 2 }, index) => (
                <Line
                  key={index}
                  yAxisId="left"
                  type="monotone"
                  dataKey={dataKey}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  dot={false}
                />
              ))}

            {hasShortRatio && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="short_ratio"
                stroke="rgba(136, 132, 216, 1)"
                strokeWidth={1}
                strokeDasharray="5 3"
                dot={false}
              />
            )}

            {/* cursor 표시만 위해 Tooltip 유지 (content는 커스텀 패널에서 처리) */}
            <Tooltip cursor={{ stroke: "#8884d8", strokeWidth: 1 }} content={() => null} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {customTooltip?.payload?.length > 0 && (
        <div style={{
          marginTop: "10px",
          backgroundColor: "#333",
          padding: "10px",
          borderRadius: "8px",
          color: "#fff",
          width: "100%",
        }}>
          {customTooltip.label && (
            <div style={{
              marginBottom: "8px",
              paddingBottom: "8px",
              borderBottom: "2px solid #555",
              fontWeight: "bold",
              textAlign: "center",
              fontSize: "16px"
            }}>
              {dayjs(customTooltip.label).format("MM/DD (dd)")}
            </div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto 1fr",
            border: "2px solid #444",
          }}>
            <Cell label="종가" color={customTooltip?.payload[0]?.color} border />
            <Cell value={safeFixed(customTooltip.payload[0]?.value)} align="right" border />
            <Cell label={getPrettyName("envelope10_upper")} color={customTooltip?.payload[2]?.color} border />
            <Cell value={safeFixed(customTooltip.payload[2]?.value)} align="right" />

            <Cell
              label="이평선대비 (값)"
              color={
                (customTooltip?.payload[0]?.value ?? 0) - (customTooltip?.payload[1]?.value ?? 0) > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              background="#2a2a2a"
              border
            />
            <Cell
              value={(() => {
                if (!customTooltip.payload[1]) return "-";
                const d = (customTooltip.payload[0]?.value ?? 0) - (customTooltip.payload[1]?.value ?? 0);
                return `${d > 0 ? "+" : ""}${d.toFixed(2)}`;
              })()}
              align="right"
              background="#2a2a2a"
              color={
                (customTooltip?.payload[0]?.value ?? 0) - (customTooltip?.payload[1]?.value ?? 0) > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              border
            />
            <Cell label={getPrettyName("ma100")} color={customTooltip?.payload[1]?.color} border />
            <Cell value={safeFixed(customTooltip.payload[1]?.value)} align="right" />

            <Cell
              label="이평선대비 (%)"
              color={
                (customTooltip?.payload[0]?.value ?? 0) - (customTooltip?.payload[1]?.value ?? 0) > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              background="#2a2a2a"
              border
            />
            <Cell
              value={(() => {
                const v0 = customTooltip.payload[0]?.value;
                const v1 = customTooltip.payload[1]?.value;
                if (v0 == null || v1 == null || v1 === 0) return "-";
                const pct = ((v0 - v1) / v1) * 100;
                return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}`;
              })()}
              align="right"
              background="#2a2a2a"
              color={
                (customTooltip?.payload[0]?.value ?? 0) - (customTooltip?.payload[1]?.value ?? 0) > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              border
            />
            <Cell label={getPrettyName("envelope10_lower")} color={customTooltip?.payload[3]?.color} border />
            <Cell value={safeFixed(customTooltip.payload[3]?.value)} align="right" />
          </div>
        </div>
      )}
    </div>
  );
}

export default IndexChart;
