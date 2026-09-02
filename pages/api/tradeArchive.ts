// api/tradeArchive.ts — Supabase 영구 체결 아카이브 조회 (월별 전적용)
// Redis trade_records 스트림은 10일 핫 데이터만 보존 — 장기본은 News_scrap persist.py가
// Supabase trade_records 테이블에 저장 (5월~, 전략 라벨 백필 완료분 포함).
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
        return res.status(500).json({ retCode: -1, retMsg: "Supabase env missing" });
    }

    const account = String(req.query.account || "BYBIT").toUpperCase();
    if (!["BYBIT", "MT5"].includes(account)) {
        return res.status(400).json({ retCode: -1, retMsg: "account must be BYBIT|MT5" });
    }

    const from = String(req.query.from || "2026-01-01");
    const to = String(req.query.to || "2099-12-31");
    if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
        return res.status(400).json({ retCode: -1, retMsg: "from/to must be YYYY-MM-DD" });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "8000"), 10) || 8000, 1), 20000);

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

        let q = supabase
            .from("trade_records")
            .select(
                "id,day,symbol,side,kind,signal,price,qty,pnl," +
                "account:raw_json->>account," +
                "strategy_tag:raw_json->>strategy_tag," +
                "signal_ns:raw_json->>signal_ns," +
                "ts_ms:raw_json->>ts_ms," +
                "entry_price:raw_json->>entry_price," +
                "pnl_pct:raw_json->source_signal->>pnl_pct"
            )
            .gte("day", from)
            .lte("day", to)
            .order("day", { ascending: true })
            .limit(limit);

        // account 필드는 2026-08-20부터 기록 — 그 이전 백필 행은 전부 BYBIT (null 허용)
        if (account === "MT5") {
            q = q.eq("raw_json->>account", "MT5");
        } else {
            q = q.or("raw_json->>account.eq.BYBIT,raw_json->>account.is.null");
        }

        const { data, error } = await q;
        if (error) {
            return res.status(500).json({ retCode: -1, retMsg: error.message });
        }

        res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
        return res.status(200).json({ retCode: 0, account, from, to, records: data || [] });
    } catch (e: any) {
        return res.status(500).json({ retCode: -1, retMsg: e?.message || "server error" });
    }
}
