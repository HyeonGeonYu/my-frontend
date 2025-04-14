
import React from "react";
import { isToday } from "../utils/date";

const VideoCard = ({ country, video, isExpanded, onToggle }) => (
  <div
    style={{
      border: "1px solid #333",
      padding: "15px",
      borderRadius: "10px",
      backgroundColor: "#2a2a2a",
      boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.3)",
      width: "300px",
      textAlign: "left",
      position: "relative",
    }}
  >
    <div style={{ position: "absolute", top: "15px", right: "15px" }}>
      <span style={{ fontSize: "12px", color: isToday(video.publishedAtFormatted) ? "limegreen" : "#555" }}>
        ●
      </span>
    </div>

    <h3 style={{ marginBottom: "10px", textAlign: "center" }}>{country}</h3>
    <a href={video.url} target="_blank" rel="noopener noreferrer" style={{ color: "#00bfff", fontWeight: "bold" }}>
      {video.title}
    </a>

    <div style={{ marginTop: "10px", fontSize: "13px", color: "#ccc" }}>
      <div>🕒 업로드 시간: {video.publishedAtFormatted}</div>
      {video.processedAt && (
        <div style={{ marginTop: "4px" }}>
          ✅ 확인된 시간: {new Date(video.processedAt * 1000).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          })}
        </div>
      )}
    </div>

    {video.summary_result.length > 200 && (
      <div style={{ marginTop: "10px" }}>
        <button
          onClick={() => onToggle(country)}
          style={{
            background: "none",
            border: "none",
            color: "#00bfff",
            cursor: "pointer",
            fontSize: "13px",
            padding: 0,
          }}
        >
          {isExpanded ? "▲ 접기" : "▼ 더보기"}
        </button>
      </div>
    )}

    <div style={{ marginTop: "8px", fontSize: "13px", whiteSpace: "pre-wrap", color: "#ddd" }}>
      {isExpanded
        ? video.summary_result
        : `${video.summary_result.slice(0, 200)}${video.summary_result.length > 200 ? "..." : ""}`}
    </div>
  </div>
);

export default VideoCard;
