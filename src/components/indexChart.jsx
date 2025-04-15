import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import dayjs from "dayjs"; // 날짜 포맷을 관리할 때 유용하게 사용

function IndexChart({data}) {
  if (!data) {
    return <p>Loading chart data...</p>;
  }

  // x축 날짜 포맷 수정
  // ✅ 월별 / 연도별 첫 거래일 미리 계산
  const firstDateMap = getLabelMap(data);
  const formatXAxis = (tickItem) => {
    const date = dayjs(tickItem);
    const currentMonthKey = `${date.year()}-${date.month()}`;
    const currentYearKey = `${date.year()}`;


    if (firstDateMap.firstDaysByYear[currentYearKey] === date.format("YYYY-MM-DD")) {
      return date.format("YY/MM");
    }

    if (firstDateMap.firstDaysByMonth[currentMonthKey] === date.format("YYYY-MM-DD")) {
      return date.format("MM");
    }

    return ""; // 나머지 날짜는 빈 문자열로 표시 안함
  };

  return (
      <div style={{ background: "#222", padding: "20px", borderRadius: "12px", color: "#fff", width: "100%", maxWidth: "600px" }}>
      <h2 style={{ marginBottom: "10px", color: "#00ffcc" }}>제목없음</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>

          {/* 가로세로 점선 추가 */}
          <CartesianGrid stroke="#666" strokeDasharray="3 3" />

          {/* X축 (날짜 포맷 수정) */}
          <XAxis
            dataKey="date"
            tickFormatter={(tickItem) => formatXAxis(tickItem)}
            tick={{ fill: "#fff", fontSize: 12 }}
            interval={0} // x축 데이터의 간격을 일정하게 유지
          />

          {/* Y축 */}
          <YAxis domain={["auto", "auto"]} tick={{ fill: "#fff", fontSize: 12 }} />

           {/* 기본 툴팁 */}
          <Tooltip contentStyle={{ backgroundColor: "#333", border: "none", fontSize: "12px", color: "#fff" }} />


          {/* 메인 종가 */}
          <Line type="monotone" dataKey="close" stroke="#00bfff" dot={false} />

          {/* 이동 평균선 (초록) */}
          <Line type="monotone" dataKey="ma100" stroke="#00c853" dot={false} />

          {/* Envelope 상한선 (빨강) */}
          <Line type="monotone" dataKey="envelope10_upper" stroke="#ff5252" dot={false} />

          {/* Envelope 하한선 (연빨강) */}
          <Line type="monotone" dataKey="envelope10_lower" stroke="#ff8a80" dot={false} />

          {/* 월별 첫 거래일에 실선 추가 */}
          {Object.keys(firstDateMap.firstDaysByMonth).map((monthKey) => {
            const firstDay = firstDateMap.firstDaysByMonth[monthKey];
            return (
              <ReferenceLine
                key={monthKey}
                x={firstDay}
                stroke="rgba(169, 169, 169, 0.5)" // 회색 실선, 투명도 추가
                strokeDasharray="0 0" // 실선 스타일
                label={{ value: firstDay, position: "top", fill: "#ff7300", fontSize: 12 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ✅ 월별/연도별 첫 거래일을 계산하는 헬퍼 함수
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

export default IndexChart;
