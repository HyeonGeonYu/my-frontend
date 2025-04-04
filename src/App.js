import React, { useEffect, useState } from "react";

const API_BASE_URL = "https://news-scrap.onrender.com"; // 백엔드 API 주소

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/youtube`)
      .then((response) => response.json())
      .then((jsonString) => {
        // JSON 문자열을 객체로 변환
        const parsedData = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
        setData(parsedData);
      })
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", textAlign: "center" }}>
      <h1>YouTube News Videos</h1>

      {data ? (
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
          {Object.entries(data).map(([country, url]) => (
            <div
              key={country}
              style={{
                border: "1px solid #ddd",
                padding: "15px",
                borderRadius: "10px",
                backgroundColor: "#fff",
                boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                width: "300px",
                textAlign: "center",
              }}
            >
              <h3 style={{ marginBottom: "10px" }}>{country}</h3>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#007bff", textDecoration: "none", fontWeight: "bold" }}
              >
                {url}
              </a>
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
