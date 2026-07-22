// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { Analytics } from "@vercel/analytics/react";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <>
      <App />
      <Analytics />
    </>
  </React.StrictMode>
);

reportWebVitals();

// PWA 서비스워커 등록 (public/sw.js) — 설치형 앱 + 웹푸시 진입점.
//   dev에서는 HMR 간섭 방지를 위해 등록하지 않음.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
