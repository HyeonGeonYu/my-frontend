import React, { useState } from "react";
import { useYoutubeData } from "./hooks/useYoutubeData";
import { useCurrentTime } from "./hooks/useCurrentTime";
import VideoCard from "./components/VideoCard";

function App() {
  const data = useYoutubeData();
  const currentTime = useCurrentTime();
  const [expanded, setExpanded] = useState({});

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

      {data ? (
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
          {Object.entries(data).map(([country, video]) => (
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
    </div>
  );
}

export default App;
