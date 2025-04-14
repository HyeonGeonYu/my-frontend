export const getFormattedTime = () => {
  const now = new Date();

  // 날짜 포맷: 2025년 04월 14일
  const rawDate = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // '2025. 04. 14.' → ['2025', '04', '14']
  const [year, month, day] = rawDate.replace(/\.$/, "").split(". ").map((s) => s.trim());
  const formattedDate = `${year}년 ${month}월 ${day}일`;

  // 시간 포맷: 오후 4:06
  const formattedTime = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  return {
    date: formattedDate,
    time: formattedTime,
  };
};
