import React from "react";
import IndexChart from "../components/indexChart";
import { useChartData } from "../hooks/useChartData";

function Exchange() {
  // useChartData 훅을 통해 각 환율 데이터를 가져옵니다.
  const usdKrwData = useChartData("usd_krw"); // USD ➝ KRW
  const DXY = useChartData("dxy"); // USD ➝ KRW
  const eurUsdData = useChartData("eur_usd"); // EUR ➝ USD
  const jpyUsdData = useChartData("jpy_usd"); // JPY ➝ USD
  const cnyUsdData = useChartData("cny_usd"); // CNY ➝ USD
  const gbpUsdData = useChartData("gbp_usd"); // GBP ➝ USD
  const cadUsdData = useChartData("cad_usd"); // CAD ➝ USD
  const sgdUsdData = useChartData("sgd_usd"); // SGD ➝ USD
  const envelope = 3;

  const currencyList = [
    { label: "USD/KRW", data: usdKrwData.data },
    { label: "Doller Index", data: DXY.data },
    { label: "EUR/USD(유럽)", data: eurUsdData.data },
    { label: "JPY/USD(일본)", data: jpyUsdData.data },
    { label: "CNY/USD(중국)", data: cnyUsdData.data },
    { label: "GBP/USD(영국)", data: gbpUsdData.data },
    { label: "CAD/USD(캐나다)", data: cadUsdData.data },
    { label: "SGD/USD(싱가폴)", data: sgdUsdData.data },
  ];

  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>환율 관련</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "40px", marginTop: "40px" }}>
        {currencyList.map(({ label, data }) => (
            <div key={label} style={{backgroundColor: "#222", padding: "20px", borderRadius: "12px"}}>
              {data ? (
                  <IndexChart data={data} dataName={label} envelope={envelope}/>
              ) : (
                  <div style={{color: "#888"}}>📊 {label} 데이터 로딩 중...</div>
              )}
            </div>
        ))}
      </div>
    </div>
  );
}

export default Exchange;
