import dynamic from "next/dynamic";
const Exchange = dynamic(() => import("../src/pages/Exchange"), { ssr: false });
export default function ExchangePage() { return <Exchange />; }
