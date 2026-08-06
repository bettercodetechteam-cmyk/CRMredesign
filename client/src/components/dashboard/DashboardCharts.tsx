"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardChartsProps {
  leadStatusData: Array<{ name: string; value: number }>;
  leadsByCourseData: Array<{ name: string; value: number }>;
}

// Custom Gradient Bar Component
const CustomGradientBar = (
  props: React.SVGProps<SVGRectElement> & { dataKey?: string }
) => {
  const { fill, x, y, width, height, dataKey } = props;

  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="none"
        fill={`url(#gradient-bar-pattern-${dataKey})`}
      />
      <rect x={x} y={y} width={width} height={2} stroke="none" fill={fill} />
      <defs>
        <linearGradient
          id={`gradient-bar-pattern-${dataKey}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={fill} stopOpacity={0.5} />
          <stop offset="100%" stopColor={fill} stopOpacity={0} />
        </linearGradient>
      </defs>
    </>
  );
};

// Custom Gradient Bar Component for Vertical Chart
const CustomGradientBarVertical = (
  props: React.SVGProps<SVGRectElement> & {
    dataKey?: string;
    activeProperty?: string | null;
    glowOpacity?: number;
  }
) => {
  const { fill, x, y, width, height, dataKey, activeProperty, radius } = props;

  const isActive = activeProperty === "all" ? true : activeProperty === dataKey;

  // Extract a single numeric value from radius array for SVG rx attribute
  // radius can be a number or an array [top-left, top-right, bottom-right, bottom-left]
  // For vertical bars, we use the top-right value (index 1) or max value
  const rxValue = Array.isArray(radius) 
    ? Math.max(...radius.filter((r): r is number => typeof r === 'number'))
    : (typeof radius === 'number' ? radius : 0);

  return (
    <>
      <rect
        x={x}
        y={y}
        rx={rxValue}
        width={width}
        height={height}
        stroke="none"
        fill={fill}
        opacity={isActive ? 1 : 0.1}
        filter={
          isActive && activeProperty !== "all"
            ? `url(#glow-chart-${dataKey})`
            : undefined
        }
      />
      <defs>
        <filter
          id={`glow-chart-${dataKey}`}
          x="-200%"
          y="-200%"
          width="600%"
          height="600%"
        >
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    </>
  );
};

// Leads by Course Vertical Bar Chart Component
function LeadsByCourseChart({ leadsByCourseData }: { leadsByCourseData: Array<{ name: string; value: number }> }) {
  const [activeProperty, setActiveProperty] = useState<string>("all");

  // Transform data for stacked bar chart
  // For simplicity, we'll show all courses in a single stacked bar per course
  // Or we can show top courses with their values
  const sortedData = [...leadsByCourseData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8); // Top 8 courses

  // Calculate total for percentage display
  const totalLeads = leadsByCourseData.reduce((sum, item) => sum + item.value, 0);

  // Calculate change (mock - you can replace with real calculation)
  const calculateChange = () => {
    if (sortedData.length < 2) return "0";
    const topValue = sortedData[0]?.value || 0;
    const secondValue = sortedData[1]?.value || 0;
    if (topValue === 0) return "0";
    const change = ((topValue - secondValue) / (topValue || 1)) * 100;
    return change.toFixed(1);
  };

  const changePercent = calculateChange();
  const isPositive = parseFloat(changePercent) >= 0;

  // Prepare chart data - each course as a separate entry
  const chartData = sortedData.map((item) => ({
    course: item.name.length > 15 ? item.name.slice(0, 15) : item.name,
    fullName: item.name,
    value: item.value,
    // For stacked bars, we can create multiple series if needed
    // For now, we'll use a single value per course
  }));

  const chartConfig = {
    value: {
      label: "Leads",
      color: "hsl(220, 70%, 50%)",
    },
  } satisfies ChartConfig;

  type ActivePropertyType = "all" | "value";

  return (
    <Card className="col-span-3 border-0 shadow-xl">
      <CardHeader>
        <div className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              Leads by Course
              {changePercent !== "0" && (
                <Badge
                  variant="outline"
                  className={
                    isPositive
                      ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                      : "text-red-500 bg-red-500/10 border-red-500/20"
                  }
                >
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  <span>{isPositive ? "+" : ""}{changePercent}%</span>
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {totalLeads} total course leads
            </CardDescription>
          </div>
          <Select
            value={activeProperty}
            onValueChange={(value: ActivePropertyType) => {
              setActiveProperty(value);
            }}
          >
            <SelectTrigger className="text-xs h-8 px-2 w-[100px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectLabel>View</SelectLabel>
                <SelectItem className="text-xs" value="all">
                  All
                </SelectItem>
                <SelectItem className="text-xs" value="value">
                  Leads
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {sortedData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{
                left: -10,
                right: 10,
              }}
            >
              <YAxis
                type="category"
                dataKey="course"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  const item = chartData.find((d) => d.course === value);
                  return item?.fullName?.slice(0, 12) || value;
                }}
                width={120}
              />
              <XAxis
                type="number"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                hide
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar
                barSize={32}
                shape={
                  <CustomGradientBarVertical activeProperty={activeProperty} />
                }
                dataKey="value"
                fill="var(--color-value)"
                radius={[0, 8, 8, 0]}
                overflow="visible"
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="text-center text-gray-500 py-16 h-[350px] flex items-center justify-center">
            No course data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({ leadStatusData, leadsByCourseData }: DashboardChartsProps) {
  // Calculate percentage change for lead status (mock calculation)
  const calculateGrowth = () => {
    if (leadStatusData.length < 2) return 0;
    const sorted = [...leadStatusData].sort((a, b) => b.value - a.value);
    if (sorted[0].value === 0) return 0;
    // Simple mock growth calculation
    return ((sorted[0].value / (sorted.reduce((sum, item) => sum + item.value, 0) || 1)) * 100).toFixed(1);
  };

  const growthRate = calculateGrowth();

  // Prepare data for bar chart - transform leadStatusData to match expected format
  const barChartData = leadStatusData.map(item => ({
    month: item.name.length > 8 ? item.name.slice(0, 8) : item.name,
    desktop: item.value,
    fullName: item.name,
  }));

  const chartConfig = {
    desktop: {
      label: "Leads",
      color: "hsl(220, 70%, 50%)",
    },
  } satisfies ChartConfig;

  // Get total leads for description
  const totalLeads = leadStatusData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      {/* Lead Status Bar Chart */}
      <Card className="col-span-4 border-0 shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                Lead Status Overview
                {growthRate !== "0" && (
                  <Badge
                    variant="outline"
                    className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>{growthRate}%</span>
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {totalLeads} total leads across all statuses
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <BarChart accessibilityLayer data={barChartData}>
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  const fullItem = barChartData.find(item => item.month === value);
                  return fullItem?.fullName?.slice(0, 8) || value;
                }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar
                shape={<CustomGradientBar />}
                dataKey="desktop"
                fill="var(--color-desktop)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Leads by Course - Vertical Bar Chart */}
      <LeadsByCourseChart leadsByCourseData={leadsByCourseData} />
    </div>
  );
}
