import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StudentSearchDropdown from '../components/StudentSearchDropdown';

const PUBLICATION_TYPES = [
  'Journal Article',
  'Conference Paper',
  'Book Chapter',
  'Book',
  'Patent',
  'Technical Report',
  'Other'
];

const RESEARCH_CATEGORIES = [
  'Applied Research',
  'Fundamental Research',
  'Experimental Development',
  'Review Article',
  'Industrial Collaboration',
  'Interdisciplinary',
  'Patent / Intellectual Property'
];

const PROJECT_CATEGORIES = [
  'Academic Project',
  'Research Project',
  'Industry-Sponsored Project',
  'Funded Project',
  'Hackathon Project',
  'Innovation & Entrepreneurship',
  'Community / Social Impact',
  'Other'
];

const PROJECT_TYPES = [
  'Major Project',
  'Mini Project',
  'Capstone Project',
  'External Internship Project',
  'R&D Project'
];

const PROJECT_STATUSES = [
  'Ongoing',
  'Completed',
  'In Progress',
  'Submitted'
];

export default function ResearchProjects({
  academicYear,
  department,
  departments = [],
  academicYears = [],
  user
}) {
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const isHOD = (user?.role || '').toLowerCase() === 'hod';
  const isFaculty = (user?.role || '').toLowerCase() === 'faculty';

  const defaultDept = isHOD || isFaculty ? user?.department : (department || '');
  const defaultYear = academicYear || '2025-26';

  // Active Tab: 'research' | 'projects'
  const [activeTab, setActiveTab] = useState('research');

  // Available Faculty list for multi-select
  const [facultyList, setFacultyList] = useState([]);

  // ==========================================
  // TAB 1: RESEARCH & PUBLICATIONS STATE
  // ==========================================
  const [resFilters, setResFilters] = useState({
    search: '',
    academicYear: defaultYear,
    department: defaultDept,
    publicationType: '',
    researchArea: '',
    author: '',
    status: ''
  });

  const [resStats, setResStats] = useState({
    totalRecords: 0,
    approvedPublications: 0,
    journalPublications: 0,
    conferencePublications: 0,
    patents: 0,
    fundedResearchCount: 0,
    totalFundingAmount: 0
  });

  const [resRecords, setResRecords] = useState([]);
  const [resTotal, setResTotal] = useState(0);
  const [resPage, setResPage] = useState(1);
  const [resLoading, setResLoading] = useState(false);
  const [resStatsLoading, setResStatsLoading] = useState(false);

  // Research Modals
  const [resModalOpen, setResModalOpen] = useState(false);
  const [editingRes, setEditingRes] = useState(null);
  const [resDetailModal, setResDetailModal] = useState({ isOpen: false, record: null });

  // Research Form State
  const initialResForm = {
    title: '',
    description: '',
    research_category: 'Applied Research',
    publication_type: 'Journal Article',
    author_names: '',
    department: defaultDept || (departments[0]?.name || 'Computer Science and Engineering'),
    journal_conference_name: '',
    publisher: '',
    publication_date: new Date().toISOString().split('T')[0],
    academic_year: defaultYear,
    doi: '',
    research_area: '',
    funding_agency: '',
    funding_amount: 0,
    document_path: '',
    student_ids: [],
    faculty_ids: [],
    selected_students: [], // Full student objects for UI tags
    selected_faculty: [], // Full faculty objects for UI tags
    submit_for_approval: true
  };
  const [resForm, setResForm] = useState(initialResForm);
  const [resFormSubmitting, setResFormSubmitting] = useState(false);
  const [resFileUploadProgress, setResFileUploadProgress] = useState(false);

  // ==========================================
  // TAB 2: PROJECTS MANAGEMENT STATE
  // ==========================================
  const [prjFilters, setPrjFilters] = useState({
    search: '',
    academicYear: defaultYear,
    department: defaultDept,
    projectCategory: '',
    projectStatus: '',
    status: ''
  });

  const [prjStats, setPrjStats] = useState({
    totalProjects: 0,
    completedProjects: 0,
    ongoingProjects: 0,
    fundedProjects: 0,
    awardWinningProjects: 0,
    totalFundingAmount: 0
  });

  const [prjRecords, setPrjRecords] = useState([]);
  const [prjTotal, setPrjTotal] = useState(0);
  const [prjPage, setPrjPage] = useState(1);
  const [prjLoading, setPrjLoading] = useState(false);
  const [prjStatsLoading, setPrjStatsLoading] = useState(false);

  // Project Modals
  const [prjModalOpen, setPrjModalOpen] = useState(false);
  const [editingPrj, setEditingPrj] = useState(null);
  const [prjDetailModal, setPrjDetailModal] = useState({ isOpen: false, record: null });

  // Project Form State
  const initialPrjForm = {
    project_title: '',
    description: '',
    project_category: 'Academic Project',
    project_type: 'Major Project',
    department: defaultDept || (departments[0]?.name || 'Computer Science and Engineering'),
    academic_year: defaultYear,
    start_date: '',
    completion_date: '',
    coordinator: user?.name || '',
    coordinator_faculty_id: null,
    project_status: 'Ongoing',
    funding_agency: '',
    funding_amount: 0,
    industry_partner: '',
    competition_name: '',
    awards_recognition: '',
    project_url: '',
    document_path: '',
    student_ids: [],
    faculty_ids: [],
    selected_students: [],
    selected_faculty: [],
    submit_for_approval: true
  };
  const [prjForm, setPrjForm] = useState(initialPrjForm);
  const [prjFormSubmitting, setPrjFormSubmitting] = useState(false);
  const [prjFileUploadProgress, setPrjFileUploadProgress] = useState(false);

  // Notifications
  const [notification, setNotification] = useState({ type: '', text: '' });

  // Load faculty list for co-authors / guides
  useEffect(() => {
    loadFaculty();
  }, [department, user]);

  const loadFaculty = async () => {
    try {
      const targetD = isHOD || isFaculty ? user?.department : '';
      const data = await api.getFacultyList(targetD, defaultYear);
      if (Array.isArray(data)) {
        setFacultyList(data);
      }
    } catch (err) {
      console.log('Error loading faculty list:', err);
    }
  };

  // Sync filters on department / academicYear prop change
  useEffect(() => {
    const d = isHOD || isFaculty ? user?.department : (department || '');
    const y = academicYear || '2025-26';
    setResFilters(prev => ({ ...prev, department: d, academicYear: y }));
    setPrjFilters(prev => ({ ...prev, department: d, academicYear: y }));
  }, [department, academicYear]);

  // Fetch data on tab or filter change
  useEffect(() => {
    if (activeTab === 'research') {
      loadResearchStats();
      loadResearchRecords(1);
    } else {
      loadProjectStats();
      loadProjectRecords(1);
    }
  }, [activeTab, resFilters.department, resFilters.academicYear, prjFilters.department, prjFilters.academicYear]);

  // ------------------------------------------
  // RESEARCH DATA FETCHERS & ACTIONS
  // ------------------------------------------
  const loadResearchStats = async () => {
    setResStatsLoading(true);
    try {
      const data = await api.getResearchStats(resFilters.academicYear, resFilters.department);
      if (data) setResStats(data);
    } catch (err) {
      console.error('Failed to load research stats:', err);
    } finally {
      setResStatsLoading(false);
    }
  };

  const loadResearchRecords = async (pageNum = resPage, customFilters = resFilters) => {
    setResLoading(true);
    try {
      const res = await api.getResearch({
        department: customFilters.department,
        academicYear: customFilters.academicYear,
        publicationType: customFilters.publicationType,
        researchArea: customFilters.researchArea,
        author: customFilters.author,
        status: customFilters.status,
        search: customFilters.search,
        page: pageNum,
        limit: 10
      });
      setResRecords(res.records || []);
      setResTotal(res.total || 0);
      setResPage(res.page || 1);
    } catch (err) {
      setNotification({ type: 'error', text: 'Failed to load research records: ' + err.message });
    } finally {
      setResLoading(false);
    }
  };

  const handleApplyResFilters = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    loadResearchRecords(1, resFilters);
  };

  const handleClearResFilters = () => {
    const cleared = {
      search: '',
      academicYear: academicYear || '2025-26',
      department: isHOD || isFaculty ? user?.department : '',
      publicationType: '',
      researchArea: '',
      author: '',
      status: ''
    };
    setResFilters(cleared);
    loadResearchRecords(1, cleared);
  };

  const openCreateResModal = () => {
    setEditingRes(null);
    setResForm({
      ...initialResForm,
      department: isHOD || isFaculty ? user?.department : (department || 'Computer Science and Engineering'),
      academic_year: academicYear || '2025-26'
    });
    setResModalOpen(true);
  };

  const openEditResModal = async (record) => {
    try {
      const data = await api.getResearchById(record.id);
      setEditingRes(data);
      setResForm({
        title: data.title || '',
        description: data.description || '',
        research_category: data.research_category || 'Applied Research',
        publication_type: data.publication_type || 'Journal Article',
        author_names: data.author_names || '',
        department: data.department || '',
        journal_conference_name: data.journal_conference_name || '',
        publisher: data.publisher || '',
        publication_date: data.publication_date || '',
        academic_year: data.academic_year || '2025-26',
        doi: data.doi || '',
        research_area: data.research_area || '',
        funding_agency: data.funding_agency || '',
        funding_amount: data.funding_amount || 0,
        document_path: data.document_path || '',
        student_ids: (data.students || []).map(s => s.id),
        faculty_ids: (data.faculty || []).map(f => f.id),
        selected_students: data.students || [],
        selected_faculty: data.faculty || [],
        submit_for_approval: data.status === 'Pending Approval' || data.status === 'Changes Requested'
      });
      setResModalOpen(true);
    } catch (err) {
      alert('Failed to load record details for editing: ' + err.message);
    }
  };

  const openViewResModal = async (record) => {
    try {
      const data = await api.getResearchById(record.id);
      setResDetailModal({ isOpen: true, record: data });
    } catch (err) {
      alert('Failed to fetch details: ' + err.message);
    }
  };

  const handleResFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selected file exceeds maximum limit of 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    setResFileUploadProgress(true);
    reader.onload = async () => {
      try {
        const res = await api.uploadResearchDocument(file.name, reader.result);
        setResForm(prev => ({
          ...prev,
          document_path: res.document_path
        }));
        setNotification({ type: 'success', text: `Document "${file.name}" uploaded successfully!` });
      } catch (err) {
        alert('File upload failed: ' + err.message);
      } finally {
        setResFileUploadProgress(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddStudentToRes = (student) => {
    if (!student || !student.id) return;
    if (resForm.student_ids.includes(student.id)) return;
    setResForm(prev => ({
      ...prev,
      student_ids: [...prev.student_ids, student.id],
      selected_students: [...prev.selected_students, student]
    }));
  };

  const handleRemoveStudentFromRes = (studentId) => {
    setResForm(prev => ({
      ...prev,
      student_ids: prev.student_ids.filter(id => id !== studentId),
      selected_students: prev.selected_students.filter(s => s.id !== studentId)
    }));
  };

  const handleToggleFacultyInRes = (faculty) => {
    if (!faculty || !faculty.id) return;
    const exists = resForm.faculty_ids.includes(faculty.id);
    if (exists) {
      setResForm(prev => ({
        ...prev,
        faculty_ids: prev.faculty_ids.filter(id => id !== faculty.id),
        selected_faculty: prev.selected_faculty.filter(f => f.id !== faculty.id)
      }));
    } else {
      setResForm(prev => ({
        ...prev,
        faculty_ids: [...prev.faculty_ids, faculty.id],
        selected_faculty: [...prev.selected_faculty, faculty]
      }));
    }
  };

  const handleSaveResearch = async (e, submitForApprovalOverride) => {
    if (e) e.preventDefault();

    if (!resForm.title.trim()) {
      alert('Research or publication title is required.');
      return;
    }
    if (!resForm.publication_type) {
      alert('Publication type is required.');
      return;
    }
    if (!resForm.publication_date) {
      alert('Publication date is required.');
      return;
    }
    if (parseFloat(resForm.funding_amount) < 0) {
      alert('Funding amount cannot be negative.');
      return;
    }

    setResFormSubmitting(true);
    try {
      const payload = {
        ...resForm,
        submit_for_approval: submitForApprovalOverride !== undefined ? submitForApprovalOverride : resForm.submit_for_approval,
        funding_amount: parseFloat(resForm.funding_amount) || 0
      };

      if (editingRes) {
        await api.updateResearch(editingRes.id, payload);
        setNotification({ type: 'success', text: `Research publication #${editingRes.id} updated successfully.` });
      } else {
        await api.createResearch(payload);
        setNotification({ type: 'success', text: 'New research publication recorded successfully.' });
      }

      setResModalOpen(false);
      loadResearchStats();
      loadResearchRecords(1);
    } catch (err) {
      alert('Error saving research record: ' + err.message);
    } finally {
      setResFormSubmitting(false);
    }
  };

  const handleDeleteResearch = async (record) => {
    if (!window.confirm(`Are you sure you want to delete research record #${record.id} ("${record.title}")?`)) {
      return;
    }
    try {
      await api.deleteResearch(record.id);
      setNotification({ type: 'info', text: `Research record #${record.id} deleted.` });
      loadResearchStats();
      loadResearchRecords(resPage);
    } catch (err) {
      alert('Failed to delete research record: ' + err.message);
    }
  };

  const handleSubmitResearch = async (record) => {
    try {
      await api.submitResearch(record.id);
      setNotification({ type: 'success', text: `Research record #${record.id} submitted for approval!` });
      loadResearchStats();
      loadResearchRecords(resPage);
    } catch (err) {
      alert('Failed to submit: ' + err.message);
    }
  };

  // ------------------------------------------
  // PROJECTS DATA FETCHERS & ACTIONS
  // ------------------------------------------
  const loadProjectStats = async () => {
    setPrjStatsLoading(true);
    try {
      const data = await api.getProjectStats(prjFilters.academicYear, prjFilters.department);
      if (data) setPrjStats(data);
    } catch (err) {
      console.error('Failed to load project stats:', err);
    } finally {
      setPrjStatsLoading(false);
    }
  };

  const loadProjectRecords = async (pageNum = prjPage, customFilters = prjFilters) => {
    setPrjLoading(true);
    try {
      const res = await api.getProjects({
        department: customFilters.department,
        academicYear: customFilters.academicYear,
        projectCategory: customFilters.projectCategory,
        projectStatus: customFilters.projectStatus,
        status: customFilters.status,
        search: customFilters.search,
        page: pageNum,
        limit: 10
      });
      setPrjRecords(res.records || []);
      setPrjTotal(res.total || 0);
      setPrjPage(res.page || 1);
    } catch (err) {
      setNotification({ type: 'error', text: 'Failed to load project records: ' + err.message });
    } finally {
      setPrjLoading(false);
    }
  };

  const handleApplyPrjFilters = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    loadProjectRecords(1, prjFilters);
  };

  const handleClearPrjFilters = () => {
    const cleared = {
      search: '',
      academicYear: academicYear || '2025-26',
      department: isHOD || isFaculty ? user?.department : '',
      projectCategory: '',
      projectStatus: '',
      status: ''
    };
    setPrjFilters(cleared);
    loadProjectRecords(1, cleared);
  };

  const openCreatePrjModal = () => {
    setEditingPrj(null);
    setPrjForm({
      ...initialPrjForm,
      department: isHOD || isFaculty ? user?.department : (department || 'Computer Science and Engineering'),
      academic_year: academicYear || '2025-26',
      coordinator: user?.name || ''
    });
    setPrjModalOpen(true);
  };

  const openEditPrjModal = async (record) => {
    try {
      const data = await api.getProjectById(record.id);
      setEditingPrj(data);
      setPrjForm({
        project_title: data.project_title || '',
        description: data.description || '',
        project_category: data.project_category || 'Academic Project',
        project_type: data.project_type || 'Major Project',
        department: data.department || '',
        academic_year: data.academic_year || '2025-26',
        start_date: data.start_date || '',
        completion_date: data.completion_date || '',
        coordinator: data.coordinator || '',
        coordinator_faculty_id: data.coordinator_faculty_id || null,
        project_status: data.project_status || 'Ongoing',
        funding_agency: data.funding_agency || '',
        funding_amount: data.funding_amount || 0,
        industry_partner: data.industry_partner || '',
        competition_name: data.competition_name || '',
        awards_recognition: data.awards_recognition || '',
        project_url: data.project_url || '',
        document_path: data.document_path || '',
        student_ids: (data.students || []).map(s => s.id),
        faculty_ids: (data.faculty || []).map(f => f.id),
        selected_students: data.students || [],
        selected_faculty: data.faculty || [],
        submit_for_approval: data.status === 'Pending Approval' || data.status === 'Changes Requested'
      });
      setPrjModalOpen(true);
    } catch (err) {
      alert('Failed to load project details for editing: ' + err.message);
    }
  };

  const openViewPrjModal = async (record) => {
    try {
      const data = await api.getProjectById(record.id);
      setPrjDetailModal({ isOpen: true, record: data });
    } catch (err) {
      alert('Failed to fetch project details: ' + err.message);
    }
  };

  const handlePrjFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selected file exceeds maximum limit of 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    setPrjFileUploadProgress(true);
    reader.onload = async () => {
      try {
        const res = await api.uploadProjectDocument(file.name, reader.result);
        setPrjForm(prev => ({
          ...prev,
          document_path: res.document_path
        }));
        setNotification({ type: 'success', text: `Project document "${file.name}" uploaded successfully!` });
      } catch (err) {
        alert('File upload failed: ' + err.message);
      } finally {
        setPrjFileUploadProgress(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddStudentToPrj = (student) => {
    if (!student || !student.id) return;
    if (prjForm.student_ids.includes(student.id)) return;
    setPrjForm(prev => ({
      ...prev,
      student_ids: [...prev.student_ids, student.id],
      selected_students: [...prev.selected_students, student]
    }));
  };

  const handleRemoveStudentFromPrj = (studentId) => {
    setPrjForm(prev => ({
      ...prev,
      student_ids: prev.student_ids.filter(id => id !== studentId),
      selected_students: prev.selected_students.filter(s => s.id !== studentId)
    }));
  };

  const handleToggleFacultyInPrj = (faculty) => {
    if (!faculty || !faculty.id) return;
    const exists = prjForm.faculty_ids.includes(faculty.id);
    if (exists) {
      setPrjForm(prev => ({
        ...prev,
        faculty_ids: prev.faculty_ids.filter(id => id !== faculty.id),
        selected_faculty: prev.selected_faculty.filter(f => f.id !== faculty.id)
      }));
    } else {
      setPrjForm(prev => ({
        ...prev,
        faculty_ids: [...prev.faculty_ids, faculty.id],
        selected_faculty: [...prev.selected_faculty, faculty]
      }));
    }
  };

  const handleSaveProject = async (e, submitForApprovalOverride) => {
    if (e) e.preventDefault();

    if (!prjForm.project_title.trim()) {
      alert('Project title is required.');
      return;
    }
    if (!prjForm.project_category) {
      alert('Project category is required.');
      return;
    }
    if (!prjForm.project_type) {
      alert('Project type is required.');
      return;
    }
    if (prjForm.start_date && prjForm.completion_date && prjForm.start_date > prjForm.completion_date) {
      alert('Start date cannot be after completion date.');
      return;
    }
    if (parseFloat(prjForm.funding_amount) < 0) {
      alert('Funding amount cannot be negative.');
      return;
    }

    setPrjFormSubmitting(true);
    try {
      const payload = {
        ...prjForm,
        submit_for_approval: submitForApprovalOverride !== undefined ? submitForApprovalOverride : prjForm.submit_for_approval,
        funding_amount: parseFloat(prjForm.funding_amount) || 0
      };

      if (editingPrj) {
        await api.updateProject(editingPrj.id, payload);
        setNotification({ type: 'success', text: `Project #${editingPrj.id} updated successfully.` });
      } else {
        await api.createProject(payload);
        setNotification({ type: 'success', text: 'New project record created successfully.' });
      }

      setPrjModalOpen(false);
      loadProjectStats();
      loadProjectRecords(1);
    } catch (err) {
      alert('Error saving project record: ' + err.message);
    } finally {
      setPrjFormSubmitting(false);
    }
  };

  const handleDeleteProject = async (record) => {
    if (!window.confirm(`Are you sure you want to delete project record #${record.id} ("${record.project_title}")?`)) {
      return;
    }
    try {
      await api.deleteProject(record.id);
      setNotification({ type: 'info', text: `Project record #${record.id} deleted.` });
      loadProjectStats();
      loadProjectRecords(prjPage);
    } catch (err) {
      alert('Failed to delete project: ' + err.message);
    }
  };

  const handleSubmitProject = async (record) => {
    try {
      await api.submitProject(record.id);
      setNotification({ type: 'success', text: `Project #${record.id} submitted for approval!` });
      loadProjectStats();
      loadProjectRecords(prjPage);
    } catch (err) {
      alert('Failed to submit: ' + err.message);
    }
  };

  // Status Badge Class Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved': return 'badge-status-approved';
      case 'Pending Approval': return 'badge-status-pending';
      case 'Changes Requested': return 'badge-status-changes';
      case 'Draft': return 'badge-slate';
      case 'Rejected': return 'badge-red';
      default: return 'badge-slate';
    }
  };

  // Pagination calculation
  const resTotalPages = Math.ceil(resTotal / 10) || 1;
  const prjTotalPages = Math.ceil(prjTotal / 10) || 1;

  // Check edit permission for UI buttons
  const canEditRecord = (record) => {
    if (isAdmin) return true;
    if (isHOD) return (record.department || '').toLowerCase() === (user?.department || '').toLowerCase();
    if (isFaculty) {
      return record.submitted_by === user?.id && (record.status === 'Draft' || record.status === 'Changes Requested');
    }
    return false;
  };

  const canDeleteRecord = (record) => {
    if (isAdmin) return true;
    if (isHOD) return (record.department || '').toLowerCase() === (user?.department || '').toLowerCase();
    if (isFaculty) {
      return record.submitted_by === user?.id && record.status === 'Draft';
    }
    return false;
  };

  return (
    <div>
      {/* Header Banner */}
      <div className="content-card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.6rem' }}>🔬</span>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Research, Publications & Project Management
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0' }}>
              Record faculty and student research papers, patents, sponsored projects, and hackathon innovations for{' '}
              <strong style={{ color: 'var(--primary)' }}>{isHOD || isFaculty ? user?.department : (department || 'All Departments')}</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={activeTab === 'research' ? openCreateResModal : openCreatePrjModal}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              <span>+</span>
              <span>{activeTab === 'research' ? 'New Publication / Patent' : 'New Project Record'}</span>
            </button>
          </div>
        </div>

        {/* Top-Level Module Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.1rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('research')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'research' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'research' ? '3px solid var(--primary)' : '3px solid transparent',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <span>📄</span>
            <span>Research & Publications</span>
            <span className="badge badge-slate" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
              {resStats.totalRecords}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'projects' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'projects' ? '3px solid var(--primary)' : '3px solid transparent',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <span>🚀</span>
            <span>Projects & Innovations</span>
            <span className="badge badge-slate" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
              {prjStats.totalProjects}
            </span>
          </button>
        </div>
      </div>

      {/* Notifications Banner */}
      {notification.text && (
        <div className={`alert alert-${notification.type}`} style={{ marginBottom: '1.5rem' }}>
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification({ type: '', text: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', float: 'right' }}
          >
            ×
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: RESEARCH & PUBLICATIONS VIEW                       */}
      {/* ======================================================== */}
      {activeTab === 'research' && (
        <div>
          {/* Research KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Research</span>
                <span style={{ fontSize: '1.1rem' }}>📚</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#1e40af' }}>{resStats.totalRecords}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Logged records</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Approved</span>
                <span style={{ fontSize: '1.1rem' }}>✅</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#047857' }}>{resStats.approvedPublications}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Official annual report</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Journal Articles</span>
                <span style={{ fontSize: '1.1rem' }}>📑</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#6d28d9' }}>{resStats.journalPublications}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Peer-reviewed</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #0891b2' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Conferences</span>
                <span style={{ fontSize: '1.1rem' }}>🎤</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#0e7490' }}>{resStats.conferencePublications}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>National & Global</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #d97706' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Patents & IP</span>
                <span style={{ fontSize: '1.1rem' }}>💡</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#b45309' }}>{resStats.patents}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Published / Granted</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Funded Research</span>
                <span style={{ fontSize: '1.1rem' }}>💰</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#15803d' }}>
                {resStats.fundedResearchCount} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>({resStats.totalFundingAmount || 0} L)</span>
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Grants & agencies</p>
            </div>
          </div>

          {/* Research Filters Bar (Placed DIRECTLY Above Table) */}
          <div className="content-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>⚡</span>
                <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Filter & Search Publications
                </h4>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Database-backed live query</span>
            </div>

            <form onSubmit={handleApplyResFilters}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                {/* Search */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Search Title / DOI / ID
                  </label>
                  <input
                    type="text"
                    placeholder="Search by title, DOI, or #RES-XX..."
                    className="form-control"
                    value={resFilters.search}
                    onChange={(e) => setResFilters({ ...resFilters, search: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>

                {/* Academic Year */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Academic Year
                  </label>
                  <select
                    className="form-control"
                    value={resFilters.academicYear}
                    onChange={(e) => setResFilters({ ...resFilters, academicYear: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="All">All Years</option>
                    {academicYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Department
                  </label>
                  <select
                    className="form-control"
                    value={resFilters.department}
                    onChange={(e) => setResFilters({ ...resFilters, department: e.target.value })}
                    disabled={isHOD || isFaculty}
                    style={{ width: '100%', height: '38px' }}
                  >
                    {isAdmin && <option value="All">All Departments</option>}
                    {departments.map(d => (
                      <option key={d.name || d} value={d.name || d}>{d.name || d}</option>
                    ))}
                  </select>
                </div>

                {/* Publication Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Publication Type
                  </label>
                  <select
                    className="form-control"
                    value={resFilters.publicationType}
                    onChange={(e) => setResFilters({ ...resFilters, publicationType: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">All Types</option>
                    {PUBLICATION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Approval Status
                  </label>
                  <select
                    className="form-control"
                    value={resFilters.status}
                    onChange={(e) => setResFilters({ ...resFilters, status: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Changes Requested">Changes Requested</option>
                    <option value="Draft">Draft</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '38px' }}>
                    Apply
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleClearResFilters} style={{ height: '38px' }}>
                    Clear
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Research Records Table */}
          <div className="content-card" style={{ padding: '0', overflow: 'hidden', background: '#ffffff' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>ID</th>
                    <th style={{ minWidth: '220px' }}>Title & Research Area</th>
                    <th style={{ minWidth: '130px' }}>Type / Category</th>
                    <th style={{ minWidth: '180px' }}>Authors & Affiliations</th>
                    <th style={{ minWidth: '150px' }}>Journal / Publisher / DOI</th>
                    <th style={{ minWidth: '100px' }}>Funding</th>
                    <th style={{ minWidth: '110px' }}>Status</th>
                    <th style={{ minWidth: '130px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resLoading ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading research records...
                      </td>
                    </tr>
                  ) : resRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No research records found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    resRecords.map(record => (
                      <tr key={record.id}>
                        <td>
                          <span className="badge badge-purple" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {record.recordCode}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                            {record.title}
                          </div>
                          {record.research_area && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              Area: {record.research_area}
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {record.department} &bull; {record.academic_year}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                            {record.publication_type}
                          </span>
                          {record.research_category && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              {record.research_category}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                            {record.author_names || 'Department Team'}
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                            {record.students?.length > 0 && (
                              <span className="badge badge-teal" style={{ fontSize: '0.68rem' }} title={record.students.map(s => s.name).join(', ')}>
                                🎓 {record.students.length} Student{record.students.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {record.faculty?.length > 0 && (
                              <span className="badge badge-slate" style={{ fontSize: '0.68rem' }} title={record.faculty.map(f => f.faculty_name).join(', ')}>
                                👨‍🏫 {record.faculty.length} Faculty
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                            {record.journal_conference_name || record.publisher || '-'}
                          </div>
                          {record.doi && (
                            <div style={{ fontSize: '0.74rem', marginTop: '0.15rem' }}>
                              <a
                                href={record.doi.startsWith('http') ? record.doi : `https://doi.org/${record.doi}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--primary)', textDecoration: 'none' }}
                              >
                                🔗 DOI Link
                              </a>
                            </div>
                          )}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            {record.publication_date}
                          </div>
                        </td>
                        <td>
                          {record.funding_amount > 0 ? (
                            <div style={{ color: '#047857', fontWeight: 700, fontSize: '0.82rem' }}>
                              ₹{record.funding_amount} L
                              <div style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                {record.funding_agency || 'Grant'}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Non-Funded</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadge(record.status)}`} style={{ fontSize: '0.75rem' }}>
                            {record.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openViewResModal(record)}
                              title="View full submission details"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            >
                              View
                            </button>

                            {canEditRecord(record) && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEditResModal(record)}
                                title="Edit this record"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              >
                                Edit
                              </button>
                            )}

                            {record.submitted_by === user?.id && (record.status === 'Draft' || record.status === 'Changes Requested') && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSubmitResearch(record)}
                                title="Submit for HOD review"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              >
                                Submit
                              </button>
                            )}

                            {canDeleteRecord(record) && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteResearch(record)}
                                title="Delete record"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              >
                                Del
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {resTotal > 10 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Showing {(resPage - 1) * 10 + 1} to {Math.min(resPage * 10, resTotal)} of {resTotal} records
                </span>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={resPage <= 1}
                    onClick={() => loadResearchRecords(resPage - 1)}
                  >
                    &larr; Prev
                  </button>
                  {Array.from({ length: resTotalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${p === resPage ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => loadResearchRecords(p)}
                      style={{ minWidth: '32px' }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={resPage >= resTotalPages}
                    onClick={() => loadResearchRecords(resPage + 1)}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PROJECTS & INNOVATIONS VIEW                       */}
      {/* ======================================================== */}
      {activeTab === 'projects' && (
        <div>
          {/* Projects KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #4f46e5' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Projects</span>
                <span style={{ fontSize: '1.1rem' }}>🚀</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#4338ca' }}>{prjStats.totalProjects}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>All recorded projects</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Completed</span>
                <span style={{ fontSize: '1.1rem' }}>🎯</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#047857' }}>{prjStats.completedProjects}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Approved submissions</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #0891b2' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ongoing / In Progress</span>
                <span style={{ fontSize: '1.1rem' }}>⚙️</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#0e7490' }}>{prjStats.ongoingProjects}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active development</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Funded / Sponsored</span>
                <span style={{ fontSize: '1.1rem' }}>💵</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#15803d' }}>
                {prjStats.fundedProjects} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>({prjStats.totalFundingAmount || 0} L)</span>
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Grants & Industry</p>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #d97706' }}>
              <div className="stat-card-top">
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Award Winners</span>
                <span style={{ fontSize: '1.1rem' }}>🏆</span>
              </div>
              <h3 style={{ margin: '0.3rem 0', color: '#b45309' }}>{prjStats.awardWinningProjects}</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hackathons & expos</p>
            </div>
          </div>

          {/* Project Filters Bar (Placed DIRECTLY Above Table) */}
          <div className="content-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>⚡</span>
                <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Filter & Search Projects
                </h4>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Database-backed live query</span>
            </div>

            <form onSubmit={handleApplyPrjFilters}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                {/* Search */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Search Title / Guide / ID
                  </label>
                  <input
                    type="text"
                    placeholder="Search title, guide, #PRJ-XX..."
                    className="form-control"
                    value={prjFilters.search}
                    onChange={(e) => setPrjFilters({ ...prjFilters, search: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>

                {/* Academic Year */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Academic Year
                  </label>
                  <select
                    className="form-control"
                    value={prjFilters.academicYear}
                    onChange={(e) => setPrjFilters({ ...prjFilters, academicYear: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="All">All Years</option>
                    {academicYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Department
                  </label>
                  <select
                    className="form-control"
                    value={prjFilters.department}
                    onChange={(e) => setPrjFilters({ ...prjFilters, department: e.target.value })}
                    disabled={isHOD || isFaculty}
                    style={{ width: '100%', height: '38px' }}
                  >
                    {isAdmin && <option value="All">All Departments</option>}
                    {departments.map(d => (
                      <option key={d.name || d} value={d.name || d}>{d.name || d}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Project Category
                  </label>
                  <select
                    className="form-control"
                    value={prjFilters.projectCategory}
                    onChange={(e) => setPrjFilters({ ...prjFilters, projectCategory: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">All Categories</option>
                    {PROJECT_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Project Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Project Progress
                  </label>
                  <select
                    className="form-control"
                    value={prjFilters.projectStatus}
                    onChange={(e) => setPrjFilters({ ...prjFilters, projectStatus: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">All Progress</option>
                    {PROJECT_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Approval Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Approval Status
                  </label>
                  <select
                    className="form-control"
                    value={prjFilters.status}
                    onChange={(e) => setPrjFilters({ ...prjFilters, status: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Changes Requested">Changes Requested</option>
                    <option value="Draft">Draft</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '38px' }}>
                    Apply
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleClearPrjFilters} style={{ height: '38px' }}>
                    Clear
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Projects Table */}
          <div className="content-card" style={{ padding: '0', overflow: 'hidden', background: '#ffffff' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>ID</th>
                    <th style={{ minWidth: '220px' }}>Project Title & Details</th>
                    <th style={{ minWidth: '130px' }}>Category & Type</th>
                    <th style={{ minWidth: '170px' }}>Student Team</th>
                    <th style={{ minWidth: '140px' }}>Guide / Coordinator</th>
                    <th style={{ minWidth: '120px' }}>Funding / Sponsor</th>
                    <th style={{ minWidth: '110px' }}>Status</th>
                    <th style={{ minWidth: '130px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prjLoading ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading project records...
                      </td>
                    </tr>
                  ) : prjRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No project records found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    prjRecords.map(record => (
                      <tr key={record.id}>
                        <td>
                          <span className="badge badge-indigo" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {record.recordCode}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                            {record.project_title}
                          </div>
                          {record.awards_recognition && (
                            <div style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 600, marginTop: '0.15rem' }}>
                              ★ {record.awards_recognition}
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {record.department} &bull; {record.academic_year}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
                            {record.project_category}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {record.project_type}
                          </div>
                        </td>
                        <td>
                          {record.students?.length > 0 ? (
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {record.students.length} Student Member{record.students.length > 1 ? 's' : ''}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                {record.students.slice(0, 2).map(s => (
                                  <span key={s.id} className="badge badge-slate" style={{ fontSize: '0.68rem' }}>
                                    {s.name}
                                  </span>
                                ))}
                                {record.students.length > 2 && (
                                  <span className="badge badge-slate" style={{ fontSize: '0.68rem' }}>
                                    +{record.students.length - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No student team</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                            {record.coordinator || 'Faculty Coordinator'}
                          </div>
                          {record.faculty?.length > 0 && (
                            <span className="badge badge-blue" style={{ fontSize: '0.68rem', marginTop: '0.2rem' }}>
                              +{record.faculty.length} Faculty Advisor{record.faculty.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td>
                          {record.funding_amount > 0 ? (
                            <div style={{ color: '#047857', fontWeight: 700, fontSize: '0.82rem' }}>
                              ₹{record.funding_amount} L
                              <div style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                {record.funding_agency || record.industry_partner || 'Sponsor'}
                              </div>
                            </div>
                          ) : record.industry_partner ? (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                              Partner: {record.industry_partner}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Institutional</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadge(record.status)}`} style={{ fontSize: '0.75rem' }}>
                            {record.status}
                          </span>
                          <div style={{ marginTop: '0.2rem' }}>
                            <span className="badge badge-slate" style={{ fontSize: '0.68rem' }}>
                              {record.project_status || 'Ongoing'}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openViewPrjModal(record)}
                              title="View full project details"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            >
                              View
                            </button>

                            {canEditRecord(record) && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEditPrjModal(record)}
                                title="Edit project"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              >
                                Edit
                              </button>
                            )}

                            {record.submitted_by === user?.id && (record.status === 'Draft' || record.status === 'Changes Requested') && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSubmitProject(record)}
                                title="Submit for HOD review"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              >
                                Submit
                              </button>
                            )}

                            {canDeleteRecord(record) && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteProject(record)}
                                title="Delete project"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              >
                                Del
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {prjTotal > 10 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Showing {(prjPage - 1) * 10 + 1} to {Math.min(prjPage * 10, prjTotal)} of {prjTotal} projects
                </span>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={prjPage <= 1}
                    onClick={() => loadProjectRecords(prjPage - 1)}
                  >
                    &larr; Prev
                  </button>
                  {Array.from({ length: prjTotalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${p === prjPage ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => loadProjectRecords(p)}
                      style={{ minWidth: '32px' }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={prjPage >= prjTotalPages}
                    onClick={() => loadProjectRecords(prjPage + 1)}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE / EDIT RESEARCH RECORD                    */}
      {/* ======================================================== */}
      {resModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>
                {editingRes ? `Edit Publication #${editingRes.id}` : 'Record Research / Publication / Patent'}
              </h3>
              <button
                type="button"
                onClick={() => setResModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => handleSaveResearch(e, true)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {/* Title */}
                <div>
                  <label className="form-label">
                    Research / Publication Title <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Federated Learning for Privacy-Preserving Healthcare..."
                    value={resForm.title}
                    onChange={(e) => setResForm({ ...resForm, title: e.target.value })}
                  />
                </div>

                {/* Abstract / Description */}
                <div>
                  <label className="form-label">Abstract / Research Summary</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Provide abstract, novel contributions, or brief summary..."
                    value={resForm.description}
                    onChange={(e) => setResForm({ ...resForm, description: e.target.value })}
                  />
                </div>

                {/* Row 1: Publication Type, Category, Academic Year */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Publication Type <span style={{ color: 'red' }}>*</span></label>
                    <select
                      className="form-control"
                      value={resForm.publication_type}
                      onChange={(e) => setResForm({ ...resForm, publication_type: e.target.value })}
                    >
                      {PUBLICATION_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Research Category</label>
                    <select
                      className="form-control"
                      value={resForm.research_category}
                      onChange={(e) => setResForm({ ...resForm, research_category: e.target.value })}
                    >
                      {RESEARCH_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Academic Year <span style={{ color: 'red' }}>*</span></label>
                    <select
                      className="form-control"
                      value={resForm.academic_year}
                      onChange={(e) => setResForm({ ...resForm, academic_year: e.target.value })}
                    >
                      {academicYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Department, Publication Date, Research Area */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Department <span style={{ color: 'red' }}>*</span></label>
                    <select
                      className="form-control"
                      value={resForm.department}
                      onChange={(e) => setResForm({ ...resForm, department: e.target.value })}
                      disabled={isHOD || isFaculty}
                    >
                      {departments.map(d => (
                        <option key={d.name || d} value={d.name || d}>{d.name || d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Publication Date <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={resForm.publication_date}
                      onChange={(e) => setResForm({ ...resForm, publication_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Research Area</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AI & Machine Learning, VLSI, Cybersecurity"
                      value={resForm.research_area}
                      onChange={(e) => setResForm({ ...resForm, research_area: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 3: Journal/Conference Name, Publisher, DOI */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Journal / Conference Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. IEEE Transactions on Neural Networks"
                      value={resForm.journal_conference_name}
                      onChange={(e) => setResForm({ ...resForm, journal_conference_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Publisher</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. IEEE, Springer, ACM, Elsevier"
                      value={resForm.publisher}
                      onChange={(e) => setResForm({ ...resForm, publisher: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">DOI / Publication Link</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 10.1109/TNNLS.2024.1234567 or https://..."
                      value={resForm.doi}
                      onChange={(e) => setResForm({ ...resForm, doi: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 4: Funding Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Funding Agency (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. DST-SERB, AICTE, ISRO, Industry"
                      value={resForm.funding_agency}
                      onChange={(e) => setResForm({ ...resForm, funding_agency: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Funding Amount in Lakhs (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="0.00"
                      value={resForm.funding_amount}
                      onChange={(e) => setResForm({ ...resForm, funding_amount: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 5: Authors Names String */}
                <div>
                  <label className="form-label">All Authors (Listed in publication order)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Prof. Ramesh Kumar, Jaya Prakash S, Prof. Priya S"
                    value={resForm.author_names}
                    onChange={(e) => setResForm({ ...resForm, author_names: e.target.value })}
                  />
                </div>

                {/* Row 6: Multi-Student Linker (Reuses Smart StudentSearchDropdown with max 5 suggestions) */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🎓</span>
                    <span>Link Student Authors (Database Search - Max 5 Suggestions)</span>
                  </label>
                  <StudentSearchDropdown
                    label=""
                    placeholder="Search student by name or register number..."
                    department={resForm.department}
                    onSelect={handleAddStudentToRes}
                  />

                  {/* Selected Students Tags */}
                  {resForm.selected_students.length > 0 && (
                    <div style={{ marginTop: '0.65rem' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Linked Student Authors:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                        {resForm.selected_students.map(s => (
                          <span
                            key={s.id}
                            className="badge badge-teal"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem' }}
                          >
                            <span>{s.name} ({s.register_no})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveStudentFromRes(s.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 7: Faculty Co-Authors Multi-Select */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>👨‍🏫</span>
                    <span>Link Faculty Co-Authors</span>
                  </label>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {facultyList.map(f => {
                      const selected = resForm.faculty_ids.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleToggleFacultyInRes(f)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            borderRadius: '4px',
                            border: `1px solid ${selected ? 'var(--primary)' : '#cbd5e1'}`,
                            background: selected ? '#eff6ff' : '#ffffff',
                            color: selected ? 'var(--primary)' : 'var(--text-main)',
                            fontSize: '0.78rem',
                            fontWeight: selected ? 600 : 400,
                            cursor: 'pointer'
                          }}
                        >
                          {selected ? '✓ ' : '+ '}{f.faculty_name} ({f.designation || 'Faculty'})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 8: Supporting Document Upload */}
                <div>
                  <label className="form-label">Supporting Document (PDF or Paper Copy, max 5MB)</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleResFileUpload}
                    className="form-control"
                    disabled={resFileUploadProgress}
                  />
                  {resForm.document_path && (
                    <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.35rem' }}>
                      ✓ File attached:{' '}
                      <a href={resForm.document_path} target="_blank" rel="noreferrer" style={{ color: '#047857', fontWeight: 600 }}>
                        View uploaded document
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => handleSaveResearch(e, false)}
                  disabled={resFormSubmitting}
                >
                  Save as Draft
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resFormSubmitting}
                >
                  {resFormSubmitting ? 'Saving...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: VIEW RESEARCH DETAILS                            */}
      {/* ======================================================== */}
      {resDetailModal.isOpen && resDetailModal.record && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Research & Publication Dossier</h3>
                <span className="badge badge-purple" style={{ marginTop: '0.35rem' }}>
                  {resDetailModal.record.recordCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setResDetailModal({ isOpen: false, record: null })}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '1.05rem' }}>
                  {resDetailModal.record.title}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.85rem' }}>
                  <div><strong>Type:</strong> <span className="badge badge-blue">{resDetailModal.record.publication_type}</span></div>
                  <div><strong>Category:</strong> {resDetailModal.record.research_category || '-'}</div>
                  <div><strong>Department:</strong> {resDetailModal.record.department}</div>
                  <div><strong>Academic Year:</strong> {resDetailModal.record.academic_year}</div>
                  <div><strong>Date:</strong> {resDetailModal.record.publication_date}</div>
                  <div><strong>Research Area:</strong> {resDetailModal.record.research_area || '-'}</div>
                  <div><strong>Journal / Conference:</strong> {resDetailModal.record.journal_conference_name || '-'}</div>
                  <div><strong>Publisher:</strong> {resDetailModal.record.publisher || '-'}</div>
                  <div>
                    <strong>Funding:</strong>{' '}
                    {resDetailModal.record.funding_amount > 0 ? (
                      <span style={{ color: '#047857', fontWeight: 700 }}>
                        ₹{resDetailModal.record.funding_amount} Lakhs ({resDetailModal.record.funding_agency || 'Grant'})
                      </span>
                    ) : 'Non-Funded'}
                  </div>
                  <div>
                    <strong>DOI / URL:</strong>{' '}
                    {resDetailModal.record.doi ? (
                      <a href={resDetailModal.record.doi.startsWith('http') ? resDetailModal.record.doi : `https://doi.org/${resDetailModal.record.doi}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                        {resDetailModal.record.doi}
                      </a>
                    ) : '-'}
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                  <strong>Author Names:</strong> {resDetailModal.record.author_names || '-'}
                </div>

                {resDetailModal.record.description && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', lineHeight: '1.45' }}>
                    <strong>Abstract / Summary:</strong>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
                      {resDetailModal.record.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Students */}
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <strong>Linked Student Authors ({resDetailModal.record.students?.length || 0}):</strong>
                {resDetailModal.record.students?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                    {resDetailModal.record.students.map(s => (
                      <span key={s.id} className="badge badge-teal" style={{ fontSize: '0.75rem' }}>
                        🎓 {s.name} ({s.register_no}) — {s.department}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                    No student authors linked.
                  </div>
                )}
              </div>

              {/* Linked Faculty */}
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <strong>Linked Faculty Authors ({resDetailModal.record.faculty?.length || 0}):</strong>
                {resDetailModal.record.faculty?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                    {resDetailModal.record.faculty.map(f => (
                      <span key={f.id} className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                        👨‍🏫 {f.faculty_name} ({f.designation || 'Faculty'})
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                    No faculty authors linked.
                  </div>
                )}
              </div>

              {/* Attached Document */}
              {resDetailModal.record.document_path && (
                <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                  <strong>Supporting Paper Document:</strong>{' '}
                  <a href={resDetailModal.record.document_path} target="_blank" rel="noreferrer" style={{ color: '#047857', fontWeight: 700 }}>
                    📄 Open Attached File
                  </a>
                </div>
              )}

              {/* Status and Review Feedback */}
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>Submitted By:</strong> {resDetailModal.record.submitted_by_name || 'Faculty Member'}</div>
                  <div><strong>Status:</strong> <span className={`badge ${getStatusBadge(resDetailModal.record.status)}`}>{resDetailModal.record.status}</span></div>
                </div>

                {resDetailModal.record.review_comments && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#991b1b', fontSize: '0.8rem' }}>
                    <strong>Reviewer Feedback:</strong> {resDetailModal.record.review_comments}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResDetailModal({ isOpen: false, record: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CREATE / EDIT PROJECT RECORD                     */}
      {/* ======================================================== */}
      {prjModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>
                {editingPrj ? `Edit Project #${editingPrj.id}` : 'Record Student & Faculty Project'}
              </h3>
              <button
                type="button"
                onClick={() => setPrjModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => handleSaveProject(e, true)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {/* Title */}
                <div>
                  <label className="form-label">
                    Project Title <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Autonomous Campus Navigation Shuttle..."
                    value={prjForm.project_title}
                    onChange={(e) => setPrjForm({ ...prjForm, project_title: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="form-label">Project Description / Objectives</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Summarize project scope, technology stack, and deliverables..."
                    value={prjForm.description}
                    onChange={(e) => setPrjForm({ ...prjForm, description: e.target.value })}
                  />
                </div>

                {/* Row 1: Category, Type, Academic Year */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Project Category <span style={{ color: 'red' }}>*</span></label>
                    <select
                      className="form-control"
                      value={prjForm.project_category}
                      onChange={(e) => setPrjForm({ ...prjForm, project_category: e.target.value })}
                    >
                      {PROJECT_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Project Type <span style={{ color: 'red' }}>*</span></label>
                    <select
                      className="form-control"
                      value={prjForm.project_type}
                      onChange={(e) => setPrjForm({ ...prjForm, project_type: e.target.value })}
                    >
                      {PROJECT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Academic Year <span style={{ color: 'red' }}>*</span></label>
                    <select
                      className="form-control"
                      value={prjForm.academic_year}
                      onChange={(e) => setPrjForm({ ...prjForm, academic_year: e.target.value })}
                    >
                      {academicYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Department, Dates, Status */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Department <span style={{ color: 'red' }}>*</span></label>
                    <select
                      className="form-control"
                      value={prjForm.department}
                      onChange={(e) => setPrjForm({ ...prjForm, department: e.target.value })}
                      disabled={isHOD || isFaculty}
                    >
                      {departments.map(d => (
                        <option key={d.name || d} value={d.name || d}>{d.name || d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={prjForm.start_date}
                      onChange={(e) => setPrjForm({ ...prjForm, start_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Completion Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={prjForm.completion_date}
                      onChange={(e) => setPrjForm({ ...prjForm, completion_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Project Progress</label>
                    <select
                      className="form-control"
                      value={prjForm.project_status}
                      onChange={(e) => setPrjForm({ ...prjForm, project_status: e.target.value })}
                    >
                      {PROJECT_STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Guide, Partner, Competition */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Project Guide / Coordinator</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Prof. Ramesh Kumar"
                      value={prjForm.coordinator}
                      onChange={(e) => setPrjForm({ ...prjForm, coordinator: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Industry / Organization Partner</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Tata Motors, Intel, DRDO"
                      value={prjForm.industry_partner}
                      onChange={(e) => setPrjForm({ ...prjForm, industry_partner: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Competition / Hackathon</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Smart India Hackathon 2025"
                      value={prjForm.competition_name}
                      onChange={(e) => setPrjForm({ ...prjForm, competition_name: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 4: Funding, Awards, Repository Link */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Funding Agency & Amount (₹ L)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Agency / Sponsor"
                        value={prjForm.funding_agency}
                        onChange={(e) => setPrjForm({ ...prjForm, funding_agency: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        placeholder="0.00"
                        value={prjForm.funding_amount}
                        onChange={(e) => setPrjForm({ ...prjForm, funding_amount: e.target.value })}
                        style={{ width: '90px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Awards or Recognition</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 1st Place & Best Hardware Demo"
                      value={prjForm.awards_recognition}
                      onChange={(e) => setPrjForm({ ...prjForm, awards_recognition: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Project / Repository URL</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. https://github.com/org/project"
                      value={prjForm.project_url}
                      onChange={(e) => setPrjForm({ ...prjForm, project_url: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 5: Multi-Student Linker (Reuses Smart StudentSearchDropdown with max 5 suggestions) */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🎓</span>
                    <span>Student Team Members (Search Database - Max 5 Suggestions)</span>
                  </label>
                  <StudentSearchDropdown
                    label=""
                    placeholder="Search student by name or register number..."
                    department={prjForm.department}
                    onSelect={handleAddStudentToPrj}
                  />

                  {/* Selected Students Tags */}
                  {prjForm.selected_students.length > 0 && (
                    <div style={{ marginTop: '0.65rem' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Student Team:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                        {prjForm.selected_students.map(s => (
                          <span
                            key={s.id}
                            className="badge badge-teal"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem' }}
                          >
                            <span>{s.name} ({s.register_no})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveStudentFromPrj(s.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 6: Faculty Co-Guides Multi-Select */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>👨‍🏫</span>
                    <span>Link Faculty Co-Guides / Advisors</span>
                  </label>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {facultyList.map(f => {
                      const selected = prjForm.faculty_ids.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleToggleFacultyInPrj(f)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            borderRadius: '4px',
                            border: `1px solid ${selected ? 'var(--primary)' : '#cbd5e1'}`,
                            background: selected ? '#eff6ff' : '#ffffff',
                            color: selected ? 'var(--primary)' : 'var(--text-main)',
                            fontSize: '0.78rem',
                            fontWeight: selected ? 600 : 400,
                            cursor: 'pointer'
                          }}
                        >
                          {selected ? '✓ ' : '+ '}{f.faculty_name} ({f.designation || 'Faculty'})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 7: Supporting Document Upload */}
                <div>
                  <label className="form-label">Supporting Document (Project Report, Demo Video Link, or Cert, max 5MB)</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handlePrjFileUpload}
                    className="form-control"
                    disabled={prjFileUploadProgress}
                  />
                  {prjForm.document_path && (
                    <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.35rem' }}>
                      ✓ File attached:{' '}
                      <a href={prjForm.document_path} target="_blank" rel="noreferrer" style={{ color: '#047857', fontWeight: 600 }}>
                        View uploaded document
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPrjModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => handleSaveProject(e, false)}
                  disabled={prjFormSubmitting}
                >
                  Save as Draft
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={prjFormSubmitting}
                >
                  {prjFormSubmitting ? 'Saving...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: VIEW PROJECT DETAILS                             */}
      {/* ======================================================== */}
      {prjDetailModal.isOpen && prjDetailModal.record && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Project Details & Dossier</h3>
                <span className="badge badge-indigo" style={{ marginTop: '0.35rem' }}>
                  {prjDetailModal.record.recordCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPrjDetailModal({ isOpen: false, record: null })}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '1.05rem' }}>
                  {prjDetailModal.record.project_title}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.85rem' }}>
                  <div><strong>Category:</strong> <span className="badge badge-teal">{prjDetailModal.record.project_category}</span></div>
                  <div><strong>Type:</strong> {prjDetailModal.record.project_type}</div>
                  <div><strong>Status:</strong> <span className="badge badge-slate">{prjDetailModal.record.project_status || 'Ongoing'}</span></div>
                  <div><strong>Department:</strong> {prjDetailModal.record.department}</div>
                  <div><strong>Academic Year:</strong> {prjDetailModal.record.academic_year}</div>
                  <div><strong>Timeline:</strong> {prjDetailModal.record.start_date || '-'} to {prjDetailModal.record.completion_date || 'Present'}</div>
                  <div><strong>Coordinator:</strong> {prjDetailModal.record.coordinator || '-'}</div>
                  <div><strong>Partner:</strong> {prjDetailModal.record.industry_partner || '-'}</div>
                  <div>
                    <strong>Funding:</strong>{' '}
                    {prjDetailModal.record.funding_amount > 0 ? (
                      <span style={{ color: '#047857', fontWeight: 700 }}>
                        ₹{prjDetailModal.record.funding_amount} Lakhs ({prjDetailModal.record.funding_agency || 'Sponsored'})
                      </span>
                    ) : 'Non-Funded'}
                  </div>
                  <div><strong>Hackathon / Event:</strong> {prjDetailModal.record.competition_name || '-'}</div>
                </div>

                {prjDetailModal.record.awards_recognition && (
                  <div style={{ marginTop: '0.65rem', padding: '0.5rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.82rem', fontWeight: 600 }}>
                    🏆 Awards & Recognition: {prjDetailModal.record.awards_recognition}
                  </div>
                )}

                {prjDetailModal.record.project_url && (
                  <div style={{ marginTop: '0.65rem', fontSize: '0.85rem' }}>
                    <strong>Project / Repository URL:</strong>{' '}
                    <a
                      href={prjDetailModal.record.project_url.startsWith('http') ? prjDetailModal.record.project_url : `https://${prjDetailModal.record.project_url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--primary)', fontWeight: 600 }}
                    >
                      {prjDetailModal.record.project_url}
                    </a>
                  </div>
                )}

                {prjDetailModal.record.description && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', lineHeight: '1.45' }}>
                    <strong>Description:</strong>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
                      {prjDetailModal.record.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Student Team */}
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <strong>Student Team Members ({prjDetailModal.record.students?.length || 0}):</strong>
                {prjDetailModal.record.students?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                    {prjDetailModal.record.students.map(s => (
                      <span key={s.id} className="badge badge-teal" style={{ fontSize: '0.75rem' }}>
                        🎓 {s.name} ({s.register_no}) — {s.department}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                    No student members linked.
                  </div>
                )}
              </div>

              {/* Linked Faculty Guides */}
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <strong>Faculty Guides & Advisors ({prjDetailModal.record.faculty?.length || 0}):</strong>
                {prjDetailModal.record.faculty?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                    {prjDetailModal.record.faculty.map(f => (
                      <span key={f.id} className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                        👨‍🏫 {f.faculty_name} ({f.designation || 'Faculty'})
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                    No faculty guides linked.
                  </div>
                )}
              </div>

              {/* Attached Document */}
              {prjDetailModal.record.document_path && (
                <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                  <strong>Supporting Project Document:</strong>{' '}
                  <a href={prjDetailModal.record.document_path} target="_blank" rel="noreferrer" style={{ color: '#047857', fontWeight: 700 }}>
                    📄 Open Attached File
                  </a>
                </div>
              )}

              {/* Status and Feedback */}
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>Submitted By:</strong> {prjDetailModal.record.submitted_by_name || 'Faculty Member'}</div>
                  <div><strong>Status:</strong> <span className={`badge ${getStatusBadge(prjDetailModal.record.status)}`}>{prjDetailModal.record.status}</span></div>
                </div>

                {prjDetailModal.record.review_comments && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#991b1b', fontSize: '0.8rem' }}>
                    <strong>Reviewer Feedback:</strong> {prjDetailModal.record.review_comments}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPrjDetailModal({ isOpen: false, record: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
