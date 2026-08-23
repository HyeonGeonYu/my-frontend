// src/lib/ga.js
// GA4 로더 + SPA 페이지뷰/이벤트 헬퍼 (smilekey-site _app.js 패턴 이식).
// 측정 ID가 비어있으면 전부 무동작 — 로컬/프리뷰에서 안전.
// GA4 속성 551037396(hyeongeonnoil) 웹 스트림 — 수치 조회는 infra/ga-report.js noil
export const GA_MEASUREMENT_ID = "G-B2KMD9GYRL";

export function initGA() {
  if (!GA_MEASUREMENT_ID || window.__gaInited) return;
  window.__gaInited = true;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  // SPA라 라우트 전환 때 수동으로 page_view 전송 → 자동 전송은 꺼서 이중 집계 방지
  gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

export function trackPageview(path) {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(name, params) {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
  window.gtag("event", name, params || {});
}
