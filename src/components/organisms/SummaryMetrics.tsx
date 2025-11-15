"use client";

interface SummaryMetricsProps {
  summary: {
    classes: number;
    activities: number;
    quizzes: number;
    exams: number;
  } | null;
}

export default function SummaryMetrics({ summary }: SummaryMetricsProps) {
  return (
    <section aria-label="Summary metrics" className="panel panel-padded-lg" style={{ marginBottom: '1rem' }}>
      <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
        <div className="metric-card panel">
          <div style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Classes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.classes ?? 0}</div>
          </div>
        </div>

        <div className="metric-card panel">
          <div style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Activities</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.activities ?? 0}</div>
          </div>
        </div>

        <div className="metric-card panel">
          <div style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Quizzes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.quizzes ?? 0}</div>
          </div>
        </div>

        <div className="metric-card panel">
          <div style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Exams</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.exams ?? 0}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
