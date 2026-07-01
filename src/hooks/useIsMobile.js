// src/hooks/useIsMobile.js
// 뷰포트 폭 기반 모바일 판별 훅. 인라인 스타일 기반 레이아웃에서 반응형 분기를 위해 사용.
//   const isMobile = useIsMobile();        // <=768px
//   const isMobile = useIsMobile(600);     // 커스텀 브레이크포인트
import { useState, useEffect } from "react";

export default function useIsMobile(breakpoint = 768) {
  const get = () =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false;

  const [isMobile, setIsMobile] = useState(get);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}
