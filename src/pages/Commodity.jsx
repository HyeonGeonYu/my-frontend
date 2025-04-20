import React from "react";
import IndexChart from "../components/indexChart";
import { useAllChartData } from "../hooks/useAllChartData";
import {chartParams} from "../constants/chartMeta";

function Commodity() {
  // useChartData 훅을 통해 각 환율 데이터를 가져옵니다.
  const { data, loading, error } = useAllChartData("commodity");
  const envelope = 10;
  const currencyList = chartParams['commodity'] || [];

  if (loading) return <p>📊 로딩 중...</p>;
  if (error) return <p>❌ {error}</p>;

  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>원자재 관련(+-10%)</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "40px" }}>
        {currencyList.map((index) => (
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

export default Commodity;
