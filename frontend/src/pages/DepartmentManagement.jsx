import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function DepartmentManagement({ user }) {
  const isAdmin = user?.role === 'admin';
  const isHOD = user?.role === 'hod';

  // Data states
  const [departments, setDepartments] = useState([]);
  const [eligibleHods, setEligibleHods] = useState([]);
  const [facultyCandidates, setFacultyCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    hod_user_id: '',
    established_year: 2005,
    status: 'Active'
  });
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedDeptDetails, setSelectedDeptDetails] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load departments
  const loadDepartments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDepartments(search, statusFilter);
      // If user is HOD, highlight or filter if needed, but display nicely
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  // Load HODs & Faculty candidates for Admin dropdowns
  const loadAdminHelpers = async () => {
    if (!isAdmin) return;
    try {
      const [hods, faculty] = await Promise.all([
        api.getEligibleHods().catch(() => []),
        api.getFacultyCandidates().catch(() => [])
      ]);
      setEligibleHods(hods || []);
      setFacultyCandidates(faculty || []);
    } catch (err) {
      console.warn('Could not load helper users:', err);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, [search, statusFilter]);

  useEffect(() => {
    loadAdminHelpers();
  }, [isAdmin]);

  // Handle Create Department
  const handleOpenAdd = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      hod_user_id: '',
      established_year: new Date().getFullYear(),
      status: 'Active'
    });
    setError('');
    setShowAddModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Department Code and Department Name are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.createDepartment({
        ...formData,
        hod_user_id: formData.hod_user_id ? parseInt(formData.hod_user_id, 10) : null,
        established_year: formData.established_year ? parseInt(formData.established_year, 10) : 2005
      });
      setSuccess(`Department '${formData.name}' created successfully.`);
      setShowAddModal(false);
      loadDepartments();
      loadAdminHelpers();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Department
  const handleOpenEdit = (dept) => {
    setSelectedDept(dept);
    setFormData({
      code: dept.code || '',
      name: dept.name || '',
      description: dept.description || '',
      hod_user_id: dept.hod_user_id ? String(dept.hod_user_id) : '',
      established_year: dept.established_year || 2005,
      status: dept.status || 'Active'
    });
    setError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Department Code and Department Name are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.updateDepartment(selectedDept.id, {
        ...formData,
        hod_user_id: formData.hod_user_id ? parseInt(formData.hod_user_id, 10) : null,
        established_year: formData.established_year ? parseInt(formData.established_year, 10) : 2005
      });
      setSuccess(`Department '${formData.name}' updated successfully.`);
      setShowEditModal(false);
      loadDepartments();
      loadAdminHelpers();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update department');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Status Toggle (Activate / Deactivate)
  const handleToggleStatus = (dept) => {
    const newStatus = dept.status === 'Active' ? 'Inactive' : 'Active';
    const actionVerb = newStatus === 'Active' ? 'activate' : 'deactivate';

    setConfirmDialog({
      title: `Confirm Department Status Change`,
      message: `Are you sure you want to ${actionVerb} the department '${dept.name}' (${dept.code})?`,
      onConfirm: async () => {
        try {
          await api.updateDepartmentStatus(dept.id, newStatus);
          setSuccess(`Department '${dept.name}' is now ${newStatus}.`);
          loadDepartments();
          setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
          setError(err.message || 'Failed to update status');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // Handle View Department Details
  const handleViewDetails = async (dept) => {
    setSelectedDept(dept);
    setSelectedDeptDetails(null);
    setShowViewModal(true);
    setError('');
    try {
      const details = await api.getDepartment(dept.id);
      setSelectedDeptDetails(details);
    } catch (err) {
      setError(err.message || 'Failed to load department details');
    }
  };

  // Handle Faculty Assignment Modal
  const handleOpenFacultyModal = async (dept) => {
    setSelectedDept(dept);
    setSelectedDeptDetails(null);
    setShowFacultyModal(true);
    setError('');
    try {
      const [details, allFaculty] = await Promise.all([
        api.getDepartment(dept.id),
        api.getFacultyCandidates()
      ]);
      setSelectedDeptDetails(details);
      setFacultyCandidates(allFaculty || []);
    } catch (err) {
      setError(err.message || 'Failed to load faculty information');
    }
  };

  // Assign a faculty member
  const handleAssignFaculty = async (facultyUserId) => {
    if (!selectedDept || !facultyUserId) return;
    try {
      await api.assignFacultyToDepartment(selectedDept.id, facultyUserId);
      setSuccess('Faculty member assigned successfully.');
      // Refresh current details & table
      const updatedDetails = await api.getDepartment(selectedDept.id);
      setSelectedDeptDetails(updatedDetails);
      loadDepartments();
      loadAdminHelpers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to assign faculty member');
    }
  };

  // Remove a faculty member from department
  const handleRemoveFaculty = async (facultyUserId, facultyName) => {
    setConfirmDialog({
      title: 'Remove Faculty from Department',
      message: `Are you sure you want to unassign ${facultyName} from ${selectedDept?.name}?`,
      onConfirm: async () => {
        try {
          await api.removeFacultyFromDepartment(selectedDept.id, facultyUserId);
          setSuccess(`Faculty member removed from ${selectedDept?.name}.`);
          const updatedDetails = await api.getDepartment(selectedDept.id);
          setSelectedDeptDetails(updatedDetails);
          loadDepartments();
          loadAdminHelpers();
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          setError(err.message || 'Failed to remove faculty member');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  return (
    <div className="department-management-page">
      {/* Page Header */}
      <div className="card-header-bar" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2>Institutional Department Management</h2>
          <p>Configure academic departments, assign HOD leadership, and manage faculty rosters</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add New Department
          </button>
        )}
      </div>

      {/* Alert Messages */}
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter & Search Bar */}
      <div className="content-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by department name or code (e.g. CSE, IT)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ width: '180px' }}>
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
              setStatusFilter('All');
              loadDepartments();
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Departments Table */}
      <div className="content-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>Loading department records from database...</p>
          </div>
        ) : departments.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏛️</div>
            <h4 style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Departments Found</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {search || statusFilter !== 'All'
                ? 'No departments match your search or filter criteria.'
                : 'No academic departments have been created yet.'}
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Code</th>
                  <th>Department Name</th>
                  <th>Head of Department (HOD)</th>
                  <th style={{ textAlign: 'center' }}>Faculty Members</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  const isMyDept = (isHOD || user?.role === 'faculty') && 
                    (user?.department?.toLowerCase() === dept.name.toLowerCase() || user?.department?.toLowerCase() === dept.code.toLowerCase());

                  return (
                    <tr key={dept.id} style={isMyDept ? { backgroundColor: 'rgba(37, 99, 235, 0.04)' } : {}}>
                      <td>
                        <span className="badge badge-blue" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {dept.code}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {dept.name}
                          {isMyDept && (
                            <span className="badge badge-purple" style={{ marginLeft: '0.5rem', fontSize: '0.68rem' }}>
                              Your Dept
                            </span>
                          )}
                        </div>
                        {dept.established_year && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Est. {dept.established_year}
                          </div>
                        )}
                      </td>
                      <td>
                        {dept.hod && dept.hod !== 'Unassigned' ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              🎓 {dept.hod}
                            </div>
                            {dept.hod_email && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {dept.hod_email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                            No HOD Assigned
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-slate" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                          👥 {dept.faculty_count || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={dept.status === 'Active' ? 'badge badge-green' : 'badge badge-amber'}>
                          {dept.status || 'Active'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewDetails(dept)}
                            title="View Department Profile & Faculty Roster"
                          >
                            👁️ View
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenFacultyModal(dept)}
                                title="Manage Faculty Roster"
                              >
                                👥 Faculty
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEdit(dept)}
                                title="Edit Department & HOD"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className={dept.status === 'Active' ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm'}
                                onClick={() => handleToggleStatus(dept)}
                                title={dept.status === 'Active' ? 'Deactivate Department' : 'Activate Department'}
                              >
                                {dept.status === 'Active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD DEPARTMENT (Admin only) */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🏛️ Add New Academic Department</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Department Code <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CSE, IT, ECE"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Established Year
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 2005"
                    value={formData.established_year}
                    onChange={(e) => setFormData({ ...formData, established_year: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Department Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Computer Science and Engineering"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Assign Head of Department (HOD)
                  </label>
                  <select
                    className="form-select"
                    value={formData.hod_user_id}
                    onChange={(e) => setFormData({ ...formData, hod_user_id: e.target.value })}
                  >
                    <option value="">-- Select Eligible HOD (Optional) --</option>
                    {eligibleHods.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.email}) - Current Dept: {h.department || 'None'}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Only verified users with the HOD role appear in this list.
                  </span>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Department Status
                  </label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Description / Scope</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Brief departmental overview, vision, or academic profile..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT DEPARTMENT (Admin only) */}
      {showEditModal && selectedDept && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Department: {selectedDept.name}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Department Code <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Established Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.established_year}
                    onChange={(e) => setFormData({ ...formData, established_year: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Department Name <span className="required">*</span>
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
                  <label className="form-label">Assign / Change HOD</label>
                  <select
                    className="form-select"
                    value={formData.hod_user_id}
                    onChange={(e) => setFormData({ ...formData, hod_user_id: e.target.value })}
                  >
                    <option value="">-- No HOD Assigned / Unassign --</option>
                    {eligibleHods.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.email}) {h.department ? `[Currently: ${h.department}]` : ''}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Reassigning will safely update permissions and prevent former HODs from retaining unauthorized departmental access.
                  </span>
                </div>

                <div className="form-group full-width">
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

                <div className="form-group full-width">
                  <label className="form-label">Description / Overview</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving Changes...' : 'Save Department Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW DEPARTMENT DETAILS */}
      {showViewModal && selectedDept && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="badge badge-blue" style={{ marginRight: '0.5rem' }}>{selectedDept.code}</span>
                <h3 style={{ display: 'inline' }}>{selectedDept.name}</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowViewModal(false)}>✕</button>
            </div>

            {selectedDeptDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-card-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HEAD OF DEPARTMENT</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                      🎓 {selectedDeptDetails.hod || 'Unassigned'}
                    </div>
                    {selectedDeptDetails.hod_email && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedDeptDetails.hod_email}</div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ESTABLISHED YEAR</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                      📅 {selectedDeptDetails.established_year || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS</div>
                    <div style={{ marginTop: '0.2rem' }}>
                      <span className={selectedDeptDetails.status === 'Active' ? 'badge badge-green' : 'badge badge-amber'}>
                        {selectedDeptDetails.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>FACULTY ROSTER COUNT</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                      👥 {selectedDeptDetails.faculty_count} Members
                    </div>
                  </div>
                </div>

                {selectedDeptDetails.description && (
                  <div>
                    <h5 style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      ABOUT DEPARTMENT
                    </h5>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, background: '#fff', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      {selectedDeptDetails.description}
                    </p>
                  </div>
                )}

                <div>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    Assigned Faculty Members ({selectedDeptDetails.faculty?.length || 0})
                  </h5>
                  {selectedDeptDetails.faculty && selectedDeptDetails.faculty.length > 0 ? (
                    <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Faculty Name</th>
                            <th>Email</th>
                            <th>Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDeptDetails.faculty.map((f) => (
                            <tr key={f.id}>
                              <td style={{ fontWeight: 600 }}>👨‍🏫 {f.name}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{f.email}</td>
                              <td><span className="badge badge-slate">{f.role}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No faculty members assigned to this department yet.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading details...
              </p>
            )}

            <div className="form-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MANAGE FACULTY ASSIGNMENTS (Admin only) */}
      {showFacultyModal && selectedDept && (
        <div className="modal-overlay" onClick={() => setShowFacultyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👥 Manage Faculty Roster: {selectedDept.name}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowFacultyModal(false)}>✕</button>
            </div>

            {/* Section A: Assign New Faculty to This Department */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Assign Additional Faculty Member
              </h5>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <select
                  className="form-select"
                  id="assign-faculty-select"
                  defaultValue=""
                  style={{ flex: 1 }}
                >
                  <option value="" disabled>-- Select Faculty User --</option>
                  {facultyCandidates
                    .filter((f) => f.department !== selectedDept.name)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.email}) — Current: {f.department || 'Unassigned'}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const sel = document.getElementById('assign-faculty-select');
                    if (sel && sel.value) {
                      handleAssignFaculty(parseInt(sel.value, 10));
                    }
                  }}
                >
                  Assign to Dept
                </button>
              </div>
            </div>

            {/* Section B: Currently Assigned Faculty */}
            <div>
              <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Currently Assigned to {selectedDept.name} ({selectedDeptDetails?.faculty?.length || 0})
              </h5>

              {selectedDeptDetails?.faculty && selectedDeptDetails.faculty.length > 0 ? (
                <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Faculty Name</th>
                        <th>Email</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDeptDetails.faculty.map((f) => (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 600 }}>👨‍🏫 {f.name}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{f.email}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveFaculty(f.id, f.name)}
                              title="Unassign faculty from department"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No faculty members are currently assigned to this department.
                </p>
              )}
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowFacultyModal(false)}>
                Done
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
