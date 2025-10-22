// project/api/thresholds.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";

/* ------------------------- utils ------------------------- */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

function toNumberOrNull(s: unknown): number | null {
  if (s == null) return null;
  const n = typeof s === "string" ? Number(s) : (s as number);
  return Number.isFinite(n) ? n : null;
}

/** Stream(OpenPctLog)에서 (sym, name) 일치하는 가장 최근 new(0~1 fraction) 찾기 */
async function getLatestNewFracFromStream(redis: Redis, symbol: string, name: string, searchBack = 200) {
  // Upstash SDK: xrevrange(key, end, start, { count }) -> Array<[id, Record<string,string>]>
  const entries = await (redis as any).xrevrange("OpenPctLog", "+", "-", { count: searchBack });
  if (!Array.isArray(entries)) return null;

  for (const entry of entries) {
    // entry 형태: [id, { field: value, ... }]
    const rec = Array.isArray(entry) ? entry[1] : entry?.value || entry;
    if (!rec) continue;

    const sym = rec.sym ?? rec.SYM ?? rec.symbol;
    const nm = rec.name ?? rec.NAME;
    if (String(sym).toUpperCase() !== symbol) continue;
    if (String(nm) !== name) continue;

    const raw = rec.new ?? rec.NEW;
    const v = toNumberOrNull(raw);
    if (v != null) return v; // 0~1 fraction
  }
  return null;
}

/* --------------------------- handler --------------------------- */
export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ retCode: -1, retMsg: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  const redis = new Redis({ url, token });

  try {
    const { searchParams } = new URL(req.url);
    const symbolParam = (searchParams.get("symbol") || "").toUpperCase().trim();
    if (!symbolParam) return json({ retCode: -1, retMsg: "symbol required" }, 400);

    // 최신 MA threshold (Stream에서 name="MA threshold")
    const ma_threshold = await getLatestNewFracFromStream(redis, symbolParam, "MA threshold", 200);

    // momentum_threshold: 로그가 없다면 ma/3 규칙 적용
    const momentum_threshold =
      ma_threshold == null ? null : Number.isFinite(ma_threshold) ? ma_threshold / 3 : null;

    // 서버 기본값들 (봇 설정과 맞춰주세요)
    const exit_threshold = 0.0005; // 0.05%
    const target_cross = 10;
    const closes_num = 10080;

    // 프론트 fetchThresholdMeta에서 그대로 사용하도록 평평한 객체로 반환
    return json({
      symbol: symbolParam,
      ma_threshold,
      momentum_threshold,
      exit_threshold,
      target_cross,
      closes_num,
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
