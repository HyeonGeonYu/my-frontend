import React from "react";
import ChartPage from "../components/ChartPage";

function Exchange() {
  return (
    <ChartPage
      chartType="currency"
      title="환율 관련(+-3%)"
      envelop={3}
    />
  );
}

export default Exchange;
