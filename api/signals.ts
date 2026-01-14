// api/signals.ts
export const config = {runtime: "edge"};

import {Redis} from "@upstash/redis";

function json(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
        },
        status,
    });
}

const DAY_MS = 86_400_000;

function nameKey(name: string): string {
    const n = (name || "bybit").trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(n)) throw new Error("Invalid name");
    return `trading:${n}`;
}

type SignalOut = {
    signal_id?: string;
    ts_ms?: number;
    symbol?: string;
    side?: string;
    kind?: string;
    price?: number | string;

    // 호환/기존 필드
    ts?: string;
    extra?: { ts_ms?: number };
    timeSec?: number;

    _id?: string; // stream id
    [k: string]: any;
};

function toUpperOrUndef(x: string | null): string | undefined {
    return x ? x.toUpperCase() : undefined;
}

function streamIdFromMs(ms: number): string {
    // stream id: <ms>-<seq>
    return `${ms}-0`;
}

function streamIdToMs(ms: number): string {
    // 같은 ms에 여러 엔트리가 있을 수 있어 seq 크게 잡음
    return `${ms}-999999`;
}

function parseStreamEntryValue(value: any): Record<string, any> {
    // Upstash/@upstash/redis 는 환경에 따라 value가:
    // 1) object: { field: value, ... }
    // 2) array: [field1, value1, field2, value2, ...]
    // 로 올 수 있어서 둘 다 처리
    if (!value) return {};
    if (Array.isArray(value)) {
        const obj: Record<string, any> = {};
        for (let i = 0; i + 1 < value.length; i += 2) {
            const k = String(value[i]);
            obj[k] = value[i + 1];
        }
        return obj;
    }
    if (typeof value === "object") return value as Record<string, any>;
    return {};
}

export async function GET(req: Request): Promise<Response> {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        return json({retCode: -1, retMsg: "Env missing UPSTASH_REDIS_REST_URL/TOKEN"}, 500);
    }

    const redis = new Redis({url, token});

    try {
        const {searchParams} = new URL(req.url);
        const debugOn = searchParams.get("debug") === "1";

        const name = searchParams.get("name") || "bybit";
        const base = nameKey(name);
        const keyStream = `${base}:signals`; // ✅ stream key

        const symbolParam = toUpperOrUndef(searchParams.get("symbol"));
        const sideParam = toUpperOrUndef(searchParams.get("side"));
        const kindParam = toUpperOrUndef(searchParams.get("kind"));

        const days = Math.min(Math.max(parseInt(searchParams.get("days") || "7", 10) || 7, 1), 365);
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");

        const limitParam = parseInt(searchParams.get("limit") || "0", 10);
        const limit = isNaN(limitParam) ? 0 : limitParam;

        const nowMs = Date.now();
        const fromMs = fromParam ? new Date(fromParam).getTime() : (toParam ? 0 : nowMs - days * DAY_MS);
        const toMs = toParam ? new Date(toParam).getTime() : nowMs;

        if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
            return json({retCode: -1, retMsg: "Invalid from/to"}, 400);
        }

        const fromId = streamIdFromMs(fromMs);
        const toId = streamIdToMs(toMs);

        // ✅ Stream 조회는 한 번에 다 가져오면 너무 클 수 있으니 보호장치
        // - limit이 있으면 대충 limit의 5배 정도를 가져와서 필터링 후 tail을 자르는 방식
        const MAX_FETCH = 500;
        const count =
            limit > 0 ? Math.min(limit + 50, MAX_FETCH) : MAX_FETCH;


        const raw = await redis.xrange(keyStream, fromId, toId, count);

        // ✅ raw 형태가 array 또는 object일 수 있어서 표준화
        const entriesArr: Array<{ id: string; message: any }> = [];

        if (Array.isArray(raw)) {
            for (const ent of raw as any[]) {
                // { id, message }
                if (ent?.id != null && ent?.message != null) {
                    entriesArr.push({id: String(ent.id), message: ent.message});
                    continue;
                }
                // [id, message]
                if (Array.isArray(ent) && ent.length >= 2) {
                    entriesArr.push({id: String(ent[0]), message: ent[1]});
                    continue;
                }
            }
        } else if (raw && typeof raw === "object") {
            // { [id]: message }
            for (const [id, message] of Object.entries(raw as Record<string, any>)) {
                entriesArr.push({id, message});
            }
        }

        if (entriesArr.length === 0) {
            return json({retCode: 0, signals: []});
        }
        const signals: SignalOut[] = [];
        let filteredOut = 0;

        for (const ent of entriesArr) {
            const id = ent.id;
            const rawMsg = ent.message;

            const msg = parseStreamEntryValue(rawMsg);

            const symbol = msg.symbol ? String(msg.symbol).toUpperCase() : undefined;
            const side = msg.side ? String(msg.side).toUpperCase() : undefined;
            const kind = msg.kind ? String(msg.kind).toUpperCase() : undefined;

            if (symbolParam && symbol !== symbolParam) {
                filteredOut++;
                continue;
            }
            if (sideParam && side !== sideParam) {
                filteredOut++;
                continue;
            }
            if (kindParam && kind !== kindParam) {
                filteredOut++;
                continue;
            }

            const tsMsFromField =
                typeof msg.ts_ms === "number" ? msg.ts_ms :
                    typeof msg.ts_ms === "string" ? Number(msg.ts_ms) :
                        undefined;

            const tsMsFromId =
                id && id.includes("-") ? Number(id.split("-")[0]) : undefined;

            const tsMs =
                (typeof tsMsFromField === "number" && Number.isFinite(tsMsFromField)) ? tsMsFromField :
                    (typeof tsMsFromId === "number" && Number.isFinite(tsMsFromId)) ? tsMsFromId :
                        undefined;

            const timeSec =
                typeof tsMs === "number" && Number.isFinite(tsMs) ? Math.floor(tsMs / 1000) : undefined;

            signals.push({
                ...msg,
                symbol,
                side,
                kind,
                ts_ms: tsMs,
                timeSec,
                _id: id,
            });
        }

        // stream은 기본이 오래된→최신 순이지만, 안전하게 timeSec 기준 정렬
        signals.sort((a, b) => (Number(a.timeSec) || 0) - (Number(b.timeSec) || 0));

        const result = limit > 0 ? signals.slice(-limit) : signals;

        const payload: any = {retCode: 0, signals: result};

        if (debugOn) {
            payload._debug = {
                name,
                keyStream,
                fromMs,
                toMs,
                fromId,
                toId,
                fetched: entriesArr.length,
                filteredOut,
                returned: result.length,
                count,
            };
        }

        return json(payload);
    } catch (e: any) {
        const msg = e?.message || "server error";
        const status = msg === "Invalid name" ? 400 : 500;
        return json({retCode: -1, retMsg: msg}, status);
    }
}
