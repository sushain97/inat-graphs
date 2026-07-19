import type { ChartRow, ChartSeries } from "@/components/charts/BarChart";

export interface BarChartFigure {
  data: ChartRow[];
  series: ChartSeries[];
  mode: "group" | "stack";
  xLabel?: string;
  height?: number;
  yAxisWidth?: number;
  totalsKey?: string;
}
