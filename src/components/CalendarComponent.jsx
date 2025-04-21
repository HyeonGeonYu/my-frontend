import React from "react";
import { useMarketHolidaysData } from "../hooks/useCalendarData";
import { parseISO, format, addDays } from "date-fns";
import { ko } from "date-fns/locale";

const MarketHolidaysComponent = () => {
  const { holidaysData, loading, error } = useMarketHolidaysData();

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>{error}</div>;
  if (!holidaysData || Object.keys(holidaysData).length === 0) {
    return <div>공휴일 데이터가 없습니다.</div>;
  }

  const timestamp = parseISO(holidaysData.timestamp);
  const endDate = addDays(timestamp, 13);
  const formattedRange = `${format(timestamp, "yyyy년 M월 d일", { locale: ko })} ~ ${format(endDate, "M월 d일", { locale: ko })}`;

  // 원하는 순서
  const countryOrder = ["KR", "CN", "JP", "US", "GB", "DE", "HK"];

  // 한글 이름 매핑
  const countryNameMap = {
    KR: "한국",
    CN: "중국",
    JP: "일본",
    US: "미국",
    GB: "영국",
    DE: "독일",
    HK: "홍콩",
  };

  return (
  <div
    style={{
      padding: "20px",
      fontFamily: "Arial, sans-serif",
      maxWidth: "600px",        // 최대 너비 제한
      margin: "0 auto",         // 가운데 정렬
    }}
  >
    <h2>🌍 {formattedRange} 사이의 국가별 공휴일</h2>
    {countryOrder.map((code) => {
      const data = holidaysData.holidays[code] || [];
      const countryName = countryNameMap[code] || code;

      return (
        <div key={code} style={{ marginBottom: "20px" }}>
          <h3>{countryName}</h3>
          {Array.isArray(data) && data.length > 0 ? (
            <ul>
              {data.map((holiday) => (
                <li key={holiday.date}>
                  <strong>{holiday.name}</strong> ({holiday.date})
                </li>
              ))}
            </ul>
          ) : (
            <p>이번 주에 해당 국가의 공휴일이 없습니다.</p>
          )}
        </div>
      );
    })}
  </div>
);

};

export default MarketHolidaysComponent;
