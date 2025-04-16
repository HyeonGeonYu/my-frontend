import React, { useState } from "react";
import { useYoutubeData } from "../hooks/useYoutubeData";

import VideoCard from "../components/VideoCard";


function Home() {
  const youtubeData = useYoutubeData();
  const [expanded, setExpanded] = useState({});

  const toggle = (country) => {
    setExpanded((prev) => ({ ...prev, [country]: !prev[country] }));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", backgroundColor: "#1a1a1a", color: "#fff", minHeight: "100vh" }}>
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


    </div>
  );
}

export default Home;
