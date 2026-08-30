import dynamic from "next/dynamic";
const Cfd = dynamic(() => import("../src/pages/Cfd"), { ssr: false });
export default function CfdPage() { return <Cfd />; }
