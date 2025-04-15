import { useState, useEffect } from "react";

const API_BASE_URL = "https://news-scrap.onrender.com";

export const useChartData = () => {
  const [data, setData] = useState(null); // 나스닥 데이터 상태
  const [loading, setLoading] = useState(true); // 데이터 로딩 상태
  const [error, setError] = useState(null); // 에러 상태

  useEffect(() => {
    // 나스닥 데이터 API 호출
    fetch(`${API_BASE_URL}/index_data/nasdaq100`) // 나스닥 데이터 API URL
      .then((res) => res.json())
      .then((chartData) => {
        const parsedData = typeof chartData === "string" ? JSON.parse(chartData) : chartData;
        setData(parsedData.data); // 데이터 상태에 저장
      })
      .catch((err) => {
        console.error("❌ Error fetching Nasdaq data:", err);
        setError("데이터를 가져오는 중 오류가 발생했습니다.");
      })
      .finally(() => {
        setLoading(false); // 로딩 상태 종료
      });
  }, []); // 컴포넌트가 마운트될 때 한 번만 실행

  return { data, loading, error }; // 데이터와 상태를 반환
};
