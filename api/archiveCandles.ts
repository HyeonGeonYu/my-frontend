// api/archiveCandles.ts
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function kst0650StartMs(day: string) {
    const [y, m, d] = String(day).split("-").map(Number);
    return Date.UTC(y, m - 1, d, 6 - 9, 50, 0, 0);
}

function getArchiveWindowMs(day: string) {
    const startMs = kst0650StartMs(day);
    const endMs = startMs + ONE_DAY_MS;
    return {startMs, endMs};
}

async function fetchJsonSafe(url: string) {
    const res = await fetch(url, {
        cache: "no-store",
        headers: {
            accept: "application/json",
            "user-agent": "Mozilla/5.0 archive-candles",
        },
    });

    const text = await res.text();

    let json: any;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(
            `Bybit 응답이 JSON이 아님 status=${res.status} body=${text.slice(0, 200)}`
        );
    }

    if (!res.ok) {
        throw new Error(
            `Bybit HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`
        );
    }

    if (json?.retCode !== 0) {
        throw new Error(
            `Bybit retCode=${json?.retCode} retMsg=${json?.retMsg || ""}`
        );
    }

    return json;
}

async function fetchBybit1mCandles(symbol: string, day: string) {
    const {startMs, endMs} = getArchiveWindowMs(day);

    const all: any[] = [];
    const CHUNK_MS = 900 * 60_000;

    let chunkStart = startMs;

    while (chunkStart < endMs) {
        const chunkEnd = Math.min(chunkStart + CHUNK_MS, endMs);

        const url = new URL("https://api.bybit.com/v5/market/kline");
        url.searchParams.set("category", "linear");
        url.searchParams.set("symbol", symbol);
        url.searchParams.set("interval", "1");
        url.searchParams.set("start", String(chunkStart));
        url.searchParams.set("end", String(chunkEnd));
        url.searchParams.set("limit", "1000");

        const json = await fetchJsonSafe(url.toString());
        const rows = json?.result?.list || [];

        if (Array.isArray(rows) && rows.length > 0) {
            const parsed = rows
                .map((r: any[]) => ({
                    tsMs: Number(r[0]),
                    timeSec: Math.floor(Number(r[0]) / 1000),
                    open: Number(r[1]),
                    high: Number(r[2]),
                    low: Number(r[3]),
                    close: Number(r[4]),
                    volume: Number(r[5]),
                }))
                .filter((r) =>
                    Number.isFinite(r.tsMs) &&
                    r.tsMs >= startMs &&
                    r.tsMs < endMs
                );

            all.push(...parsed);
        }

        chunkStart = chunkEnd;
    }

    const dedup = new Map<number, any>();
    for (const r of all) {
        dedup.set(r.tsMs, r);
    }

    return Array.from(dedup.values()).sort((a, b) => a.tsMs - b.tsMs);
}

export default async function handler(req: any, res: any) {
    try {
        const day = String(req.query.day || "");
        const symbol = String(req.query.symbol || "").toUpperCase();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
            return res.status(400).json({
                ok: false,
                error: "day must be YYYY-MM-DD",
            });
        }

        if (!symbol) {
            return res.status(400).json({
                ok: false,
                error: "symbol is required",
            });
        }

        const candles = await fetchBybit1mCandles(symbol, day);
        const {startMs, endMs} = getArchiveWindowMs(day);

        return res.status(200).json({
            ok: true,
            day,
            symbol,
            startMs,
            endMs,
            count: candles.length,
            candles,
        });
    } catch (e: any) {
        return res.status(500).json({
            ok: false,
            error: e?.message || String(e),
        });
    }
}