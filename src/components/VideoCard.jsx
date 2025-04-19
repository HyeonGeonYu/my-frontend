import React from "react";
import { isToday } from "../utils/date";

const VideoCard = ({ country, video, isExpanded, onToggle }) => {
  // ⏱️ 업로드된 시간 차이 계산
  const uploadedAt = new Date(video.publishedAt); // 이미 한국 시간(KST)으로 되어 있음
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }); // 한국 시간으로 변환
  const nowKST = new Date(now); // 문자열을 다시 Date 객체로 변환
  const diffMs = nowKST - uploadedAt;
  const diffMinutes = Math.floor(diffMs / 60000); // 1분 = 60000ms
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const timeAgo =
    hours > 0 ? `${hours}시간 ${minutes}분 전` : `${minutes}분 전`;
  return (
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
        <span
          style={{
            fontSize: "12px",
            color: isToday(video.publishedAt)
              ? "limegreen"
              : "#555",
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
        style={{ color: "#00bfff", fontWeight: "bold" }}
      >
        {video.title}
      </a>
      <div style={{ marginTop: "10px", fontSize: "13px", color: "#ccc" }}>
        <div>🕒 업로드: {timeAgo} </div>
        {video.ts && (
          <div style={{ marginTop: "4px" }}>
            ✅ 확인:{" "}
            {new Date(video.ts).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {video.summary_result && video.summary_result.length > 200 && (
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

      <div
        style={{
          marginTop: "8px",
          fontSize: "13px",
          whiteSpace: "pre-wrap",
          color: "#ddd",
        }}
      >
        {video.summary_result
          ? isExpanded
            ? video.summary_result
            : `${video.summary_result.slice(0, 200)}${
                video.summary_result.length > 200 ? "..." : ""
              }`
          : "요약 없음"}
      </div>
    </div>
  );
};

export default VideoCard;
