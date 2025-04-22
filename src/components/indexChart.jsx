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

          }}>
            {/* 제목 */}
          <h2 style={{marginBottom: "10px", color: "#00ffcc", textAlign: "center"}}>{dataName}</h2>
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
                      <Line type="monotone" dataKey="close" stroke="#FFA500" dot={false}/>
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
                    {/* 날짜 */}
                    {customTooltip.label && (
                        <div style={{
                            marginBottom: "8px",
                            paddingBottom: "8px",
                            borderBottom: "4px solid #444", // 가로 구분선
                            fontWeight: "bold",
                            textAlign: "center"
                        }}>
                            {dayjs(customTooltip.label).format("MM/DD (dd)")}
                        </div>
                    )}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "auto 1fr auto 1fr", // 4열
                            rowGap: "6px",
                            columnGap: "10px",
                            alignItems: "center",
                            width: "100%",
                            borderBottom: "4px solid #444", // 마지막 행 구분선
                        }}
                    >
                        {/* 1행: 종가 | 이평선+10% */}
                        <div style={{
                            color: customTooltip?.payload[0]?.color,
                            borderRight: "2px solid #444", // 세로 구분선
                            paddingRight: "10px"
                        }}>종가</div>
                        <div style={{
                            textAlign: "right",
                            borderRight: "2px solid #444", // 세로 구분선
                            paddingRight: "10px"
                        }}>
                            {Number(customTooltip.payload[0]?.value).toFixed(2)}
                        </div>
                        <div style={{
                            color: customTooltip?.payload[2]?.color,
                            borderRight: "2px solid #444", // 세로 구분선
                            paddingRight: "10px"
                        }}>
                            {getPrettyName("envelope10_upper")}
                        </div>
                        <div style={{
                            textAlign: "right",
                            paddingRight: "10px"
                        }}>
                            {customTooltip.payload[2]
                                ? Number(customTooltip.payload[2].value).toFixed(2)
                                : "-"}
                        </div>

                        {/* 2행: 이평선대비 차이 | 이평선 */}
                        <div
                            style={{
                                color: customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                                    ? customTooltip?.payload[2]?.color // +일때의 색
                                    : customTooltip?.payload[3]?.color, // -일때의 색
                                borderRight: "2px solid #444", // 세로 구분선
                                paddingRight: "10px"
                            }}
                        >
                            이평선대비 (값)
                        </div>
                        <div style={{
                            textAlign: "right",
                            color: customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                                ? customTooltip?.payload[2]?.color // +일때의 색
                                : customTooltip?.payload[3]?.color,
                            borderRight: "2px solid #444", // 세로 구분선
                            paddingRight: "10px"
                        }}>
                            {customTooltip.payload[1] ? (() => {
                                const diff = customTooltip.payload[0].value - customTooltip.payload[1].value;
                                const sign = diff > 0 ? "+" : "";
                                return `${sign}${diff.toFixed(2)}`;
                            })() : "-"}
                        </div>
                        <div style={{
                            color: customTooltip?.payload[1]?.color,
                            borderRight: "2px solid #444", // 세로 구분선
                            paddingRight: "10px"
                        }}>
                            {getPrettyName("ma100")}
                        </div>
                        <div style={{
                            textAlign: "right",
                            paddingRight: "10px"
                        }}>
                            {customTooltip.payload[1]
                                ? Number(customTooltip.payload[1].value).toFixed(2)
                                : "-"}
                        </div>

                        {/* 3행: 이평선대비 차이(%) | 이평선-10% */}
                        <div
                            style={{
                                color: customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                                    ? customTooltip?.payload[2]?.color // +일때의 색
                                    : customTooltip?.payload[3]?.color, // -일때의 색
                                borderRight: "2px solid #444", // 세로 구분선
                                paddingRight: "10px"
                            }}
                        >
                            이평선대비 (%)
                        </div>
                        <div style={{
                            textAlign: "right",
                            color: customTooltip?.payload[0]?.value - customTooltip?.payload[1]?.value > 0
                                ? customTooltip?.payload[2]?.color // +일때의 색
                                : customTooltip?.payload[3]?.color,
                                borderRight: "2px solid #444", // 세로 구분선
                            paddingRight: "10px"
                        }}>
                            {customTooltip.payload[1] ? (() => {
                                const diffPercent =
                                    ((customTooltip.payload[0].value - customTooltip.payload[1].value) /
                                        customTooltip.payload[1].value) *
                                    100;
                                const sign = diffPercent > 0 ? "+" : "";
                                return `${sign}${diffPercent.toFixed(2)}%`;
                            })() : "-"}
                        </div>
                        <div style={{
                            color: customTooltip?.payload[3]?.color,
                            paddingRight: "10px",
                            borderRight: "2px solid #444", // 세로 구분선
                        }}>
                            {getPrettyName("envelope10_lower")}
                        </div>
                        <div style={{
                            textAlign: "right",
                            paddingRight: "10px"
                        }}>
                            {customTooltip.payload[3]
                                ? Number(customTooltip.payload[3].value).toFixed(2)
                                : "-"}
                        </div>
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
