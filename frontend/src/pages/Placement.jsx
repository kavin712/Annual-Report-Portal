import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import FormInput from '../components/FormInput';
import DataTable from '../components/DataTable';
import StudentSearchDropdown from '../components/StudentSearchDropdown';

const PLACEMENT_STATUSES = [
  'Placed',
  'Offer Received',
  'Internship',
  'Not Placed',
  'Withdrawn'
];

const OFFER_TYPES = [
  'On-Campus',
  'Off-Campus',
  'PPO',
  'Pool Campus',
  'Direct Application'
];

export default function Placement({
  academicYear,
  department,
  departments = [],
  academicYears = [],
  user
}) {
  const isAdmin = user?.role === 'Admin' || user?.role === 'admin';
  const isHOD = user?.role === 'HOD' || user?.role === 'hod';
  const isFaculty = user?.role === 'Faculty' || user?.role === 'faculty';

  const defaultDept = isHOD || isFaculty ? user?.department : (department || '');
  const defaultYear = academicYear || '2025-26';

  // Filters State
  const [filterDept, setFilterDept] = useState(defaultDept);
  const [filterYear, setFilterYear] = useState(defaultYear);
  const [filterPlacementStatus, setFilterPlacementStatus] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Records and Stats state
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    eligible_students: 0,
    students_placed: 0,
    number_of_offers: 0,
    number_of_companies: 0,
    highest_package: 0,
    average_package: 0,
    placement_percentage: 0
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [reviewActionModal, setReviewActionModal] = useState({
    isOpen: false,
    item: null,
    comments: ''
  });

  // Form state
  const initialFormState = {
    student_id: null,
    student_name: '',
    register_no: '',
    department: defaultDept || (departments[0]?.name || ''),
    academic_year: defaultYear,
    company_name: '',
    job_role: '',
    package: '',
    placement_status: 'Placed',
    offer_type: 'On-Campus',
    location: '',
    placement_date: new Date().toISOString().split('T')[0],
    offer_details: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // Sync with global header props if they change
  useEffect(() => {
    if (academicYear) setFilterYear(academicYear);
  }, [academicYear]);

  useEffect(() => {
    if (isAdmin && department) {
      setFilterDept(department);
    } else if ((isHOD || isFaculty) && user?.department) {
      setFilterDept(user.department);
    }
  }, [department, isAdmin, isHOD, isFaculty, user]);

  // Initial load
  useEffect(() => {
    loadPlacementData();
  }, [academicYear, department]);

  const loadPlacementData = async (customFilters = null) => {
    setLoading(true);
    const yr = customFilters ? customFilters.year : filterYear;
    const dept = customFilters ? customFilters.dept : filterDept;
    const status = customFilters ? customFilters.status : filterApprovalStatus;
    const pStatus = customFilters ? customFilters.pStatus : filterPlacementStatus;
    const batch = customFilters ? customFilters.batch : filterBatch;
    const company = customFilters ? customFilters.company : filterCompany;
    const search = customFilters ? customFilters.search : searchTerm;

    try {
      const [recordsData, statsData] = await Promise.all([
        api.getPlacementRecords({
          academicYear: yr,
          department: dept,
          status,
          placementStatus: pStatus,
          batch,
          company,
          search
        }),
        api.getPlacementStats({
          academicYear: yr,
          department: dept,
          status,
          placementStatus: pStatus,
          batch,
          company,
          search
        })
      ]);

      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setStats(statsData || {
        eligible_students: 0,
        students_placed: 0,
        number_of_offers: 0,
        number_of_companies: 0,
        highest_package: 0,
        average_package: 0,
        placement_percentage: 0
      });
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load placement data:', err);
      setMessage({ type: 'error', text: 'Error loading placement data: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    loadPlacementData();
  };

  const handleClearFilters = () => {
    const defaultD = isHOD || isFaculty ? user?.department : '';
    const defaultY = academicYear || '2025-26';

    setFilterDept(defaultD);
    setFilterYear(defaultY);
    setFilterPlacementStatus('');
    setFilterApprovalStatus('');
    setFilterBatch('');
    setFilterCompany('');
    setSearchTerm('');

    loadPlacementData({
      dept: defaultD,
      year: defaultY,
      status: '',
      pStatus: '',
      batch: '',
      company: '',
      search: ''
    });
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      ...initialFormState,
      department: filterDept || user?.department || (departments[0]?.name || ''),
      academic_year: filterYear || '2025-26'
    });
    setIsModalOpen(true);
    setMessage({ type: '', text: '' });
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      student_id: item.student_id || null,
      student_name: item.student_name || '',
      register_no: item.register_no || '',
      department: item.department || '',
      academic_year: item.academic_year || filterYear,
      company_name: item.company_name || '',
      job_role: item.job_role || '',
      package: item.package !== undefined && item.package !== null ? item.package : '',
      placement_status: item.placement_status || 'Placed',
      offer_type: item.offer_type || 'On-Campus',
      location: item.location || '',
      placement_date: item.placement_date || '',
      offer_details: item.offer_details || ''
    });
    setIsModalOpen(true);
    setMessage({ type: '', text: '' });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveRecord = async (e, shouldSubmit = false) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!formData.student_id) {
      alert('Please search and select a registered student from the dropdown.');
      return;
    }
    if (!formData.company_name?.trim()) {
      alert('Company Name is required.');
      return;
    }
    const pkgNum = parseFloat(formData.package);
    if (isNaN(pkgNum) || pkgNum < 0) {
      alert('Please enter a valid positive numeric salary package (LPA). Use 0 if not applicable.');
      return;
    }

    const payload = {
      ...formData,
      package: pkgNum,
      submit_for_approval: shouldSubmit
    };

    try {
      if (editingId) {
        const res = await api.updatePlacementRecord(editingId, payload);
        setMessage({ type: 'success', text: res.message || 'Placement record updated successfully!' });
      } else {
        const res = await api.addPlacementRecord(payload);
        setMessage({ type: 'success', text: res.message || 'Placement record created successfully!' });
      }
      closeModal();
      loadPlacementData();
    } catch (err) {
      alert('Error saving record: ' + err.message);
    }
  };

  const handleDeleteRecord = async (item) => {
    if (!window.confirm(`Are you sure you want to delete the placement record for "${item.student_name}" at "${item.company_name}"?\n\nNote: The student account will NOT be deleted.`)) {
      return;
    }

    try {
      await api.deletePlacementRecord(item.id);
      setMessage({ type: 'success', text: 'Placement record deleted successfully.' });
      loadPlacementData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete placement record.' });
    }
  };

  const handleSubmitRecord = async (item) => {
    if (!window.confirm(`Submit placement record for "${item.student_name}" at "${item.company_name}" for approval?`)) {
      return;
    }

    try {
      await api.submitPlacementRecord(item.id);
      setMessage({ type: 'success', text: 'Placement record submitted for HOD review!' });
      loadPlacementData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit.' });
    }
  };

  const handleApproveRecord = async (item) => {
    if (item.submitted_by === user?.id) {
      alert('Security Policy: You cannot approve your own submission.');
      return;
    }

    if (!window.confirm(`Approve placement record for "${item.student_name}" at "${item.company_name}"?`)) {
      return;
    }

    try {
      await api.approvePlacementRecord(item.id);
      setMessage({ type: 'success', text: `Placement record for ${item.student_name} approved successfully!` });
      if (viewingRecord?.id === item.id) setViewingRecord(null);
      loadPlacementData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to approve.' });
    }
  };

  const openRequestChangesModal = (item) => {
    setReviewActionModal({
      isOpen: true,
      item,
      comments: ''
    });
  };

  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!reviewActionModal.comments.trim()) {
      alert('Please enter specific feedback comments explaining the requested changes.');
      return;
    }

    try {
      await api.requestPlacementChanges(reviewActionModal.item.id, reviewActionModal.comments.trim());
      setMessage({ type: 'info', text: 'Revision request sent back to faculty.' });
      setReviewActionModal({ isOpen: false, item: null, comments: '' });
      if (viewingRecord?.id === reviewActionModal.item.id) setViewingRecord(null);
      loadPlacementData();
    } catch (err) {
      alert('Error: ' + (err.message || 'Failed to send feedback.'));
    }
  };

  const canEditRecord = (item) => {
    if (isAdmin) return true;
    if (isHOD && item.department === user?.department) return true;
    if (isFaculty && item.submitted_by === user?.id && item.status !== 'Approved') return true;
    return false;
  };

  const canDeleteRecord = (item) => {
    if (isAdmin) return true;
    if (isHOD && item.department === user?.department) return true;
    if (isFaculty && item.submitted_by === user?.id && item.status !== 'Approved') return true;
    return false;
  };

  const canReviewRecord = (item) => {
    if (item.status !== 'Pending Approval') return false;
    if (item.submitted_by === user?.id) return false;
    if (isAdmin) return true;
    if (isHOD && item.department === user?.department) return true;
    return false;
  };

  // Pagination calculation
  const totalPages = Math.ceil(records.length / pageSize) || 1;
  const paginatedRecords = records.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns = [
    {
      header: 'Student Name',
      accessor: 'student_name',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block' }}>{val}</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.register_no} {row.batch ? `• Batch ${row.batch}` : ''}
          </span>
          {row.submitted_by_name && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Submitted by: {row.submitted_by_name}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Department',
      accessor: 'department',
      render: (val) => <span style={{ fontSize: '0.85rem' }}>{val}</span>
    },
    {
      header: 'Company & Role',
      accessor: 'company_name',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--primary)', display: 'block' }}>{val}</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {row.job_role || 'Job Role Not Specified'}
          </span>
          {row.location && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              📍 {row.location}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Package',
      accessor: 'package',
      render: (val) => (
        <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>
          {val > 0 ? `₹${val} LPA` : 'Unpaid / Stipend'}
        </span>
      )
    },
    {
      header: 'Offer Status',
      accessor: 'placement_status',
      render: (val, row) => (
        <div>
          <span className={`badge ${val === 'Placed' || val === 'Offer Received' ? 'badge-green' : 'badge-amber'}`}>
            {val}
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {row.offer_type || 'On-Campus'}
          </div>
        </div>
      )
    },
    {
      header: 'Approval',
      accessor: 'status',
      render: (val, row) => {
        let badgeClass = 'badge-status-pending';
        if (val === 'Approved') badgeClass = 'badge-status-approved';
        else if (val === 'Changes Requested') badgeClass = 'badge-status-changes';
        else if (val === 'Rejected') badgeClass = 'badge-red';
        else if (val === 'Draft') badgeClass = 'badge-slate';

        return (
          <div>
            <span className={`badge ${badgeClass}`}>{val || 'Approved'}</span>
            {row.reviewed_by_name && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Reviewed by: {row.reviewed_by_name}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'right',
      render: (val, row) => (
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => setViewingRecord(row)}
            title="View Details"
          >
            👁 View
          </button>

          {canEditRecord(row) && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => openEditModal(row)}
              title="Edit Record"
            >
              ✏ Edit
            </button>
          )}

          {isFaculty && (row.status === 'Draft' || row.status === 'Changes Requested') && row.submitted_by === user?.id && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => handleSubmitRecord(row)}
              title="Submit for Approval"
            >
              📤 Submit
            </button>
          )}

          {canReviewRecord(row) && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#059669', borderColor: '#059669' }}
                onClick={() => handleApproveRecord(row)}
                title="Approve Placement"
              >
                ✓ Approve
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={() => openRequestChangesModal(row)}
                title="Request Changes"
              >
                ✎ Changes
              </button>
            </>
          )}

          {canDeleteRecord(row) && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => handleDeleteRecord(row)}
              title="Delete Record"
            >
              🗑
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      {/* 1. Page Title and Relevant Action Buttons */}
      <div className="content-card" style={{ padding: '1.25rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Individual Placement Records & Analytics
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              All statistics are calculated automatically from database student records. Manual summary entry is disabled.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' }}
          >
            + Add Placement Record
          </button>
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

      {/* 2. Placement KPI Summary Cards (DIRECTLY ABOVE FILTERS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.15rem', marginBottom: '1.5rem' }}>
        {/* Highest Package */}
        <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="stat-card-top">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Highest Package
            </span>
            <div className="stat-icon blue">💰</div>
          </div>
          <h3 style={{ color: 'var(--primary)', margin: '0.35rem 0' }}>
            {stats.highest_package > 0 ? `₹${stats.highest_package} LPA` : '-'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top Campus Offer</p>
        </div>

        {/* Average Package */}
        <div className="stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-card-top">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Average Package
            </span>
            <div className="stat-icon purple">📈</div>
          </div>
          <h3 style={{ color: '#6366f1', margin: '0.35rem 0' }}>
            {stats.average_package > 0 ? `₹${stats.average_package} LPA` : '-'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valid Placed Mean</p>
        </div>

        {/* Number of Companies */}
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-card-top">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Companies
            </span>
            <div className="stat-icon orange">🏢</div>
          </div>
          <h3 style={{ margin: '0.35rem 0' }}>{stats.number_of_companies || 0}</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unique Recruiters</p>
        </div>

        {/* Number of Offers */}
        <div className="stat-card" style={{ borderLeft: '4px solid #06b6d4' }}>
          <div className="stat-card-top">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Offers
            </span>
            <div className="stat-icon teal">💼</div>
          </div>
          <h3 style={{ margin: '0.35rem 0' }}>{stats.number_of_offers || 0}</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Placement Offers</p>
        </div>

        {/* Placed Students */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-card-top">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Placed Students
            </span>
            <div className="stat-icon green">🎓</div>
          </div>
          <h3 style={{ margin: '0.35rem 0' }}>{stats.students_placed || 0}</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unique Students Placed</p>
        </div>

        {/* Placement Percentage */}
        <div className="stat-card" style={{ borderLeft: '4px solid #047857' }}>
          <div className="stat-card-top">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Placement Rate
            </span>
            <div className="stat-icon green">📊</div>
          </div>
          <h3 style={{ color: '#047857', margin: '0.35rem 0' }}>{stats.placement_percentage || 0}%</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Eligible: {stats.eligible_students || 0} students
          </p>
        </div>
      </div>

      {/* 3. Placement Filter Section (DIRECTLY BELOW KPI CARDS AND DIRECTLY ABOVE TABLE) */}
      <div className="content-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', background: '#ffffff', border: '1px solid var(--border-color, #e2e8f0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>🔎</span>
            <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Placement Filters & Record Search
            </h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Applies across statistics cards & records table
          </span>
        </div>

        <form onSubmit={handleApplyFilters}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            alignItems: 'flex-end'
          }}>
            {/* Student Search */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Search Student (Name / Reg No)
              </label>
              <input
                type="text"
                placeholder="Search student or reg no..."
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', height: '38px' }}
              />
            </div>

            {/* Company Name Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Company Name
              </label>
              <input
                type="text"
                placeholder="Filter by company..."
                className="form-control"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                style={{ width: '100%', height: '38px' }}
              />
            </div>

            {/* Academic Year Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Academic Year
              </label>
              <select
                className="form-control"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                style={{ width: '100%', height: '38px' }}
              >
                <option value="">All Academic Years</option>
                {academicYears.map((ay) => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Department
              </label>
              <select
                className="form-control"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                disabled={!isAdmin}
                style={{ width: '100%', height: '38px', background: !isAdmin ? '#f8fafc' : '#ffffff' }}
              >
                {isAdmin && <option value="">All Departments</option>}
                {departments.map((d) => (
                  <option key={d.id || d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Batch or Year */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Student Batch / Year
              </label>
              <input
                type="text"
                placeholder="e.g. 2022-2026"
                className="form-control"
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                style={{ width: '100%', height: '38px' }}
              />
            </div>

            {/* Placement Status */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Placement Status
              </label>
              <select
                className="form-control"
                value={filterPlacementStatus}
                onChange={(e) => setFilterPlacementStatus(e.target.value)}
                style={{ width: '100%', height: '38px' }}
              >
                <option value="">All Placement Statuses</option>
                {PLACEMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Approval Status Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Approval Status
              </label>
              <select
                className="form-control"
                value={filterApprovalStatus}
                onChange={(e) => setFilterApprovalStatus(e.target.value)}
                style={{ width: '100%', height: '38px' }}
              >
                <option value="">All Approval Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Changes Requested">Changes Requested</option>
                <option value="Rejected">Rejected</option>
                <option value="Draft">Draft</option>
              </select>
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
                title="Reset all filters to default"
              >
                ↺ Clear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 4. Placement Records Table */}
      <div className="content-card">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span>Individual Placement Records ({records.length})</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
              {filterDept ? filterDept : 'All Departments'} &bull; {filterYear ? filterYear : 'All Years'}
            </span>
          </div>
          {records.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {Math.min((currentPage - 1) * pageSize + 1, records.length)} to {Math.min(currentPage * pageSize, records.length)} of {records.length} records
            </span>
          )}
        </div>

        <DataTable
          columns={columns}
          data={paginatedRecords}
          loading={loading}
          emptyMessage="No placement records found matching the current filters. Click '+ Add Placement Record' to register student placement details."
        />

        {/* 5. Pagination Controls */}
        {records.length > pageSize && (
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
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({records.length} total records)
            </span>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                &larr; Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCurrentPage(p)}
                  style={{ minWidth: '32px', padding: '0.25rem 0.5rem' }}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Placement Record Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Student Placement Record' : 'Add Student Placement Record'}</h3>
              <button
                type="button"
                onClick={closeModal}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => handleSaveRecord(e, false)}>
              <div className="form-grid">
                {/* Student Selection via Dropdown */}
                <div style={{ gridColumn: 'span 2' }}>
                  <StudentSearchDropdown
                    label="Search & Select Registered Student"
                    required
                    department={isAdmin ? undefined : formData.department}
                    selectedStudent={
                      formData.student_name ? {
                        id: formData.student_id,
                        name: formData.student_name,
                        register_no: formData.register_no,
                        department: formData.department
                      } : null
                    }
                    onSelect={(s) => {
                      setFormData((prev) => ({
                        ...prev,
                        student_id: s.id,
                        student_name: s.name,
                        register_no: s.register_no,
                        department: s.department || prev.department
                      }));
                    }}
                    onClear={() => {
                      setFormData((prev) => ({
                        ...prev,
                        student_id: null,
                        student_name: '',
                        register_no: ''
                      }));
                    }}
                  />
                  {formData.student_name && (
                    <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.25rem' }}>
                      ✓ Selected: {formData.student_name} ({formData.register_no}) — {formData.department}
                    </div>
                  )}
                </div>

                {/* Company Name */}
                <FormInput
                  label="Recruiting Company Name"
                  name="company_name"
                  placeholder="e.g. Google, Microsoft, TCS, Infosys"
                  value={formData.company_name}
                  onChange={handleFormChange}
                  required
                />

                {/* Job Role */}
                <FormInput
                  label="Job Role / Designation"
                  name="job_role"
                  placeholder="e.g. Software Engineer, SDE-1, Data Analyst"
                  value={formData.job_role}
                  onChange={handleFormChange}
                />

                {/* Salary Package */}
                <FormInput
                  label="Salary Package / CTC (LPA)"
                  name="package"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 12.5"
                  value={formData.package}
                  onChange={handleFormChange}
                  helper="Positive numeric value in LPA (e.g. 6.5). Enter 0 if unpaid."
                  required
                />

                {/* Placement Status */}
                <FormInput
                  label="Placement Status"
                  name="placement_status"
                  type="select"
                  value={formData.placement_status}
                  onChange={handleFormChange}
                  options={PLACEMENT_STATUSES}
                  required
                />

                {/* Offer Type */}
                <FormInput
                  label="Offer Type"
                  name="offer_type"
                  type="select"
                  value={formData.offer_type}
                  onChange={handleFormChange}
                  options={OFFER_TYPES}
                />

                {/* Job Location */}
                <FormInput
                  label="Job Location"
                  name="location"
                  placeholder="e.g. Bengaluru, Hyderabad, Chennai"
                  value={formData.location}
                  onChange={handleFormChange}
                />

                {/* Placement Date */}
                <FormInput
                  label="Placement / Offer Date"
                  name="placement_date"
                  type="date"
                  value={formData.placement_date}
                  onChange={handleFormChange}
                />

                {/* Academic Year */}
                <FormInput
                  label="Academic Year"
                  name="academic_year"
                  type="select"
                  value={formData.academic_year}
                  onChange={handleFormChange}
                  options={academicYears.map((ay) => ({ value: ay, label: ay }))}
                  required
                />

                {/* Department */}
                <FormInput
                  label="Department"
                  name="department"
                  type="select"
                  value={formData.department}
                  onChange={handleFormChange}
                  options={departments.map((d) => ({ value: d.name, label: d.name }))}
                  disabled={!isAdmin && !isHOD}
                  required
                />

                {/* Offer Details / Notes */}
                <div style={{ gridColumn: 'span 2' }}>
                  <FormInput
                    label="Offer Details / Additional Notes"
                    name="offer_details"
                    type="textarea"
                    rows="2"
                    placeholder="e.g. On-campus placement drive, joined development team"
                    value={formData.offer_details}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                {isFaculty && !editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => handleSaveRecord(e, false)}
                  >
                    Save as Draft
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => handleSaveRecord(e, true)}
                >
                  {editingId ? 'Update Record' : (isFaculty ? 'Save & Submit for Approval' : 'Save Placement Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingRecord && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Placement Record Details</h3>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {/* Student Information Box */}
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>🎓 Student Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Name:</strong> {viewingRecord.student_name}</div>
                  <div><strong>Register No:</strong> {viewingRecord.register_no}</div>
                  <div><strong>Department:</strong> {viewingRecord.department}</div>
                  <div><strong>Batch:</strong> {viewingRecord.batch || 'N/A'}</div>
                </div>
              </div>

              {/* Placement & Offer Details Box */}
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>💼 Placement & Offer Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Recruiter:</strong> {viewingRecord.company_name}</div>
                  <div><strong>Job Role:</strong> {viewingRecord.job_role || 'N/A'}</div>
                  <div><strong>Package:</strong> ₹{viewingRecord.package || 0} LPA</div>
                  <div><strong>Status:</strong> {viewingRecord.placement_status}</div>
                  <div><strong>Offer Type:</strong> {viewingRecord.offer_type || 'On-Campus'}</div>
                  <div><strong>Location:</strong> {viewingRecord.location || 'N/A'}</div>
                  <div><strong>Placement Date:</strong> {viewingRecord.placement_date || 'N/A'}</div>
                  <div><strong>Academic Year:</strong> {viewingRecord.academic_year}</div>
                </div>
                {viewingRecord.offer_details && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    <strong>Offer Details:</strong> {viewingRecord.offer_details}
                  </div>
                )}
              </div>

              {/* Submission & Approval Workflow Box */}
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>📋 Approval Workflow</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Approval Status:</strong> <span className={`badge badge-status-${viewingRecord.status === 'Approved' ? 'approved' : viewingRecord.status === 'Pending Approval' ? 'pending' : 'changes'}`}>{viewingRecord.status}</span></div>
                  <div><strong>Submitted By:</strong> {viewingRecord.submitted_by_name || 'N/A'}</div>
                  {viewingRecord.reviewed_by_name && (
                    <>
                      <div><strong>Reviewed By:</strong> {viewingRecord.reviewed_by_name}</div>
                      <div><strong>Reviewed At:</strong> {viewingRecord.reviewed_at ? new Date(viewingRecord.reviewed_at).toLocaleDateString() : 'N/A'}</div>
                    </>
                  )}
                </div>
                {viewingRecord.review_comments && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fee2e2', borderRadius: '4px', color: '#991b1b', fontSize: '0.85rem' }}>
                    <strong>Reviewer Feedback:</strong> {viewingRecord.review_comments}
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              {canReviewRecord(viewingRecord) && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: '#059669', borderColor: '#059669' }}
                    onClick={() => handleApproveRecord(viewingRecord)}
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => openRequestChangesModal(viewingRecord)}
                  >
                    ✎ Request Changes
                  </button>
                </>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setViewingRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review / Request Changes Modal */}
      {reviewActionModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Request Changes</h3>
              <button
                type="button"
                onClick={() => setReviewActionModal({ isOpen: false, item: null, comments: '' })}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendFeedback}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Please specify the feedback or corrections required for the placement record of{' '}
                <strong>{reviewActionModal.item?.student_name}</strong> ({reviewActionModal.item?.company_name}).
              </p>

              <FormInput
                label="Revision Comments & Feedback"
                name="review_comments"
                type="textarea"
                rows="3"
                placeholder="Explain what needs to be corrected (e.g. Please verify CTC with offer letter)..."
                value={reviewActionModal.comments}
                onChange={(e) => setReviewActionModal((prev) => ({ ...prev, comments: e.target.value }))}
                required
              />

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewActionModal({ isOpen: false, item: null, comments: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Send Revision Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
