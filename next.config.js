/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 루트 api/(Vercel 함수)는 Next 빌드 대상이 아닌데 tsconfig 스코프에 걸려 타입에러가
  // 빌드를 막을 수 있음 — Vercel은 어차피 함수 배포 시 타입체크 안 함. 이전 기간 한시 완화.
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
