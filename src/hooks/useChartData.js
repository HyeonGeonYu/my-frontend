import { useState, useEffect } from "react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const useChartData = (endpoint) => {
  const [data, setData] = useState(null); // 데이터 상태
  const [loading, setLoading] = useState(true); // 데이터 로딩 상태
  const [error, setError] = useState(null); // 에러 상태

  useEffect(() => {
    if (!endpoint) return;
    setLoading(true);

    fetch(`${API_BASE_URL}/chartdata/${endpoint}`)
      .then((res) => res.json())
      .then((chartData) => {
        const parsedData = typeof chartData === "string" ? JSON.parse(chartData) : chartData;
        let rawData = parsedData.data;

        if (rawData && rawData.length > 0) {
          const lastItem = rawData[rawData.length - 1];

          // 마지막 아이템을 3번 복제
          const extendedData = [...rawData, lastItem, lastItem, lastItem];

          setData(extendedData); // 가공된 데이터 저장
        } else {
          setData([]); // fallback
        }
      })
      .catch((err) => {
        setError("데이터를 가져오는 중 오류가 발생했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [endpoint]);
  return { data, loading, error}; // 데이터와 상태를 반환
};
