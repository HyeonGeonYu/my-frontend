import React from "react";
import IndexChart from "../components/indexChart";
import { useChartData } from "../hooks/useChartData";
function Indexes() {
  const dataName = "NASDAQ 100";  // 차트 이름 설정
  const { data: chartData} = useChartData("nasdaq100");

  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>지수 관련</h1>

          {/* 차트 영역 */}
      <div style={{ flex: "1 1 35%" }}>
        <IndexChart data={chartData} dataName={dataName} />
      </div>
    </div>
  );
}

export default Indexes;