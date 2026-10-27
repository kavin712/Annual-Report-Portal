import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import FormInput from '../components/FormInput';
import DataTable from '../components/DataTable';

const DESIGNATIONS = [
  'Professor & HOD',
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Adjunct Professor',
  'Visiting Lecturer',
  'Emeritus Professor'
];

export default function FacultyForm({
  academicYear,
  department,
  departments,
  academicYears,
  user
}) {
  const isAdmin = user?.role === 'admin';
  const isHOD = user?.role === 'hod';
  const isAuthorized = isAdmin || isHOD;

  // Faculty Records State
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState(
    isHOD ? (user?.department || department) : ''
  );
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedYear, setSelectedYear] = useState(academicYear || '2025-26');

  // Modals & Dialogs
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingFaculty, setViewingFaculty] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Eligible User Accounts for Linking
  const [eligibleUsers, setEligibleUsers] = useState([]);

  // Form State
  const initialForm = {
    faculty_name: '',
    faculty_id: '',
    department: isHOD ? user?.department : (department || 'Computer Science and Engineering'),
    academic_year: academicYear || '2025-26',
    designation: 'Associate Professor',
    qualification: '',
    specialization: '',
    date_of_joining: '',
    email: '',
    phone: '',
    status: 'Active',
    user_id: '',
    publications: 0,
    research_projects: 0,
    conferences_attended: 0,
    awards: '',
    description: ''
  };
  const [formData, setFormData] = useState(initialForm);

  // Load faculty records on filter change
  useEffect(() => {
    if (isAuthorized) {
      loadFaculty();
    }
  }, [selectedDept, selectedYear, selectedStatus, search]);

  // Load eligible unlinked user accounts when modal opens
  useEffect(() => {
    if (isAuthorized && isModalOpen) {
      api.getUnlinkedFacultyUsers()
        .then((data) => setEligibleUsers(Array.isArray(data) ? data : []))
        .catch((err) => console.warn('Could not load user accounts for linking:', err));
    }
  }, [isModalOpen]);

  const loadFaculty = async () => {
    setLoading(true);
    try {
      const data = await api.getFaculty(
        selectedYear,
        selectedDept,
        selectedStatus !== 'All' ? selectedStatus : null,
        search
      );
      setFacultyList(data || []);
    } catch (err) {
      console.error('Failed to load faculty:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load faculty records.' });
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      ...initialForm,
      department: isHOD ? user?.department : (selectedDept || departments[0]?.name || 'Computer Science and Engineering'),
      academic_year: selectedYear || '2025-26'
    });
    setIsModalOpen(true);
    setMessage({ type: '', text: '' });
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      faculty_name: item.faculty_name,
      faculty_id: item.faculty_id,
      department: item.department,
      department_id: item.department_id || '',
      academic_year: item.academic_year || selectedYear,
      designation: item.designation,
      qualification: item.qualification,
      specialization: item.specialization || '',
      date_of_joining: item.date_of_joining || '',
      email: item.email || '',
      phone: item.phone || '',
      status: item.status || 'Active',
      user_id: item.user_id ? String(item.user_id) : '',
      publications: item.publications || 0,
      research_projects: item.research_projects || 0,
      conferences_attended: item.conferences_attended || 0,
      awards: item.awards || '',
      description: item.description || ''
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

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.faculty_name.trim() || !formData.faculty_id.trim() || !formData.department.trim() || !formData.designation.trim() || !formData.qualification.trim()) {
      alert('Please fill all required fields: Name, Employee ID, Department, Designation, and Qualification.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateFaculty(editingId, formData);
        setMessage({ type: 'success', text: `Faculty record for "${formData.faculty_name}" updated successfully!` });
      } else {
        await api.addFaculty(formData);
        setMessage({ type: 'success', text: `Faculty record for "${formData.faculty_name}" registered successfully!` });
      }
      closeModal();
      loadFaculty();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Status toggle confirmation
  const handleToggleStatus = (item) => {
    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    const actionLabel = newStatus === 'Active' ? 'activate' : 'deactivate';

    setConfirmDialog({
      title: `${newStatus === 'Active' ? 'Activate' : 'Deactivate'} Faculty Member`,
      message: `Are you sure you want to ${actionLabel} "${item.faculty_name}" (${item.faculty_id})? ${
        newStatus === 'Inactive'
          ? 'Deactivating preserves historical publications and activities while marking them as inactive.'
          : 'Activating will mark this faculty member as currently active.'
      }`,
      confirmLabel: `${newStatus === 'Active' ? 'Activate' : 'Deactivate'} Faculty`,
      confirmVariant: newStatus === 'Active' ? 'primary' : 'warning',
      onConfirm: async () => {
        try {
          await api.updateFacultyStatus(item.id, newStatus);
          setMessage({
            type: 'success',
            text: `Faculty member "${item.faculty_name}" status set to ${newStatus}.`
          });
          loadFaculty();
        } catch (err) {
          setMessage({ type: 'error', text: err.message || 'Failed to update status.' });
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // Delete confirmation
  const handleDelete = (item) => {
    setConfirmDialog({
      title: 'Delete Faculty Record',
      message: `Are you sure you want to permanently delete the faculty master record for "${item.faculty_name}" (${item.faculty_id})? This action cannot be undone. User login accounts will remain safe.`,
      confirmLabel: 'Delete Record',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteFaculty(item.id);
          setMessage({ type: 'success', text: `Faculty record for "${item.faculty_name}" was deleted.` });
          loadFaculty();
        } catch (err) {
          setMessage({ type: 'error', text: err.message || 'Failed to delete faculty record.' });
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // View faculty details
  const handleView = async (item) => {
    try {
      const details = await api.getFacultyMember(item.id);
      setViewingFaculty(details);
    } catch (err) {
      setViewingFaculty(item);
    }
  };

  // Restrict access for Faculty role
  if (!isAuthorized) {
    return (
      <div className="content-card" style={{ textAlign: 'center', padding: '3.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2>Access Restricted</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0.75rem auto 1.5rem' }}>
          Faculty members are not permitted to manage or modify official Departmental Faculty Information.
          This section is strictly managed by the <strong>Head of Department (HOD)</strong> and <strong>Institutional Administrator</strong>.
        </p>
        <span className="badge badge-amber">Role: {user?.role?.toUpperCase()}</span>
      </div>
    );
  }

  const columns = [
    {
      header: 'Faculty Name & ID',
      accessor: 'faculty_name',
      render: (val, row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{val}</strong>
            {row.user_id && (
              <span className="badge badge-purple" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }} title={`Linked Account: ${row.linked_user_email || 'Yes'}`}>
                Linked Account
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
            {row.faculty_id}
          </div>
        </div>
      )
    },
    {
      header: 'Department',
      accessor: 'department',
      render: (val, row) => (
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{val}</span>
          {row.department_code && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>[{row.department_code}]</div>
          )}
        </div>
      )
    },
    {
      header: 'Designation & Qual.',
      accessor: 'designation',
      render: (val, row) => (
        <div>
          <span className="badge badge-blue">{val}</span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {row.qualification}
          </div>
          {row.specialization && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {row.specialization}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Contact',
      accessor: 'email',
      render: (val, row) => (
        <div style={{ fontSize: '0.8rem' }}>
          {val ? <div style={{ color: 'var(--text-main)' }}>✉ {val}</div> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
          {row.phone && <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>📞 {row.phone}</div>}
        </div>
      )
    },
    {
      header: 'Research Stats',
      accessor: 'publications',
      align: 'center',
      render: (val, row) => (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          <div>Papers: <strong style={{ color: 'var(--primary)' }}>{val || 0}</strong></div>
          <div>Projects: <strong>{row.research_projects || 0}</strong></div>
          <div>Conf: <strong>{row.conferences_attended || 0}</strong></div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      align: 'center',
      render: (val) => (
        <span className={`badge ${val === 'Active' ? 'badge-green' : 'badge-slate'}`}>
          {val || 'Active'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'center',
      render: (id, row) => (
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleView(row)}
            title="View Details"
            style={{ padding: '0.3rem 0.55rem' }}
          >
            👁
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => openEditModal(row)}
            title="Edit Record"
            style={{ padding: '0.3rem 0.55rem' }}
          >
            ✏️
          </button>
          <button
            type="button"
            className={`btn btn-sm ${row.status === 'Active' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => handleToggleStatus(row)}
            title={row.status === 'Active' ? 'Deactivate' : 'Activate'}
            style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
          >
            {row.status === 'Active' ? '⏸ Deactivate' : '▶ Activate'}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => handleDelete(row)}
            title="Delete Record"
            style={{ padding: '0.3rem 0.55rem' }}
          >
            🗑
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      {/* Header Bar */}
      <div className="content-card" style={{ padding: '1.25rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Faculty Information Management</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Official faculty roster, academic designations, credentials, and research output.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' }}
          >
            + Register Faculty Member
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="content-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Search Faculty</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name, employee ID, specialization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isAdmin ? (
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Department Scope</label>
              <select
                className="form-select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Assigned Department</label>
              <input
                type="text"
                className="form-input"
                value={user?.department || 'My Department'}
                disabled
                style={{ backgroundColor: '#f1f5f9' }}
              />
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Employment Status</label>
            <select
              className="form-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive / On Leave</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Academic Year</label>
            <select
              className="form-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {academicYears.map((ay) => (
                <option key={ay} value={ay}>{ay}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Faculty Table */}
      <div className="content-card">
        <div className="section-title">
          <span>Official Faculty Roster ({facultyList.length})</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {selectedDept || 'All Departments'} • Academic Term {selectedYear}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={facultyList}
          emptyMessage="No faculty records match the selected filters. Use the button above to register faculty."
        />
      </div>

      {/* Add / Edit Faculty Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Faculty Record' : 'Register New Faculty Member'}</h3>
              <button
                type="button"
                onClick={closeModal}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <FormInput
                  label="Faculty Full Name"
                  name="faculty_name"
                  placeholder="e.g. Prof. Meena Devi"
                  value={formData.faculty_name}
                  onChange={handleFormChange}
                  required
                />

                <FormInput
                  label="Employee ID / Faculty Code"
                  name="faculty_id"
                  placeholder="e.g. FAC-CSE-009"
                  value={formData.faculty_id}
                  onChange={handleFormChange}
                  helper="Must be unique across the institution"
                  required
                />

                <FormInput
                  label="Department"
                  name="department"
                  type="select"
                  value={formData.department}
                  onChange={handleFormChange}
                  options={
                    isAdmin
                      ? departments.map((d) => ({ value: d.name, label: d.name }))
                      : [{ value: user?.department, label: user?.department }]
                  }
                  disabled={isHOD}
                  required
                />

                <FormInput
                  label="Academic Year"
                  name="academic_year"
                  type="select"
                  value={formData.academic_year}
                  onChange={handleFormChange}
                  options={academicYears.map((ay) => ({ value: ay, label: ay }))}
                  required
                />

                <FormInput
                  label="Designation"
                  name="designation"
                  type="select"
                  value={formData.designation}
                  onChange={handleFormChange}
                  options={DESIGNATIONS}
                  required
                />

                <FormInput
                  label="Highest Qualification"
                  name="qualification"
                  placeholder="e.g. Ph.D. in Computer Science (IISc)"
                  value={formData.qualification}
                  onChange={handleFormChange}
                  required
                />

                <FormInput
                  label="Area of Specialization"
                  name="specialization"
                  placeholder="e.g. Deep Learning, Cloud Systems, VLSI"
                  value={formData.specialization}
                  onChange={handleFormChange}
                />

                <FormInput
                  label="Date of Joining"
                  name="date_of_joining"
                  type="date"
                  value={formData.date_of_joining}
                  onChange={handleFormChange}
                />

                <FormInput
                  label="Official Email"
                  name="email"
                  type="email"
                  placeholder="e.g. meena.devi@college.edu"
                  value={formData.email}
                  onChange={handleFormChange}
                />

                <FormInput
                  label="Contact Phone Number"
                  name="phone"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={handleFormChange}
                />

                <FormInput
                  label="Employment Status"
                  name="status"
                  type="select"
                  value={formData.status}
                  onChange={handleFormChange}
                  options={['Active', 'Inactive']}
                  required
                />

                <FormInput
                  label="Linked User Login Account (Optional)"
                  name="user_id"
                  type="select"
                  value={formData.user_id}
                  onChange={handleFormChange}
                  options={[
                    { value: '', label: '-- None (Do not link login account) --' },
                    ...eligibleUsers.map((u) => ({
                      value: String(u.id),
                      label: `${u.name} (${u.email}) [${u.role.toUpperCase()}]`
                    }))
                  ]}
                  helper="Links this master record to an existing login credential"
                />

                <div style={{ gridColumn: 'span 2', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Research Output & Academic Metrics
                  </strong>
                </div>

                <FormInput
                  label="Scopus / SCI Publications"
                  name="publications"
                  type="number"
                  min="0"
                  value={formData.publications}
                  onChange={handleFormChange}
                />

                <FormInput
                  label="Sponsored Projects / Grants"
                  name="research_projects"
                  type="number"
                  min="0"
                  value={formData.research_projects}
                  onChange={handleFormChange}
                />

                <FormInput
                  label="Conferences Attended"
                  name="conferences_attended"
                  type="number"
                  min="0"
                  value={formData.conferences_attended}
                  onChange={handleFormChange}
                />

                <FormInput
                  label="Honors & Awards"
                  name="awards"
                  placeholder="e.g. IEEE Outstanding Researcher 2024"
                  value={formData.awards}
                  onChange={handleFormChange}
                />

                <div style={{ gridColumn: 'span 2' }}>
                  <FormInput
                    label="Biography / Research Focus"
                    name="description"
                    type="textarea"
                    placeholder="Brief description of research lab leadership, student mentoring, industry consultancies..."
                    value={formData.description}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingId ? 'Update Faculty Details' : 'Save Faculty Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Faculty Details Modal */}
      {viewingFaculty && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Faculty Dossier: {viewingFaculty.faculty_name}</h3>
              <button
                type="button"
                onClick={() => setViewingFaculty(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '0.5rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                    {viewingFaculty.faculty_name}
                  </h4>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {viewingFaculty.faculty_id}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="badge badge-blue">{viewingFaculty.designation}</span>
                  <span className={`badge ${viewingFaculty.status === 'Active' ? 'badge-green' : 'badge-slate'}`}>
                    {viewingFaculty.status || 'Active'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Department</span>
                  <strong>{viewingFaculty.department}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Qualification</span>
                  <strong>{viewingFaculty.qualification}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Specialization</span>
                  <strong>{viewingFaculty.specialization || 'General / Core'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Date of Joining</span>
                  <strong>{viewingFaculty.date_of_joining || 'Not Recorded'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Email Address</span>
                  <strong>{viewingFaculty.email || 'None'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Phone Number</span>
                  <strong>{viewingFaculty.phone || 'None'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Linked User Account</span>
                  <strong>{viewingFaculty.linked_user_email || 'Not Linked to Login User'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Academic Year</span>
                  <strong>{viewingFaculty.academic_year || 'Regular'}</strong>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  Research & Scholarship Output
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: '#EFF6FF', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#1E40AF', display: 'block' }}>Publications</span>
                    <strong style={{ fontSize: '1.1rem', color: '#1E3A8A' }}>{viewingFaculty.publications || 0}</strong>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#F0FDF4', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#166534', display: 'block' }}>Projects</span>
                    <strong style={{ fontSize: '1.1rem', color: '#047857' }}>{viewingFaculty.research_projects || 0}</strong>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#FAF5FF', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#6B21A8', display: 'block' }}>Conferences</span>
                    <strong style={{ fontSize: '1.1rem', color: '#7E22CE' }}>{viewingFaculty.conferences_attended || 0}</strong>
                  </div>
                </div>
              </div>

              {viewingFaculty.awards && (
                <div style={{ marginTop: '1rem', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Honors & Distinctions:</span>
                  <div style={{ padding: '0.4rem 0.6rem', backgroundColor: '#FEF3C7', borderRadius: '4px', color: '#92400E' }}>
                    🏆 {viewingFaculty.awards}
                  </div>
                </div>
              )}

              {viewingFaculty.description && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Biography / Focus:</span>
                  <p style={{ margin: '0.25rem 0', color: 'var(--text-main)', lineHeight: '1.4' }}>
                    {viewingFaculty.description}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingFaculty(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{confirmDialog.title}</h3>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', margin: '1rem 0 1.5rem' }}>
              {confirmDialog.message}
            </p>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-${confirmDialog.confirmVariant || 'primary'}`}
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
