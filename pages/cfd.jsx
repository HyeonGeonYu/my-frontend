import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Cfd = dynamic(() => import("../src/pages/Cfd"), { ssr: false });
export default function CfdPage() {
  return (
    <>
      <Seo
        title="CFD·FX 차트와 자동매매 시그널 | NewsInsight"
        description="MT5 기반 지수·귀금속·외환(FX) CFD 시세 차트와 자동매매 전략 시그널, 계좌 현황을 보는 대시보드입니다."
        path="/cfd"
      />
      <Cfd />
    </>
  );
}
