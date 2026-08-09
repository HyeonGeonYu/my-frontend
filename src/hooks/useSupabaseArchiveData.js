// hooks/useSupabaseArchiveData.js
// 아카이브 월별 뷰 데이터 훅:
//   useArchiveMonths()          → /api/list?months=1   월 목록 [{month:"YYYY-MM", days:N}]
//   useArchiveMonthDays(month)  → /api/list?month=...  해당 월의 경량 일자 목록 [{day, date, tradeCount}]
//   fetchArchiveDay(day)        → /api/list?day=...    단일 일자 상세(펼칠 때 지연 로드)
import {useEffect, useState} from "react";

async function fetchJson(url) {
    const res = await fetch(url, {cache: "no-store"});
    const json = await res.json();
    if (!res.ok || !json.ok) {
        throw new Error(json?.error || "archive fetch failed");
    }
    return json;
}

export function useArchiveMonths() {
    const [months, setMonths] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                const json = await fetchJson("/api/list?months=1");
                if (alive) setMonths(Array.isArray(json.months) ? json.months : []);
            } catch (e) {
                if (alive) setError(e);
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    return {months, loading, error};
}

export function useArchiveMonthDays(month) {
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!month) return;

        let alive = true;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const json = await fetchJson(`/api/list?month=${encodeURIComponent(month)}`);
                if (alive) setDays(Array.isArray(json.days) ? json.days : []);
            } catch (e) {
                if (alive) {
                    setError(e);
                    setDays([]);
                }
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [month]);

    return {days, loading, error};
}

export async function fetchArchiveDay(day) {
    const json = await fetchJson(`/api/list?day=${encodeURIComponent(day)}`);
    return Array.isArray(json.data) && json.data.length > 0 ? json.data[0] : null;
}
