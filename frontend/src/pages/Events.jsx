import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import FormInput from '../components/FormInput';
import DataTable from '../components/DataTable';
import StudentSearchDropdown from '../components/StudentSearchDropdown';

const EVENT_CATEGORIES = [
  'Workshop',
  'Seminar',
  'Guest Lecture',
  'Conference',
  'FDP',
  'Hackathon',
  'Technical Event',
  'Cultural Event',
  'Sports Event',
  'Competition',
  'Industrial Visit',
  'Awareness Program',
  'Training',
  'Club Event',
  'Other'
];

export default function Events({
  academicYear,
  department,
  departments = [],
  academicYears = [],
  user
}) {
  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterYear, setFilterYear] = useState(academicYear || '2025-26');

  // Role Scoping
  const isFaculty = user?.role === 'faculty';
  const isHOD = user?.role === 'hod';
  const isAdmin = user?.role === 'admin';
  const initialDept = (isHOD || isFaculty)
    ? (user?.department || department)
    : (department || 'Computer Science and Engineering');
  const [filterDept, setFilterDept] = useState(initialDept);

  // Faculty of the selected department (for coordinator & participating faculty pickers)
  const [deptFaculty, setDeptFaculty] = useState([]);

  // Modals & Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [reviewModal, setReviewModal] = useState({ isOpen: false, item: null, action: '', comments: '' });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Form State
  const initialForm = {
    event_name: '',
    event_type: 'Workshop',
    department: filterDept,
    academic_year: filterYear,
    event_date: new Date().toISOString().split('T')[0],
    start_time: '09:30',
    end_time: '16:30',
    venue: '',
    organizer: '',
    coordinator: '',
    coordinator_faculty_id: '',
    external_guests: '',
    event_status: 'Scheduled',
    description: '',
    document_path: '',
    is_draft: false
  };

  const [formData, setFormData] = useState(initialForm);
  const [selectedStudents, setSelectedStudents] = useState([]); // [{ id, name, register_no, department }]
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([]); // [faculty_id]

  // Synchronize department and year from global header
  useEffect(() => {
    if (academicYear) setFilterYear(academicYear);
  }, [academicYear]);

  useEffect(() => {
    if (!isHOD && !isFaculty && department) {
      setFilterDept(department);
    }
  }, [department, isHOD, isFaculty]);

  // Load events when filters change
  useEffect(() => {
    loadEvents();
  }, [filterDept, filterYear, filterStatus, filterCategory, searchTerm]);

  // Load department faculty for pickers
  useEffect(() => {
    loadDeptFaculty(filterDept);
  }, [filterDept]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await api.getEvents(
        filterYear,
        filterDept,
        filterStatus,
        filterCategory,
        searchTerm
      );
      setEventsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load events:', err);
      setMessage({ type: 'error', text: 'Error fetching events: ' + (err.message || 'Server error') });
    } finally {
      setLoading(false);
    }
  };

  const loadDeptFaculty = async (deptName) => {
    try {
      const res = await api.getFaculty(deptName);
      setDeptFaculty(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Could not load department faculty list:', err);
      setDeptFaculty([]);
    }
  };

  // Open Form for Adding New Record
  const handleAddNew = () => {
    setEditingId(null);
    setFormData({
      ...initialForm,
      department: filterDept,
      academic_year: filterYear
    });
    setSelectedStudents([]);
    setSelectedFacultyIds([]);
    setIsFormOpen(true);
    setMessage({ type: '', text: '' });
  };

  // Open Form for Editing Existing Record
  const handleEdit = async (item) => {
    setEditingId(item.id);
    setMessage({ type: '', text: '' });
    try {
      // Fetch full details with linked students and faculty
      const full = await api.getEvent(item.id);
      setFormData({
        event_name: full.event_name || '',
        event_type: full.event_type || 'Workshop',
        department: full.department || filterDept,
        academic_year: full.academic_year || filterYear,
        event_date: full.event_date || new Date().toISOString().split('T')[0],
        start_time: full.start_time || '',
        end_time: full.end_time || '',
        venue: full.venue || '',
        organizer: full.organizer || '',
        coordinator: full.coordinator || '',
        coordinator_faculty_id: full.coordinator_faculty_id ? String(full.coordinator_faculty_id) : '',
        external_guests: full.external_guests || '',
        event_status: full.event_status || 'Scheduled',
        description: full.description || '',
        document_path: full.document_path || '',
        is_draft: full.status === 'Draft'
      });

      setSelectedStudents(Array.isArray(full.students) ? full.students : []);
      setSelectedFacultyIds(Array.isArray(full.faculty) ? full.faculty.map(f => f.id) : []);
      setIsFormOpen(true);
    } catch (err) {
      console.error('Failed to load event details for edit:', err);
      setMessage({ type: 'error', text: 'Error loading event details: ' + (err.message || 'Server error') });
    }
  };

  // View Record Details
  const handleView = async (item) => {
    try {
      const full = await api.getEvent(item.id);
      setViewingRecord(full);
    } catch (err) {
      console.error('Failed to fetch event details:', err);
      setViewingRecord(item);
    }
  };

  // Form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Coordinator dropdown change
  const handleCoordinatorChange = (e) => {
    const facId = e.target.value;
    if (!facId) {
      setFormData(prev => ({
        ...prev,
        coordinator_faculty_id: '',
        coordinator: ''
      }));
      return;
    }
    const found = deptFaculty.find(f => String(f.id) === String(facId));
    setFormData(prev => ({
      ...prev,
      coordinator_faculty_id: facId,
      coordinator: found ? found.faculty_name : prev.coordinator
    }));
  };

  // Add student from StudentSearchDropdown
  const handleSelectStudent = (student) => {
    if (!student || !student.id) return;
    // Check for duplicates
    if (selectedStudents.some(s => s.id === student.id)) {
      setMessage({ type: 'error', text: `Student ${student.name} is already added to this event.` });
      return;
    }
    setSelectedStudents(prev => [...prev, {
      id: student.id,
      name: student.name,
      register_no: student.register_no,
      department: student.department
    }]);
    setMessage({ type: 'info', text: `Added student ${student.name} to event.` });
  };

  // Remove student from selection
  const handleRemoveStudent = (studentId) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== studentId));
  };

  // Toggle participating faculty selection
  const handleToggleFaculty = (facId) => {
    setSelectedFacultyIds(prev =>
      prev.includes(facId) ? prev.filter(id => id !== facId) : [...prev, facId]
    );
  };

  // Handle Document Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Document size exceeds 10MB limit.' });
      return;
    }

    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await api.uploadEventDocument(file.name, reader.result);
          setFormData(prev => ({ ...prev, document_path: res.filePath }));
          setMessage({ type: 'success', text: 'Supporting document uploaded successfully.' });
        } catch (err) {
          setMessage({ type: 'error', text: err.message || 'Failed to upload document.' });
        } finally {
          setUploadingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingDoc(false);
      setMessage({ type: 'error', text: 'Failed to read file: ' + err.message });
    }
  };

  // Save event (Draft or Submit)
  const handleSave = async (asDraft = false) => {
    setMessage({ type: '', text: '' });

    if (!formData.event_name?.trim()) {
      setMessage({ type: 'error', text: 'Event Title is required.' });
      return;
    }
    if (!formData.event_type?.trim()) {
      setMessage({ type: 'error', text: 'Event Category is required.' });
      return;
    }
    if (!formData.event_date) {
      setMessage({ type: 'error', text: 'Event Date is required.' });
      return;
    }
    if (!formData.coordinator?.trim()) {
      setMessage({ type: 'error', text: 'Event Coordinator is required.' });
      return;
    }

    const payload = {
      ...formData,
      department: filterDept,
      academic_year: filterYear,
      is_draft: asDraft,
      student_ids: selectedStudents.map(s => s.id),
      faculty_ids: selectedFacultyIds
    };

    setLoading(true);
    try {
      if (editingId) {
        const res = await api.updateEvent(editingId, payload);
        setMessage({ type: 'success', text: res.message || 'Event updated successfully!' });
      } else {
        const res = await api.addEvent(payload);
        setMessage({ type: 'success', text: res.message || 'Event saved successfully!' });
      }
      setIsFormOpen(false);
      loadEvents();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Error saving event.' });
    } finally {
      setLoading(false);
    }
  };

  // Delete Action Confirmation
  const requestDelete = (item) => {
    setConfirmDialog({
      title: 'Confirm Event Removal',
      message: `Are you sure you want to delete the event "${item.event_name}"? This action will archive/remove the record while preserving participating student and faculty master records.`,
      onConfirm: async () => {
        try {
          await api.deleteEvent(item.id);
          setMessage({ type: 'success', text: 'Event successfully removed.' });
          setConfirmDialog(null);
          loadEvents();
        } catch (err) {
          setMessage({ type: 'error', text: err.message || 'Failed to delete event.' });
          setConfirmDialog(null);
        }
      }
    });
  };

  // Submit Draft for Approval
  const handleSubmitDraft = async (item) => {
    try {
      const res = await api.submitEvent(item.id);
      setMessage({ type: 'success', text: res.message || 'Event submitted for HOD approval.' });
      loadEvents();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit event.' });
    }
  };

  // Execute Review Action (Approve or Request Changes)
  const handleExecuteReview = async () => {
    const { item, action, comments } = reviewModal;
    if (!item) return;

    if (action === 'request-changes' && !comments.trim()) {
      setMessage({ type: 'error', text: 'Please specify review comments detailing what changes are required.' });
      return;
    }

    try {
      if (action === 'approve') {
        const res = await api.approveEvent(item.id, comments);
        setMessage({ type: 'success', text: res.message || 'Event approved successfully.' });
      } else {
        const res = await api.requestEventChanges(item.id, comments);
        setMessage({ type: 'success', text: res.message || 'Changes requested. Faculty has been notified.' });
      }
      setReviewModal({ isOpen: false, item: null, action: '', comments: '' });
      loadEvents();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to process review action.' });
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const val = status || 'Approved';
    if (val === 'Approved') {
      return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span>✓</span> Approved
        </span>
      );
    }
    if (val === 'Pending Approval') {
      return (
        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span>⏳</span> Pending Approval
        </span>
      );
    }
    if (val === 'Changes Requested') {
      return (
        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span>⚠️</span> Changes Requested
        </span>
      );
    }
    return (
      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span>📝</span> Draft
      </span>
    );
  };

  // Table Columns
  const columns = [
    {
      header: 'Event Title',
      accessor: 'event_name',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{val}</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
            <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>{row.event_type}</span>
            {row.venue && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                📍 {row.venue}
              </span>
            )}
            {row.organizer && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                🏢 {row.organizer}
              </span>
            )}
            {row.external_guests && (
              <span style={{ fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                🎤 {row.external_guests}
              </span>
            )}
          </div>
          {row.review_comments && row.status === 'Changes Requested' && (
            <div style={{
              marginTop: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#991b1b',
              lineHeight: 1.4
            }}>
              <strong>HOD Feedback:</strong> {row.review_comments}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Date & Time',
      accessor: 'event_date',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val}</div>
          {(row.start_time || row.end_time) && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              ⏰ {row.start_time || ''} - {row.end_time || ''}
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{row.academic_year}</div>
        </div>
      )
    },
    {
      header: 'Department',
      accessor: 'department',
      render: (val) => (
        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{val}</span>
      )
    },
    {
      header: 'Coordinator',
      accessor: 'coordinator',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{val || 'N/A'}</div>
          {row.faculty_count > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '2px' }}>
              +{row.faculty_count} faculty involved
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Students',
      accessor: 'student_count',
      align: 'center',
      render: (val) => (
        <span
          className={`badge ${Number(val) > 0 ? 'badge-primary' : 'badge-secondary'}`}
          style={{ fontSize: '0.78rem', minWidth: '32px', textAlign: 'center' }}
          title={Number(val) > 0 ? `${val} individual students linked` : 'Department-wide event (no individual student links)'}
        >
          {val || 0}
        </span>
      )
    },
    {
      header: 'Approval Status',
      accessor: 'status',
      align: 'center',
      render: (val) => renderStatusBadge(val)
    },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'right',
      render: (id, row) => {
        const canEdit = isAdmin || (isHOD && row.department === user.department) || (isFaculty && row.submitted_by === user.id && (row.status === 'Draft' || row.status === 'Changes Requested'));
        const canDelete = isAdmin || (isHOD && row.department === user.department) || (isFaculty && row.submitted_by === user.id && row.status === 'Draft');
        const canReview = (isAdmin || isHOD) && row.status === 'Pending Approval' && (isAdmin || row.department === user.department);
        const canSelfApprove = row.submitted_by !== user.id;

        return (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {/* View Details */}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => handleView(row)}
              title="View full event details"
              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            >
              👁 View
            </button>

            {/* Faculty Submit Draft */}
            {isFaculty && row.submitted_by === user.id && row.status === 'Draft' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleSubmitDraft(row)}
                title="Submit for HOD Approval"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                📤 Submit
              </button>
            )}

            {/* HOD / Admin Review Buttons */}
            {canReview && (
              <>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => {
                    if (!canSelfApprove && !isAdmin) {
                      setMessage({ type: 'error', text: 'Security Rule: You cannot approve an event submitted by yourself.' });
                      return;
                    }
                    setReviewModal({ isOpen: true, item: row, action: 'approve', comments: '' });
                  }}
                  title={!canSelfApprove && !isAdmin ? "Anti-self-approval rule applies" : "Approve Event"}
                  style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => setReviewModal({ isOpen: true, item: row, action: 'request-changes', comments: '' })}
                  title="Request Corrections from Faculty"
                  style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                >
                  ✎ Changes
                </button>
              </>
            )}

            {/* Edit */}
            {canEdit && (
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => handleEdit(row)}
                title="Edit Event"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                ✏ Edit
              </button>
            )}

            {/* Delete */}
            {canDelete && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => requestDelete(row)}
                title="Remove Event"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
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
      {/* Header Bar */}
      <div className="content-card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Events Management Portal
            </h2>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Institutional and departmental symposiums, conferences, guest lectures, hackathons, and cultural events with multi-participant linkages.
            </p>
          </div>
          <div>
            <button
              className="btn btn-primary"
              onClick={handleAddNew}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <span>+</span> New Event
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {message.text && (
          <div className={`alert alert-${message.type}`} style={{ marginTop: '1rem', marginBottom: 0 }}>
            <span>{message.type === 'success' ? '✓' : message.type === 'error' ? '⚠️' : 'ℹ'}</span>
            <span style={{ flex: 1 }}>{message.text}</span>
            <button
              onClick={() => setMessage({ type: '', text: '' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          {/* Department Filter (Admin Only) */}
          {isAdmin ? (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Department
              </label>
              <select
                className="form-control"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d.id || d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Authorized Department
              </label>
              <input
                type="text"
                className="form-control"
                value={user?.department || filterDept}
                disabled
                style={{ background: '#f8fafc', color: 'var(--text-secondary)' }}
              />
            </div>
          )}

          {/* Academic Year Filter */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Academic Year
            </label>
            <select
              className="form-control"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Event Category
            </label>
            <select
              className="form-control"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Approval Status
            </label>
            <select
              className="form-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Changes Requested">Changes Requested</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          {/* Search Box */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Search
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Search by title, coordinator, guest, venue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="content-card">
        <DataTable
          columns={columns}
          data={eventsList}
          loading={loading}
          emptyMessage="No events found matching your criteria."
        />
      </div>

      {/* ============================================================
          MODAL: ADD / EDIT EVENT FORM
          ============================================================ */}
      {isFormOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1050, padding: '1.5rem', overflowY: 'auto'
        }}>
          <div className="content-card" style={{
            maxWidth: '860px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
            borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            background: 'var(--card-bg, #ffffff)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  {editingId ? 'Edit Event Record' : 'Record New Event'}
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {isFaculty
                    ? 'Faculty event submissions are routed to HOD for institutional verification.'
                    : 'Records saved by HOD / Admin are directly approved for annual reports.'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setIsFormOpen(false)}
                style={{ fontSize: '1.25rem', lineHeight: 1, padding: '2px 8px' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Event Title */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Event Title / Theme <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="event_name"
                    className="form-control"
                    placeholder="e.g. International Conference on Computational Intelligence & Robotics"
                    value={formData.event_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Event Category */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    name="event_type"
                    className="form-control"
                    value={formData.event_type}
                    onChange={handleInputChange}
                    required
                  >
                    {EVENT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Event Date */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Date of Event <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    name="event_date"
                    className="form-control"
                    value={formData.event_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Timing */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Start & End Time
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="time"
                      name="start_time"
                      className="form-control"
                      value={formData.start_time}
                      onChange={handleInputChange}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      name="end_time"
                      className="form-control"
                      value={formData.end_time}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Academic Year */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Academic Year <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    name="academic_year"
                    className="form-control"
                    value={formData.academic_year}
                    onChange={handleInputChange}
                    required
                  >
                    {academicYears.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                {/* Department (Read-only for security) */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Department (Authorized)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={filterDept}
                    disabled
                    style={{ background: '#f8fafc', color: 'var(--text-secondary)' }}
                  />
                </div>

                {/* Venue */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Venue / Location
                  </label>
                  <input
                    type="text"
                    name="venue"
                    className="form-control"
                    placeholder="e.g. Diamond Jubilee Auditorium"
                    value={formData.venue}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Organizer */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Organizer / Host Society
                  </label>
                  <input
                    type="text"
                    name="organizer"
                    className="form-control"
                    placeholder="e.g. IEEE Student Chapter & Dept"
                    value={formData.organizer}
                    onChange={handleInputChange}
                  />
                </div>

                {/* External Guests / Keynote Speakers */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    External Guests / Keynote Speakers
                  </label>
                  <input
                    type="text"
                    name="external_guests"
                    className="form-control"
                    placeholder="e.g. Dr. Rajesh Sundaram (Google AI Research)"
                    value={formData.external_guests}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Faculty Coordinator Picker */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Faculty Coordinator <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      className="form-control"
                      value={formData.coordinator_faculty_id}
                      onChange={handleCoordinatorChange}
                      style={{ flex: 1 }}
                    >
                      <option value="">-- Select from Department Faculty Registry --</option>
                      {deptFaculty.map(fac => (
                        <option key={fac.id} value={fac.id}>
                          {fac.faculty_name} ({fac.designation || 'Faculty'})
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>or text:</span>
                    <input
                      type="text"
                      name="coordinator"
                      className="form-control"
                      placeholder="Coordinator Name"
                      value={formData.coordinator}
                      onChange={handleInputChange}
                      style={{ flex: 1 }}
                      required
                    />
                  </div>
                </div>

                {/* Participating Faculty Multi-Select */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Other Participating Faculty Members
                  </label>
                  <div style={{
                    maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '0.5rem 0.75rem', background: '#fafafa'
                  }}>
                    {deptFaculty.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        No faculty records found in this department.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
                        {deptFaculty.map(fac => {
                          const isSelected = selectedFacultyIds.includes(fac.id);
                          return (
                            <label
                              key={fac.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem',
                                padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
                                background: isSelected ? '#e0f2fe' : 'transparent',
                                border: isSelected ? '1px solid #7dd3fc' : '1px solid transparent'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleFaculty(fac.id)}
                              />
                              <span>{fac.faculty_name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    Select other faculty members who participated or co-organized this event.
                  </small>
                </div>

                {/* Participating Students (Smart Dropdown + Multi-Chip Selector) */}
                <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                      Participating Students
                    </label>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Optional: Leave empty for department-wide events
                    </span>
                  </div>

                  {/* Smart Dropdown */}
                  <StudentSearchDropdown
                    label=""
                    placeholder="Search by student name or register number to add..."
                    department={filterDept}
                    onSelect={handleSelectStudent}
                    onClear={() => {}}
                  />

                  {/* Selected Students Chips */}
                  <div style={{ marginTop: '0.75rem' }}>
                    {selectedStudents.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No individual students linked (Event will be recorded as department-wide).
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {selectedStudents.map(student => (
                          <span
                            key={student.id}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              background: '#eff6ff', border: '1px solid #bfdbfe',
                              padding: '4px 10px', borderRadius: '16px', fontSize: '0.82rem',
                              color: '#1e40af', fontWeight: 500
                            }}
                          >
                            <span>🎓 {student.name} ({student.register_no})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveStudent(student.id)}
                              style={{
                                background: 'none', border: 'none', color: '#ef4444',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem',
                                padding: 0, lineHeight: 1
                              }}
                              title="Remove student"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                          ({selectedStudents.length} selected)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Event Description / Summary
                  </label>
                  <textarea
                    name="description"
                    className="form-control"
                    rows={3}
                    placeholder="Briefly describe the theme, key takeaways, participant turnout, or outcomes..."
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Supporting Document Upload */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Supporting Document / Event Brochure / Report (PDF / Image)
                  </label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      className="form-control"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      style={{ flex: 1 }}
                      disabled={uploadingDoc}
                    />
                    {uploadingDoc && <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Uploading...</span>}
                    {formData.document_path && (
                      <a
                        href={`http://localhost:5000/api/events/documents/${formData.document_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline-secondary btn-sm"
                      >
                        📄 View Uploaded Document
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancel
                </button>

                {/* Faculty Draft Button */}
                {isFaculty && (!editingId || formData.is_draft) && (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => handleSave(true)}
                    disabled={loading}
                  >
                    💾 Save as Draft
                  </button>
                )}

                {/* Main Submit Button */}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {isFaculty
                    ? (formData.is_draft ? 'Submit for Approval' : 'Submit Event')
                    : (editingId ? 'Update Event' : 'Save & Approve Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: VIEW DETAILS
          ============================================================ */}
      {viewingRecord && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1050, padding: '1.5rem', overflowY: 'auto'
        }}>
          <div className="content-card" style={{
            maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            borderRadius: '12px', background: 'var(--card-bg, #ffffff)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <span className="badge badge-purple" style={{ marginBottom: '4px' }}>
                  {viewingRecord.event_type}
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 700 }}>
                  {viewingRecord.event_name}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setViewingRecord(null)}
                style={{ fontSize: '1.25rem', lineHeight: 1, padding: '2px 8px' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DEPARTMENT</div>
                <div style={{ fontWeight: 500 }}>{viewingRecord.department}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ACADEMIC YEAR & DATE</div>
                <div style={{ fontWeight: 500 }}>{viewingRecord.academic_year} | {viewingRecord.event_date}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TIMING</div>
                <div style={{ fontWeight: 500 }}>{viewingRecord.start_time || 'N/A'} - {viewingRecord.end_time || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>VENUE</div>
                <div style={{ fontWeight: 500 }}>{viewingRecord.venue || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ORGANIZER</div>
                <div style={{ fontWeight: 500 }}>{viewingRecord.organizer || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COORDINATOR</div>
                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  {viewingRecord.coordinator || 'N/A'}
                </div>
              </div>
              {viewingRecord.external_guests && (
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>EXTERNAL GUEST / KEYNOTE</div>
                  <div style={{ fontWeight: 500, color: '#0369a1' }}>🎤 {viewingRecord.external_guests}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>APPROVAL STATUS</div>
                <div style={{ marginTop: '2px' }}>{renderStatusBadge(viewingRecord.status)}</div>
              </div>
            </div>

            {/* Description */}
            {viewingRecord.description && (
              <div style={{ marginBottom: '1.25rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  DESCRIPTION / THEME SUMMARY
                </div>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{viewingRecord.description}</div>
              </div>
            )}

            {/* Linked Faculty */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Participating Faculty Members ({viewingRecord.faculty?.length || 0})
              </div>
              {viewingRecord.faculty && viewingRecord.faculty.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {viewingRecord.faculty.map(fac => (
                    <span
                      key={fac.id}
                      style={{
                        background: '#f1f5f9', border: '1px solid #cbd5e1',
                        padding: '4px 10px', borderRadius: '14px', fontSize: '0.8rem'
                      }}
                    >
                      👨‍🏫 {fac.faculty_name} ({fac.designation || 'Faculty'})
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No other faculty members linked.
                </div>
              )}
            </div>

            {/* Linked Students */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Participating Students ({viewingRecord.students?.length || 0})
              </div>
              {viewingRecord.students && viewingRecord.students.length > 0 ? (
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '6px 8px' }}>Register No</th>
                        <th style={{ padding: '6px 8px' }}>Student Name</th>
                        <th style={{ padding: '6px 8px' }}>Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingRecord.students.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{s.register_no}</td>
                          <td style={{ padding: '6px 8px' }}>{s.name}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{s.department}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Department-wide event without individual student selection.
                </div>
              )}
            </div>

            {/* Supporting Document */}
            {viewingRecord.document_path && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>📁 Supporting Document Attached</span>
                <a
                  href={`http://localhost:5000/api/events/documents/${viewingRecord.document_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Download / View Document
                </a>
              </div>
            )}

            {/* Approval & Review Metadata */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <div>Submitted by: {viewingRecord.submitted_by_name || 'System / Direct'}</div>
              {viewingRecord.reviewed_by_name && (
                <div>Reviewed by: {viewingRecord.reviewed_by_name} ({viewingRecord.reviewed_at})</div>
              )}
              {viewingRecord.review_comments && (
                <div style={{ marginTop: '4px', color: '#991b1b', background: '#fef2f2', padding: '6px 10px', borderRadius: '4px' }}>
                  <strong>Review Feedback:</strong> {viewingRecord.review_comments}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: REVIEW ACTION (APPROVE / REQUEST CHANGES)
          ============================================================ */}
      {reviewModal.isOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1060, padding: '1.5rem'
        }}>
          <div className="content-card" style={{ maxWidth: '520px', width: '100%', borderRadius: '12px', background: 'var(--card-bg, #ffffff)' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
              {reviewModal.action === 'approve' ? 'Approve Event' : 'Request Corrections from Faculty'}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Event: <strong>{reviewModal.item?.event_name}</strong>
            </p>

            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              {reviewModal.action === 'approve'
                ? 'Approval Notes (Optional)'
                : 'Feedback Comments (Required for corrections)'}
            </label>
            <textarea
              className="form-control"
              rows={4}
              placeholder={reviewModal.action === 'approve' ? 'Optional remarks...' : 'Specify what details need to be corrected...'}
              value={reviewModal.comments}
              onChange={(e) => setReviewModal(prev => ({ ...prev, comments: e.target.value }))}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReviewModal({ isOpen: false, item: null, action: '', comments: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className={reviewModal.action === 'approve' ? 'btn btn-success' : 'btn btn-warning'}
                onClick={handleExecuteReview}
              >
                {reviewModal.action === 'approve' ? 'Confirm Approval' : 'Send Changes Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: DELETE CONFIRMATION DIALOG
          ============================================================ */}
      {confirmDialog && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1070, padding: '1.5rem'
        }}>
          <div className="content-card" style={{ maxWidth: '480px', width: '100%', borderRadius: '12px', background: 'var(--card-bg, #ffffff)' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>
              ⚠️ {confirmDialog.title}
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-main)' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDialog.onConfirm}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
