import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { listAllDays } from "../../src/lib/archiveDb";

const Archive = dynamic(() => import("../../src/pages/Archive"), { ssr: false });

// 날짜별 페이지로 가는 링크를 서버렌더 — 크롤러가 사이트맵 없이도 전 날짜를 발견하게 함
function DayIndex({ days }) {
  if (!days.length) return null;
  return (
    <nav style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px 40px", borderTop: "1px solid #2a2a2a" }}>
      <h2 style={{ color: "#00ffcc", fontSize: 16 }}>날짜별 뉴스 요약</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {days.map((d) => (
          <Link
            key={d}
            href={`/archive/${d}`}
            style={{ color: "#9bd", fontSize: 13, textDecoration: "none", border: "1px solid #333", borderRadius: 6, padding: "4px 8px" }}
          >
            {d}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function ArchivePage({ days }) {
  return (
    <>
      <Head>
        <title>뉴스 아카이브 — 날짜별 세계 뉴스 요약 | NewsInsight</title>
        <meta
          name="description"
          content="미국·중국·일본·한국 등 주요국 뉴스 방송을 날짜별로 요약한 기록입니다."
          key="desc"
        />
        <link rel="canonical" href="https://hyeongeonnoil.com/archive" key="canonical" />
      </Head>
      <Archive />
      <DayIndex days={days} />
    </>
  );
}

export async function getStaticProps() {
  try {
    return { props: { days: await listAllDays() }, revalidate: 3600 };
  } catch {
    return { props: { days: [] }, revalidate: 300 };
  }
}
