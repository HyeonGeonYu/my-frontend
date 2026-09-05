import dynamic from "next/dynamic";
import Seo from "../src/components/Seo";
const Others = dynamic(() => import("../src/pages/Others"), { ssr: false });
export default function OthersPage() {
  return (
    <>
      <Seo
        title="기타 자료 | NewsInsight"
        description="NewsInsight의 기타 자료와 도구 모음입니다."
        path="/others"
      />
      <Others />
    </>
  );
}
