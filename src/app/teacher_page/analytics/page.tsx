"use client";

import { useState, useEffect, useCallback } from "react";
import { useLoading } from "@/hooks/useLoading";
import useAuth from "@/hooks/useAuth";
import LoadingTemplate2 from "@/components/molecules/loading_template_2/loading_template_2/loading2";
import { GradeDistributionChart } from "@/components/organisms";
import {
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  AlertTriangle,
  BarChart3,
  Activity,
  RefreshCw,
  Download
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/atoms";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/atoms";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/atoms";

interface AssessmentStat {
  assessmentId: string;
  title: string;
  classId: string;
  className: string;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  submissionCount: number;
  totalStudents: number;
}

interface StudentRisk {
  studentId: string;
  studentName: string;
  email: string;
  averageScore: number;
  missedAssignments: number;
  lastActive: string | null;
  classes: string[];
}

interface EngagementData {
  date: string;
  activeStudents: number;
  submissions: number;
}

interface PerformanceTrend {
  period: string;
  averageScore: number;
  submissionCount: number;
}

interface AnalyticsData {
  assessmentStats: AssessmentStat[];
  atRiskStudents: StudentRisk[];
  engagementData: EngagementData[];
  performanceTrends: PerformanceTrend[];
  gradeDistribution: {
    excellent: number;
    good: number;
    satisfactory: number;
    needsImprovement: number;
  };
  summary: {
    totalClasses: number;
    totalStudents: number;
    totalAssessments: number;
    atRiskCount: number;
  };
}

const engagementChartConfig = {
  activeStudents: {
    label: "Active Students",
    color: "hsl(221, 83%, 53%)",
  },
  submissions: {
    label: "Submissions",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig;

const performanceChartConfig = {
  averageScore: {
    label: "Average Score",
    color: "hsl(221, 83%, 53%)",
  },
} satisfies ChartConfig;

const assessmentChartConfig = {
  averageScore: {
    label: "Avg",
    color: "hsl(221, 83%, 53%)",
  },
  highestScore: {
    label: "High",
    color: "hsl(142, 76%, 36%)",
  },
  lowestScore: {
    label: "Low",
    color: "hsl(0, 84%, 60%)",
  },
} satisfies ChartConfig;

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

const ASSESSMENTS_PER_PAGE = 8;

// Convert an SVG element to a PNG data URL with inline styles for reliability in PDF exports
const svgToPng = async (svgElement: SVGSVGElement, targetWidthPx: number, targetHeightPx: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

      // Ensure width/height/viewBox are set
      const rect = svgElement.getBoundingClientRect();
      let svgWidth = rect.width;
      let svgHeight = rect.height;
      if (!svgWidth || !svgHeight) {
        svgWidth = parseFloat(svgElement.getAttribute('width') || '0');
        svgHeight = parseFloat(svgElement.getAttribute('height') || '0');
      }
      if (!svgWidth || !svgHeight) {
        svgWidth = targetWidthPx;
        svgHeight = targetHeightPx;
      }

      const viewBox = svgElement.getAttribute('viewBox') || `0 0 ${svgWidth} ${svgHeight}`;
      clonedSvg.setAttribute('viewBox', viewBox);
      clonedSvg.setAttribute('width', `${svgWidth}`);
      clonedSvg.setAttribute('height', `${svgHeight}`);
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Inline important computed styles
      const allElements = clonedSvg.querySelectorAll('*');
      allElements.forEach((el) => {
        if (el instanceof SVGElement) {
          const computed = window.getComputedStyle(el);
          if (computed.fill && computed.fill !== 'none' && !el.getAttribute('fill')) {
            el.setAttribute('fill', computed.fill);
          }
          if (computed.stroke && computed.stroke !== 'none' && !el.getAttribute('stroke')) {
            el.setAttribute('stroke', computed.stroke);
          }
          if (computed.strokeWidth && !el.getAttribute('stroke-width')) {
            el.setAttribute('stroke-width', computed.strokeWidth);
          }
          if (computed.opacity && computed.opacity !== '1' && !el.getAttribute('opacity')) {
            el.setAttribute('opacity', computed.opacity);
          }
          if (computed.fontSize && !el.getAttribute('font-size')) {
            el.setAttribute('font-size', computed.fontSize);
          }
          if (computed.fontFamily && !el.getAttribute('font-family')) {
            el.setAttribute('font-family', computed.fontFamily);
          }
        }
      });

      const svgString = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidthPx;
        canvas.height = targetHeightPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngDataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(pngDataUrl);
      };
      img.onerror = (err) => {
        console.error('[Export] Image load error from SVG:', err);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };
      img.src = url;
    } catch (error) {
      console.error('[Export] SVG to PNG conversion error:', error);
      reject(error);
    }
  });
};

export default function AnalyticsPage() {
  const { isLoading: isPageLoading, startLoading, stopLoading } = useLoading(true);
  const { isLoading: authLoading, user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [assessmentPage, setAssessmentPage] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setDataLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/teacher_page/analytics/detailed?days=30', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      const result = await response.json();

      if (result.success && result.data) {
        setAnalyticsData(result.data);
      } else {
        setError(result.error || 'Failed to load analytics');
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data');
    } finally {
      setDataLoading(false);
      stopLoading();
    }
  }, [stopLoading]);

  useEffect(() => {
    if (user?._id) {
      startLoading();
      fetchAnalytics();
    }
  }, [user?._id, fetchAnalytics, startLoading]);



  const exportToPDF = async () => {
    if (!analyticsData) return;

    setExporting(true);
    try {
      const jsPDF = (await import('jspdf')).default;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = margin;

      // Colors
      const primaryBlue = [59, 130, 246];
      const darkGray = [31, 41, 55];
      const lightGray = [107, 114, 128];

      // Header
      pdf.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      pdf.rect(0, 0, pageWidth, 35, 'F');

      pdf.setFontSize(24);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Analytics Report', margin, 20);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const now = new Date();
      pdf.text(`Generated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, margin, 28);

      yPos = 45;

      // Summary Section
      pdf.setFontSize(14);
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary', margin, yPos);

      yPos += 8;

      const boxWidth = (contentWidth - 9) / 4;
      const boxHeight = 25;

      const metrics = [
        { label: 'Total Classes', value: analyticsData.summary.totalClasses, color: [59, 130, 246] },
        { label: 'Total Students', value: analyticsData.summary.totalStudents, color: [34, 197, 94] },
        { label: 'Assessments', value: analyticsData.summary.totalAssessments, color: [251, 191, 36] },
        { label: 'At-Risk', value: analyticsData.summary.atRiskCount, color: [249, 115, 22] }
      ];

      metrics.forEach((metric, i) => {
        const boxX = margin + (i * (boxWidth + 3));
        pdf.setFillColor(245, 245, 245);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(boxX, yPos, boxWidth, boxHeight, 2, 2, 'FD');

        pdf.setFontSize(18);
        pdf.setTextColor(metric.color[0], metric.color[1], metric.color[2]);
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(metric.value), boxX + boxWidth / 2, yPos + 12, { align: 'center' });

        pdf.setFontSize(8);
        pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
        pdf.setFont('helvetica', 'normal');
        pdf.text(metric.label, boxX + boxWidth / 2, yPos + 20, { align: 'center' });
      });

      yPos += boxHeight + 15;

      // Charts Section
      pdf.setFontSize(14);
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Charts', margin, yPos);

      yPos += 8;

      // Collect all Recharts SVG surfaces within chart containers
      const chartSvgs = Array.from(
        document.querySelectorAll('[data-slot="chart"] svg.recharts-surface')
      ) as SVGSVGElement[];

      // Context text for each chart in render order
      const chartContexts = [
        'Performance trends: weekly average scores (0–100%).',
        'Student engagement: daily active students and submissions (last 30 days).',
        'Grade distribution: share of students by performance band.'
      ];

      console.info('[Export] Found chart SVGs:', chartSvgs.length);
      if (!chartSvgs.length) {
        console.warn('[Export] No Recharts SVGs found with selector [data-slot="chart"] svg.recharts-surface');
      }

      // Conversion ratio from CSS pixels to millimeters
      const MM_PER_PX = 0.264583; // 96px per inch -> 25.4 mm per inch

      for (let idx = 0; idx < chartSvgs.length; idx++) {
        const svg = chartSvgs[idx];
        try {
          // Compute target dimensions preserving aspect ratio to fit content width
          const rect = svg.getBoundingClientRect();
          const fallbackWidthMm = contentWidth;
          const fallbackHeightMm = 60; // sensible default height if bounding box is 0
          const svgWidthMm = rect.width > 0 ? rect.width * MM_PER_PX : fallbackWidthMm;
          const svgHeightMm = rect.height > 0 ? rect.height * MM_PER_PX : fallbackHeightMm;
          const targetWidthMm = contentWidth;
          const scale = svgWidthMm > 0 ? targetWidthMm / svgWidthMm : 1;
          const targetHeightMm = svgHeightMm * scale;

          if (yPos + targetHeightMm + 8 > pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
          }

          // Add context text above the chart
          pdf.setFontSize(10);
          pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
          pdf.setFont('helvetica', 'normal');
          const contextText = chartContexts[idx] || 'Chart';
          pdf.text(contextText, margin, yPos);
          yPos += 5;

          const targetWidthPx = targetWidthMm * 3.78;
          const targetHeightPx = targetHeightMm * 3.78;
          const pngDataUrl = await svgToPng(svg, targetWidthPx, targetHeightPx);

          pdf.addImage(pngDataUrl, 'PNG', margin, yPos, targetWidthMm, targetHeightMm);

          yPos += targetHeightMm + 10; // add spacing between charts
        } catch (chartErr) {
          console.error('[Export] Failed to render chart SVG into PDF', chartErr);
        }
      }

      // Removed Assessment Performance section per latest requirements

      // At-Risk Students Section
      if (analyticsData.atRiskStudents.length > 0) {
        if (yPos > pageHeight - 60) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.setFontSize(14);
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        pdf.setFont('helvetica', 'bold');
        pdf.text('At-Risk Students', margin, yPos);

        yPos += 8;

        // Table header
        pdf.setFillColor(254, 243, 199);
        pdf.rect(margin, yPos, contentWidth, 8, 'F');

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        pdf.text('Student', margin + 2, yPos + 5);
        pdf.text('Avg Score', margin + 70, yPos + 5);
        pdf.text('Missed', margin + 100, yPos + 5);
        pdf.text('Last Active', margin + 130, yPos + 5);

        yPos += 10;

        analyticsData.atRiskStudents.slice(0, 10).forEach((student) => {
          if (yPos > pageHeight - 20) {
            pdf.addPage();
            yPos = margin;
          }

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

          const name = student.studentName.length > 25 ? student.studentName.substring(0, 25) + '...' : student.studentName;
          pdf.text(name, margin + 2, yPos + 4);

          // Color code the average score
          if (student.averageScore < 50) {
            pdf.setTextColor(220, 38, 38);
          } else if (student.averageScore < 70) {
            pdf.setTextColor(234, 179, 8);
          }
          pdf.text(`${student.averageScore}%`, margin + 70, yPos + 4);

          pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
          pdf.text(String(student.missedAssignments), margin + 100, yPos + 4);
          pdf.text(formatTimeAgo(student.lastActive), margin + 130, yPos + 4);

          yPos += 7;
        });
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      pdf.text('GC-Quest Instructor Analytics', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save
      const fileName = `analytics-report-${now.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching dashboard/library page style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                Analytics
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                View detailed insights and performance trends
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToPDF}
                disabled={exporting || !analyticsData}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <Download className={`size-4 ${exporting ? 'animate-pulse' : ''}`} />
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button
                onClick={fetchAnalytics}
                disabled={dataLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-[#2E7D32] text-white hover:bg-[#1B5E20] disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`size-4 ${dataLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {isPageLoading || authLoading || dataLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-3"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
              </div>
            ))}
          </div>
        ) : analyticsData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Classes</CardDescription>
                <CardTitle className="text-3xl">{analyticsData.summary.totalClasses}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <BookOpen className="size-4" />
                  Active classes
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Students</CardDescription>
                <CardTitle className="text-3xl">{analyticsData.summary.totalStudents}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Users className="size-4" />
                  Enrolled students
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Assessments</CardDescription>
                <CardTitle className="text-3xl">{analyticsData.summary.totalAssessments}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <BarChart3 className="size-4" />
                  Created assessments
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>At-Risk Students</CardDescription>
                <CardTitle className="text-3xl text-orange-600">{analyticsData.summary.atRiskCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <AlertTriangle className="size-4" />
                  Need attention
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Grid */}
        {isPageLoading || authLoading || dataLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-6"></div>
                <div className="h-[250px] bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        ) : analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Performance Trends */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">Performance Trends</CardTitle>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                          <span className="text-xs">?</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Weekly average scores across all classes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>Weekly average scores over the past month</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.performanceTrends.length > 0 ? (
                  <ChartContainer config={performanceChartConfig} className="h-[250px] w-full">
                    <LineChart data={analyticsData.performanceTrends} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="averageScore"
                        stroke="hsl(221, 83%, 53%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(221, 83%, 53%)" }}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-500">
                    No performance data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Student Engagement */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">Student Engagement</CardTitle>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                          <span className="text-xs">?</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Daily active students and submissions over the past 30 days</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>Daily activity over the past 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.engagementData.length > 0 ? (
                  <ChartContainer config={engagementChartConfig} className="h-[250px] w-full">
                    <AreaChart data={analyticsData.engagementData} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        interval="preserveStartEnd"
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="submissions"
                        stackId="1"
                        stroke="hsl(142, 76%, 36%)"
                        fill="hsl(142, 76%, 36%)"
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="activeStudents"
                        stackId="2"
                        stroke="hsl(221, 83%, 53%)"
                        fill="hsl(221, 83%, 53%)"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-500">
                    No engagement data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Grade Distribution */}
        {isPageLoading || authLoading || dataLoading ? (
          <div className="mb-6">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-6"></div>
              <div className="h-[250px] bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        ) : analyticsData && analyticsData.gradeDistribution && (
          <div className="mb-6">
            <GradeDistributionChart
              data={analyticsData.gradeDistribution}
              totalStudents={analyticsData.summary.totalStudents}
              className="[&_[data-slot=chart]]:h-[250px] [&_[data-slot=chart]]:aspect-auto [&_footer]:py-3 [&_.card-content]:py-0 [&_.card-header]:pb-2"
            />
          </div>
        )}

        {/* At-Risk Students Table */}
        {isPageLoading || authLoading || dataLoading ? (
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-6"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-4">
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                </div>
              ))}
            </div>
          </div>
        ) : analyticsData && analyticsData.atRiskStudents.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">At-Risk Students</CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                        <span className="text-xs">?</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Students with average score under 70% or inactive for 7+ days</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription>Students who may need additional support</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Student</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Average</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Missed</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Last Active</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Classes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.atRiskStudents.slice(0, 10).map((student) => (
                      <tr key={student.studentId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">{student.studentName}</div>
                            <div className="text-xs text-slate-500">{student.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${student.averageScore >= 70
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : student.averageScore >= 50
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            {student.averageScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {student.missedAssignments} assignments
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {formatTimeAgo(student.lastActive)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {student.classes.slice(0, 2).map((cls, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
                                {cls}
                              </span>
                            ))}
                            {student.classes.length > 2 && (
                              <span className="text-xs text-slate-500">+{student.classes.length - 2} more</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {analyticsData && !analyticsData.assessmentStats.length && !analyticsData.atRiskStudents.length && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Activity className="size-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  No Analytics Data Yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm">
                  Analytics will appear once you have graded student submissions. Create assessments and grade student work to see performance insights.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
