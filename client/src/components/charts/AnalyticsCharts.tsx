import React, { useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  categoryAxisWidth,
  chartTooltipStyle,
  isExcludedChartCategory,
} from "@/lib/analyticsChartUtils";

export interface CategoryChartPoint {
  name: string;
  [key: string]: string | number;
}

interface CategoryTooltipProps {
  active?: boolean;
  payload?: { value?: number; payload?: CategoryChartPoint }[];
  label?: string;
  valueLabel?: string;
}

function CategoryTooltip({ active, payload, label, valueLabel = "Count" }: CategoryTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const name = (row.payload?.name as string) || label || "";
  const value = row.value ?? 0;
  return (
    <div style={chartTooltipStyle} className="text-sm">
      <p className="font-semibold text-gray-900 mb-1 max-w-[280px] break-words">{name}</p>
      <p className="text-gray-600">
        {valueLabel}: <span className="font-semibold text-gray-900">{value}</span>
      </p>
    </div>
  );
}

interface AnalyticsCategoryBarChartProps {
  data: CategoryChartPoint[];
  categoryKey?: string;
  dataKey?: string;
  fill?: string;
  height?: number;
  valueLabel?: string;
  emptyMessage?: string;
  barSize?: number;
}

/** Horizontal bar chart — full category labels, no clipping. */
export function AnalyticsCategoryBarChart({
  data,
  categoryKey = "name",
  dataKey = "value",
  fill = "#3B82F6",
  height = 380,
  valueLabel = "Count",
  emptyMessage = "No data available",
  barSize = 28,
}: AnalyticsCategoryBarChartProps) {
  const normalized = useMemo(
    () =>
      data.map((d) => {
        const label = String(d[categoryKey] ?? d.name ?? "");
        return { ...d, name: label };
      }),
    [data, categoryKey]
  );
  const filtered = useMemo(
    () => normalized.filter((d) => d.name && !isExcludedChartCategory(d.name)),
    [normalized]
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const yWidth = useMemo(() => categoryAxisWidth(filtered.map((d) => d.name)), [filtered]);
  const chartHeight = Math.max(height, filtered.length * (barSize + 14) + 48);

  const onMouseLeave = useCallback(() => setActiveIndex(null), []);

  if (filtered.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 text-sm"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={filtered}
        margin={{ top: 16, right: 28, left: 8, bottom: 16 }}
        barCategoryGap="18%"
        onMouseLeave={onMouseLeave}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          stroke="#6b7280"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={yWidth}
          stroke="#6b7280"
          tick={{ fontSize: 12, fill: "#374151" }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "rgba(59, 130, 246, 0.08)" }}
          content={<CategoryTooltip valueLabel={valueLabel} />}
        />
        <Bar
          dataKey={dataKey}
          fill={fill}
          radius={[0, 6, 6, 0]}
          barSize={barSize}
          activeBar={{ fill, opacity: 0.85, stroke: "#1d4ed8", strokeWidth: 1 }}
          onMouseEnter={(_, index) => setActiveIndex(index)}
        >
          {filtered.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={fill}
              opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface StackedSeries {
  dataKey: string;
  fill: string;
  name?: string;
}

interface AnalyticsStackedBarChartProps {
  data: CategoryChartPoint[];
  series: StackedSeries[];
  height?: number;
  emptyMessage?: string;
}

export function AnalyticsStackedBarChart({
  data,
  series,
  height = 420,
  emptyMessage = "No data available",
}: AnalyticsStackedBarChartProps) {
  const filtered = useMemo(
    () => data.filter((d) => d.name && !isExcludedChartCategory(d.name)),
    [data]
  );
  const yWidth = useMemo(() => categoryAxisWidth(filtered.map((d) => d.name)), [filtered]);
  const chartHeight = Math.max(height, filtered.length * 36 + 56);

  if (filtered.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 text-sm"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={filtered}
        margin={{ top: 16, right: 28, left: 8, bottom: 16 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={yWidth}
          stroke="#6b7280"
          tick={{ fontSize: 12, fill: "#374151" }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "rgba(59, 130, 246, 0.06)" }}
          contentStyle={chartTooltipStyle}
        />
        <Legend wrapperStyle={{ paddingTop: 12 }} />
        {series.map((s, index) => (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name ?? s.dataKey}
            stackId="stack"
            fill={s.fill}
            radius={
              index === 0
                ? [0, 0, 0, 0]
                : index === series.length - 1
                  ? [0, 4, 4, 0]
                  : [0, 0, 0, 0]
            }
            barSize={22}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TrendPoint {
  date: string;
  [key: string]: string | number;
}

interface AnalyticsTrendLineChartProps {
  data: TrendPoint[];
  dataKey: string;
  stroke?: string;
  height?: number;
  labelFormatter?: (value: string) => string;
}

export function AnalyticsTrendLineChart({
  data,
  dataKey,
  stroke = "#8B5CF6",
  height = 340,
  labelFormatter = (value) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
}: AnalyticsTrendLineChartProps) {
  const tickFormatter = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 20, right: 28, left: 12, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          stroke="#6b7280"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tickFormatter={tickFormatter}
          minTickGap={24}
        />
        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          labelFormatter={labelFormatter}
          contentStyle={chartTooltipStyle}
          cursor={{ stroke: stroke, strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          strokeWidth={3}
          dot={{ fill: stroke, strokeWidth: 2, r: 5 }}
          activeDot={{ r: 8, stroke, strokeWidth: 2, fill: "#fff" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Grouped horizontal bars (e.g. completed vs pending) with full category labels. */
export function AnalyticsGroupedBarChart({
  data,
  bars,
  height = 360,
}: {
  data: CategoryChartPoint[];
  bars: { dataKey: string; fill: string; name?: string }[];
  height?: number;
}) {
  const filtered = useMemo(
    () => data.filter((d) => d.name && !isExcludedChartCategory(d.name)),
    [data]
  );
  const yWidth = useMemo(() => categoryAxisWidth(filtered.map((d) => d.name)), [filtered]);
  const chartHeight = Math.max(height, filtered.length * 44 + 56);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={filtered}
        margin={{ top: 16, right: 28, left: 8, bottom: 16 }}
        barCategoryGap="24%"
        barGap={4}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={yWidth}
          stroke="#6b7280"
          tick={{ fontSize: 12, fill: "#374151" }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Legend wrapperStyle={{ paddingTop: 12 }} />
        {bars.map((b) => (
          <Bar
            key={b.dataKey}
            dataKey={b.dataKey}
            name={b.name ?? b.dataKey}
            fill={b.fill}
            radius={[0, 4, 4, 0]}
            barSize={18}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
