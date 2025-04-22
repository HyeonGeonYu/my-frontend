import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import 'dayjs/locale/ko';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import 'dayjs/locale/ko';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("ko");
function IndexChart({ processedData,dataName,envelope }) {
 const processedTime = processedData?.processed_time;
 const processedKST = dayjs.utc(processedTime).tz("Asia/Seoul");
 const howLongAgo = processedKST.fromNow();
  const data = processedData.data
    const lastItem = data[data.length - 1];
const close = lastItem?.close;
const ma100 = lastItem?.ma100;
const diff = Math.abs(close - ma100);
const maxDiff = ma100 * 0.1; // 최대 10% 차이를 기준
const intensity = Math.min(1, diff / maxDiff); // 0 ~ 1 사이 값

const baseColor = close > ma100 ? "255, 82, 82" : "0, 191, 255";
const borderColor = `rgba(${baseColor}, ${0.4 + intensity * 0.6})`;

  const [customTooltip, setCustomTooltip] = useState(null); // 마우스 커서 위치
  const { firstDaysByMonth, firstDaysByYear } = getLabelMap(data);
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
    {label ?? ( value!== undefined ? value : "-")}
  </div>
);
  // 페이지 로드 시 마지막 데이터로 툴팁을 초기화


useEffect(() => {


  if (data && data.length > 0) {
    const lastItem = data[data.length - 1];
    const close = lastItem.close;
    const ma100 = lastItem.ma100;


    setCustomTooltip({
        label: lastItem.date,
        payload: [
          { dataKey: "close", value: lastItem.close, color: "#FFA500" },
          { dataKey: "ma100", value: lastItem.ma100, color: "#00c853" },
          ...(envelope === 10
            ? [
                { dataKey: "envelope10_upper", value: lastItem.envelope10_upper, color: "#ff5252" },
                { dataKey: "envelope10_lower", value: lastItem.envelope10_lower, color: "#00bfff" },
              ]
            : envelope === 3
            ? [
                { dataKey: "envelope3_upper", value: lastItem.envelope3_upper, color: "#ff5252" },
                { dataKey: "envelope3_lower", value: lastItem.envelope3_lower, color: "#00bfff" },
              ]
            : []),
        ],
      });
  }
}, [data,envelope]);
  const renderTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const isEqual = JSON.stringify(label) === JSON.stringify(customTooltip.label);

      if (!isEqual) {
          setCustomTooltip({
          label,
          payload,
        });
    }
  }
else if (!active && data && data.length > 0) {
    const lastItem = data[data.length - 1];
    const isEqual = JSON.stringify(lastItem.date) === JSON.stringify(customTooltip.label);
    if (!isEqual) {
          setCustomTooltip({
        label: lastItem.date,
        payload: [
          { dataKey: "close", value: lastItem.close, color: "#FFA500" },
          { dataKey: "ma100", value: lastItem.ma100, color: "#00c853" },
          ...(envelope === 10
            ? [
                { dataKey: "envelope10_upper", value: lastItem.envelope10_upper, color: "#ff5252" },
                { dataKey: "envelope10_lower", value: lastItem.envelope10_lower, color: "#00bfff" },
              ]
            : envelope === 3
            ? [
                { dataKey: "envelope3_upper", value: lastItem.envelope3_upper, color: "#ff5252" },
                { dataKey: "envelope3_lower", value: lastItem.envelope3_lower, color: "#00bfff" },
              ]
            : []),
        ],
      });
    }
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

  const envelopeLines = {
    10: [
      { dataKey: 'envelope10_upper', stroke: '#ff5252' },
      { dataKey: 'envelope10_lower', stroke: '#00bfff' },
    ],
    3: [
      { dataKey: 'envelope3_upper', stroke: '#ff5252' },
      { dataKey: 'envelope3_lower', stroke: '#00bfff' },
    ]
  };
  const lines = envelopeLines[envelope] || [];


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
          </h2>
          {/* 차트 영역 */}
          <div style={{width: "100%"}}>
              <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data}>
                      <CartesianGrid stroke="#666" strokeDasharray="3 3"/>
                      <XAxis
                          dataKey="date"
                          ticks={Object.values(firstDaysByMonth)}
                          tickFormatter={(tickItem) => formatXAxis(tickItem)}
                          tick={{fill: "#fff", fontSize: 12}}
                      />
                      <YAxis domain={["auto", "auto"]} tick={{fill: "#fff", fontSize: 12}}/>
                      <Line type="monotone" dataKey="close" stroke="#FFA500" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="ma100" stroke="#00c853" dot={false}/>
                      {/* 선택된 envelope에 맞는 라인 추가 */}
                      {lines.map((line, index) => (
                          <Line key={index} type="monotone" dataKey={line.dataKey} stroke={line.stroke} dot={false}/>
                      ))}
                      <Tooltip
                          cursor={{stroke: "#8884d8", strokeWidth: 1}}
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

// 월별/연도별 첫 거래일을 계산하는 헬퍼 함수

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

    return {firstDaysByMonth, firstDaysByYear};
}

export default IndexChart;
