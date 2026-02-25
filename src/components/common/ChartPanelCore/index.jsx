// src/components/common/ChartPanelCore/index.jsx
import React from "react";

import ChartView from "../ChartView";
import SignalNotesPanel from "../SignalNotesPanel";
import {fmtKSTHour} from "../../../lib/tradeUtils";

import useCoreSignals from "./useCoreSignals";
import useCoreCandles from "./useCoreCandles";

export default function ChartPanelCore({
                                           source,
                                           symbol,
                                           dayOffset,
                                           anchorEndUtcSec,

                                           // UI/Behavior
                                           bounds = {min: -7, max: 0},
                                           width,
                                           height = 320,

                                           thr,
                                           crossTimes,

                                           // formatters
                                           tickFormatter = (tsSec) => fmtKSTHour(tsSec),

                                           // ✅ override only (없으면 rows 기반 auto)
                                           priceScale, // number | undefined

                                           // callbacks
                                           onBounds,
                                           onStats,
                                       }) {

    const {ensureSignals, getMarkersForWindow, getNotesForWindow} =
        useCoreSignals({source, dayOffset, crossTimes});

    const {
        loading,
        notesView,
        displayCandles,
        ma100,
        markers,
        visibleRange,
        autoDigits,
        getPriceText,
    } = useCoreCandles({
        source,
        symbol,
        dayOffset,
        anchorEndUtcSec,
        bounds,
        priceScale,
        ensureSignals,
        getMarkersForWindow,
        getNotesForWindow,
        onBounds,
        onStats,
    });

    return (
        <div style={{marginBottom: 28}}>
            <div style={{fontSize: 20, opacity: 0.8, marginBottom: 6}}>
                {symbol}
                <span style={{marginLeft: 10, fontSize: 12, opacity: 0.65}}>(dayOffset: {dayOffset})</span>
                <span style={{marginLeft: 10, fontSize: 12, opacity: 0.5}}>(digits: {autoDigits})</span>
            </div>

            <div style={{width: width ?? "100%", maxWidth: "100%", position: "relative"}}>
                {loading ? (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 5,
                            fontWeight: 800,
                            borderRadius: 12,
                            backdropFilter: "blur(2px)",
                        }}
                    >
                        로딩중...
                    </div>
                ) : null}

                <ChartView
                    width={typeof width === "number" ? width : undefined}
                    height={height}
                    tickFormatter={tickFormatter}
                    displayCandles={displayCandles}
                    ma100={ma100}
                    thr={thr}
                    markers={markers}
                    priceScale={autoDigits}
                    visibleRange={visibleRange}
                />

                <SignalNotesPanel
                    symbol={symbol}
                    notes={notesView}
                    getPriceText={getPriceText}
                    collapseKey={`${symbol}:${dayOffset}`}
                />
            </div>
        </div>
    );
}