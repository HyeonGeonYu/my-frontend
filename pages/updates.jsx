import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Updates = dynamic(() => import("../src/pages/Updates"), { ssr: false });
export default function UpdatesPage() {
  return (
    <>
      <Seo
        title="업데이트 기록 — 트레이딩봇 전략 변경 이력 | NewsInsight"
        description="트레이딩봇 전략과 대시보드 기능의 날짜별 업데이트 기록입니다."
        path="/updates"
      />
      <Updates />
    </>
  );
}
