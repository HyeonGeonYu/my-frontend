export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";

export default async function handler(req: Request) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ ok:false, reason:"env-missing" }), { headers:{ "content-type":"application/json" }, status:500 });
  }
  const redis = new Redis({ url, token });

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const interval = searchParams.get("interval") || "1";
  const listKey = `kline:${symbol}:${interval}`;
  const zIdxKey = `kline:${symbol}:${interval}:idx`;

  // LIST 스키마 확인
  const llen = await redis.llen(listKey).catch(()=>null);
  const head = await redis.lrange<string>(listKey, 0, 2).catch(()=>[]);
  // ZSET 스키마 확인
  const zcount = await redis.zcard(zIdxKey).catch(()=>null);

  return new Response(JSON.stringify({
    ok:true,
    usedEnv:{ hasUrl:!!url, hasToken:!!token },
    listKey, llen, listHead: head,
    zIdxKey, zcount
  }, null, 2), { headers:{ "content-type":"application/json" }});
}
