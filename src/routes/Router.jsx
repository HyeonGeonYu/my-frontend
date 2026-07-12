import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import Home from "../pages/Home";
import Exchange from "../pages/Exchange";
import Indexes from "../pages/Indexes";
import Commodity from "../pages/Commodity";
import Coin from "../pages/Coin";
import Cfd from "../pages/Cfd";
import Archive from "../pages/Archive";
import Updates from "../pages/Updates";
import Others from "../pages/Others";
import Layout from "../components/Layout";
import useIsMobile from "../hooks/useIsMobile";

function TopNav() {
  const isMobile = useIsMobile();
  // 모바일: 한 줄 가로 스크롤(8개 탭이 3줄 차지하던 것 절약), 데스크톱: 기존 래핑 중앙정렬
  const nav = isMobile
    ? { ...navStyle, flexWrap: "nowrap", justifyContent: "flex-start", overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "10px 8px", gap: "6px" }
    : navStyle;
  const link = isMobile
    ? { ...linkStyle, padding: "7px 10px", fontSize: "13px", whiteSpace: "nowrap", flex: "0 0 auto" }
    : linkStyle;
  return (
    <nav style={nav}>
      {navItems.map(({ path, label, emoji }) => (
        <NavLink
          key={path}
          to={path}
          style={({ isActive }) => ({
            ...link,
            backgroundColor: isActive ? "#00ffcc33" : "transparent",
            borderColor: isActive ? "#00ffcc" : "#444",
          })}
        >
          <span style={{ marginRight: "6px" }}>{label}</span>
          {emoji}
        </NavLink>
      ))}
    </nav>
  );
}

function AppRouter() {
  return (
    <Router>
      {/* 공통 네비게이션 */}
      <TopNav />

      {/* 페이지 내용은 공통 레이아웃 안에서 렌더링 */}
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/indexes" element={<Indexes />} />
          <Route path="/commodity" element={<Commodity />} />
          <Route path="/coin" element={<Coin />} />
          <Route path="/cfd" element={<Cfd />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/others" element={<Others />} />
        </Route>
      </Routes>
    </Router>
  );
}

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

export default AppRouter;
