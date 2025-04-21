import React, { useState } from "react";
import { useYoutubeData } from "../hooks/useYoutubeData";

import VideoCard from "../components/VideoCard";
import { newsParams } from "../constants/newsMeta";
function Home() {
  const youtubeData = useYoutubeData();
  const [expanded, setExpanded] = useState({});
  const { order } = newsParams;
  const toggle = (country) => {
    setExpanded((prev) => ({ ...prev, [country]: !prev[country] }));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", backgroundColor: "#1a1a1a", color: "#fff", minHeight: "100vh" }}>
        {/* 뉴스 카드 영역*/}
      {youtubeData  ? (
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
          {order.map((country) => {
          const video = youtubeData[country];
          if (!video) return null;
          return (
            <VideoCard
              key={country}
              country={country}
              video={video}
              isExpanded={!!expanded[country]}
              onToggle={toggle}
            />
          );
        })}
        </div>
      ) : (
        <p>Loading...</p>
      )}


    </div>
  );
}

export default Home;
