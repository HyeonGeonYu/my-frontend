import React from "react";
import { isToday } from "../utils/date";
import NewsSummary from "./common/NewsSummary";

const VideoCard = ({ country, video }) => {
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
        width: "320px",
        textAlign: "left",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: "15px", right: "15px" }}>
        <span
          style={{
            fontSize: "12px",
            color: isToday(video.publishedAt) ? "limegreen" : "#555",
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
        <div>🕒 업로드: {timeAgo}</div>
        {video.processed_time && (
          <div style={{ marginTop: "4px" }}>
            ✅ 확인:{" "}
            {(() => {
              const date = new Date(video.processed_time);
              const options = { timeZone: "Asia/Seoul" };
              const weekday = date.toLocaleDateString("ko-KR", { ...options, weekday: "short" }); // 월, 화, 수 등
              const monthDay = date.toLocaleDateString("ko-KR", {
                ...options,
                month: "long",
                day: "numeric",
              });
              const time = date.toLocaleTimeString("ko-KR", {
                ...options,
                hour: "2-digit",
                minute: "2-digit",
              });
              return `${monthDay} (${weekday}) ${time}`;
            })()}
          </div>
        )}
      </div>

      {/* 뉴스 요약 — 국가별 순위 섹션(아코디언) */}
      <div style={{ marginTop: "12px" }}>
        <NewsSummary items={video.summary_items} summaryText={video.summary_result} />
      </div>
    </div>
  );
};

export default VideoCard;
