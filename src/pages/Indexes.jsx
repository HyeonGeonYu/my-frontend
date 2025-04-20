import React from "react";
import ChartPage from "../components/ChartPage";

function Indexes() {
  return (
    <ChartPage
      chartType="index"
      title="지수 관련(+-10%)"
      envelop={10}
    />
  );
}

export default Indexes;
