// api/equity-history.ts — 코인(Bybit) 일일 에쿼티 히스토리 경량 조회
// EquityHistoryCard 전용: /api/list(뉴스·거래 포함 무거운 페이로드 × 18페이지 순차)를
// 단일 요청으로 대체. asset_snapshots에서 day/equity만 추출.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

function toNum(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export default async function handler(req: any, res: any) {
    try {
        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            return res.status(500).json({ ok: false, error: "SUPABASE env missing" });
        }

        const days = Math.min(Math.max(Number(req.query.days || 90), 1), 365);

        const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
            auth: { persistSession: false },
        });

        const { data, error } = await supabase
            .from("asset_snapshots")
            .select("day, created_at, equity_usdt, wallet_usdt, raw_json")
            .order("day", { ascending: false })
            .limit(days * 2); // 하루 다중 스냅샷 여유

        if (error) throw error;

        const byDay: Record<string, any> = {};
        for (const r of data || []) {
            if (!byDay[r.day]) byDay[r.day] = r; // created_at desc → 그날 최신만
        }

        const rows = Object.values(byDay)
            .map((r: any) => {
                const raw = r.raw_json || {};
                const equity =
                    toNum(r.equity_usdt) ??
                    toNum(raw.equity_usdt) ??
                    toNum(r.wallet_usdt) ??
                    toNum(raw["wallet.USDT"]);
                return { day: r.day, equityUsdt: equity };
            })
            .filter((r) => r.day && r.equityUsdt != null)
            .sort((a: any, b: any) => a.day.localeCompare(b.day))
            .slice(-days);

        res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
        return res.status(200).json({ ok: true, rows });
    } catch (e: any) {
        return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
}
