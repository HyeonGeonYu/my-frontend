// project/api/config.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";

/* ------------------------- utils ------------------------- */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

const REDIS_KEY_CFG = "trading:config";

// 안전 숫자 파서
function toNum(v: unknown, def = 0) {
  if (v == null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/* --------------------------- handler --------------------------- */
export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ error: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  try {
    const redis = new Redis({ url, token });

    // Upstash는 hgetall을 바로 제공함
    const raw = (await (redis as any).hgetall(REDIS_KEY_CFG)) as
      | Record<string, string | number>
      | null;

    // 파이썬이 저장 못했거나 아직 비어있을 수 있으니 디폴트 방어
    const data = {
      ws_stale_sec: toNum(raw?.ws_stale_sec, 30),
      ws_global_stale_sec: toNum(raw?.ws_global_stale_sec, 60),

      leverage: toNum(raw?.leverage, 50),
      entry_percent: toNum(raw?.entry_percent, 5), // 5 => 5%
      max_effective_leverage: toNum(raw?.max_effective_leverage, 25), // 25 => 25x (표시는 2500%)

      indicator_min_thr: toNum(raw?.indicator_min_thr, 0.005),
      indicator_max_thr: toNum(raw?.indicator_max_thr, 0.04),
      target_cross: toNum(raw?.target_cross, 5),

      // 기본청산(%) 계산용: 프런트에서 *100 해서 %-표기
      default_exit_ma_threshold: toNum(raw?.default_exit_ma_threshold, -0.0005),
    };

    return json(data, 200);
  } catch (e: any) {
    console.error("/api/config GET error:", e);
    return json({ error: "failed_to_load_config" }, 500);
  }
}
