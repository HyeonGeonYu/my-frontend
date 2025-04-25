import React, { useState, useEffect } from "react";
import IndexChart from "../components/indexChart";
import { useAllChartData } from "../hooks/useAllChartData";
import { chartParams } from "../constants/chartMeta"; // chartMeta.js에서 import

const ChartPage = ({ chartType, title, envelop }) => {

  // `chartType`에 따라 데이터를 가져옵니다.
  const { processedData, loading, error } = useAllChartData(chartType);
  const envelope = envelop;
  const selectedList = chartParams[chartType] || [];

  // 그리드 열 수를 동적으로 설정
  const [gridColumns, setGridColumns] = useState("1fr"); // 기본 1개의 열로 설정

  // 화면 크기 변경에 따라 그리드 열 수를 업데이트
  const updateGridColumns = () => {
    const width = window.innerWidth;
    if (width > 1900) {
      setGridColumns("repeat(4, 1fr)"); // 큰 화면에서 3개의 열
    }
    else if (width > 1400) {
      setGridColumns("repeat(3, 1fr)"); // 큰 화면에서 3개의 열
    } else if (width > 1000) {
      setGridColumns("repeat(2, 1fr)"); // 중간 화면에서 2개의 열
    } else {
      setGridColumns("1fr"); // 작은 화면에서 1개의 열
    }
  };

  // 컴포넌트가 처음 렌더링될 때와 화면 크기 변경 시에 updateGridColumns 호출
  useEffect(() => {
    updateGridColumns(); // 초기 렌더링 시 실행
    window.addEventListener("resize", updateGridColumns); // 화면 크기 변경 시 실행

    // cleanup: 화면 크기 이벤트 리스너 제거
    return () => {
      window.removeEventListener("resize", updateGridColumns);
    };
  }, []);

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
        {selectedList.map((index) => (
          <div
            key={index.label}
            style={{
              backgroundColor: "transparent", // 배경을 투명하게 설정
              padding: "20px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column", // 세로로 배치
              alignItems: "center", // 가로 중앙 정렬
            }}
          >
            <IndexChart dataName={index.label} processedData={processedData[index.key]} envelope={envelope} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartPage;
