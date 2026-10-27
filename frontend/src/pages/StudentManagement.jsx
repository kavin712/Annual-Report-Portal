import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function StudentManagement({ user }) {
  const isAdmin = user?.role === 'admin';
  const isHOD = user?.role === 'hod';
  const isFaculty = user?.role === 'faculty';

  // State
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState(
    (isHOD || isFaculty) ? (user?.department || '') : ''
  );
  const [statusFilter, setStatusFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Form & Selection
  const [formData, setFormData] = useState({
    register_no: '',
    name: '',
    department: '',
    academic_year: '2022-26',
    current_year: 4,
    section: 'A',
    email: '',
    phone: '',
    status: 'Active'
  });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load departments for dropdown
  useEffect(() => {
    api.getDepartments()
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch((err) => console.warn('Could not load departments:', err));
  }, []);

  // Load students based on search and filters
  const loadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStudents(search, selectedDept, batchFilter, statusFilter);
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load student registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [search, selectedDept, statusFilter, batchFilter]);

  // Open Add Modal
  const handleOpenAdd = () => {
    const defaultDept = departments.length > 0 ? departments[0].name : (user?.department || 'Computer Science and Engineering');
    setFormData({
      register_no: '',
      name: '',
      department: defaultDept,
      academic_year: '2022-26',
      current_year: 4,
      section: 'A',
      email: '',
      phone: '',
      status: 'Active'
    });
    setError('');
    setShowAddModal(true);
  };

  // Submit Create Student
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.register_no.trim() || !formData.name.trim() || !formData.department.trim()) {
      setError('Register Number, Student Name, and Department are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.createStudent({
        ...formData,
        current_year: parseInt(formData.current_year, 10) || 1
      });
      setSuccess(`Student '${formData.name}' registered successfully.`);
      setShowAddModal(false);
      loadStudents();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to register student');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (student) => {
    setSelectedStudent(student);
    setFormData({
      register_no: student.register_no || '',
      name: student.name || '',
      department: student.department || '',
      academic_year: student.academic_year || '2022-26',
      current_year: student.current_year || 1,
      section: student.section || '',
      email: student.email || '',
      phone: student.phone || '',
      status: student.status || 'Active'
    });
    setError('');
    setShowEditModal(true);
  };

  // Submit Edit Student
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.register_no.trim() || !formData.name.trim() || !formData.department.trim()) {
      setError('Register Number, Student Name, and Department are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.updateStudent(selectedStudent.id, {
        ...formData,
        current_year: parseInt(formData.current_year, 10) || 1
      });
      setSuccess(`Student '${formData.name}' updated successfully.`);
      setShowEditModal(false);
      loadStudents();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update student');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = (student) => {
    const newStatus = student.status === 'Active' ? 'Inactive' : 'Active';
    const actionVerb = newStatus === 'Active' ? 'activate' : 'deactivate';

    setConfirmDialog({
      title: 'Confirm Student Status Change',
      message: `Are you sure you want to ${actionVerb} student ${student.name} (${student.register_no})? Inactive students cannot be selected in placements or achievements.`,
      onConfirm: async () => {
        try {
          await api.updateStudentStatus(student.id, newStatus);
          setSuccess(`Student '${student.name}' is now ${newStatus}.`);
          loadStudents();
          setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
          setError(err.message || 'Failed to update student status');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // View Student Details
  const handleViewDetails = async (student) => {
    setSelectedStudent(student);
    setStudentDetails(null);
    setShowViewModal(true);
    setError('');
    try {
      const details = await api.getStudent(student.id);
      setStudentDetails(details);
    } catch (err) {
      setError(err.message || 'Failed to load student details');
    }
  };

  return (
    <div className="student-management-page">
      {/* Header Bar */}
      <div className="card-header-bar" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2>Student Master Registry</h2>
          <p>
            {isAdmin 
              ? 'Institutional student master registry with centralized registration and verification' 
              : `Student records directory for ${user?.department || 'your department'}`}
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Register Student
          </button>
        )}
      </div>

      {/* Alert Banners */}
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter and Search Bar */}
      <div className="content-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', flex: 1 }}>
            <div style={{ minWidth: '240px', flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by student name or register no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isAdmin && (
              <div style={{ width: '220px' }}>
                <select
                  className="form-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.code} - {d.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ width: '150px' }}>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch('');
              if (isAdmin) setSelectedDept('');
              setStatusFilter('All');
              setBatchFilter('');
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="content-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>Loading students from database...</p>
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎓</div>
            <h4 style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Students Found</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {search || selectedDept || statusFilter !== 'All'
                ? 'No students match your search or filter criteria.'
                : 'No student records have been registered yet.'}
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>Register No</th>
                  <th>Student Name</th>
                  <th>Department</th>
                  <th style={{ textAlign: 'center' }}>Batch / Year</th>
                  <th style={{ textAlign: 'center' }}>Section</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <span className="badge badge-blue" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {student.register_no}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        🎓 {student.name}
                      </div>
                      {student.email && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {student.email}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                        {student.department}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                      Year {student.current_year || 1} &bull; {student.academic_year || '2022-26'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-slate" style={{ fontWeight: 700 }}>
                        {student.section || 'A'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={student.status === 'Active' ? 'badge badge-green' : 'badge badge-amber'}>
                        {student.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewDetails(student)}
                          title="View Student Academic Profile"
                        >
                          👁️ View
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEdit(student)}
                              title="Edit Student Details"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className={student.status === 'Active' ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm'}
                              onClick={() => handleToggleStatus(student)}
                              title={student.status === 'Active' ? 'Deactivate Student' : 'Activate Student'}
                            >
                              {student.status === 'Active' ? 'Deactivate' : 'Activate'}
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
      </div>

      {/* MODAL 1: REGISTER STUDENT (Admin only) */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎓 Register New Student</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Register Number <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CSE-2023-095"
                    value={formData.register_no}
                    onChange={(e) => setFormData({ ...formData, register_no: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Must be unique across the institution</span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Student Full Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Kavin Govindaraj"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Department <span className="required">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.code} — {d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Batch / Academic Cycle</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 2022-26"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Year of Study</label>
                  <select
                    className="form-select"
                    value={formData.current_year}
                    onChange={(e) => setFormData({ ...formData, current_year: parseInt(e.target.value, 10) })}
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Section</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. A, B, C"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="student@college.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STUDENT (Admin only) */}
      {showEditModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Student: {selectedStudent.name}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Register Number <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.register_no}
                    onChange={(e) => setFormData({ ...formData, register_no: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Student Full Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Department <span className="required">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.code} — {d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Batch</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Year</label>
                  <select
                    className="form-select"
                    value={formData.current_year}
                    onChange={(e) => setFormData({ ...formData, current_year: parseInt(e.target.value, 10) })}
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Section</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Student Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW STUDENT DETAILS */}
      {showViewModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="badge badge-blue" style={{ marginRight: '0.5rem' }}>{selectedStudent.register_no}</span>
                <h3 style={{ display: 'inline' }}>{selectedStudent.name}</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowViewModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'var(--bg-card-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DEPARTMENT</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    🏛️ {selectedStudent.department}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>BATCH & YEAR</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    Year {selectedStudent.current_year} &bull; Batch {selectedStudent.academic_year || 'N/A'} (Sec {selectedStudent.section || 'A'})
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS</div>
                  <div style={{ marginTop: '2px' }}>
                    <span className={selectedStudent.status === 'Active' ? 'badge badge-green' : 'badge badge-amber'}>
                      {selectedStudent.status}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CONTACT</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedStudent.email || 'No email provided'}
                  </div>
                  {selectedStudent.phone && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedStudent.phone}</div>
                  )}
                </div>
              </div>

              {/* Placements History */}
              <div>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  💼 Placement Records ({studentDetails?.placements?.length || 0})
                </h5>
                {studentDetails?.placements && studentDetails.placements.length > 0 ? (
                  <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Package</th>
                          <th>Status</th>
                          <th>Offer Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentDetails.placements.map((p) => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>🏢 {p.company_name}</td>
                            <td style={{ color: '#047857', fontWeight: 700 }}>{p.package} LPA</td>
                            <td><span className="badge badge-green">{p.placement_status}</span></td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.offer_details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No placement records for this student yet.
                  </p>
                )}
              </div>

              {/* Achievements History */}
              <div>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  🏆 Student Achievements ({studentDetails?.achievements?.length || 0})
                </h5>
                {studentDetails?.achievements && studentDetails.achievements.length > 0 ? (
                  <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Type</th>
                          <th>Event / Organization</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentDetails.achievements.map((a) => (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 600 }}>{a.title}</td>
                            <td><span className="badge badge-purple">{a.achievement_type}</span></td>
                            <td style={{ color: 'var(--text-secondary)' }}>{a.event_organization}</td>
                            <td>{a.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No achievements recorded for this student yet.
                  </p>
                )}
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>⚠️ {confirmDialog.title}</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>
            <div className="form-actions" style={{ marginTop: 0, paddingTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDialog.onConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
