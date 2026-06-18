// hooks/useWorldStateData.js
import { useEffect, useState } from "react";

export function useWorldStateData() {
    const [data, setData] = useState(null);       // { countries, relations }
    const [updatedAt, setUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                const res = await fetch("/api/world-state", { cache: "no-store" });
                const json = await res.json();

                if (!alive) return;
                if (!res.ok || !json.ok) {
                    throw new Error(json?.error || "world-state fetch failed");
                }

                setData(json.data || null);
                setUpdatedAt(json.updatedAt || null);
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

    return { data, updatedAt, loading, error };
}
