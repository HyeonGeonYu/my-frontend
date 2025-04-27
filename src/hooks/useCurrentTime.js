import { useState, useEffect } from "react";
import { getFormattedTime } from "../utils/timeUtils";

export const useCurrentTime = () => {
  const [currentTime, setCurrentTime] = useState(getFormattedTime());


  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(getFormattedTime());
    };

    updateTime(); // 초기 세팅
    const interval = setInterval(updateTime, 60000); // 1분마다 갱신

    return () => clearInterval(interval);
  }, []);

  return currentTime;
};
