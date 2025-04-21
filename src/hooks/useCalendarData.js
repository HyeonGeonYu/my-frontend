import { useState, useEffect } from "react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const useMarketHolidaysData = () => {
  const [holidaysData, setHolidays] = useState(null); // 공휴일 데이터 상태
  const [loading, setLoading] = useState(true); // 로딩 상태
  const [error, setError] = useState(null); // 에러 상태

  useEffect(() => {
    setLoading(true);

    fetch(`${API_BASE_URL}/market-holidays`)  // API 호출
      .then((res) => res.json())
      .then((holidayData) => {
        setHolidays(holidayData);  // 공휴일 데이터 설정
      })
      .catch((err) => {
        setError("공휴일 데이터를 가져오는 중 오류가 발생했습니다.");
      })
      .finally(() => {
        setLoading(false); // 로딩 완료
      });
  }, []);

  return { holidaysData, loading, error }; // 데이터 및 상태 반환
};
