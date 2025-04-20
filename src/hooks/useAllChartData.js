// hooks/useAllChartData.js
import { useState, useEffect } from "react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const useAllChartData = (endpointPath) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!endpointPath) return;

    const endpoint = `${API_BASE_URL}/chartdata/${endpointPath}`; // ← 동적으로 조합

      fetch(endpoint)
      .then((res) => res.json())
      .then((chartData) => {
        const parsedData = typeof chartData === "string" ? JSON.parse(chartData) : chartData;

        const extended = {};
        for (const  [key, rawData] of Object.entries(parsedData)) {
          if (Array.isArray(rawData) && rawData.length > 0) {
            const lastItem = rawData[rawData.length - 1];
            extended[key] = [...rawData, lastItem, lastItem, lastItem];
          } else {
            extended[key] = [];
          }
        }

        setData(extended);
      })
      .catch(() => {
        setError("데이터를 불러오는 데 실패했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [endpointPath]);

  return { data, loading, error };
};
