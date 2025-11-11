// project/api/config.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";
import { loadTradingConfig } from "./tradingConfig";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ error: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  try {
    const redis = new Redis({ url, token });
    const data = await loadTradingConfig(redis); // 값 없으면 null로 들어있음
    return json(data, 200);
  } catch (e: any) {
    console.error("/api/config GET error:", e);
    return json({ error: "failed_to_load_config" }, 500);
  }
}
