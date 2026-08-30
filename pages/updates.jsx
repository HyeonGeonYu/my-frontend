import dynamic from "next/dynamic";
const Updates = dynamic(() => import("../src/pages/Updates"), { ssr: false });
export default function UpdatesPage() { return <Updates />; }
