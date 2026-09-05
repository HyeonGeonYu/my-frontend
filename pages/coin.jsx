import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Coin = dynamic(() => import("../src/pages/Coin"), { ssr: false });
export default function CoinPage() {
  return (
    <>
      <Seo
        title="코인 시세와 자동매매 현황 — 비트코인 차트 | NewsInsight"
        description="비트코인 등 주요 코인 시세 차트와 Bybit 자동매매 실계좌 포지션·손익·매매 전적을 공개하는 대시보드입니다."
        path="/coin"
      />
      <Coin />
    </>
  );
}
