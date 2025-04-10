import React, { useEffect, useState } from "react";

// ✅ API BASE URL 설정
const API_BASE_URL = "https://news-scrap.onrender.com"; // 🔵 배포용
//const API_BASE_URL = "http://127.0.0.1:8000"; // 🧪 로컬 개발용

function App() {
  const [data, setData] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  useEffect(() => {
    fetch(`${API_BASE_URL}/youtube`)
      .then((res) => res.json())
      .then((videoData) => {
        const parsedData = typeof videoData === "string" ? JSON.parse(videoData) : videoData;
        setData(parsedData);
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

  const isToday = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();

    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  const parseSummaryItems = (text) => {
    const matches = text.match(/(\d+)\.\s\*\*(.+?)\*\*:\s(.+?)(?=\n\d+\.|\n*$)/gs);
    if (!matches) return [];

    return matches.map((item) => {
      const match = item.match(/(\d+)\.\s\*\*(.+?)\*\*:\s(.+)/s);
      return {
        number: match[1],
        title: match[2],
        content: match[3].trim(),
      };
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: "30px" }}>YouTube News Videos</h1>

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

              {/* 시간 정보 */}
              <div style={{ marginTop: "10px", fontSize: "13px", color: "#444" }}>
                <div>🕒 업로드 시간: {video.publishedAtFormatted}</div>
                {video.processedAt && (
                  <div style={{ marginTop: "4px" }}>
                    ✅ 확인된 시간:{" "}
                    {new Date(video.processedAt * 1000).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>

              {/* ▼ 설명 토글 버튼 */}
              {video.summary_result.length > 200 && (
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
                {expandedDescriptions[country] ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {parseSummaryItems(video.summary_result).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: "8px",
                          padding: "10px",
                          backgroundColor: "#f9f9f9",
                        }}
                      >
                        <strong>{item.number}. {item.title}</strong>
                        <p style={{ margin: "5px 0 0", fontSize: "13px", lineHeight: "1.4" }}>
                          {item.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#555" }}>
                    {video.summary_result.slice(0, 200)}
                    {video.summary_result.length > 200 && "..."}
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
