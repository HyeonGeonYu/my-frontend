import dynamic from "next/dynamic";
const Indexes = dynamic(() => import("../src/pages/Indexes"), { ssr: false });
export default function IndexesPage() { return <Indexes />; }
