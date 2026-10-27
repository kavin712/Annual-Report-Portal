import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate('/login');
  };

  const isFaculty = user?.role === 'faculty';
  const isHOD = user?.role === 'hod';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      )
    },
    // HOD & Admin Approval Center
    ...((isHOD || isAdmin) ? [
      {
        to: '/approvals',
        label: 'Approval Center',
        badge: isHOD ? 'HOD' : 'Admin',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        )
      }
    ] : []),
    ...(isAdmin ? [
      {
        to: '/departments',
        label: 'Departments',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
        )
      }
    ] : []),
    ...(!isFaculty ? [
      {
        to: '/students',
        label: 'Students',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        )
      },
      {
        to: '/faculty-info',
        label: 'Faculty Information',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        )
      }
    ] : []),
    {
      to: '/student-achievements',
      label: 'Student Achievements',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="7"></circle>
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
        </svg>
      )
    },
    {
      to: '/activities',
      label: 'Department Activities',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    },
    {
      to: '/events',
      label: 'Events Management',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="18" rx="2"></rect>
          <line x1="2" y1="8" x2="22" y2="8"></line>
          <line x1="8" y1="2" x2="8" y2="5"></line>
          <line x1="16" y1="2" x2="16" y2="5"></line>
          <polygon points="12 11 13.2 13.5 16 14 14 16 14.5 19 12 17.5 9.5 19 10 16 8 14 10.8 13.5 12 11"></polygon>
        </svg>
      )
    },
    {
      to: '/placements',
      label: 'Placement Records',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      )
    },
    {
      to: '/research-projects',
      label: 'Research & Projects',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          <circle cx="12" cy="10" r="3"></circle>
          <line x1="12" y1="13" x2="12" y2="16"></line>
        </svg>
      )
    },
    {
      to: '/report-builder',
      label: 'Report Builder',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    },
    {
      to: '/generated-reports',
      label: 'Generated Reports',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      )
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon">
          <span>AR</span>
        </div>
        <div className="brand-info">
          <h2>IARP Portal</h2>
          <span>
            {user?.role === 'admin' ? 'Admin Portal' : user?.role === 'hod' ? 'HOD Portal' : 'Faculty Portal'}
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Navigation & Data</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span className="badge badge-amber" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-snippet">
          <div className="user-avatar" style={{
            background: user?.role === 'admin' ? '#4f46e5' : user?.role === 'hod' ? '#0d9488' : '#334155'
          }}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-details">
            <h4>{user?.name || 'User'}</h4>
            <p>
              <strong style={{ color: user?.role === 'admin' ? '#818cf8' : user?.role === 'hod' ? '#2dd4bf' : '#94a3b8' }}>
                {user?.role ? user.role.toUpperCase() : 'USER'}
              </strong>
              {' '}&bull; {user?.department || 'Institution'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.4rem', color: '#94a3b8', background: 'transparent', border: 'none' }}
          title="Sign Out"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </aside>
  );
}
