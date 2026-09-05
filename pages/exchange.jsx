import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Exchange = dynamic(() => import("../src/pages/Exchange"), { ssr: false });
export default function ExchangePage() {
  return (
    <>
      <Seo
        title="환율·채권 차트 — 달러 환율과 국채 금리 | NewsInsight"
        description="원달러 환율 등 주요 통화 환율과 국채 금리 흐름을 한 화면에서 보는 무료 차트 대시보드입니다."
        path="/exchange"
      />
      <Exchange />
    </>
  );
}
