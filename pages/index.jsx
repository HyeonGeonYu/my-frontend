import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Home = dynamic(() => import("../src/pages/Home"), { ssr: false });
export default function HomePage() {
  return (
    <>
      <Seo
        title="현건노일 NewsInsight — 환율·지수·코인 시세와 뉴스 대시보드"
        description="현건노일 NewsInsight — 환율·채권·주가지수·원자재·코인 시세 차트와 전략 시그널, 세계 뉴스 요약 아카이브를 한 화면에서 보는 무료 대시보드"
        path="/"
      />
      <Home />
    </>
  );
}
