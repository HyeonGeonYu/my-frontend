import React from "react";
import ChartPage from "../components/ChartPage";

function KoreaStock() {
  return (
    <ChartPage
      chartType="kr_stock"
      title="국내개별주 관련(+-10%)"
      envelop={10}
    />
  );
}

export default KoreaStock;
