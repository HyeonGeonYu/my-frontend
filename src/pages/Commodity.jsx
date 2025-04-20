import React from "react";
import ChartPage from "../components/ChartPage";

function Commodity() {
  return (
    <ChartPage
      chartType="commodity"
      title="원자재 관련(+-10%)"
      envelop={10}
    />
  );
}

export default Commodity;
