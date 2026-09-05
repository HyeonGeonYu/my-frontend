import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Commodity = dynamic(() => import("../src/pages/Commodity"), { ssr: false });
export default function CommodityPage() {
  return (
    <>
      <Seo
        title="원자재 시세 차트 — 금·은·원유 | NewsInsight"
        description="금, 은, 원유 등 주요 원자재 시세 흐름을 확인하는 무료 차트 대시보드입니다."
        path="/commodity"
      />
      <Commodity />
    </>
  );
}
