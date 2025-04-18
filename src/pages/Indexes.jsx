import React from "react";
import IndexChart from "../components/indexChart";
import { useChartData } from "../hooks/useChartData";

function Indexes() {
  // useChartData는 최상단에서 호출!
  const nasdaqData = useChartData("nasdaq100");
  const nikkeiData = useChartData("nikkei225");
  const hangsengData = useChartData("hangseng");
  const kospiData = useChartData("kospi200");

  const indexList = [
    { label: "NASDAQ 100", data: nasdaqData.data },
    { label: "Nikkei 225", data: nikkeiData.data },
    { label: "Hang Seng", data: hangsengData.data },
    { label: "KOSPI 200", data: kospiData.data },
  ];

  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>지수 관련</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "40px" }}>
        {indexList.map(({ label, data }) => (
          <div key={label} style={{ backgroundColor: "#222", padding: "20px", borderRadius: "12px" }}>
            {data ? (
              <IndexChart data={data} dataName={label} />
            ) : (
              <div style={{ color: "#888" }}>📊 {label} 데이터 로딩 중...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Indexes;
