import React from 'react';

/**
 * Modern, responsive SVG/Canvas-free bar & doughnut chart components
 * Fully self-contained, theme-aware, zero-dependency.
 */

export function BarChart({ data = [], labelKey = 'label', valueKey = 'value', barColor = '#3b82f6', maxVal, suffix = '', height = 180 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No data available for chart
      </div>
    );
  }

  const computedMax = maxVal || Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);

  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: '1rem', padding: '1rem 0.5rem 0 0.5rem', borderBottom: '1.5px solid var(--border-color)', position: 'relative' }}>
      {data.map((item, idx) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.min(100, Math.round((val / computedMax) * 100));
        const color = item.color || barColor;

        return (
          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              {val}{suffix}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: '42px',
                height: `${Math.max(4, pct)}%`,
                backgroundColor: color,
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.4s ease',
                position: 'relative'
              }}
              title={`${item[labelKey]}: ${val}${suffix}`}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DoughnutChart({ data = [], labelKey = 'category', valueKey = 'count', size = 160 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No data available for chart
      </div>
    );
  }

  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f43f5e'];
  const total = data.reduce((acc, cur) => acc + (Number(cur[valueKey]) || 0), 0);

  // SVG conic donut representation
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const val = Number(d[valueKey]) || 0;
    const fraction = total > 0 ? val / total : 0;
    const startAngle = cumulative * 360;
    cumulative += fraction;
    return {
      label: d[labelKey],
      val,
      pct: (fraction * 100).toFixed(1),
      color: palette[i % palette.length],
      startAngle,
      angle: fraction * 360
    };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', padding: '0.5rem' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)', width: size, height: size, borderRadius: '50%' }}>
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--bg-card-subtle)" strokeWidth="4.5" />
          {(() => {
            let offset = 0;
            return segments.map((seg, i) => {
              const dasharray = `${seg.angle / 3.6} ${100 - seg.angle / 3.6}`;
              const dashoffset = -offset;
              offset += seg.angle / 3.6;
              return (
                <circle
                  key={i}
                  cx="21"
                  cy="21"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth="4.5"
                  strokeDasharray={dasharray}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="round"
                />
              );
            });
          })()}
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{total}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '200px' }}>
        {segments.slice(0, 6).map((s, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }}></span>
            <span style={{ color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            <strong style={{ color: 'var(--text-main)' }}>{s.val}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarList({ data = [], labelKey = 'label', valueKey = 'value', barColor = '#10b981', maxVal, suffix = '' }) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>No data recorded</div>;
  }
  const max = maxVal || Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {data.map((item, idx) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.min(100, Math.round((val / max) * 100));
        return (
          <div key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item[labelKey]}</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{val}{suffix}</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: item.color || barColor,
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
