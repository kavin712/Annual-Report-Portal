import React from 'react';

export default function Navbar({
  title,
  academicYear,
  setAcademicYear,
  department,
  setDepartment,
  departments = [],
  academicYears = ['2023-24', '2024-25', '2025-26'],
  user
}) {
  const isAdmin = user?.role === 'admin';
  const isHOD = user?.role === 'hod';

  return (
    <header className="top-navbar">
      <div className="top-navbar-title">
        <h1>{title}</h1>
      </div>

      <div className="top-navbar-controls">
        {/* Academic Year Selector */}
        <div className="selector-group">
          <label htmlFor="nav-ay-select">AY:</label>
          <select
            id="nav-ay-select"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          >
            {academicYears.map((ay) => (
              <option key={ay} value={ay}>
                {ay}
              </option>
            ))}
          </select>
        </div>

        {/* Department Selector: Admin can switch; HOD/Faculty are locked to their own department */}
        <div className="selector-group">
          <label htmlFor="nav-dept-select">Dept:</label>
          {isAdmin ? (
            <select
              id="nav-dept-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.code || d.name} value={d.name}>
                  {d.code ? `${d.code} - ${d.name}` : d.name}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)', padding: '0.2rem 0.4rem' }}>
              {user?.department || department}
            </span>
          )}
        </div>

        {/* User indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${
            isAdmin ? 'badge-purple' : isHOD ? 'badge-teal' : 'badge-blue'
          }`} style={{ fontWeight: 700 }}>
            {isAdmin ? '👑 ADMIN' : isHOD ? '🎓 HOD' : '👨‍🏫 FACULTY'}
          </span>
        </div>
      </div>
    </header>
  );
}
