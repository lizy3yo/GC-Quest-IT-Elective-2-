"use client";

export function DonutChart({ data, size = 120 }: { data: Array<{ type: string; count: number }>; size?: number }) {
  const total = data.reduce((s, d) => s + (d.count || 0), 0) || 1;
  let angleAcc = 0;
  const center = size / 2;
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  
  const colors = ['#04C40A', '#2E7D32', '#1C2B1C', '#0A8F0F'];

  const legendItems = data.map((d, i) => ({ label: d.type, count: d.count, color: colors[i % colors.length] }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} role="img" aria-label={`Assessments distribution: ${data.map(d => `${d.type} ${d.count}`).join(', ')}`}>
        <g transform={`translate(${center},${center})`}>
          {data.map((d, i) => {
            const portion = d.count / total;
            const dash = portion * circumference;
            const dashOffset = circumference - dash;
            const rotate = (angleAcc / total) * 360;
            angleAcc += d.count;
            return (
              <circle key={i} r={radius} fill="none" stroke={colors[i % colors.length]} strokeWidth={14}
                strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={dashOffset}
                transform={`rotate(${rotate})`} />
            );
          })}
          <circle className="donut-chart-bg" r={radius - 18} />
          <text className="donut-chart-text" x="0" y="4" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }}>{total}</text>
        </g>
      </svg>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {legendItems.map((l, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, background: l.color, display: 'inline-block', borderRadius: 2 }} aria-hidden></span>
            <span className="donut-legend-text">{l.label} <small className="donut-legend-text">{l.count}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}
