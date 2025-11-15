"use client";

export function SimpleBarChart({ data }: { data: Array<{ subject: string; count: number }> }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="simple-bar-bg" style={{ width: 8, height: 36, borderRadius: 6 }} aria-hidden></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div className="simple-bar-text" title={d.subject} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.subject}</div>
              <div className="simple-bar-count" style={{ fontWeight: 700 }}>{d.count}</div>
            </div>
            <div className="simple-bar-container" style={{ height: 10, borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
              <div className="simple-bar-fill" style={{ width: `${Math.round((d.count / max) * 100)}%`, height: '100%', borderRadius: 6 }} />
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="simple-bar-text" style={{ fontSize: 13 }}>No items to display</div>}
    </div>
  );
}
