// api/chartdata.ts
// telewebhook(Render)의 /chartdata/{cat} 대체.  사용: /api/chartdata?cat=index
// 같은 Upstash Redis의 `chart_data` 해시를 읽어 프론트(useAllChartData)가 기대하는
//   { [key]: { data: [...], processed_time } }
// 형태로 반환한다.
// 생산자: News_scrap fetch_and_store_chart_data() (KIS API → Redis, 매시)
//
// Redis 저장 구조(중요):
//   chart_data[{cat}]                  = JSON  { [name]: { data:[...], ... } }   (name별 processed_time 없음)
//   chart_data[{cat}_processed_time]   = ISO 문자열 (카테고리당 1개)
// → 여기서 카테고리 processed_time을 각 name 객체에 주입해 준다.
//
// cat 종류: index / treasury / currency / commodity (그 외 kr_stock·us_stock 등도 그대로 지원)
// calculated_dxy: 별도 저장 키가 아님 — currency 안에 dxy가 이미 있으므로 그 dxy만 돌려주는 레거시 별칭.
export const config = { runtime: "edge" };

import { Redis } from "@upstash/redis";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      // 매시 갱신 데이터 → CDN 캐시로 Upstash 읽기 절감
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

export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ error: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  const { searchParams } = new URL(req.url);
  const cat = (searchParams.get("cat") || "").trim();
  if (!cat || !/^[a-zA-Z0-9_]+$/.test(cat)) {
    return json({ error: "invalid or missing cat" }, 400);
  }

  // calculated_dxy 는 실제 저장 카테고리가 아님 → currency 를 읽어 dxy 만 반환
  const readCat = cat === "calculated_dxy" ? "currency" : cat;

  try {
    const redis = new Redis({ url, token });

    const [rawCat, ts] = await Promise.all([
      redis.hget("chart_data", readCat),
      redis.hget("chart_data", `${readCat}_processed_time`),
    ]);

    if (rawCat == null) return json({});

    let parsed = parseMaybeJson(rawCat);
    if (!parsed || typeof parsed !== "object") return json({});

    // calculated_dxy: dxy 키만 남김
    if (cat === "calculated_dxy") {
      parsed = (parsed as any).dxy ? { dxy: (parsed as any).dxy } : {};
    }

    // 카테고리 단위 processed_time 을 각 key 객체에 주입
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, any>)) {
      if (val && typeof val === "object") {
        out[key] = { ...val, processed_time: ts ?? "" };
      } else {
        out[key] = val;
      }
    }

    return json(out);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
