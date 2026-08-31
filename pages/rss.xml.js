// RSS 피드 — 네이버 서치어드바이저 제출용 + 일반 구독
import { getRecentDays } from "../src/lib/archiveDb";

const SITE = "https://hyeongeonnoil.com";

const COUNTRY_KO = {
  USA: "미국", China: "중국", Japan: "일본", India: "인도",
  HongKong: "홍콩", Korea: "한국", Germany: "독일", UK: "영국",
  Russia: "러시아", France: "프랑스", Taiwan: "대만", Vietnam: "베트남",
};

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function getServerSideProps({ res }) {
  let days = [];
  try {
    days = await getRecentDays(20);
  } catch {
    // DB 오류 시 빈 피드로 응답 (500 대신)
  }

  const items = days
    .map(({ day, countries, excerpt }) => {
      const [y, m, d] = day.split("-");
      const title = `${y}년 ${Number(m)}월 ${Number(d)}일 세계 뉴스 요약`;
      const names = countries.map((c) => COUNTRY_KO[c] || c).join("·");
      const link = `${SITE}/archive/${day}`;
      const pubDate = new Date(`${day}T09:00:00+09:00`).toUTCString();
      return `  <item>
    <title>${esc(title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${esc(`${names} 주요 뉴스 정리. ${excerpt}`)}</description>
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>NewsInsight — 날짜별 세계 뉴스 요약</title>
  <link>${SITE}/archive</link>
  <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
  <description>미국·중국·일본·한국 등 주요국 뉴스 방송을 매일 요약합니다.</description>
  <language>ko</language>
${items}
</channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
}

export default function Rss() {
  return null;
}
