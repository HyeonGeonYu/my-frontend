import React from "react";
import ChartPage from "../components/ChartPage";

function Exchange() {
  return (
    <ChartPage
      chartType={["calculated_dxy", "currency", "treasury"]}  // 배열로 입력 가능
      title="환율 및 채권 관련(+-3%)"
      envelop={3}
    />
  );
}

export default Exchange;
