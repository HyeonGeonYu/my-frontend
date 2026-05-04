// hooks/useSupabaseArchiveData.js
import {useEffect, useState} from "react";

export function useSupabaseArchiveData(page = 1) {
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;

        async function run() {
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`/api/list?page=${page}`, {
                    cache: "no-store",
                });

                const json = await res.json();

                if (!res.ok || !json.ok) {
                    throw new Error(json?.error || "archive fetch failed");
                }

                if (!alive) return;

                setData(Array.isArray(json.data) ? json.data : []);
                setTotal(Number(json.total || 0));
            } catch (e) {
                if (!alive) return;
                setError(e);
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        }

        run();

        return () => {
            alive = false;
        };
    }, [page]);

    return {data, total, loading, error};
}