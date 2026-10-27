import React from 'react';

export default function ReportSection({ title, children }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div className="report-section-title">{title}</div>
      <div style={{ paddingLeft: '0.25rem' }}>{children}</div>
    </div>
  );
}
