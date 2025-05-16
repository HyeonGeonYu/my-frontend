// hooks/useAllChartData.js
import { useState, useEffect } from "react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const useAllChartData = (endpointInput) => {
  const [processedData, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!endpointInput || (Array.isArray(endpointInput) && endpointInput.length === 0)) {
      setLoading(false);
      return;
    }

    const endpointList = Array.isArray(endpointInput) ? endpointInput : [endpointInput];

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          endpointList.map(async (endpointPath) => {
            const endpoint = `${API_BASE_URL}/chartdata/${endpointPath}`;
            const res = await fetch(endpoint);
            const chartData = await res.json();

            const parsedData = typeof chartData === "string" ? JSON.parse(chartData) : chartData;
            return parsedData;
          })
        );

        const mergedData = {};
        console.log(results)
        for (const parsed of results) {
          for (const [key, rawData] of Object.entries(parsed)) {

            const originalArray = rawData.data;
            const processed_time = rawData.processed_time;

            mergedData[key] = {
              data: Array.isArray(originalArray) ? [...originalArray] : [],
              processed_time: processed_time || '',
            };
          }
        }

        setData(mergedData);
        setError(null);
      } catch (err) {
        setError("데이터를 불러오는 데 실패했습니다.");
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

  }, [endpointInput]);

  return { processedData, loading, error };
};
