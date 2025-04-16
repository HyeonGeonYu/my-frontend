import React from "react";
import { useCurrentTime } from "../hooks/useCurrentTime";
import { Outlet } from "react-router-dom";

function Layout() {
  const currentTime = useCurrentTime();

  return (
    <div style={{ backgroundColor: "#1a1a1a", minHeight: "100vh", color: "#fff", fontFamily: "Arial, sans-serif" }}>
      {/* 공통 헤더 */}
      <header style={{ textAlign: "center", padding: "20px" }}>
        <h1 style={{ marginBottom: "10px", color: "#00bfff" }}>NewsInsight</h1>
        <div style={{ fontSize: "1.2rem" }}>
          <p>{currentTime.time}</p>
          <p>{currentTime.date}</p>
        </div>
      </header>

      {/* 개별 페이지 내용 */}
      <main style={{ padding: "20px" }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
