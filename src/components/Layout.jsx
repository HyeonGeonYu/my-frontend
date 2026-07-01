import React from "react";
import { useCurrentTime } from "../hooks/useCurrentTime";
import { Outlet } from "react-router-dom";
import useIsMobile from "../hooks/useIsMobile";

function Layout() {
  const currentTime = useCurrentTime();
  const isMobile = useIsMobile();

  return (
    <div style={{ backgroundColor: "#1a1a1a", minHeight: "100vh", color: "#fff", fontFamily: "Arial, sans-serif" }}>
      {/* 공통 헤더 */}
      <header style={{ textAlign: "center", padding: isMobile ? "10px 8px" : "20px" }}>
        <h1 style={{ marginBottom: isMobile ? 4 : "10px", color: "#00bfff", fontSize: isMobile ? 22 : undefined }}>
          NewsInsight
        </h1>
        <div style={{ fontSize: isMobile ? "0.95rem" : "1.2rem" }}>
          <p style={{ margin: isMobile ? "2px 0" : undefined }}>{currentTime.time}</p>
          <p style={{ margin: isMobile ? "2px 0" : undefined }}>{currentTime.date}</p>
        </div>
      </header>

      {/* 개별 페이지 내용 — 페이지가 자체 패딩을 가지므로 모바일에선 이중 여백 제거 */}
      <main style={{ padding: isMobile ? 0 : "20px" }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
