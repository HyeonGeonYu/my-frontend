// 페이지별 SEO 메타 — title·description·self-canonical·OG를 한 번에.
// GSC 진단(09-05): canonical 부재로 구글이 www를 표준으로 선택, 전 페이지 동일 메타로 /coin 미색인.
// key는 _app의 기본 description과 맞춰야 중복 태그 없이 오버라이드됨.
import Head from "next/head";

const ORIGIN = "https://hyeongeonnoil.com";

export default function Seo({ title, description, path }) {
  const url = `${ORIGIN}${path}`;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} key="desc" />
      <link rel="canonical" href={url} key="canonical" />
      <meta property="og:title" content={title} key="og-title" />
      <meta property="og:description" content={description} key="og-desc" />
      <meta property="og:url" content={url} key="og-url" />
    </Head>
  );
}
