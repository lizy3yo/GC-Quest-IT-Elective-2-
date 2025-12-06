"use client"

import { TrendingUp, Award, ThumbsUp, AlertTriangle, AlertCircle } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/atoms/Card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/atoms/Tooltip"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/atoms"

interface GradeDistributionData {
  excellent: number;
  good: number;
  satisfactory: number;
  needsImprovement: number;
}

interface GradeDistributionChartProps {
  data: GradeDistributionData;
  totalStudents: number;
  className?: string;
}

const chartConfig = {
  students: {
    label: "Students",
  },
  excellent: {
    label: "Excellent (90-100%)",
    color: "hsl(142, 76%, 36%)", // Green
  },
  good: {
    label: "Good (80-89%)",
    color: "hsl(221, 83%, 53%)", // Blue
  },
  satisfactory: {
    label: "Satisfactory (70-79%)",
    color: "hsl(48, 96%, 53%)", // Yellow
  },
  needsImprovement: {
    label: "Needs Improvement (<70%)",
    color: "hsl(0, 84%, 60%)", // Red
  },
} satisfies ChartConfig

export function GradeDistributionChart({
  data,
  totalStudents,
  className = "",
}: GradeDistributionChartProps) {
  // Transform data for the chart
  const chartData = [
    {
      grade: "Excellent",
      students: data.excellent,
      fill: chartConfig.excellent.color,
      icon: Award,
      range: "90-100%"
    },
    {
      grade: "Good",
      students: data.good,
      fill: chartConfig.good.color,
      icon: ThumbsUp,
      range: "80-89%"
    },
    {
      grade: "Satisfactory",
      students: data.satisfactory,
      fill: chartConfig.satisfactory.color,
      icon: AlertTriangle,
      range: "70-79%"
    },
    {
      grade: "Needs Help",
      students: data.needsImprovement,
      fill: chartConfig.needsImprovement.color,
      icon: AlertCircle,
      range: "<70%"
    },
  ];

  const totalGraded = data.excellent + data.good + data.satisfactory + data.needsImprovement;
  const hasData = totalGraded > 0;

  // Calculate insights
  const excellentPercentage = hasData ? Math.round((data.excellent / totalGraded) * 100) : 0;
  const atRiskPercentage = hasData ? Math.round((data.needsImprovement / totalGraded) * 100) : 0;

  return (
    <Card className={`border-[#e2e8f0] dark:border-[#2E2E2E] h-full flex flex-col ${className}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold text-[#0f172a] dark:text-[#FFFFFF]">
            Grade Distribution
          </CardTitle>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" aria-label="Grade distribution help">
                  <span className="text-xs">?</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Shows how students are distributed across performance levels. Useful for spotting high performers and students who need support.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-[#64748b] dark:text-[#BCBCBC]">
          Performance breakdown across all classes
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 flex-1">
            <div className="w-16 h-16 mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Award className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              No Graded Work Yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-center text-sm max-w-sm">
              Grade distribution will appear once you&apos;ve graded student submissions
            </p>
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig}>
              <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{
                  left: 0,
                }}
              >
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="grade"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  width={100}
                />
                <XAxis type="number" hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name, item) => {
                        const percentage = totalGraded > 0 
                          ? Math.round((Number(value) / totalGraded) * 100)
                          : 0;
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: item.payload.fill }}
                              />
                              <span className="font-semibold">{item.payload.grade}</span>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {item.payload.range}
                            </div>
                            <div className="text-sm font-semibold">
                              {value} {Number(value) === 1 ? 'student' : 'students'} ({percentage}%)
                            </div>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey="students" radius={4}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 mb-0">
              {chartData.map((item) => {
                const Icon = item.icon;
                const percentage = totalGraded > 0 
                  ? Math.round((item.students / totalGraded) * 100)
                  : 0;
                
                return (
                  <div
                    key={item.grade}
                    className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  >
                    <Icon className="w-5 h-5 mb-2" style={{ color: item.fill }} />
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {item.students}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 text-center">
                      {item.grade}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-500">
                      {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
      {hasData && (
        <CardFooter className="flex-col items-center gap-2 text-sm text-center pt-2 pb-6">
          <div className="flex gap-2 font-medium leading-none">
            {excellentPercentage >= 50 ? (
              <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                {excellentPercentage}% of students performing excellently <TrendingUp className="h-4 w-4" />
              </span>
            ) : atRiskPercentage > 30 ? (
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                {atRiskPercentage}% of students need additional support <AlertCircle className="h-4 w-4" />
              </span>
            ) : (
              <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                Most students performing at satisfactory level or above <TrendingUp className="h-4 w-4" />
              </span>
            )}
          </div>
          <div className="leading-none text-[#64748b] dark:text-[#BCBCBC]">
            Based on {totalGraded} graded {totalGraded === 1 ? 'submission' : 'submissions'} from {totalStudents} {totalStudents === 1 ? 'student' : 'students'}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
