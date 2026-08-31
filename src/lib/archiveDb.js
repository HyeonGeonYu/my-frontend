// 서버 전용 아카이브 조회 (getStaticProps/사이트맵에서 사용) — pages/api/list.ts와 동일 env 체계
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// 전체 일자 목록 (최신순) — 사이트맵·이전/다음 링크 공용
export async function listAllDays() {
  const supabase = client();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("daily_collections")
    .select("day")
    .order("day", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => r.day).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

// 최근 N일치 요약 (RSS용) — 날짜별 개별 조회 대신 한 번에
export async function getRecentDays(limit = 15) {
  const supabase = client();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("daily_collections")
    .select("day, raw_json")
    .order("day", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || [])
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day))
    .map((r) => {
      const yt = r.raw_json?.youtube_data || {};
      const countries = Object.keys(yt);
      const first = countries.length ? yt[countries[0]]?.summary_result || "" : "";
      return { day: r.day, countries, excerpt: first.replace(/\s+/g, " ").slice(0, 300) };
    });
}

// 단일 일자의 뉴스요약(youtube_data) — SEO 페이지 본문용.
// summary_result(한국어 요약 전문)를 포함하고, 무거운 원문(summary_content)만 제외
export async function getDaySummaries(day) {
  const supabase = client();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("daily_collections")
    .select("day, raw_json")
    .eq("day", day)
    .limit(1);
  if (error) throw error;
  const row = (data || [])[0];
  if (!row) return null;

  const yt = row.raw_json?.youtube_data || {};
  const countries = {};
  for (const [country, info] of Object.entries(yt)) {
    const { summary_content, summary_items, ...rest } = info || {};
    countries[country] = {
      title: rest.title || "",
      url: rest.url || "",
      publishedAt: rest.publishedAt || "",
      summary: rest.summary_result || "",
    };
  }
  return { day: row.day, countries };
}
