"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/atoms/Card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/atoms"

export const description = "A bar chart"

interface BarChartData {
  month: string
  desktop: number
  completed?: number
}

interface BarChartProps {
  data?: BarChartData[]
  title?: string
  description?: string
  footerText?: string
  trendText?: string
  showTrend?: boolean
  chartConfig?: ChartConfig
  showCompletedInTooltip?: boolean
}

const defaultChartData: BarChartData[] = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

const defaultChartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ChartBarDefault({
  data = defaultChartData,
  title = "Bar Chart",
  description = "January - June 2024",
  footerText = "Showing total visitors for the last 6 months",
  trendText = "Trending up by 5.2% this month",
  showTrend = true,
  chartConfig = defaultChartConfig,
  showCompletedInTooltip = false,
}: BarChartProps) {
  // Debug: Log the data received by the chart
  console.log('[BarChart] Received data:', data);
  console.log('[BarChart] Data length:', data?.length);
  console.log('[BarChart] Has data:', data && data.length > 0);
  
  // Custom tooltip formatter for completed tasks
  const customTooltipFormatter = (value: any, name: any, item: any) => {
    if (showCompletedInTooltip && item.payload.completed !== undefined) {
      const total = item.payload.desktop;
      const completed = item.payload.completed;
      const pending = total - completed;
      return [
        <div key="tooltip" className="flex flex-col gap-0.5 text-xs">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{total} Total Task{total !== 1 ? 's' : ''}</div>
          <div className="text-emerald-600 dark:text-emerald-400">✓ {completed} Completed</div>
          <div className="text-amber-600 dark:text-amber-400">○ {pending} Pending</div>
        </div>,
        ''
      ];
    }
    // Return formatted value with proper label from config
    const label = chartConfig[name as keyof typeof chartConfig]?.label || name;
    return [`${value}%`, label];
  };
  return (
    <Card className="border-[#e2e8f0] dark:border-[#2E2E2E]">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-[#0f172a] dark:text-[#FFFFFF]">{title}</CardTitle>
        <CardDescription className="text-[#64748b] dark:text-[#BCBCBC]">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel formatter={customTooltipFormatter} />}
            />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        {showTrend && (
          <div className="flex gap-2 leading-none font-medium text-[#0f172a] dark:text-[#FFFFFF]">
            {trendText} <TrendingUp className="h-4 w-4" />
          </div>
        )}
        <div className="text-[#64748b] dark:text-[#BCBCBC] leading-none">
          {footerText}
        </div>
      </CardFooter>
    </Card>
  )
}
