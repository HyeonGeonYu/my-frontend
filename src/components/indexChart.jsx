import React, { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import dayjs from "dayjs"; // 날짜 포맷을 관리할 때 유용하게 사용
import 'dayjs/locale/ko';

dayjs.locale('ko');
function IndexChart({ data,dataName,envelope }) {
  const [customTooltip, setCustomTooltip] = useState(null); // 마우스 커서 위치
  const { firstDaysByMonth, firstDaysByYear } = getLabelMap(data);
  const handleTooltip = useCallback(({ active, payload, label, coordinate }) => {
    if (active && payload && payload.length) {
      const newTooltip = payload.map((item) => ({
        name: getPrettyName(item.dataKey),
        value: Number(item.value).toFixed(2),
        color: item.color,
      }));

      // 날짜를 툴팁에 추가
      if (label) {
      newTooltip.unshift({
        name: "date",
        value: dayjs(label).format("MM/DD (dd)"),  // 날짜 포맷을 MM/DD로 설정
        color: "#fff",  // 날짜 항목의 색상
      });
    }

      // 현재 값이랑 다를 때만 업데이트 (무한 루프 방지)
      const isEqual = JSON.stringify(newTooltip) === JSON.stringify(customTooltip);
      if (!isEqual) {
        setCustomTooltip(newTooltip);
      }
    }
    return null;
  }, [customTooltip]);

  const getPrettyName = (key) => {
    const map = {
      close: "close",
      ma100: "avg(100)",
      envelope10_upper: "avg+10%",
      envelope10_lower: "avg-10%",
      envelope3_upper: "avg+3%",
      envelope3_lower: "avg-3%",
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

          }}>
            {/* 제목 */}
              <h2 style={{marginBottom: "10px", color: "#00ffcc", textAlign: "center"}}>{dataName}</h2>
        {/* 차트 영역 (70% 크기) */}
          <div style={{width: "100%"}}>
              {envelope === 10 && (
                  <>
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
                              <Line type="monotone" dataKey="envelope10_upper" stroke="#ff5252" dot={false}/>
                              <Line type="monotone" dataKey="envelope10_lower" stroke="#ff8a80" dot={false}/>
                              <Tooltip
                                  cursor={{stroke: "#8884d8", strokeWidth: 1}}
                                  content={handleTooltip}
                              />
                          </LineChart>
                      </ResponsiveContainer>
                  </>
              )}
              {envelope === 3 && (
                  <>
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
                              <Line type="monotone" dataKey="envelope3_upper" stroke="#ff5252" dot={false}/>
                              <Line type="monotone" dataKey="envelope3_lower" stroke="#ff8a80" dot={false}/>


                              <Tooltip
                                  cursor={{stroke: "#8884d8", strokeWidth: 1}}
                                  content={handleTooltip}
                              />
                          </LineChart>
                      </ResponsiveContainer>
                  </>
              )}
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


              {/* 날짜 */}
              <div style={{
                  marginBottom: "8px",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #555",
                  fontWeight: "bold",
                  textAlign: "center"
              }}>
                  {customTooltip?.find(item => item.name === "date")?.value}
              </div>

              {/* 모든 지표 - close 포함 */}
              <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  rowGap: "6px",
                  columnGap: "10px",
              }}>
                  {customTooltip
                      ?.filter(entry => entry.name !== "date")
                      .map((entry, index) => (
                          <React.Fragment key={index}>
                              <div style={{color: entry.color, borderBottom: "1px solid #444", paddingBottom: "4px"}}>
                                  {entry.name}
                              </div>
                              <div style={{textAlign: "right", borderBottom: "1px solid #444", paddingBottom: "4px"}}>
                                  {entry.value}
                              </div>
                          </React.Fragment>
                      ))}
              </div>

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

  return { firstDaysByMonth, firstDaysByYear };
}

export default IndexChart;
