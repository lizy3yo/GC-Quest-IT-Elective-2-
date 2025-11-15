"use client";

export function Sparkbar({ data }: { data: Array<{ day: string; count: number }> }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const allZero = data.every((d) => d.count === 0);
  const containerHeight = 300;
  const cardHeight = 220;
  const fillMaxHeight = 26;
  const minItemPx = 80;
  const maxItemPx = 220;

  return (
    <div className="sparkbar-container" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: containerHeight }} aria-hidden>
      {data.map((d, i) => {
        const v = typeof d.count === 'number' ? d.count : 0;
        const pct = allZero ? 0 : Math.max(0, Math.min(1, v / max));
        const fillHeight = Math.max(2, Math.round(pct * fillMaxHeight));
        const isToday = /today/i.test(d.day);
        return (
          <div key={i} style={{ flex: '1 1 auto', minWidth: `${minItemPx}px`, maxWidth: `${maxItemPx}px`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: cardHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="sparkbar-item" title={`${d.day}: ${v}`} style={{ width: '92%', height: '92%', borderRadius: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
                <div className={`sparkbar-bar ${isToday ? 'today' : ''}`} style={{ width: '92%', height: fillHeight, borderRadius: 6, transition: 'height 240ms ease' }} />
              </div>
            </div>
            <div className="sparkbar-item" style={{ marginTop: 8, fontSize: 12, textAlign: 'center', width: '100%' }}>{isToday ? 'Today' : d.day}</div>
          </div>
        );
      })}
    </div>
  );
}
