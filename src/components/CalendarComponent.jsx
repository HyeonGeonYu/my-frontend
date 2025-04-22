import React from "react";
import { useMarketHolidaysData } from "../hooks/useCalendarData";
import { parseISO, format, addDays, isToday, isSameWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { countryNameMap as calendarMeta } from "../constants/calendarMeta";


const MarketHolidaysComponent = () => {
  const { holidaysData, loading, error } = useMarketHolidaysData();

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>{error}</div>;
  if (!holidaysData || Object.keys(holidaysData).length === 0) {
    return <div>공휴일 데이터가 없습니다.</div>;
  }

  const timestamp = parseISO(holidaysData.timestamp);
  const endDate = addDays(timestamp, 13);
  const countryOrder = calendarMeta.countryList;
  const countryNameMap = calendarMeta.country;

  return (
      <div
          style={{
            padding: "20px",
            fontFamily: "Arial, sans-serif",
            maxWidth: "600px",
            margin: "0 auto",
          }}
      >
        <h2>
          {format(timestamp, "yyyy년 M월 d일 (E) ~", {locale: ko})} <br/>
          {format(endDate, "M월 d일 (E)", {locale: ko})}
        </h2>
        <div style={{display: "flex", gap: "12px", marginBottom: "16px"}}>
          <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
            <span style={{width: "12px", height: "12px", backgroundColor: "#2ecc71", borderRadius: "50%"}}></span>
            <span>오늘</span>
          </div>
          <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
            <span style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#ffffff",
              border: "1px solid #ccc",
              borderRadius: "50%"
            }}></span>
            <span>이번 주</span>
          </div>
          <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
            <span style={{width: "12px", height: "12px", backgroundColor: "#999999", borderRadius: "50%"}}></span>
            <span>다음 주</span>
          </div>
        </div>

        {countryOrder.map((code) => {
          const data = holidaysData.holidays[code] || [];
          const countryName = countryNameMap[code] || code;

          return (
              <div key={code} style={{marginBottom: "20px"}}>
                <h3>{countryName}</h3>
                {Array.isArray(data) && data.length > 0 ? (
                    <ul>
                      {data.map((holiday) => {
                        const dateObj = parseISO(holiday.date);
                        let color = "#ffffff"; // 기본: 금주 (흰색)

                        if (isToday(dateObj)) {
                          color = "#2ecc71"; // 오늘: 초록색
                        } else if (!isSameWeek(dateObj, new Date(), {locale: ko})) {
                          color = "#999999"; // 차주: 회색
                        }

                        const formattedDate = format(dateObj, "MM-dd (E)", {locale: ko});

                        return (
                            <li key={holiday.date} style={{color}}>
                              <strong>{holiday.name}</strong> ({formattedDate})
                            </li>
                        );
                      })}
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
