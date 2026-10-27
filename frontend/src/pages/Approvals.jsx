import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Approvals({ academicYear, department, academicYears = [], departments = [], user }) {
  const isAdmin = user?.role === 'Admin' || user?.role === 'admin';
  const isHOD = user?.role === 'HOD' || user?.role === 'hod';
  const isFaculty = user?.role === 'Faculty' || user?.role === 'faculty';

  const deptToFilter = isHOD ? user?.department : (department || '');
  const yearToFilter = academicYear || '2025-26';

  // 10 KPI Stats
  const [stats, setStats] = useState({
    totalPending: 0,
    pendingAchievements: 0,
    pendingActivities: 0,
    pendingEvents: 0,
    pendingPlacements: 0,
    pendingResearch: 0,
    pendingProjects: 0,
    totalApproved: 0,
    totalChangesRequested: 0
  });

  // Filter Form State
  const [filters, setFilters] = useState({
    search: '',
    recordType: 'all',
    status: 'Pending Approval',
    academicYear: yearToFilter,
    department: deptToFilter,
    dateFrom: '',
    dateTo: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Table Data & Pagination State
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Detail Modal State
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    record: null,
    history: [],
    moduleType: '',
    loading: false
  });

  // Action (Request Changes / Reject) Modal State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    item: null,
    moduleType: '',
    action: '', // 'request_changes' | 'reject'
    comments: ''
  });

  // Load stats and records on mount or when dept/year change
  useEffect(() => {
    loadStats();
    loadRecords(1);
  }, [academicYear, department]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await api.getApprovalStats(filters.academicYear, deptToFilter);
      setStats(data || {
        totalPending: 0,
        pendingAchievements: 0,
        pendingActivities: 0,
        pendingEvents: 0,
        pendingPlacements: 0,
        pendingResearch: 0,
        pendingProjects: 0,
        totalApproved: 0,
        totalChangesRequested: 0
      });
    } catch (err) {
      console.error('Failed to load approval stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadRecords = async (pageNum = page, currentFilters = filters) => {
    setLoading(true);
    try {
      const res = await api.getApprovalRecords({
        academicYear: currentFilters.academicYear,
        department: isHOD ? user?.department : currentFilters.department,
        recordType: currentFilters.recordType,
        status: currentFilters.status,
        search: currentFilters.search,
        dateFrom: currentFilters.dateFrom,
        dateTo: currentFilters.dateTo,
        sortBy: currentFilters.sortBy,
        sortOrder: currentFilters.sortOrder,
        page: pageNum,
        limit
      });

      setRecords(res.records || []);
      setTotalRecords(res.total || 0);
      setPage(res.page || 1);
    } catch (err) {
      console.error('Failed to load approval records:', err);
      setMessage({ type: 'error', text: 'Error loading approval records: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle card click to filter table records
  const handleCardClick = (cardType) => {
    let newFilters = { ...filters };
    if (cardType === 'totalPending') {
      newFilters = { ...newFilters, status: 'Pending Approval', recordType: 'all' };
    } else if (cardType === 'pendingAchievements') {
      newFilters = { ...newFilters, status: 'Pending Approval', recordType: 'achievements' };
    } else if (cardType === 'pendingActivities') {
      newFilters = { ...newFilters, status: 'Pending Approval', recordType: 'activities' };
    } else if (cardType === 'pendingEvents') {
      newFilters = { ...newFilters, status: 'Pending Approval', recordType: 'events' };
    } else if (cardType === 'pendingPlacements') {
      newFilters = { ...newFilters, status: 'Pending Approval', recordType: 'placements' };
    } else if (cardType === 'pendingResearch') {
      newFilters = { ...newFilters, status: 'Pending Approval', recordType: 'research' };
    } else if (cardType === 'pendingProjects') {
      newFilters = { ...newFilters, status: 'Pending Approval', recordType: 'projects' };
    } else if (cardType === 'totalApproved') {
      newFilters = { ...newFilters, status: 'Approved', recordType: 'all' };
    } else if (cardType === 'totalChangesRequested') {
      newFilters = { ...newFilters, status: 'Changes Requested', recordType: 'all' };
    }

    setFilters(newFilters);
    loadRecords(1, newFilters);
  };

  const handleApplyFilters = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    loadRecords(1, filters);
  };

  const handleClearFilters = () => {
    const defaultD = isHOD ? user?.department : '';
    const reset = {
      search: '',
      recordType: 'all',
      status: 'all',
      academicYear: academicYear || '2025-26',
      department: defaultD,
      dateFrom: '',
      dateTo: '',
      sortBy: 'date',
      sortOrder: 'desc'
    };
    setFilters(reset);
    loadRecords(1, reset);
  };

  // Open Detailed View Modal
  const handleViewRecord = async (item) => {
    setDetailModal({
      isOpen: true,
      record: null,
      history: [],
      moduleType: item.moduleType,
      loading: true
    });

    try {
      const data = await api.getApprovalRecordDetail(item.moduleType, item.id);
      setDetailModal({
        isOpen: true,
        record: data.record,
        history: data.history || [],
        moduleType: item.moduleType,
        loading: false
      });
    } catch (err) {
      alert('Error fetching record details: ' + err.message);
      setDetailModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Approve action
  const handleApprove = async (item) => {
    if (item.submitted_by === user?.id) {
      alert('Security Policy: You cannot approve your own submission.');
      return;
    }

    const titleOrName = item.title || item.student_name || `Record #${item.id}`;
    if (!window.confirm(`Are you sure you want to approve "${titleOrName}"?`)) {
      return;
    }

    try {
      const res = await api.actOnApproval(item.moduleType, item.id, 'approve', '');
      setMessage({ type: 'success', text: res.message || 'Record approved successfully!' });
      if (detailModal.isOpen) {
        setDetailModal({ isOpen: false, record: null, history: [], moduleType: '', loading: false });
      }
      loadStats();
      loadRecords(page);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to approve submission.' });
    }
  };

  // Open Request Changes / Reject Modal
  const openActionModal = (item, action) => {
    if (item.submitted_by === user?.id) {
      alert('Security Policy: You cannot review your own submission.');
      return;
    }
    setActionModal({
      isOpen: true,
      item,
      moduleType: item.moduleType,
      action,
      comments: ''
    });
  };

  // Submit Request Changes or Rejection
  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!actionModal.comments.trim()) {
      alert(actionModal.action === 'reject' ? 'Rejection reason is required.' : 'Feedback comments are required.');
      return;
    }

    try {
      const res = await api.actOnApproval(
        actionModal.moduleType,
        actionModal.item.id,
        actionModal.action,
        actionModal.comments.trim()
      );

      setMessage({
        type: actionModal.action === 'reject' ? 'error' : 'info',
        text: res.message || (actionModal.action === 'reject' ? 'Record rejected.' : 'Changes requested from faculty.')
      });

      setActionModal({ isOpen: false, item: null, moduleType: '', action: '', comments: '' });
      if (detailModal.isOpen) {
        setDetailModal({ isOpen: false, record: null, history: [], moduleType: '', loading: false });
      }
      loadStats();
      loadRecords(page);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const getModuleBadgeClass = (type) => {
    switch (type) {
      case 'achievements': return 'badge-purple';
      case 'activities': return 'badge-blue';
      case 'events': return 'badge-teal';
      case 'placements': return 'badge-green';
      case 'research': return 'badge-amber';
      case 'projects': return 'badge-indigo';
      default: return 'badge-slate';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Approved': return 'badge-status-approved';
      case 'Pending Approval': return 'badge-status-pending';
      case 'Changes Requested': return 'badge-status-changes';
      case 'Rejected': return 'badge-red';
      default: return 'badge-slate';
    }
  };

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return (
    <div>
      {/* Header Bar */}
      <div className="content-card" style={{ padding: '1.25rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Centralized HOD Approval Center
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              Review and act on pending submissions across Student Achievements, Department Activities, Events, and Placement Management for{' '}
              <strong style={{ color: 'var(--primary)' }}>{isHOD ? user?.department : (deptToFilter || 'All Departments')}</strong> ({filters.academicYear || yearToFilter}).
            </p>
          </div>
          <div>
            <span className="badge badge-amber" style={{ fontSize: '0.825rem', padding: '0.45rem 0.9rem', fontWeight: 600 }}>
              Pending Action: {stats.totalPending}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
          <span>{message.text}</span>
          <button
            onClick={() => setMessage({ type: '', text: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', float: 'right' }}
          >
            ×
          </button>
        </div>
      )}

      {/* PART 1.2: Database-Driven Summary KPI Cards (Click to Filter) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Pending */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('totalPending')}
          style={{
            borderLeft: '4px solid #f59e0b',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            background: filters.status === 'Pending Approval' && filters.recordType === 'all' ? '#fffbeb' : '#ffffff'
          }}
          title="Click to view all pending submissions"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Pending</span>
            <span style={{ fontSize: '1.1rem' }}>⏳</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#d97706' }}>{stats.totalPending}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>All 4 modules</p>
        </div>

        {/* Pending Achievements */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('pendingAchievements')}
          style={{
            borderLeft: '4px solid #8b5cf6',
            cursor: 'pointer',
            background: filters.status === 'Pending Approval' && filters.recordType === 'achievements' ? '#f5f3ff' : '#ffffff'
          }}
          title="Click to filter pending Student Achievements"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Achievements</span>
            <span style={{ fontSize: '1.1rem' }}>🏆</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#7c3aed' }}>{stats.pendingAchievements}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending verification</p>
        </div>

        {/* Pending Activities */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('pendingActivities')}
          style={{
            borderLeft: '4px solid #2563eb',
            cursor: 'pointer',
            background: filters.status === 'Pending Approval' && filters.recordType === 'activities' ? '#eff6ff' : '#ffffff'
          }}
          title="Click to filter pending Department Activities"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Activities</span>
            <span style={{ fontSize: '1.1rem' }}>📚</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#2563eb' }}>{stats.pendingActivities}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending verification</p>
        </div>

        {/* Pending Events */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('pendingEvents')}
          style={{
            borderLeft: '4px solid #06b6d4',
            cursor: 'pointer',
            background: filters.status === 'Pending Approval' && filters.recordType === 'events' ? '#ecfeff' : '#ffffff'
          }}
          title="Click to filter pending Events"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Events</span>
            <span style={{ fontSize: '1.1rem' }}>🎪</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#0891b2' }}>{stats.pendingEvents}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending verification</p>
        </div>

        {/* Pending Placements */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('pendingPlacements')}
          style={{
            borderLeft: '4px solid #10b981',
            cursor: 'pointer',
            background: filters.status === 'Pending Approval' && filters.recordType === 'placements' ? '#ecfdf5' : '#ffffff'
          }}
          title="Click to filter pending Placement Records"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Placements</span>
            <span style={{ fontSize: '1.1rem' }}>💼</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#059669' }}>{stats.pendingPlacements}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending verification</p>
        </div>

        {/* Pending Research */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('pendingResearch')}
          style={{
            borderLeft: '4px solid #f59e0b',
            cursor: 'pointer',
            background: filters.status === 'Pending Approval' && filters.recordType === 'research' ? '#fffbeb' : '#ffffff'
          }}
          title="Click to filter pending Research & Publications"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Research</span>
            <span style={{ fontSize: '1.1rem' }}>🔬</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#d97706' }}>{stats.pendingResearch || 0}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Publications / Patents</p>
        </div>

        {/* Pending Projects */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('pendingProjects')}
          style={{
            borderLeft: '4px solid #6366f1',
            cursor: 'pointer',
            background: filters.status === 'Pending Approval' && filters.recordType === 'projects' ? '#eef2ff' : '#ffffff'
          }}
          title="Click to filter pending Student & Faculty Projects"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Projects</span>
            <span style={{ fontSize: '1.1rem' }}>🚀</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#4f46e5' }}>{stats.pendingProjects || 0}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Academic & Industry</p>
        </div>

        {/* Approved Records */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('totalApproved')}
          style={{
            borderLeft: '4px solid #059669',
            cursor: 'pointer',
            background: filters.status === 'Approved' ? '#ecfdf5' : '#ffffff'
          }}
          title="Click to view all Approved records"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Approved</span>
            <span style={{ fontSize: '1.1rem' }}>✅</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#047857' }}>{stats.totalApproved}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>In official reports</p>
        </div>

        {/* Records Requiring Corrections */}
        <div
          className="stat-card"
          onClick={() => handleCardClick('totalChangesRequested')}
          style={{
            borderLeft: '4px solid #ef4444',
            cursor: 'pointer',
            background: filters.status === 'Changes Requested' ? '#fef2f2' : '#ffffff'
          }}
          title="Click to view Records Requiring Corrections"
        >
          <div className="stat-card-top">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Corrections</span>
            <span style={{ fontSize: '1.1rem' }}>✍️</span>
          </div>
          <h3 style={{ margin: '0.3rem 0', color: '#dc2626' }}>{stats.totalChangesRequested}</h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>With faculty feedback</p>
        </div>
      </div>

      {/* PART 2: Approval Center Filter Controls (DIRECTLY ABOVE UNIFIED TABLE) */}
      <div className="content-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', background: '#ffffff', border: '1px solid var(--border-color, #e2e8f0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>⚡</span>
            <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Approval Queue Filters & Search
            </h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Filter by module, status, academic year, and date
          </span>
        </div>

        <form onSubmit={handleApplyFilters}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            alignItems: 'flex-end'
          }}>
            {/* Search */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Search (Title, Student, ID)
              </label>
              <input
                type="text"
                placeholder="Search title, student name, ID..."
                className="form-control"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                style={{ width: '100%', height: '38px' }}
              />
            </div>

            {/* Record Type Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Record Type
              </label>
              <select
                className="form-control"
                value={filters.recordType}
                onChange={(e) => setFilters({ ...filters, recordType: e.target.value })}
                style={{ width: '100%', height: '38px' }}
              >
                <option value="all">All Record Types</option>
                <option value="achievements">Student Achievements</option>
                <option value="activities">Department Activities</option>
                <option value="events">Department Events</option>
                <option value="placements">Placement Management</option>
                <option value="research">Research & Publications</option>
                <option value="projects">Project Management</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Approval Status
              </label>
              <select
                className="form-control"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={{ width: '100%', height: '38px' }}
              >
                <option value="all">All Statuses</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Changes Requested">Changes Requested</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Academic Year Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Academic Year
              </label>
              <select
                className="form-control"
                value={filters.academicYear}
                onChange={(e) => setFilters({ ...filters, academicYear: e.target.value })}
                style={{ width: '100%', height: '38px' }}
              >
                <option value="All">All Academic Years</option>
                {academicYears.map((ay) => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
            </div>

            {/* Submission Date: From */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Date From
              </label>
              <input
                type="date"
                className="form-control"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                style={{ width: '100%', height: '38px' }}
              />
            </div>

            {/* Submission Date: To */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Date To
              </label>
              <input
                type="date"
                className="form-control"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                style={{ width: '100%', height: '38px' }}
              />
            </div>

            {/* Action Buttons: Apply & Clear */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '38px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 600 }}
              >
                🔍 Apply Filters
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClearFilters}
                style={{ height: '38px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                title="Reset all filters to defaults"
              >
                ↺ Clear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* PART 1.3: Unified Approval Table */}
      <div className="content-card">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span>Unified Submissions Queue ({totalRecords})</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
              Showing {filters.status === 'all' ? 'All Records' : filters.status} &bull; {filters.recordType === 'all' ? 'All Modules' : filters.recordType}
            </span>
          </div>
          {totalRecords > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {Math.min((page - 1) * limit + 1, totalRecords)} to {Math.min(page * limit, totalRecords)} of {totalRecords} records
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading unified approval records...
          </div>
        ) : records.length === 0 ? (
          <div style={{
            padding: '3.5rem',
            textAlign: 'center',
            background: '#fafafa',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed #cbd5e1'
          }}>
            <p style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
              No submissions found matching current criteria
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
              Faculty submissions requiring verification or changes will automatically appear here.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearFilters}
              style={{ marginTop: '1rem' }}
            >
              Clear Current Filters
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Record ID</th>
                  <th style={{ width: '160px' }}>Record Type</th>
                  <th>Title / Student Name</th>
                  <th>Department</th>
                  <th>Submitted By</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '90px' }}>Year</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '190px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={`${item.moduleType}-${item.id}`}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '0.8rem' }}>
                        {item.recordCode || `#${item.moduleType.substring(0, 3).toUpperCase()}-${item.id}`}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getModuleBadgeClass(item.moduleType)}`}>
                        {item.moduleLabel}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '0.88rem' }}>
                        {item.title || item.student_name || 'Submission'}
                      </strong>
                      {item.student_reg_no && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Reg: {item.student_reg_no}
                        </span>
                      )}
                      {item.company_name && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: item.student_reg_no ? ' &bull; ' : '' }}>
                          Company: {item.company_name}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem' }}>{item.department}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-main)' }}>
                        {item.submitted_by_name || 'Faculty Member'}
                      </div>
                      {item.submitted_by === user?.id && (
                        <span style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>
                          (Your submission)
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {(item.submitted_at || item.record_date || '').split('T')[0] || '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem' }}>{item.academic_year}</span>
                    </td>
                    <td>
                      <div>
                        <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                          {item.status}
                        </span>
                        {item.review_comments && (
                          <div style={{ fontSize: '0.7rem', color: '#991b1b', marginTop: '2px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.review_comments}>
                            &ldquo;{item.review_comments}&rdquo;
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {/* View Details */}
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleViewRecord(item)}
                          title="View complete record details and history"
                        >
                          👁 View
                        </button>

                        {/* Actions enabled if Pending Approval */}
                        {item.status === 'Pending Approval' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#059669', borderColor: '#059669' }}
                              onClick={() => handleApprove(item)}
                              disabled={item.submitted_by === user?.id}
                              title={item.submitted_by === user?.id ? "Cannot approve your own submission" : "Approve submission"}
                            >
                              ✓ Approve
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={() => openActionModal(item, 'request_changes')}
                              disabled={item.submitted_by === user?.id}
                              title="Request corrections from faculty"
                            >
                              ✎ Changes
                            </button>

                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => openActionModal(item, 'reject')}
                              disabled={item.submitted_by === user?.id}
                              title="Permanently reject submission"
                            >
                              ✕ Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalRecords > limit && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 0 0.5rem',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            marginTop: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalRecords} total records)
            </span>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadRecords(page - 1)}
                disabled={page <= 1}
                style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                &larr; Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => loadRecords(p)}
                  style={{ minWidth: '32px', padding: '0.25rem 0.5rem' }}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadRecords(page + 1)}
                disabled={page >= totalPages}
                style={{ opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PART 3.6: Tailored View Details Modal */}
      {detailModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  Submission Details & Review
                </h3>
                {detailModal.record && (
                  <span className={`badge ${getModuleBadgeClass(detailModal.moduleType)}`} style={{ marginTop: '0.35rem' }}>
                    {detailModal.moduleType.toUpperCase()} &bull; #{detailModal.record.id}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ isOpen: false, record: null, history: [], moduleType: '', loading: false })}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {detailModal.loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading submission details...
              </div>
            ) : detailModal.record ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {/* Specific Module Details */}
                {detailModal.moduleType === 'achievements' && (
                  <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>🏆 Student Achievement Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Student Name:</strong> {detailModal.record.student_name}</div>
                      <div><strong>Register No:</strong> {detailModal.record.student_id || '-'}</div>
                      <div><strong>Achievement Title:</strong> {detailModal.record.title}</div>
                      <div><strong>Category:</strong> {detailModal.record.achievement_type || '-'}</div>
                      <div><strong>Level:</strong> {detailModal.record.achievement_level || '-'}</div>
                      <div><strong>Award / Position:</strong> {detailModal.record.award_position || '-'}</div>
                      <div><strong>Date:</strong> {detailModal.record.date || '-'}</div>
                      <div><strong>Academic Year:</strong> {detailModal.record.academic_year}</div>
                    </div>
                    {detailModal.record.description && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Description:</strong> {detailModal.record.description}
                      </div>
                    )}
                    {detailModal.record.certificate_url && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <a href={detailModal.record.certificate_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                          📄 View Certificate
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {detailModal.moduleType === 'activities' && (
                  <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>📚 Department Activity Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Activity Title:</strong> {detailModal.record.activity_name}</div>
                      <div><strong>Category / Type:</strong> {detailModal.record.activity_type}</div>
                      <div><strong>Coordinator:</strong> {detailModal.record.faculty_coordinator || '-'}</div>
                      <div><strong>Venue:</strong> {detailModal.record.venue || '-'}</div>
                      <div><strong>Date:</strong> {detailModal.record.date || '-'}</div>
                      <div><strong>Department:</strong> {detailModal.record.department}</div>
                      <div><strong>Academic Year:</strong> {detailModal.record.academic_year}</div>
                      <div><strong>Participants Count:</strong> {detailModal.record.participants_count || 0}</div>
                    </div>
                    {detailModal.record.description && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Description:</strong> {detailModal.record.description}
                      </div>
                    )}
                    {detailModal.record.participating_students?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Participating Students ({detailModal.record.participating_students.length}):</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {detailModal.record.participating_students.map(s => (
                            <span key={s.id} className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                              {s.name} ({s.register_no})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailModal.moduleType === 'events' && (
                  <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>🎪 Department Event Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Event Title:</strong> {detailModal.record.event_name}</div>
                      <div><strong>Type:</strong> {detailModal.record.event_type}</div>
                      <div><strong>Date:</strong> {detailModal.record.event_date}</div>
                      <div><strong>Venue:</strong> {detailModal.record.venue || '-'}</div>
                      <div><strong>Organizer:</strong> {detailModal.record.organizer || '-'}</div>
                      <div><strong>Coordinator:</strong> {detailModal.record.coordinator || '-'}</div>
                      <div><strong>Department:</strong> {detailModal.record.department}</div>
                      <div><strong>Academic Year:</strong> {detailModal.record.academic_year}</div>
                    </div>
                    {detailModal.record.description && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Description:</strong> {detailModal.record.description}
                      </div>
                    )}
                    {detailModal.record.participating_students?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Students ({detailModal.record.participating_students.length}):</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {detailModal.record.participating_students.map(s => (
                            <span key={s.id} className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                              {s.name} ({s.register_no})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailModal.moduleType === 'placements' && (
                  <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>💼 Placement Record Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Student Name:</strong> {detailModal.record.student_name}</div>
                      <div><strong>Register No:</strong> {detailModal.record.register_no}</div>
                      <div><strong>Company Name:</strong> {detailModal.record.company_name}</div>
                      <div><strong>Job Role:</strong> {detailModal.record.job_role || '-'}</div>
                      <div><strong>Salary Package:</strong> ₹{detailModal.record.package || 0} LPA</div>
                      <div><strong>Placement Status:</strong> {detailModal.record.placement_status}</div>
                      <div><strong>Offer Type:</strong> {detailModal.record.offer_type || 'On-Campus'}</div>
                      <div><strong>Department:</strong> {detailModal.record.department}</div>
                    </div>
                    {detailModal.record.offer_details && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Offer Details:</strong> {detailModal.record.offer_details}
                      </div>
                    )}
                  </div>
                )}

                {detailModal.moduleType === 'research' && (
                  <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>🔬 Research & Publication Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Title:</strong> {detailModal.record.title}</div>
                      <div><strong>Publication Type:</strong> {detailModal.record.publication_type}</div>
                      <div><strong>Category:</strong> {detailModal.record.research_category || '-'}</div>
                      <div><strong>Research Area:</strong> {detailModal.record.research_area || '-'}</div>
                      <div><strong>Journal / Conference:</strong> {detailModal.record.journal_conference_name || '-'}</div>
                      <div><strong>Publisher:</strong> {detailModal.record.publisher || '-'}</div>
                      <div><strong>Publication Date:</strong> {detailModal.record.publication_date}</div>
                      <div><strong>Academic Year:</strong> {detailModal.record.academic_year}</div>
                      <div><strong>DOI / URL:</strong> {detailModal.record.doi ? <a href={detailModal.record.doi.startsWith('http') ? detailModal.record.doi : `https://doi.org/${detailModal.record.doi}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{detailModal.record.doi}</a> : '-'}</div>
                      <div><strong>Funding:</strong> {detailModal.record.funding_amount > 0 ? `₹${detailModal.record.funding_amount} L (${detailModal.record.funding_agency || 'Funded'})` : 'Non-Funded'}</div>
                      <div style={{ gridColumn: 'span 2' }}><strong>Authors:</strong> {detailModal.record.author_names || '-'}</div>
                    </div>
                    {detailModal.record.description && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Abstract / Description:</strong> {detailModal.record.description}
                      </div>
                    )}
                    {detailModal.record.participating_students?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Linked Students ({detailModal.record.participating_students.length}):</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {detailModal.record.participating_students.map(s => (
                            <span key={s.id} className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                              {s.name} ({s.register_no})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailModal.record.participating_faculty?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Linked Faculty ({detailModal.record.participating_faculty.length}):</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {detailModal.record.participating_faculty.map(f => (
                            <span key={f.id} className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                              {f.faculty_name} ({f.designation || 'Faculty'})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailModal.record.document_path && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <a href={detailModal.record.document_path} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                          📄 View Attached Paper / Document
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {detailModal.moduleType === 'projects' && (
                  <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>🚀 Project Management Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Project Title:</strong> {detailModal.record.project_title}</div>
                      <div><strong>Category:</strong> {detailModal.record.project_category}</div>
                      <div><strong>Project Type:</strong> {detailModal.record.project_type}</div>
                      <div><strong>Project Status:</strong> <span className="badge badge-teal">{detailModal.record.project_status || 'Ongoing'}</span></div>
                      <div><strong>Coordinator / Guide:</strong> {detailModal.record.coordinator || '-'}</div>
                      <div><strong>Academic Year:</strong> {detailModal.record.academic_year}</div>
                      <div><strong>Duration:</strong> {detailModal.record.start_date || '-'} to {detailModal.record.completion_date || 'Present'}</div>
                      <div><strong>Funding:</strong> {detailModal.record.funding_amount > 0 ? `₹${detailModal.record.funding_amount} L (${detailModal.record.funding_agency || 'Sponsored'})` : 'Non-Funded'}</div>
                      <div><strong>Industry Partner:</strong> {detailModal.record.industry_partner || '-'}</div>
                      <div><strong>Competition / Hackathon:</strong> {detailModal.record.competition_name || '-'}</div>
                      <div style={{ gridColumn: 'span 2' }}><strong>Awards / Recognition:</strong> {detailModal.record.awards_recognition || '-'}</div>
                      {detailModal.record.project_url && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <strong>Project Link / Repo:</strong>{' '}
                          <a href={detailModal.record.project_url.startsWith('http') ? detailModal.record.project_url : `https://${detailModal.record.project_url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                            {detailModal.record.project_url}
                          </a>
                        </div>
                      )}
                    </div>
                    {detailModal.record.description && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Description:</strong> {detailModal.record.description}
                      </div>
                    )}
                    {detailModal.record.participating_students?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Student Team Members ({detailModal.record.participating_students.length}):</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {detailModal.record.participating_students.map(s => (
                            <span key={s.id} className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                              {s.name} ({s.register_no})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailModal.record.participating_faculty?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Faculty Guides ({detailModal.record.participating_faculty.length}):</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {detailModal.record.participating_faculty.map(f => (
                            <span key={f.id} className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                              {f.faculty_name} ({f.designation || 'Faculty'})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailModal.record.document_path && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <a href={detailModal.record.document_path} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                          📄 View Supporting Document
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Submitter & Current Review Status */}
                <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div><strong>Submitted By:</strong> {detailModal.record.submitted_by_name || 'Faculty Member'}</div>
                    <div><strong>Current Status:</strong> <span className={`badge ${getStatusBadgeClass(detailModal.record.status)}`}>{detailModal.record.status}</span></div>
                  </div>
                  {detailModal.record.review_comments && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#991b1b', fontSize: '0.8rem' }}>
                      <strong>Latest Feedback:</strong> {detailModal.record.review_comments}
                    </div>
                  )}
                </div>

                {/* PART 4.11: Review & Audit History Timeline */}
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    📜 Approval & Review Audit History ({detailModal.history.length})
                  </h4>

                  {detailModal.history.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      No prior review actions recorded for this submission.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {detailModal.history.map((h) => (
                        <div
                          key={h.id}
                          style={{
                            borderLeft: `3px solid ${h.new_status === 'Approved' ? '#059669' : h.new_status === 'Rejected' ? '#dc2626' : '#f59e0b'}`,
                            paddingLeft: '0.75rem',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {h.previous_status} &rarr; <span className={`badge ${getStatusBadgeClass(h.new_status)}`}>{h.new_status}</span>
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Reviewer: <strong>{h.reviewer_name || `User #${h.reviewer_id}`}</strong>
                          </div>
                          {h.comment && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              &ldquo;{h.comment}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Controls inside Details Modal */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {detailModal.record.status === 'Pending Approval' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ background: '#059669', borderColor: '#059669' }}
                        onClick={() => handleApprove({ ...detailModal.record, moduleType: detailModal.moduleType })}
                        disabled={detailModal.record.submitted_by === user?.id}
                      >
                        ✓ Approve Submission
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        onClick={() => openActionModal({ ...detailModal.record, moduleType: detailModal.moduleType }, 'request_changes')}
                        disabled={detailModal.record.submitted_by === user?.id}
                      >
                        ✎ Request Changes
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => openActionModal({ ...detailModal.record, moduleType: detailModal.moduleType }, 'reject')}
                        disabled={detailModal.record.submitted_by === user?.id}
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDetailModal({ isOpen: false, record: null, history: [], moduleType: '', loading: false })}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* PART 3.8 & 3.9: Request Changes / Rejection Modal */}
      {actionModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>
                {actionModal.action === 'reject' ? 'Reject Submission' : 'Request Changes from Faculty'}
              </h3>
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, item: null, moduleType: '', action: '', comments: '' })}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAction}>
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Target: <strong>{actionModal.item?.title || actionModal.item?.student_name}</strong>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="reviewComments">
                  {actionModal.action === 'reject' ? 'Rejection Reason' : 'Correction Feedback & Instructions'}{' '}
                  <span className="required">*</span>
                </label>
                <textarea
                  id="reviewComments"
                  className="form-textarea"
                  rows={4}
                  placeholder={
                    actionModal.action === 'reject'
                      ? 'Explain clearly why this submission is being rejected permanently...'
                      : 'Detail the exact corrections or supporting certificates the faculty member needs to upload...'
                  }
                  value={actionModal.comments}
                  onChange={(e) => setActionModal({ ...actionModal, comments: e.target.value })}
                  required
                />
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActionModal({ isOpen: false, item: null, moduleType: '', action: '', comments: '' })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${actionModal.action === 'reject' ? 'btn-danger' : 'btn-primary'}`}
                >
                  {actionModal.action === 'reject' ? 'Confirm Rejection' : 'Send Feedback & Request Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
