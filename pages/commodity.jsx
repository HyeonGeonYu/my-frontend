import dynamic from "next/dynamic";
const Commodity = dynamic(() => import("../src/pages/Commodity"), { ssr: false });
export default function CommodityPage() { return <Commodity />; }
