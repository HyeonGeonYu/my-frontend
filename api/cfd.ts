export const config = { runtime: "edge" };

const MT5_BASE = "https://api.hyeongeonnoil.com";

const ALLOWED_PATHS = new Set([
    "/health",
    "/v5/market/candles/with-gaps",
    "/v5/market/sessions",
    "/v5/market/sessions/expanded",
    "/v1/sessions/mt5",
    "/v1/sessions/mt5/bulk",
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
        const isGet = req.method === "GET" || req.method === "HEAD";
        const res = await fetch(target.toString(), {
            method: req.method,
            headers: {
                "X-API-Key": apiKey,
                ...(!isGet ? { "content-type": "application/json" } : {}),
            },
            body: isGet ? undefined : req.body,
            // @ts-ignore
            duplex: isGet ? undefined : "half",
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
