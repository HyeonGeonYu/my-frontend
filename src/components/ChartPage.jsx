// src/components/ChartPage.jsx

import React, { useState, useEffect, useCallback } from "react";
import IndexChart from "../components/indexChart";
import { useAllChartData } from "../hooks/useAllChartData";
import { chartParams } from "../constants/chartMeta"; // chartMeta.js에서 import

const ChartPage = ({ chartType, title, envelop }) => {

  const { processedData, loading, error } = useAllChartData(chartType);

  const envelope = envelop;
  const chartTypeList = Array.isArray(chartType) ? chartType : [chartType];

  const selectedList = chartTypeList.flatMap((type) => chartParams[type] || []);
  const [gridColumns, setGridColumns] = useState("1fr");

  const updateGridColumns = useCallback(() => {
    const width = window.innerWidth;
    if (width > 1900) {
      setGridColumns("repeat(4, 1fr)");
    } else if (width > 1400) {
      setGridColumns("repeat(3, 1fr)");
    } else if (width > 1000) {
      setGridColumns("repeat(2, 1fr)");
    } else {
      setGridColumns("1fr");
    }
  }, []);

  useEffect(() => {
    updateGridColumns();
    window.addEventListener("resize", updateGridColumns);
    return () => {
      window.removeEventListener("resize", updateGridColumns);
    };
  }, [updateGridColumns]);

  if (loading) return <p>📊 로딩 중...</p>;
  if (error) return <p>❌ {error}</p>;

  return (

    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>{title}</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns, // 동적으로 설정된 gridTemplateColumns
          gap: "40px",
          marginTop: "40px",
        }}
      >
        {selectedList.map((index) => {
  const chartData = processedData[index.key];

  if (!chartData || !chartData.data || chartData.data.length === 0) return null;

  return (
    <div
      key={index.label}
      style={{
        backgroundColor: "transparent",
        padding: "20px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <IndexChart
        dataName={index.label}
        processedData={chartData}
        envelope={envelope}
      />
    </div>
  );
})}
      </div>
    </div>
  );
};

export default ChartPage;
