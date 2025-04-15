import React, { useState } from "react";
import { useYoutubeData } from "./hooks/useYoutubeData";
import { useCurrentTime } from "./hooks/useCurrentTime";
import { useChartData } from "./hooks/useChartData";
import VideoCard from "./components/VideoCard";
import IndexChart from "./components/indexChart";


function App() {
  const youtubeData = useYoutubeData();
  const currentTime = useCurrentTime();
  const [expanded, setExpanded] = useState({});
  const { data: chartData} = useChartData();
  const toggle = (country) => {
    setExpanded((prev) => ({ ...prev, [country]: !prev[country] }));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", backgroundColor: "#1a1a1a", color: "#fff", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: "30px", textAlign: "center", color: "#00bfff" }}>NewsInsight</h1>

        {/* 현재 시간 표시 */}
      <div style={{ textAlign: "center", marginBottom: "20px", color: "#fff", fontSize: "1.2rem" }}>
        <p>{currentTime.time}</p>
        <p>{currentTime.date}</p>
      </div>

        {/* 뉴스 카드 영역*/}
      {youtubeData  ? (
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
          {Object.entries(youtubeData ).map(([country, video]) => (
            <VideoCard
              key={country}
              country={country}
              video={video}
              isExpanded={!!expanded[country]}
              onToggle={toggle}
            />
          ))}
        </div>
      ) : (
        <p>Loading...</p>
      )}

        {/* 차트 영역 */}
      <div style={{ flex: "1 1 35%" }}>
        <IndexChart data={chartData} />
      </div>
    </div>
  );
}

export default App;
