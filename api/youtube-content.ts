// api/youtube-content.ts
// "전문 보기" 클릭 시 특정 날짜+국가의 summary_content를 lazy load
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

export default async function handler(req: any, res: any) {
    try {
        const { day, country } = req.query;

        if (!day || !country) {
            return res.status(400).json({ ok: false, error: "day, country 파라미터 필요" });
        }

        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            return res.status(500).json({ ok: false, error: "Supabase 환경변수 없음" });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
            auth: { persistSession: false },
        });

        const { data, error } = await supabase
            .from("youtube_transcripts")
            .select("summary_content")
            .eq("day", day)
            .eq("country", country)
            .single();

        if (error && error.code !== "PGRST116") throw error;

        const content = data?.summary_content || null;

        return res.status(200).json({ ok: true, content });
    } catch (e: any) {
        return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
}
