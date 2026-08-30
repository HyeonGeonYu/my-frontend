// Next용 공통 레이아웃 — 구 Layout.jsx(react-router Outlet) + Router.jsx TopNav를 합쳐 이식
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCurrentTime } from "../hooks/useCurrentTime";
import useIsMobile from "../hooks/useIsMobile";

const navItems = [
  { path: "/", label: "홈", emoji: "🏠" },
  { path: "/exchange", label: "환율, 채권", emoji: "💱" },
  { path: "/indexes", label: "지수", emoji: "📈" },
  { path: "/commodity", label: "원자재", emoji: "⛏️" },
  { path: "/coin", label: "코인", emoji: "🪙" },
  { path: "/cfd", label: "CFD", emoji: "💹" },
  { path: "/archive", label: "아카이브", emoji: "🗂️" },
  { path: "/updates", label: "업데이트", emoji: "🛠️" },
  { path: "/others", label: "기타", emoji: "🔧" },
];

const navStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "10px",
  padding: "20px",
  backgroundColor: "#222",
};

const linkStyle = {
  padding: "10px 16px",
  fontSize: "16px",
  borderRadius: "8px",
  textDecoration: "none",
  color: "#00ffcc",
  border: "1px solid #444",
  transition: "all 0.2s ease-in-out",
};

function TopNav() {
  const isMobile = useIsMobile();
  const { pathname } = useRouter();
  const nav = isMobile
    ? { ...navStyle, flexWrap: "nowrap", justifyContent: "flex-start", overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "10px 8px", gap: "6px" }
    : navStyle;
  const link = isMobile
    ? { ...linkStyle, padding: "7px 10px", fontSize: "13px", whiteSpace: "nowrap", flex: "0 0 auto" }
    : linkStyle;
  return (
    <nav style={nav}>
      {navItems.map(({ path, label, emoji }) => {
        const isActive = pathname === path;
        return (
          <Link
            key={path}
            href={path}
            style={{
              ...link,
              backgroundColor: isActive ? "#00ffcc33" : "transparent",
              borderColor: isActive ? "#00ffcc" : "#444",
            }}
          >
            <span style={{ marginRight: "6px" }}>{label}</span>
            {emoji}
          </Link>
        );
      })}
    </nav>
  );
}

// 크롤러 평문 매칭 회피용 조합
const CONTACT_EMAIL = ["kiolswqa0987", "gmail.com"].join("@");

export default function SiteLayout({ children }) {
  const currentTime = useCurrentTime();
  const isMobile = useIsMobile();

  return (
    <div style={{ backgroundColor: "#1a1a1a", minHeight: "100vh", color: "#fff", fontFamily: "Arial, sans-serif" }}>
      <TopNav />

      <header style={{ textAlign: "center", padding: isMobile ? "10px 8px" : "20px" }}>
        <h1 style={{ marginBottom: isMobile ? 4 : "10px", color: "#00bfff", fontSize: isMobile ? 22 : undefined }}>
          NewsInsight
        </h1>
        <div style={{ fontSize: isMobile ? "0.95rem" : "1.2rem" }}>
          <p style={{ margin: isMobile ? "2px 0" : undefined }}>{currentTime.time}</p>
          <p style={{ margin: isMobile ? "2px 0" : undefined }}>{currentTime.date}</p>
        </div>
      </header>

      <main style={{ padding: isMobile ? 0 : "20px" }}>{children}</main>

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
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#00bfff", textDecoration: "none" }}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}
