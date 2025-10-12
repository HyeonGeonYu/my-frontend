export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";

function listKey(symbol:string, interval:string){ return `kline:${symbol}:${interval}`; }
function zIdxKey(symbol:string, interval:string){ return `kline:${symbol}:${interval}:idx`; }
function bodyKey(symbol:string, interval:string, ts:number){ return `kline:${symbol}:${interval}:${ts}`; }

export default async function handler(req: Request) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ retCode:-1, retMsg:"Env missing" }), {
      headers:{ "content-type":"application/json" }, status:500
    });
  }
  const redis = new Redis({ url, token });

  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const interval = searchParams.get("interval") || "1";
    const limit = Math.min(Number(searchParams.get("limit") || "300"), 1000);

    // 1) LIST 스키마(최신→오래 저장)를 먼저 읽음
    const lkey = listKey(symbol, interval);
    const rows = await redis.lrange(lkey, 0, limit - 1); // any[]
    if (rows && rows.length) {
      const data = rows
        .map((v: any) => (typeof v === "string" ? JSON.parse(v) : v)) // 문자열/객체 모두 처리
        .map((r: any) => ({
          time: Number(r.time),
          open: Number(r.open),
          high: Number(r.high),
          low:  Number(r.low),
          close:Number(r.close),
        }))
        .reverse(); // 오래→최신
      return jsonOk({ list: data });
    }

    // 2) ZSET+HASH 스키마 폴백
    const zkey = zIdxKey(symbol, interval);
    // 최신→오래로 상위 limit개 (rev:true)
    const members = await redis.zrange(zkey, 0, limit - 1, { rev: true, withScores: true }).catch(() => []);
    if (members && (members as any[]).length) {
      // rev:true라 최신→오래 → 오래→최신으로 뒤집기
      const latestToOld = members as [string, number][];
      const oldToLatest = [...latestToOld].reverse();
      const data: any[] = [];
      for (const [tsStr] of oldToLatest) {
        const ts = Number(tsStr);
        const h = await redis.hgetall<{ o: string; h: string; l: string; c: string }>(bodyKey(symbol, interval, ts));
        if (h && h.o) {
          data.push({
            time: ts,
            open: Number(h.o),
            high: Number(h.h),
            low:  Number(h.l),
            close:Number(h.c),
          });
        }
        if (data.length >= limit) break;
      }
      return jsonOk({ list: data });
    }

    // 3) 없으면 빈 배열
    return jsonOk({ list: [] });
  } catch (e: any) {
    return new Response(JSON.stringify({ retCode:-1, retMsg: e?.message || "server error" }), {
      headers:{ "content-type":"application/json" }, status:500
    });
  }
}

function jsonOk(payload: any) {
  return new Response(JSON.stringify({ retCode: 0, ...payload }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status: 200,
  });
}
