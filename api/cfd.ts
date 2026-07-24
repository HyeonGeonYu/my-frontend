export const config = { runtime: "edge" };

const MT5_BASE = "https://api.hyeongeonnoil.com";

// 읽기 전용 경로만 허용. 세션 업서트(POST /v1/sessions/*)는 봇이 로컬에서 직접 하므로
// 공개 프록시에 절대 포함하지 않는다(무인증 쓰기 통로가 됨).
const ALLOWED_PATHS = new Set([
    "/health",
    "/v5/market/candles/with-gaps",
    "/v5/market/sessions",
    "/v5/market/sessions/expanded",
]);

function json(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
        status,
    });
}

export default async function handler(req: Request): Promise<Response> {
    const apiKey = process.env.MT5_API_KEY;
    if (!apiKey) return json({ error: "MT5_API_KEY not configured" }, 500);

    if (req.method !== "GET" && req.method !== "HEAD") {
        return json({ error: "method not allowed" }, 405);
    }

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("_path") || "";

    if (!ALLOWED_PATHS.has(path)) {
        return json({ error: "invalid path" }, 400);
    }

    const target = new URL(path, MT5_BASE);
    for (const [k, v] of searchParams) {
        if (k !== "_path") target.searchParams.set(k, v);
    }

    try {
        const res = await fetch(target.toString(), {
            method: req.method,
            headers: { "X-API-Key": apiKey },
        });

        const body = await res.text();
        return new Response(body, {
            status: res.status,
            headers: {
                "content-type": res.headers.get("content-type") || "application/json",
                "cache-control": "no-store",
            },
        });
    } catch (e: any) {
        return json({ error: e?.message || "proxy error" }, 502);
    }
}
