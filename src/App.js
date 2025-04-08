import React, { useEffect, useState } from "react";

const API_BASE_URL = "https://news-scrap.onrender.com"; // 백엔드 API 주소
// 오프라인 "http://127.0.0.1:8000"
// 온라인 "https://news-scrap.onrender.com"

function App() {
  const [data, setData] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/youtube`).then((res) => res.json()),
      fetch(`${API_BASE_URL}/youtube/timestamp`).then((res) => res.text()),
    ])
      .then(([videoData, ts]) => {
        const parsedData = typeof videoData === "string" ? JSON.parse(videoData) : videoData;
        setData(parsedData);

        const parsedTs = parseFloat(ts);
        if (!isNaN(parsedTs)) {
          const formatted = new Date(parsedTs * 1000).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          setTimestamp(formatted);
        } else {
          setTimestamp("Invalid Timestamp");
        }
      })
      .catch((err) => {
        console.error("❌ Error fetching data:", err);
      });
  }, []);

  const toggleDescription = (country) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [country]: !prev[country],
    }));
  };

  const isToday = (dateString) => {
    const today = new Date();
    const date = new Date(dateString);
    return (
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth() &&
      today.getDate() === date.getDate()
    );
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>YouTube News Videos</h1>
        {timestamp && (
          <div style={{ fontSize: "14px", color: "#555" }}>
            Last updated: {timestamp}{" "}
            <span style={{ fontSize: "12px", marginLeft: "4px" }}>(한국 시간 기준)</span>
          </div>
        )}
      </div>

      {data ? (
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
          {Object.entries(data).map(([country, video]) => (
            <div
              key={country}
              style={{
                border: "1px solid #ddd",
                padding: "15px",
                borderRadius: "10px",
                backgroundColor: "#fff",
                boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                width: "300px",
                textAlign: "left",
                position: "relative",
              }}
            >
              {/* 🔵 업데이트 상태 표시 점 */}
              <div style={{ position: "absolute", top: "15px", right: "15px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    color: isToday(video.publishedAtFormatted) ? "green" : "#ccc",
                  }}
                >
                  ●
                </span>
              </div>

              <h3 style={{ marginBottom: "10px", textAlign: "center" }}>{country}</h3>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#007bff", fontWeight: "bold" }}
              >
                {video.title}
              </a>
              <p style={{ marginTop: "5px", fontSize: "14px", color: "#666" }}>
                📅 {video.publishedAtFormatted}
              </p>

              {/* ▼ 설명 토글 버튼을 위로 이동 */}
              {video.description.length > 200 && (
                <div style={{ marginTop: "10px" }}>
                  <button
                    onClick={() => toggleDescription(country)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#007bff",
                      cursor: "pointer",
                      fontSize: "13px",
                      padding: 0,
                    }}
                  >
                    {expandedDescriptions[country] ? "▲ 접기" : "▼ 더보기"}
                  </button>
                </div>
              )}

              {/* 설명 내용 */}
              <div style={{ marginTop: "8px", fontSize: "13px", whiteSpace: "pre-wrap" }}>
                {expandedDescriptions[country]
                  ? video.description
                  : video.description.slice(0, 200) +
                    (video.description.length > 200 ? "..." : "")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}

export default App;
