
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
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
