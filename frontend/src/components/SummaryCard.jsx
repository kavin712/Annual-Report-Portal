import React from 'react';

export default function SummaryCard({ title, value, icon, color = 'blue', subtitle, onClick }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="stat-card-top">
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <div className={`stat-icon ${color}`}>
          {icon}
        </div>
      </div>
      <h3>{value}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
