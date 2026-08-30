// api/mt5-equity.ts — MT5(데모) 일일 equity 히스토리.
// News_scrap persist가 매일 06:55 Redis 해시(day → {equity_usd, wallet_usd, ...})에 기록한 것을 반환.
export const config = { runtime: "edge" };

import { Redis } from "@upstash/redis";

const KEY = "trading:agent:CopyZannaviMT5:u8f3a9c1e7b:MT5:daily_equity";

function json(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
        status,
    });
}

export default async function handler(_req: Request): Promise<Response> {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        return json({ retCode: -1, retMsg: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
    }

    try {
        const redis = new Redis({ url, token });
        const all = (await (redis as any).hgetall(KEY)) as Record<string, any> | null;

        const rows = Object.entries(all || {})
            .map(([day, v]) => {
                let obj: any = v;
                if (typeof v === "string") {
                    try { obj = JSON.parse(v); } catch { obj = {}; }
                }
                const equity = Number(obj?.equity_usd);
                return {
                    day: String(day),
                    equity: Number.isFinite(equity) ? equity : null,
                    wallet: Number(obj?.wallet_usd) || null,
                };
            })
            .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day) && r.equity != null && r.equity > 0)
            .sort((a, b) => a.day.localeCompare(b.day));

        return json({ retCode: 0, rows });
    } catch (e: any) {
        return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
    }
}
