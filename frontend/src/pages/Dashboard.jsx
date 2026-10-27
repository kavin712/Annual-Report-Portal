import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import SummaryCard from '../components/SummaryCard';

export default function Dashboard({
  academicYear,
  setAcademicYear,
  department,
  setDepartment,
  departments,
  academicYears,
  user
}) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDepartments: 3,
    totalStudents: 0,
    totalFaculty: 0,
    totalActivities: 0,
    totalEvents: 0,
    approvedEvents: 0,
    pendingEvents: 0,
    reportsGenerated: 0,
    pendingApprovals: 0,
    mySubmissions: 0,
    approvedSubmissions: 0,
    changesRequested: 0
  });

  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(null);
  const [deptTableFilter, setDeptTableFilter] = useState('All');

  const [hodData, setHodData] = useState(null);
  const [hodLoading, setHodLoading] = useState(false);
  const [hodError, setHodError] = useState(null);

  const [facultyData, setFacultyData] = useState(null);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [facultyError, setFacultyError] = useState(null);

  // Student smart search state (Module 14 Requirement 3 & 12)
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const isAdmin = user?.role === 'admin';
  const isHOD = user?.role === 'hod';
  const isFaculty = user?.role === 'faculty';

  const effectiveDept = (isHOD || isFaculty) ? (user?.department || department) : department;

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    } else if (isHOD) {
      fetchHODData();
    } else if (isFaculty) {
      fetchFacultyData();
    } else {
      fetchStats();
    }
  }, [isAdmin, isHOD, isFaculty, academicYear, effectiveDept]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardStats(academicYear, effectiveDept);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const data = await api.getAdminDashboard(academicYear);
      setAdminData(data);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      setAdminError(err.message || 'Failed to retrieve admin dashboard metrics');
    } finally {
      setAdminLoading(false);
    }
  };

  const fetchHODData = async () => {
    setHodLoading(true);
    setHodError(null);
    try {
      const data = await api.getHODDashboard(academicYear);
      setHodData(data);
    } catch (err) {
      console.error('Failed to load HOD dashboard:', err);
      setHodError(err.message || 'Failed to retrieve HOD dashboard metrics');
    } finally {
      setHodLoading(false);
    }
  };

  const fetchFacultyData = async () => {
    setFacultyLoading(true);
    setFacultyError(null);
    try {
      const data = await api.getFacultyDashboard(academicYear);
      setFacultyData(data);
    } catch (err) {
      console.error('Failed to load Faculty dashboard:', err);
      setFacultyError(err.message || 'Failed to retrieve faculty dashboard metrics');
    } finally {
      setFacultyLoading(false);
    }
  };

  const handleStudentSearch = async (q) => {
    setStudentSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setStudentSearchResults([]);
      return;
    }
    setSearchingStudents(true);
    try {
      const dept = facultyData?.faculty?.department || effectiveDept;
      const res = await api.searchStudents(q.trim(), dept);
      setStudentSearchResults(Array.isArray(res) ? res.slice(0, 5) : []);
    } catch (e) {
      console.error('Student search failed:', e);
    } finally {
      setSearchingStudents(false);
    }
  };

  return (
    <div>
      {/* Top Banner with Role Identification */}
      <div className="content-card" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <span className={`badge ${isAdmin ? 'badge-purple' : isHOD ? 'badge-teal' : 'badge-blue'}`}>
                {isAdmin ? '👑 Institutional Administrator' : isHOD ? `🎓 HOD — ${hodData?.department?.name || effectiveDept}` : `👨‍🏫 Faculty — ${facultyData?.faculty?.faculty_name || user?.name || effectiveDept}`}
              </span>
              {isHOD && hodData?.department?.status && (
                <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                  ● {hodData.department.status}
                </span>
              )}
              {isFaculty && (
                <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                  ● {facultyData?.faculty?.status || 'Active Faculty'}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isAdmin ? 'Institute Dashboard' : isHOD ? `${hodData?.department?.name || effectiveDept} — HOD Dashboard` : `${facultyData?.faculty?.faculty_name || user?.name} — Faculty Portal`}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {isAdmin ? (
                <>
                  Scope: <strong style={{ color: 'var(--primary)' }}>Institute-Level Central Overview</strong> &bull; Academic Year: <strong style={{ color: 'var(--primary)' }}>{academicYear}</strong>
                </>
              ) : isHOD ? (
                <>
                  Department Code: <strong style={{ color: 'var(--primary)' }}>{hodData?.department?.code || 'DEPT'}</strong> &bull; HOD: <strong style={{ color: 'var(--primary)' }}>{hodData?.department?.hod || user?.name || 'Assigned HOD'}</strong> &bull; Academic Year: <strong style={{ color: 'var(--primary)' }}>{academicYear}</strong>
                </>
              ) : isFaculty ? (
                <>
                  Employee ID: <strong style={{ color: 'var(--primary)' }}>{facultyData?.faculty?.employee_id || 'FAC'}</strong> &bull; Designation: <strong style={{ color: 'var(--primary)' }}>{facultyData?.faculty?.designation || 'Faculty Member'}</strong> &bull; Department: <strong style={{ color: 'var(--primary)' }}>{facultyData?.faculty?.department || effectiveDept} ({facultyData?.faculty?.department_code || 'DEPT'})</strong> &bull; Academic Year: <strong style={{ color: 'var(--primary)' }}>{academicYear}</strong>
                </>
              ) : (
                <>
                  Scope: <strong style={{ color: 'var(--primary)' }}>{effectiveDept}</strong> &bull; Academic Year: <strong style={{ color: 'var(--primary)' }}>{academicYear}</strong>
                </>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="selector-group">
              <label>Academic Year:</label>
              <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                {academicYears.map((ay) => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => isAdmin ? fetchAdminData() : isHOD ? fetchHODData() : isFaculty ? fetchFacultyData() : fetchStats()}
              title="Refresh live database statistics"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                fontSize: '0.85rem',
                alignSelf: 'flex-end',
                height: '38px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontWeight: 600
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. MODULE 14: FACULTY DASHBOARD — INDIVIDUAL OVERVIEW */}
      {/* ---------------------------------------------------- */}
      {isFaculty && (
        <>
          {facultyLoading && !facultyData ? (
            <div className="content-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Loading Faculty Dashboard...</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Retrieving faculty submissions and department records for Academic Year {academicYear}</p>
            </div>
          ) : facultyError ? (
            <div className="content-card" style={{ padding: '2rem', textAlign: 'center', border: '1.5px solid var(--danger)' }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
              <h3 style={{ color: 'var(--danger)', margin: '0.75rem 0 0.5rem 0' }}>Failed to Load Faculty Dashboard</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{facultyError}</p>
              <button className="btn btn-primary" onClick={fetchFacultyData}>Retry Connection</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              {/* -------------------------------------------------- */}
              {/* SECTION A: FACULTY PROFILE & CREDENTIALS BANNER */}
              {/* -------------------------------------------------- */}
              <div
                className="content-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.05) 100%)',
                  border: '1.5px solid rgba(59, 130, 246, 0.25)',
                  padding: '1.25rem 1.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1.25rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-blue" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                      ID: {facultyData?.faculty?.employee_id || 'FAC'}
                    </span>
                    <span className="badge badge-purple" style={{ fontWeight: 600 }}>
                      {facultyData?.faculty?.designation || 'Faculty Member'}
                    </span>
                    <span className="badge badge-teal">
                      {facultyData?.faculty?.department_code || 'DEPT'}
                    </span>
                    <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                      {facultyData?.faculty?.status || 'Active Profile'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.35rem 0' }}>
                    {facultyData?.faculty?.faculty_name || user?.name}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem 0' }}>
                    Department: <strong style={{ color: 'var(--primary)' }}>{facultyData?.faculty?.department || effectiveDept}</strong> &bull; Qualification: <strong style={{ color: 'var(--text-main)' }}>{facultyData?.faculty?.qualification || 'Postgraduate'}</strong> &bull; Specialization: <strong style={{ color: 'var(--text-main)' }}>{facultyData?.faculty?.specialization || 'Engineering'}</strong>
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Official Email: <strong style={{ color: 'var(--text-main)' }}>{facultyData?.faculty?.email || user?.email}</strong> &bull; Date of Joining: <strong>{facultyData?.faculty?.date_of_joining || 'Active Faculty'}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/students')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    <span>👥</span> Department Students ({facultyData?.departmentStudents?.active || 0})
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/student-achievements')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    <span>➕</span> Submit Data
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION B: SUBMISSION STATUS SUMMARY KPI CARDS (Section 5) */}
              {/* -------------------------------------------------- */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📊</span> My Submission Status ({facultyData?.academic_year || academicYear})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Personal submission counts across all reporting modules
                  </span>
                </div>

                <div className="dashboard-grid">
                  <SummaryCard
                    title="Total Submissions"
                    value={facultyData?.submissionsStatus?.total || 0}
                    subtitle="Logged by you"
                    icon="📝"
                    color="blue"
                  />
                  <SummaryCard
                    title="Draft Records"
                    value={facultyData?.submissionsStatus?.draft || 0}
                    subtitle="Unsubmitted entries"
                    icon="✏️"
                    color="slate"
                  />
                  <SummaryCard
                    title="Pending Approval"
                    value={facultyData?.submissionsStatus?.pending || 0}
                    subtitle="Awaiting HOD review"
                    icon="⏳"
                    color="orange"
                  />
                  <SummaryCard
                    title="Approved Records"
                    value={facultyData?.submissionsStatus?.approved || 0}
                    subtitle="Included in Annual Report"
                    icon="✅"
                    color="green"
                  />
                  <SummaryCard
                    title="Changes Requested"
                    value={facultyData?.submissionsStatus?.changesRequested || 0}
                    subtitle="Revisions required"
                    icon="⚠️"
                    color="purple"
                  />
                  <SummaryCard
                    title="Resubmitted"
                    value={facultyData?.submissionsStatus?.resubmitted || 0}
                    subtitle="Under review"
                    icon="🔄"
                    color="teal"
                  />
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION C: PENDING ACTIONS & REVISIONS (Section 6) */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
                      <span>⚠️</span> Pending Actions & Revisions Requiring Attention
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Submissions returned with HOD comments or unsubmitted draft records
                    </p>
                  </div>
                  <span className={`badge ${facultyData?.pendingActions?.length > 0 ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '0.85rem' }}>
                    {facultyData?.pendingActions?.length || 0} Action Items
                  </span>
                </div>

                {facultyData?.pendingActions && facultyData.pendingActions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {facultyData.pendingActions.map((item, idx) => (
                      <div
                        key={`action-${idx}-${item.record_code}`}
                        style={{
                          padding: '1rem',
                          backgroundColor: item.status === 'Changes Requested' ? '#fffbeb' : 'var(--bg-main)',
                          border: item.status === 'Changes Requested' ? '1.5px solid #fde68a' : '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {item.record_code}
                            </span>
                            <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
                              {item.module}
                            </span>
                            <span className={`badge ${
                              item.status === 'Changes Requested' ? 'badge-purple' :
                              item.status === 'Draft' ? 'badge-slate' : 'badge-amber'
                            }`} style={{ fontSize: '0.7rem' }}>
                              {item.status}
                            </span>
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                            {item.title}
                          </div>
                          {item.review_comments && (
                            <div style={{ padding: '0.45rem 0.75rem', backgroundColor: '#fef3c7', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #d97706', fontSize: '0.8rem', color: '#92400e', marginTop: '0.4rem' }}>
                              <strong>HOD Reviewer Comment:</strong> {item.review_comments}
                            </div>
                          )}
                        </div>

                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            if (item.module === 'Achievement') navigate('/student-achievements');
                            else if (item.module === 'Activity') navigate('/activities');
                            else if (item.module === 'Event') navigate('/events');
                            else if (item.module === 'Placement') navigate('/placements');
                            else if (item.module === 'Research' || item.module === 'Project') navigate('/research-projects');
                            else navigate('/student-achievements');
                          }}
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          {item.status === 'Changes Requested' ? '✏️ Edit & Resubmit' : 'Continue Editing →'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.25rem' }}>🎉</span>
                    <p style={{ fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>No Pending Actions</p>
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>All your submissions are either approved or in queue for HOD review. No changes requested.</p>
                  </div>
                )}

                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🔒</span>
                  <span><strong>Security Notice:</strong> Faculty members do not have approval permissions. All entries are reviewed by Department HOD or Institute Admin.</span>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION D: MY STUDENTS & SMART STUDENT SEARCH (Section 3 & 12) */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🔍</span> Department Students & Smart Search
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Authorized student lookup for {facultyData?.departmentStudents?.department || effectiveDept} ({facultyData?.departmentStudents?.active || 0} Active Enrolled)
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/students')}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    Open Student Directory →
                  </button>
                </div>

                {/* Smart Search Bar */}
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Type student name or register number (e.g., Jaya Prakash or CSE-2022-001)..."
                      value={studentSearchQuery}
                      onChange={(e) => handleStudentSearch(e.target.value)}
                      style={{ fontSize: '0.88rem', padding: '0.6rem 0.85rem' }}
                    />
                    {studentSearchQuery && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => { setStudentSearchQuery(''); setStudentSearchResults([]); setSelectedStudent(null); }}
                        style={{ padding: '0.5rem 0.75rem' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {searchingStudents && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Searching department database...
                    </div>
                  )}

                  {/* Suggestion Dropdown (Max 5 results) */}
                  {studentSearchResults.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-main)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        Top Matching Students (Max 5 Suggestions)
                      </div>
                      {studentSearchResults.map((st) => (
                        <div
                          key={`sug-${st.id}`}
                          onClick={() => setSelectedStudent(st)}
                          style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: selectedStudent?.id === st.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>{st.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Reg: <strong style={{ color: 'var(--primary)' }}>{st.register_no}</strong> &bull; Dept: {st.department} &bull; Year {st.current_year || 1} {st.section ? `(Sec ${st.section})` : ''}
                            </div>
                          </div>
                          <span className={`badge ${st.status === 'Active' || !st.status ? 'badge-green' : 'badge-slate'}`} style={{ fontSize: '0.7rem' }}>
                            {st.status || 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Student Card */}
                {selectedStudent && (
                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Selected Student Profile</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{selectedStudent.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Register No: <strong>{selectedStudent.register_no}</strong> &bull; Email: {selectedStudent.email || 'N/A'} &bull; Status: <strong>{selectedStudent.status || 'Active'}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate('/student-achievements')}
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        🏆 Submit Achievement
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION E: MODULAR SUBMISSIONS BREAKDOWN (Sections 8, 9, 10, 11) */}
              {/* -------------------------------------------------- */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📦</span> Module Contributions Breakdown
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Personal submission portfolio for {facultyData?.academic_year || academicYear}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  
                  {/* 1. Student Achievements */}
                  <div className="content-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🏆</span>
                        <span className="badge badge-blue">Student Awards</span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>Student Achievements</h4>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        <span>Approved: <strong style={{ color: 'var(--success)' }}>{facultyData?.modules?.achievements?.approved || 0}</strong></span>
                        <span>Pending: <strong style={{ color: 'var(--warning)' }}>{facultyData?.modules?.achievements?.pending || 0}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>Changes: <strong style={{ color: 'var(--purple)' }}>{facultyData?.modules?.achievements?.changesRequested || 0}</strong></span>
                        <span>Drafts: <strong>{facultyData?.modules?.achievements?.draft || 0}</strong></span>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                      <button className="btn btn-secondary" onClick={() => navigate('/student-achievements')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
                      <button className="btn btn-primary" onClick={() => navigate('/student-achievements')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>+ Add</button>
                    </div>
                  </div>

                  {/* 2. Department Activities */}
                  <div className="content-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📅</span>
                        <span className="badge badge-teal">Activities</span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>Department Activities</h4>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        <span>Approved: <strong style={{ color: 'var(--success)' }}>{facultyData?.modules?.activities?.approved || 0}</strong></span>
                        <span>Pending: <strong style={{ color: 'var(--warning)' }}>{facultyData?.modules?.activities?.pending || 0}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>Changes: <strong style={{ color: 'var(--purple)' }}>{facultyData?.modules?.activities?.changesRequested || 0}</strong></span>
                        <span>Drafts: <strong>{facultyData?.modules?.activities?.draft || 0}</strong></span>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                      <button className="btn btn-secondary" onClick={() => navigate('/activities')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
                      <button className="btn btn-primary" onClick={() => navigate('/activities')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>+ Add</button>
                    </div>
                  </div>

                  {/* 3. Events & Conferences */}
                  <div className="content-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🎪</span>
                        <span className="badge badge-purple">Events</span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>Events & Conferences</h4>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        <span>Approved: <strong style={{ color: 'var(--success)' }}>{facultyData?.modules?.events?.approved || 0}</strong></span>
                        <span>Pending: <strong style={{ color: 'var(--warning)' }}>{facultyData?.modules?.events?.pending || 0}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>Changes: <strong style={{ color: 'var(--purple)' }}>{facultyData?.modules?.events?.changesRequested || 0}</strong></span>
                        <span>Drafts: <strong>{facultyData?.modules?.events?.draft || 0}</strong></span>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                      <button className="btn btn-secondary" onClick={() => navigate('/events')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
                      <button className="btn btn-primary" onClick={() => navigate('/events')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>+ Add</button>
                    </div>
                  </div>

                  {/* 4. Research & Projects */}
                  <div className="content-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔬</span>
                        <span className="badge badge-purple">Research</span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>Research & Projects</h4>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        <span>Pubs: <strong style={{ color: 'var(--primary)' }}>{facultyData?.modules?.researchProjects?.approvedResearch || 0}</strong></span>
                        <span>Projects: <strong style={{ color: 'var(--teal)' }}>{facultyData?.modules?.researchProjects?.approvedProjects || 0}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>Pending: <strong style={{ color: 'var(--warning)' }}>{(facultyData?.modules?.researchProjects?.pendingResearch || 0) + (facultyData?.modules?.researchProjects?.pendingProjects || 0)}</strong></span>
                        <span>Revisions: <strong style={{ color: 'var(--purple)' }}>{(facultyData?.modules?.researchProjects?.changesResearch || 0) + (facultyData?.modules?.researchProjects?.changesProjects || 0)}</strong></span>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                      <button className="btn btn-secondary" onClick={() => navigate('/research-projects')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
                      <button className="btn btn-primary" onClick={() => navigate('/research-projects')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>+ Add</button>
                    </div>
                  </div>

                  {/* 5. Placement Contribution */}
                  <div className="content-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>💼</span>
                        <span className="badge badge-green">Placements</span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>Placement Contributions</h4>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        <span>Total Contributed: <strong style={{ color: 'var(--primary)' }}>{facultyData?.modules?.placements?.totalContributed || 0}</strong></span>
                        <span>Approved: <strong style={{ color: 'var(--success)' }}>{facultyData?.modules?.placements?.approved || 0}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>Pending: <strong style={{ color: 'var(--warning)' }}>{facultyData?.modules?.placements?.pending || 0}</strong></span>
                        <span>Revisions: <strong style={{ color: 'var(--purple)' }}>{facultyData?.modules?.placements?.changesRequested || 0}</strong></span>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                      <button className="btn btn-secondary" onClick={() => navigate('/placements')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
                      <button className="btn btn-primary" onClick={() => navigate('/placements')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>+ Add</button>
                    </div>
                  </div>

                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION F: RECENT SUBMISSIONS TABLE (Section 7) */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>📋</span> Recent Submissions Stream
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Latest records submitted by you across all 7 reporting categories
                    </p>
                  </div>
                  <span className="badge badge-slate" style={{ fontSize: '0.8rem' }}>
                    Showing {facultyData?.recentSubmissions?.length || 0} Recent Records
                  </span>
                </div>

                {facultyData?.recentSubmissions && facultyData.recentSubmissions.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Module</th>
                          <th>Record Title / Detail</th>
                          <th>Academic Year</th>
                          <th>Submitted On</th>
                          <th>Status</th>
                          <th>Comments</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facultyData.recentSubmissions.map((rec, idx) => (
                          <tr key={`frec-${idx}-${rec.record_code}`}>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {rec.record_code}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${
                                rec.module === 'Achievement' ? 'badge-blue' :
                                rec.module === 'Activity' ? 'badge-teal' :
                                rec.module === 'Event' ? 'badge-purple' :
                                rec.module === 'Placement' ? 'badge-green' :
                                rec.module === 'Research' ? 'badge-purple' :
                                rec.module === 'Project' ? 'badge-blue' : 'badge-amber'
                              }`} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                {rec.module}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.title}>
                              {rec.title}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {rec.academic_year}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : 'Recent'}
                            </td>
                            <td>
                              <span className={`badge ${
                                rec.status === 'Approved' ? 'badge-green' :
                                rec.status === 'Pending Approval' ? 'badge-orange' :
                                rec.status === 'Changes Requested' ? 'badge-purple' :
                                rec.status === 'Draft' ? 'badge-slate' : 'badge-amber'
                              }`} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                {rec.status}
                              </span>
                            </td>
                            <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: rec.review_comments ? '#b45309' : 'var(--text-secondary)' }} title={rec.review_comments || 'No comments'}>
                              {rec.review_comments || '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  if (rec.module === 'Achievement') navigate('/student-achievements');
                                  else if (rec.module === 'Activity') navigate('/activities');
                                  else if (rec.module === 'Event') navigate('/events');
                                  else if (rec.module === 'Placement') navigate('/placements');
                                  else if (rec.module === 'Research' || rec.module === 'Project') navigate('/research-projects');
                                  else navigate('/student-achievements');
                                }}
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                              >
                                View / Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                    No submissions found for {academicYear}. Use the buttons above to log new achievements or activities.
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION G: QUICK ACTIONS (Section 14) */}
              {/* -------------------------------------------------- */}
              <div className="quick-nav-section">
                <div className="section-title">
                  <span>Quick Actions: Submit & Contribute</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Entries are submitted for HOD departmental verification
                  </span>
                </div>

                <div className="quick-nav-grid">
                  <div className="quick-nav-card" onClick={() => navigate('/student-achievements')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🏆</span>
                        <span className="badge badge-purple">Submit</span>
                      </div>
                      <h4>Submit Student Achievement</h4>
                      <p>Log student hackathons, competitions, awards, sports, or external certifications.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Achievement</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/activities')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📅</span>
                        <span className="badge badge-teal">Submit</span>
                      </div>
                      <h4>Submit Department Activity</h4>
                      <p>Document technical workshops, seminars, guest lectures, FDPs, or industrial visits.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Activity</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/events')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🎪</span>
                        <span className="badge badge-purple">Event</span>
                      </div>
                      <h4>Submit Department Event</h4>
                      <p>Organize conferences, guest symposiums, competitions with linked student rosters.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Event</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/placements')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>💼</span>
                        <span className="badge badge-green">Record</span>
                      </div>
                      <h4>Enter Placement Record</h4>
                      <p>Contribute student recruitment outcomes, compensation packages, and employer data.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Placement</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/research-projects')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔬</span>
                        <span className="badge badge-purple">Research</span>
                      </div>
                      <h4>Submit Research & Projects</h4>
                      <p>Log journal publications, conference proceedings, patents, and sponsored grants.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Research</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/students')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>👥</span>
                        <span className="badge badge-blue">Directory</span>
                      </div>
                      <h4>Department Students</h4>
                      <p>Browse active enrolled students in {facultyData?.faculty?.department || effectiveDept}.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>View Students</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/report-builder')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📄</span>
                        <span className="badge badge-slate">Preview</span>
                      </div>
                      <h4>Department Report Preview</h4>
                      <p>Preview verified departmental annual report compiled from approved submissions.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Preview Report</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION H: REPORT BUILDER AUTHORIZATION NOTICE (Section 15) */}
              {/* -------------------------------------------------- */}
              <div
                className="content-card"
                style={{
                  padding: '1.25rem 1.75rem',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>📑</span> Institutional Annual Report Compilation Authority
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '650px' }}>
                    Official college-wide Annual Reports are compiled and published under institutional authority by the HOD and Institutional Administrator. Only verified and Approved submissions are included in official outputs.
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate('/report-builder')}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', fontWeight: 600 }}
                >
                  View Department Report Builder →
                </button>
              </div>

            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. MODULE 13: HOD DASHBOARD — DEPARTMENT OVERVIEW */}
      {/* ---------------------------------------------------- */}
      {isHOD && (
        <>
          {hodLoading && !hodData ? (
            <div className="content-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Loading Department Dashboard Analytics...</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aggregating live department metrics for Academic Year {academicYear}</p>
            </div>
          ) : hodError ? (
            <div className="content-card" style={{ padding: '2rem', textAlign: 'center', border: '1.5px solid var(--danger)' }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
              <h3 style={{ color: 'var(--danger)', margin: '0.75rem 0 0.5rem 0' }}>Failed to Load HOD Dashboard</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{hodError}</p>
              <button className="btn btn-primary" onClick={fetchHODData}>Retry Connection</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              {/* -------------------------------------------------- */}
              {/* SECTION A: DEPARTMENT IDENTITY & STATUS HEADER */}
              {/* -------------------------------------------------- */}
              <div
                className="content-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
                  border: '1.5px solid rgba(13, 148, 136, 0.25)',
                  padding: '1.25rem 1.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1.25rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
                    <span className="badge badge-teal" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                      CODE: {hodData?.department?.code || 'DEPT'}
                    </span>
                    <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                      {hodData?.department?.status || 'Active Department'}
                    </span>
                    {hodData?.department?.established_year && (
                      <span className="badge badge-slate">
                        Est. {hodData.department.established_year}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.35rem 0' }}>
                    {hodData?.department?.name || effectiveDept}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Head of Department: <strong style={{ color: 'var(--primary)' }}>{hodData?.department?.hod || user?.name || 'Assigned HOD'}</strong> &bull; Showing department-scoped records for <strong style={{ color: 'var(--text-main)' }}>{hodData?.academic_year || academicYear}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/report-builder')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    <span>📑</span> Department Report
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/approvals')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    <span>✍️</span> Review Submissions ({hodData?.approvalSummary?.totalPending || 0})
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION B: DEPARTMENT KEY PERFORMANCE INDICATORS */}
              {/* -------------------------------------------------- */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📊</span> Department Performance Indicators ({hodData?.academic_year || academicYear})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Live database metrics &bull; Verified departmental records
                  </span>
                </div>

                <div className="dashboard-grid">
                  <SummaryCard
                    title="Department Students"
                    value={hodData?.kpis?.students?.total || 0}
                    subtitle={`${hodData?.kpis?.students?.active || 0} Active Enrolled`}
                    icon="👥"
                    color="blue"
                    onClick={() => navigate('/students')}
                  />
                  <SummaryCard
                    title="Department Faculty"
                    value={hodData?.kpis?.faculty?.total || 0}
                    subtitle={`${hodData?.kpis?.faculty?.active || 0} Active Faculty`}
                    icon="👨‍🏫"
                    color="purple"
                    onClick={() => navigate('/faculty-info')}
                  />
                  <SummaryCard
                    title="Student Achievements"
                    value={hodData?.kpis?.achievements?.approved || 0}
                    subtitle={`${hodData?.kpis?.achievements?.pending || 0} Pending Verification`}
                    icon="🏆"
                    color={hodData?.kpis?.achievements?.pending > 0 ? "orange" : "teal"}
                    onClick={() => navigate('/student-achievements')}
                  />
                  <SummaryCard
                    title="Department Activities"
                    value={hodData?.kpis?.activities?.approved || 0}
                    subtitle={`${hodData?.kpis?.activities?.pending || 0} Pending Verification`}
                    icon="📅"
                    color={hodData?.kpis?.activities?.pending > 0 ? "orange" : "teal"}
                    onClick={() => navigate('/activities')}
                  />
                  <SummaryCard
                    title="Events & Conferences"
                    value={hodData?.kpis?.events?.approved || 0}
                    subtitle={`${hodData?.kpis?.events?.pending || 0} Pending Verification`}
                    icon="🎪"
                    color={hodData?.kpis?.events?.pending > 0 ? "orange" : "purple"}
                    onClick={() => navigate('/events')}
                  />
                  <SummaryCard
                    title="Campus Placements"
                    value={`${hodData?.kpis?.placement?.placedStudents || 0} Placed`}
                    subtitle={`${hodData?.kpis?.placement?.placementPercentage || 0}% Rate • Top: ₹${hodData?.kpis?.placement?.highestPackage || 0} LPA`}
                    icon="💼"
                    color="green"
                    onClick={() => navigate('/placements')}
                  />
                  <SummaryCard
                    title="Research & Projects"
                    value={hodData?.kpis?.research?.total || 0}
                    subtitle={`${hodData?.kpis?.research?.publications || 0} Pubs • ${hodData?.kpis?.research?.projects || 0} Projects`}
                    icon="🔬"
                    color="purple"
                    onClick={() => navigate('/research-projects')}
                  />
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION C: PENDING APPROVAL QUEUE & APPROVAL SUMMARY */}
              {/* -------------------------------------------------- */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. Pending Approvals Queue requiring HOD Action */}
                <div className="content-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>✍️</span> Submissions Requiring HOD Action
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Department entries awaiting verification</p>
                    </div>
                    <span className={`badge ${hodData?.approvalSummary?.totalPending > 0 ? 'badge-orange' : 'badge-green'}`} style={{ fontSize: '0.85rem' }}>
                      {hodData?.approvalSummary?.totalPending || 0} Pending
                    </span>
                  </div>

                  {hodData?.pendingQueue && hodData.pendingQueue.length > 0 ? (
                    <div style={{ overflowX: 'auto', flex: 1 }}>
                      <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Title / Student</th>
                            <th>Submitted By</th>
                            <th>Date</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hodData.pendingQueue.map((item, idx) => (
                            <tr key={`pend-${idx}-${item.record_code}`}>
                              <td>
                                <span className={`badge ${
                                  item.record_type === 'Achievement' ? 'badge-blue' :
                                  item.record_type === 'Activity' ? 'badge-teal' :
                                  item.record_type === 'Event' ? 'badge-purple' :
                                  item.record_type === 'Placement' ? 'badge-green' : 'badge-slate'
                                }`} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                  {item.record_type}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                                {item.title}
                              </td>
                              <td style={{ color: 'var(--text-secondary)' }}>
                                {item.submitted_by}
                              </td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => navigate('/approvals')}
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', margin: 'auto 0' }}>
                      <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🎉</span>
                      <p style={{ fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>No Pending Verifications</p>
                      <p style={{ fontSize: '0.8rem', margin: 0 }}>All submitted department entries have been reviewed and processed.</p>
                    </div>
                  )}

                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate('/approvals')}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Open Full Approval Center ({hodData?.approvalSummary?.totalPending || 0}) →
                    </button>
                  </div>
                </div>

                {/* 2. Department Data Completeness & Report Readiness */}
                <div className="content-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📋</span> Department Report Readiness
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pre-compilation data completeness checklist</p>
                    </div>
                    <span className="badge badge-teal" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {hodData?.reportReadiness?.percentage || 0}% Complete
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                      <span>{hodData?.reportReadiness?.completedCount || 0} of {hodData?.reportReadiness?.totalSections || 9} Sections Verified</span>
                      <strong style={{ color: 'var(--primary)' }}>{hodData?.reportReadiness?.percentage || 0}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${hodData?.reportReadiness?.percentage || 0}%`,
                          height: '100%',
                          backgroundColor: (hodData?.reportReadiness?.percentage || 0) >= 80 ? 'var(--success)' : (hodData?.reportReadiness?.percentage || 0) >= 50 ? 'var(--warning)' : 'var(--primary)',
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>

                  {/* 9-Point Readiness Checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
                    {hodData?.reportReadiness?.checks?.map((chk, idx) => (
                      <div
                        key={`chk-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.75rem',
                          backgroundColor: 'var(--bg-main)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem'
                        }}
                      >
                        <span style={{ color: 'var(--text-main)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{chk.status === 'Complete' ? '✅' : chk.status === 'Requires Review' ? '⚠️' : chk.status === 'Pending' ? '⏳' : '❌'}</span>
                          {chk.section}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            ({chk.count} records)
                          </span>
                          <span className={`badge ${
                            chk.status === 'Complete' ? 'badge-green' :
                            chk.status === 'Requires Review' ? 'badge-orange' :
                            chk.status === 'Pending' ? 'badge-amber' : 'badge-slate'
                          }`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                            {chk.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate('/report-builder')}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Open Annual Report Builder →
                    </button>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION D: APPROVAL STATUS SUMMARY PILLS */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.25rem 1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⚖️</span> Department Submission Lifecycle Status
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    All 7 reporting categories combined for Academic Year {academicYear}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                  <div
                    onClick={() => navigate('/approvals')}
                    style={{ padding: '1rem', backgroundColor: '#fffbeb', borderRadius: 'var(--radius-md)', border: '1.5px solid #fde68a', cursor: 'pointer', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>Pending Review</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b45309', marginTop: '0.2rem' }}>
                      {hodData?.approvalSummary?.totalPending || 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '0.2rem' }}>Awaiting HOD sign-off</div>
                  </div>

                  <div
                    onClick={() => navigate('/approvals')}
                    style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: 'var(--radius-md)', border: '1.5px solid #bbf7d0', cursor: 'pointer', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>Approved Records</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                      {hodData?.approvalSummary?.totalApproved || 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '0.2rem' }}>Included in Annual Report</div>
                  </div>

                  <div
                    onClick={() => navigate('/approvals')}
                    style={{ padding: '1rem', backgroundColor: '#faf5ff', borderRadius: 'var(--radius-md)', border: '1.5px solid #e9d5ff', cursor: 'pointer', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#7e22ce', fontWeight: 700, textTransform: 'uppercase' }}>Changes Requested</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7e22ce', marginTop: '0.2rem' }}>
                      {hodData?.approvalSummary?.changesRequested || 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9333ea', marginTop: '0.2rem' }}>Sent back for revision</div>
                  </div>

                  <div
                    onClick={() => navigate('/approvals')}
                    style={{ padding: '1rem', backgroundColor: '#f0fdfa', borderRadius: 'var(--radius-md)', border: '1.5px solid #99f6e4', cursor: 'pointer', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>Resubmitted</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f766e', marginTop: '0.2rem' }}>
                      {hodData?.approvalSummary?.resubmitted || 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#14b8a6', marginTop: '0.2rem' }}>Revised by submitters</div>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION E: PLACEMENT ANALYTICS & RESEARCH/PROJECTS */}
              {/* -------------------------------------------------- */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. Placement Summary (Module 8 & Admin consistent) */}
                <div className="content-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>💼</span> Campus Placement Summary
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Calculated placement metrics for Academic Year {academicYear}</p>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate('/placements')}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    >
                      Manage Placements →
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Eligible Students</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {hodData?.placementAnalytics?.eligibleStudents || 0}
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Placed Students</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.2rem' }}>
                        {hodData?.placementAnalytics?.totalPlaced || 0}
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Placement Rate</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.2rem' }}>
                        {hodData?.placementAnalytics?.placementPercentage || 0}%
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Highest Package</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        ₹{hodData?.placementAnalytics?.highestPackage || 0} LPA
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Average Package</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        ₹{hodData?.placementAnalytics?.averagePackage || 0} LPA
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Recruiters / Offers</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {hodData?.placementAnalytics?.uniqueCompanies || 0} / {hodData?.placementAnalytics?.totalOffers || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Research & Funded Projects Summary */}
                <div className="content-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🔬</span> Research & Projects Overview
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Faculty publications & sponsored research</p>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate('/research-projects')}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    >
                      View Research →
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Approved Pubs</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {hodData?.researchProjectsSummary?.approvedPublications || 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({hodData?.researchProjectsSummary?.pendingPublications || 0} pending)</div>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Approved Projects</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {hodData?.researchProjectsSummary?.approvedProjects || 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({hodData?.researchProjectsSummary?.pendingProjects || 0} pending)</div>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Funded Projects</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.2rem' }}>
                        {hodData?.researchProjectsSummary?.fundedProjectsCount || 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>₹{((hodData?.researchProjectsSummary?.totalFundingAmount || 0) / 100000).toFixed(1)}L Total</div>
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Award-Winning / Recognized Research Projects:
                    </span>
                    <span className="badge badge-purple" style={{ fontWeight: 700 }}>
                      {hodData?.researchProjectsSummary?.awardProjectsCount || 0} Projects
                    </span>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION F: ACHIEVEMENTS & ACTIVITIES SUMMARY */}
              {/* -------------------------------------------------- */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. Student Achievements Summary */}
                <div className="content-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                      <span>🏆</span> Student Achievements
                    </h5>
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate('/student-achievements')}
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    >
                      View All →
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                    <span>Approved: <strong style={{ color: 'var(--success)' }}>{hodData?.achievementsSummary?.approved || 0}</strong></span>
                    <span>Pending: <strong style={{ color: 'var(--warning)' }}>{hodData?.achievementsSummary?.pending || 0}</strong></span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {hodData?.achievementsSummary?.categories && hodData.achievementsSummary.categories.length > 0 ? (
                      hodData.achievementsSummary.categories.map((cat, idx) => (
                        <span key={`ach-cat-${idx}`} className="badge badge-slate" style={{ fontSize: '0.72rem' }}>
                          {cat.category}: <strong>{cat.count}</strong>
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No category records for this year</span>
                    )}
                  </div>
                </div>

                {/* 2. Department Activities Summary */}
                <div className="content-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                      <span>📅</span> Department Activities
                    </h5>
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate('/activities')}
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    >
                      View All →
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                    <span>Approved: <strong style={{ color: 'var(--success)' }}>{hodData?.activitiesSummary?.approved || 0}</strong></span>
                    <span>Pending: <strong style={{ color: 'var(--warning)' }}>{hodData?.activitiesSummary?.pending || 0}</strong></span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {hodData?.activitiesSummary?.categories && hodData.activitiesSummary.categories.length > 0 ? (
                      hodData.activitiesSummary.categories.map((cat, idx) => (
                        <span key={`act-cat-${idx}`} className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
                          {cat.category}: <strong>{cat.count}</strong>
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No category records for this year</span>
                    )}
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION G: FACULTY OVERVIEW & ROSTER PREVIEW */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>👨‍🏫</span> Department Faculty Overview
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Faculty profiles and designations in {hodData?.department?.name || effectiveDept}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="badge badge-purple" style={{ fontSize: '0.8rem' }}>
                      Total: {hodData?.facultyOverview?.total || 0} Faculty ({hodData?.facultyOverview?.active || 0} Active)
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate('/faculty-info')}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    >
                      Faculty Directory →
                    </button>
                  </div>
                </div>

                {/* Designation Breakdown */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {hodData?.facultyOverview?.designations && hodData.facultyOverview.designations.length > 0 ? (
                    hodData.facultyOverview.designations.map((desig, idx) => (
                      <span key={`desig-${idx}`} className="badge badge-blue" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>
                        {desig.designation}: <strong>{desig.count}</strong>
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No faculty profiles configured</span>
                  )}
                </div>

                {/* Faculty Roster Table */}
                {hodData?.facultyOverview?.roster && hodData.facultyOverview.roster.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Faculty Name</th>
                          <th>Designation</th>
                          <th>Qualification</th>
                          <th>Publications</th>
                          <th>Projects</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hodData.facultyOverview.roster.map((f, idx) => (
                          <tr key={`f-${idx}-${f.id}`}>
                            <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{f.faculty_name}</td>
                            <td><span className="badge badge-slate" style={{ fontSize: '0.72rem' }}>{f.designation}</span></td>
                            <td style={{ color: 'var(--text-secondary)' }}>{f.qualification || 'M.Tech / Ph.D'}</td>
                            <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{f.publications}</td>
                            <td style={{ fontWeight: 600, color: 'var(--teal)' }}>{f.research_projects}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION H: RECENT DEPARTMENT ACTIVITY STREAM */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>⚡</span> Recent Department Activity
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Latest updates across all 7 department modules</p>
                  </div>
                  <span className="badge badge-slate" style={{ fontSize: '0.8rem' }}>
                    Showing {hodData?.recentActivity?.length || 0} Recent Records
                  </span>
                </div>

                {hodData?.recentActivity && hodData.recentActivity.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Module</th>
                          <th>Title / Item</th>
                          <th>Submitted By</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hodData.recentActivity.map((rec, idx) => (
                          <tr key={`rec-${idx}-${rec.record_code}`}>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {rec.record_code}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${
                                rec.record_type === 'Achievement' ? 'badge-blue' :
                                rec.record_type === 'Activity' ? 'badge-teal' :
                                rec.record_type === 'Event' ? 'badge-purple' :
                                rec.record_type === 'Placement' ? 'badge-green' :
                                rec.record_type === 'Research' ? 'badge-purple' :
                                rec.record_type === 'Project' ? 'badge-blue' : 'badge-amber'
                              }`} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                {rec.record_type}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.title}>
                              {rec.title}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {rec.submitted_by}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : 'Recent'}
                            </td>
                            <td>
                              <span className={`badge ${
                                rec.status === 'Approved' ? 'badge-green' :
                                rec.status === 'Pending Approval' ? 'badge-orange' :
                                rec.status === 'Changes Requested' ? 'badge-purple' : 'badge-slate'
                              }`} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                    No recent activity records found for {academicYear}.
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION I: HOD QUICK ACTIONS */}
              {/* -------------------------------------------------- */}
              <div className="quick-nav-section">
                <div className="section-title">
                  <span>HOD Department Quick Actions</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Direct management, submissions, and report tools
                  </span>
                </div>

                <div className="quick-nav-grid">
                  <div
                    className="quick-nav-card"
                    onClick={() => navigate('/approvals')}
                    style={{ border: '2px solid #f59e0b', background: '#fffbeb' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>✍️</span>
                        <span className="badge badge-amber">Verification</span>
                      </div>
                      <h4 style={{ color: '#b45309' }}>Approval Center</h4>
                      <p>Review, approve, or request revisions on faculty submissions across all modules.</p>
                    </div>
                    <div className="card-footer-action" style={{ color: '#b45309' }}>
                      <span>Review Submissions ({hodData?.approvalSummary?.totalPending || 0})</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/student-achievements')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🏆</span>
                        <span className="badge badge-blue">Student</span>
                      </div>
                      <h4>Add Student Achievement</h4>
                      <p>Log hackathons, publications, sports, and technical awards for department students.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Achievement</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/activities')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📅</span>
                        <span className="badge badge-teal">Activity</span>
                      </div>
                      <h4>Add Department Activity</h4>
                      <p>Document workshops, guest lectures, industrial visits, and FDPs conducted.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Activity</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/events')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🎪</span>
                        <span className="badge badge-purple">Event</span>
                      </div>
                      <h4>Add Event / Conference</h4>
                      <p>Organize, approve, and track departmental symposiums, workshops, and tech fests.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Event</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/placements')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>💼</span>
                        <span className="badge badge-green">Placement</span>
                      </div>
                      <h4>Add Placement Record</h4>
                      <p>Record student placement offers, packages, recruiter visits, and offer letters.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Manage Placements</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/research-projects')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔬</span>
                        <span className="badge badge-purple">Research</span>
                      </div>
                      <h4>Add Research / Project</h4>
                      <p>Record journal publications, conferences, book chapters, and sponsored grants.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Add Research</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/report-builder')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📄</span>
                        <span className="badge badge-slate">Compile</span>
                      </div>
                      <h4>Department Report Builder</h4>
                      <p>Preview and compile the verified departmental annual report into official PDF.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Build Report</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. MODULE 12: INSTITUTE ADMIN DASHBOARD VIEW */}
      {/* ---------------------------------------------------- */}
      {isAdmin && (
        <>
          {adminLoading && !adminData ? (
            <div className="content-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Loading Institute Dashboard Analytics...</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aggregating multi-department database statistics for Academic Year {academicYear}</p>
            </div>
          ) : adminError ? (
            <div className="content-card" style={{ padding: '2rem', textAlign: 'center', border: '1.5px solid var(--danger)' }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
              <h3 style={{ color: 'var(--danger)', margin: '0.75rem 0 0.5rem 0' }}>Failed to Load Admin Dashboard</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{adminError}</p>
              <button className="btn btn-primary" onClick={fetchAdminData}>Retry Connection</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              {/* -------------------------------------------------- */}
              {/* SECTION A: MAIN INSTITUTE KPI CARDS (8 Core Metrics) */}
              {/* -------------------------------------------------- */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📊</span> Key Institutional Performance Indicators
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Live database metrics &bull; Official approved counts
                  </span>
                </div>

                <div className="dashboard-grid">
                  <SummaryCard
                    title="Total Students"
                    value={adminData?.kpis?.students?.total || 0}
                    subtitle={`${adminData?.kpis?.students?.active || 0} Active Enrolled`}
                    icon="👥"
                    color="blue"
                    onClick={() => navigate('/students')}
                  />
                  <SummaryCard
                    title="Faculty Members"
                    value={adminData?.kpis?.faculty?.total || 0}
                    subtitle={`${adminData?.kpis?.faculty?.active || 0} Active Faculty`}
                    icon="👨‍🏫"
                    color="purple"
                    onClick={() => navigate('/faculty-info')}
                  />
                  <SummaryCard
                    title="Academic Departments"
                    value={adminData?.kpis?.departments?.total || 0}
                    subtitle={`${adminData?.kpis?.departments?.active || 0} Active Units`}
                    icon="🏛️"
                    color="teal"
                    onClick={() => navigate('/departments')}
                  />
                  <SummaryCard
                    title="Campus Placements"
                    value={`${adminData?.kpis?.placement?.placedStudents || 0} Placed`}
                    subtitle={`${adminData?.kpis?.placement?.placementPercentage || 0}% Rate • Top: ₹${adminData?.kpis?.placement?.highestPackage || 0} LPA`}
                    icon="💼"
                    color="green"
                    onClick={() => navigate('/placements')}
                  />
                  <SummaryCard
                    title="Research & Projects"
                    value={adminData?.kpis?.research?.total || 0}
                    subtitle={`${adminData?.kpis?.research?.publications || 0} Pubs • ${adminData?.kpis?.research?.projects || 0} Projects`}
                    icon="🔬"
                    color="purple"
                    onClick={() => navigate('/research-projects')}
                  />
                  <SummaryCard
                    title="Activities & Events"
                    value={adminData?.kpis?.activities?.total || 0}
                    subtitle={`${adminData?.kpis?.activities?.events || 0} Events • ${adminData?.kpis?.activities?.achievements || 0} Awards`}
                    icon="🏆"
                    color="orange"
                    onClick={() => navigate('/events')}
                  />
                  <SummaryCard
                    title="Approval Pipeline"
                    value={adminData?.approvalMonitoring?.totalPending || 0}
                    subtitle={`${adminData?.approvalMonitoring?.changesRequested || 0} Changes Requested`}
                    icon="⚖️"
                    color={adminData?.approvalMonitoring?.totalPending > 0 ? "orange" : "green"}
                    onClick={() => navigate('/approvals')}
                  />
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION B: APPROVAL MONITORING & ANNUAL REPORT PROGRESS */}
              {/* -------------------------------------------------- */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. Approval Center Status Widget */}
                <div className="content-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>⚖️</span> Submissions & Approvals Pipeline
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Central verification status across all 6 reporting modules</p>
                    </div>
                    <span className={`badge ${adminData?.approvalMonitoring?.totalPending > 0 ? 'badge-orange' : 'badge-green'}`} style={{ fontSize: '0.85rem' }}>
                      {adminData?.approvalMonitoring?.totalPending || 0} Pending
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div 
                      onClick={() => navigate('/approvals')}
                      style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Achievements</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: adminData?.approvalMonitoring?.pendingAchievements > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                        {adminData?.approvalMonitoring?.pendingAchievements || 0}
                      </div>
                    </div>

                    <div 
                      onClick={() => navigate('/approvals')}
                      style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Activities</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: adminData?.approvalMonitoring?.pendingActivities > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                        {adminData?.approvalMonitoring?.pendingActivities || 0}
                      </div>
                    </div>

                    <div 
                      onClick={() => navigate('/approvals')}
                      style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Events</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: adminData?.approvalMonitoring?.pendingEvents > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                        {adminData?.approvalMonitoring?.pendingEvents || 0}
                      </div>
                    </div>

                    <div 
                      onClick={() => navigate('/approvals')}
                      style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Placements</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: adminData?.approvalMonitoring?.pendingPlacements > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                        {adminData?.approvalMonitoring?.pendingPlacements || 0}
                      </div>
                    </div>

                    <div 
                      onClick={() => navigate('/approvals')}
                      style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Research</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: adminData?.approvalMonitoring?.pendingResearch > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                        {adminData?.approvalMonitoring?.pendingResearch || 0}
                      </div>
                    </div>

                    <div 
                      onClick={() => navigate('/approvals')}
                      style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Projects</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: adminData?.approvalMonitoring?.pendingProjects > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                        {adminData?.approvalMonitoring?.pendingProjects || 0}
                      </div>
                    </div>

                    <div 
                      onClick={() => navigate('/approvals')}
                      style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Changes Req.</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: adminData?.approvalMonitoring?.changesRequested > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                        {adminData?.approvalMonitoring?.changesRequested || 0}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate('/approvals')}
                  >
                    Open Central Approval Center →
                  </button>
                </div>

                {/* 2. Annual Report Readiness & Progress Widget */}
                <div className="content-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📑</span> Annual Report Progress — AY {academicYear}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Calculated readiness from verified departmental datasets</p>
                    </div>
                    <span className="badge badge-purple" style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                      {adminData?.annualReportProgress?.completionPercentage || 0}% Ready
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '999px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                    <div 
                      style={{
                        width: `${adminData?.annualReportProgress?.completionPercentage || 0}%`,
                        height: '100%',
                        background: 'var(--accent-gradient)',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Participating Departments</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        {adminData?.annualReportProgress?.departmentsWithData || 0} / {adminData?.annualReportProgress?.totalActiveDepartments || 0}
                      </strong>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Verified Sections</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        {adminData?.annualReportProgress?.sectionsWithData?.length || 0} / 8 Complete
                      </strong>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Total Approved Records</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--success)' }}>
                        {adminData?.annualReportProgress?.totalApprovedRecords || 0}
                      </strong>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Stored PDF Reports</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                        {adminData?.annualReportProgress?.reportsGenerated || 0} Archived
                      </strong>
                    </div>
                  </div>

                  {/* Section Coverage Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                    {(adminData?.annualReportProgress?.sectionsWithData || []).map((sec, i) => (
                      <span key={i} className="badge badge-teal" style={{ fontSize: '0.75rem' }}>
                        ✓ {sec}
                      </span>
                    ))}
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate('/report-builder')}
                  >
                    Open Annual Report Builder →
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION C: PLACEMENT ANALYTICS & DEPARTMENT COMPARISON */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>💼</span> Campus Placement Analytics & Department Comparison
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Synchronized placement rates, package distributions, and recruiter footprint for AY {academicYear}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => navigate('/placements')}>
                    Manage Placements →
                  </button>
                </div>

                {/* Placement KPI Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Placed</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{adminData?.placementAnalytics?.totalPlaced || 0}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>out of {adminData?.placementAnalytics?.eligibleStudents || 0} eligible</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--success)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Placement Rate</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)' }}>{adminData?.placementAnalytics?.placementPercentage || 0}%</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>eligible student ratio</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #8b5cf6' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Highest Package</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>₹{adminData?.placementAnalytics?.highestPackage || 0} LPA</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>peak offer recorded</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #06b6d4' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Average Package</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>₹{adminData?.placementAnalytics?.averagePackage || 0} LPA</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mean compensation</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #f59e0b' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Offers</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{adminData?.placementAnalytics?.totalOffers || 0}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>cumulative offer letters</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #ec4899' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unique Companies</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{adminData?.placementAnalytics?.uniqueCompanies || 0}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>recruiting partners</span>
                  </div>
                </div>

                {/* Department-Wise Placement Comparison Table */}
                <h5 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                  Department-Wise Placement Performance Breakdown
                </h5>

                {(!adminData?.departmentPlacementComparison || adminData.departmentPlacementComparison.length === 0) ? (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                    No approved placement data available for this academic year ({academicYear}).
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Eligible</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Placed</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Placement Rate</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Highest Package</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Average Package</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Offers</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Companies</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.departmentPlacementComparison.map((d) => (
                          <tr key={d.department_id || d.department} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                              {d.department} <span className="badge badge-slate" style={{ fontSize: '0.7rem', marginLeft: '0.3rem' }}>{d.code}</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>{d.eligible_students}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{d.students_placed}</td>
                            <td style={{ padding: '0.75rem 1rem', width: '200px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div 
                                    style={{ 
                                      width: `${Math.min(100, d.placement_percentage || 0)}%`, 
                                      height: '100%', 
                                      backgroundColor: d.placement_percentage >= 70 ? 'var(--success)' : d.placement_percentage >= 40 ? 'var(--warning)' : 'var(--primary)' 
                                    }} 
                                  />
                                </div>
                                <span style={{ fontWeight: 600, minWidth: '45px' }}>{d.placement_percentage}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>₹{d.highest_package} LPA</td>
                            <td style={{ padding: '0.75rem 1rem' }}>₹{d.average_package} LPA</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{d.number_of_offers}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{d.number_of_companies}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION D: RESEARCH, INNOVATION & PROJECTS */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🔬</span> Research Publications, Projects & Grant Funding
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Approved scholarly papers, sponsored research grants, and student innovations (Module 10)
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => navigate('/research-projects')}>
                    Manage Research & Projects →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderTop: '3px solid #6366f1' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Approved Publications</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{adminData?.researchProjectsSummary?.totalApprovedPublications || 0}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>journals & conferences</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderTop: '3px solid #3b82f6' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Approved Projects</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{adminData?.researchProjectsSummary?.totalApprovedProjects || 0}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>innovations & Capstones</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderTop: '3px solid #10b981' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Funded Projects</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)' }}>{adminData?.researchProjectsSummary?.fundedProjectsCount || 0}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>sponsored research grants</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderTop: '3px solid #f59e0b' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Grant Funding</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>₹{(adminData?.researchProjectsSummary?.totalFundingAmount || 0).toLocaleString('en-IN')}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>cumulative funding received</span>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderTop: '3px solid #ec4899' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Award-Winning Projects</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{adminData?.researchProjectsSummary?.awardProjectsCount || 0}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>competitions & honors</span>
                  </div>
                </div>

                {/* Department-Wise Research Breakdown Table */}
                <h5 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                  Department-Wise Research & Funding Distribution
                </h5>

                {(!adminData?.researchProjectsSummary?.departmentBreakdown || adminData.researchProjectsSummary.departmentBreakdown.length === 0) ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                    No research or project data recorded for this academic year ({academicYear}).
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Approved Publications</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Approved Projects</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Total Grant Funding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.researchProjectsSummary.departmentBreakdown.map((d) => (
                          <tr key={d.department_id || d.department} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                              {d.department} <span className="badge badge-slate" style={{ fontSize: '0.7rem', marginLeft: '0.3rem' }}>{d.code}</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{d.publications}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#8b5cf6' }}>{d.projects}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: d.total_funding > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                              ₹{(d.total_funding || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION E: ACTIVITIES, EVENTS & ACHIEVEMENTS */}
              {/* -------------------------------------------------- */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. Activities & Student Achievements Overview */}
                <div className="content-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🎪</span> Activities, Events & Achievements
                    </h4>
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={() => navigate('/events')}>
                      View Events →
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Achievements</span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warning)' }}>
                        {adminData?.activitiesEventsSummary?.totalApprovedAchievements || 0}
                      </h4>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Activities</span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {adminData?.activitiesEventsSummary?.totalApprovedActivities || 0}
                      </h4>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Conferences/Events</span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8b5cf6' }}>
                        {adminData?.activitiesEventsSummary?.totalApprovedEvents || 0}
                      </h4>
                    </div>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Department</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Achievements</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Activities</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Events</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(adminData?.activitiesEventsSummary?.departmentBreakdown || []).map((d) => (
                          <tr key={d.department_id || d.department} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{d.code}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{d.achievements}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{d.activities}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{d.events}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION F: DEPARTMENT OVERVIEW MASTER TABLE */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🏛️</span> Department-Wise Comprehensive Institute Matrix
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Cross-sectional metrics for all registered academic departments for Academic Year {academicYear}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      value={deptTableFilter}
                      onChange={(e) => setDeptTableFilter(e.target.value)}
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}
                    >
                      <option value="All">All Departments</option>
                      {(adminData?.departmentOverview || []).map((d) => (
                        <option key={d.code} value={d.name}>{d.name}</option>
                      ))}
                    </select>

                    <button className="btn btn-secondary" onClick={() => navigate('/departments')}>
                      Manage Units →
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Code</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Department Name</th>
                        <th style={{ padding: '0.75rem 1rem' }}>HOD</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Students</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Faculty</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Placements</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Research</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Events</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Pending</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(adminData?.departmentOverview || [])
                        .filter((d) => deptTableFilter === 'All' || d.name === deptTableFilter)
                        .map((dept) => (
                          <tr key={dept.id || dept.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{dept.code}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{dept.name}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{dept.hod || 'Unassigned'}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{dept.students}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{dept.faculty}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ fontWeight: 600 }}>{dept.placements}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>({dept.placementPercentage}%)</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>{dept.researchProjects}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{dept.events}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              {dept.pendingApprovals > 0 ? (
                                <span className="badge badge-orange" style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
                                  {dept.pendingApprovals} pending
                                </span>
                              ) : (
                                <span className="badge badge-green">✓ Clear</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge badge-teal">{dept.status}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION G: RECENT ACTIVITY STREAM (All 7 Modules) */}
              {/* -------------------------------------------------- */}
              <div className="content-card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🕒</span> Recent Institutional Activity & Submission Audit Log
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Chronological stream of recent record submissions across all departments and modules
                    </p>
                  </div>
                  <span className="badge badge-purple">Top 15 Events</span>
                </div>

                {(!adminData?.recentActivity || adminData.recentActivity.length === 0) ? (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                    No recent activity recorded for Academic Year {academicYear}.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Record ID</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Title / Record Summary</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Submitted By</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.recentActivity.map((act, idx) => (
                          <tr key={`${act.record_code}-${idx}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                              {act.record_code}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className={`badge ${
                                act.record_type === 'Placement' ? 'badge-green' :
                                act.record_type === 'Research' || act.record_type === 'Project' ? 'badge-purple' :
                                act.record_type === 'Achievement' ? 'badge-orange' : 'badge-blue'
                              }`}>
                                {act.record_type}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {act.title}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                              {act.department}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                              {act.submitted_by}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {act.created_at ? new Date(act.created_at).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className={`badge ${
                                act.status === 'Approved' ? 'badge-green' :
                                act.status === 'Pending Approval' ? 'badge-orange' :
                                act.status === 'Changes Requested' ? 'badge-purple' : 'badge-danger'
                              }`}>
                                {act.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- */}
              {/* SECTION H: ADMIN QUICK ACTIONS */}
              {/* -------------------------------------------------- */}
              <div className="quick-nav-section">
                <div className="section-title">
                  <span>Institutional Administration & Module Navigation</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Direct management shortcuts authorized for Institutional Administrator
                  </span>
                </div>

                <div className="quick-nav-grid">
                  <div className="quick-nav-card" onClick={() => navigate('/departments')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🏢</span>
                        <span className="badge badge-teal">Module 2</span>
                      </div>
                      <h4>Manage Departments</h4>
                      <p>Configure academic departments, assign HOD leadership, and faculty rosters.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Departments</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/students')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>👥</span>
                        <span className="badge badge-blue">Module 3</span>
                      </div>
                      <h4>Manage Students</h4>
                      <p>Student registry directory, enrollments, smart search, and status tracking.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Students</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/faculty-info')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>👨‍🏫</span>
                        <span className="badge badge-purple">Module 5</span>
                      </div>
                      <h4>Manage Faculty</h4>
                      <p>Faculty credentials, research projects, publications, awards, and conferences.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Faculty</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/student-achievements')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🏆</span>
                        <span className="badge badge-orange">Module 4</span>
                      </div>
                      <h4>Manage Achievements</h4>
                      <p>Student competitive achievements, awards, hackathons, and certifications.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Achievements</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/activities')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📅</span>
                        <span className="badge badge-teal">Module 6</span>
                      </div>
                      <h4>Manage Activities</h4>
                      <p>Department workshops, seminars, guest lectures, FDPs, and industrial visits.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Activities</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/events')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🎪</span>
                        <span className="badge badge-purple">Module 7</span>
                      </div>
                      <h4>Manage Events</h4>
                      <p>Institutional conferences, hackathons, seminars with participant rosters.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Events</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/placements')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>💼</span>
                        <span className="badge badge-green">Module 8</span>
                      </div>
                      <h4>Manage Placements</h4>
                      <p>Placement records, recruiters, package analytics, and rate computations.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Placements</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/research-projects')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔬</span>
                        <span className="badge badge-purple">Module 10</span>
                      </div>
                      <h4>Research & Projects</h4>
                      <p>Publications directory, research papers, grants, and student capstone projects.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Research</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/report-builder')} style={{ border: '1.5px solid var(--primary)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>⚙️</span>
                        <span className="badge badge-blue">Compiler</span>
                      </div>
                      <h4>Report Builder</h4>
                      <p>Compile verified multi-department institutional annual reports to PDF.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Launch Builder</span>
                      <span>→</span>
                    </div>
                  </div>

                  <div className="quick-nav-card" onClick={() => navigate('/generated-reports')}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📥</span>
                        <span className="badge badge-slate">Archive</span>
                      </div>
                      <h4>Generated Reports</h4>
                      <p>View, preview, and download compiled official institutional annual reports.</p>
                    </div>
                    <div className="card-footer-action">
                      <span>Open Archive</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}
