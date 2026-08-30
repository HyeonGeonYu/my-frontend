import dynamic from "next/dynamic";
const Coin = dynamic(() => import("../src/pages/Coin"), { ssr: false });
export default function CoinPage() { return <Coin />; }
