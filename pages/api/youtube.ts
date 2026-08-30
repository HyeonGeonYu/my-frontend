// api/youtube.ts
// telewebhook(Render)의 /youtube 대체.
// 같은 Upstash Redis의 `youtube_data` 해시 전체를 읽어 프론트가 기대하는
//   { [국가]: {title, url, publishedAt, processed_time, summary_items, summary_result, ...}, global_briefing: {...} }
// 형태로 반환한다.
// 생산자: News_scrap fetch_and_store_youtube_data() + 전일브리핑(global_briefing 필드)
export const config = { runtime: "edge" };

import { Redis } from "@upstash/redis";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      // 시간 단위 갱신 데이터 → CDN 캐시로 Upstash 읽기 절감
      "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
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

    const raw = (await redis.hgetall("youtube_data")) as Record<string, any> | null;
    if (!raw) return json({});

    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(raw)) {
      const obj = parseMaybeJson(val);

      // 글로벌 브리핑은 통째로 유지
      if (key === "global_briefing") {
        out[key] = obj;
        continue;
      }

      // 국가별 항목: 대용량 원문(summary_content)은 제외 — 프론트 미사용,
      // 상세는 /api/youtube-content 로 지연 로드 (list.ts와 동일 정책)
      if (obj && typeof obj === "object") {
        const { summary_content, ...rest } = obj;
        out[key] = rest;
      } else {
        out[key] = obj;
      }
    }

    return json(out);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
