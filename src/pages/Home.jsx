import React from "react";
import { useYoutubeData } from "../hooks/useYoutubeData";

import VideoCard from "../components/VideoCard";
import CalendarComponent from "../components/CalendarComponent"; // 경로에 맞게 수정
import WorldRelationMap from "../components/home/WorldRelationMap";
import { newsParams } from "../constants/newsMeta";
function Home() {
  const youtubeData = useYoutubeData();
  const { order } = newsParams;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", backgroundColor: "#1a1a1a", color: "#fff", minHeight: "100vh" }}>

      {/* 세계 정세 현황판 */}
      <WorldRelationMap />

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
            />
          );
        })}
        </div>
      ) : (
        <p>Loading...</p>
      )}

      {/* 달력 추가 */}
        <div
          style={{
            marginTop: "40px",
            padding: "20px",
            backgroundColor: "#2c2c2c",
            borderRadius: "8px",
            maxWidth: "370px",      // ✅ 최대 너비 제한
            margin: "40px auto 0",  // ✅ 가운데 정렬 + 위 여백
          }}
        >
          <h2 style={{ textAlign: "center", color: "#fff" }}>🌍 국제 공휴일 캘린더</h2>
          <CalendarComponent />
        </div>



    </div>
  );
}

export default Home;
