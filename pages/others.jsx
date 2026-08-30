import dynamic from "next/dynamic";
const Others = dynamic(() => import("../src/pages/Others"), { ssr: false });
export default function OthersPage() { return <Others />; }
