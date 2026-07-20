// api/market-holidays.ts
// telewebhook(Render)의 /market-holidays 대체.
// 같은 Upstash Redis의 `market_holidays` 해시를 직접 읽어 프론트가 기대하는
//   { timestamp, holidays: { [국가코드]: [{date, name, description}] } }
// 형태로 반환한다.
// 생산자: News_scrap fetch_and_store_holiday_data() (Calendarific API → Redis, 매주 월요일)
export const config = { runtime: "edge" };

import { Redis } from "@upstash/redis";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      // 주 단위 갱신 데이터 → CDN 캐시로 Upstash 읽기 절감
      "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
    },
    status,
  });
}

// Upstash가 값을 문자열로 돌려주는 경우 JSON 보정 (redis-py가 json.dumps 문자열로 저장)
function parseMaybeJson(v: any) {
  if (v == null || typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return v;
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

export default async function handler(_req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ error: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  try {
    const redis = new Redis({ url, token });

    const [rawHolidays, ts] = await Promise.all([
      redis.hget("market_holidays", "all_holidays"),
      redis.hget("market_holidays", "all_holidays_timestamp"),
    ]);

    // 데이터 없음 → 빈 객체 (프론트 CalendarComponent가 "공휴일 데이터가 없습니다" 처리)
    if (rawHolidays == null) return json({});

    const holidays = parseMaybeJson(rawHolidays) || {};

    return json({
      timestamp: ts ?? null,
      holidays,
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
