"use client";

import { useState } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Label,
  LabelList,
  Legend,
  Rectangle,
  ResponsiveContainer,
  XAxis,
  YAxis,
  type BarRectangleItem,
} from "recharts";

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
}

export type ChartRow = {
  category: string;
  /** Per-series metadata (e.g. drilldown data), keyed by series key. */
  meta?: Record<string, unknown>;
  labelUrl?: string;
} & Record<string, unknown>;

export interface ChartClick {
  row: ChartRow;
  seriesKey: string;
}

const AXIS_COLOR = "#c1c2c5";
const GRID_COLOR = "rgba(255, 255, 255, 0.1)";
const DIMMED_OPACITY = 0.55;

function YAxisLinkedTick({
  x,
  y,
  payload,
  labelUrls,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
  labelUrls: Map<string, string>;
}) {
  const value = payload?.value ?? "";
  const url = labelUrls.get(value);
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={14}
      fill={AXIS_COLOR}
      style={{ cursor: url ? "pointer" : undefined }}
      onClick={
        url
          ? () => window.open(url, "_blank", "noopener,noreferrer")
          : undefined
      }
    >
      {value}
    </text>
  );
}

export function BarChart({
  data,
  series,
  mode,
  xLabel,
  yAxisWidth = 140,
  totalsKey,
  onBarClick,
}: {
  data: ChartRow[];
  series: ChartSeries[];
  mode: "group" | "stack";
  xLabel?: string;
  height?: number;
  yAxisWidth?: number;
  totalsKey?: string;
  onBarClick?: (click: ChartClick) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleSeries = (key: string) =>
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const labelUrls = new Map(
    data
      .filter((row): row is ChartRow & { labelUrl: string } => !!row.labelUrl)
      .map((row) => [row.category, row.labelUrl]),
  );

  const singleBarPerRow = mode === "stack" || series.length === 1;
  const rowHeight = singleBarPerRow ? 32 : 48;
  const chartHeight = Math.max(
    220,
    data.length * rowHeight + (series.length > 1 ? 156 : 106),
  );

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <RechartsBarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 16, left: 0 }}
      >
        <CartesianGrid horizontal={false} stroke={GRID_COLOR} />

        <XAxis
          type="number"
          stroke={AXIS_COLOR}
          tick={{ fill: AXIS_COLOR }}
          tickLine={{ stroke: GRID_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
        >
          {xLabel && (
            <Label
              value={xLabel}
              position="insideBottom"
              offset={-5}
              fill={AXIS_COLOR}
            />
          )}
        </XAxis>
        <YAxis
          type="category"
          dataKey="category"
          width={yAxisWidth}
          reversed
          stroke={AXIS_COLOR}
          tick={(props) => <YAxisLinkedTick {...props} labelUrls={labelUrls} />}
          tickLine={{ stroke: GRID_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
        />

        {series.length > 1 && (
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: 12 }}
            content={() => (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 16,
                }}
              >
                {(mode === "stack" ? [...series].reverse() : series).map(
                  (s) => (
                    <span
                      key={s.key}
                      onClick={() => toggleSeries(s.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                        color: AXIS_COLOR,
                        opacity: hiddenKeys.has(s.key) ? 0.5 : 1,
                        textDecoration: hiddenKeys.has(s.key)
                          ? "line-through"
                          : undefined,
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          display: "inline-block",
                          background: s.color,
                        }}
                      />
                      {s.name}
                    </span>
                  ),
                )}
              </div>
            )}
          />
        )}

        {series.map((s, seriesIndex) => {
          const isLastSeries = seriesIndex === series.length - 1;
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              hide={hiddenKeys.has(s.key)}
              stackId={mode === "stack" ? "stack" : undefined}
              onClick={
                onBarClick
                  ? (item: BarRectangleItem) =>
                      onBarClick({
                        row: item.payload as ChartRow,
                        seriesKey: s.key,
                      })
                  : undefined
              }
              onMouseEnter={(item: BarRectangleItem) =>
                setHovered(`${s.key}-${item.originalDataIndex}`)
              }
              onMouseLeave={(item: BarRectangleItem) => {
                const key = `${s.key}-${item.originalDataIndex}`;
                setHovered((prev) => (prev === key ? null : prev));
              }}
              shape={(shapeProps: BarRectangleItem) => (
                <Rectangle
                  {...shapeProps}
                  cursor={onBarClick ? "pointer" : undefined}
                  fillOpacity={
                    hovered &&
                    hovered !== `${s.key}-${shapeProps.originalDataIndex}`
                      ? DIMMED_OPACITY
                      : 1
                  }
                />
              )}
            >
              {mode === "group" && (
                <LabelList
                  dataKey={s.key}
                  position="right"
                  fill={AXIS_COLOR}
                  formatter={(v) => (v ? String(v) : "")}
                />
              )}
              {mode === "stack" && isLastSeries && totalsKey && (
                <LabelList
                  dataKey={totalsKey}
                  position="right"
                  fill={AXIS_COLOR}
                  formatter={(v) => ` ${v}`}
                />
              )}
            </Bar>
          );
        })}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
