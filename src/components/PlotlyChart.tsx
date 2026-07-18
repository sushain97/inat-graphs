"use client";

import dynamic from "next/dynamic";
import { PLOTLY_DARK_TEMPLATE, type PlotlyFigure } from "@/lib/charts/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function PlotlyChart({ figure }: { figure: PlotlyFigure }) {
  return (
    <Plot
      data={figure.data}
      layout={{ template: PLOTLY_DARK_TEMPLATE, ...figure.layout }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}
