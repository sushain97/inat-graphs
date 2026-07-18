import type { Data, Layout, Template } from "plotly.js";

export interface PlotlyFigure {
  data: Data[];
  layout: Partial<Layout>;
}

export const PLOTLY_LEGEND: Partial<Layout["legend"]> = {
  orientation: "h",
  yanchor: "top",
  y: -0.2,
  xanchor: "center",
  x: 0.5,
};

const AXIS_LINE_COLOR = "rgba(255, 255, 255, 0.2)";

export const PLOTLY_DARK_TEMPLATE: Template = {
  layout: {
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: "#c1c2c5" },
    xaxis: {
      gridcolor: "rgba(255, 255, 255, 0.1)",
      zerolinecolor: AXIS_LINE_COLOR,
      linecolor: AXIS_LINE_COLOR,
      automargin: true,
    },
    yaxis: {
      gridcolor: "rgba(255, 255, 255, 0.1)",
      zerolinecolor: AXIS_LINE_COLOR,
      linecolor: AXIS_LINE_COLOR,
      automargin: true,
      ticksuffix: "  ",
    },
    hoverlabel: { bgcolor: "#1a1b1e", font: { color: "#c1c2c5" } },
  },
};
