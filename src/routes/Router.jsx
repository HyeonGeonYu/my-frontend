import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import Home from "../pages/Home";
import Exchange from "../pages/Exchange";
import Indexes from "../pages/Indexes";
import Others from "../pages/Others";
import Layout from "../components/Layout"; // ✅ 추가

function AppRouter() {
  return (
    <Router>
      {/* 공통 네비게이션 */}
      <nav style={navStyle}>
        {navItems.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            style={({ isActive }) => ({
              ...linkStyle,
              backgroundColor: isActive ? "#00ffcc33" : "transparent",
              borderColor: isActive ? "#00ffcc" : "#444"
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* 페이지 내용은 공통 레이아웃 안에서 렌더링 */}
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/indexes" element={<Indexes />} />
          <Route path="/others" element={<Others />} />
        </Route>
      </Routes>
    </Router>
  );
}

const navItems = [
  { path: "/", label: "홈" },
  { path: "/exchange", label: "환율관련" },
  { path: "/indexes", label: "지수관련" },
  { path: "/others", label: "기타" },
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
