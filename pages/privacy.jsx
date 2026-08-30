// 개인정보처리방침 — 정적 서버렌더 (플레이스토어 요건 URL)
import Head from "next/head";
import Privacy from "../src/pages/Privacy";
export default function PrivacyPage() {
  return (
    <>
      <Head><title>개인정보처리방침 — NewsInsight</title></Head>
      <Privacy />
    </>
  );
}
