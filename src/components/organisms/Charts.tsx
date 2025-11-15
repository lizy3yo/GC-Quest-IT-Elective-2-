"use client";

import { Sparkbar } from "@/components/molecules/charts/Sparkbar";
import { DonutChart } from "@/components/molecules/charts/DonutChart";
import { SimpleBarChart } from "@/components/molecules/charts/SimpleBarChart";

interface ChartsProps {
  upcomingByDay: Array<{ day: string; count: number }>;
  assessmentsByType: Array<{ type: string; count: number }>;
  assessmentsBySubject: Array<{ subject: string; count: number }>;
  subjectBreakdown: Array<{ subject: string; count: number }>;
}

export default function Charts({
  upcomingByDay,
  assessmentsByType,
  assessmentsBySubject,
  subjectBreakdown,
}: ChartsProps) {
  return (
    <section aria-labelledby="charts-insights-title" className="w-full charts-insights-spacing" style={{ marginTop: '1rem' }}>
      <h2 id="charts-insights-title" className="sd-title">Charts & Insights</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
        <div className="panel" style={{ padding: '0.5rem 1rem 0.75rem 1rem' }}>
          <h3 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1rem' }}>Upcoming workload (next 7 days)</h3>
          <div aria-hidden style={{ height: 300, width: '100%', paddingTop: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <Sparkbar data={upcomingByDay} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="panel panel-padded-lg">
            <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Assessments</h4>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DonutChart data={assessmentsByType} size={120} />
            </div>
          </div>

          <div className="panel panel-padded-lg">
            <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Assessments by subject</h4>
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              <SimpleBarChart data={assessmentsBySubject.length ? assessmentsBySubject : subjectBreakdown} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
