// api/world-state.ts
// 세계 정세 현황판 데이터 — Supabase world_state 최신 row 반환
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

export default async function handler(req: any, res: any) {
    try {
        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            return res.status(500).json({ ok: false, error: "Supabase 환경변수 없음" });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
            auth: { persistSession: false },
        });

        const { data, error } = await supabase
            .from("world_state")
            .select("week_start, raw_json, updated_at")
            .order("week_start", { ascending: false })
            .limit(1)
            .single();

        // PGRST116 = row 없음 (아직 분석 전) → 정상 처리, data null
        if (error && error.code !== "PGRST116") throw error;

        return res.status(200).json({
            ok: true,
            weekStart: data?.week_start || null,
            updatedAt: data?.updated_at || null,
            data: data?.raw_json || null,
        });
    } catch (e: any) {
        return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
}
