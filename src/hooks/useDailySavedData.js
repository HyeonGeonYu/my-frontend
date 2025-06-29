import { useEffect, useState } from "react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const useDailySavedData = (page = 1) => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/daily-saved-data?page=${page}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((result) => {
        setData(result.data || []);
        setTotal(result.total || 0);
      })
      .catch((err) => {
        console.error("❌ Error fetching daily_saved_data:", err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return { data, total, loading, error };
};
