
import { useEffect, useState } from "react";

const API_BASE_URL = "https://news-scrap.onrender.com";

export const useYoutubeData = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/youtube`)
      .then((res) => res.json())
      .then((videoData) => {
        const parsedData = typeof videoData === "string" ? JSON.parse(videoData) : videoData;
        setData(parsedData);
      })
      .catch((err) => console.error("❌ Error fetching data:", err));
  }, []);

  return data;
};
