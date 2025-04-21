import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import dayjs from "dayjs"; // 날짜 포맷을 관리할 때 유용하게 사용
import 'dayjs/locale/ko';

dayjs.locale('ko');
function IndexChart({ data,dataName,envelope }) {
  const [customTooltip, setCustomTooltip] = useState(null); // 마우스 커서 위치
  const { firstDaysByMonth, firstDaysByYear } = getLabelMap(data);

  // 페이지 로드 시 마지막 데이터로 툴팁을 초기화
useEffect(() => {
  if (data && data.length > 0) {
    const lastItem = data[data.length - 1];
    setCustomTooltip({
        label: lastItem.date,
        payload: [
          { dataKey: "close", value: lastItem.close, color: "#00bfff" },
          { dataKey: "ma100", value: lastItem.ma100, color: "#00c853" },
          ...(envelope === 10
            ? [
                { dataKey: "envelope10_upper", value: lastItem.envelope10_upper, color: "#ff5252" },
                { dataKey: "envelope10_lower", value: lastItem.envelope10_lower, color: "#ff8a80" },
              ]
            : envelope === 3
            ? [
                { dataKey: "envelope3_upper", value: lastItem.envelope3_upper, color: "#ff5252" },
                { dataKey: "envelope3_lower", value: lastItem.envelope3_lower, color: "#ff8a80" },
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

  return null;
};
  const getPrettyName = (key) => {
    const map = {
      close: "종가",
      ma100: "100일 이평선",
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
      { dataKey: 'envelope10_lower', stroke: '#ff8a80' },
    ],
    3: [
      { dataKey: 'envelope3_upper', stroke: '#ff5252' },
      { dataKey: 'envelope3_lower', stroke: '#ff8a80' },
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

          }}>
            {/* 제목 */}
              <h2 style={{marginBottom: "10px", color: "#00ffcc", textAlign: "center"}}>{dataName}</h2>
        {/* 차트 영역 (70% 크기) */}
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
                      <Line type="monotone" dataKey="close" stroke="#00bfff" dot={false}/>
                      <Line type="monotone" dataKey="ma100" stroke="#00c853" dot={false}/>
                      {/* 선택된 envelope에 맞는 라인 추가 */}
                        {lines.map((line, index) => (
                          <Line key={index} type="monotone" dataKey={line.dataKey} stroke={line.stroke} dot={false} />
                        ))}
                      <Tooltip
                          cursor={{stroke: "#8884d8", strokeWidth: 1}}
                          content={renderTooltip}
                      />
                  </LineChart>
              </ResponsiveContainer>
          </div>
          {/*  제목 + 툴팁 */}
          <div style={{
              marginTop: "10px",
              backgroundColor: "#333",
              padding: "10px",
              borderRadius: "8px",
              width: "100%",
              color: "#fff",
              textAlign: "center"
          }}>
          {/* 모든 지표 - close 포함 */}
          {customTooltip?.payload?.length > 0 && (
          <div style={{
            marginTop: "10px",
            backgroundColor: "#333",
            padding: "10px",
            borderRadius: "8px",
            color: "#fff"
          }}>
            {/* 날짜 */}
            {customTooltip.label && (
              <div style={{
                marginBottom: "8px",
                paddingBottom: "8px",
                borderBottom: "1px solid #555",
                fontWeight: "bold",
                textAlign: "center"
              }}>
                {dayjs(customTooltip.label).format("MM/DD (dd)")}
              </div>
            )}

            {/* 값들 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              rowGap: "6px",
              columnGap: "10px",
            }}>
              {customTooltip.payload.map((item, idx) => (
                <React.Fragment key={idx}>
                  <div style={{
                    color: item.color,
                    borderBottom: "1px solid #444",
                    paddingBottom: "4px"
                  }}>
                    {getPrettyName(item.dataKey)}
                  </div>
                  <div style={{
                    textAlign: "right",
                    borderBottom: "1px solid #444",
                    paddingBottom: "4px"
                  }}>
                    {Number(item.value).toFixed(2)}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}


      </div>
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
