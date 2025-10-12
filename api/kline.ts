// api/klines.ts
export const config = { runtime: "edge" };

import { Redis } from "@upstash/redis";

// 환경변수: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function keyKline(symbol: string, interval: string) {
  // 네 백필 스크립트와 동일한 LIST 키
  return `kline:${symbol}:${interval}`;
}

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const interval = searchParams.get("interval") || "1"; // "1" | "D"
    const limit = Math.min(Number(searchParams.get("limit") || "300"), 1000); // 안전 상한

    const listKey = keyKline(symbol, interval);

    // 최신→오래 순으로 저장되어 있으니 0..limit-1 가져와서 뒤집어 주기
    const rows = await redis.lrange<string>(listKey, 0, limit - 1);

    // rows: JSON 문자열 배열 → 객체 배열
    const latestToOld = rows.map((s) => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean) as { time:number; open:number; high:number; low:number; close:number }[];

    const oldToLatest = latestToOld.slice().reverse();

    // 프론트는 lightweight-charts에 바로 먹일 수 있게 심플 배열로 돌려주자
    return new Response(JSON.stringify({
      retCode: 0,
      symbol,
      interval,
      list: oldToLatest, // [{time,open,high,low,close}, ...] 오래→최신
    }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      status: 200,
    });

  } catch (e: any) {
    return new Response(JSON.stringify({
      retCode: -1,
      retMsg: e?.message || "server error",
    }), { headers: { "content-type": "application/json" }, status: 200 });
  }
}
