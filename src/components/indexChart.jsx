import React, { useState, useMemo } from 'react';
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

function IndexChart({ processedData, dataName, envelope }) {
  const processedTime = processedData?.processed_time;
  const processedKST = dayjs.utc(processedTime).tz("Asia/Seoul");
  const howLongAgo = processedKST.fromNow();
  const data = processedData.data;
  const hasShortRatio = data.some(d => d.short_ratio !== undefined);
  const lastItem = data[data.length - 1];
  const close = lastItem?.close;
  const ma100 = lastItem?.ma100;
  const diff = Math.abs(close - ma100);
  const maxDiff = ma100 * 0.1; // 최대 10% 차이를 기준
  const intensity = Math.min(1, diff / maxDiff); // 0 ~ 1 사이 값

  const baseColor = close > ma100 ? "0, 195, 83" : "255, 82, 82";  // 초록색(양의 변화) 또는 빨간색(음의 변화)
  const borderColor = `rgba(${baseColor}, ${0.4 + intensity * 0.6})`;

  const diffValue = close - data[data.length - 5]?.close; // 전일 대비 차이
  const diffPercentage = ((diffValue / data[data.length - 5]?.close) * 100).toFixed(2); // 전일 대비 백분율
  const diffColor = diffValue >= 0 ? "#00c853" : "#ff5252"; // +는 초록색, -는 빨간색

  const [customTooltip, setCustomTooltip] = useState(null); // 마우스 커서 위치
  const { firstDaysByMonth, firstDaysByYear } = useMemo(() => getLabelMap(data), [data]);

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
  // 페이지 로드 시 마지막 데이터로 툴팁을 초기화
const chartLines = [
  { dataKey: "close", stroke: "#FFA500", strokeWidth: 3, yAxisId: "left" },
  { dataKey: "ma100", stroke: "#00bfff", yAxisId: "left" },
  ...(chartLinesConfig[envelope]?.map(line => ({ ...line, yAxisId: "left" })) || []),
  ...(hasShortRatio
    ? [{ dataKey: "short_ratio", stroke:"rgba(136, 132, 216, 0.1)", yAxisId: "right", strokeDasharray: "5 3", strokeWidth: 0.01}]
    : [])
];

// 툴팁 컴포넌트는 순수하게 UI만 그리도록 (이 예시에서는 null로 상태만 컨트롤)

if (data && data.length > 0 && customTooltip === null) {
  const lastItem = data[data.length - 1];
  setCustomTooltip({
    label: lastItem.date,
    payload: chartLines.map(({ dataKey, stroke }) => ({
      dataKey,
      value: lastItem[dataKey],
      color: stroke,
    })),
  });
}

const renderTooltip = ({ active, payload, label }) => {
  if (
    active &&
    payload?.length &&
    (customTooltip?.label !== label)
  ) {
    setCustomTooltip({ label, payload });
  }else if (
    !active &&
    lastItem &&
    customTooltip?.label !== lastItem.date
  ) {
    setCustomTooltip({
      label: lastItem.date,
      payload: chartLines.map(({ dataKey, stroke }) => ({
        dataKey,
        value: lastItem[dataKey],
        color: stroke,
      })),
    });
  }
  return null;
};

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

  if (!data) {
    return <p>Loading chart data...</p>;
  }

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

  return (
    <div style={{
      background: "#222",
      padding: "20px",
      borderRadius: "12px",
      color: "#fff",
      width: "100%",
      maxWidth: "500px",
      display: "flex",
      flexDirection: "column",  // 세로 방향으로 배치
      justifyContent: "center",
      alignItems: "center",
      border: `2px solid ${borderColor}` // 조건부 테두리 색상
    }}>
      {/* 제목 */}
      <div style={{
        width: "100%",
        textAlign: "right",
        marginBottom: "10px"
      }}>
        <span style={{
          fontSize: "0.8rem",
          color: "#aaa",
          whiteSpace: "nowrap",
        }}>
          업데이트: {howLongAgo}

        </span>
      </div>
      <h2 style={{
        marginBottom: "10px",
        color: "#00ffcc",
        textAlign: "center"
      }}>
        {dataName}
        <span style={{
          fontSize: "0.7rem",
          color: "#aaa",
          marginLeft: "10px",
        }}>
          <span style={{
            color: diffColor, // diffColor는 diffValue가 양수일 때와 음수일 때 색상이 바뀌는 값으로 설정
             textAlign: "right",  // 오른쪽 정렬
            fontSize: "0.9rem",
          }}>
  {`(${diffValue >= 0 ? '+' : ''}${diffValue.toFixed(2)} (${diffPercentage >= 0 ? '+' : ''}${diffPercentage}%))`}
</span>
        </span>
      </h2>
      {/* 차트 영역 */}
      <div style={{width: "100%"}}>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
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
            {/* 왼쪽 Y축 라인들 */}
          {chartLines
              .filter(line => line.dataKey !== 'short_ratio')
              .map(({ dataKey, stroke, strokeWidth = 2 }, index) => (
                <Line
                  key={index}
                  yAxisId="left"
                  type="monotone"
                  domain={['auto', 'auto']}
                  dataKey={dataKey}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  dot={false}
                />
              ))}

          {/* 오른쪽 Y축 라인 (short_ratio) */}
         {hasShortRatio && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="short_ratio"
                stroke="rgba(136, 132, 216, 1)"  // 흐릿한 보라색 (투명도 0.2)
                strokeWidth={1}  // 더 얇은 선
                strokeDasharray="5 3"  // 대시라인 스타일
                dot={false}  // 점 표시하지 않음
              />
)}
            <Tooltip
          cursor={{ stroke: "#8884d8", strokeWidth: 1 }}
          content={renderTooltip}

        />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* 내용 영역 */}
      {customTooltip?.payload?.length > 0 && (
        <div style={{
          marginTop: "10px",
          backgroundColor: "#333",
          padding: "10px",
          borderRadius: "8px",
          color: "#fff",
          width: "100%",
        }}>
          {/* 날짜 표시 */}
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

          {/* 데이터 표 형태 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto 1fr",
            border: "2px solid #444",
          }}>
            {/* 1행: 종가 | 이평선+10% */}
            <Cell label="종가" color={customTooltip?.payload[0]?.color} border />
            <Cell value={customTooltip.payload[0]?.value.toFixed(2)} align="right" border />
            <Cell label={getPrettyName("envelope10_upper")} color={customTooltip?.payload[2]?.color} border />
            <Cell value={customTooltip.payload[2]?.value.toFixed(2)} align="right" />

            {/* 2행: 이평선대비 (값) | 이평선 */}
            <Cell
              label="이평선대비 (값)"
              color={
                customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              background="#2a2a2a"
              border
            />

            <Cell
              value={(() => {
                if (!customTooltip.payload[1]) return "-";
                const diff = customTooltip.payload[0].value - customTooltip.payload[1].value;
                const sign = diff > 0 ? "+" : "";
                return `${sign}${diff.toFixed(2)}`;
              })()}
              align="right"
              background="#2a2a2a"
              color={
                customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              border
            />
            <Cell label={getPrettyName("ma100")} color={customTooltip?.payload[1]?.color} border />
            <Cell value={customTooltip.payload[1]?.value.toFixed(2)} align="right" />

            {/* 3행: 이평선대비 (%) | 이평선-10% */}
            <Cell
              label="이평선대비 (%)"
              color={
                customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              background="#2a2a2a"
              border
            />
            <Cell
              value={(() => {
                if (!customTooltip.payload[1]) return "-";
                const percent =
                  ((customTooltip.payload[0].value - customTooltip.payload[1].value) / customTooltip.payload[1].value) * 100;
                const sign = percent > 0 ? "+" : "";
                return `${sign}${percent.toFixed(2)}`;
              })()}
              align="right"
              background="#2a2a2a"
              color={
                customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                  ? customTooltip?.payload[2]?.color
                  : customTooltip?.payload[3]?.color
              }
              border
            />
            <Cell label={getPrettyName("envelope10_lower")} color={customTooltip?.payload[3]?.color} border />
            <Cell value={customTooltip.payload[3]?.value.toFixed(2)} align="right" />
          </div>
        </div>
      )}
    </div>
  );
}

export default IndexChart;
