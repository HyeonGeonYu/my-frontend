// Next 전역 — 레이아웃 + GA4 + 서비스워커. 구 CRA의 index.js/Router.jsx(GaTracker) 역할 통합
import React, { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import SiteLayout from "../src/components/SiteLayout";
import { initGA, trackPageview, trackEvent } from "../src/lib/ga";

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    initGA();
    trackPageview(window.location.pathname + window.location.search);

    // 외부링크 클릭 이벤트 (전 페이지 위임 리스너 — 구 GaTracker 이식)
    const onClick = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!/^https?:\/\//.test(href)) return;
      try {
        if (new URL(href).host === window.location.host) return;
      } catch {
        return;
      }
      trackEvent("outbound_click", { link_url: href, page_path: window.location.pathname });
    };
    document.addEventListener("click", onClick);

    // PWA 서비스워커 (public/sw.js) — 설치형 앱 + 웹푸시 진입점 유지
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const onRoute = (url) => trackPageview(url);
    router.events.on("routeChangeComplete", onRoute);
    return () => router.events.off("routeChangeComplete", onRoute);
  }, [router.events]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 페이지별 <Head>가 덮어쓰는 기본값 — key가 Seo 컴포넌트와 일치해야 중복 없이 교체됨 */}
        <title>현건노일 NewsInsight — 환율·지수·코인 시세와 뉴스 대시보드</title>
        <meta
          name="description"
          content="현건노일 NewsInsight — 환율·채권·주가지수·원자재·코인 시세 차트와 전략 시그널, 세계 뉴스 요약 아카이브를 한 화면에서 보는 무료 대시보드"
          key="desc"
        />
        <meta property="og:site_name" content="현건노일 NewsInsight" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://hyeongeonnoil.com/logo512.png" />
        <meta property="og:locale" content="ko_KR" />
        <link rel="alternate" type="application/rss+xml" title="NewsInsight 뉴스 요약" href="https://hyeongeonnoil.com/rss.xml" />
      </Head>
      <SiteLayout>
        <Component {...pageProps} />
      </SiteLayout>
    </>
  );
}
