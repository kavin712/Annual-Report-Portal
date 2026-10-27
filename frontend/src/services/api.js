const API_BASE = '/api';

function getAuthHeaders() {
  try {
    const token = localStorage.getItem('iarp_token');
    const saved = localStorage.getItem('iarp_user');
    const headers = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (saved) {
      const user = JSON.parse(saved);
      if (user && user.id) {
        headers['x-user-id'] = String(user.id);
        if (!headers['Authorization']) {
          headers['Authorization'] = `Bearer ${user.id}`;
        }
      }
    }
    return headers;
  } catch (e) {}
  return {};
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const authHeaders = getAuthHeaders();

  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  getMe: () => request('/auth/me'),

  logout: () => {
    localStorage.removeItem('iarp_token');
    localStorage.removeItem('iarp_user');
    return request('/auth/logout', { method: 'POST' }).catch(() => ({}));
  },

  // Dashboard Stats
  getDashboardStats: (academicYear, department) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    return request(`/dashboard/stats?${params.toString()}`);
  },

  // Module 12: Admin Dashboard (Institute-level Overview)
  getAdminDashboard: (academicYear) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    return request(`/admin/dashboard?${params.toString()}`);
  },

  // Module 13: HOD Dashboard (Department-level Overview)
  getHODDashboard: (academicYear) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    return request(`/hod/dashboard?${params.toString()}`);
  },

  // Module 14: Faculty Dashboard (Individual Overview & Submissions)
  getFacultyDashboard: (academicYear) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    return request(`/faculty/dashboard?${params.toString()}`);
  },
  getFacultyProfile: () => request('/faculty/profile'),

  // Departments (Module 2: Complete Department Management)
  getDepartments: (search, status) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const qs = params.toString();
    return request(`/departments${qs ? `?${qs}` : ''}`);
  },
  getDepartment: (id) => request(`/departments/${id}`),
  createDepartment: (data) =>
    request('/departments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateDepartment: (id, data) =>
    request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  updateDepartmentStatus: (id, status) =>
    request(`/departments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
  getEligibleHods: () => request('/departments/eligible-hods'),
  getFacultyCandidates: () => request('/departments/faculty-candidates'),
  assignFacultyToDepartment: (id, user_ids) =>
    request(`/departments/${id}/faculty/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: Array.isArray(user_ids) ? user_ids : [user_ids] })
    }),
  removeFacultyFromDepartment: (id, user_id) =>
    request(`/departments/${id}/faculty/remove`, {
      method: 'POST',
      body: JSON.stringify({ user_id })
    }),

  // Students (Module 3: Student Management & Smart Search)
  searchStudents: (query, department) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (department) params.append('department', department);
    return request(`/students/search?${params.toString()}`);
  },
  getStudents: (search, department, batch, status) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (department) params.append('department', department);
    if (batch) params.append('batch', batch);
    if (status) params.append('status', status);
    const qs = params.toString();
    return request(`/students${qs ? `?${qs}` : ''}`);
  },
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (data) =>
    request('/students', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateStudent: (id, data) =>
    request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  updateStudentStatus: (id, status) =>
    request(`/students/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  // Department Reports
  getDepartmentReports: (academicYear, department) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    return request(`/department-reports?${params.toString()}`);
  },
  saveDepartmentReport: (data) =>
    request('/department-reports', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Student Achievements (CRUD & Approval & Certificates)
  getStudentAchievements: (academicYear, department, status, category, level, search) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    if (status && status !== 'All') params.append('status', status);
    if (category && category !== 'All') params.append('category', category);
    if (level && level !== 'All') params.append('level', level);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/student-achievements${qs ? `?${qs}` : ''}`);
  },
  getStudentAchievement: (id) => request(`/student-achievements/${id}`),
  addStudentAchievement: (data) =>
    request('/student-achievements', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateStudentAchievement: (id, data) =>
    request(`/student-achievements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteStudentAchievement: (id) =>
    request(`/student-achievements/${id}`, {
      method: 'DELETE'
    }),
  submitStudentAchievement: (id) =>
    request(`/student-achievements/${id}/submit`, {
      method: 'POST'
    }),
  approveStudentAchievement: (id, comments = '') =>
    request(`/student-achievements/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  requestAchievementChanges: (id, comments) =>
    request(`/student-achievements/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  uploadCertificate: (fileName, base64Data) =>
    request('/student-achievements/upload-certificate', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_data: base64Data })
    }),

  // Faculty (CRUD - HOD & Admin only)
  getFaculty: (academicYear, department, status, search) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/faculty${qs ? `?${qs}` : ''}`);
  },
  getFacultyMember: (id) => request(`/faculty/${id}`),
  addFaculty: (data) =>
    request('/faculty', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateFaculty: (id, data) =>
    request(`/faculty/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  updateFacultyStatus: (id, status) =>
    request(`/faculty/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
  deleteFaculty: (id) =>
    request(`/faculty/${id}`, {
      method: 'DELETE'
    }),
  getUnlinkedFacultyUsers: () => request('/faculty/unlinked-users'),

  // Activities (CRUD, Multi-Select Junctions & Approval Workflow)
  getActivities: (academicYear, department, status, category, search) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    return request(`/activities?${params.toString()}`);
  },
  getActivity: (id) => request(`/activities/${id}`),
  addActivity: (data) =>
    request('/activities', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateActivity: (id, data) =>
    request(`/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteActivity: (id) =>
    request(`/activities/${id}`, {
      method: 'DELETE'
    }),
  submitActivity: (id) =>
    request(`/activities/${id}/submit`, {
      method: 'POST'
    }),
  approveActivity: (id, comments = '') =>
    request(`/activities/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  requestActivityChanges: (id, comments) =>
    request(`/activities/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  uploadActivityDocument: (fileName, base64Data) =>
    request('/activities/upload-document', {
      method: 'POST',
      body: JSON.stringify({ fileName, base64Data })
    }),

  // Events Management (Module 7: Full CRUD, Multi-Select Junctions & Approval Workflow)
  getEvents: (academicYear, department, status, category, search) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    return request(`/events?${params.toString()}`);
  },
  getEvent: (id) => request(`/events/${id}`),
  addEvent: (data) =>
    request('/events', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateEvent: (id, data) =>
    request(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteEvent: (id) =>
    request(`/events/${id}`, {
      method: 'DELETE'
    }),
  submitEvent: (id) =>
    request(`/events/${id}/submit`, {
      method: 'POST'
    }),
  approveEvent: (id, comments = '') =>
    request(`/events/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  requestEventChanges: (id, comments) =>
    request(`/events/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  uploadEventDocument: (fileName, base64Data) =>
    request('/events/upload-document', {
      method: 'POST',
      body: JSON.stringify({ fileName, base64Data })
    }),

  // Placement Management: Individual Records & Auto Calculated Stats
  getPlacementRecords: (academicYear, department, status, placementStatus, batch, search, company) => {
    if (typeof academicYear === 'object' && academicYear !== null) {
      const opts = academicYear;
      const params = new URLSearchParams();
      if (opts.academicYear || opts.academic_year) params.append('academic_year', opts.academicYear || opts.academic_year);
      if (opts.department) params.append('department', opts.department);
      if (opts.status) params.append('status', opts.status);
      if (opts.placementStatus || opts.placement_status) params.append('placement_status', opts.placementStatus || opts.placement_status);
      if (opts.batch) params.append('batch', opts.batch);
      if (opts.company) params.append('company', opts.company);
      if (opts.search) params.append('search', opts.search);
      return request(`/placements/records?${params.toString()}`);
    }
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    if (status) params.append('status', status);
    if (placementStatus) params.append('placement_status', placementStatus);
    if (batch) params.append('batch', batch);
    if (search) params.append('search', search);
    if (company) params.append('company', company);
    return request(`/placements/records?${params.toString()}`);
  },
  getPlacementRecord: (id) => request(`/placements/records/${id}`),
  getPlacementStats: (academicYear, department, status, placementStatus, batch, company, search) => {
    if (typeof academicYear === 'object' && academicYear !== null) {
      const opts = academicYear;
      const params = new URLSearchParams();
      if (opts.academicYear || opts.academic_year) params.append('academic_year', opts.academicYear || opts.academic_year);
      if (opts.department) params.append('department', opts.department);
      if (opts.status) params.append('status', opts.status);
      if (opts.placementStatus || opts.placement_status) params.append('placement_status', opts.placementStatus || opts.placement_status);
      if (opts.batch) params.append('batch', opts.batch);
      if (opts.company) params.append('company', opts.company);
      if (opts.search) params.append('search', opts.search);
      return request(`/placements/stats?${params.toString()}`);
    }
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    if (status) params.append('status', status);
    if (placementStatus) params.append('placement_status', placementStatus);
    if (batch) params.append('batch', batch);
    if (company) params.append('company', company);
    if (search) params.append('search', search);
    return request(`/placements/stats?${params.toString()}`);
  },
  addPlacementRecord: (data) =>
    request('/placements/records', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updatePlacementRecord: (id, data) =>
    request(`/placements/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deletePlacementRecord: (id) =>
    request(`/placements/records/${id}`, {
      method: 'DELETE'
    }),
  submitPlacementRecord: (id) =>
    request(`/placements/records/${id}/submit`, {
      method: 'POST'
    }),
  approvePlacementRecord: (id, comments = '') =>
    request(`/placements/records/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  requestPlacementChanges: (id, comments) =>
    request(`/placements/records/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),

  // Approvals Center (HOD & Admin)
  getApprovalStats: (academicYear, department) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    return request(`/approvals/stats?${params.toString()}`);
  },
  getApprovalRecords: ({ academicYear, department, recordType, status, search, dateFrom, dateTo, sortBy, sortOrder, page, limit } = {}) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    if (recordType) params.append('record_type', recordType);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (sortBy) params.append('sort_by', sortBy);
    if (sortOrder) params.append('sort_order', sortOrder);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    return request(`/approvals/records?${params.toString()}`);
  },
  getApprovalRecordDetail: (module, id) => request(`/approvals/record/${module}/${id}`),
  getApprovalHistory: (module, id) => request(`/approvals/history/${module}/${id}`),
  getPendingApprovals: (academicYear, department) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    return request(`/approvals/pending?${params.toString()}`);
  },
  actOnApproval: (module, id, action, comments) =>
    request('/approvals/action', {
      method: 'POST',
      body: JSON.stringify({ module, id, action, comments })
    }),

  // Reports
  getReportReadiness: (academicYear, departments) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (departments) {
      const depts = Array.isArray(departments) ? departments.join(',') : departments;
      params.append('departments', depts);
    }
    return request(`/reports/readiness?${params.toString()}`);
  },
  previewReport: (config) =>
    request('/reports/preview', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
  generateReport: (config) =>
    request('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
  getStudentReportSummary: (studentId, { academicYear, startDate, endDate } = {}) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academicYear', academicYear);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    return request(`/reports/student/summary/${studentId}${qs ? `?${qs}` : ''}`);
  },
  previewStudentReport: (config) =>
    request('/reports/student/preview', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
  generateStudentReport: (config) =>
    request('/reports/student/generate', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
  getGeneratedReports: () => request('/reports'),
  getDownloadUrl: (id) => `/api/reports/${id}/download`,

  // Module 10: Research & Publications
  getResearch: ({ department, academicYear, publicationType, researchArea, author, status, search, page, limit } = {}) => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (academicYear) params.append('academic_year', academicYear);
    if (publicationType) params.append('publication_type', publicationType);
    if (researchArea) params.append('research_area', researchArea);
    if (author) params.append('author', author);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    return request(`/research?${params.toString()}`);
  },
  getResearchStats: (academicYear, department) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    return request(`/research/stats?${params.toString()}`);
  },
  getResearchById: (id) => request(`/research/${id}`),
  createResearch: (data) =>
    request('/research', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateResearch: (id, data) =>
    request(`/research/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteResearch: (id) =>
    request(`/research/${id}`, {
      method: 'DELETE'
    }),
  submitResearch: (id) =>
    request(`/research/${id}/submit`, {
      method: 'POST'
    }),
  approveResearch: (id) =>
    request(`/research/${id}/approve`, {
      method: 'POST'
    }),
  requestChangesResearch: (id, comments) =>
    request(`/research/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  uploadResearchDocument: (fileName, fileData) =>
    request('/research/upload-document', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_data: fileData })
    }),

  // Module 10: Project Management
  getProjects: ({ department, academicYear, projectCategory, projectStatus, studentId, facultyId, status, search, page, limit } = {}) => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (academicYear) params.append('academic_year', academicYear);
    if (projectCategory) params.append('project_category', projectCategory);
    if (projectStatus) params.append('project_status', projectStatus);
    if (studentId) params.append('student_id', studentId);
    if (facultyId) params.append('faculty_id', facultyId);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    return request(`/projects?${params.toString()}`);
  },
  getProjectStats: (academicYear, department) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    if (department) params.append('department', department);
    return request(`/projects/stats?${params.toString()}`);
  },
  getProjectById: (id) => request(`/projects/${id}`),
  createProject: (data) =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateProject: (id, data) =>
    request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteProject: (id) =>
    request(`/projects/${id}`, {
      method: 'DELETE'
    }),
  submitProject: (id) =>
    request(`/projects/${id}/submit`, {
      method: 'POST'
    }),
  approveProject: (id) =>
    request(`/projects/${id}/approve`, {
      method: 'POST'
    }),
  requestChangesProject: (id, comments) =>
    request(`/projects/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ comments })
    }),
  uploadProjectDocument: (fileName, fileData) =>
    request('/projects/upload-document', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_data: fileData })
    })
};

