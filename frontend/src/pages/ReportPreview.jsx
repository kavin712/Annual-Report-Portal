import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import ReportSection from '../components/ReportSection';

function StudentReportPreviewSheet({ previewData, config }) {
  const student = previewData?.student || config.student || {};
  const studentData = previewData?.data || {};
  const counts = previewData?.counts || {};
  const reportYear = previewData?.academicYear || config.academic_year || 'All';
  const startDate = previewData?.startDate || config.startDate;
  const endDate = previewData?.endDate || config.endDate;
  const selectedSections = previewData?.selectedSections || config.selected_sections || config.selectedSections || [];

  const hasSection = (key) => {
    const lowerKey = key.toLowerCase();
    return selectedSections.some((item) => {
      const s = (typeof item === 'string' ? item : (item.id || item.label || '')).toLowerCase();
      return s.includes(lowerKey) || lowerKey.includes(s);
    });
  };

  const placements = studentData.placements || [];
  const achievements = studentData.achievements || [];
  const activities = studentData.activities || [];
  const events = studentData.events || [];
  const research = studentData.research || [];
  const projects = studentData.projects || [];

  return (
    <div className="report-paper">
      {/* 1. Header Banner */}
      <div
        style={{
          borderBottom: '3px solid #0284C7',
          paddingBottom: '1.5rem',
          marginBottom: '2rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#0284C7',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 700
              }}
            >
              🎓
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A', fontWeight: 800, letterSpacing: '0.5px' }}>
                EXCELLENCE INSTITUTE OF TECHNOLOGY
              </h1>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                Accredited by NBA & NAAC with A++ Grade | Autonomous Institution
              </p>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#0284C7', fontWeight: 700 }}>
                OFFICIAL INDIVIDUAL STUDENT ACADEMIC & ACTIVITY DOSSIER
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge badge-blue" style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}>
              Academic Scope: {reportYear === 'All' ? 'All Academic Years' : `AY ${reportYear}`}
            </span>
            {(startDate || endDate) && (
              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.25rem' }}>
                Period: {startDate || 'Beginning'} → {endDate || 'Present'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Student Profile Section */}
      {hasSection('profile') && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.25rem 1.5rem',
            backgroundColor: '#F8FAFC',
            border: '1.5px solid #E2E8F0',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👤 Student Profile Information
            </h3>
            <span className={`badge ${student.status === 'Active' ? 'badge-green' : 'badge-slate'}`}>
              {student.status || 'Active'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Full Legal Name</span>
              <strong style={{ color: '#0F172A', fontSize: '0.95rem' }}>{student.name || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Register Number</span>
              <strong style={{ color: '#0284C7', fontSize: '0.95rem' }}>{student.register_no || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Department</span>
              <strong style={{ color: '#0F172A' }}>{student.department || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Batch / Enrollment</span>
              <strong style={{ color: '#0F172A' }}>{student.academic_year || 'Regular Program'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Current Year & Section</span>
              <strong style={{ color: '#0F172A' }}>Year {student.current_year || 1} • Section {student.section || 'A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Institutional Email</span>
              <strong style={{ color: '#0F172A' }}>{student.email || 'N/A'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 3. Approved Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={{ padding: '0.65rem', backgroundColor: '#EFF6FF', borderRadius: 'var(--radius-sm)', border: '1px solid #BFDBFE', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#1E40AF', fontWeight: 600, display: 'block' }}>💼 Placements</span>
          <strong style={{ fontSize: '1.15rem', color: '#1E3A8A' }}>{counts.placements || 0}</strong>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: '#F0FDF4', borderRadius: 'var(--radius-sm)', border: '1px solid #BBF7D0', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600, display: 'block' }}>🏆 Achievements</span>
          <strong style={{ fontSize: '1.15rem', color: '#047857' }}>{counts.achievements || 0}</strong>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: '#FAF5FF', borderRadius: 'var(--radius-sm)', border: '1px solid #E9D5FF', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#6B21A8', fontWeight: 600, display: 'block' }}>🎯 Activities</span>
          <strong style={{ fontSize: '1.15rem', color: '#7E22CE' }}>{counts.activities || 0}</strong>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: '#FFF7ED', borderRadius: 'var(--radius-sm)', border: '1px solid #FED7AA', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#C2410C', fontWeight: 600, display: 'block' }}>🎪 Events</span>
          <strong style={{ fontSize: '1.15rem', color: '#EA580C' }}>{counts.events || 0}</strong>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: '#F0FDFA', borderRadius: 'var(--radius-sm)', border: '1px solid #99F6E4', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#0F766E', fontWeight: 600, display: 'block' }}>🔬 Research</span>
          <strong style={{ fontSize: '1.15rem', color: '#115E59' }}>{counts.research || 0}</strong>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: '#FEF3C7', borderRadius: 'var(--radius-sm)', border: '1px solid #FDE68A', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#B45309', fontWeight: 600, display: 'block' }}>💡 Projects</span>
          <strong style={{ fontSize: '1.15rem', color: '#92400E' }}>{counts.projects || 0}</strong>
        </div>
      </div>

      {/* 4. Academic Information Section */}
      {hasSection('academic') && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            Academic Performance & Standing
          </h3>
          <div style={{ padding: '1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>Enrollment Status:</strong> Regular Full-Time Under-Graduate Student
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>Academic Standing:</strong> In Good Academic & Disciplinary Standing (No Institutional Backlogs or Disciplinary Violations Recorded).
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>
              * Official semester grade cards, credit transcripts, and consolidated grade sheets are maintained and issued separately by the Office of the Controller of Examinations.
            </p>
          </div>
        </div>
      )}

      {/* 5. Placement History Section */}
      {hasSection('placement') && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            Placement History & Corporate Offers
          </h3>
          {placements.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Designation / Role</th>
                    <th>Package (CTC)</th>
                    <th>Offer Status</th>
                    <th>Placement Date</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {placements.map((p, idx) => (
                    <tr key={p.id || idx}>
                      <td><strong>{p.company_name}</strong></td>
                      <td>{p.role || p.job_role || 'Graduate Engineer Trainee'}</td>
                      <td><span className="badge badge-green">{p.package ? `${p.package} LPA` : (p.ctc || 'N/A')}</span></td>
                      <td>{p.offer_type || p.status || 'Selected'}</td>
                      <td>{p.placement_date ? new Date(p.placement_date).toLocaleDateString() : (p.academic_year || 'N/A')}</td>
                      <td>{p.location || 'On-Campus / Corporate'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 'var(--radius-sm)', color: '#64748B', fontSize: '0.82rem', textAlign: 'center' }}>
              No approved placement records found for this student in the selected scope.
            </div>
          )}
        </div>
      )}

      {/* 6. Student Achievements Section */}
      {hasSection('achievement') && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            Student Achievements & Honors
          </h3>
          {achievements.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Achievement / Honor</th>
                    <th>Category</th>
                    <th>Event / Contest</th>
                    <th>Level</th>
                    <th>Award / Position</th>
                    <th>Date</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {achievements.map((a, idx) => (
                    <tr key={a.id || idx}>
                      <td><strong>{a.title}</strong></td>
                      <td>{a.category}</td>
                      <td>{a.event_name || 'N/A'}</td>
                      <td><span className="badge badge-purple">{a.level || 'State'}</span></td>
                      <td><span className="badge badge-green">{a.award || a.position || 'Winner'}</span></td>
                      <td>{a.date ? new Date(a.date).toLocaleDateString() : (a.academic_year || 'N/A')}</td>
                      <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>{a.description || 'Verified Student Achievement'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 'var(--radius-sm)', color: '#64748B', fontSize: '0.82rem', textAlign: 'center' }}>
              No approved student achievements found for this student in the selected scope.
            </div>
          )}
        </div>
      )}

      {/* 7. Department Activities Section */}
      {hasSection('activit') && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            Department Activities & Co-Curricular Engagements
          </h3>
          {activities.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Activity Title</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Venue</th>
                    <th>Organizer</th>
                    <th>Coordinator</th>
                    <th>Participation Role</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act, idx) => (
                    <tr key={act.id || idx}>
                      <td><strong>{act.title}</strong></td>
                      <td>{act.category}</td>
                      <td>{act.date ? new Date(act.date).toLocaleDateString() : (act.academic_year || 'N/A')}</td>
                      <td>{act.venue || 'Campus Auditorium'}</td>
                      <td>{act.organizer || act.department}</td>
                      <td>{act.coordinator || 'Faculty Coordinator'}</td>
                      <td><span className="badge badge-blue">Student Participant</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 'var(--radius-sm)', color: '#64748B', fontSize: '0.82rem', textAlign: 'center' }}>
              No approved department activities found for this student in the selected scope.
            </div>
          )}
        </div>
      )}

      {/* 8. Events Management / Participation Section */}
      {hasSection('event') && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            Events Management & Institutional Participation
          </h3>
          {events.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Venue</th>
                    <th>Organizer</th>
                    <th>Participation Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, idx) => (
                    <tr key={ev.id || idx}>
                      <td><strong>{ev.title}</strong></td>
                      <td>{ev.category}</td>
                      <td>{ev.date ? new Date(ev.date).toLocaleDateString() : (ev.academic_year || 'N/A')}</td>
                      <td>{ev.venue || 'Institute Complex'}</td>
                      <td>{ev.organizer || ev.department}</td>
                      <td><span className="badge badge-blue">Active Participant</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 'var(--radius-sm)', color: '#64748B', fontSize: '0.82rem', textAlign: 'center' }}>
              No approved event participation records found for this student in the selected scope.
            </div>
          )}
        </div>
      )}

      {/* 9. Research & Publications Section */}
      {hasSection('research') && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            Research & Scholarly Publications
          </h3>
          {research.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Paper / Publication Title</th>
                    <th>Type</th>
                    <th>Journal / Conference</th>
                    <th>Publisher</th>
                    <th>Date</th>
                    <th>DOI / Link</th>
                    <th>Authors</th>
                  </tr>
                </thead>
                <tbody>
                  {research.map((r, idx) => (
                    <tr key={r.id || idx}>
                      <td><strong>{r.title}</strong></td>
                      <td><span className="badge badge-slate">{r.publication_type || 'Journal'}</span></td>
                      <td>{r.journal_name || r.conference_name || 'International Forum'}</td>
                      <td>{r.publisher || 'N/A'}</td>
                      <td>{r.publication_date ? new Date(r.publication_date).toLocaleDateString() : (r.academic_year || 'N/A')}</td>
                      <td>{r.doi ? <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" style={{ color: '#0284c7' }}>{r.doi}</a> : 'N/A'}</td>
                      <td>{r.authors || student.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 'var(--radius-sm)', color: '#64748B', fontSize: '0.82rem', textAlign: 'center' }}>
              No approved research publications found for this student in the selected scope.
            </div>
          )}
        </div>
      )}

      {/* 10. Projects & Innovations Section */}
      {hasSection('project') && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            Capstone Projects & Technical Innovations
          </h3>
          {projects.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Project Title</th>
                    <th>Category</th>
                    <th>Student Team</th>
                    <th>Faculty Guide</th>
                    <th>Sponsor / Partner</th>
                    <th>Awards</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((proj, idx) => (
                    <tr key={proj.id || idx}>
                      <td><strong>{proj.title}</strong></td>
                      <td><span className="badge badge-purple">{proj.category || 'Capstone Project'}</span></td>
                      <td>{proj.team_members || student.name}</td>
                      <td>{proj.guide || proj.coordinator || 'Faculty Mentor'}</td>
                      <td>{proj.sponsor || proj.industry_partner || 'Institutional Grant'}</td>
                      <td>{proj.awards ? <span className="badge badge-green">{proj.awards}</span> : 'Completed'}</td>
                      <td style={{ maxWidth: '200px', whiteSpace: 'normal' }}>{proj.description || 'Approved Project'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 'var(--radius-sm)', color: '#64748B', fontSize: '0.82rem', textAlign: 'center' }}>
              No approved capstone or research projects found for this student in the selected scope.
            </div>
          )}
        </div>
      )}

      {/* 11. Institutional Certification & Signature Blocks */}
      <div style={{ marginTop: '3rem', padding: '1.75rem', backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 'var(--radius-md)' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#0F172A', fontWeight: 700 }}>
          Institutional Certification & Endorsement
        </h4>
        <p style={{ margin: '0 0 2rem 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
          This document certifies that the academic profile, corporate placements, extracurricular awards, research contributions, and co-curricular participation detailed above for <strong>{student.name} ({student.register_no})</strong> have been verified against authentic institutional databases and are hereby officially endorsed.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', textAlign: 'center' }}>
          <div>
            <div style={{ height: '35px' }} />
            <div style={{ borderTop: '1px dashed #64748B', paddingTop: '0.4rem' }}>
              <strong style={{ display: 'block', fontSize: '0.82rem', color: '#0F172A' }}>Student Signature</strong>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{student.name}</span>
            </div>
          </div>
          <div>
            <div style={{ height: '35px' }} />
            <div style={{ borderTop: '1px dashed #64748B', paddingTop: '0.4rem' }}>
              <strong style={{ display: 'block', fontSize: '0.82rem', color: '#0F172A' }}>Head of Department</strong>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Dept. of {student.department || 'Engineering'}</span>
            </div>
          </div>
          <div>
            <div style={{ height: '35px' }} />
            <div style={{ borderTop: '1px dashed #64748B', paddingTop: '0.4rem' }}>
              <strong style={{ display: 'block', fontSize: '0.82rem', color: '#0F172A' }}>Principal / Director</strong>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Excellence Institute of Technology</span>
            </div>
          </div>
        </div>
      </div>

      {/* 12. Running Footer */}
      <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8' }}>
        <span>Excellence Institute of Technology • Official Student History Dossier</span>
        <span>Target Student: {student.name} ({student.register_no}) • Verified Official Copy</span>
      </div>
    </div>
  );
}

export default function ReportPreview({ reportConfig, onReportGenerated }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve configuration from route state or props
  const config = location.state?.config || reportConfig || {
    reportTitle: 'Institute Annual Report 2025-26',
    academicYear: '2025-26',
    selectedDepartments: ['Computer Science and Engineering', 'Information Technology', 'Electronics and Communication Engineering'],
    selectedSections: [
      'Department Information',
      'Student Achievements',
      'Faculty Information',
      'Department Activities',
      'Events Management',
      'Placement Summary'
    ]
  };

  const isStudentMode = config.reportMode === 'student' || !!config.student_id;

  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      if (isStudentMode) {
        const data = await api.previewStudentReport(config);
        setPreviewData(data);
      } else {
        const data = await api.previewReport(config);
        setPreviewData(data);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load report preview.' });
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF via Backend PDFKit
  const handleGeneratePDF = async () => {
    setGenerating(true);
    setMessage({ type: 'info', text: isStudentMode ? 'Generating Student History PDF...' : 'Generating institutional PDF with PDFKit...' });

    try {
      const res = isStudentMode ? await api.generateStudentReport(config) : await api.generateReport(config);
      if (res && res.success && res.report) {
        setGeneratedReport(res.report);
        setMessage({
          type: 'success',
          text: `PDF successfully generated: "${res.report.fileName}" (${Math.round((res.report.fileSize || 0) / 1024)} KB). Ready for download!`
        });
        if (onReportGenerated) onReportGenerated(res.report);
      } else {
        throw new Error(res?.error || 'Failed to generate PDF');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate PDF.' });
    } finally {
      setGenerating(false);
    }
  };

  // Real Browser PDF Download
  const handleDownloadPDF = async () => {
    try {
      let reportToDownload = generatedReport;

      // If not yet generated, generate it first
      if (!reportToDownload) {
        setGenerating(true);
        setMessage({ type: 'info', text: 'Compiling report and preparing PDF download...' });
        const res = isStudentMode ? await api.generateStudentReport(config) : await api.generateReport(config);
        if (!res || !res.report) {
          throw new Error(res?.error || 'Could not compile report for download.');
        }
        reportToDownload = res.report;
        setGeneratedReport(res.report);
        if (onReportGenerated) onReportGenerated(res.report);
      }

      // Trigger actual browser download
      const downloadUrl = api.getDownloadUrl(reportToDownload.id);
      
      // Create hidden link and click to trigger browser download dialog
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', reportToDownload.fileName || (isStudentMode ? 'Student_History.pdf' : 'Annual_Report.pdf'));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({
        type: 'success',
        text: `Download started for "${reportToDownload.fileName}". Check your downloads folder!`
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to download PDF.' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="content-card" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isStudentMode ? 'Compiling verified student history dossier...' : 'Compiling departmental preview...'}
        </p>
      </div>
    );
  }

  const { selectedDepartments = [], selectedSections = [], data = {} } = previewData || {};
  const targetStudent = previewData?.student || config.student || {};

  return (
    <div>
      {/* Top Action Bar */}
      <div className="content-card" style={{ padding: '1.25rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {isStudentMode ? `Student History Dossier: ${targetStudent.name || 'Verified Record'}` : 'Report Preview & Export'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {isStudentMode
                ? `Reg. No: ${targetStudent.register_no || 'N/A'} • Dept: ${targetStudent.department || 'N/A'} • Interactive pre-print verification before PDF generation.`
                : 'Interactive pre-print verification before compiling final PDFKit report.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/report-builder')}
            >
              ← Back to Builder
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGeneratePDF}
              disabled={generating}
            >
              {generating ? 'Generating PDF...' : '📄 Generate PDF'}
            </button>

            <button
              type="button"
              className="btn btn-success"
              onClick={handleDownloadPDF}
              disabled={generating}
              style={{ boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)' }}
            >
              ⬇ Download PDF
            </button>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ background: 'none', border: 'none' }}>×</button>
        </div>
      )}

      {/* Student Mode Preview Sheet */}
      {isStudentMode && (
        <StudentReportPreviewSheet previewData={previewData} config={config} />
      )}

      {/* Styled Printable Executive Report Sheet (Institute Annual Report) */}
      {!isStudentMode && (
        <div className="report-paper">
        {/* ============================================================== */}
        {/* 1. COVER PAGE PREVIEW (IF ENABLED) */}
        {/* ============================================================== */}
        {(selectedSections.includes('Cover Page') || config.customization?.coverPage !== false) && (
          <div
            style={{
              padding: '3rem 2rem',
              backgroundColor: '#FFFFFF',
              border: '2px solid #E2E8F0',
              borderRadius: 'var(--radius-md)',
              marginBottom: '3rem',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
            }}
          >
            {/* Top Bar */}
            <div style={{ height: '6px', background: 'linear-gradient(90deg, #1E3A8A 0%, #0F766E 100%)', borderRadius: '3px', marginBottom: '2.5rem' }} />

            {/* Emblem */}
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                border: '3px solid #1E3A8A',
                backgroundColor: '#EFF6FF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                color: '#1E3A8A',
                marginBottom: '1.25rem'
              }}
            >
              ★
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {config.customization?.instituteName || 'EXCELLENCE INSTITUTE OF TECHNOLOGY'}
            </h2>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem 0' }}>
              {config.customization?.tagline || 'Accredited by NBA & NAAC with A++ Grade | Autonomous Institution'}
            </p>

            <div style={{ width: '120px', height: '2px', backgroundColor: '#CBD5E1', margin: '0 auto 2rem auto' }} />

            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0F766E', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>
              {(previewData?.reportTitle || 'Institutional Annual Report').toUpperCase()}
            </h1>

            <p style={{ fontSize: '1rem', color: '#475569', margin: '0 0 2rem 0', fontStyle: 'italic' }}>
              {config.customization?.subtitle || 'Annual Institutional Performance & Accreditation Audit'}
            </p>

            <div
              style={{
                display: 'inline-block',
                padding: '0.6rem 1.75rem',
                backgroundColor: '#EFF6FF',
                border: '1.5px solid #BFDBFE',
                borderRadius: '50px',
                color: '#1E3A8A',
                fontWeight: 700,
                fontSize: '0.95rem',
                marginBottom: '1.25rem'
              }}
            >
              ACADEMIC YEAR: {previewData?.academicYear}
            </div>

            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
              Scope: {selectedDepartments.length > 2 ? `${selectedDepartments.length} Departments (Institute-Wide)` : selectedDepartments.join(', ')}
            </p>

            <div style={{ maxWidth: '600px', margin: '0 auto 2.5rem auto', padding: '1rem 1.25rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', textAlign: 'justify', fontSize: '0.8rem', color: '#334155', lineHeight: 1.6 }}>
              <strong>Official Record:</strong> This annual report contains authenticated records extracted directly from the Institute Annual Report Portal. All included student achievements, activities, events, placements, research publications, and infrastructural data represent records verified and approved in accordance with institutional governance.
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>Address: {config.customization?.address || 'Campus Road, Tech City'}</span>
              <span>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span>Confidential Official Copy</span>
            </div>
          </div>
        )}

        {/* Selected Scope Summary Strip */}
        <div style={{ background: '#F8FAFC', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong>Included Departments ({selectedDepartments.length}):</strong> {selectedDepartments.join(', ')}
            </div>
            <div>
              <strong>AY:</strong> {previewData?.academicYear}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. INSTITUTE OVERVIEW (IF ENABLED) */}
        {/* ============================================================== */}
        {(selectedSections.includes('Institute Overview') || selectedSections.includes('Overview')) && previewData?.instituteOverview && (
          <div style={{ marginBottom: '2.5rem' }}>
            <ReportSection title="Institute Overview & Key Performance Indicators">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  padding: '1.25rem',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #E2E8F0'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ACADEMIC DEPARTMENTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalDepartments}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TOTAL ENROLLED STUDENTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalStudents}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>FACULTY STRENGTH</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalFaculty}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>STUDENTS PLACED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>{previewData.instituteOverview.totalPlaced}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>APPROVED ACHIEVEMENTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalAchievements}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DEPARTMENT ACTIVITIES</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalActivities}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>INSTITUTIONAL EVENTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalEvents}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>RESEARCH PUBLICATIONS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalResearch}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ACADEMIC PROJECTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalProjects}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>FACILITIES & LABS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{previewData.instituteOverview.totalFacilities}</div>
                </div>
              </div>
            </ReportSection>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. DEPARTMENT-WISE SUMMARY TABLE (IF ENABLED) */}
        {/* ============================================================== */}
        {(selectedSections.includes('Department-wise Summary') || selectedSections.includes('Department Summary')) && previewData?.departmentSummaries && (
          <div style={{ marginBottom: '2.5rem' }}>
            <ReportSection title="Department-wise Comparative Summary">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th style={{ textAlign: 'center' }}>Students</th>
                      <th style={{ textAlign: 'center' }}>Faculty</th>
                      <th style={{ textAlign: 'center' }}>Placed %</th>
                      <th style={{ textAlign: 'center' }}>Achiev.</th>
                      <th style={{ textAlign: 'center' }}>Activ.</th>
                      <th style={{ textAlign: 'center' }}>Events</th>
                      <th style={{ textAlign: 'center' }}>Pubs</th>
                      <th style={{ textAlign: 'center' }}>Projects</th>
                      <th style={{ textAlign: 'center' }}>Facilities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.departmentSummaries.map((ds) => (
                      <tr key={ds.departmentName}>
                        <td><strong>{ds.departmentName}</strong></td>
                        <td style={{ textAlign: 'center' }}>{ds.students}</td>
                        <td style={{ textAlign: 'center' }}>{ds.faculty}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>{ds.placementPercentage}%</td>
                        <td style={{ textAlign: 'center' }}>{ds.achievements}</td>
                        <td style={{ textAlign: 'center' }}>{ds.activities}</td>
                        <td style={{ textAlign: 'center' }}>{ds.events}</td>
                        <td style={{ textAlign: 'center' }}>{ds.research}</td>
                        <td style={{ textAlign: 'center' }}>{ds.projects}</td>
                        <td style={{ textAlign: 'center' }}>{ds.facilities}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportSection>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. PER-DEPARTMENT CONTENT SECTIONS */}
        {/* ============================================================== */}
        {selectedDepartments.map((deptName) => {
          const deptData = data[deptName] || {};
          const info = deptData.info || {};
          const studentAch = deptData.studentAchievements || [];
          const facultyMembers = deptData.faculty || [];
          const activitiesList = deptData.activities || [];
          const eventsList = deptData.events || [];
          const placementData = deptData.placement || {};
          const placementOffers = deptData.placementRecords || [];
          const researchList = deptData.research || [];
          const projectList = deptData.projects || [];
          const studentStats = deptData.studentStats || {};

          return (
            <div key={deptName} className="dept-preview-block" style={{ marginBottom: '3rem' }}>
              {/* Department Banner */}
              <div className="dept-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>DEPARTMENT OF {deptName.toUpperCase()}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9 }}>
                  AY {previewData?.academicYear}
                </span>
              </div>

              {/* Department Overview */}
              {(selectedSections.includes('Department Overview') || selectedSections.includes('Department Information')) && (
                <ReportSection title="Department Overview & Leadership">
                  <div className="preview-grid-box">
                    <div className="preview-grid-item">
                      <span className="label">Head of Department:</span>
                      <span className="val">{info.hod || 'Dr. Department Head'}</span>
                    </div>
                    <div className="preview-grid-item">
                      <span className="label">Faculty Strength:</span>
                      <span className="val">{facultyMembers.length || info.total_faculty || 0}</span>
                    </div>
                    <div className="preview-grid-item">
                      <span className="label">Total Students:</span>
                      <span className="val">{studentStats.total || info.total_students || 0}</span>
                    </div>
                    <div className="preview-grid-item">
                      <span className="label">Gender Distribution:</span>
                      <span className="val">M: {info.male_students || 0} / F: {info.female_students || 0}</span>
                    </div>
                    <div className="preview-grid-item">
                      <span className="label">Courses Offered:</span>
                      <span className="val">{info.courses_count || 4}</span>
                    </div>
                    <div className="preview-grid-item">
                      <span className="label">Approved Research Papers:</span>
                      <span className="val">{researchList.length}</span>
                    </div>
                  </div>

                  {info.description && (
                    <div style={{ marginTop: '0.85rem', fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: '#FAFAFA', padding: '0.75rem', borderRadius: '4px' }}>
                      "{info.description}"
                    </div>
                  )}
                </ReportSection>
              )}

              {/* Student Statistics */}
              {selectedSections.includes('Student Statistics') && (
                <ReportSection title="Student Statistics & Demographics">
                  <div style={{ padding: '0.85rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong>Active Enrolment:</strong> {studentStats.total || 0} Students
                      <span>Gender: M {info.male_students || 0} • F {info.female_students || 0}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <strong>Year Distribution: </strong>
                      {Object.keys(studentStats.yearDistribution || {}).length > 0
                        ? Object.entries(studentStats.yearDistribution).map(([y, c]) => `${y}: ${c}`).join('  |  ')
                        : 'Year 1: 0  |  Year 2: 0  |  Year 3: 0  |  Year 4: 0'}
                    </div>
                  </div>
                </ReportSection>
              )}

              {/* Faculty Information */}
              {selectedSections.includes('Faculty Information') && (
                <ReportSection title="Faculty Directory & Qualifications">
                  {facultyMembers.length === 0 ? (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No faculty records recorded for this department.
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Faculty Name</th>
                            <th>Designation & Qual.</th>
                            <th>Specialization</th>
                            <th style={{ textAlign: 'center' }}>Papers</th>
                            <th style={{ textAlign: 'center' }}>Projects</th>
                            <th style={{ textAlign: 'center' }}>Conf.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {facultyMembers.map((fac) => (
                            <tr key={fac.id}>
                              <td>
                                <strong>{fac.faculty_name}</strong>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fac.faculty_id}</div>
                              </td>
                              <td>
                                <div>{fac.designation}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{fac.qualification}</div>
                              </td>
                              <td>{fac.specialization || 'Engineering'}</td>
                              <td style={{ textAlign: 'center' }}>{fac.publications || 0}</td>
                              <td style={{ textAlign: 'center' }}>{fac.research_projects || 0}</td>
                              <td style={{ textAlign: 'center' }}>{fac.conferences_attended || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportSection>
              )}

              {/* Student Achievements */}
              {selectedSections.includes('Student Achievements') && (
                <ReportSection title="Student Achievements & Honors (Approved)">
                  {studentAch.length === 0 ? (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No approved student achievements for this department.
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Student & Reg No</th>
                            <th>Category</th>
                            <th>Achievement Title</th>
                            <th>Event / Organization</th>
                            <th>Award / Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentAch.map((ach) => (
                            <tr key={ach.id}>
                              <td>
                                <strong>{ach.student_name}</strong>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ach.register_no || ach.student_id}</div>
                              </td>
                              <td><span className="badge badge-purple">{ach.achievement_type || ach.category || 'Award'}</span></td>
                              <td>{ach.title}</td>
                              <td>{ach.event_organization || ach.event_name || '-'}</td>
                              <td><strong>{ach.award || ach.date}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportSection>
              )}

              {/* Department Activities */}
              {selectedSections.includes('Department Activities') && (
                <ReportSection title="Department Activities & Workshops (Approved)">
                  {activitiesList.length === 0 ? (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No approved activities logged for this department.
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Activity Name</th>
                            <th>Type</th>
                            <th>Date & Venue</th>
                            <th style={{ textAlign: 'center' }}>Attendees</th>
                            <th>Coordinator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activitiesList.map((act) => (
                            <tr key={act.id}>
                              <td><strong>{act.activity_name || act.title}</strong></td>
                              <td><span className="badge badge-teal">{act.activity_type || act.category}</span></td>
                              <td>{[act.date, act.venue].filter(Boolean).join(' • ')}</td>
                              <td style={{ textAlign: 'center' }}>{act.participants_count || 0}</td>
                              <td>{act.faculty_coordinator || act.coordinator || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportSection>
              )}

              {/* Events Management */}
              {(selectedSections.includes('Events Management') || selectedSections.includes('Events')) && (
                <ReportSection title="Institutional & Departmental Events (Approved)">
                  {eventsList.length === 0 ? (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No approved events recorded for this department.
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Event Title</th>
                            <th>Category</th>
                            <th>Date & Venue</th>
                            <th style={{ textAlign: 'center' }}>Participants</th>
                            <th>Coordinator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventsList.map((evt) => (
                            <tr key={evt.id}>
                              <td><strong>{evt.event_name || evt.title}</strong></td>
                              <td><span className="badge badge-purple">{evt.event_type || evt.category}</span></td>
                              <td>{[evt.event_date || evt.date, evt.venue].filter(Boolean).join(' • ')}</td>
                              <td style={{ textAlign: 'center' }}>{evt.participants_count || evt.student_count || 0}</td>
                              <td>{evt.coordinator || evt.organizer || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportSection>
              )}

              {/* Placement Summary */}
              {selectedSections.includes('Placement Summary') && (
                <ReportSection title="Placement Progression & Career Summary">
                  <div className="preview-summary-card" style={{ marginBottom: '1.25rem' }}>
                    <div>
                      <div className="val">{placementData.eligible_students || 0}</div>
                      <div className="lbl">Eligible Students</div>
                    </div>
                    <div>
                      <div className="val">{placementData.students_placed || 0}</div>
                      <div className="lbl">Students Placed</div>
                    </div>
                    <div>
                      <div className="val" style={{ color: '#10B981' }}>
                        {placementData.placement_percentage || 0}%
                      </div>
                      <div className="lbl">Placement Rate</div>
                    </div>
                    <div>
                      <div className="val" style={{ color: '#6366F1' }}>
                        {placementData.highest_package ? `${placementData.highest_package} LPA` : '-'}
                      </div>
                      <div className="lbl">Highest Package</div>
                    </div>
                    <div>
                      <div className="val">
                        {placementData.average_package ? `${placementData.average_package} LPA` : '-'}
                      </div>
                      <div className="lbl">Average Package</div>
                    </div>
                    <div>
                      <div className="val">{placementData.companies_visited || 0}</div>
                      <div className="lbl">Companies</div>
                    </div>
                  </div>

                  {placementOffers.length > 0 && (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Student & Reg No</th>
                            <th>Company</th>
                            <th>Package (LPA)</th>
                            <th>Role / Designation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {placementOffers.slice(0, 10).map((po) => (
                            <tr key={po.id}>
                              <td>
                                <strong>{po.student_name}</strong>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{po.register_no}</div>
                              </td>
                              <td><strong>{po.company_name}</strong></td>
                              <td><span className="badge badge-teal">{po.package ? `${po.package} LPA` : '-'}</span></td>
                              <td>{po.job_role || po.role || 'Software Engineer'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportSection>
              )}

              {/* Research & Publications */}
              {selectedSections.includes('Research & Publications') && (
                <ReportSection title="Research Publications, Patents & Grants (Approved)">
                  {researchList.length === 0 ? (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No approved research publications for this department.
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Paper Title & Authors</th>
                            <th>Type</th>
                            <th>Journal / Publisher / DOI</th>
                            <th>Funding / Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {researchList.map((res) => (
                            <tr key={res.id}>
                              <td>
                                <strong>{res.title}</strong>
                                {res.authors && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{res.authors}</div>
                                )}
                              </td>
                              <td><span className="badge badge-teal">{res.publication_type}</span></td>
                              <td>
                                {[res.journal_conference_name || res.publisher, res.doi ? `DOI: ${res.doi}` : ''].filter(Boolean).join(' • ')}
                              </td>
                              <td>
                                {res.funding_amount > 0 ? (
                                  <span style={{ color: '#047857', fontWeight: 700 }}>{res.funding_amount} L ({res.funding_agency || 'Grant'})</span>
                                ) : (
                                  res.publication_date || '-'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportSection>
              )}

              {/* Projects & Innovations */}
              {selectedSections.includes('Projects & Innovations') && (
                <ReportSection title="Academic, Industry & Innovation Projects (Approved)">
                  {projectList.length === 0 ? (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No approved projects recorded for this department.
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Project Title & Team</th>
                            <th>Category / Type</th>
                            <th>Coordinator / Guide</th>
                            <th>Status & Awards</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectList.map((prj) => (
                            <tr key={prj.id}>
                              <td>
                                <strong>{prj.project_title || prj.title}</strong>
                                {prj.student_names && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Team: {prj.student_names}</div>
                                )}
                              </td>
                              <td><span className="badge badge-purple">{prj.project_category || 'Academic'} ({prj.project_type})</span></td>
                              <td>{prj.coordinator || prj.project_guide || '-'}</td>
                              <td>
                                <div>{prj.project_status || 'Completed'}</div>
                                {prj.awards_recognition && (
                                  <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 600 }}>★ {prj.awards_recognition}</div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ReportSection>
              )}


            </div>
          );
        })}

        {/* ============================================================== */}
        {/* 5. CONCLUSION & OFFICIAL SIGNATURE BLOCKS */}
        {/* ============================================================== */}
        {(selectedSections.includes('Conclusion') || selectedSections.includes('Conclusion & Signatures')) && (
          <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: '#FAFAFA', border: '1.5px solid #E2E8F0', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem' }}>
              Institutional Certification & Endorsement
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, marginBottom: '2.5rem' }}>
              We hereby certify that the comprehensive academic, student, faculty, infrastructural, placement, and research
              performance metrics detailed in this Institutional Annual Report for Academic Year <strong>{previewData?.academicYear}</strong> have
              been compiled from authentic institutional records, subjected to departmental audit, and officially approved.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center', paddingTop: '1.5rem', borderTop: '1px solid #CBD5E1' }}>
              <div>
                <div style={{ height: '40px' }} />
                <div style={{ borderTop: '1px dashed #64748B', paddingTop: '0.5rem' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Coordinator</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Academic Records Committee</span>
                </div>
              </div>

              <div>
                <div style={{ height: '40px' }} />
                <div style={{ borderTop: '1px dashed #64748B', paddingTop: '0.5rem' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Head of Department / IQAC</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Accreditation Governance Cell</span>
                </div>
              </div>

              <div>
                <div style={{ height: '40px' }} />
                <div style={{ borderTop: '1px dashed #64748B', paddingTop: '0.5rem' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Principal / Director</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{config.customization?.instituteName || 'Excellence Institute'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paper Footer */}
        <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Institutional Annual Report Portal • Official Report Copy</span>
          <span>Verified & Digitally Compiled</span>
        </div>
      </div>
    )}
  </div>
);
}
