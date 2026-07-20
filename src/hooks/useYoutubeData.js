
import { useEffect, useState } from "react";

export const useYoutubeData = () => {

  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/youtube`)
      .then((res) => res.json())
      .then((videoData) => {
        const parsedData = typeof videoData === "string" ? JSON.parse(videoData) : videoData;
        setData(parsedData);
      })
      .catch((err) => console.error("❌ Error fetching data:", err));
  }, []);
  return data;
};
