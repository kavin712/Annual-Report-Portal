import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import StudentSearchDropdown from '../components/StudentSearchDropdown';

const ALL_INSTITUTE_SECTIONS = [
  { id: 'Cover Page', label: 'Cover Page', desc: 'Front title page, institute seal emblem, affiliation, accreditation grade, and audit statement' },
  { id: 'Institute Overview', label: 'Institute Overview', desc: 'Executive institutional summary, student/faculty strength, placement KPIs, and research metrics' },
  { id: 'Department-wise Summary', label: 'Department-wise Summary', desc: 'Comparative matrix across all academic departments side-by-side' },
  { id: 'Department Overview', label: 'Department Overview', desc: 'Head of department, vision, courses offered, faculty/student strength and leadership' },
  { id: 'Student Statistics', label: 'Student Statistics', desc: 'Active student demographics, batch distribution, year of study, and section breakdown' },
  { id: 'Faculty Information', label: 'Faculty Information', desc: 'Faculty roster, qualifications, designations, specializations, publications, and grants' },
  { id: 'Student Achievements', label: 'Student Achievements', desc: 'Approved hackathons, awards, technical contests, sports, and research honors' },
  { id: 'Department Activities', label: 'Department Activities', desc: 'Approved workshops, seminars, FDPs, symposiums, and industrial visits' },
  { id: 'Events Management', label: 'Institutional & Departmental Events', desc: 'Approved institutional tech fests, guest lectures, cultural symposiums, and conferences' },
  { id: 'Placement Summary', label: 'Placement Summary', desc: 'Placement percentage, highest/average packages, recruiter statistics, and approved job offers' },
  { id: 'Research & Publications', label: 'Research & Publications', desc: 'Approved journal publications, conference proceedings, patents, and sponsored research' },
  { id: 'Projects & Innovations', label: 'Projects & Innovations', desc: 'Approved academic capstone projects, industry-partnered initiatives, and innovation awards' },
  { id: 'Conclusion', label: 'Conclusion & Signatures', desc: 'Institutional audit certification, accreditation sign-off blocks, and verification endorsement' }
];

const STUDENT_REPORT_SECTIONS = [
  { id: 'Student Profile', label: 'Student Profile & Details', desc: 'Full Name, Register Number, Affiliated Department, Batch, Current Year of Study, Section, and Status' },
  { id: 'Academic Information', label: 'Academic & Curricular Affiliation', desc: 'Enrolment program, department standing, and academic progression summary' },
  { id: 'Placement History', label: 'Placement History & Career Offers', desc: 'Approved recruiting companies, salary packages (LPA), placement status, and job role details' },
  { id: 'Student Achievements', label: 'Student Achievements & Honors', desc: 'Approved hackathons, technical contests, sports, research publications, awards, and dates' },
  { id: 'Department Activities', label: 'Department Activities & Participation', desc: 'Approved departmental workshops, seminars, symposiums, and event contributions' },
  { id: 'Events Participation', label: 'Events Participation & Roles', desc: 'Approved institutional & departmental events where the student participated' },
  { id: 'Research & Publications', label: 'Research & Publications', desc: 'Approved student journal papers, conference proceedings, patents, and research articles' },
  { id: 'Projects & Innovations', label: 'Projects & Innovations', desc: 'Approved capstone engineering projects, team collaborations, industry partners, and awards' }
];

export default function ReportBuilder({
  academicYear,
  setAcademicYear,
  departments,
  academicYears,
  user,
  onConfigureReport
}) {
  const navigate = useNavigate();

  const isHOD = user?.role === 'hod';
  const isFaculty = user?.role === 'faculty';
  const userDept = user?.department || '';

  // Top Mode: Option A (Institute Annual Report) vs Option B (Individual Student History Report)
  const [reportMode, setReportMode] = useState('institute');

  // Option A State: Institute Report
  const [selectedYear, setSelectedYear] = useState(academicYear || '2025-26');
  const [reportTitle, setReportTitle] = useState(`Institute Annual Report ${selectedYear}`);
  const [subtitle, setSubtitle] = useState('Annual Institutional Performance & Accreditation Audit');
  const [selectedDepts, setSelectedDepts] = useState(
    isHOD || isFaculty ? (userDept ? [userDept] : []) : departments.map((d) => d.name)
  );
  const [selectedSections, setSelectedSections] = useState(ALL_INSTITUTE_SECTIONS.map((s) => s.id));
  const [sectionOrder, setSectionOrder] = useState(ALL_INSTITUTE_SECTIONS.map((s) => s.id));

  // Customization & Branding Options
  const [showCustomization, setShowCustomization] = useState(false);
  const [customization, setCustomization] = useState({
    instituteName: 'EXCELLENCE INSTITUTE OF TECHNOLOGY',
    tagline: 'Accredited by NBA & NAAC with A++ Grade | Autonomous Institution',
    address: 'Campus Road, Tech City, Knowledge Park',
    website: 'www.excellence.edu',
    contact: 'info@excellence.edu | +91 98765 43210',
    coverPage: true,
    includeHeader: true,
    includeFooter: true
  });

  // Report Readiness Check State
  const [readiness, setReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  // Instant PDF Generation
  const [instantGenerating, setInstantGenerating] = useState(false);
  const [instantReport, setInstantReport] = useState(null);
  const [error, setError] = useState('');

  // Option B State: Individual Student History Report
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSummary, setStudentSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [studentYear, setStudentYear] = useState('All');
  const [studentStartDate, setStudentStartDate] = useState('');
  const [studentEndDate, setStudentEndDate] = useState('');
  const [selectedStudentSections, setSelectedStudentSections] = useState(
    STUDENT_REPORT_SECTIONS.map((s) => s.id)
  );
  const [generatingStudentPdf, setGeneratingStudentPdf] = useState(false);
  const [generatedStudentReport, setGeneratedStudentReport] = useState(null);
  const [studentError, setStudentError] = useState('');

  // Automatically fetch Report Readiness on configuration changes
  React.useEffect(() => {
    if (reportMode === 'institute' && selectedDepts.length > 0) {
      loadReadiness(selectedYear, selectedDepts);
    }
  }, [selectedYear, selectedDepts, reportMode]);

  const loadReadiness = async (year, depts) => {
    setReadinessLoading(true);
    try {
      const data = await api.getReportReadiness(year, depts);
      setReadiness(data);
    } catch (err) {
      console.warn('Could not load report readiness:', err.message);
    } finally {
      setReadinessLoading(false);
    }
  };

  // ----------------------------------------------------
  // Option A Handlers (Institute Annual Report)
  // ----------------------------------------------------
  const handleYearChange = (e) => {
    const year = e.target.value;
    setSelectedYear(year);
    setAcademicYear(year);
    setReportTitle(`Institute Annual Report ${year}`);
  };

  const handleDeptToggle = (deptName) => {
    if (isHOD || isFaculty) return; // Prevent department tampering
    setSelectedDepts((prev) =>
      prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
    );
    setError('');
  };

  const handleSelectAllDepts = (selectAll) => {
    if (isHOD || isFaculty) return;
    if (selectAll) {
      setSelectedDepts(departments.map((d) => d.name));
    } else {
      setSelectedDepts([]);
    }
  };

  const handleSectionToggle = (sectionId) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((s) => s !== sectionId) : [...prev, sectionId]
    );
    setError('');
  };

  const handleSelectAllSections = (selectAll) => {
    if (selectAll) {
      setSelectedSections(ALL_INSTITUTE_SECTIONS.map((s) => s.id));
    } else {
      setSelectedSections([]);
    }
  };

  const handleMoveSection = (index, direction) => {
    const newOrder = [...sectionOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setSectionOrder(newOrder);
  };

  const buildReportConfig = () => {
    const orderedSections = sectionOrder.filter((s) => selectedSections.includes(s));
    return {
      reportTitle: reportTitle.trim() || `Institute Annual Report ${selectedYear}`,
      academicYear: selectedYear,
      selectedDepartments: selectedDepts,
      selectedSections: selectedSections,
      sectionOrder: orderedSections,
      customization: {
        ...customization,
        subtitle
      }
    };
  };

  const handleGeneratePreview = (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!selectedYear) {
      setError('Academic Year is required.');
      return;
    }
    if (selectedDepts.length === 0) {
      setError('Please select at least one department before generating a report.');
      return;
    }
    if (selectedSections.length === 0) {
      setError('Please select at least one report section to include in the report.');
      return;
    }

    const reportConfig = buildReportConfig();

    if (onConfigureReport) {
      onConfigureReport(reportConfig);
    }

    navigate('/report-preview', { state: { config: reportConfig } });
  };

  const handleInstantPDF = async () => {
    setError('');
    if (!selectedYear || selectedDepts.length === 0 || selectedSections.length === 0) {
      setError('Please configure Academic Year, at least one department, and at least one section.');
      return;
    }

    setInstantGenerating(true);
    try {
      const config = buildReportConfig();
      const res = await api.generateReport(config);
      if (res && res.success && res.report) {
        setInstantReport(res.report);
      } else {
        throw new Error(res.error || 'Failed to generate PDF');
      }
    } catch (err) {
      setError('PDF Generation error: ' + err.message);
    } finally {
      setInstantGenerating(false);
    }
  };

  // ----------------------------------------------------
  // Option B Handlers (Individual Student History Report)
  // ----------------------------------------------------
  const loadStudentSummary = async (studentId, year = studentYear, start = studentStartDate, end = studentEndDate) => {
    if (!studentId) {
      setStudentSummary(null);
      return;
    }
    setSummaryLoading(true);
    try {
      const summary = await api.getStudentReportSummary(studentId, {
        academicYear: year,
        startDate: start,
        endDate: end
      });
      setStudentSummary(summary);
    } catch (err) {
      console.error('Failed to load student report summary:', err);
      setStudentError(err.message || 'Could not load student record summary.');
      setStudentSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setGeneratedStudentReport(null);
    setStudentError('');

    if (student && student.id) {
      loadStudentSummary(student.id, studentYear, studentStartDate, studentEndDate);
    } else {
      setStudentSummary(null);
    }
  };

  const handleStudentYearFilterChange = (newYear) => {
    setStudentYear(newYear);
    if (selectedStudent && selectedStudent.id) {
      loadStudentSummary(selectedStudent.id, newYear, studentStartDate, studentEndDate);
    }
  };

  const handleStudentStartDateChange = (newStart) => {
    setStudentStartDate(newStart);
    if (selectedStudent && selectedStudent.id) {
      loadStudentSummary(selectedStudent.id, studentYear, newStart, studentEndDate);
    }
  };

  const handleStudentEndDateChange = (newEnd) => {
    setStudentEndDate(newEnd);
    if (selectedStudent && selectedStudent.id) {
      loadStudentSummary(selectedStudent.id, studentYear, studentStartDate, newEnd);
    }
  };

  const handleStudentClear = () => {
    setSelectedStudent(null);
    setStudentSummary(null);
    setGeneratedStudentReport(null);
    setStudentError('');
  };

  const handleStudentSectionToggle = (sectionId) => {
    setSelectedStudentSections((prev) =>
      prev.includes(sectionId) ? prev.filter((s) => s !== sectionId) : [...prev, sectionId]
    );
    setStudentError('');
  };

  const handleSelectAllStudentSections = (selectAll) => {
    if (selectAll) {
      setSelectedStudentSections(STUDENT_REPORT_SECTIONS.map((s) => s.id));
    } else {
      setSelectedStudentSections([]);
    }
  };

  const handlePreviewStudentReport = (e) => {
    if (e) e.preventDefault();
    setStudentError('');

    if (!selectedStudent || !selectedStudent.id) {
      setStudentError('Please search and select a verified student from the dropdown first.');
      return;
    }

    if (selectedStudentSections.length === 0) {
      setStudentError('Please select at least one report section to include in the student history PDF.');
      return;
    }

    const reportConfig = {
      reportMode: 'student',
      student_id: selectedStudent.id,
      student: selectedStudent,
      academic_year: studentYear,
      startDate: studentStartDate,
      endDate: studentEndDate,
      selected_sections: selectedStudentSections
    };

    navigate('/report-preview', { state: { config: reportConfig } });
  };

  const handleGenerateStudentPDF = async (e) => {
    if (e) e.preventDefault();
    setStudentError('');
    setGeneratedStudentReport(null);

    if (!selectedStudent || !selectedStudent.id) {
      setStudentError('Please search and select a verified student from the dropdown first.');
      return;
    }

    if (selectedStudentSections.length === 0) {
      setStudentError('Please select at least one report section to include in the student history PDF.');
      return;
    }

    setGeneratingStudentPdf(true);
    try {
      const payload = {
        student_id: selectedStudent.id,
        academic_year: studentYear,
        startDate: studentStartDate,
        endDate: studentEndDate,
        selected_sections: selectedStudentSections
      };

      const res = await api.generateStudentReport(payload);
      if (res && res.success && res.report) {
        setGeneratedStudentReport(res.report);
      } else {
        throw new Error(res.error || 'Failed to generate Student History PDF.');
      }
    } catch (err) {
      console.error('Student PDF generation error:', err);
      setStudentError(err.message || 'Error occurred while generating the student report PDF.');
    } finally {
      setGeneratingStudentPdf(false);
    }
  };

  // Determine user department scope for student search dropdown
  const userDeptScope = user?.role !== 'admin' ? user?.department : '';

  return (
    <div className="content-card">
      {/* Header Bar */}
      <div className="card-header-bar">
        <div>
          <h2>Annual Report Customizer & Builder</h2>
          <p>Generate comprehensive institutional annual reports or tailor individual student history dossiers.</p>
        </div>
        <div>
          <span className="badge badge-purple">Screen 8</span>
        </div>
      </div>

      {/* Two Report Types Segmented Tab Switcher */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          backgroundColor: '#F1F5F9',
          padding: '0.4rem',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '2rem'
        }}
      >
        <button
          type="button"
          onClick={() => {
            setReportMode('institute');
            setError('');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: reportMode === 'institute' ? '#ffffff' : 'transparent',
            color: reportMode === 'institute' ? 'var(--primary)' : 'var(--text-secondary)',
            boxShadow: reportMode === 'institute' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          Option A: Institute Annual Report
        </button>

        <button
          type="button"
          onClick={() => {
            setReportMode('student');
            setStudentError('');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: reportMode === 'student' ? '#ffffff' : 'transparent',
            color: reportMode === 'student' ? 'var(--primary)' : 'var(--text-secondary)',
            boxShadow: reportMode === 'student' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
            <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
          </svg>
          Option B: Individual Student History Report
        </button>
      </div>

      {/* ========================================================================= */}
      {/* OPTION A: INSTITUTE ANNUAL REPORT BUILDER (MODULE 15) */}
      {/* ========================================================================= */}
      {reportMode === 'institute' && (
        <div>
          {/* Header Banner */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', backgroundColor: '#EFF6FF', borderLeft: '4px solid var(--primary)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>Institute Annual Report Builder:</strong>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Integrates real approved records across all 7 reporting modules. Strictly approved records only.
                </p>
              </div>
              <span className="badge badge-teal">Module 15 Integration</span>
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

          {/* Generated PDF Success Banner */}
          {instantReport && (
            <div
              style={{
                marginBottom: '1.75rem',
                padding: '1.25rem 1.5rem',
                backgroundColor: '#ECFDF5',
                border: '1.5px solid #10B981',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#047857', fontSize: '1.05rem', fontWeight: 700 }}>
                    Official Annual Report PDF Generated!
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#065F46' }}>
                    Document: <strong>{instantReport.fileName}</strong> ({Math.round((instantReport.fileSize || 0) / 1024)} KB)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <a
                    href={instantReport.downloadUrl}
                    download={instantReport.fileName}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    ⬇ Download PDF
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/generated-reports')}
                  >
                    View in Archive
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleGeneratePreview}>
            {/* STEP 2: Academic Year & Scope */}
            <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: '#FAFAFA', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="badge badge-primary">Step 2</span>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Academic Year & Department Scope</h3>
              </div>

              <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reportYear">
                    Academic Year <span className="required">*</span>
                  </label>
                  <select
                    id="reportYear"
                    className="form-select"
                    value={selectedYear}
                    onChange={handleYearChange}
                    required
                  >
                    {academicYears.map((ay) => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reportTitleInput">
                    Report Title <span className="required">*</span>
                  </label>
                  <input
                    id="reportTitleInput"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Institutional Annual Report 2025-2026"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Department Lockdown or Selector */}
              {isHOD || isFaculty ? (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>🔒</span>
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: '#92400E' }}>
                        Department Scoped: {userDept || 'Assigned Department'}
                      </strong>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#B45309' }}>
                        As {user?.role?.toUpperCase()}, your report access is strictly restricted to your assigned department.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: 0 }}>
                      Selected Departments ({selectedDepts.length} of {departments.length}) <span className="required">*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectAllDepts(true)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectAllDepts(false)}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {departments.map((dept) => {
                      const isChecked = selectedDepts.includes(dept.name);
                      return (
                        <label
                          key={dept.code || dept.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                            backgroundColor: isChecked ? 'var(--primary-light)' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleDeptToggle(dept.name)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <div>
                            <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                              {dept.code ? `[${dept.code}] ` : ''}{dept.name}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              HOD: {dept.hod || 'Department Head'}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* STEP 3: Report Sections & Custom Ordering */}
            <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: '#FAFAFA', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-primary">Step 3</span>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Select Sections & Customize Ordering</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectAllSections(true)}
                  >
                    Select All ({ALL_INSTITUTE_SECTIONS.length})
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectAllSections(false)}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Toggle sections to include/exclude. Use the <strong>▲ Up</strong> and <strong>▼ Down</strong> buttons to rearrange the sequence in the generated PDF.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {sectionOrder.map((sectionId, index) => {
                  const sec = ALL_INSTITUTE_SECTIONS.find((s) => s.id === sectionId) || { id: sectionId, label: sectionId, desc: '' };
                  const isChecked = selectedSections.includes(sectionId);

                  return (
                    <div
                      key={sectionId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${isChecked ? '#10B981' : '#E2E8F0'}`,
                        backgroundColor: isChecked ? '#F0FDF4' : '#FFFFFF',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSectionToggle(sectionId)}
                          style={{ width: '17px', height: '17px', accentColor: '#10B981', cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: isChecked ? '#10B981' : '#CBD5E1',
                            color: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.88rem', color: isChecked ? '#065F46' : 'var(--text-main)' }}>
                            {sec.label}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {sec.desc}
                          </span>
                        </div>
                      </label>

                      <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '1rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={index === 0}
                          onClick={() => handleMoveSection(index, -1)}
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                          title="Move section earlier"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={index === sectionOrder.length - 1}
                          onClick={() => handleMoveSection(index, 1)}
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                          title="Move section later"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 4: Customization & Branding (Collapsible) */}
            <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: '#FAFAFA', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowCustomization(!showCustomization)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-primary">Step 4</span>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Institutional Branding & Customization</h3>
                </div>
                <button type="button" className="btn btn-secondary btn-sm">
                  {showCustomization ? 'Hide Options ▲' : 'Show Options ▼'}
                </button>
              </div>

              {showCustomization && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #E2E8F0' }}>
                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Subtitle / Focus Area</label>
                      <input
                        type="text"
                        className="form-input"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="e.g. Annual Institutional Performance & Accreditation Audit"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Institution Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customization.instituteName}
                        onChange={(e) => setCustomization({ ...customization, instituteName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Accreditation / Tagline</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customization.tagline}
                        onChange={(e) => setCustomization({ ...customization, tagline: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Official Website</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customization.website}
                        onChange={(e) => setCustomization({ ...customization, website: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label">Campus Address</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customization.address}
                        onChange={(e) => setCustomization({ ...customization, address: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact Email & Phone</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customization.contact}
                        onChange={(e) => setCustomization({ ...customization, contact: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={customization.coverPage}
                        onChange={(e) => setCustomization({ ...customization, coverPage: e.target.checked })}
                      />
                      Include Front Cover Page with Institutional Crest
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={customization.includeHeader}
                        onChange={(e) => setCustomization({ ...customization, includeHeader: e.target.checked })}
                      />
                      Include Running Institutional Header
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={customization.includeFooter}
                        onChange={(e) => setCustomization({ ...customization, includeFooter: e.target.checked })}
                      />
                      Include Page Numbers & Confidentiality Footer
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 5: Report Readiness Audit Widget */}
            <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: '#FAFAFA', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-primary">Step 5</span>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Report Readiness Check</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadReadiness(selectedYear, selectedDepts)}
                  disabled={readinessLoading}
                >
                  {readinessLoading ? 'Auditing...' : '🔄 Refresh Audit'}
                </button>
              </div>

              {readinessLoading ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Auditing database approval records...
                </div>
              ) : readiness ? (
                <div>
                  {/* Summary Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1.25rem',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #E2E8F0',
                      marginBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Overall Audit Readiness: </span>
                      <strong style={{ fontSize: '1rem', color: readiness.overallReadiness >= 80 ? '#047857' : '#D97706' }}>
                        {readiness.overallReadiness}%
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                      <span style={{ color: '#047857' }}>● Approved: <strong>{readiness.totalApproved}</strong></span>
                      <span style={{ color: '#D97706' }}>● Pending: <strong>{readiness.totalPending}</strong></span>
                      {readiness.totalChangesRequested > 0 && (
                        <span style={{ color: '#DC2626' }}>● Changes Requested: <strong>{readiness.totalChangesRequested}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Per Section Breakdown Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                    {Object.entries(readiness.sections || {}).map(([secKey, secStats]) => {
                      const title = secKey.charAt(0).toUpperCase() + secKey.slice(1);
                      return (
                        <div
                          key={secKey}
                          style={{
                            padding: '0.65rem 0.85rem',
                            backgroundColor: '#FFFFFF',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.78rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <strong style={{ color: 'var(--text-main)' }}>{title}</strong>
                            <span style={{ color: secStats.percentage >= 80 ? '#047857' : '#D97706', fontWeight: 700 }}>
                              {secStats.approved} / {secStats.total}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${secStats.percentage}%`,
                                height: '100%',
                                backgroundColor: secStats.percentage >= 80 ? '#10B981' : '#F59E0B'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Warnings Notice */}
                  {readiness.warnings && readiness.warnings.length > 0 && (
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: '#FFFBEB', borderLeft: '3px solid #F59E0B', borderRadius: '4px', fontSize: '0.8rem', color: '#92400E' }}>
                      <strong>Audit Notice:</strong> {readiness.warnings[0]}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* STEP 6 & 7: Actions */}
            <div className="form-actions" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Scope: <strong>{selectedDepts.length}</strong> departments • <strong>{selectedSections.length}</strong> sections enabled
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleInstantPDF}
                  disabled={instantGenerating}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {instantGenerating ? 'Generating PDF...' : '📄 Instant Generate PDF'}
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 2rem', fontWeight: 700 }}
                >
                  Step 6: Preview Report →
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPTION B: INDIVIDUAL STUDENT HISTORY REPORT FORM */}
      {/* ========================================================================= */}
      {reportMode === 'student' && (
        <div>
          <div style={{ marginBottom: '1.5rem', padding: '0.85rem 1.15rem', backgroundColor: '#F0FDF4', borderLeft: '4px solid #059669', borderRadius: '4px' }}>
            <strong style={{ fontSize: '0.9rem', color: '#047857' }}>Individual Student History Dossier Mode:</strong>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Search and select an active registered student to compile their verified, approved academic background, corporate placements, competitive achievements, and event participation into a personalized official PDF report.
            </p>
          </div>

          {studentError && <div className="alert alert-error">{studentError}</div>}

          {/* Generated PDF Success Banner */}
          {generatedStudentReport && (
            <div
              style={{
                marginBottom: '1.75rem',
                padding: '1.25rem 1.5rem',
                backgroundColor: '#ECFDF5',
                border: '1.5px solid #10B981',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#047857', fontSize: '1.05rem', fontWeight: 700 }}>
                    🎉 Student History Report PDF Ready!
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#065F46' }}>
                    Document: <strong>{generatedStudentReport.fileName}</strong> ({Math.round((generatedStudentReport.fileSize || 0) / 1024)} KB)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <a
                    href={generatedStudentReport.downloadUrl}
                    download={generatedStudentReport.fileName}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download Student PDF
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/generated-reports')}
                  >
                    View in Archive
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleGenerateStudentPDF}>
            {/* Step 1: Student Search Dropdown */}
            <div style={{ marginBottom: '1.75rem' }}>
              <StudentSearchDropdown
                label="Search & Select Student"
                required
                department={userDeptScope}
                placeholder="Type student name or register number (e.g. Kavin, CSE-2022-041)..."
                selectedStudent={selectedStudent}
                onSelect={handleStudentSelect}
                onClear={handleStudentClear}
              />
            </div>

            {/* Loading Indicator for Summary */}
            {summaryLoading && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Loading verified student history and approved counts...
              </div>
            )}

            {/* Step 2: Selected Student Summary Card with Live Counters & Readiness Audit */}
            {studentSummary && studentSummary.student && (
              <div
                style={{
                  marginBottom: '2rem',
                  padding: '1.25rem 1.5rem',
                  backgroundColor: '#F8FAFC',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        {studentSummary.student.name}
                      </h3>
                      <span className="badge badge-blue">
                        {studentSummary.student.register_no}
                      </span>
                      <span className={`badge ${studentSummary.student.status === 'Active' ? 'badge-green' : 'badge-slate'}`}>
                        {studentSummary.student.status || 'Active'}
                      </span>
                    </div>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Department: <strong>{studentSummary.student.department}</strong> • Batch: <strong>{studentSummary.student.academic_year || 'Regular'}</strong> • Year: <strong>{studentSummary.student.current_year || 1}</strong> (Sec {studentSummary.student.section || 'A'})
                    </p>
                  </div>
                  {studentSummary.student.email && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      ✉ {studentSummary.student.email}
                    </div>
                  )}
                </div>

                {/* Available Approved Record Counts Chips */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#1E40AF' }}>
                      💼 Approved Placements
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#1E3A8A' }}>
                      {studentSummary.counts?.placements || 0} Offer(s)
                    </strong>
                  </div>

                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#166534' }}>
                      🏆 Approved Achievements
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#047857' }}>
                      {studentSummary.counts?.achievements || 0} Record(s)
                    </strong>
                  </div>

                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#6B21A8' }}>
                      🎯 Dept Activities
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#7E22CE' }}>
                      {studentSummary.counts?.activities || 0} Record(s)
                    </strong>
                  </div>

                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#C2410C' }}>
                      🎪 Events Participation
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#EA580C' }}>
                      {studentSummary.counts?.events || 0} Record(s)
                    </strong>
                  </div>

                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#0F766E' }}>
                      🔬 Research & Pubs
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#115E59' }}>
                      {studentSummary.counts?.research || 0} Paper(s)
                    </strong>
                  </div>

                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#B45309' }}>
                      💡 Capstone Projects
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#92400E' }}>
                      {studentSummary.counts?.projects || 0} Project(s)
                    </strong>
                  </div>
                </div>

                {/* Detailed Module Readiness Breakdown Audit */}
                {studentSummary.readiness && (
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', padding: '0.85rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                      📋 Module Readiness & Approval Status Audit:
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid #CBD5E1', color: '#64748B' }}>
                            <th style={{ padding: '0.35rem 0.5rem' }}>Module Section</th>
                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>Total Found</th>
                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: '#047857' }}>Approved (In PDF)</th>
                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: '#D97706' }}>Pending (Excluded)</th>
                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: '#DC2626' }}>Changes Req. (Excluded)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { key: 'achievements', label: 'Student Achievements' },
                            { key: 'activities', label: 'Department Activities' },
                            { key: 'events', label: 'Events Management' },
                            { key: 'placements', label: 'Placement Records' },
                            { key: 'research', label: 'Research & Publications' },
                            { key: 'projects', label: 'Projects & Innovations' }
                          ].map(({ key, label }) => {
                            const r = studentSummary.readiness[key] || { total: 0, approved: 0, pending: 0, changesRequested: 0 };
                            return (
                              <tr key={key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#1E293B' }}>{label}</td>
                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: '#475569' }}>{r.total}</td>
                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#047857' }}>
                                  {r.approved}
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: r.pending > 0 ? '#D97706' : '#94A3B8' }}>
                                  {r.pending}
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: r.changesRequested > 0 ? '#DC2626' : '#94A3B8' }}>
                                  {r.changesRequested}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.78rem', color: '#0369A1', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', padding: '0.55rem 0.85rem', borderRadius: '4px' }}>
                  🛡 <strong>Strict Approval Guarantee:</strong> Pending, Changes Requested, and Rejected records are displayed above for workflow awareness only. In accordance with Institutional Audit Rules, only <strong>Approved</strong> records will be compiled into the official Student History PDF.
                </div>
              </div>
            )}

            {/* Step 3: Customization Controls (Academic Year & Date Range Filters) */}
            <div style={{ marginBottom: '1.75rem', padding: '1.25rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.85rem' }}>
                Step 3: Temporal Filters (Academic Year & Optional Date Range)
              </div>
              <div className="form-grid" style={{ marginBottom: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="studentYearSelect">
                    Academic Year Filter / Scope
                  </label>
                  <select
                    id="studentYearSelect"
                    className="form-select"
                    value={studentYear}
                    onChange={(e) => handleStudentYearFilterChange(e.target.value)}
                  >
                    <option value="All">All Available Years (Complete Student History)</option>
                    {academicYears.map((ay) => (
                      <option key={ay} value={ay}>Only Year {ay}</option>
                    ))}
                  </select>
                  <span className="helper-text">
                    Restrict records to a single academic session or keep All for full history.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="studentStartDate">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    id="studentStartDate"
                    className="form-input"
                    value={studentStartDate}
                    onChange={(e) => handleStudentStartDateChange(e.target.value)}
                  />
                  <span className="helper-text">
                    Filter records on or after this date.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="studentEndDate">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    id="studentEndDate"
                    className="form-input"
                    value={studentEndDate}
                    onChange={(e) => handleStudentEndDateChange(e.target.value)}
                  />
                  <span className="helper-text">
                    Filter records on or before this date.
                  </span>
                </div>
              </div>

              {(studentStartDate || studentEndDate) && (
                <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      handleStudentStartDateChange('');
                      handleStudentEndDateChange('');
                    }}
                  >
                    Reset Date Range
                  </button>
                </div>
              )}
            </div>

            {/* Step 4: Sections to Include */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontSize: '0.95rem' }}>
                  Select History Sections to Include <span className="required">*</span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectAllStudentSections(true)}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectAllStudentSections(false)}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {STUDENT_REPORT_SECTIONS.map((sec) => {
                  const isChecked = selectedStudentSections.includes(sec.id);
                  return (
                    <label
                      key={sec.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.85rem',
                        padding: '0.85rem 1.15rem',
                        borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${isChecked ? '#0284c7' : 'var(--border-color)'}`,
                        backgroundColor: isChecked ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleStudentSectionToggle(sec.id)}
                        style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#0284c7', cursor: 'pointer' }}
                      />
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {sec.label}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {sec.desc}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Action Bar */}
            <div className="form-actions" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Target: <strong>{selectedStudent ? `${selectedStudent.name} (${selectedStudent.register_no})` : 'No student selected'}</strong> • Scope: <strong>{studentYear === 'All' ? 'All Years' : studentYear}</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleGenerateStudentPDF}
                  disabled={!selectedStudent || generatingStudentPdf || selectedStudentSections.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {generatingStudentPdf ? (
                    <>
                      <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
                      Generating PDF...
                    </>
                  ) : (
                    <>📄 Instant Generate Student PDF</>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePreviewStudentReport}
                  disabled={!selectedStudent || selectedStudentSections.length === 0}
                  style={{ padding: '0.75rem 2rem', fontWeight: 700 }}
                >
                  Step 5: Preview Student History Report →
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
