import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { initGA, trackPageview, trackEvent } from "../lib/ga";
import Home from "../pages/Home";
import Exchange from "../pages/Exchange";
import Indexes from "../pages/Indexes";
import Commodity from "../pages/Commodity";
import Coin from "../pages/Coin";
import Cfd from "../pages/Cfd";
import Archive from "../pages/Archive";
import Updates from "../pages/Updates";
import Others from "../pages/Others";
import Privacy from "../pages/Privacy";
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

// GA4: 최초 로드 + 라우트 전환 페이지뷰, 외부링크 클릭 이벤트 (전 페이지 위임 리스너)
function GaTracker() {
  const location = useLocation();

  useEffect(() => {
    initGA();
    const onClick = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!/^https?:\/\//.test(href)) return;
      try {
        if (new URL(href).host === window.location.host) return;
      } catch { return; }
      trackEvent("outbound_click", { link_url: href, page_path: window.location.pathname });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}

function AppRouter() {
  return (
    <Router>
      <GaTracker />
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
          {/* 플레이스토어 개인정보처리방침 URL 요건 — 상단 탭에는 노출하지 않음 */}
          <Route path="/privacy" element={<Privacy />} />
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
