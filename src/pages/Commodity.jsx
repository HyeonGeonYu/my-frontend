import React from "react";
import IndexChart from "../components/indexChart";
import { useChartData } from "../hooks/useChartData";

function Indexes() {
  // useChartData는 최상단에서 호출!
  const goldData = useChartData("gold");
  const indexList = [
    { label: "Gold", data: goldData.data },
  ];

  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>원자재 관련</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "40px" }}>
        {indexList.map(({ label, data }) => (
          <div key={label} style={{ backgroundColor: "#222", padding: "20px", borderRadius: "12px" }}>
            <IndexChart data={data} dataName={label} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Indexes;
