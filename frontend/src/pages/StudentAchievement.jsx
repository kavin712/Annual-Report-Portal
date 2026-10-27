import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import FormInput from '../components/FormInput';
import DataTable from '../components/DataTable';
import StudentSearchDropdown from '../components/StudentSearchDropdown';

const CATEGORIES = [
  'Technical',
  'Academic',
  'Research',
  'Competition',
  'Certification',
  'Sports',
  'Cultural',
  'Co-Curricular',
  'Other'
];

const LEVELS = [
  'Department',
  'College',
  'State',
  'National',
  'International'
];

const AWARDS = [
  '1st Prize (Winner)',
  '2nd Prize (Runner-Up)',
  '3rd Prize',
  'Gold Medal',
  'Silver Medal',
  'Bronze Medal',
  'Best Innovation / Project Award',
  'Top 5 Finalist',
  'Merit Certificate',
  'Participation & Completion'
];

export default function StudentAchievement({
  academicYear,
  department,
  departments = [],
  academicYears = [],
  user
}) {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterYear, setFilterYear] = useState(academicYear || '2025-26');
  
  // Department scope
  const isFaculty = user?.role === 'faculty';
  const isHOD = user?.role === 'hod';
  const isAdmin = user?.role === 'admin';
  const initialDept = (isHOD || isFaculty) ? (user?.department || department) : (department || 'Computer Science and Engineering');
  const [filterDept, setFilterDept] = useState(initialDept);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [reviewActionModal, setReviewActionModal] = useState({ isOpen: false, item: null, action: '', comments: '' });
  const [uploadingCert, setUploadingCert] = useState(false);

  // Form State
  const initialForm = {
    student_ref_id: null,
    student_name: '',
    student_id: '',
    department: filterDept,
    academic_year: filterYear,
    category: 'Technical',
    level: 'National',
    award: '1st Prize (Winner)',
    title: '',
    event_name: '',
    date: new Date().toISOString().split('T')[0],
    certificate_path: '',
    description: '',
    is_draft: false
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    setFilterYear(academicYear);
  }, [academicYear]);

  useEffect(() => {
    if (!isHOD && !isFaculty) {
      setFilterDept(department);
    }
  }, [department, isHOD, isFaculty]);

  useEffect(() => {
    loadAchievements();
  }, [filterDept, filterYear, filterStatus, filterCategory, filterLevel, searchTerm]);

  const loadAchievements = async () => {
    setLoading(true);
    try {
      const data = await api.getStudentAchievements(
        filterYear,
        filterDept,
        filterStatus,
        filterCategory,
        filterLevel,
        searchTerm
      );
      setAchievements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load student achievements:', err);
      setMessage({ type: 'error', text: 'Error fetching records: ' + (err.message || 'Server error') });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      ...initialForm,
      department: (isHOD || isFaculty) ? user?.department : filterDept,
      academic_year: filterYear
    });
    setIsFormOpen(true);
    setMessage({ type: '', text: '' });
  };

  const handleOpenEdit = (item) => {
    if (isFaculty && item.status === 'Approved') {
      setMessage({
        type: 'error',
        text: 'Approved records cannot be modified directly by faculty. Please contact your HOD or Administrator.'
      });
      return;
    }

    if (isFaculty && item.submitted_by !== user?.id) {
      setMessage({
        type: 'error',
        text: 'You may only edit achievements that you personally submitted.'
      });
      return;
    }

    setEditingId(item.id);
    setFormData({
      student_ref_id: item.student_ref_id || null,
      student_name: item.student_name,
      student_id: item.student_id,
      department: item.department,
      academic_year: item.academic_year,
      category: item.category || item.achievement_type || 'Technical',
      level: item.level || 'National',
      award: item.award || '1st Prize (Winner)',
      title: item.title,
      event_name: item.event_name || item.event_organization || '',
      date: item.date,
      certificate_path: item.certificate_path || '',
      description: item.description || '',
      is_draft: item.status === 'Draft'
    });
    setIsFormOpen(true);
    setMessage({ type: '', text: '' });
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Certificate document file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selected file exceeds the maximum 5MB limit.');
      return;
    }

    const reader = new FileReader();
    setUploadingCert(true);

    reader.onload = async () => {
      try {
        const res = await api.uploadCertificate(file.name, reader.result);
        if (res.certificate_path) {
          setFormData((prev) => ({ ...prev, certificate_path: res.certificate_path }));
          alert('Certificate uploaded successfully!');
        }
      } catch (err) {
        alert('Failed to upload certificate: ' + (err.message || 'Server error'));
      } finally {
        setUploadingCert(false);
      }
    };
    reader.onerror = () => {
      alert('Error reading certificate file.');
      setUploadingCert(false);
    };

    reader.readAsDataURL(file);
  };

  const handleSaveAchievement = async (e, asDraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.student_ref_id) {
      setMessage({
        type: 'error',
        text: 'Please search and select a valid registered student from the registry.'
      });
      return;
    }

    if (!formData.title.trim()) {
      setMessage({ type: 'error', text: 'Achievement Title is required.' });
      return;
    }

    if (!formData.event_name.trim()) {
      setMessage({ type: 'error', text: 'Event or Competition Name is required.' });
      return;
    }

    if (!formData.date) {
      setMessage({ type: 'error', text: 'Achievement Date is required.' });
      return;
    }

    const payload = {
      ...formData,
      title: formData.title.trim(),
      event_name: formData.event_name.trim(),
      event_organization: formData.event_name.trim(),
      achievement_type: formData.category,
      is_draft: asDraft,
      status: asDraft ? 'Draft' : undefined
    };

    try {
      if (editingId) {
        const res = await api.updateStudentAchievement(editingId, payload);
        setMessage({ type: 'success', text: res.message || 'Achievement updated successfully!' });
      } else {
        const res = await api.addStudentAchievement(payload);
        setMessage({ type: 'success', text: res.message || 'Achievement logged successfully!' });
      }
      handleCloseForm();
      loadAchievements();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save achievement.' });
    }
  };

  // Delete achievement
  const handleDelete = (item) => {
    if (isFaculty && item.status === 'Approved') {
      setMessage({ type: 'error', text: 'Approved records cannot be deleted by faculty.' });
      return;
    }

    if (isFaculty && item.submitted_by !== user?.id) {
      setMessage({ type: 'error', text: 'Faculty may only delete their own submissions.' });
      return;
    }

    setConfirmDialog({
      title: 'Delete Student Achievement Record',
      message: `Are you sure you want to permanently delete "${item.title}" for student ${item.student_name} (${item.student_id})? This cannot be undone.`,
      confirmLabel: 'Delete Record',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteStudentAchievement(item.id);
          setMessage({ type: 'success', text: 'Student achievement record deleted successfully.' });
          loadAchievements();
        } catch (err) {
          setMessage({ type: 'error', text: err.message || 'Failed to delete.' });
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // Submit Draft to Pending Approval
  const handleSubmitDraft = async (item) => {
    try {
      const res = await api.submitStudentAchievement(item.id);
      setMessage({ type: 'success', text: res.message || 'Achievement submitted for HOD review.' });
      loadAchievements();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit.' });
    }
  };

  // Quick Approval (HOD / Admin)
  const handleApprove = async (item) => {
    if (item.submitted_by === user?.id) {
      alert('Security Policy: You cannot approve your own submission.');
      return;
    }

    if (!window.confirm(`Approve achievement "${item.title}" for ${item.student_name}?`)) {
      return;
    }

    try {
      await api.approveStudentAchievement(item.id);
      setMessage({ type: 'success', text: `Achievement for ${item.student_name} approved successfully!` });
      loadAchievements();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to approve.' });
    }
  };

  // Open Request Changes Modal
  const openRequestChanges = (item) => {
    setReviewActionModal({
      isOpen: true,
      item,
      action: 'request_changes',
      comments: ''
    });
  };

  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!reviewActionModal.comments.trim()) {
      alert('Please enter specific feedback comments explaining the required changes.');
      return;
    }

    try {
      await api.requestAchievementChanges(reviewActionModal.item.id, reviewActionModal.comments.trim());
      setMessage({ type: 'info', text: 'Revision request sent back to faculty.' });
      setReviewActionModal({ isOpen: false, item: null, action: '', comments: '' });
      loadAchievements();
    } catch (err) {
      alert('Error: ' + (err.message || 'Failed to send feedback.'));
    }
  };

  // View details modal
  const handleViewDetails = async (item) => {
    try {
      const details = await api.getStudentAchievement(item.id);
      setViewingRecord(details || item);
    } catch (err) {
      setViewingRecord(item);
    }
  };

  // DataTable column configuration
  const columns = [
    {
      header: 'Student',
      accessor: 'student_name',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{val}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {row.student_id}
          </div>
          <div style={{ marginTop: '0.2rem' }}>
            <span className="badge badge-slate" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
              {row.academic_batch || row.department}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Achievement Title',
      accessor: 'title',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{val}</div>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
              {row.category || row.achievement_type || 'General'}
            </span>
            {row.certificate_path && (
              <a
                href={row.certificate_path.startsWith('http') ? row.certificate_path : `http://localhost:5000${row.certificate_path}`}
                target="_blank"
                rel="noreferrer"
                className="badge badge-teal"
                style={{ fontSize: '0.7rem', textDecoration: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                📄 Certificate
              </a>
            )}
          </div>
          {row.review_comments && row.status === 'Changes Requested' && (
            <div style={{ marginTop: '0.4rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#991b1b' }}>
              <strong>HOD Revision Feedback:</strong> {row.review_comments}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Level & Award',
      accessor: 'level',
      render: (val, row) => (
        <div>
          <span className={`badge ${
            val === 'International' ? 'badge-purple' :
            val === 'National' ? 'badge-blue' :
            val === 'State' ? 'badge-teal' : 'badge-slate'
          }`} style={{ fontSize: '0.72rem' }}>
            {val || 'National'}
          </span>
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#b45309', marginTop: '0.25rem' }}>
            {row.award || 'Winner / Awardee'}
          </div>
        </div>
      )
    },
    {
      header: 'Event / Organization',
      accessor: 'event_name',
      render: (val, row) => (
        <div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{val || row.event_organization || '-'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {row.date || '-'}</div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (val) => {
        const s = val || 'Approved';
        let badgeClass = 'badge-green';
        let icon = '✅';
        if (s === 'Pending Approval') {
          badgeClass = 'badge-amber';
          icon = '⏳';
        } else if (s === 'Changes Requested') {
          badgeClass = 'badge-red';
          icon = '⚠️';
        } else if (s === 'Draft') {
          badgeClass = 'badge-slate';
          icon = '📝';
        }
        return (
          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>{icon}</span>
            <span>{s}</span>
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (_, row) => {
        const canEdit = !isFaculty || (row.submitted_by === user?.id && row.status !== 'Approved');
        const canDelete = !isFaculty || (row.submitted_by === user?.id && row.status !== 'Approved');
        const canApprove = (isAdmin || isHOD) && row.status === 'Pending Approval' && row.submitted_by !== user?.id;

        return (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => handleViewDetails(row)}
              title="View full achievement dossier"
            >
              👁 View
            </button>

            {canEdit && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => handleOpenEdit(row)}
                title="Edit achievement details"
              >
                ✏️ Edit
              </button>
            )}

            {isFaculty && row.status === 'Draft' && row.submitted_by === user?.id && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#0284c7' }}
                onClick={() => handleSubmitDraft(row)}
                title="Submit draft for HOD approval"
              >
                🚀 Submit
              </button>
            )}

            {canApprove && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#16a34a' }}
                  onClick={() => handleApprove(row)}
                  title="Approve submission"
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#f59e0b', color: '#b45309' }}
                  onClick={() => openRequestChanges(row)}
                  title="Request revision feedback"
                >
                  💬 Revisions
                </button>
              </>
            )}

            {canDelete && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={() => handleDelete(row)}
                title="Delete achievement record"
              >
                🗑
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      {/* Top Banner Card */}
      <div className="content-card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>Module 5</span>
              <span className="badge badge-teal" style={{ fontSize: '0.75rem' }}>{filterDept}</span>
              <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>{filterYear}</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: '0.25rem 0' }}>
              Student Achievements Registry
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Recognize competitive, technical, academic, and co-curricular awards backed by real database records and HOD verification.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.6rem 1.1rem' }}
              onClick={handleOpenAdd}
            >
              <span>+ Log Student Achievement</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {message.text && (
          <div className={`alert alert-${message.type}`} style={{ marginTop: '1rem' }}>
            <span>{message.text}</span>
            <button
              onClick={() => setMessage({ type: '', text: '' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar Card */}
      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by student name, register no, title, award, or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Level:</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
            >
              <option value="All">All Levels</option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Changes Requested">Changes Requested</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          {/* Department Filter (Admin Only) */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Department:</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
              >
                {departments.map((d) => (
                  <option key={d.id || d.name} value={d.name}>
                    {d.code ? `${d.code} - ${d.name}` : d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters */}
          {(searchTerm || filterCategory !== 'All' || filterLevel !== 'All' || filterStatus !== 'All') && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => {
                setSearchTerm('');
                setFilterCategory('All');
                setFilterLevel('All');
                setFilterStatus('All');
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="content-card">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Logged Student Achievements ({achievements.length})</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing records for {filterDept} ({filterYear})
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            <div>Loading student achievements...</div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={achievements}
            emptyMessage={`No student achievements found for ${filterDept} in ${filterYear}. Click "+ Log Student Achievement" to add one.`}
          />
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* ADD / EDIT MODAL */}
      {/* ---------------------------------------------------- */}
      {isFormOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div className="modal-card" style={{
            background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
            width: '100%', maxWidth: '780px', maxHeight: '90vh',
            overflowY: 'auto', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  {editingId ? 'Edit Student Achievement' : 'Log New Student Achievement'}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {isFaculty ? 'Submissions require verification by HOD before inclusion in official reports.' : 'Official departmental record entry.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={(e) => handleSaveAchievement(e, false)}>
              <div className="form-grid">
                {/* Reusable Student Search Dropdown */}
                <div style={{ gridColumn: 'span 2' }}>
                  <StudentSearchDropdown
                    label="Search & Select Registered Student (Registry Verified)"
                    required
                    department={formData.department}
                    selectedStudent={
                      formData.student_name ? {
                        id: formData.student_ref_id,
                        name: formData.student_name,
                        register_no: formData.student_id,
                        department: formData.department
                      } : null
                    }
                    onSelect={(s) => {
                      setFormData((prev) => ({
                        ...prev,
                        student_ref_id: s.id,
                        student_name: s.name,
                        student_id: s.register_no,
                        department: s.department || prev.department
                      }));
                    }}
                    onClear={() => {
                      setFormData((prev) => ({
                        ...prev,
                        student_ref_id: null,
                        student_name: '',
                        student_id: ''
                      }));
                    }}
                  />
                  {!formData.student_ref_id && (
                    <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.25rem' }}>
                      * Type at least 2 characters to search active students. Manually unverified names are rejected.
                    </div>
                  )}
                </div>

                {/* Department (Admin only edit) */}
                {isAdmin ? (
                  <FormInput
                    label="Department"
                    name="department"
                    type="select"
                    value={formData.department}
                    onChange={handleFormChange}
                    options={departments.map((d) => ({ value: d.name, label: d.name }))}
                    required
                  />
                ) : (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                      Department
                    </label>
                    <input
                      type="text"
                      disabled
                      value={formData.department}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#f8fafc', color: 'var(--text-muted)' }}
                    />
                  </div>
                )}

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

                {/* Category */}
                <FormInput
                  label="Achievement Category"
                  name="category"
                  type="select"
                  value={formData.category}
                  onChange={handleFormChange}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  required
                />

                {/* Level */}
                <FormInput
                  label="Achievement Level"
                  name="level"
                  type="select"
                  value={formData.level}
                  onChange={handleFormChange}
                  options={LEVELS.map((lvl) => ({ value: lvl, label: lvl }))}
                  required
                />

                {/* Award / Position */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Award / Position / Rank <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="award"
                    placeholder="e.g. 1st Prize, Gold Medal, Winner, Finalist, Top 10..."
                    value={formData.award}
                    onChange={handleFormChange}
                    list="awards-datalist"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.88rem' }}
                    required
                  />
                  <datalist id="awards-datalist">
                    {AWARDS.map((aw) => (
                      <option key={aw} value={aw} />
                    ))}
                  </datalist>
                </div>

                {/* Achievement Title */}
                <div style={{ gridColumn: 'span 2' }}>
                  <FormInput
                    label="Achievement / Project Title"
                    name="title"
                    placeholder="e.g. 1st Prize - Smart India Hackathon Grand Finale 2025"
                    value={formData.title}
                    onChange={handleFormChange}
                    className="full-width"
                    required
                  />
                </div>

                {/* Event Name / Organizing Body */}
                <div style={{ gridColumn: 'span 2' }}>
                  <FormInput
                    label="Event / Competition / Organizing Institution"
                    name="event_name"
                    placeholder="e.g. Ministry of Education & AICTE, New Delhi"
                    value={formData.event_name}
                    onChange={handleFormChange}
                    className="full-width"
                    required
                  />
                </div>

                {/* Date */}
                <FormInput
                  label="Achievement Date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  required
                />

                {/* Certificate Document Link or Upload */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Supporting Document / Certificate Link
                  </label>
                  <input
                    type="text"
                    name="certificate_path"
                    placeholder="Paste URL (e.g. Google Drive, DigiLocker) or upload below"
                    value={formData.certificate_path}
                    onChange={handleFormChange}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{
                      cursor: uploadingCert ? 'wait' : 'pointer',
                      fontSize: '0.75rem',
                      background: '#f1f5f9',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      color: 'var(--text-main)'
                    }}>
                      {uploadingCert ? 'Uploading...' : '📁 Upload File (PDF/Image)'}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        disabled={uploadingCert}
                      />
                    </label>
                    {formData.certificate_path && (
                      <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>✓ Document attached</span>
                    )}
                  </div>
                </div>

                {/* Brief Description */}
                <div style={{ gridColumn: 'span 2' }}>
                  <FormInput
                    label="Brief Description & Summary"
                    name="description"
                    type="textarea"
                    placeholder="Provide additional details regarding the achievement, solution developed, or competitive criteria..."
                    value={formData.description}
                    onChange={handleFormChange}
                    className="full-width"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseForm}>
                  Cancel
                </button>

                {isFaculty && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => handleSaveAchievement(e, true)}
                    style={{ borderColor: '#64748b' }}
                  >
                    💾 Save as Draft
                  </button>
                )}

                <button type="submit" className="btn btn-primary">
                  {editingId
                    ? 'Update Achievement'
                    : isFaculty
                    ? '🚀 Submit for HOD Approval'
                    : '✓ Save Achievement (Approved)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* VIEW DETAILS MODAL */}
      {/* ---------------------------------------------------- */}
      {viewingRecord && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div className="modal-card" style={{
            background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
            width: '100%', maxWidth: '680px', maxHeight: '90vh',
            overflowY: 'auto', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <span className={`badge ${
                  viewingRecord.status === 'Approved' ? 'badge-green' :
                  viewingRecord.status === 'Pending Approval' ? 'badge-amber' :
                  viewingRecord.status === 'Changes Requested' ? 'badge-red' : 'badge-slate'
                }`} style={{ fontSize: '0.75rem', marginBottom: '0.4rem', display: 'inline-block' }}>
                  {viewingRecord.status || 'Approved'}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  {viewingRecord.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            {/* Student Profile Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', margin: '1.25rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Recipient Student</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{viewingRecord.student_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    Register No: {viewingRecord.student_id}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-blue">{viewingRecord.department}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Academic Year: {viewingRecord.academic_year}
                  </div>
                </div>
              </div>
            </div>

            {/* Achievement Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Category</span>
                <span className="badge badge-purple" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  {viewingRecord.category || viewingRecord.achievement_type || 'General'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Level</span>
                <span className="badge badge-teal" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  {viewingRecord.level || 'National'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Award / Position</span>
                <strong style={{ color: '#b45309', fontSize: '0.9rem', display: 'block', marginTop: '0.2rem' }}>
                  {viewingRecord.award || 'Winner'}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Date</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {viewingRecord.date || '-'}
                </span>
              </div>
            </div>

            {/* Event Name */}
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Event / Organizing Body</span>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {viewingRecord.event_name || viewingRecord.event_organization || '-'}
              </div>
            </div>

            {/* Description */}
            {viewingRecord.description && (
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Summary / Description</span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', background: '#ffffff', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '6px', lineHeight: 1.5 }}>
                  {viewingRecord.description}
                </p>
              </div>
            )}

            {/* Certificate Link */}
            {viewingRecord.certificate_path && (
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Supporting Certificate</span>
                <a
                  href={viewingRecord.certificate_path.startsWith('http') ? viewingRecord.certificate_path : `http://localhost:5000${viewingRecord.certificate_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', fontSize: '0.85rem' }}
                >
                  <span>📄 Open / Download Certificate</span>
                </a>
              </div>
            )}

            {/* Verification / Workflow Trail */}
            <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <div><strong>Submitted By:</strong> {viewingRecord.submitted_by_name || 'System / Direct'} {viewingRecord.created_at ? `on ${viewingRecord.created_at}` : ''}</div>
              {viewingRecord.reviewer_name && (
                <div style={{ marginTop: '0.2rem' }}>
                  <strong>Reviewed By:</strong> {viewingRecord.reviewer_name}
                </div>
              )}
              {viewingRecord.review_comments && (
                <div style={{ marginTop: '0.4rem', background: '#ffffff', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                  <strong>Review Feedback:</strong> {viewingRecord.review_comments}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setViewingRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* REQUEST CHANGES REVISION MODAL */}
      {/* ---------------------------------------------------- */}
      {reviewActionModal.isOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div className="modal-card" style={{
            background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
            width: '100%', maxWidth: '500px', padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: '#b45309' }}>
              💬 Request Revision Comments
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Provide clear feedback to faculty regarding what needs to be changed in "{reviewActionModal.item?.title}".
            </p>

            <form onSubmit={handleSendFeedback}>
              <textarea
                rows={4}
                required
                placeholder="e.g. Please verify certificate link, attach proof of prize, or specify national level organization..."
                value={reviewActionModal.comments}
                onChange={(e) => setReviewActionModal((prev) => ({ ...prev, comments: e.target.value }))}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '6px',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem', marginBottom: '1rem'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewActionModal({ isOpen: false, item: null, action: '', comments: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#d97706' }}>
                  Send Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* CONFIRMATION DIALOG MODAL */}
      {/* ---------------------------------------------------- */}
      {confirmDialog && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div className="modal-card" style={{
            background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
            width: '100%', maxWidth: '440px', padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: confirmDialog.confirmVariant === 'danger' ? '#dc2626' : 'var(--text-main)' }}>
              {confirmDialog.title}
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: confirmDialog.confirmVariant === 'danger' ? '#dc2626' : '#2563eb',
                  borderColor: confirmDialog.confirmVariant === 'danger' ? '#dc2626' : '#2563eb'
                }}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
