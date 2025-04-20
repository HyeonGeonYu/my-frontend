import React from "react";
import IndexChart from "../components/indexChart";
import { useAllChartData } from "../hooks/useAllChartData";
import { chartParams } from "../constants/chartMeta"; // chartMeta.js에서 import
function Indexes() {
  // useChartData는 최상단에서 호출!
  const { data, loading, error } = useAllChartData("index");
  const envelope = 10;
  const selectedList = chartParams['index'] || [];
  if (loading) return <p>📊 로딩 중...</p>;
  if (error) return <p>❌ {error}</p>;

  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>지수 관련(+-10%)</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "40px" }}>
        {selectedList.map((index) => (
          <div key={index.label} style={{ backgroundColor: "#222", padding: "20px", borderRadius: "12px" }}>
            <IndexChart
            dataName={index.label}
            data={data[index.key]}
            envelope={envelope}
          />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Indexes;
