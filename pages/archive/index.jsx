import dynamic from "next/dynamic";
const Archive = dynamic(() => import("../../src/pages/Archive"), { ssr: false });
export default function ArchivePage() { return <Archive />; }
