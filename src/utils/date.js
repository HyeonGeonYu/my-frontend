
export const isToday = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
};

const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * anchorEndUtcSec 기반 KST 날짜 라벨 반환
 * Coin.jsx selectedDayLabel, Cfd.jsx selectedDayLabelFromAnchor,
 * StreamsCenter.jsx dayLabel 세 곳의 중복 통합
 */
export function getDayLabel(anchorEndUtcSec, dayOffset = 0) {
  const end = Number(anchorEndUtcSec) + Number(dayOffset) * 86400;
  const start = end - 86400;
  const kstSec = start + 9 * 3600;
  const d = new Date(kstSec * 1000);
  const month = d.getUTCMonth() + 1;
  const date = d.getUTCDate();
  const dow = DOW_KR[d.getUTCDay()];
  return `${month}월 ${date}일(${dow})`;
}
