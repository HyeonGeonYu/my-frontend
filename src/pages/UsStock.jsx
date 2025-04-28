import React from "react";
import ChartPage from "../components/ChartPage";

function UsStock() {
  return (
    <ChartPage
      chartType="us_stock"
      title="해외개별주 관련(+-10%)"
      envelop={10}
    />
  );
}

export default UsStock;
