export const config = { runtime: "edge" };

const MT5_BASE = "https://api.hyeongeonnoil.com";

function json(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
        status,
    });
}

export default async function handler(_req: Request): Promise<Response> {
    const apiKey = process.env.MT5_API_KEY;
    if (!apiKey) return json({ error: "MT5_API_KEY not configured" }, 500);

    try {
        const res = await fetch(`${MT5_BASE}/ws-token`, {
            headers: { "X-API-Key": apiKey },
        });
        const data = await res.json();
        return json(data, res.status);
    } catch (e: any) {
        return json({ error: e?.message || "proxy error" }, 502);
    }
}
