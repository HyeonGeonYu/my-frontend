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

      {/* 공통 푸터 — 문의 메일은 JS 조합으로 렌더(크롤러 평문 수집 방어) */}
      <footer
        style={{
          textAlign: "center",
          padding: isMobile ? "20px 12px 28px" : "28px 20px 36px",
          borderTop: "1px solid #2a2a2a",
          color: "#888",
          fontSize: isMobile ? 12 : 13,
          lineHeight: 1.7,
        }}
      >
        <div>개인 운영 트레이딩 · 뉴스 대시보드입니다.</div>
        <div>
          비즈니스 · 제휴 및 기타 문의:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            style={{ color: "#00bfff", textDecoration: "none" }}
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}

// 크롤러 평문 매칭 회피용 조합
const CONTACT_EMAIL = ["kiolswqa0987", "gmail.com"].join("@");

export default Layout;
