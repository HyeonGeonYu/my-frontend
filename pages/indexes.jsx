import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Indexes = dynamic(() => import("../src/pages/Indexes"), { ssr: false });
export default function IndexesPage() {
  return (
    <>
      <Seo
        title="세계 주가지수 차트 | NewsInsight"
        description="미국·아시아·유럽 주요 주가지수 시세와 변동 흐름을 확인하는 무료 차트 대시보드입니다."
        path="/indexes"
      />
      <Indexes />
    </>
  );
}
