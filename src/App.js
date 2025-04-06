import React, { useEffect, useState } from "react";

const API_BASE_URL = "https://news-scrap.onrender.com"; // 백엔드 API 주소

function App() {
  const [data, setData] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  useEffect(() => {
    fetch(`${API_BASE_URL}/youtube`)
      .then((response) => response.json())
      .then((jsonString) => {
        const parsedData = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
        setData(parsedData);

        // 타임스탬프도 가져오기
        fetch(`${API_BASE_URL}/youtube/timestamp`)
          .then((res) => res.text())
          .then((ts) => {
            const formatted = new Date(parseFloat(ts) * 1000).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            setTimestamp(formatted);
          });
      })
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  const toggleDescription = (country) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [country]: !prev[country],
    }));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>YouTube News Videos</h1>
        {timestamp && <div style={{ fontSize: "14px", color: "#555" }}>Last updated: {timestamp}</div>}
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
              }}
            >
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

              <div style={{ marginTop: "10px", fontSize: "13px", whiteSpace: "pre-wrap" }}>
                {expandedDescriptions[country] ? video.description : video.description.slice(0, 200) + (video.description.length > 200 ? "..." : "")}
                {video.description.length > 200 && (
                  <div>
                    <button
                      onClick={() => toggleDescription(country)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#007bff",
                        cursor: "pointer",
                        marginTop: "5px",
                        padding: 0,
                      }}
                    >
                      {expandedDescriptions[country] ? "▲ 접기" : "▼ 더보기"}
                    </button>
                  </div>
                )}
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
