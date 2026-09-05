// 개인정보처리방침 — 정적 서버렌더 (플레이스토어 요건 URL)
import Seo from "../src/components/Seo";
import Privacy from "../src/pages/Privacy";
export default function PrivacyPage() {
  return (
    <>
      <Seo
        title="개인정보처리방침 — NewsInsight"
        description="NewsInsight 서비스의 개인정보처리방침입니다."
        path="/privacy"
      />
      <Privacy />
    </>
  );
}
