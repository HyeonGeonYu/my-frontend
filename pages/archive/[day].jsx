// 날짜별 세계 뉴스 요약 — 서버렌더 SEO 페이지 (Next 전환의 핵심 목적)
// ISR: 첫 요청 시 생성 후 1시간 캐시. 콘텐츠는 발행 후 불변에 가까움.
import Head from "next/head";
import Link from "next/link";
import { listAllDays, getDaySummaries } from "../../src/lib/archiveDb";

const COUNTRY_KO = {
  USA: "미국", China: "중국", Japan: "일본", India: "인도",
  HongKong: "홍콩", Korea: "한국", Germany: "독일", UK: "영국",
  Russia: "러시아", France: "프랑스", Taiwan: "대만", Vietnam: "베트남",
};

const box = { maxWidth: 780, margin: "0 auto", padding: "8px 16px 40px", color: "#eee" };
const card = { background: "#242424", borderRadius: 10, padding: "16px 18px", marginBottom: 16 };

export default function ArchiveDayPage({ day, countries, prevDay, nextDay }) {
  const [y, m, d] = day.split("-");
  const names = Object.keys(countries);
  const firstSummary = names.length ? (countries[names[0]].summary || "").split("\n")[0] : "";
  const title = `${y}년 ${Number(m)}월 ${Number(d)}일 세계 뉴스 요약 — NewsInsight`;
  const desc = `${names.map((c) => COUNTRY_KO[c] || c).join("·")} 주요 뉴스 정리. ${firstSummary}`.slice(0, 150);

  return (
    <div style={box}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={`https://hyeongeonnoil.com/archive/${day}`} />
        <link rel="canonical" href={`https://hyeongeonnoil.com/archive/${day}`} />
      </Head>

      <h1 style={{ color: "#00bfff", fontSize: 24 }}>
        {y}년 {Number(m)}월 {Number(d)}일 세계 뉴스 요약
      </h1>
      <p style={{ color: "#999", fontSize: 13 }}>
        각국 주요 뉴스 방송을 요약한 기록입니다. 전체 목록은{" "}
        <Link href="/archive" style={{ color: "#00ffcc" }}>아카이브</Link>에서 볼 수 있습니다.
      </p>

      {names.map((c) => {
        const info = countries[c];
        return (
          <section key={c} style={card}>
            <h2 style={{ color: "#00ffcc", fontSize: 18, marginTop: 0 }}>
              {COUNTRY_KO[c] || c}
            </h2>
            {info.title && <p style={{ color: "#bbb", fontSize: 13, wordBreak: "break-all" }}>{info.title}</p>}
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 15 }}>{info.summary}</div>
            {info.url && (
              <p style={{ marginBottom: 0 }}>
                <a href={info.url} target="_blank" rel="noreferrer" style={{ color: "#00bfff", fontSize: 13 }}>
                  원본 영상 보기 →
                </a>
              </p>
            )}
          </section>
        );
      })}

      <nav style={{ display: "flex", justifyContent: "space-between", marginTop: 24, fontSize: 14 }}>
        <span>{prevDay && <Link href={`/archive/${prevDay}`} style={{ color: "#00ffcc" }}>← {prevDay}</Link>}</span>
        <span>{nextDay && <Link href={`/archive/${nextDay}`} style={{ color: "#00ffcc" }}>{nextDay} →</Link>}</span>
      </nav>
    </div>
  );
}

export async function getStaticPaths() {
  // 전량 사전 생성 대신 요청 시 생성(blocking) — 빌드 시간 절약, 과거 날짜도 접근 가능
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps({ params }) {
  const day = String(params.day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { notFound: true };

  try {
    const [detail, allDays] = await Promise.all([getDaySummaries(day), listAllDays()]);
    if (!detail || !Object.keys(detail.countries).length) {
      return { notFound: true, revalidate: 600 };
    }
    const idx = allDays.indexOf(day); // allDays는 최신순
    return {
      props: {
        day,
        countries: detail.countries,
        prevDay: idx >= 0 && idx + 1 < allDays.length ? allDays[idx + 1] : null,
        nextDay: idx > 0 ? allDays[idx - 1] : null,
      },
      revalidate: 3600,
    };
  } catch (e) {
    // 일시 DB 오류가 404로 박제되지 않게 — 짧게 재시도
    return { notFound: true, revalidate: 60 };
  }
}
