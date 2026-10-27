const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { db, withTransaction, initDatabase } = require('./database');
const { verifyPassword, generateToken, verifyToken } = require('./services/auth');
const { generateAnnualReportPDF, generateStudentHistoryPDF } = require('./services/pdfGenerator');
const { getStudentHistoryData, validateStudentAccess } = require('./services/studentReportService');

// Initialize database & seed demo data
initDatabase();

const app = express();
const PORT = config.PORT || process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static reports directory if needed
const reportsDir = path.join(__dirname, 'generated_reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// ----------------------------------------------------
// AUTHENTICATION & SECURITY MIDDLEWARE
// ----------------------------------------------------
function getCurrentUser(req) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-user-id']) {
    token = req.headers['x-user-id'];
  }

  if (!token) return null;

  try {
    // 1. Try decoding token as a signed session token
    const payload = verifyToken(token);
    const userId = payload ? payload.id : token;

    const user = db.prepare('SELECT id, email, name, role, department FROM users WHERE id = ?').get(userId);
    return user || null;
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  req.user = user;
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = req.user || getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = user;

    const userRole = (user.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Role '${user.role}' is not authorized for this action. Allowed: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
}

function checkDepartmentAccess(user, requestedDept) {
  if (!user) return false;
  const userRole = (user.role || '').toLowerCase();
  if (userRole === 'admin') return true; // Admin has global institutional access
  if (!requestedDept) return true;

  // HOD and Faculty must match their assigned department
  return user.department && user.department.toLowerCase() === requestedDept.toLowerCase();
}

function recordApprovalHistory(recordType, recordId, prevStatus, newStatus, reviewerId, reviewerName, comment) {
  try {
    db.prepare(`
      INSERT INTO approval_history (
        record_type, record_id, previous_status, new_status, reviewer_id, reviewer_name, comment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(recordType, recordId, prevStatus || null, newStatus, reviewerId || null, reviewerName || null, comment || null);
  } catch (err) {
    console.error('[ApprovalHistory] Logging failed:', err.message);
  }
}

// ----------------------------------------------------
// 1. AUTHENTICATION (Admin, HOD, Faculty)
// ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, email, name, role, department, password FROM users WHERE email = ?').get(normalizedEmail);

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({
        error: 'Invalid email or password. Use demo credentials (e.g. admin@college.com, hod_cse@college.com, or faculty@college.com).'
      });
    }

    // Generate tamper-proof signed session token
    const token = generateToken(user);

    // Sanitize user object (never return password hash to client)
    const { password: _, ...userSafe } = user;

    res.json({
      success: true,
      token,
      user: userSafe
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// Current User Profile Verification
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// ----------------------------------------------------
// 2. DASHBOARD STATS & ROLE METRICS
// ----------------------------------------------------
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const { academic_year, department } = req.query;
    const user = getCurrentUser(req);

    // If HOD or Faculty, enforce their department if not admin
    let targetDept = department;
    if (user && user.role !== 'admin' && user.department) {
      targetDept = user.department;
    }

    const totalDepts = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;

    // Filtered or global counts
    let studentCountQuery = 'SELECT COALESCE(SUM(total_students), 0) as count FROM department_reports';
    let facultyCountQuery = 'SELECT COALESCE(SUM(total_faculty), 0) as count FROM department_reports';
    let activitiesCountQuery = "SELECT COUNT(*) as count FROM activities WHERE (status = 'Approved' OR status IS NULL)";
    const params = [];

    let whereClauses = [];
    if (academic_year) {
      whereClauses.push('academic_year = ?');
      params.push(academic_year);
    }
    if (targetDept) {
      whereClauses.push('(department_name = ? OR department_code = ?)');
      params.push(targetDept, targetDept);
    }

    if (whereClauses.length > 0) {
      const whereSQL = ' WHERE ' + whereClauses.join(' AND ');
      studentCountQuery += whereSQL;
      facultyCountQuery += whereSQL;
    }

    let actParams = [];
    if (academic_year) {
      activitiesCountQuery += ' AND academic_year = ?';
      actParams.push(academic_year);
    }
    if (targetDept) {
      activitiesCountQuery += ' AND department = ?';
      actParams.push(targetDept);
    }

    const totalStudents = db.prepare(studentCountQuery).get(...params)?.count || 0;
    const deptReportFaculty = db.prepare(facultyCountQuery).get(...params)?.count || 0;

    // Real registered active faculty count from faculty table
    let facultyQuery = "SELECT COUNT(*) as count FROM faculty WHERE (status = 'Active' OR status IS NULL)";
    let facultyParams = [];
    if (targetDept) {
      facultyQuery += ' AND (LOWER(department) = LOWER(?) OR department_id = (SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1))';
      facultyParams.push(targetDept, targetDept, targetDept);
    }
    const realFacultyCount = db.prepare(facultyQuery).get(...facultyParams)?.count || 0;
    const totalFaculty = realFacultyCount > 0 ? realFacultyCount : deptReportFaculty;

    const totalActivities = db.prepare(activitiesCountQuery).get(...actParams)?.count || 0;
    const reportsGenerated = db.prepare('SELECT COUNT(*) as count FROM generated_reports').get().count;

    // Real Events Statistics
    let eventsApprovedQuery = "SELECT COUNT(*) as count FROM events WHERE (status = 'Approved' OR status IS NULL)";
    let eventsPendingQuery = "SELECT COUNT(*) as count FROM events WHERE status = 'Pending Approval'";
    let evStatParams = [];
    if (academic_year && academic_year !== 'All') {
      eventsApprovedQuery += ' AND academic_year = ?';
      eventsPendingQuery += ' AND academic_year = ?';
      evStatParams.push(academic_year);
    }
    if (targetDept) {
      eventsApprovedQuery += ' AND department = ?';
      eventsPendingQuery += ' AND department = ?';
      evStatParams.push(targetDept);
    }
    const approvedEvents = db.prepare(eventsApprovedQuery).get(...evStatParams)?.count || 0;
    const pendingEvents = db.prepare(eventsPendingQuery).get(...evStatParams)?.count || 0;
    const totalEvents = approvedEvents;

    // Events by category
    let evCatQuery = "SELECT event_type as category, COUNT(*) as count FROM events WHERE (status = 'Approved' OR status IS NULL)";
    let evCatParams = [];
    if (targetDept) {
      evCatQuery += ' AND department = ?';
      evCatParams.push(targetDept);
    }
    evCatQuery += ' GROUP BY event_type ORDER BY count DESC';
    const eventsByCategory = db.prepare(evCatQuery).all(...evCatParams);

    // Events by department
    let evDeptQuery = "SELECT department, COUNT(*) as count FROM events WHERE (status = 'Approved' OR status IS NULL)";
    let evDeptParams = [];
    if (academic_year && academic_year !== 'All') {
      evDeptQuery += ' AND academic_year = ?';
      evDeptParams.push(academic_year);
    }
    evDeptQuery += ' GROUP BY department ORDER BY count DESC';
    const eventsByDepartment = db.prepare(evDeptQuery).all(...evDeptParams);

    // Research & Projects statistics for dashboard
    let resApprovedQuery = "SELECT COUNT(*) as count FROM research_publications WHERE (status = 'Approved' OR status IS NULL)";
    let prjApprovedQuery = "SELECT COUNT(*) as count FROM projects WHERE (status = 'Approved' OR status IS NULL)";
    const rpStatParams = [];
    if (academic_year && academic_year !== 'All') {
      resApprovedQuery += ' AND academic_year = ?';
      prjApprovedQuery += ' AND academic_year = ?';
      rpStatParams.push(academic_year);
    }
    if (targetDept) {
      resApprovedQuery += ' AND department = ?';
      prjApprovedQuery += ' AND department = ?';
      rpStatParams.push(targetDept);
    }
    const approvedResearch = db.prepare(resApprovedQuery).get(...rpStatParams)?.count || 0;
    const totalProjects = db.prepare(prjApprovedQuery).get(...rpStatParams)?.count || 0;

    // Approvals counts for HOD/Admin/Faculty
    let pendingApprovals = 0;
    let mySubmissions = 0;
    let approvedSubmissions = 0;
    let changesRequested = 0;

    if (user) {
      if (user.role === 'admin' || user.role === 'hod') {
        const deptFilter = user.role === 'hod' ? user.department : targetDept;
        const p1 = deptFilter
          ? db.prepare("SELECT COUNT(*) as c FROM student_achievements WHERE status = 'Pending Approval' AND department = ?").get(deptFilter).c
          : db.prepare("SELECT COUNT(*) as c FROM student_achievements WHERE status = 'Pending Approval'").get().c;
        const p2 = deptFilter
          ? db.prepare("SELECT COUNT(*) as c FROM activities WHERE status = 'Pending Approval' AND department = ?").get(deptFilter).c
          : db.prepare("SELECT COUNT(*) as c FROM activities WHERE status = 'Pending Approval'").get().c;
        const p3 = deptFilter
          ? db.prepare("SELECT COUNT(*) as c FROM placement_records WHERE status = 'Pending Approval' AND department = ?").get(deptFilter).c
          : db.prepare("SELECT COUNT(*) as c FROM placement_records WHERE status = 'Pending Approval'").get().c;
        const p4 = deptFilter
          ? db.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'Pending Approval' AND department = ?").get(deptFilter).c
          : db.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'Pending Approval'").get().c;
        const p5 = deptFilter
          ? db.prepare("SELECT COUNT(*) as c FROM research_publications WHERE status = 'Pending Approval' AND department = ?").get(deptFilter).c
          : db.prepare("SELECT COUNT(*) as c FROM research_publications WHERE status = 'Pending Approval'").get().c;
        const p6 = deptFilter
          ? db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'Pending Approval' AND department = ?").get(deptFilter).c
          : db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'Pending Approval'").get().c;
        pendingApprovals = p1 + p2 + p3 + p4 + p5 + p6;
      }

      if (user.role === 'faculty') {
        const s1 = db.prepare('SELECT COUNT(*) as c FROM student_achievements WHERE submitted_by = ?').get(user.id).c;
        const s2 = db.prepare('SELECT COUNT(*) as c FROM activities WHERE submitted_by = ?').get(user.id).c;
        const s3 = db.prepare('SELECT COUNT(*) as c FROM placement_records WHERE submitted_by = ?').get(user.id).c;
        const s4 = db.prepare('SELECT COUNT(*) as c FROM events WHERE submitted_by = ?').get(user.id).c;
        const s5 = db.prepare('SELECT COUNT(*) as c FROM research_publications WHERE submitted_by = ?').get(user.id).c;
        const s6 = db.prepare('SELECT COUNT(*) as c FROM projects WHERE submitted_by = ?').get(user.id).c;
        mySubmissions = s1 + s2 + s3 + s4 + s5 + s6;

        const a1 = db.prepare("SELECT COUNT(*) as c FROM student_achievements WHERE submitted_by = ? AND status = 'Approved'").get(user.id).c;
        const a2 = db.prepare("SELECT COUNT(*) as c FROM activities WHERE submitted_by = ? AND status = 'Approved'").get(user.id).c;
        const a3 = db.prepare("SELECT COUNT(*) as c FROM placement_records WHERE submitted_by = ? AND status = 'Approved'").get(user.id).c;
        const a4 = db.prepare("SELECT COUNT(*) as c FROM events WHERE submitted_by = ? AND status = 'Approved'").get(user.id).c;
        const a5 = db.prepare("SELECT COUNT(*) as c FROM research_publications WHERE submitted_by = ? AND status = 'Approved'").get(user.id).c;
        const a6 = db.prepare("SELECT COUNT(*) as c FROM projects WHERE submitted_by = ? AND status = 'Approved'").get(user.id).c;
        approvedSubmissions = a1 + a2 + a3 + a4 + a5 + a6;

        const c1 = db.prepare("SELECT COUNT(*) as c FROM student_achievements WHERE submitted_by = ? AND status = 'Changes Requested'").get(user.id).c;
        const c2 = db.prepare("SELECT COUNT(*) as c FROM activities WHERE submitted_by = ? AND status = 'Changes Requested'").get(user.id).c;
        const c3 = db.prepare("SELECT COUNT(*) as c FROM placement_records WHERE submitted_by = ? AND status = 'Changes Requested'").get(user.id).c;
        const c4 = db.prepare("SELECT COUNT(*) as c FROM events WHERE submitted_by = ? AND status = 'Changes Requested'").get(user.id).c;
        const c5 = db.prepare("SELECT COUNT(*) as c FROM research_publications WHERE submitted_by = ? AND status = 'Changes Requested'").get(user.id).c;
        const c6 = db.prepare("SELECT COUNT(*) as c FROM projects WHERE submitted_by = ? AND status = 'Changes Requested'").get(user.id).c;
        changesRequested = c1 + c2 + c3 + c4 + c5 + c6;

        const p1 = db.prepare("SELECT COUNT(*) as c FROM student_achievements WHERE submitted_by = ? AND status = 'Pending Approval'").get(user.id).c;
        const p2 = db.prepare("SELECT COUNT(*) as c FROM activities WHERE submitted_by = ? AND status = 'Pending Approval'").get(user.id).c;
        const p3 = db.prepare("SELECT COUNT(*) as c FROM placement_records WHERE submitted_by = ? AND status = 'Pending Approval'").get(user.id).c;
        const p4 = db.prepare("SELECT COUNT(*) as c FROM events WHERE submitted_by = ? AND status = 'Pending Approval'").get(user.id).c;
        const p5 = db.prepare("SELECT COUNT(*) as c FROM research_publications WHERE submitted_by = ? AND status = 'Pending Approval'").get(user.id).c;
        const p6 = db.prepare("SELECT COUNT(*) as c FROM projects WHERE submitted_by = ? AND status = 'Pending Approval'").get(user.id).c;
        pendingApprovals = p1 + p2 + p3 + p4 + p5 + p6;
      }
    }

    res.json({
      totalDepartments: totalDepts,
      totalStudents,
      totalFaculty,
      totalActivities,
      totalEvents,
      approvedEvents,
      pendingEvents,
      eventsByCategory,
      eventsByDepartment,
      totalResearch: approvedResearch,
      totalProjects,
      reportsGenerated,
      pendingApprovals,
      mySubmissions,
      approvedSubmissions,
      changesRequested
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});

// ----------------------------------------------------
// 2B. MODULE 12: ADMIN DASHBOARD — INSTITUTE-LEVEL OVERVIEW
// ----------------------------------------------------
app.get('/api/admin/dashboard', requireRole(['admin']), (req, res) => {
  try {
    const { academic_year } = req.query;
    const targetYear = (academic_year && academic_year !== 'All') ? academic_year : '2025-26';
    const isAllYears = academic_year === 'All';

    // Helper for parameterized academic year matching
    const yearClause = isAllYears ? '' : ' AND academic_year = ?';
    const yearParams = isAllYears ? [] : [targetYear];

    // 1. Core KPIs: Students & Faculty
    const totalStudents = db.prepare("SELECT COUNT(*) as c FROM students").get().c;
    const activeStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'Active'").get().c;

    const totalFaculty = db.prepare("SELECT COUNT(*) as c FROM faculty").get().c;
    const activeFaculty = db.prepare("SELECT COUNT(*) as c FROM faculty WHERE status = 'Active' OR status IS NULL").get().c;

    const totalDepts = db.prepare("SELECT COUNT(*) as c FROM departments").get().c;
    const activeDepts = db.prepare("SELECT COUNT(*) as c FROM departments WHERE status = 'Active' OR status IS NULL").get().c;

    // 2. Placements KPI & Analytics (Reuse calculatePlacementStats)
    const placementStats = calculatePlacementStats('All', targetYear);

    // 3. Research & Projects
    const approvedPubs = db.prepare(`SELECT COUNT(*) as c FROM research_publications WHERE status = 'Approved'${yearClause}`).get(...yearParams).c;
    const approvedProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'Approved'${yearClause}`).get(...yearParams).c;
    const fundedRow = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(funding_amount), 0) as total_funding FROM projects WHERE status = 'Approved' AND funding_amount > 0${yearClause}`).get(...yearParams);
    const fundedProjectsCount = fundedRow ? fundedRow.c : 0;
    const totalFundingAmount = fundedRow ? fundedRow.total_funding : 0;
    const awardProjectsCount = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'Approved' AND (awards_recognition IS NOT NULL AND TRIM(awards_recognition) != '')${yearClause}`).get(...yearParams).c;

    // 4. Student Achievements, Activities & Events
    const approvedAchievements = db.prepare(`SELECT COUNT(*) as c FROM student_achievements WHERE status = 'Approved'${yearClause}`).get(...yearParams).c;
    const approvedActivities = db.prepare(`SELECT COUNT(*) as c FROM activities WHERE status = 'Approved'${yearClause}`).get(...yearParams).c;
    const approvedEvents = db.prepare(`SELECT COUNT(*) as c FROM events WHERE status = 'Approved'${yearClause}`).get(...yearParams).c;

    // 5. Approval Monitoring (centralized across all academic modules)
    const pendingAchievements = db.prepare(`SELECT COUNT(*) as c FROM student_achievements WHERE status = 'Pending Approval'${yearClause}`).get(...yearParams).c;
    const pendingActivities = db.prepare(`SELECT COUNT(*) as c FROM activities WHERE status = 'Pending Approval'${yearClause}`).get(...yearParams).c;
    const pendingEvents = db.prepare(`SELECT COUNT(*) as c FROM events WHERE status = 'Pending Approval'${yearClause}`).get(...yearParams).c;
    const pendingPlacements = db.prepare(`SELECT COUNT(*) as c FROM placement_records WHERE status = 'Pending Approval'${yearClause}`).get(...yearParams).c;
    const pendingResearch = db.prepare(`SELECT COUNT(*) as c FROM research_publications WHERE status = 'Pending Approval'${yearClause}`).get(...yearParams).c;
    const pendingProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'Pending Approval'${yearClause}`).get(...yearParams).c;

    const changesAchievements = db.prepare(`SELECT COUNT(*) as c FROM student_achievements WHERE status = 'Changes Requested'${yearClause}`).get(...yearParams).c;
    const changesActivities = db.prepare(`SELECT COUNT(*) as c FROM activities WHERE status = 'Changes Requested'${yearClause}`).get(...yearParams).c;
    const changesEvents = db.prepare(`SELECT COUNT(*) as c FROM events WHERE status = 'Changes Requested'${yearClause}`).get(...yearParams).c;
    const changesPlacements = db.prepare(`SELECT COUNT(*) as c FROM placement_records WHERE status = 'Changes Requested'${yearClause}`).get(...yearParams).c;
    const changesResearch = db.prepare(`SELECT COUNT(*) as c FROM research_publications WHERE status = 'Changes Requested'${yearClause}`).get(...yearParams).c;
    const changesProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'Changes Requested'${yearClause}`).get(...yearParams).c;

    const totalPending = pendingAchievements + pendingActivities + pendingEvents + pendingPlacements + pendingResearch + pendingProjects;
    const totalChangesRequested = changesAchievements + changesActivities + changesEvents + changesPlacements + changesResearch + changesProjects;

    // 6. Department List & Department-Wise Comparisons
    const departments = db.prepare("SELECT id, code, name, COALESCE(status, 'Active') as status, hod, established_year FROM departments ORDER BY name ASC").all();

    const departmentPlacementComparison = [];
    const departmentResearchComparison = [];
    const departmentActivitiesComparison = [];
    const departmentOverview = [];

    let departmentsWithDataCount = 0;
    let departmentsWithPendingCount = 0;

    for (const dept of departments) {
      const deptName = dept.name;
      const deptId = dept.id;

      // Students & Faculty count
      const studCount = db.prepare("SELECT COUNT(*) as c FROM students WHERE LOWER(department) = LOWER(?) OR department_id = ?").get(deptName, deptId).c;
      const facCount = db.prepare("SELECT COUNT(*) as c FROM faculty WHERE LOWER(department) = LOWER(?) OR department_id = ?").get(deptName, deptId).c;

      // Placement stats for department
      const dPlc = calculatePlacementStats(deptName, targetYear);
      departmentPlacementComparison.push({
        department_id: deptId,
        department: deptName,
        code: dept.code,
        eligible_students: dPlc.eligible_students,
        students_placed: dPlc.students_placed,
        placement_percentage: dPlc.placement_percentage,
        highest_package: dPlc.highest_package,
        average_package: dPlc.average_package,
        number_of_offers: dPlc.number_of_offers,
        number_of_companies: dPlc.number_of_companies
      });

      // Research & Projects
      const dPubs = db.prepare(`SELECT COUNT(*) as c FROM research_publications WHERE status = 'Approved' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams).c;
      const dPrjs = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'Approved' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams).c;
      const dFundingRow = db.prepare(`SELECT COALESCE(SUM(funding_amount), 0) as s FROM projects WHERE status = 'Approved' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams);
      const dFunding = dFundingRow ? dFundingRow.s : 0;
      departmentResearchComparison.push({
        department_id: deptId,
        department: deptName,
        code: dept.code,
        publications: dPubs,
        projects: dPrjs,
        total_funding: dFunding
      });

      // Activities, Events & Achievements
      const dAch = db.prepare(`SELECT COUNT(*) as c FROM student_achievements WHERE status = 'Approved' AND LOWER(department) = LOWER(?)${yearClause}`).get(deptName, ...yearParams).c;
      const dAct = db.prepare(`SELECT COUNT(*) as c FROM activities WHERE status = 'Approved' AND LOWER(department) = LOWER(?)${yearClause}`).get(deptName, ...yearParams).c;
      const dEv = db.prepare(`SELECT COUNT(*) as c FROM events WHERE status = 'Approved' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams).c;
      departmentActivitiesComparison.push({
        department_id: deptId,
        department: deptName,
        code: dept.code,
        achievements: dAch,
        activities: dAct,
        events: dEv
      });

      // Department pending approvals
      const dPendingAch = db.prepare(`SELECT COUNT(*) as c FROM student_achievements WHERE status = 'Pending Approval' AND LOWER(department) = LOWER(?)${yearClause}`).get(deptName, ...yearParams).c;
      const dPendingAct = db.prepare(`SELECT COUNT(*) as c FROM activities WHERE status = 'Pending Approval' AND LOWER(department) = LOWER(?)${yearClause}`).get(deptName, ...yearParams).c;
      const dPendingEv = db.prepare(`SELECT COUNT(*) as c FROM events WHERE status = 'Pending Approval' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams).c;
      const dPendingPlc = db.prepare(`SELECT COUNT(*) as c FROM placement_records WHERE status = 'Pending Approval' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams).c;
      const dPendingRes = db.prepare(`SELECT COUNT(*) as c FROM research_publications WHERE status = 'Pending Approval' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams).c;
      const dPendingPrj = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'Pending Approval' AND (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause}`).get(deptName, deptId, ...yearParams).c;
      const dPendingTotal = dPendingAch + dPendingAct + dPendingEv + dPendingPlc + dPendingRes + dPendingPrj;

      const totalApprovedInDept = dAch + dAct + dEv + dPlc.students_placed + dPubs + dPrjs;
      if (totalApprovedInDept > 0) {
        departmentsWithDataCount++;
      }
      if (dPendingTotal > 0) {
        departmentsWithPendingCount++;
      }

      departmentOverview.push({
        id: deptId,
        code: dept.code,
        name: deptName,
        status: dept.status,
        hod: dept.hod,
        students: studCount,
        faculty: facCount,
        achievements: dAch,
        activities: dAct,
        events: dEv,
        placements: dPlc.students_placed,
        placementPercentage: dPlc.placement_percentage,
        researchProjects: dPubs + dPrjs,
        pendingApprovals: dPendingTotal
      });
    }

    // 7. Recent Activity (Latest 15 records across all academic modules)
    const achRecs = db.prepare(`
      SELECT id, title, department, COALESCE(submitted_by_name, 'Faculty Member') as submitted_by, created_at, status, 'Achievement' as record_type, '#ACH-' || id as record_code
      FROM student_achievements WHERE 1=1${yearClause} ORDER BY created_at DESC LIMIT 15
    `).all(...yearParams);

    const actRecs = db.prepare(`
      SELECT id, activity_name as title, department, COALESCE(submitted_by_name, 'Faculty Coordinator') as submitted_by, created_at, status, 'Activity' as record_type, '#ACT-' || id as record_code
      FROM activities WHERE 1=1${yearClause} ORDER BY created_at DESC LIMIT 15
    `).all(...yearParams);

    const evRecs = db.prepare(`
      SELECT id, event_name as title, department, COALESCE(submitted_by_name, organizer, 'Event Organizer') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Event' as record_type, '#EVT-' || id as record_code
      FROM events WHERE 1=1${yearClause} ORDER BY created_at DESC LIMIT 15
    `).all(...yearParams);

    const plcRecs = db.prepare(`
      SELECT id, (student_name || ' — ' || company_name) as title, department, COALESCE(submitted_by_name, 'Placement Officer') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Placement' as record_type, '#PLC-' || id as record_code
      FROM placement_records WHERE 1=1${yearClause} ORDER BY created_at DESC LIMIT 15
    `).all(...yearParams);

    const resRecs = db.prepare(`
      SELECT id, title, department, COALESCE(submitted_by_name, 'Research Author') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Research' as record_type, '#RES-' || id as record_code
      FROM research_publications WHERE 1=1${yearClause} ORDER BY created_at DESC LIMIT 15
    `).all(...yearParams);

    const prjRecs = db.prepare(`
      SELECT id, COALESCE(project_title, title) as title, department, COALESCE(submitted_by_name, 'Project Lead') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Project' as record_type, '#PRJ-' || id as record_code
      FROM projects WHERE 1=1${yearClause} ORDER BY created_at DESC LIMIT 15
    `).all(...yearParams);

    const allRecent = [...achRecs, ...actRecs, ...evRecs, ...plcRecs, ...resRecs, ...prjRecs];
    allRecent.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const recentActivityStream = allRecent.slice(0, 15);

    // 8. Annual Report Status & Progress Metric
    const totalApprovedRecords = approvedAchievements + approvedActivities + approvedEvents + placementStats.students_placed + approvedPubs + approvedProjects;
    
    // Check which sections have verified data in target year
    const sectionsWithData = [];
    if (activeStudents > 0) sectionsWithData.push('Student Demographics');
    if (activeFaculty > 0) sectionsWithData.push('Faculty Directory');
    if (approvedAchievements > 0) sectionsWithData.push('Student Achievements');
    if (approvedActivities > 0) sectionsWithData.push('Department Activities');
    if (approvedEvents > 0) sectionsWithData.push('Conferences & Events');
    if (placementStats.students_placed > 0) sectionsWithData.push('Placements');
    if (approvedPubs > 0 || approvedProjects > 0) sectionsWithData.push('Research & Projects');

    const totalTrackedSections = 7;
    const deptParticipationRate = activeDepts > 0 ? (departmentsWithDataCount / activeDepts) : 0;
    const sectionCoverageRate = sectionsWithData.length / totalTrackedSections;
    const completionPercentage = Math.min(100, Math.round(((deptParticipationRate * 0.5) + (sectionCoverageRate * 0.5)) * 100));

    // Reports generated count
    const reportsGenerated = db.prepare("SELECT COUNT(*) as c FROM generated_reports").get().c;

    res.json({
      academic_year: targetYear,
      kpis: {
        students: {
          total: totalStudents,
          active: activeStudents
        },
        faculty: {
          total: totalFaculty,
          active: activeFaculty
        },
        departments: {
          total: totalDepts,
          active: activeDepts
        },
        placement: {
          placedStudents: placementStats.students_placed,
          placementPercentage: placementStats.placement_percentage,
          highestPackage: placementStats.highest_package,
          averagePackage: placementStats.average_package
        },
        research: {
          publications: approvedPubs,
          projects: approvedProjects,
          total: approvedPubs + approvedProjects
        },
        activities: {
          achievements: approvedAchievements,
          activities: approvedActivities,
          events: approvedEvents,
          total: approvedAchievements + approvedActivities + approvedEvents
        }
      },
      placementAnalytics: {
        totalPlaced: placementStats.students_placed,
        eligibleStudents: placementStats.eligible_students,
        placementPercentage: placementStats.placement_percentage,
        highestPackage: placementStats.highest_package,
        averagePackage: placementStats.average_package,
        uniqueCompanies: placementStats.number_of_companies,
        totalOffers: placementStats.number_of_offers
      },
      departmentPlacementComparison,
      researchProjectsSummary: {
        totalApprovedPublications: approvedPubs,
        totalApprovedProjects: approvedProjects,
        fundedProjectsCount,
        totalFundingAmount,
        awardProjectsCount,
        departmentBreakdown: departmentResearchComparison
      },
      activitiesEventsSummary: {
        totalApprovedAchievements: approvedAchievements,
        totalApprovedActivities: approvedActivities,
        totalApprovedEvents: approvedEvents,
        departmentBreakdown: departmentActivitiesComparison
      },
      approvalMonitoring: {
        totalPending,
        pendingAchievements,
        pendingActivities,
        pendingEvents,
        pendingPlacements,
        pendingResearch,
        pendingProjects,
        changesRequested: totalChangesRequested
      },
      recentActivity: recentActivityStream,
      departmentOverview,
      annualReportProgress: {
        academicYear: targetYear,
        totalActiveDepartments: activeDepts,
        departmentsWithData: departmentsWithDataCount,
        departmentsWithPending: departmentsWithPendingCount,
        totalApprovedRecords,
        totalChangesRequested,
        sectionsWithData,
        completionPercentage,
        reportsGenerated
      }
    });
  } catch (err) {
    console.error('Error generating Admin Dashboard overview:', err);
    res.status(500).json({ error: 'Failed to retrieve admin dashboard metrics: ' + err.message });
  }
});

// ----------------------------------------------------
// 2C. MODULE 13: HOD DASHBOARD — DEPARTMENT-LEVEL OVERVIEW
// ----------------------------------------------------
app.get('/api/hod/dashboard', requireRole(['hod', 'admin']), (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const isHod = (user.role || '').toLowerCase() === 'hod';
    const isAdmin = (user.role || '').toLowerCase() === 'admin';

    // 1. Critical Security: Automatically resolve department associated with logged-in HOD
    let deptName = null;
    if (isHod) {
      const dbUser = db.prepare('SELECT department FROM users WHERE id = ?').get(user.id);
      deptName = dbUser ? dbUser.department : user.department;
      if (!deptName) {
        return res.status(400).json({ error: 'No department assigned to this HOD account' });
      }
    } else if (isAdmin) {
      deptName = req.query.department;
      if (!deptName || deptName === 'All') {
        const firstDept = db.prepare("SELECT name FROM departments WHERE status = 'Active' OR status IS NULL ORDER BY name ASC LIMIT 1").get();
        deptName = firstDept ? firstDept.name : 'Computer Science and Engineering';
      }
    }

    // Resolve department row
    const departmentRow = db.prepare(`
      SELECT id, code, name, description, hod, hod_user_id, COALESCE(status, 'Active') as status, established_year
      FROM departments
      WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)
      LIMIT 1
    `).get(deptName, deptName);

    if (!departmentRow) {
      return res.status(404).json({ error: `Department '${deptName}' not found in registry` });
    }

    const deptId = departmentRow.id;
    deptName = departmentRow.name;

    // Academic Year filter
    const { academic_year } = req.query;
    const targetYear = (academic_year && academic_year !== 'All') ? academic_year : '2025-26';
    const isAllYears = academic_year === 'All';

    const yearClause = isAllYears ? '' : ' AND academic_year = ?';
    const yearParams = isAllYears ? [] : [targetYear];

    // Helper for department queries (checks both name and foreign key if applicable)
    const deptParams = [deptName, deptId];

    // 2. Students & Faculty KPIs
    const totalStudents = db.prepare(`
      SELECT COUNT(*) as c FROM students 
      WHERE LOWER(department) = LOWER(?) OR department_id = ?
    `).get(deptName, deptId).c;

    const activeStudents = db.prepare(`
      SELECT COUNT(*) as c FROM students 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) 
        AND (status = 'Active' OR status IS NULL)
    `).get(deptName, deptId).c;

    const totalFaculty = db.prepare(`
      SELECT COUNT(*) as c FROM faculty 
      WHERE LOWER(department) = LOWER(?) OR department_id = ?
    `).get(deptName, deptId).c;

    const activeFaculty = db.prepare(`
      SELECT COUNT(*) as c FROM faculty 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) 
        AND (status = 'Active' OR status IS NULL)
    `).get(deptName, deptId).c;

    // Faculty breakdown by designation
    const facultyDesignations = db.prepare(`
      SELECT COALESCE(designation, 'Faculty') as designation, COUNT(*) as count 
      FROM faculty 
      WHERE LOWER(department) = LOWER(?) OR department_id = ?
      GROUP BY designation
    `).all(deptName, deptId);

    // Faculty members roster
    const facultyRoster = db.prepare(`
      SELECT id, faculty_name, designation, qualification, COALESCE(publications, 0) as publications, COALESCE(research_projects, 0) as research_projects
      FROM faculty 
      WHERE LOWER(department) = LOWER(?) OR department_id = ?
      ORDER BY id ASC LIMIT 10
    `).all(deptName, deptId);

    // 3. Placements KPI & Analytics (reusing calculatePlacementStats)
    const placementStats = calculatePlacementStats(deptName, targetYear);

    // 4. Research & Projects
    const approvedPubs = db.prepare(`
      SELECT COUNT(*) as c FROM research_publications 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Approved'${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    const pendingPubs = db.prepare(`
      SELECT COUNT(*) as c FROM research_publications 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    const approvedProjects = db.prepare(`
      SELECT COUNT(*) as c FROM projects 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Approved'${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    const pendingProjects = db.prepare(`
      SELECT COUNT(*) as c FROM projects 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    const fundedRow = db.prepare(`
      SELECT COUNT(*) as c, COALESCE(SUM(funding_amount), 0) as total_funding 
      FROM projects 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Approved' AND funding_amount > 0${yearClause}
    `).get(deptName, deptId, ...yearParams);
    const fundedProjectsCount = fundedRow ? fundedRow.c : 0;
    const totalFundingAmount = fundedRow ? fundedRow.total_funding : 0;

    const awardProjectsCount = db.prepare(`
      SELECT COUNT(*) as c FROM projects 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Approved' AND (awards_recognition IS NOT NULL AND TRIM(awards_recognition) != '')${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    // 5. Achievements, Activities & Events
    const approvedAchievements = db.prepare(`
      SELECT COUNT(*) as c FROM student_achievements 
      WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Approved'${yearClause}
    `).get(deptName, deptName, ...yearParams).c;

    const pendingAchievements = db.prepare(`
      SELECT COUNT(*) as c FROM student_achievements 
      WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Pending Approval'${yearClause}
    `).get(deptName, deptName, ...yearParams).c;

    const achievementCategories = db.prepare(`
      SELECT COALESCE(achievement_type, 'General') as category, COUNT(*) as count 
      FROM student_achievements 
      WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Approved'${yearClause}
      GROUP BY category
    `).all(deptName, deptName, ...yearParams);

    const approvedActivities = db.prepare(`
      SELECT COUNT(*) as c FROM activities 
      WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Approved'${yearClause}
    `).get(deptName, deptName, ...yearParams).c;

    const pendingActivities = db.prepare(`
      SELECT COUNT(*) as c FROM activities 
      WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Pending Approval'${yearClause}
    `).get(deptName, deptName, ...yearParams).c;

    const activityCategories = db.prepare(`
      SELECT COALESCE(activity_type, 'General') as category, COUNT(*) as count 
      FROM activities 
      WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Approved'${yearClause}
      GROUP BY category
    `).all(deptName, deptName, ...yearParams);

    const approvedEvents = db.prepare(`
      SELECT COUNT(*) as c FROM events 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Approved'${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    const pendingEvents = db.prepare(`
      SELECT COUNT(*) as c FROM events 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    const eventCategories = db.prepare(`
      SELECT COALESCE(event_type, 'General') as category, COUNT(*) as count 
      FROM events 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Approved'${yearClause}
      GROUP BY category
    `).all(deptName, deptId, ...yearParams);

    // 6. Approval Monitoring & Pending Submissions List
    const pendingPlacements = db.prepare(`
      SELECT COUNT(*) as c FROM placement_records 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause}
    `).get(deptName, deptId, ...yearParams).c;

    const totalPending = pendingAchievements + pendingActivities + pendingEvents + pendingPlacements + pendingPubs + pendingProjects;

    const changesAchievements = db.prepare(`SELECT COUNT(*) as c FROM student_achievements WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Changes Requested'${yearClause}`).get(deptName, deptName, ...yearParams).c;
    const changesActivities = db.prepare(`SELECT COUNT(*) as c FROM activities WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Changes Requested'${yearClause}`).get(deptName, deptName, ...yearParams).c;
    const changesEvents = db.prepare(`SELECT COUNT(*) as c FROM events WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Changes Requested'${yearClause}`).get(deptName, deptId, ...yearParams).c;
    const changesPlacements = db.prepare(`SELECT COUNT(*) as c FROM placement_records WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Changes Requested'${yearClause}`).get(deptName, deptId, ...yearParams).c;
    const changesResearch = db.prepare(`SELECT COUNT(*) as c FROM research_publications WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Changes Requested'${yearClause}`).get(deptName, deptId, ...yearParams).c;
    const changesProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Changes Requested'${yearClause}`).get(deptName, deptId, ...yearParams).c;

    const totalChangesRequested = changesAchievements + changesActivities + changesEvents + changesPlacements + changesResearch + changesProjects;
    const totalApproved = approvedAchievements + approvedActivities + approvedEvents + placementStats.students_placed + approvedPubs + approvedProjects;

    // Resubmitted count: records currently in Pending Approval that previously had Changes Requested in audit history
    let resubmittedCount = 0;
    try {
      const resubRow = db.prepare(`
        SELECT COUNT(DISTINCT ah.record_id || '_' || ah.record_type) as c 
        FROM approval_history ah
        WHERE ah.previous_status = 'Changes Requested' AND ah.new_status = 'Pending Approval'
      `).get();
      resubmittedCount = resubRow ? resubRow.c : 0;
    } catch (e) {
      resubmittedCount = 0;
    }

    // Pending records queue for HOD review (up to 15 items)
    const pAch = db.prepare(`
      SELECT id, title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, created_at, academic_year, status, 'Achievement' as record_type, '#ACH-' || id as record_code
      FROM student_achievements WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Pending Approval'${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptName, ...yearParams);

    const pAct = db.prepare(`
      SELECT id, activity_name as title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, created_at, academic_year, status, 'Activity' as record_type, '#ACT-' || id as record_code
      FROM activities WHERE (LOWER(department) = LOWER(?) OR department = ?) AND status = 'Pending Approval'${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptName, ...yearParams);

    const pEv = db.prepare(`
      SELECT id, event_name as title, department, COALESCE(submitted_by_name, organizer, 'Organizer') as submitted_by, COALESCE(submitted_at, created_at) as created_at, academic_year, status, 'Event' as record_type, '#EVT-' || id as record_code
      FROM events WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const pPlc = db.prepare(`
      SELECT id, (student_name || ' — ' || company_name) as title, department, COALESCE(submitted_by_name, 'Placement Officer') as submitted_by, COALESCE(submitted_at, created_at) as created_at, academic_year, status, 'Placement' as record_type, '#PLC-' || id as record_code
      FROM placement_records WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const pRes = db.prepare(`
      SELECT id, title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, COALESCE(submitted_at, created_at) as created_at, academic_year, status, 'Research' as record_type, '#RES-' || id as record_code
      FROM research_publications WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const pPrj = db.prepare(`
      SELECT id, COALESCE(project_title, title) as title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, COALESCE(submitted_at, created_at) as created_at, academic_year, status, 'Project' as record_type, '#PRJ-' || id as record_code
      FROM projects WHERE (LOWER(department) = LOWER(?) OR department_id = ?) AND status = 'Pending Approval'${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const pendingQueue = [...pAch, ...pAct, ...pEv, ...pPlc, ...pRes, ...pPrj];
    pendingQueue.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // 7. Recent Department Activity (across all academic modules)
    const rAch = db.prepare(`
      SELECT id, title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, created_at, status, 'Achievement' as record_type, '#ACH-' || id as record_code
      FROM student_achievements WHERE (LOWER(department) = LOWER(?) OR department = ?)${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptName, ...yearParams);

    const rAct = db.prepare(`
      SELECT id, activity_name as title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, created_at, status, 'Activity' as record_type, '#ACT-' || id as record_code
      FROM activities WHERE (LOWER(department) = LOWER(?) OR department = ?)${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptName, ...yearParams);

    const rEv = db.prepare(`
      SELECT id, event_name as title, department, COALESCE(submitted_by_name, organizer, 'Organizer') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Event' as record_type, '#EVT-' || id as record_code
      FROM events WHERE (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const rPlc = db.prepare(`
      SELECT id, (student_name || ' — ' || company_name) as title, department, COALESCE(submitted_by_name, 'Placement Officer') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Placement' as record_type, '#PLC-' || id as record_code
      FROM placement_records WHERE (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const rRes = db.prepare(`
      SELECT id, title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Research' as record_type, '#RES-' || id as record_code
      FROM research_publications WHERE (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const rPrj = db.prepare(`
      SELECT id, COALESCE(project_title, title) as title, department, COALESCE(submitted_by_name, 'Faculty') as submitted_by, COALESCE(submitted_at, created_at) as created_at, status, 'Project' as record_type, '#PRJ-' || id as record_code
      FROM projects WHERE (LOWER(department) = LOWER(?) OR department_id = ?)${yearClause} ORDER BY created_at DESC LIMIT 10
    `).all(deptName, deptId, ...yearParams);

    const recentActivityAll = [...rAch, ...rAct, ...rEv, ...rPlc, ...rRes, ...rPrj];
    recentActivityAll.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const recentActivity = recentActivityAll.slice(0, 15);

    // 8. Department Data Completeness & Report Readiness Checklist
    const readinessChecks = [
      { section: 'Student Demographics', status: activeStudents > 0 ? 'Complete' : 'Missing', count: activeStudents },
      { section: 'Faculty Directory', status: activeFaculty > 0 ? 'Complete' : 'Missing', count: activeFaculty },
      { section: 'Student Achievements', status: approvedAchievements > 0 ? 'Complete' : (pendingAchievements > 0 ? 'Pending' : 'Missing'), count: approvedAchievements },
      { section: 'Department Activities', status: approvedActivities > 0 ? 'Complete' : (pendingActivities > 0 ? 'Pending' : 'Missing'), count: approvedActivities },
      { section: 'Events & Conferences', status: approvedEvents > 0 ? 'Complete' : (pendingEvents > 0 ? 'Pending' : 'Missing'), count: approvedEvents },
      { section: 'Placement Records', status: placementStats.students_placed > 0 ? 'Complete' : (placementStats.eligible_students > 0 ? 'Pending' : 'Missing'), count: placementStats.students_placed },
      { section: 'Research & Publications', status: (approvedPubs > 0 || approvedProjects > 0) ? 'Complete' : ((pendingPubs > 0 || pendingProjects > 0) ? 'Pending' : 'Missing'), count: approvedPubs + approvedProjects },
      { section: 'Pending Verifications', status: totalPending === 0 ? 'Complete' : 'Requires Review', count: totalPending }
    ];

    const completedSectionsCount = readinessChecks.filter(c => c.status === 'Complete').length;
    const readinessPercentage = Math.round((completedSectionsCount / readinessChecks.length) * 100);

    res.json({
      academic_year: targetYear,
      department: {
        id: departmentRow.id,
        code: departmentRow.code,
        name: departmentRow.name,
        hod: departmentRow.hod,
        status: departmentRow.status,
        established_year: departmentRow.established_year
      },
      kpis: {
        students: {
          total: totalStudents,
          active: activeStudents
        },
        faculty: {
          total: totalFaculty,
          active: activeFaculty,
          designations: facultyDesignations
        },
        achievements: {
          approved: approvedAchievements,
          pending: pendingAchievements
        },
        activities: {
          approved: approvedActivities,
          pending: pendingActivities
        },
        events: {
          approved: approvedEvents,
          pending: pendingEvents
        },
        placement: {
          placedStudents: placementStats.students_placed,
          placementPercentage: placementStats.placement_percentage,
          highestPackage: placementStats.highest_package,
          averagePackage: placementStats.average_package
        },
        research: {
          publications: approvedPubs,
          projects: approvedProjects,
          total: approvedPubs + approvedProjects
        }
      },
      placementAnalytics: {
        totalPlaced: placementStats.students_placed,
        eligibleStudents: placementStats.eligible_students,
        placementPercentage: placementStats.placement_percentage,
        highestPackage: placementStats.highest_package,
        averagePackage: placementStats.average_package,
        uniqueCompanies: placementStats.number_of_companies,
        totalOffers: placementStats.number_of_offers
      },
      researchProjectsSummary: {
        approvedPublications: approvedPubs,
        pendingPublications: pendingPubs,
        approvedProjects,
        pendingProjects,
        fundedProjectsCount,
        totalFundingAmount,
        awardProjectsCount
      },
      achievementsSummary: {
        approved: approvedAchievements,
        pending: pendingAchievements,
        categories: achievementCategories
      },
      activitiesSummary: {
        approved: approvedActivities,
        pending: pendingActivities,
        categories: activityCategories
      },
      eventsSummary: {
        approved: approvedEvents,
        pending: pendingEvents,
        categories: eventCategories
      },
      facultyOverview: {
        total: totalFaculty,
        active: activeFaculty,
        designations: facultyDesignations,
        roster: facultyRoster
      },
      approvalSummary: {
        totalPending,
        totalApproved,
        changesRequested: totalChangesRequested,
        resubmitted: resubmittedCount,
        pendingBreakdown: {
          achievements: pendingAchievements,
          activities: pendingActivities,
          events: pendingEvents,
          placements: pendingPlacements,
          research: pendingPubs,
          projects: pendingProjects
        }
      },
      pendingQueue: pendingQueue.slice(0, 10),
      recentActivity,
      reportReadiness: {
        percentage: readinessPercentage,
        completedCount: completedSectionsCount,
        totalSections: readinessChecks.length,
        checks: readinessChecks
      }
    });
  } catch (err) {
    console.error('Error generating HOD Dashboard overview:', err);
    res.status(500).json({ error: 'Failed to retrieve HOD dashboard metrics: ' + err.message });
  }
});

// ----------------------------------------------------
// 2D. MODULE 14: FACULTY DASHBOARD — INDIVIDUAL FACULTY OVERVIEW & SUBMISSIONS
// ----------------------------------------------------
app.get('/api/faculty/dashboard', requireRole(['faculty', 'admin']), (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const isFaculty = (user.role || '').toLowerCase() === 'faculty';
    const isAdmin = (user.role || '').toLowerCase() === 'admin';

    // 1. Resolve Faculty User & Profile from Database
    let targetUserId = user.id;
    if (isAdmin && req.query.user_id) {
      targetUserId = parseInt(req.query.user_id, 10) || user.id;
    }

    const targetUser = db.prepare('SELECT id, email, name, role, department, department_id FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Faculty account not found' });
    }

    // Resolve profile from faculty table
    let facultyRow = db.prepare(`
      SELECT f.*, d.code as department_code, COALESCE(d.name, f.department) as department_name, d.status as department_status
      FROM faculty f
      LEFT JOIN departments d ON d.id = f.department_id OR LOWER(d.name) = LOWER(f.department)
      WHERE f.user_id = ? OR LOWER(f.email) = LOWER(?) OR (LOWER(f.faculty_name) = LOWER(?) AND (LOWER(f.department) = LOWER(?) OR f.department_id = ?))
      LIMIT 1
    `).get(targetUser.id, targetUser.email, targetUser.name, targetUser.department || '', targetUser.department_id || 0);

    // If faculty row exists without user_id, link it now
    if (facultyRow && !facultyRow.user_id) {
      try {
        db.prepare('UPDATE faculty SET user_id = ? WHERE id = ?').run(targetUser.id, facultyRow.id);
        facultyRow.user_id = targetUser.id;
      } catch (e) {
        // ignore sync notice
      }
    }

    // If no faculty row found, synthesize clean profile from user record
    if (!facultyRow) {
      const deptRow = db.prepare('SELECT id, code, name FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1').get(targetUser.department, targetUser.department);
      facultyRow = {
        id: null,
        user_id: targetUser.id,
        faculty_name: targetUser.name,
        faculty_id: 'FAC-' + (deptRow ? deptRow.code : 'GEN') + '-' + String(targetUser.id).padStart(3, '0'),
        department: targetUser.department || 'General',
        department_id: deptRow ? deptRow.id : null,
        department_code: deptRow ? deptRow.code : 'DEPT',
        designation: 'Faculty Member',
        qualification: 'Postgraduate / Doctoral',
        specialization: 'Departmental Faculty',
        date_of_joining: '2022-01-01',
        email: targetUser.email,
        phone: 'Not Specified',
        status: 'Active',
        publications: 0,
        research_projects: 0,
        conferences_attended: 0,
        awards: '',
        description: 'Faculty Profile'
      };
    }

    const facultyId = facultyRow.id;
    const facultyName = facultyRow.faculty_name || targetUser.name;
    const deptName = facultyRow.department || targetUser.department;
    const deptId = facultyRow.department_id || targetUser.department_id || 0;

    // Academic Year filter
    const { academic_year } = req.query;
    const targetYear = (academic_year && academic_year !== 'All') ? academic_year : '2025-26';
    const isAllYears = academic_year === 'All';

    const yearClause = isAllYears ? '' : ' AND academic_year = ?';
    const yearParams = isAllYears ? [] : [targetYear];

    // 2. Fetch Submissions by this Faculty across all 7 modules
    // Achievements
    const achList = db.prepare(`
      SELECT id, title, 'Achievement' as module, '#ACH-' || id as record_code, academic_year, created_at, COALESCE(updated_at, created_at) as updated_at,
             status, review_comments, student_name as item_detail, COALESCE(category, achievement_type) as category
      FROM student_achievements
      WHERE (submitted_by = ? OR LOWER(submitted_by_name) = LOWER(?))${yearClause}
      ORDER BY created_at DESC
    `).all(targetUser.id, facultyName, ...yearParams);

    // Activities
    const actList = db.prepare(`
      SELECT id, activity_name as title, 'Activity' as module, '#ACT-' || id as record_code, academic_year, created_at, created_at as updated_at,
             status, review_comments, activity_type as item_detail, activity_type as category
      FROM activities
      WHERE (submitted_by = ? OR (coordinator_faculty_id IS NOT NULL AND coordinator_faculty_id = ?) OR LOWER(submitted_by_name) = LOWER(?))${yearClause}
      ORDER BY created_at DESC
    `).all(targetUser.id, facultyId || 0, facultyName, ...yearParams);

    // Events
    const evList = db.prepare(`
      SELECT id, event_name as title, 'Event' as module, '#EVT-' || id as record_code, academic_year, COALESCE(submitted_at, created_at) as created_at, COALESCE(updated_at, created_at) as updated_at,
             status, review_comments, event_type as item_detail, event_type as category
      FROM events
      WHERE (submitted_by = ? OR (coordinator_faculty_id IS NOT NULL AND coordinator_faculty_id = ?) OR LOWER(submitted_by_name) = LOWER(?))${yearClause}
      ORDER BY created_at DESC
    `).all(targetUser.id, facultyId || 0, facultyName, ...yearParams);

    // Placements
    const plcList = db.prepare(`
      SELECT id, (student_name || ' — ' || company_name) as title, 'Placement' as module, '#PLC-' || id as record_code, academic_year, created_at, COALESCE(updated_at, created_at) as updated_at,
             status, review_comments, (company_name || ' (₹' || package || ' LPA)') as item_detail, company_name as category
      FROM placement_records
      WHERE (submitted_by = ? OR LOWER(submitted_by_name) = LOWER(?))${yearClause}
      ORDER BY created_at DESC
    `).all(targetUser.id, facultyName, ...yearParams);

    // Research Publications
    let resFacultyClause = facultyId ? ` OR id IN (SELECT research_id FROM research_faculty WHERE faculty_id = ${facultyId})` : '';
    const resList = db.prepare(`
      SELECT id, title, 'Research' as module, '#RES-' || id as record_code, academic_year, COALESCE(submitted_at, created_at) as created_at, COALESCE(updated_at, created_at) as updated_at,
             status, COALESCE(review_comments, reviewer_comments) as review_comments, publication_type as item_detail, publication_type as category
      FROM research_publications
      WHERE (submitted_by = ? OR LOWER(submitted_by_name) = LOWER(?)${resFacultyClause})${yearClause}
      ORDER BY created_at DESC
    `).all(targetUser.id, facultyName, ...yearParams);

    // Projects
    let prjFacultyClause = facultyId ? ` OR coordinator_faculty_id = ${facultyId} OR id IN (SELECT project_id FROM project_faculty WHERE faculty_id = ${facultyId})` : '';
    const prjList = db.prepare(`
      SELECT id, COALESCE(project_title, title) as title, 'Project' as module, '#PRJ-' || id as record_code, academic_year, COALESCE(submitted_at, created_at) as created_at, COALESCE(updated_at, created_at) as updated_at,
             status, COALESCE(review_comments, reviewer_comments) as review_comments, project_category as item_detail, project_category as category
      FROM projects
      WHERE (submitted_by = ? OR LOWER(submitted_by_name) = LOWER(?)${prjFacultyClause})${yearClause}
      ORDER BY created_at DESC
    `).all(targetUser.id, facultyName, ...yearParams);

    // Combine all submissions
    const allSubmissions = [...achList, ...actList, ...evList, ...plcList, ...resList, ...prjList];
    allSubmissions.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // 3. Status Summary KPIs
    const totalSubmissions = allSubmissions.length;
    const draftCount = allSubmissions.filter(s => s.status === 'Draft').length;
    const pendingCount = allSubmissions.filter(s => s.status === 'Pending Approval').length;
    const approvedCount = allSubmissions.filter(s => s.status === 'Approved').length;
    const changesRequestedCount = allSubmissions.filter(s => s.status === 'Changes Requested').length;
    const resubmittedCount = allSubmissions.filter(s => s.status === 'Resubmitted').length;
    const rejectedCount = allSubmissions.filter(s => s.status === 'Rejected').length;

    // 4. Pending Actions requiring Faculty attention
    // Items with 'Changes Requested' require immediate revision; 'Draft' need submission
    const pendingActions = allSubmissions
      .filter(s => s.status === 'Changes Requested' || s.status === 'Draft' || s.status === 'Resubmitted')
      .slice(0, 10);

    // 5. Recent Submissions (top 15)
    const recentSubmissions = allSubmissions.slice(0, 15);

    // 6. Module Summaries for Faculty
    const achievementsSummary = {
      total: achList.length,
      draft: achList.filter(s => s.status === 'Draft').length,
      pending: achList.filter(s => s.status === 'Pending Approval').length,
      approved: achList.filter(s => s.status === 'Approved').length,
      changesRequested: achList.filter(s => s.status === 'Changes Requested').length
    };

    const activitiesSummary = {
      total: actList.length,
      draft: actList.filter(s => s.status === 'Draft').length,
      pending: actList.filter(s => s.status === 'Pending Approval').length,
      approved: actList.filter(s => s.status === 'Approved').length,
      changesRequested: actList.filter(s => s.status === 'Changes Requested').length
    };

    const eventsSummary = {
      total: evList.length,
      draft: evList.filter(s => s.status === 'Draft').length,
      pending: evList.filter(s => s.status === 'Pending Approval').length,
      approved: evList.filter(s => s.status === 'Approved').length,
      changesRequested: evList.filter(s => s.status === 'Changes Requested').length
    };

    const researchProjectsSummary = {
      totalResearch: resList.length,
      approvedResearch: resList.filter(s => s.status === 'Approved').length,
      pendingResearch: resList.filter(s => s.status === 'Pending Approval').length,
      changesResearch: resList.filter(s => s.status === 'Changes Requested').length,
      totalProjects: prjList.length,
      approvedProjects: prjList.filter(s => s.status === 'Approved').length,
      pendingProjects: prjList.filter(s => s.status === 'Pending Approval').length,
      changesProjects: prjList.filter(s => s.status === 'Changes Requested').length
    };

    const placementsSummary = {
      totalContributed: plcList.length,
      approved: plcList.filter(s => s.status === 'Approved').length,
      pending: plcList.filter(s => s.status === 'Pending Approval').length,
      changesRequested: plcList.filter(s => s.status === 'Changes Requested').length
    };

    // 7. Department Student Directory Overview (Scoped to Faculty's Department)
    const totalStudentsInDept = db.prepare(`
      SELECT COUNT(*) as c FROM students 
      WHERE LOWER(department) = LOWER(?) OR department_id = ?
    `).get(deptName, deptId).c;

    const activeStudentsInDept = db.prepare(`
      SELECT COUNT(*) as c FROM students 
      WHERE (LOWER(department) = LOWER(?) OR department_id = ?) 
        AND (status = 'Active' OR status IS NULL)
    `).get(deptName, deptId).c;

    // Faculty profile sanitized (no password)
    const profile = {
      id: facultyRow.id,
      faculty_name: facultyRow.faculty_name,
      faculty_id: facultyRow.faculty_id || 'FAC-' + targetUser.id,
      employee_id: facultyRow.faculty_id || 'FAC-' + targetUser.id,
      department: deptName,
      department_code: facultyRow.department_code || 'DEPT',
      designation: facultyRow.designation || 'Faculty Member',
      qualification: facultyRow.qualification || 'M.Tech / Ph.D',
      specialization: facultyRow.specialization || 'Computer Science / Engineering',
      date_of_joining: facultyRow.date_of_joining || '2020-01-01',
      email: targetUser.email,
      phone: facultyRow.phone || '',
      status: facultyRow.status || 'Active',
      publications_count: facultyRow.publications || researchProjectsSummary.approvedResearch,
      projects_count: facultyRow.research_projects || researchProjectsSummary.approvedProjects,
      description: facultyRow.description || ''
    };

    res.json({
      academic_year: targetYear,
      faculty: profile,
      submissionsStatus: {
        total: totalSubmissions,
        draft: draftCount,
        pending: pendingCount,
        approved: approvedCount,
        changesRequested: changesRequestedCount,
        resubmitted: resubmittedCount,
        rejected: rejectedCount
      },
      pendingActions,
      recentSubmissions,
      modules: {
        achievements: achievementsSummary,
        activities: activitiesSummary,
        events: eventsSummary,
        researchProjects: researchProjectsSummary,
        placements: placementsSummary
      },
      departmentStudents: {
        department: deptName,
        total: totalStudentsInDept,
        active: activeStudentsInDept
      }
    });
  } catch (err) {
    console.error('Error generating Faculty Dashboard overview:', err);
    res.status(500).json({ error: 'Failed to retrieve faculty dashboard metrics: ' + err.message });
  }
});

// GET /api/faculty/profile - Standalone Faculty Profile
app.get('/api/faculty/profile', requireRole(['faculty', 'admin']), (req, res) => {
  try {
    const user = req.user;
    const targetUserId = (user.role === 'admin' && req.query.user_id) ? parseInt(req.query.user_id, 10) : user.id;

    const targetUser = db.prepare('SELECT id, email, name, role, department, department_id FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Faculty account not found' });
    }

    const facultyRow = db.prepare(`
      SELECT f.*, d.code as department_code, COALESCE(d.name, f.department) as department_name
      FROM faculty f
      LEFT JOIN departments d ON d.id = f.department_id OR LOWER(d.name) = LOWER(f.department)
      WHERE f.user_id = ? OR LOWER(f.email) = LOWER(?) OR (LOWER(f.faculty_name) = LOWER(?) AND (LOWER(f.department) = LOWER(?) OR f.department_id = ?))
      LIMIT 1
    `).get(targetUser.id, targetUser.email, targetUser.name, targetUser.department || '', targetUser.department_id || 0);

    const deptRow = db.prepare('SELECT id, code, name FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1').get(targetUser.department, targetUser.department);

    const profile = {
      id: facultyRow ? facultyRow.id : null,
      user_id: targetUser.id,
      faculty_name: facultyRow ? facultyRow.faculty_name : targetUser.name,
      employee_id: facultyRow ? facultyRow.faculty_id : ('FAC-' + targetUser.id),
      department: facultyRow ? facultyRow.department : targetUser.department,
      department_code: (facultyRow && facultyRow.department_code) || (deptRow ? deptRow.code : 'DEPT'),
      designation: facultyRow ? facultyRow.designation : 'Faculty Member',
      qualification: facultyRow ? facultyRow.qualification : 'M.Tech / Ph.D',
      specialization: facultyRow ? facultyRow.specialization : 'Engineering / Technology',
      date_of_joining: facultyRow ? facultyRow.date_of_joining : '2020-01-01',
      email: targetUser.email,
      phone: (facultyRow && facultyRow.phone) || '',
      status: (facultyRow && facultyRow.status) || 'Active',
      description: (facultyRow && facultyRow.description) || ''
    };

    res.json({ success: true, profile });
  } catch (err) {
    console.error('Error fetching faculty profile:', err);
    res.status(500).json({ error: 'Failed to retrieve profile: ' + err.message });
  }
});

// ----------------------------------------------------
// 3. DEPARTMENT MANAGEMENT (Module 2: CRUD, HOD & Faculty Assignment, Status)
// ----------------------------------------------------

// GET /api/departments - List all departments with search, status filter, and live faculty counts
app.get('/api/departments', (req, res) => {
  try {
    const { search, status } = req.query;
    let query = `
      SELECT 
        d.id,
        d.code,
        d.name,
        d.description,
        d.hod,
        d.hod_user_id,
        COALESCE(d.status, 'Active') as status,
        d.established_year,
        d.created_at,
        d.updated_at,
        u.email as hod_email,
        (
          SELECT COUNT(*) 
          FROM users fu 
          WHERE fu.role = 'faculty' 
            AND (fu.department_id = d.id OR fu.department = d.name OR fu.department = d.code)
        ) as faculty_count
      FROM departments d
      LEFT JOIN users u ON d.hod_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by status (Active, Inactive, or All)
    if (status && status !== 'All') {
      if (status === 'Active') {
        query += " AND (d.status = 'Active' OR d.status IS NULL)";
      } else {
        query += ' AND d.status = ?';
        params.push(status);
      }
    }

    // Search by name or code
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(d.name) LIKE ? OR LOWER(d.code) LIKE ?)';
      params.push(term, term);
    }

    query += ' ORDER BY d.name ASC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// GET /api/departments/eligible-hods - List users eligible for HOD assignment (Admin only)
app.get('/api/departments/eligible-hods', requireRole(['admin']), (req, res) => {
  try {
    const hods = db.prepare(`
      SELECT id, name, email, role, department, department_id 
      FROM users 
      WHERE role = 'hod' 
      ORDER BY name ASC
    `).all();
    res.json(hods);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch eligible HOD users' });
  }
});

// GET /api/departments/faculty-candidates - List all faculty members for assignment (Admin only)
app.get('/api/departments/faculty-candidates', requireRole(['admin']), (req, res) => {
  try {
    const faculty = db.prepare(`
      SELECT id, name, email, role, department, department_id 
      FROM users 
      WHERE role = 'faculty' 
      ORDER BY name ASC
    `).all();
    res.json(faculty);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch faculty candidates' });
  }
});

// GET /api/departments/:id - Get specific department details with assigned HOD & faculty members
app.get('/api/departments/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const dept = db.prepare(`
      SELECT 
        d.id,
        d.code,
        d.name,
        d.description,
        d.hod,
        d.hod_user_id,
        COALESCE(d.status, 'Active') as status,
        d.established_year,
        d.created_at,
        d.updated_at,
        u.email as hod_email,
        u.name as hod_name
      FROM departments d
      LEFT JOIN users u ON d.hod_user_id = u.id
      WHERE d.id = ?
    `).get(id);

    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Role-based permission check:
    // Admin can view any department.
    // HOD and Faculty can only view their own department details.
    if (user.role !== 'admin' && !checkDepartmentAccess(user, dept.name)) {
      return res.status(403).json({
        error: `Access denied. Users assigned to '${user.department}' cannot access details for '${dept.name}'.`
      });
    }

    // Fetch faculty members assigned to this department
    const assignedFaculty = db.prepare(`
      SELECT id, name, email, role, department, department_id
      FROM users
      WHERE role = 'faculty'
        AND (department_id = ? OR department = ? OR department = ?)
      ORDER BY name ASC
    `).all(dept.id, dept.name, dept.code);

    res.json({
      ...dept,
      faculty_count: assignedFaculty.length,
      faculty: assignedFaculty
    });
  } catch (err) {
    console.error('Error fetching department details:', err);
    res.status(500).json({ error: 'Failed to fetch department details' });
  }
});

// POST /api/departments - Create a new department (Admin only)
app.post('/api/departments', requireRole(['admin']), (req, res) => {
  try {
    const { code, name, description, hod_user_id, established_year, status } = req.body;

    // Validation
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Department code is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanStatus = status === 'Inactive' ? 'Inactive' : 'Active';
    const estYear = established_year ? parseInt(established_year, 10) : new Date().getFullYear();

    // Check uniqueness of department code
    const existingCode = db.prepare('SELECT id FROM departments WHERE UPPER(code) = ?').get(cleanCode);
    if (existingCode) {
      return res.status(400).json({ error: `Department code '${cleanCode}' already exists. Please choose a unique code.` });
    }

    // Check uniqueness of department name
    const existingName = db.prepare('SELECT id FROM departments WHERE LOWER(name) = ?').get(cleanName.toLowerCase());
    if (existingName) {
      return res.status(400).json({ error: `Department name '${cleanName}' already exists.` });
    }

    let hodName = '';
    let validHodUserId = null;

    if (hod_user_id) {
      const hodUser = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(hod_user_id);
      if (!hodUser || hodUser.role !== 'hod') {
        return res.status(400).json({ error: 'Assigned HOD must be an existing user with HOD role' });
      }
      hodName = hodUser.name;
      validHodUserId = hodUser.id;
    }

    const result = withTransaction(() => {
      // If HOD is assigned, check if they were assigned to another department and unassign them there
      if (validHodUserId) {
        db.prepare("UPDATE departments SET hod_user_id = NULL, hod = 'Unassigned' WHERE hod_user_id = ?").run(validHodUserId);
      }

      // Insert new department
      const insertStmt = db.prepare(`
        INSERT INTO departments (code, name, description, hod, hod_user_id, established_year, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      const insertRes = insertStmt.run(cleanCode, cleanName, description ? description.trim() : '', hodName, validHodUserId, estYear, cleanStatus);
      const newDeptId = insertRes.lastInsertRowid;

      // Update HOD user's department assignment
      if (validHodUserId) {
        db.prepare('UPDATE users SET department = ?, department_id = ? WHERE id = ?').run(cleanName, newDeptId, validHodUserId);
      }

      return {
        id: newDeptId,
        code: cleanCode,
        name: cleanName,
        description: description ? description.trim() : '',
        hod: hodName,
        hod_user_id: validHodUserId,
        established_year: estYear,
        status: cleanStatus,
        faculty_count: 0
      };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating department:', err);
    res.status(500).json({ error: err.message || 'Failed to create department' });
  }
});

// PUT /api/departments/:id - Update department details & HOD assignment (Admin only)
app.put('/api/departments/:id', requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, hod_user_id, established_year, status } = req.body;

    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Validation
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Department code is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanStatus = status === 'Inactive' ? 'Inactive' : 'Active';
    const estYear = established_year ? parseInt(established_year, 10) : existing.established_year;

    // Check unique code
    const duplicateCode = db.prepare('SELECT id FROM departments WHERE UPPER(code) = ? AND id != ?').get(cleanCode, id);
    if (duplicateCode) {
      return res.status(400).json({ error: `Department code '${cleanCode}' is already in use by another department.` });
    }

    // Check unique name
    const duplicateName = db.prepare('SELECT id FROM departments WHERE LOWER(name) = ? AND id != ?').get(cleanName.toLowerCase(), id);
    if (duplicateName) {
      return res.status(400).json({ error: `Department name '${cleanName}' is already in use by another department.` });
    }

    let targetHodUserId = existing.hod_user_id;
    let targetHodName = existing.hod || '';

    if (hod_user_id !== undefined) {
      if (hod_user_id === null || hod_user_id === '' || hod_user_id === 0) {
        targetHodUserId = null;
        targetHodName = 'Unassigned';
      } else {
        const hodUser = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(hod_user_id);
        if (!hodUser || hodUser.role !== 'hod') {
          return res.status(400).json({ error: 'Assigned HOD must be an existing user with HOD role' });
        }
        targetHodUserId = hodUser.id;
        targetHodName = hodUser.name;
      }
    }

    withTransaction(() => {
      // If HOD assignment changed:
      if (existing.hod_user_id !== targetHodUserId) {
        // 1. If previous HOD exists, clear their department relationship so they don't retain unauthorized access
        if (existing.hod_user_id) {
          db.prepare("UPDATE users SET department = 'Unassigned', department_id = NULL WHERE id = ?").run(existing.hod_user_id);
        }

        // 2. If new HOD was assigned to another department, clear that other department's HOD
        if (targetHodUserId) {
          db.prepare("UPDATE departments SET hod_user_id = NULL, hod = 'Unassigned' WHERE hod_user_id = ? AND id != ?").run(targetHodUserId, id);
          // Assign new HOD to this department
          db.prepare('UPDATE users SET department = ?, department_id = ? WHERE id = ?').run(cleanName, id, targetHodUserId);
        }
      } else if (targetHodUserId && cleanName !== existing.name) {
        // If department name changed, sync HOD's department name
        db.prepare('UPDATE users SET department = ? WHERE id = ?').run(cleanName, targetHodUserId);
      }

      // If department name changed, also update faculty members assigned to this department
      if (cleanName !== existing.name) {
        db.prepare('UPDATE users SET department = ? WHERE department_id = ?').run(cleanName, id);
        // Also update department_reports and historical tables where department_name was stored
        db.prepare('UPDATE department_reports SET department_name = ?, department_code = ? WHERE department_code = ?').run(cleanName, cleanCode, existing.code);
      }

      // Update department row
      db.prepare(`
        UPDATE departments SET
          code = ?,
          name = ?,
          description = ?,
          hod = ?,
          hod_user_id = ?,
          established_year = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        cleanCode,
        cleanName,
        description !== undefined ? (description || '').trim() : existing.description,
        targetHodName,
        targetHodUserId,
        estYear,
        cleanStatus,
        id
      );
    });

    const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    res.json({
      message: 'Department updated successfully',
      department: updated
    });
  } catch (err) {
    console.error('Error updating department:', err);
    res.status(500).json({ error: err.message || 'Failed to update department' });
  }
});

// PATCH /api/departments/:id/status - Activate or Deactivate Department (Admin only)
app.patch('/api/departments/:id/status', requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || (status !== 'Active' && status !== 'Inactive')) {
      return res.status(400).json({ error: "Status must be either 'Active' or 'Inactive'" });
    }

    const existing = db.prepare('SELECT id, name, status FROM departments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    db.prepare("UPDATE departments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);

    res.json({
      success: true,
      message: `Department '${existing.name}' status set to ${status}.`,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update department status' });
  }
});

// POST /api/departments/:id/faculty/assign - Assign faculty member(s) to department (Admin only)
app.post('/api/departments/:id/faculty/assign', requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, user_ids } = req.body;

    const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const targetUserIds = Array.isArray(user_ids) ? user_ids : (user_id ? [user_id] : []);
    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: 'At least one user_id is required for assignment' });
    }

    withTransaction(() => {
      for (const uid of targetUserIds) {
        const u = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(uid);
        if (!u) {
          throw new Error(`User with ID ${uid} not found`);
        }
        if (u.role !== 'faculty') {
          throw new Error(`User '${u.name}' has role '${u.role}'. Only users with 'faculty' role can be assigned to department faculty roster.`);
        }
        db.prepare('UPDATE users SET department = ?, department_id = ? WHERE id = ?').run(dept.name, dept.id, uid);
      }
    });

    const updatedFaculty = db.prepare(`
      SELECT id, name, email, role, department, department_id 
      FROM users 
      WHERE role = 'faculty' AND department_id = ?
      ORDER BY name ASC
    `).all(dept.id);

    res.json({
      success: true,
      message: `Assigned ${targetUserIds.length} faculty member(s) to ${dept.name}.`,
      faculty: updatedFaculty
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/departments/:id/faculty/remove - Unassign a faculty member from department (Admin only)
app.post('/api/departments/:id/faculty/remove', requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const user = db.prepare('SELECT id, name, role, department_id FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare("UPDATE users SET department = 'Unassigned', department_id = NULL WHERE id = ?").run(user_id);

    res.json({
      success: true,
      message: `Faculty member '${user.name}' removed from ${dept.name}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3.1 STUDENT MANAGEMENT & SMART SEARCH (Module 3)
// ----------------------------------------------------

// GET /api/students/search - Smart typeahead student search (max 5 active records)
app.get('/api/students/search', requireAuth, (req, res) => {
  try {
    const { q, department } = req.query;
    const user = req.user;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const term = `%${q.trim().toLowerCase()}%`;

    // Role-based department scoping:
    // Admin can search all or filter by department.
    // HOD and Faculty are strictly locked to their assigned department.
    let targetDept = null;
    if (user.role === 'admin') {
      targetDept = department || null;
    } else {
      targetDept = user.department;
    }

    let query = `
      SELECT 
        s.id,
        s.name,
        s.register_no,
        s.register_no as register_number,
        s.department,
        s.department_id,
        s.academic_year,
        s.current_year,
        s.section,
        s.status
      FROM students s
      WHERE (s.status = 'Active' OR s.status IS NULL)
        AND (LOWER(s.name) LIKE ? OR LOWER(s.register_no) LIKE ?)
    `;
    const params = [term, term];

    if (targetDept) {
      query += ' AND (LOWER(s.department) = LOWER(?) OR s.department_id = (SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1))';
      params.push(targetDept, targetDept, targetDept);
    }

    // Always sort by name ASC and enforce maximum 5 results
    query += ' ORDER BY s.name ASC LIMIT 5';

    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (err) {
    console.error('Error in student search:', err);
    res.status(500).json({ error: 'Failed to search students' });
  }
});

// GET /api/students - List students with search, department, batch, and status filtering
app.get('/api/students', requireAuth, (req, res) => {
  try {
    const { search, department, batch, status } = req.query;
    const user = req.user;

    let targetDept = department;
    if (user.role !== 'admin') {
      targetDept = user.department;
    }

    let query = `
      SELECT 
        s.id,
        s.register_no,
        s.name,
        s.department,
        s.department_id,
        s.academic_year,
        s.current_year,
        s.section,
        s.email,
        s.phone,
        COALESCE(s.status, 'Active') as status,
        s.created_at,
        s.updated_at,
        d.code as department_code
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (targetDept && targetDept !== 'All') {
      query += ' AND (LOWER(s.department) = LOWER(?) OR LOWER(d.code) = LOWER(?))';
      params.push(targetDept, targetDept);
    }

    if (batch) {
      query += ' AND s.academic_year = ?';
      params.push(batch);
    }

    if (status && status !== 'All') {
      if (status === 'Active') {
        query += " AND (s.status = 'Active' OR s.status IS NULL)";
      } else {
        query += ' AND s.status = ?';
        params.push(status);
      }
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(s.name) LIKE ? OR LOWER(s.register_no) LIKE ? OR LOWER(s.email) LIKE ?)';
      params.push(term, term, term);
    }

    query += ' ORDER BY s.name ASC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/:id - Student details with associated placement & achievements
app.get('/api/students/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const student = db.prepare(`
      SELECT 
        s.*,
        d.code as department_code
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `).get(id);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Role-based boundary check
    if (user.role !== 'admin' && !checkDepartmentAccess(user, student.department)) {
      return res.status(403).json({ error: 'Access denied for students outside your department' });
    }

    // Fetch associated placements
    const placements = db.prepare(`
      SELECT * FROM placement_records 
      WHERE student_id = ? OR UPPER(register_no) = UPPER(?)
      ORDER BY id DESC
    `).all(student.id, student.register_no);

    // Fetch associated achievements
    const achievements = db.prepare(`
      SELECT * FROM student_achievements 
      WHERE student_ref_id = ? OR UPPER(student_id) = UPPER(?)
      ORDER BY id DESC
    `).all(student.id, student.register_no);

    res.json({
      ...student,
      placements,
      achievements
    });
  } catch (err) {
    console.error('Error fetching student details:', err);
    res.status(500).json({ error: 'Failed to fetch student details' });
  }
});

// POST /api/students - Register a new student (Admin only)
app.post('/api/students', requireRole(['admin']), (req, res) => {
  try {
    const {
      register_no,
      name,
      department_id,
      department,
      academic_year,
      current_year,
      section,
      email,
      phone,
      status
    } = req.body;

    if (!register_no || !register_no.trim()) {
      return res.status(400).json({ error: 'Register Number is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Student Name is required' });
    }
    if (!department && !department_id) {
      return res.status(400).json({ error: 'Department is required' });
    }

    const cleanRegNo = register_no.trim().toUpperCase();
    const cleanName = name.trim();

    // Check unique register_no in database
    const existing = db.prepare('SELECT id FROM students WHERE UPPER(register_no) = ?').get(cleanRegNo);
    if (existing) {
      return res.status(400).json({ error: `Student with register number '${cleanRegNo}' already exists in registry.` });
    }

    // Resolve department
    let targetDeptId = department_id ? parseInt(department_id, 10) : null;
    let targetDeptName = department ? department.trim() : '';

    if (!targetDeptId && targetDeptName) {
      const d = db.prepare('SELECT id, name FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(targetDeptName, targetDeptName);
      if (d) {
        targetDeptId = d.id;
        targetDeptName = d.name;
      }
    } else if (targetDeptId && !targetDeptName) {
      const d = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(targetDeptId);
      if (d) {
        targetDeptName = d.name;
      }
    }

    if (!targetDeptName) {
      return res.status(400).json({ error: 'Invalid department specified' });
    }

    const cleanStatus = status === 'Inactive' ? 'Inactive' : 'Active';
    const currYear = current_year ? parseInt(current_year, 10) : 1;

    const stmt = db.prepare(`
      INSERT INTO students (
        register_no, name, department_id, department,
        academic_year, current_year, section, email, phone, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      cleanRegNo,
      cleanName,
      targetDeptId,
      targetDeptName,
      academic_year ? academic_year.trim() : '2022-26',
      currYear,
      section ? section.trim().toUpperCase() : '',
      email ? email.trim() : '',
      phone ? phone.trim() : '',
      cleanStatus
    );

    res.status(201).json({
      message: 'Student registered successfully',
      id: result.lastInsertRowid,
      register_no: cleanRegNo,
      name: cleanName,
      department: targetDeptName,
      status: cleanStatus
    });
  } catch (err) {
    console.error('Error registering student:', err);
    res.status(500).json({ error: err.message || 'Failed to register student' });
  }
});

// PUT /api/students/:id - Update student details (Admin only)
app.put('/api/students/:id', requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const {
      register_no,
      name,
      department_id,
      department,
      academic_year,
      current_year,
      section,
      email,
      phone,
      status
    } = req.body;

    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!register_no || !register_no.trim()) {
      return res.status(400).json({ error: 'Register Number is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Student Name is required' });
    }

    const cleanRegNo = register_no.trim().toUpperCase();
    const cleanName = name.trim();

    // Check duplicate register_no against other students
    const duplicate = db.prepare('SELECT id FROM students WHERE UPPER(register_no) = ? AND id != ?').get(cleanRegNo, id);
    if (duplicate) {
      return res.status(400).json({ error: `Register number '${cleanRegNo}' is already assigned to another student.` });
    }

    let targetDeptId = department_id ? parseInt(department_id, 10) : existing.department_id;
    let targetDeptName = department ? department.trim() : existing.department;

    if (department && !department_id) {
      const d = db.prepare('SELECT id, name FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(department.trim(), department.trim());
      if (d) {
        targetDeptId = d.id;
        targetDeptName = d.name;
      }
    }

    const cleanStatus = status === 'Inactive' ? 'Inactive' : 'Active';
    const currYear = current_year ? parseInt(current_year, 10) : existing.current_year;

    db.prepare(`
      UPDATE students SET
        register_no = ?,
        name = ?,
        department_id = ?,
        department = ?,
        academic_year = ?,
        current_year = ?,
        section = ?,
        email = ?,
        phone = ?,
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      cleanRegNo,
      cleanName,
      targetDeptId,
      targetDeptName,
      academic_year !== undefined ? (academic_year || '').trim() : existing.academic_year,
      currYear,
      section !== undefined ? (section || '').trim().toUpperCase() : existing.section,
      email !== undefined ? (email || '').trim() : existing.email,
      phone !== undefined ? (phone || '').trim() : existing.phone,
      cleanStatus,
      id
    );

    const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    res.json({
      message: 'Student updated successfully',
      student: updated
    });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: err.message || 'Failed to update student' });
  }
});

// PATCH /api/students/:id/status - Toggle active/inactive status (Admin only)
app.patch('/api/students/:id/status', requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || (status !== 'Active' && status !== 'Inactive')) {
      return res.status(400).json({ error: "Status must be either 'Active' or 'Inactive'" });
    }

    const existing = db.prepare('SELECT id, name, status FROM students WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    db.prepare("UPDATE students SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);

    res.json({
      success: true,
      message: `Student '${existing.name}' status set to ${status}.`,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update student status' });
  }
});

// ----------------------------------------------------
// 4. DEPARTMENT REPORTS (Screen 3)
// ----------------------------------------------------
app.get('/api/department-reports', (req, res) => {
  try {
    const { department, academic_year } = req.query;
    let query = 'SELECT * FROM department_reports WHERE 1=1';
    const params = [];

    if (department) {
      query += ' AND (department_code = ? OR department_name = ?)';
      params.push(department, department);
    }
    if (academic_year) {
      query += ' AND academic_year = ?';
      params.push(academic_year);
    }

    query += ' ORDER BY id DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch department reports' });
  }
});

app.post('/api/department-reports', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const {
      department_code,
      department_name,
      academic_year,
      hod,
      total_students,
      male_students,
      female_students,
      total_faculty,
      courses_count,
      projects_count,
      publications_count,
      events_count,
      description
    } = req.body;

    // Role check: HOD can only manage their own department
    if (user.role === 'hod' && !checkDepartmentAccess(user, department_name)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot modify details for ${department_name}` });
    }

    // Basic Validation
    if (!department_name || !academic_year || !hod) {
      return res.status(400).json({ error: 'Department Name, Academic Year, and Head of Department are required' });
    }

    const totStudents = parseInt(total_students, 10) || 0;
    const mStudents = parseInt(male_students, 10) || 0;
    const fStudents = parseInt(female_students, 10) || 0;

    if (mStudents + fStudents > totStudents && totStudents > 0) {
      return res.status(400).json({ error: 'Male students + Female students cannot exceed Total Students' });
    }

    let code = department_code;
    if (!code) {
      const dept = db.prepare('SELECT code FROM departments WHERE name = ?').get(department_name);
      code = dept ? dept.code : department_name.substring(0, 4).toUpperCase();
    }

    const existing = db.prepare('SELECT id FROM department_reports WHERE (department_code = ? OR department_name = ?) AND academic_year = ?')
      .get(code, department_name, academic_year);

    if (existing) {
      const updateStmt = db.prepare(`
        UPDATE department_reports SET
          department_code = ?,
          department_name = ?,
          hod = ?,
          total_students = ?,
          male_students = ?,
          female_students = ?,
          total_faculty = ?,
          courses_count = ?,
          projects_count = ?,
          publications_count = ?,
          events_count = ?,
          description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateStmt.run(
        code,
        department_name,
        hod,
        totStudents,
        mStudents,
        fStudents,
        parseInt(total_faculty, 10) || 0,
        parseInt(courses_count, 10) || 0,
        parseInt(projects_count, 10) || 0,
        parseInt(publications_count, 10) || 0,
        parseInt(events_count, 10) || 0,
        description || '',
        existing.id
      );

      return res.json({ message: 'Department information updated successfully', id: existing.id });
    }

    const insertStmt = db.prepare(`
      INSERT INTO department_reports (
        department_code, department_name, academic_year, hod,
        total_students, male_students, female_students, total_faculty,
        courses_count, projects_count, publications_count, events_count, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      code,
      department_name,
      academic_year,
      hod,
      totStudents,
      mStudents,
      fStudents,
      parseInt(total_faculty, 10) || 0,
      parseInt(courses_count, 10) || 0,
      parseInt(projects_count, 10) || 0,
      parseInt(publications_count, 10) || 0,
      parseInt(events_count, 10) || 0,
      description || ''
    );

    res.status(201).json({ message: 'Department information saved successfully', id: result.lastInsertRowid });
  } catch (err) {
    console.error('Error saving department report:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. STUDENT ACHIEVEMENTS (Module 5: Full DB Integration & Workflow)
// ----------------------------------------------------

// Ensure certificates directory exists
const certificateUploadsDir = path.join(__dirname, 'uploads', 'certificates');
if (!fs.existsSync(certificateUploadsDir)) {
  fs.mkdirSync(certificateUploadsDir, { recursive: true });
}

// GET /api/student-achievements and /api/achievements - List achievements with multi-field search and filters
app.get(['/api/student-achievements', '/api/achievements'], (req, res) => {
  try {
    const { department, academic_year, status, category, level, search, q } = req.query;
    const user = getCurrentUser(req);
    const searchTerm = (search || q || '').trim().toLowerCase();

    // Enforce role-based departmental scoping
    let targetDept = department;
    if (user && user.role === 'hod') {
      if (department && department.toLowerCase() !== user.department.toLowerCase()) {
        return res.status(403).json({ error: `HOD of ${user.department} cannot view achievements for ${department}` });
      }
      targetDept = user.department;
    } else if (user && user.role === 'faculty') {
      targetDept = user.department;
    }

    let query = `
      SELECT 
        sa.*,
        COALESCE(sa.category, sa.achievement_type) as category,
        COALESCE(sa.event_name, sa.event_organization) as event_name,
        COALESCE(sa.level, 'National') as level,
        COALESCE(sa.award, '1st Prize') as award,
        s.name as student_full_name,
        s.register_no as student_reg_no,
        s.academic_year as academic_batch,
        s.status as student_current_status,
        u.name as reviewer_name
      FROM student_achievements sa
      LEFT JOIN students s ON sa.student_ref_id = s.id
      LEFT JOIN users u ON sa.reviewed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (targetDept) {
      query += ' AND LOWER(sa.department) = LOWER(?)';
      params.push(targetDept);
    }
    if (academic_year) {
      query += ' AND sa.academic_year = ?';
      params.push(academic_year);
    }
    if (status && status !== 'All') {
      query += ' AND sa.status = ?';
      params.push(status);
    }
    if (category && category !== 'All') {
      query += ' AND (LOWER(sa.category) = LOWER(?) OR LOWER(sa.achievement_type) = LOWER(?))';
      params.push(category, category);
    }
    if (level && level !== 'All') {
      query += ' AND LOWER(sa.level) = LOWER(?)';
      params.push(level);
    }

    // Faculty can see all Approved achievements for their department, OR their own submissions
    if (user && user.role === 'faculty') {
      query += " AND (sa.status = 'Approved' OR sa.submitted_by = ?)";
      params.push(user.id);
    }

    if (searchTerm) {
      query += ` AND (
        LOWER(sa.title) LIKE ? OR 
        LOWER(sa.student_name) LIKE ? OR 
        LOWER(sa.student_id) LIKE ? OR 
        LOWER(COALESCE(sa.event_name, sa.event_organization)) LIKE ? OR 
        LOWER(COALESCE(sa.award, '')) LIKE ? OR
        LOWER(COALESCE(sa.description, '')) LIKE ?
      )`;
      const sPattern = `%${searchTerm}%`;
      params.push(sPattern, sPattern, sPattern, sPattern, sPattern, sPattern);
    }

    query += ' ORDER BY sa.id DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch student achievements:', err);
    res.status(500).json({ error: 'Failed to fetch student achievements' });
  }
});

// GET /api/student-achievements/:id - Retrieve full achievement details with student and reviewer info
app.get('/api/student-achievements/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const row = db.prepare(`
      SELECT 
        sa.*,
        COALESCE(sa.category, sa.achievement_type) as category,
        COALESCE(sa.event_name, sa.event_organization) as event_name,
        COALESCE(sa.level, 'National') as level,
        COALESCE(sa.award, '1st Prize') as award,
        s.name as student_full_name,
        s.register_no as student_reg_no,
        s.academic_year as academic_batch,
        s.current_year as student_year,
        s.status as student_current_status,
        u.name as reviewer_name,
        sub.name as submitter_name
      FROM student_achievements sa
      LEFT JOIN students s ON sa.student_ref_id = s.id
      LEFT JOIN users u ON sa.reviewed_by = u.id
      LEFT JOIN users sub ON sa.submitted_by = sub.id
      WHERE sa.id = ?
    `).get(id);

    if (!row) {
      return res.status(404).json({ error: 'Student achievement record not found' });
    }

    // Role and department boundary validation
    if (user.role === 'hod' && !checkDepartmentAccess(user, row.department)) {
      return res.status(403).json({ error: `Cannot access achievements of department ${row.department}` });
    }
    if (user.role === 'faculty') {
      if (!checkDepartmentAccess(user, row.department)) {
        return res.status(403).json({ error: `Cannot access achievements of department ${row.department}` });
      }
      if (row.status !== 'Approved' && row.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only view approved records or their own submissions' });
      }
    }

    res.json(row);
  } catch (err) {
    console.error('Error fetching achievement details:', err);
    res.status(500).json({ error: 'Failed to fetch achievement details' });
  }
});

// POST /api/student-achievements - Create a student achievement (Validates real active student)
app.post('/api/student-achievements', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      student_ref_id,
      title,
      description,
      category,
      achievement_type,
      event_name,
      event_organization,
      level,
      award,
      date,
      academic_year,
      department,
      department_id,
      certificate_path,
      is_draft,
      status
    } = req.body;

    // Validate departmental permissions
    if (user.role === 'faculty' || user.role === 'hod') {
      if (!checkDepartmentAccess(user, department)) {
        return res.status(403).json({ error: `You do not have permission to submit achievements for ${department}` });
      }
    }

    // Strict student validation against database
    let targetStudentRefId = (student_ref_id || req.body.studentId) ? parseInt(student_ref_id || req.body.studentId, 10) : null;
    let student = null;

    if (targetStudentRefId) {
      student = db.prepare('SELECT id, name, register_no, department, status FROM students WHERE id = ?').get(targetStudentRefId);
      if (!student) {
        return res.status(400).json({ error: 'Selected student does not exist in the student registry.' });
      }
    } else if (req.body.student_id) {
      const numId = parseInt(req.body.student_id, 10);
      if (!isNaN(numId) && String(numId) === String(req.body.student_id).trim()) {
        student = db.prepare('SELECT id, name, register_no, department, status FROM students WHERE id = ?').get(numId);
        if (student) targetStudentRefId = student.id;
      }
      if (!student) {
        const regNo = String(req.body.student_id).trim();
        student = db.prepare('SELECT id, name, register_no, department, status FROM students WHERE UPPER(register_no) = UPPER(?)').get(regNo);
        if (student) targetStudentRefId = student.id;
      }
    }

    if (!student || !targetStudentRefId) {
      return res.status(400).json({ error: 'A valid registered student must be selected from the database.' });
    }

    if (student.status !== 'Active') {
      return res.status(400).json({ error: `Selected student '${student.name}' is inactive. Achievements cannot be logged for inactive students.` });
    }

    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Achievement Title is required.' });
    }

    const cleanCategory = (category || achievement_type || 'Technical').trim();
    const cleanEvent = (event_name || event_organization || '').trim();
    if (!cleanEvent) {
      return res.status(400).json({ error: 'Event or competition name is required.' });
    }

    const cleanDate = (date || '').trim();
    if (!cleanDate) {
      return res.status(400).json({ error: 'Achievement Date is required.' });
    }

    const cleanYear = (academic_year || '2025-26').trim();
    const cleanDept = (department || student.department).trim();
    const cleanLevel = (level || 'National').trim();
    const cleanAward = (award || '1st Prize').trim();

    // Resolve department_id
    let resolvedDeptId = department_id ? parseInt(department_id, 10) : null;
    if (!resolvedDeptId) {
      const d = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(cleanDept, cleanDept);
      if (d) resolvedDeptId = d.id;
    }

    // Determine initial approval status
    let initialStatus = 'Pending Approval';
    if (is_draft === true || status === 'Draft') {
      initialStatus = 'Draft';
    } else if (user.role === 'admin' || user.role === 'hod') {
      initialStatus = 'Approved';
    }

    const insertStmt = db.prepare(`
      INSERT INTO student_achievements (
        student_ref_id,
        student_name,
        student_id,
        department_id,
        department,
        academic_year,
        achievement_type,
        category,
        title,
        event_organization,
        event_name,
        level,
        award,
        date,
        description,
        certificate_path,
        status,
        submitted_by,
        submitted_by_name,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = withTransaction(() => {
      return insertStmt.run(
        student.id,
        student.name,
        student.register_no,
        resolvedDeptId,
        cleanDept,
        cleanYear,
        cleanCategory,
        cleanCategory,
        cleanTitle,
        cleanEvent,
        cleanEvent,
        cleanLevel,
        cleanAward,
        cleanDate,
        description ? description.trim() : '',
        certificate_path ? certificate_path.trim() : null,
        initialStatus,
        user.id,
        user.name
      );
    });

    res.status(201).json({
      message: initialStatus === 'Approved'
        ? 'Student achievement recorded successfully (Directly Approved)'
        : initialStatus === 'Draft'
        ? 'Student achievement saved as draft'
        : 'Student achievement submitted for HOD verification and approval',
      id: result.lastInsertRowid,
      status: initialStatus
    });
  } catch (err) {
    console.error('Error adding student achievement:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/student-achievements/:id - Update an achievement with permission guards and resubmission
app.put('/api/student-achievements/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM student_achievements WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Student achievement record not found' });
    }

    // Role-based departmental security
    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `Cannot modify achievements of department ${existing.department}` });
    }

    // Faculty permission constraints
    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only modify their own submissions.' });
      }
      if (existing.status === 'Approved') {
        return res.status(403).json({ error: 'Approved achievements cannot be modified by faculty. Please contact HOD or Admin.' });
      }
    }

    const {
      student_ref_id,
      title,
      description,
      category,
      achievement_type,
      event_name,
      event_organization,
      level,
      award,
      date,
      academic_year,
      department,
      certificate_path,
      status
    } = req.body;

    // Validate student if changed
    let studentRefId = existing.student_ref_id;
    let resolvedStudentName = existing.student_name;
    let resolvedStudentReg = existing.student_id;

    if (student_ref_id && student_ref_id !== existing.student_ref_id) {
      const student = db.prepare('SELECT id, name, register_no, status FROM students WHERE id = ?').get(student_ref_id);
      if (!student) {
        return res.status(400).json({ error: 'Selected student does not exist in database.' });
      }
      if (student.status !== 'Active') {
        return res.status(400).json({ error: `Student '${student.name}' is inactive.` });
      }
      studentRefId = student.id;
      resolvedStudentName = student.name;
      resolvedStudentReg = student.register_no;
    }

    // Status transition handling
    let newStatus = existing.status;
    if (user.role === 'faculty') {
      if (existing.status === 'Changes Requested' || existing.status === 'Draft') {
        newStatus = (status === 'Draft') ? 'Draft' : 'Pending Approval';
      }
    } else if (user.role === 'admin' || user.role === 'hod') {
      if (status) newStatus = status;
    }

    const cleanCategory = category || achievement_type || existing.category || existing.achievement_type;
    const cleanEvent = event_name || event_organization || existing.event_name || existing.event_organization;

    const stmt = db.prepare(`
      UPDATE student_achievements SET
        student_ref_id = ?,
        student_name = ?,
        student_id = ?,
        department = ?,
        academic_year = ?,
        achievement_type = ?,
        category = ?,
        title = ?,
        event_organization = ?,
        event_name = ?,
        level = ?,
        award = ?,
        date = ?,
        description = ?,
        certificate_path = ?,
        status = ?,
        review_comments = CASE WHEN ? = 'Pending Approval' THEN NULL ELSE review_comments END,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      studentRefId,
      resolvedStudentName,
      resolvedStudentReg,
      department || existing.department,
      academic_year || existing.academic_year,
      cleanCategory,
      cleanCategory,
      title ? title.trim() : existing.title,
      cleanEvent,
      cleanEvent,
      level || existing.level || 'National',
      award || existing.award || '1st Prize',
      date || existing.date,
      description !== undefined ? description : existing.description,
      certificate_path !== undefined ? certificate_path : existing.certificate_path,
      newStatus,
      newStatus,
      id
    );

    res.json({
      message: newStatus === 'Pending Approval' && existing.status === 'Changes Requested'
        ? 'Achievement revisions resubmitted for HOD approval'
        : 'Student achievement updated successfully',
      status: newStatus
    });
  } catch (err) {
    console.error('Error updating student achievement:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/student-achievements/:id - Delete an achievement safely
app.delete('/api/student-achievements/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM student_achievements WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Student achievement record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `Cannot delete achievements of department ${existing.department}` });
    }

    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only delete their own submissions.' });
      }
      if (existing.status === 'Approved') {
        return res.status(403).json({ error: 'Approved achievements cannot be deleted by faculty.' });
      }
    }

    db.prepare('DELETE FROM student_achievements WHERE id = ?').run(id);
    res.json({ message: 'Student achievement deleted successfully' });
  } catch (err) {
    console.error('Error deleting student achievement:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student-achievements/:id/approve - Approve an achievement submission (Admin / HOD only)
app.post('/api/student-achievements/:id/approve', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM student_achievements WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Achievement record not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot approve records for ${existing.department}` });
    }

    // Security policy: anti-self-approval
    if (existing.submitted_by === user.id) {
      return res.status(403).json({ error: 'Security policy: You cannot approve your own submission.' });
    }

    db.prepare(`
      UPDATE student_achievements SET
        status = 'Approved',
        reviewed_by = ?,
        review_comments = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id, req.body.comments ? req.body.comments.trim() : `Approved by ${user.name}`, id);

    res.json({
      success: true,
      message: 'Student achievement approved successfully',
      status: 'Approved'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student-achievements/:id/request-changes - Request revisions with feedback (Admin / HOD only)
app.post('/api/student-achievements/:id/request-changes', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { comments } = req.body;

    if (!comments || !comments.trim()) {
      return res.status(400).json({ error: 'Feedback comments explaining the required changes are required.' });
    }

    const existing = db.prepare('SELECT * FROM student_achievements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Achievement record not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot review records for ${existing.department}` });
    }

    db.prepare(`
      UPDATE student_achievements SET
        status = 'Changes Requested',
        reviewed_by = ?,
        review_comments = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id, comments.trim(), id);

    res.json({
      success: true,
      message: 'Revisions requested from faculty',
      status: 'Changes Requested'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student-achievements/:id/submit - Submit a draft achievement for HOD review
app.post('/api/student-achievements/:id/submit', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM student_achievements WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Achievement record not found' });
    }

    if (user.role === 'faculty' && existing.submitted_by !== user.id) {
      return res.status(403).json({ error: 'Faculty can only submit their own records.' });
    }

    db.prepare(`
      UPDATE student_achievements SET
        status = 'Pending Approval',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: 'Achievement submitted for HOD approval',
      status: 'Pending Approval'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student-achievements/upload-certificate - Secure certificate/document upload
app.post('/api/student-achievements/upload-certificate', requireAuth, (req, res) => {
  try {
    const { file_name, file_data } = req.body;
    if (!file_data || !file_name) {
      return res.status(400).json({ error: 'File data and file name are required' });
    }

    const safeBaseName = path.basename(file_name);
    const ext = path.extname(safeBaseName).toLowerCase();
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];

    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Permitted document types are PDF, PNG, and JPG only.' });
    }

    // Strip header prefix if present (e.g. data:application/pdf;base64,...)
    const base64Data = file_data.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Limit file size to 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds maximum permitted size of 5MB.' });
    }

    const sanitizedUniqueName = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const destination = path.join(certificateUploadsDir, sanitizedUniqueName);

    fs.writeFileSync(destination, buffer);

    const relativeUrl = `/api/student-achievements/certificates/${sanitizedUniqueName}`;
    res.json({
      success: true,
      message: 'Certificate uploaded successfully',
      certificate_path: relativeUrl,
      file_name: safeBaseName
    });
  } catch (err) {
    console.error('Certificate upload error:', err);
    res.status(500).json({ error: 'Failed to upload certificate document.' });
  }
});

// GET /api/student-achievements/certificates/:filename - Secure certificate download
app.get('/api/student-achievements/certificates/:filename', requireAuth, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(certificateUploadsDir, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Certificate document not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Error downloading certificate' });
  }
});

// ----------------------------------------------------
// 6. FACULTY INFORMATION MANAGEMENT (Module 4: HOD & Admin ONLY)
// ----------------------------------------------------

// GET /api/faculty/unlinked-users - List user accounts eligible to be linked to a faculty record
app.get('/api/faculty/unlinked-users', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.department, u.department_id 
      FROM users u
      WHERE u.role IN ('faculty', 'hod')
    `;
    const params = [];

    if (user.role === 'hod') {
      query += ' AND LOWER(u.department) = LOWER(?)';
      params.push(user.department);
    }

    query += ' ORDER BY u.name ASC';
    const users = db.prepare(query).all(...params);
    res.json(users);
  } catch (err) {
    console.error('Error fetching unlinked faculty users:', err);
    res.status(500).json({ error: 'Failed to fetch faculty user accounts' });
  }
});

// GET /api/faculty - List faculty records with search, department, batch, and status filtering
app.get('/api/faculty', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { department, academic_year, status, search } = req.query;
    const user = req.user;

    let targetDept = department;
    if (user.role === 'hod') {
      targetDept = user.department;
    }

    let query = `
      SELECT 
        f.id,
        f.faculty_name,
        f.faculty_id,
        f.department,
        f.department_id,
        f.academic_year,
        f.designation,
        f.qualification,
        f.specialization,
        f.date_of_joining,
        f.email,
        f.phone,
        COALESCE(f.status, 'Active') as status,
        f.publications,
        f.research_projects,
        f.conferences_attended,
        f.awards,
        f.description,
        f.user_id,
        f.created_at,
        f.updated_at,
        d.code as department_code,
        u.email as linked_user_email
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (targetDept) {
      query += ' AND (LOWER(f.department) = LOWER(?) OR LOWER(d.code) = LOWER(?))';
      params.push(targetDept, targetDept);
    }

    if (academic_year) {
      query += ' AND f.academic_year = ?';
      params.push(academic_year);
    }

    if (status && status !== 'All') {
      if (status === 'Active') {
        query += " AND (f.status = 'Active' OR f.status IS NULL)";
      } else {
        query += ' AND f.status = ?';
        params.push(status);
      }
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(f.faculty_name) LIKE ? OR LOWER(f.faculty_id) LIKE ? OR LOWER(f.email) LIKE ? OR LOWER(f.specialization) LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY f.faculty_name ASC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching faculty records:', err);
    res.status(500).json({ error: 'Failed to fetch faculty records' });
  }
});

// GET /api/faculty/:id - Retrieve single faculty record details
app.get('/api/faculty/:id', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const faculty = db.prepare(`
      SELECT 
        f.*,
        d.code as department_code,
        u.email as linked_user_email,
        u.name as linked_user_name
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `).get(id);

    if (!faculty) {
      return res.status(404).json({ error: 'Faculty record not found' });
    }

    // Role-based department check
    if (user.role === 'hod' && !checkDepartmentAccess(user, faculty.department)) {
      return res.status(403).json({ error: `Access denied. You cannot view faculty from department '${faculty.department}'.` });
    }

    res.json(faculty);
  } catch (err) {
    console.error('Error fetching faculty details:', err);
    res.status(500).json({ error: 'Failed to fetch faculty details' });
  }
});

// POST /api/faculty - Register a new faculty record (Admin & HOD for their department)
app.post('/api/faculty', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const {
      faculty_name,
      faculty_id,
      department_id,
      department,
      academic_year,
      designation,
      qualification,
      specialization,
      date_of_joining,
      email,
      phone,
      status,
      user_id,
      publications,
      research_projects,
      conferences_attended,
      awards,
      description
    } = req.body;

    if (!faculty_name || !faculty_name.trim()) {
      return res.status(400).json({ error: 'Faculty Name is required' });
    }
    if (!faculty_id || !faculty_id.trim()) {
      return res.status(400).json({ error: 'Faculty Employee ID is required' });
    }
    if (!department && !department_id) {
      return res.status(400).json({ error: 'Department is required' });
    }
    if (!designation || !designation.trim()) {
      return res.status(400).json({ error: 'Designation is required' });
    }
    if (!qualification || !qualification.trim()) {
      return res.status(400).json({ error: 'Qualification is required' });
    }

    const cleanFacultyId = faculty_id.trim().toUpperCase();
    const cleanName = faculty_name.trim();

    // Check Employee ID uniqueness in database
    const existingEmp = db.prepare('SELECT id FROM faculty WHERE UPPER(faculty_id) = ?').get(cleanFacultyId);
    if (existingEmp) {
      return res.status(400).json({ error: `Faculty with Employee ID '${cleanFacultyId}' already exists in registry.` });
    }

    // Resolve department
    let targetDeptId = department_id ? parseInt(department_id, 10) : null;
    let targetDeptName = department ? department.trim() : '';

    if (!targetDeptId && targetDeptName) {
      const d = db.prepare('SELECT id, name FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(targetDeptName, targetDeptName);
      if (d) {
        targetDeptId = d.id;
        targetDeptName = d.name;
      }
    } else if (targetDeptId && !targetDeptName) {
      const d = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(targetDeptId);
      if (d) {
        targetDeptName = d.name;
      }
    }

    if (!targetDeptName) {
      return res.status(400).json({ error: 'Invalid department specified' });
    }

    // Enforce HOD boundary
    if (!checkDepartmentAccess(user, targetDeptName)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot manage faculty in ${targetDeptName}` });
    }

    // Resolve optional linked user account
    let targetUserId = user_id ? parseInt(user_id, 10) : null;
    if (targetUserId) {
      const linkedUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(targetUserId);
      if (!linkedUser) {
        return res.status(400).json({ error: 'Selected linked user account does not exist' });
      }
    }

    const cleanStatus = status === 'Inactive' ? 'Inactive' : 'Active';

    const stmt = db.prepare(`
      INSERT INTO faculty (
        faculty_name, faculty_id, department_id, department, academic_year,
        designation, qualification, specialization, date_of_joining,
        email, phone, status, user_id, publications, research_projects,
        conferences_attended, awards, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      cleanName,
      cleanFacultyId,
      targetDeptId,
      targetDeptName,
      academic_year ? academic_year.trim() : '2025-26',
      designation.trim(),
      qualification.trim(),
      specialization ? specialization.trim() : '',
      date_of_joining ? date_of_joining.trim() : '',
      email ? email.trim() : '',
      phone ? phone.trim() : '',
      cleanStatus,
      targetUserId,
      parseInt(publications, 10) || 0,
      parseInt(research_projects, 10) || 0,
      parseInt(conferences_attended, 10) || 0,
      awards || '',
      description || ''
    );

    res.status(201).json({
      message: 'Faculty record added successfully by HOD/Admin',
      id: result.lastInsertRowid,
      faculty_name: cleanName,
      faculty_id: cleanFacultyId,
      department: targetDeptName,
      status: cleanStatus
    });
  } catch (err) {
    console.error('Error registering faculty record:', err);
    res.status(500).json({ error: err.message || 'Failed to register faculty record' });
  }
});

// PUT /api/faculty/:id - Update faculty record details (Admin & HOD for their department)
app.put('/api/faculty/:id', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM faculty WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Faculty record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `Cannot modify faculty of department ${existing.department}` });
    }

    const {
      faculty_name,
      faculty_id,
      department_id,
      department,
      academic_year,
      designation,
      qualification,
      specialization,
      date_of_joining,
      email,
      phone,
      status,
      user_id,
      publications,
      research_projects,
      conferences_attended,
      awards,
      description
    } = req.body;

    const cleanFacultyId = (faculty_id !== undefined && faculty_id !== null && String(faculty_id).trim()) 
      ? String(faculty_id).trim().toUpperCase() 
      : existing.faculty_id;
    const cleanName = (faculty_name !== undefined && faculty_name !== null && String(faculty_name).trim()) 
      ? String(faculty_name).trim() 
      : existing.faculty_name;

    if (!cleanName) {
      return res.status(400).json({ error: 'Faculty Name is required' });
    }
    if (!cleanFacultyId) {
      return res.status(400).json({ error: 'Faculty Employee ID is required' });
    }

    // Check Employee ID uniqueness against other records
    const duplicateEmp = db.prepare('SELECT id FROM faculty WHERE UPPER(faculty_id) = ? AND id != ?').get(cleanFacultyId, id);
    if (duplicateEmp) {
      return res.status(400).json({ error: `Employee ID '${cleanFacultyId}' is already assigned to another faculty member.` });
    }

    let targetDeptId = department_id ? parseInt(department_id, 10) : existing.department_id;
    let targetDeptName = department ? department.trim() : existing.department;

    if (department && !department_id) {
      const d = db.prepare('SELECT id, name FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(department.trim(), department.trim());
      if (d) {
        targetDeptId = d.id;
        targetDeptName = d.name;
      }
    }

    // HOD cannot reassign faculty to another department
    if (user.role === 'hod' && targetDeptName.toLowerCase() !== user.department.toLowerCase()) {
      return res.status(403).json({ error: 'HODs cannot reassign faculty to other departments.' });
    }

    let targetUserId = user_id !== undefined ? (user_id ? parseInt(user_id, 10) : null) : existing.user_id;
    const cleanStatus = status === 'Inactive' ? 'Inactive' : 'Active';

    const stmt = db.prepare(`
      UPDATE faculty SET
        faculty_name = ?,
        faculty_id = ?,
        department_id = ?,
        department = ?,
        academic_year = ?,
        designation = ?,
        qualification = ?,
        specialization = ?,
        date_of_joining = ?,
        email = ?,
        phone = ?,
        status = ?,
        user_id = ?,
        publications = ?,
        research_projects = ?,
        conferences_attended = ?,
        awards = ?,
        description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      cleanName,
      cleanFacultyId,
      targetDeptId,
      targetDeptName,
      academic_year !== undefined ? (academic_year || '').trim() : existing.academic_year,
      designation ? designation.trim() : existing.designation,
      qualification ? qualification.trim() : existing.qualification,
      specialization !== undefined ? (specialization || '').trim() : existing.specialization,
      date_of_joining !== undefined ? (date_of_joining || '').trim() : existing.date_of_joining,
      email !== undefined ? (email || '').trim() : existing.email,
      phone !== undefined ? (phone || '').trim() : existing.phone,
      cleanStatus,
      targetUserId,
      publications !== undefined ? (parseInt(publications, 10) || 0) : existing.publications,
      research_projects !== undefined ? (parseInt(research_projects, 10) || 0) : existing.research_projects,
      conferences_attended !== undefined ? (parseInt(conferences_attended, 10) || 0) : existing.conferences_attended,
      awards !== undefined ? awards : existing.awards,
      description !== undefined ? description : existing.description,
      id
    );

    const updated = db.prepare('SELECT * FROM faculty WHERE id = ?').get(id);
    res.json({ message: 'Faculty record updated successfully', faculty: updated });
  } catch (err) {
    console.error('Error updating faculty record:', err);
    res.status(500).json({ error: err.message || 'Failed to update faculty record' });
  }
});

// PATCH /api/faculty/:id/status - Toggle active/inactive status (Admin & HOD for their department)
app.patch('/api/faculty/:id/status', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { status } = req.body;

    if (!status || (status !== 'Active' && status !== 'Inactive')) {
      return res.status(400).json({ error: "Status must be either 'Active' or 'Inactive'" });
    }

    const existing = db.prepare('SELECT id, faculty_name, department, status FROM faculty WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Faculty record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `Cannot toggle faculty status for department ${existing.department}` });
    }

    db.prepare("UPDATE faculty SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);

    res.json({
      success: true,
      message: `Faculty member '${existing.faculty_name}' status set to ${status}.`,
      status
    });
  } catch (err) {
    console.error('Error toggling faculty status:', err);
    res.status(500).json({ error: err.message || 'Failed to update faculty status' });
  }
});

// DELETE /api/faculty/:id - Remove or archive faculty record safely (Admin & HOD for their department)
app.delete('/api/faculty/:id', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM faculty WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Faculty record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `Cannot delete faculty from department ${existing.department}` });
    }

    // Safely delete faculty master record without touching user login accounts or cascading
    db.prepare('DELETE FROM faculty WHERE id = ?').run(id);
    res.json({ message: `Faculty record for '${existing.faculty_name}' deleted successfully.` });
  } catch (err) {
    console.error('Error deleting faculty record:', err);
    res.status(500).json({ error: err.message || 'Failed to delete faculty record' });
  }
});

// ----------------------------------------------------
// 7. DEPARTMENT ACTIVITIES (Module 6: DB, Backend, Multi-Student/Faculty, HOD Approval)
// ----------------------------------------------------

const activityUploadsDir = path.join(__dirname, 'uploads', 'activities');
if (!fs.existsSync(activityUploadsDir)) {
  fs.mkdirSync(activityUploadsDir, { recursive: true });
}

// GET /api/activities - List activities with search, multi-field filters, and linked student/faculty counts
app.get('/api/activities', (req, res) => {
  try {
    const { department, academic_year, status, category, activity_type, search, q } = req.query;
    const user = getCurrentUser(req);
    const searchTerm = (search || q || '').trim().toLowerCase();

    // Department scoping
    let targetDept = department;
    if (user && user.role === 'hod') {
      if (department && department.toLowerCase() !== user.department.toLowerCase()) {
        return res.status(403).json({ error: `HOD of ${user.department} cannot access activities for ${department}` });
      }
      targetDept = user.department;
    } else if (user && user.role === 'faculty') {
      targetDept = user.department;
    }

    let query = `
      SELECT 
        a.*,
        COALESCE(a.coordinator, a.faculty_coordinator) as coordinator,
        COALESCE(a.venue, 'Campus Main Auditorium') as venue,
        COALESCE(a.organizer, a.department || ' Association') as organizer,
        d.code as department_code,
        u.name as reviewer_name,
        (SELECT COUNT(DISTINCT ast.student_id) FROM activity_students ast WHERE ast.activity_id = a.id) as students_count,
        (SELECT COUNT(DISTINCT af.faculty_id) FROM activity_faculty af WHERE af.activity_id = a.id) as faculty_count
      FROM activities a
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN users u ON a.reviewed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (targetDept) {
      query += ' AND LOWER(a.department) = LOWER(?)';
      params.push(targetDept);
    }
    if (academic_year) {
      query += ' AND a.academic_year = ?';
      params.push(academic_year);
    }
    if (status && status !== 'All') {
      query += ' AND a.status = ?';
      params.push(status);
    }
    const catFilter = category || activity_type;
    if (catFilter && catFilter !== 'All') {
      query += ' AND LOWER(a.activity_type) = LOWER(?)';
      params.push(catFilter);
    }

    // Faculty can view approved and their own
    if (user && user.role === 'faculty') {
      query += " AND (a.status = 'Approved' OR a.submitted_by = ?)";
      params.push(user.id);
    }

    if (searchTerm) {
      query += ` AND (
        LOWER(a.activity_name) LIKE ? OR
        LOWER(COALESCE(a.description, '')) LIKE ? OR
        LOWER(COALESCE(a.venue, '')) LIKE ? OR
        LOWER(COALESCE(a.organizer, '')) LIKE ? OR
        LOWER(COALESCE(a.coordinator, a.faculty_coordinator)) LIKE ? OR
        LOWER(a.activity_type) LIKE ?
      )`;
      const sPattern = `%${searchTerm}%`;
      params.push(sPattern, sPattern, sPattern, sPattern, sPattern, sPattern);
    }

    query += ' ORDER BY a.id DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch activities:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// GET /api/activities/:id - Retrieve full activity details with linked students and faculty
app.get('/api/activities/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const activity = db.prepare(`
      SELECT 
        a.*,
        COALESCE(a.coordinator, a.faculty_coordinator) as coordinator,
        COALESCE(a.venue, 'Campus Main Auditorium') as venue,
        COALESCE(a.organizer, a.department || ' Association') as organizer,
        d.code as department_code,
        u.name as reviewer_name,
        sub.name as submitter_name
      FROM activities a
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN users u ON a.reviewed_by = u.id
      LEFT JOIN users sub ON a.submitted_by = sub.id
      WHERE a.id = ?
    `).get(id);

    if (!activity) {
      return res.status(404).json({ error: 'Department activity record not found' });
    }

    // Role and department boundaries
    if (user.role === 'hod' && !checkDepartmentAccess(user, activity.department)) {
      return res.status(403).json({ error: `Cannot access activities for ${activity.department}` });
    }
    if (user.role === 'faculty') {
      if (!checkDepartmentAccess(user, activity.department)) {
        return res.status(403).json({ error: `Cannot access activities for ${activity.department}` });
      }
      if (activity.status !== 'Approved' && activity.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only view approved activities or their own submissions' });
      }
    }

    // Fetch linked students
    const students = db.prepare(`
      SELECT s.id, s.name, s.register_no, s.department, s.academic_year as academic_batch, s.status
      FROM activity_students ast
      JOIN students s ON ast.student_id = s.id
      WHERE ast.activity_id = ?
      ORDER BY s.name ASC
    `).all(id);

    // Fetch linked faculty
    const faculty = db.prepare(`
      SELECT f.id, f.faculty_name, f.faculty_id, f.designation, f.department
      FROM activity_faculty af
      JOIN faculty f ON af.faculty_id = f.id
      WHERE af.activity_id = ?
      ORDER BY f.faculty_name ASC
    `).all(id);

    res.json({
      ...activity,
      students,
      faculty,
      students_count: students.length,
      faculty_count: faculty.length
    });
  } catch (err) {
    console.error('Error fetching activity details:', err);
    res.status(500).json({ error: 'Failed to fetch activity details' });
  }
});

// POST /api/activities - Create an activity with student/faculty links & departmental security
app.post('/api/activities', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      activity_name,
      title,
      department,
      academic_year,
      activity_type,
      category,
      date,
      participants_count,
      faculty_coordinator,
      coordinator,
      coordinator_faculty_id,
      venue,
      organizer,
      description,
      document_path,
      student_ids,
      faculty_ids,
      is_draft,
      status
    } = req.body;

    // Enforce authorized department: do NOT trust user input for non-admin
    let targetDept = (user.role === 'faculty' || user.role === 'hod') ? user.department : (department || 'Computer Science and Engineering');
    targetDept = targetDept.trim();

    if (user.role === 'admin' && department) {
      targetDept = department.trim();
    }

    const cleanTitle = (activity_name || title || '').trim();
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Activity Title / Name is required' });
    }

    const cleanType = (activity_type || category || 'Workshop').trim();
    const cleanDate = (date || '').trim();
    if (!cleanDate) {
      return res.status(400).json({ error: 'Activity Date is required' });
    }

    const cleanYear = (academic_year || '2025-26').trim();
    const cleanCoordinator = (coordinator || faculty_coordinator || user.name).trim();

    // Resolve department_id
    let resolvedDeptId = null;
    const d = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(targetDept, targetDept);
    if (d) resolvedDeptId = d.id;

    // Validate student_ids if provided
    let uniqueStudentIds = [];
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const parsedStudentIds = student_ids.map(Number);
      if (new Set(parsedStudentIds).size !== parsedStudentIds.length) {
        return res.status(400).json({ error: 'Duplicate student selection is not allowed. Each student can only be added once.' });
      }
      uniqueStudentIds = parsedStudentIds;
      for (const sId of uniqueStudentIds) {
        const student = db.prepare('SELECT id, name, department, status FROM students WHERE id = ?').get(sId);
        if (!student) {
          return res.status(400).json({ error: `Selected student (ID: ${sId}) does not exist in student registry.` });
        }
        if (student.status !== 'Active') {
          return res.status(400).json({ error: `Selected student '${student.name}' is inactive.` });
        }
        if (student.department.toLowerCase() !== targetDept.toLowerCase()) {
          return res.status(400).json({ error: `Selected student '${student.name}' belongs to ${student.department}, not ${targetDept}.` });
        }
      }
    }

    // Validate faculty_ids if provided
    let uniqueFacultyIds = [];
    if (Array.isArray(faculty_ids) && faculty_ids.length > 0) {
      const parsedFacultyIds = faculty_ids.map(Number);
      if (new Set(parsedFacultyIds).size !== parsedFacultyIds.length) {
        return res.status(400).json({ error: 'Duplicate faculty selection is not allowed.' });
      }
      uniqueFacultyIds = parsedFacultyIds;
      for (const fId of uniqueFacultyIds) {
        const fac = db.prepare('SELECT id, faculty_name, department FROM faculty WHERE id = ?').get(fId);
        if (!fac) {
          return res.status(400).json({ error: `Selected faculty member (ID: ${fId}) does not exist.` });
        }
        if (fac.department.toLowerCase() !== targetDept.toLowerCase()) {
          return res.status(400).json({ error: `Selected faculty '${fac.faculty_name}' belongs to ${fac.department}, not ${targetDept}.` });
        }
      }
    }

    // Determine initial approval status
    let initialStatus = 'Pending Approval';
    if (is_draft === true || status === 'Draft') {
      initialStatus = 'Draft';
    } else if (user.role === 'admin' || user.role === 'hod') {
      initialStatus = 'Approved';
    }

    const calcParticipants = participants_count !== undefined && participants_count !== ''
      ? (parseInt(participants_count, 10) || 0)
      : uniqueStudentIds.length;

    const result = withTransaction(() => {
      const insStmt = db.prepare(`
        INSERT INTO activities (
          activity_name,
          department_id,
          department,
          academic_year,
          activity_type,
          date,
          participants_count,
          faculty_coordinator,
          coordinator,
          coordinator_faculty_id,
          venue,
          organizer,
          description,
          document_path,
          status,
          submitted_by,
          submitted_by_name,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const resInsert = insStmt.run(
        cleanTitle,
        resolvedDeptId,
        targetDept,
        cleanYear,
        cleanType,
        cleanDate,
        calcParticipants,
        cleanCoordinator,
        cleanCoordinator,
        coordinator_faculty_id ? parseInt(coordinator_faculty_id, 10) : null,
        venue ? venue.trim() : 'Campus Main Auditorium',
        organizer ? organizer.trim() : `${targetDept} Association`,
        description ? description.trim() : '',
        document_path ? document_path.trim() : null,
        initialStatus,
        user.id,
        user.name
      );

      const activityId = resInsert.lastInsertRowid;

      // Link participating students
      const insStudentStmt = db.prepare(`
        INSERT OR IGNORE INTO activity_students (activity_id, student_id) VALUES (?, ?)
      `);
      for (const sId of uniqueStudentIds) {
        insStudentStmt.run(activityId, sId);
      }

      // Link participating faculty
      const insFacultyStmt = db.prepare(`
        INSERT OR IGNORE INTO activity_faculty (activity_id, faculty_id) VALUES (?, ?)
      `);
      for (const fId of uniqueFacultyIds) {
        insFacultyStmt.run(activityId, fId);
      }

      return activityId;
    });

    res.status(201).json({
      message: initialStatus === 'Approved'
        ? 'Department activity recorded successfully (Directly Approved)'
        : initialStatus === 'Draft'
        ? 'Department activity saved as draft'
        : 'Department activity submitted for HOD verification and approval',
      id: result,
      status: initialStatus
    });
  } catch (err) {
    console.error('Error creating activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/activities/:id - Update an activity with student/faculty relationships
app.put('/api/activities/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Activity record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `Cannot modify activities of department ${existing.department}` });
    }

    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only modify their own submissions.' });
      }
      if (existing.status === 'Approved') {
        return res.status(403).json({ error: 'Approved activities cannot be modified by faculty. Contact HOD or Administrator.' });
      }
    }

    const {
      activity_name,
      title,
      department,
      academic_year,
      activity_type,
      category,
      date,
      participants_count,
      faculty_coordinator,
      coordinator,
      coordinator_faculty_id,
      venue,
      organizer,
      description,
      document_path,
      student_ids,
      faculty_ids,
      status
    } = req.body;

    const targetDept = existing.department;

    // Validate student_ids if provided
    let uniqueStudentIds = null;
    if (Array.isArray(student_ids)) {
      const parsedStudentIds = student_ids.map(Number);
      if (new Set(parsedStudentIds).size !== parsedStudentIds.length) {
        return res.status(400).json({ error: 'Duplicate student selection is not allowed. Each student can only be added once.' });
      }
      uniqueStudentIds = parsedStudentIds;
      for (const sId of uniqueStudentIds) {
        const student = db.prepare('SELECT id, name, department, status FROM students WHERE id = ?').get(sId);
        if (!student) {
          return res.status(400).json({ error: `Selected student (ID: ${sId}) not found.` });
        }
        if (student.status !== 'Active') {
          return res.status(400).json({ error: `Selected student '${student.name}' is inactive.` });
        }
        if (student.department.toLowerCase() !== targetDept.toLowerCase()) {
          return res.status(400).json({ error: `Student '${student.name}' belongs to ${student.department}, not ${targetDept}.` });
        }
      }
    }

    // Validate faculty_ids if provided
    let uniqueFacultyIds = null;
    if (Array.isArray(faculty_ids)) {
      const parsedFacultyIds = faculty_ids.map(Number);
      if (new Set(parsedFacultyIds).size !== parsedFacultyIds.length) {
        return res.status(400).json({ error: 'Duplicate faculty selection is not allowed.' });
      }
      uniqueFacultyIds = parsedFacultyIds;
      for (const fId of uniqueFacultyIds) {
        const fac = db.prepare('SELECT id, faculty_name, department FROM faculty WHERE id = ?').get(fId);
        if (!fac) {
          return res.status(400).json({ error: `Selected faculty member (ID: ${fId}) not found.` });
        }
        if (fac.department.toLowerCase() !== targetDept.toLowerCase()) {
          return res.status(400).json({ error: `Faculty '${fac.faculty_name}' belongs to ${fac.department}, not ${targetDept}.` });
        }
      }
    }

    // Status transition
    let newStatus = existing.status;
    if (user.role === 'faculty') {
      if (existing.status === 'Changes Requested' || existing.status === 'Draft') {
        newStatus = (status === 'Draft') ? 'Draft' : 'Pending Approval';
      }
    } else if (user.role === 'admin' || user.role === 'hod') {
      if (status) newStatus = status;
    }

    const cleanTitle = (activity_name || title || existing.activity_name).trim();
    const cleanType = (activity_type || category || existing.activity_type).trim();
    const cleanCoordinator = (coordinator || faculty_coordinator || existing.coordinator || existing.faculty_coordinator).trim();

    withTransaction(() => {
      const updateStmt = db.prepare(`
        UPDATE activities SET
          activity_name = ?,
          department = ?,
          academic_year = ?,
          activity_type = ?,
          date = ?,
          participants_count = ?,
          faculty_coordinator = ?,
          coordinator = ?,
          coordinator_faculty_id = ?,
          venue = ?,
          organizer = ?,
          description = ?,
          document_path = ?,
          status = ?,
          review_comments = CASE WHEN ? = 'Pending Approval' THEN NULL ELSE review_comments END,
          updated_at = datetime('now')
        WHERE id = ?
      `);

      updateStmt.run(
        cleanTitle,
        department || existing.department,
        academic_year || existing.academic_year,
        cleanType,
        date || existing.date,
        participants_count !== undefined ? (parseInt(participants_count, 10) || 0) : existing.participants_count,
        cleanCoordinator,
        cleanCoordinator,
        coordinator_faculty_id !== undefined ? (coordinator_faculty_id ? parseInt(coordinator_faculty_id, 10) : null) : existing.coordinator_faculty_id,
        venue !== undefined ? venue : existing.venue,
        organizer !== undefined ? organizer : existing.organizer,
        description !== undefined ? description : existing.description,
        document_path !== undefined ? document_path : existing.document_path,
        newStatus,
        newStatus,
        id
      );

      if (uniqueStudentIds !== null) {
        db.prepare('DELETE FROM activity_students WHERE activity_id = ?').run(id);
        const insStudentStmt = db.prepare('INSERT OR IGNORE INTO activity_students (activity_id, student_id) VALUES (?, ?)');
        for (const sId of uniqueStudentIds) {
          insStudentStmt.run(id, sId);
        }
      }

      if (uniqueFacultyIds !== null) {
        db.prepare('DELETE FROM activity_faculty WHERE activity_id = ?').run(id);
        const insFacultyStmt = db.prepare('INSERT OR IGNORE INTO activity_faculty (activity_id, faculty_id) VALUES (?, ?)');
        for (const fId of uniqueFacultyIds) {
          insFacultyStmt.run(id, fId);
        }
      }
    });

    res.json({
      message: newStatus === 'Pending Approval' && existing.status === 'Changes Requested'
        ? 'Activity revisions resubmitted for HOD approval'
        : 'Department activity updated successfully',
      status: newStatus
    });
  } catch (err) {
    console.error('Error updating activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/activities/:id - Delete an activity safely
app.delete('/api/activities/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Activity record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `Cannot delete activities of department ${existing.department}` });
    }

    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only delete their own submissions.' });
      }
      if (existing.status === 'Approved') {
        return res.status(403).json({ error: 'Approved activities cannot be deleted by faculty.' });
      }
    }

    withTransaction(() => {
      db.prepare('DELETE FROM activity_students WHERE activity_id = ?').run(id);
      db.prepare('DELETE FROM activity_faculty WHERE activity_id = ?').run(id);
      db.prepare('DELETE FROM activities WHERE id = ?').run(id);
    });

    res.json({ message: 'Department activity deleted successfully' });
  } catch (err) {
    console.error('Error deleting activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activities/:id/approve - Approve activity submission (Admin / HOD only)
app.post('/api/activities/:id/approve', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Activity record not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot approve records for ${existing.department}` });
    }

    if (existing.submitted_by === user.id) {
      return res.status(403).json({ error: 'Security policy: You cannot approve your own submission.' });
    }

    db.prepare(`
      UPDATE activities SET
        status = 'Approved',
        reviewed_by = ?,
        review_comments = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id, req.body.comments ? req.body.comments.trim() : `Approved by ${user.name}`, id);

    res.json({
      success: true,
      message: 'Department activity approved successfully',
      status: 'Approved'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activities/:id/request-changes - Request revisions with feedback (Admin / HOD only)
app.post('/api/activities/:id/request-changes', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { comments } = req.body;

    if (!comments || !comments.trim()) {
      return res.status(400).json({ error: 'Feedback comments explaining the required changes are required.' });
    }

    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Activity record not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot review records for ${existing.department}` });
    }

    db.prepare(`
      UPDATE activities SET
        status = 'Changes Requested',
        reviewed_by = ?,
        review_comments = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id, comments.trim(), id);

    res.json({
      success: true,
      message: 'Revisions requested from faculty',
      status: 'Changes Requested'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activities/:id/submit - Submit a draft activity for HOD review
app.post('/api/activities/:id/submit', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Activity record not found' });
    }

    if (user.role === 'faculty' && existing.submitted_by !== user.id) {
      return res.status(403).json({ error: 'Faculty can only submit their own records.' });
    }

    db.prepare(`
      UPDATE activities SET
        status = 'Pending Approval',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: 'Activity submitted for HOD approval',
      status: 'Pending Approval'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activities/upload-document - Secure activity document/image upload
app.post('/api/activities/upload-document', requireAuth, (req, res) => {
  try {
    const { file_name, file_data } = req.body;
    if (!file_data || !file_name) {
      return res.status(400).json({ error: 'File data and file name are required' });
    }

    const safeBaseName = path.basename(file_name);
    const ext = path.extname(safeBaseName).toLowerCase();
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];

    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Permitted document types are PDF, PNG, and JPG only.' });
    }

    const base64Data = file_data.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds maximum permitted size of 5MB.' });
    }

    const sanitizedUniqueName = `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const destination = path.join(activityUploadsDir, sanitizedUniqueName);

    fs.writeFileSync(destination, buffer);

    const relativeUrl = `/api/activities/documents/${sanitizedUniqueName}`;
    res.json({
      success: true,
      message: 'Activity document uploaded successfully',
      document_path: relativeUrl,
      file_name: safeBaseName
    });
  } catch (err) {
    console.error('Activity document upload error:', err);
    res.status(500).json({ error: 'Failed to upload activity document.' });
  }
});

// GET /api/activities/documents/:filename - Secure document download
app.get('/api/activities/documents/:filename', requireAuth, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(activityUploadsDir, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Activity document not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Error downloading activity document' });
  }
});

// ----------------------------------------------------
// 7B. EVENTS MANAGEMENT (Module 7: Full CRUD, Junctions & HOD Approval)
// ----------------------------------------------------

const eventsUploadDir = path.join(__dirname, 'uploads', 'events');
if (!fs.existsSync(eventsUploadDir)) {
  fs.mkdirSync(eventsUploadDir, { recursive: true });
}

// GET /api/events - List events scoped by role, department, category, status, year, search
app.get('/api/events', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { academic_year, department, status, category, search, start_date, end_date } = req.query;

    let query = `
      SELECT 
        e.*,
        d.name as department_name,
        d.code as department_code,
        (SELECT COUNT(*) FROM event_students es WHERE es.event_id = e.id) as student_count,
        (SELECT COUNT(*) FROM event_faculty ef WHERE ef.event_id = e.id) as faculty_count
      FROM events e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based visibility
    if (user.role === 'admin') {
      if (department && department !== 'All') {
        query += ' AND (e.department = ? OR d.name = ? OR d.code = ?)';
        params.push(department, department, department);
      }
    } else if (user.role === 'hod') {
      // HOD strictly locked to own department
      query += ' AND (LOWER(e.department) = LOWER(?) OR d.name = ? OR d.code = ?)';
      params.push(user.department, user.department, user.department);
    } else if (user.role === 'faculty') {
      // Faculty locked to own department; sees approved events OR their own submissions
      query += ` AND (LOWER(e.department) = LOWER(?) OR d.name = ? OR d.code = ?)
                 AND (e.status = 'Approved' OR e.submitted_by = ?)`;
      params.push(user.department, user.department, user.department, user.id);
    }

    if (academic_year && academic_year !== 'All') {
      query += ' AND e.academic_year = ?';
      params.push(academic_year);
    }

    if (status && status !== 'All') {
      query += ' AND e.status = ?';
      params.push(status);
    }

    if (category && category !== 'All') {
      query += ' AND e.event_type = ?';
      params.push(category);
    }

    if (start_date) {
      query += ' AND e.event_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND e.event_date <= ?';
      params.push(end_date);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (
        LOWER(e.event_name) LIKE ? OR 
        LOWER(COALESCE(e.coordinator, '')) LIKE ? OR 
        LOWER(COALESCE(e.venue, '')) LIKE ? OR 
        LOWER(COALESCE(e.organizer, '')) LIKE ? OR
        LOWER(COALESCE(e.external_guests, '')) LIKE ? OR
        LOWER(COALESCE(e.description, '')) LIKE ?
      )`;
      params.push(term, term, term, term, term, term);
    }

    query += ' ORDER BY e.event_date DESC, e.id DESC';

    const events = db.prepare(query).all(...params);
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
});

// GET /api/events/:id - Get full event details with linked students and faculty
app.get('/api/events/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const event = db.prepare(`
      SELECT e.*, d.name as department_name, d.code as department_code
      FROM events e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `).get(id);

    if (!event) {
      return res.status(404).json({ error: 'Event record not found' });
    }

    // Role boundary checking
    if (user.role === 'hod' && !checkDepartmentAccess(user, event.department)) {
      return res.status(403).json({ error: `Access denied. HOD of ${user.department} cannot view events of ${event.department}.` });
    }
    if (user.role === 'faculty') {
      if (!checkDepartmentAccess(user, event.department)) {
        return res.status(403).json({ error: `Access denied. You can only view events in ${user.department}.` });
      }
      if (event.status !== 'Approved' && event.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Access denied to unapproved event submitted by another faculty member.' });
      }
    }

    // Fetch linked students
    const students = db.prepare(`
      SELECT s.id, s.name, s.register_no, s.department, s.current_year, s.section, s.email
      FROM event_students es
      JOIN students s ON es.student_id = s.id
      WHERE es.event_id = ?
      ORDER BY s.name ASC
    `).all(id);

    // Fetch linked faculty
    const faculty = db.prepare(`
      SELECT f.id, f.faculty_name, f.designation, f.department, f.specialization
      FROM event_faculty ef
      JOIN faculty f ON ef.faculty_id = f.id
      WHERE ef.event_id = ?
      ORDER BY f.faculty_name ASC
    `).all(id);

    res.json({
      ...event,
      students,
      faculty,
      students_count: students.length,
      faculty_count: faculty.length
    });
  } catch (err) {
    console.error('Error fetching event details:', err);
    res.status(500).json({ error: 'Failed to fetch event details' });
  }
});

// POST /api/events - Create an event with student/faculty links & departmental security
app.post('/api/events', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      event_name,
      title,
      department,
      academic_year,
      event_type,
      category,
      event_date,
      date,
      start_time,
      end_time,
      venue,
      organizer,
      coordinator,
      faculty_coordinator,
      coordinator_faculty_id,
      event_status,
      participants_count,
      external_guests,
      description,
      document_path,
      student_ids,
      faculty_ids,
      is_draft,
      status
    } = req.body;

    // Enforce authorized department: do NOT trust user input for non-admin
    let targetDept = (user.role === 'faculty' || user.role === 'hod') ? user.department : (department || 'Computer Science and Engineering');
    targetDept = targetDept.trim();

    if (user.role === 'admin' && department) {
      targetDept = department.trim();
    }

    const cleanTitle = (event_name || title || '').trim();
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Event Title / Name is required' });
    }

    const cleanType = (event_type || category || 'Workshop').trim();
    const cleanDate = (event_date || date || '').trim();
    if (!cleanDate) {
      return res.status(400).json({ error: 'Event Date is required' });
    }

    const cleanYear = (academic_year || '2025-26').trim();

    // Verify department exists in database
    const deptRecord = db.prepare(`
      SELECT id, name FROM departments 
      WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)
    `).get(targetDept, targetDept);

    const departmentId = deptRecord ? deptRecord.id : null;
    const resolvedDeptName = deptRecord ? deptRecord.name : targetDept;

    // Coordinator resolution
    let resolvedCoordinator = (coordinator || faculty_coordinator || '').trim();
    let resolvedCoordinatorFacultyId = coordinator_faculty_id ? parseInt(coordinator_faculty_id, 10) : null;

    if (resolvedCoordinatorFacultyId) {
      const fac = db.prepare('SELECT id, faculty_name, department FROM faculty WHERE id = ?').get(resolvedCoordinatorFacultyId);
      if (fac) {
        if (fac.department.toLowerCase() !== resolvedDeptName.toLowerCase()) {
          return res.status(400).json({ error: `Coordinator faculty belongs to ${fac.department}, not ${resolvedDeptName}.` });
        }
        resolvedCoordinator = fac.faculty_name;
      } else {
        resolvedCoordinatorFacultyId = null;
      }
    }

    // Validate student_ids or students if provided
    const rawStudentIds = student_ids || req.body.students || [];
    let uniqueStudentIds = [];
    if (Array.isArray(rawStudentIds) && rawStudentIds.length > 0) {
      // Auto-deduplicate while preserving valid IDs
      const parsedStudentIds = [...new Set(rawStudentIds.map(Number))];
      uniqueStudentIds = parsedStudentIds;
      for (const sId of uniqueStudentIds) {
        const student = db.prepare('SELECT id, name, department, status FROM students WHERE id = ?').get(sId);
        if (!student) {
          return res.status(400).json({ error: `Selected student (ID: ${sId}) does not exist in student registry.` });
        }
        if (student.status !== 'Active') {
          return res.status(400).json({ error: `Selected student '${student.name}' is inactive.` });
        }
        if (student.department.toLowerCase() !== resolvedDeptName.toLowerCase()) {
          return res.status(400).json({ error: `Selected student '${student.name}' belongs to ${student.department}, not ${resolvedDeptName}.` });
        }
      }
    }

    // Validate faculty_ids or faculty if provided
    const rawFacultyIds = faculty_ids || req.body.faculty || [];
    let uniqueFacultyIds = [];
    if (Array.isArray(rawFacultyIds) && rawFacultyIds.length > 0) {
      const parsedFacultyIds = [...new Set(rawFacultyIds.map(Number))];
      uniqueFacultyIds = parsedFacultyIds;
      for (const fId of uniqueFacultyIds) {
        const fac = db.prepare('SELECT id, faculty_name, department FROM faculty WHERE id = ?').get(fId);
        if (!fac) {
          return res.status(400).json({ error: `Selected faculty member (ID: ${fId}) does not exist.` });
        }
        if (fac.department.toLowerCase() !== resolvedDeptName.toLowerCase()) {
          return res.status(400).json({ error: `Selected faculty '${fac.faculty_name}' belongs to ${fac.department}, not ${resolvedDeptName}.` });
        }
      }
    }

    // Determine initial approval status
    let initialStatus = 'Pending Approval';
    if (is_draft === true || status === 'Draft') {
      initialStatus = 'Draft';
    } else if (user.role === 'admin' || user.role === 'hod') {
      initialStatus = 'Approved';
    }

    const calcParticipants = participants_count !== undefined && participants_count !== ''
      ? (parseInt(participants_count, 10) || 0)
      : uniqueStudentIds.length;

    const result = withTransaction(() => {
      const insStmt = db.prepare(`
        INSERT INTO events (
          event_name,
          event_type,
          description,
          department_id,
          department,
          event_date,
          start_time,
          end_time,
          venue,
          organizer,
          coordinator,
          coordinator_faculty_id,
          academic_year,
          event_status,
          participants_count,
          external_guests,
          document_path,
          status,
          submitted_by,
          submitted_by_name,
          submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const resInsert = insStmt.run(
        cleanTitle,
        cleanType,
        description ? description.trim() : '',
        departmentId,
        resolvedDeptName,
        cleanDate,
        start_time ? start_time.trim() : null,
        end_time ? end_time.trim() : null,
        venue ? venue.trim() : '',
        organizer ? organizer.trim() : '',
        resolvedCoordinator || user.name,
        resolvedCoordinatorFacultyId,
        cleanYear,
        event_status || 'Scheduled',
        calcParticipants,
        external_guests ? external_guests.trim() : '',
        document_path ? document_path.trim() : '',
        initialStatus,
        user.id,
        user.name
      );

      const newEventId = resInsert.lastInsertRowid;

      // Insert linked students
      if (uniqueStudentIds.length > 0) {
        const insStudent = db.prepare('INSERT OR IGNORE INTO event_students (event_id, student_id) VALUES (?, ?)');
        for (const sId of uniqueStudentIds) {
          insStudent.run(newEventId, sId);
        }
      }

      // Insert linked faculty
      if (uniqueFacultyIds.length > 0) {
        const insFac = db.prepare('INSERT OR IGNORE INTO event_faculty (event_id, faculty_id) VALUES (?, ?)');
        for (const fId of uniqueFacultyIds) {
          insFac.run(newEventId, fId);
        }
      }

      return newEventId;
    });

    const createdEventRecord = db.prepare('SELECT * FROM events WHERE id = ?').get(result);

    res.status(201).json({
      success: true,
      message: initialStatus === 'Approved'
        ? 'Event recorded and approved successfully'
        : initialStatus === 'Draft'
        ? 'Event saved as draft'
        : 'Event submitted for HOD approval',
      id: result,
      event: createdEventRecord,
      status: initialStatus
    });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: err.message || 'Failed to create event' });
  }
});

// PUT /api/events/:id - Edit an event record
app.put('/api/events/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Role check: Admin can edit any; HOD only own department
    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: 'HOD cannot modify events from another department' });
    }

    // Faculty check: Faculty can only edit their own records
    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only edit their own event records' });
      }
      if (existing.status === 'Approved') {
        return res.status(403).json({ error: 'Cannot directly edit an approved event. Please contact your HOD for revisions.' });
      }
    }

    const {
      event_name,
      title,
      event_type,
      category,
      event_date,
      date,
      start_time,
      end_time,
      venue,
      organizer,
      coordinator,
      faculty_coordinator,
      coordinator_faculty_id,
      academic_year,
      event_status,
      participants_count,
      external_guests,
      description,
      document_path,
      student_ids,
      faculty_ids,
      status
    } = req.body;

    const targetDept = existing.department;

    // Validate student_ids or students if provided
    const rawStudentIds = student_ids !== undefined ? student_ids : req.body.students;
    let uniqueStudentIds = null;
    if (Array.isArray(rawStudentIds)) {
      const parsedStudentIds = [...new Set(rawStudentIds.map(Number))];
      uniqueStudentIds = parsedStudentIds;
      for (const sId of uniqueStudentIds) {
        const student = db.prepare('SELECT id, name, department, status FROM students WHERE id = ?').get(sId);
        if (!student) {
          return res.status(400).json({ error: `Selected student (ID: ${sId}) not found.` });
        }
        if (student.status !== 'Active') {
          return res.status(400).json({ error: `Selected student '${student.name}' is inactive.` });
        }
        if (student.department.toLowerCase() !== targetDept.toLowerCase()) {
          return res.status(400).json({ error: `Student '${student.name}' belongs to ${student.department}, not ${targetDept}.` });
        }
      }
    }

    // Validate faculty_ids or faculty if provided
    const rawFacultyIds = faculty_ids !== undefined ? faculty_ids : req.body.faculty;
    let uniqueFacultyIds = null;
    if (Array.isArray(rawFacultyIds)) {
      const parsedFacultyIds = [...new Set(rawFacultyIds.map(Number))];
      uniqueFacultyIds = parsedFacultyIds;
      for (const fId of uniqueFacultyIds) {
        const fac = db.prepare('SELECT id, faculty_name, department FROM faculty WHERE id = ?').get(fId);
        if (!fac) {
          return res.status(400).json({ error: `Selected faculty member (ID: ${fId}) not found.` });
        }
        if (fac.department.toLowerCase() !== targetDept.toLowerCase()) {
          return res.status(400).json({ error: `Faculty '${fac.faculty_name}' belongs to ${fac.department}, not ${targetDept}.` });
        }
      }
    }

    // If Faculty edits after Changes Requested, reset to Pending Approval
    let newStatus = existing.status;
    if (user.role === 'faculty') {
      if (existing.status === 'Changes Requested') {
        newStatus = 'Pending Approval';
      } else if (status === 'Pending Approval') {
        newStatus = 'Pending Approval';
      }
    } else if (status && (user.role === 'admin' || user.role === 'hod')) {
      newStatus = status;
    }

    const updatedTitle = (event_name || title || existing.event_name).trim();
    const updatedType = (event_type || category || existing.event_type).trim();
    const updatedDate = (event_date || date || existing.event_date).trim();
    const updatedYear = (academic_year || existing.academic_year).trim();
    const updatedVenue = venue !== undefined ? venue.trim() : existing.venue;
    const updatedOrganizer = organizer !== undefined ? organizer.trim() : existing.organizer;
    const updatedCoordinator = coordinator || faculty_coordinator || existing.coordinator;
    const updatedCoordFacId = coordinator_faculty_id !== undefined ? (coordinator_faculty_id ? parseInt(coordinator_faculty_id, 10) : null) : existing.coordinator_faculty_id;
    const updatedStartTime = start_time !== undefined ? start_time : existing.start_time;
    const updatedEndTime = end_time !== undefined ? end_time : existing.end_time;
    const updatedEventStatus = event_status !== undefined ? event_status : existing.event_status;
    const updatedGuests = external_guests !== undefined ? external_guests.trim() : existing.external_guests;
    const updatedDesc = description !== undefined ? description.trim() : existing.description;
    const updatedDoc = document_path !== undefined ? document_path : existing.document_path;
    const updatedParticipants = participants_count !== undefined
      ? parseInt(participants_count, 10) || 0
      : (uniqueStudentIds !== null ? uniqueStudentIds.length : existing.participants_count);

    withTransaction(() => {
      db.prepare(`
        UPDATE events SET
          event_name = ?,
          event_type = ?,
          description = ?,
          event_date = ?,
          start_time = ?,
          end_time = ?,
          venue = ?,
          organizer = ?,
          coordinator = ?,
          coordinator_faculty_id = ?,
          academic_year = ?,
          event_status = ?,
          participants_count = ?,
          external_guests = ?,
          document_path = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        updatedTitle,
        updatedType,
        updatedDesc,
        updatedDate,
        updatedStartTime,
        updatedEndTime,
        updatedVenue,
        updatedOrganizer,
        updatedCoordinator,
        updatedCoordFacId,
        updatedYear,
        updatedEventStatus,
        updatedParticipants,
        updatedGuests,
        updatedDoc,
        newStatus,
        id
      );

      // Sync students if provided
      if (uniqueStudentIds !== null) {
        db.prepare('DELETE FROM event_students WHERE event_id = ?').run(id);
        const insStudent = db.prepare('INSERT OR IGNORE INTO event_students (event_id, student_id) VALUES (?, ?)');
        for (const sId of uniqueStudentIds) {
          insStudent.run(id, sId);
        }
      }

      // Sync faculty if provided
      if (uniqueFacultyIds !== null) {
        db.prepare('DELETE FROM event_faculty WHERE event_id = ?').run(id);
        const insFac = db.prepare('INSERT OR IGNORE INTO event_faculty (event_id, faculty_id) VALUES (?, ?)');
        for (const fId of uniqueFacultyIds) {
          insFac.run(id, fId);
        }
      }
    });

    const updatedRecord = db.prepare('SELECT * FROM events WHERE id = ?').get(id);

    res.json({
      success: true,
      message: newStatus === 'Pending Approval' && existing.status === 'Changes Requested'
        ? 'Event resubmitted for HOD approval'
        : 'Event updated successfully',
      event: updatedRecord,
      status: newStatus
    });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: err.message || 'Failed to update event' });
  }
});

// DELETE /api/events/:id - Delete/Archive event
app.delete('/api/events/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: 'HOD cannot delete events from another department' });
    }

    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only delete their own records' });
      }
      if (existing.status !== 'Draft') {
        return res.status(403).json({ error: 'Faculty can only delete draft records' });
      }
    }

    withTransaction(() => {
      db.prepare('DELETE FROM event_students WHERE event_id = ?').run(id);
      db.prepare('DELETE FROM event_faculty WHERE event_id = ?').run(id);
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
    });

    res.json({ success: true, message: 'Event successfully removed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete event' });
  }
});

// POST /api/events/:id/approve - HOD/Admin Approve Event
app.post('/api/events/:id/approve', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { comments } = req.body;

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot approve events for ${existing.department}` });
    }

    // Security Rule: Anti-self-approval protection!
    if (existing.submitted_by === user.id) {
      return res.status(403).json({ error: 'Security policy: You cannot approve an event submitted by yourself.' });
    }

    db.prepare(`
      UPDATE events SET
        status = 'Approved',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = datetime('now'),
        review_comments = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id, user.name, comments ? comments.trim() : null, id);

    res.json({
      success: true,
      message: 'Event approved successfully for annual report inclusion',
      status: 'Approved'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/request-changes - HOD/Admin Request Changes
app.post('/api/events/:id/request-changes', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { comments } = req.body;

    if (!comments || !comments.trim()) {
      return res.status(400).json({ error: 'Feedback comments are required when requesting changes' });
    }

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot review events for ${existing.department}` });
    }

    db.prepare(`
      UPDATE events SET
        status = 'Changes Requested',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = datetime('now'),
        review_comments = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id, user.name, comments.trim(), id);

    res.json({
      success: true,
      message: 'Correction requested. Event sent back to faculty with feedback.',
      status: 'Changes Requested'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/submit - Faculty submit draft for HOD approval
app.post('/api/events/:id/submit', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (user.role === 'faculty' && existing.submitted_by !== user.id) {
      return res.status(403).json({ error: 'Faculty can only submit their own records.' });
    }

    db.prepare(`
      UPDATE events SET
        status = 'Pending Approval',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: 'Event submitted for HOD approval',
      status: 'Pending Approval'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/upload-document - Secure event document/image upload
app.post('/api/events/upload-document', requireAuth, (req, res) => {
  try {
    const { file_name, file_data, fileName, base64Data: altBase64 } = req.body;
    const rawData = file_data || altBase64;
    const rawName = file_name || fileName;

    if (!rawData || !rawName) {
      return res.status(400).json({ error: 'File data and file name are required' });
    }

    const safeBaseName = path.basename(rawName);
    const ext = path.extname(safeBaseName).toLowerCase();
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];

    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Permitted document types are PDF, PNG, and JPG only.' });
    }

    const base64Clean = rawData.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum 10MB limit' });
    }

    const uniqueName = `event_doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const targetPath = path.join(eventsUploadDir, uniqueName);

    fs.writeFileSync(targetPath, buffer);

    res.json({
      success: true,
      fileName: uniqueName,
      filePath: uniqueName,
      url: `/api/events/documents/${uniqueName}`
    });
  } catch (err) {
    console.error('Event document upload error:', err);
    res.status(500).json({ error: 'Failed to upload event document' });
  }
});

// GET /api/events/documents/:filename - Stream event document
app.get('/api/events/documents/:filename', requireAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(eventsUploadDir, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Event document not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Error downloading event document' });
  }
});

// ----------------------------------------------------
// 8. PLACEMENT MANAGEMENT: INDIVIDUAL RECORDS & DYNAMIC STATS (Module 8)
// ----------------------------------------------------

/**
 * Helper to calculate live placement metrics from individual student records
 * @param {string} department
 * @param {string} academicYear
 * @param {Object} [options]
 * @param {string} [options.batch]
 * @param {string} [options.status]
 * @param {string} [options.placement_status]
 */
function calculatePlacementStats(department, academicYear, options = {}) {
  const isGlobal = !department || department === 'All';
  const targetYear = academicYear && academicYear !== 'All' ? academicYear : null;
  const statusFilter = options.status || 'Approved';

  // 1. Calculate eligible students from real database student records
  let eligibleStudents = 0;
  if (!isGlobal) {
    let eligQuery = `
      SELECT COUNT(DISTINCT id) as count FROM students 
      WHERE (LOWER(department) = LOWER(?) OR department_id = (SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1))
        AND status = 'Active'
    `;
    const eligParams = [department, department, department];

    if (options.batch && options.batch !== 'All') {
      eligQuery += ' AND academic_year = ?';
      eligParams.push(options.batch);
    }

    const eligRow = db.prepare(eligQuery).get(...eligParams);
    eligibleStudents = eligRow ? eligRow.count : 0;

    // Fallback to department_reports if students count is 0
    if (eligibleStudents === 0) {
      const deptRep = db.prepare(`
        SELECT total_students FROM department_reports
        WHERE (LOWER(department_name) = LOWER(?) OR LOWER(department_code) = LOWER(?))
          AND academic_year = ?
      `).get(department, department, targetYear || '2025-26');
      if (deptRep && deptRep.total_students > 0) {
        eligibleStudents = deptRep.total_students;
      }
    }
  } else {
    // Institute-wide eligible students
    let eligQuery = "SELECT COUNT(DISTINCT id) as count FROM students WHERE status = 'Active'";
    const eligParams = [];
    if (options.batch && options.batch !== 'All') {
      eligQuery += ' AND academic_year = ?';
      eligParams.push(options.batch);
    }
    const eligRow = db.prepare(eligQuery).get(...eligParams);
    eligibleStudents = eligRow ? eligRow.count : 0;
  }

  // 2. Query individual placement records
  let recQuery = 'SELECT * FROM placement_records WHERE 1=1';
  const recParams = [];

  if (!isGlobal) {
    recQuery += ' AND (LOWER(department) = LOWER(?) OR department_id = (SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1))';
    recParams.push(department, department, department);
  }

  if (targetYear) {
    recQuery += ' AND academic_year = ?';
    recParams.push(targetYear);
  }

  if (options.batch && options.batch !== 'All') {
    recQuery += ' AND (placement_year = ? OR academic_year = ?)';
    recParams.push(options.batch, options.batch);
  }

  // Approval status filter: default to Approved records for official stats
  if (statusFilter && statusFilter !== 'All') {
    recQuery += " AND (status = ? OR (status IS NULL AND ? = 'Approved'))";
    recParams.push(statusFilter, statusFilter);
  }

  if (options.placement_status && options.placement_status !== 'All') {
    recQuery += ' AND LOWER(placement_status) = LOWER(?)';
    recParams.push(options.placement_status);
  }

  if (options.company && options.company !== 'All') {
    recQuery += ' AND LOWER(company_name) LIKE ?';
    recParams.push(`%${options.company.trim().toLowerCase()}%`);
  }

  if (options.search && options.search.trim()) {
    const sTerm = `%${options.search.trim().toLowerCase()}%`;
    recQuery += ' AND (LOWER(student_name) LIKE ? OR LOWER(register_no) LIKE ? OR LOWER(company_name) LIKE ? OR LOWER(job_role) LIKE ?)';
    recParams.push(sTerm, sTerm, sTerm, sTerm);
  }

  const records = db.prepare(recQuery).all(...recParams);

  let placedOffersCount = 0;
  let highestPackage = 0;
  let packageSum = 0;
  let validPackageCount = 0;
  const companiesSet = new Set();
  const placedStudentsSet = new Set();

  for (const r of records) {
    // Unique companies
    if (r.company_name && r.company_name.trim()) {
      companiesSet.add(r.company_name.trim().toLowerCase());
    }

    // Qualifying placed status
    const pStatus = (r.placement_status || '').trim().toLowerCase();
    const isPlaced = pStatus === 'placed' || pStatus === 'offer received';

    if (isPlaced) {
      placedOffersCount++;

      // Unique placed students (by student_id or register_no)
      const studentKey = r.student_id ? `id_${r.student_id}` : (r.register_no ? `reg_${r.register_no.trim().toLowerCase()}` : null);
      if (studentKey) {
        placedStudentsSet.add(studentKey);
      }

      // Package metrics
      const pkg = parseFloat(r.package) || 0;
      if (pkg > 0) {
        if (pkg > highestPackage) {
          highestPackage = pkg;
        }
        packageSum += pkg;
        validPackageCount++;
      }
    }
  }

  const distinctPlaced = placedStudentsSet.size;
  const distinctCompanies = companiesSet.size;
  const averagePackage = validPackageCount > 0 ? parseFloat((packageSum / validPackageCount).toFixed(2)) : 0;

  // Ensure eligibleStudents is at least as large as placed students so percentage is valid
  const effectiveEligible = Math.max(eligibleStudents, distinctPlaced);

  // Placement percentage calculated from eligible students
  let placementPercentage = 0;
  if (effectiveEligible > 0) {
    placementPercentage = parseFloat(((distinctPlaced / effectiveEligible) * 100).toFixed(2));
    if (placementPercentage > 100) placementPercentage = 100.0;
  } else if (distinctPlaced > 0) {
    placementPercentage = 100.0;
  }

  return {
    department: isGlobal ? 'All' : department,
    academic_year: targetYear || 'All',
    eligible_students: effectiveEligible,
    students_placed: distinctPlaced,
    number_of_offers: placedOffersCount,
    number_of_companies: distinctCompanies,
    highest_package: highestPackage,
    average_package: averagePackage,
    placement_percentage: placementPercentage,
    total_records: records.length
  };
}

// GET /api/placements/records - Fetch individual student placement records with search and filters
app.get('/api/placements/records', (req, res) => {
  try {
    const { department, academic_year, status, batch, placement_status, company, search } = req.query;
    const user = getCurrentUser(req);
    let query = `
      SELECT 
        pr.*,
        COALESCE(s.name, pr.student_name) as student_name,
        COALESCE(s.register_no, pr.register_no) as register_no,
        s.academic_year as batch,
        s.current_year,
        s.status as student_status,
        d.name as department_name,
        d.code as department_code,
        u.name as reviewer_name,
        sub.name as submitter_name
      FROM placement_records pr
      LEFT JOIN students s ON pr.student_id = s.id
      LEFT JOIN departments d ON pr.department_id = d.id
      LEFT JOIN users u ON pr.reviewed_by = u.id
      LEFT JOIN users sub ON pr.submitted_by = sub.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based scoping
    if (user && user.role === 'hod') {
      query += ' AND (LOWER(pr.department) = LOWER(?) OR d.name = ? OR d.code = ?)';
      params.push(user.department, user.department, user.department);
    } else if (user && user.role === 'faculty') {
      query += ` AND (LOWER(pr.department) = LOWER(?) OR d.name = ? OR d.code = ?)
                 AND (pr.status = 'Approved' OR pr.submitted_by = ?)`;
      params.push(user.department, user.department, user.department, user.id);
    } else if (department && department !== 'All') {
      query += ' AND (LOWER(pr.department) = LOWER(?) OR d.name = ? OR d.code = ?)';
      params.push(department, department, department);
    }

    if (academic_year && academic_year !== 'All') {
      query += ' AND pr.academic_year = ?';
      params.push(academic_year);
    }

    if (batch && batch !== 'All') {
      query += ' AND (s.academic_year = ? OR pr.placement_year = ?)';
      params.push(batch, batch);
    }

    if (placement_status && placement_status !== 'All') {
      query += ' AND LOWER(pr.placement_status) = LOWER(?)';
      params.push(placement_status);
    }

    if (company && company !== 'All') {
      query += ' AND LOWER(pr.company_name) LIKE ?';
      params.push(`%${company.trim().toLowerCase()}%`);
    }

    if (status && status !== 'All') {
      query += ' AND pr.status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (
        LOWER(COALESCE(s.name, pr.student_name)) LIKE ? OR
        LOWER(COALESCE(s.register_no, pr.register_no)) LIKE ? OR
        LOWER(pr.company_name) LIKE ? OR
        LOWER(COALESCE(pr.job_role, '')) LIKE ? OR
        LOWER(COALESCE(pr.location, '')) LIKE ? OR
        LOWER(COALESCE(pr.offer_details, '')) LIKE ?
      )`;
      params.push(term, term, term, term, term, term);
    }

    query += ' ORDER BY pr.id DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch placement records:', err);
    res.status(500).json({ error: 'Failed to fetch placement records' });
  }
});

// GET /api/placements/records/:id - Get full placement record details
app.get('/api/placements/records/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const record = db.prepare(`
      SELECT 
        pr.*,
        COALESCE(s.name, pr.student_name) as student_name,
        COALESCE(s.register_no, pr.register_no) as register_no,
        s.academic_year as batch,
        s.current_year,
        s.email as student_email,
        s.phone as student_phone,
        d.name as department_name,
        d.code as department_code,
        u.name as reviewer_name,
        sub.name as submitter_name
      FROM placement_records pr
      LEFT JOIN students s ON pr.student_id = s.id
      LEFT JOIN departments d ON pr.department_id = d.id
      LEFT JOIN users u ON pr.reviewed_by = u.id
      LEFT JOIN users sub ON pr.submitted_by = sub.id
      WHERE pr.id = ?
    `).get(id);

    if (!record) {
      return res.status(404).json({ error: 'Placement record not found' });
    }

    if (!checkDepartmentAccess(user, record.department)) {
      return res.status(403).json({ error: `Access denied for department ${record.department}` });
    }

    if (user.role === 'faculty' && record.status !== 'Approved' && record.submitted_by !== user.id) {
      return res.status(403).json({ error: 'Faculty can only view approved records or their own submissions' });
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve placement record' });
  }
});

// GET /api/placements/stats - Automatically calculated from database individual records
app.get('/api/placements/stats', (req, res) => {
  try {
    const { department, academic_year, batch, status, placement_status, company, search } = req.query;
    const user = getCurrentUser(req);

    let targetDept = department;
    if (user && user.role === 'hod') {
      targetDept = user.department;
    } else if (user && user.role === 'faculty') {
      targetDept = user.department;
    }

    const stats = calculatePlacementStats(targetDept, academic_year, { batch, status, placement_status, company, search });
    res.json(stats);
  } catch (err) {
    console.error('Stats calc error:', err);
    res.status(500).json({ error: 'Failed to calculate placement statistics' });
  }
});

// POST /api/placements/records - Add an individual placement record
app.post('/api/placements/records', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      student_id,
      student_name,
      register_no,
      department,
      academic_year,
      company_name,
      package: salaryPackage,
      placement_status,
      job_role,
      location,
      placement_date,
      offer_type,
      offer_details,
      is_draft,
      status
    } = req.body;

    // Enforce authorized department
    if (user.role !== 'admin' && department && !checkDepartmentAccess(user, department)) {
      return res.status(403).json({ error: `Access denied. You cannot enter placement records for department '${department}'.` });
    }

    let targetDept = (user.role === 'faculty' || user.role === 'hod') ? user.department : (department || 'Computer Science and Engineering');
    targetDept = targetDept.trim();

    if (user.role === 'admin' && department) {
      targetDept = department.trim();
    }

    // Resolve student record from database
    let targetStudentId = student_id ? parseInt(student_id, 10) : null;
    let resolvedName = student_name ? student_name.trim() : '';
    let resolvedRegNo = register_no ? register_no.trim() : '';

    if (targetStudentId) {
      const student = db.prepare('SELECT id, name, register_no, department, status FROM students WHERE id = ?').get(targetStudentId);
      if (!student) {
        return res.status(400).json({ error: 'Selected student does not exist in student registry' });
      }
      if (student.status !== 'Active') {
        return res.status(400).json({ error: `Selected student '${student.name}' is inactive. Placement records cannot be created for inactive students.` });
      }
      if (user.role !== 'admin' && !checkDepartmentAccess(user, student.department)) {
        return res.status(403).json({ error: `Access denied. Selected student belongs to ${student.department}.` });
      }
      if (student.department.toLowerCase() !== targetDept.toLowerCase()) {
        return res.status(400).json({ error: `Selected student '${student.name}' belongs to ${student.department}, not ${targetDept}.` });
      }
      resolvedName = student.name;
      resolvedRegNo = student.register_no;
    } else if (resolvedRegNo) {
      const student = db.prepare('SELECT id, name, register_no, department, status FROM students WHERE UPPER(register_no) = ?').get(resolvedRegNo.toUpperCase());
      if (student) {
        if (student.status !== 'Active') {
          return res.status(400).json({ error: `Student with register number '${resolvedRegNo}' is inactive.` });
        }
        if (student.department.toLowerCase() !== targetDept.toLowerCase()) {
          return res.status(400).json({ error: `Student '${student.name}' belongs to ${student.department}, not ${targetDept}.` });
        }
        targetStudentId = student.id;
        resolvedName = student.name;
      }
    }

    if (!targetStudentId && !resolvedName) {
      return res.status(400).json({ error: 'A valid student must be selected from the student registry.' });
    }

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ error: 'Recruiting company name is required.' });
    }

    const cleanCompany = company_name.trim();
    const cleanYear = (academic_year || '2025-26').trim();
    const cleanStatus = (placement_status || 'Placed').trim();

    // Validate package
    let rawPkg = salaryPackage;
    if (typeof rawPkg === 'string') {
      rawPkg = rawPkg.replace(/[^0-9.]/g, '');
    }
    const pkg = parseFloat(rawPkg) || 0;
    if (pkg < 0) {
      return res.status(400).json({ error: 'Salary package cannot be negative.' });
    }

    // Resolve department_id
    const deptRecord = db.prepare(`
      SELECT id, name FROM departments 
      WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)
    `).get(targetDept, targetDept);
    const departmentId = deptRecord ? deptRecord.id : null;
    const resolvedDeptName = deptRecord ? deptRecord.name : targetDept;

    // Initial approval status
    let initialStatus = 'Pending Approval';
    if (is_draft === true || status === 'Draft') {
      initialStatus = 'Draft';
    } else if (user.role === 'admin' || user.role === 'hod') {
      initialStatus = 'Approved';
    }

    const cleanRole = (job_role || offer_details || '').trim();
    const cleanOfferType = (offer_type || 'Full-Time').trim();
    const cleanLocation = location ? location.trim() : '';
    const cleanDate = placement_date ? placement_date.trim() : new Date().toISOString().split('T')[0];

    const resultId = withTransaction(() => {
      const stmt = db.prepare(`
        INSERT INTO placement_records (
          student_id,
          student_name,
          register_no,
          department_id,
          department,
          academic_year,
          company_name,
          package,
          placement_status,
          job_role,
          location,
          placement_date,
          offer_type,
          offer_details,
          status,
          submitted_by,
          submitted_by_name,
          submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const ins = stmt.run(
        targetStudentId,
        resolvedName,
        resolvedRegNo,
        departmentId,
        resolvedDeptName,
        cleanYear,
        cleanCompany,
        pkg,
        cleanStatus,
        cleanRole,
        cleanLocation,
        cleanDate,
        cleanOfferType,
        offer_details ? offer_details.trim() : cleanRole,
        initialStatus,
        user.id,
        user.name
      );

      return ins.lastInsertRowid;
    });

    // Refresh dynamically calculated statistics
    const updatedStats = calculatePlacementStats(resolvedDeptName, cleanYear);
    const createdRecord = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(resultId);

    res.status(201).json({
      success: true,
      message: initialStatus === 'Approved'
        ? 'Placement record saved successfully (Directly Approved)'
        : initialStatus === 'Draft'
        ? 'Placement record saved as draft'
        : 'Placement record submitted for HOD verification and approval',
      id: resultId,
      record: createdRecord,
      status: initialStatus,
      stats: updatedStats
    });
  } catch (err) {
    console.error('Error adding placement record:', err);
    res.status(500).json({ error: err.message || 'Failed to save placement record' });
  }
});

// PUT /api/placements/records/:id - Edit an individual placement record
app.put('/api/placements/records/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Placement record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: 'Access denied for this department' });
    }

    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only edit their own submitted placement records' });
      }
      if (existing.status === 'Approved') {
        return res.status(403).json({ error: 'Approved placement records cannot be directly edited by faculty. Please contact HOD.' });
      }
    }

    const {
      student_id,
      student_name,
      register_no,
      department,
      academic_year,
      company_name,
      package: salaryPackage,
      placement_status,
      job_role,
      location,
      placement_date,
      offer_type,
      offer_details,
      status
    } = req.body;

    let targetStudentId = student_id ? parseInt(student_id, 10) : existing.student_id;
    let resolvedName = student_name ? student_name.trim() : existing.student_name;
    let resolvedRegNo = register_no ? register_no.trim() : existing.register_no;

    if (student_id && parseInt(student_id, 10) !== existing.student_id) {
      const student = db.prepare('SELECT id, name, register_no, department, status FROM students WHERE id = ?').get(student_id);
      if (!student) {
        return res.status(400).json({ error: 'Selected student does not exist in student registry' });
      }
      if (student.status !== 'Active') {
        return res.status(400).json({ error: `Selected student '${student.name}' is inactive.` });
      }
      targetStudentId = student.id;
      resolvedName = student.name;
      resolvedRegNo = student.register_no;
    }

    let newStatus = existing.status;
    if (user.role === 'faculty') {
      if (existing.status === 'Changes Requested' || existing.status === 'Draft') {
        newStatus = (status === 'Draft') ? 'Draft' : 'Pending Approval';
      }
    } else if (user.role === 'admin' || user.role === 'hod') {
      if (status) newStatus = status;
    }

    let pkg = existing.package;
    if (salaryPackage !== undefined && salaryPackage !== null && salaryPackage !== '') {
      let rawPkg = salaryPackage;
      if (typeof rawPkg === 'string') {
        rawPkg = rawPkg.replace(/[^0-9.]/g, '');
      }
      pkg = parseFloat(rawPkg) || 0;
      if (pkg < 0) {
        return res.status(400).json({ error: 'Salary package cannot be negative.' });
      }
    }

    withTransaction(() => {
      const stmt = db.prepare(`
        UPDATE placement_records SET
          student_id = ?,
          student_name = ?,
          register_no = ?,
          department = ?,
          academic_year = ?,
          company_name = ?,
          package = ?,
          placement_status = ?,
          job_role = ?,
          location = ?,
          placement_date = ?,
          offer_type = ?,
          offer_details = ?,
          status = ?,
          review_comments = CASE WHEN ? = 'Pending Approval' THEN NULL ELSE review_comments END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        targetStudentId,
        resolvedName,
        resolvedRegNo,
        department || existing.department,
        academic_year || existing.academic_year,
        company_name !== undefined ? company_name.trim() : existing.company_name,
        pkg,
        placement_status || existing.placement_status,
        job_role !== undefined ? job_role.trim() : existing.job_role,
        location !== undefined ? location.trim() : existing.location,
        placement_date !== undefined ? placement_date.trim() : existing.placement_date,
        offer_type !== undefined ? offer_type.trim() : existing.offer_type,
        offer_details !== undefined ? offer_details.trim() : existing.offer_details,
        newStatus,
        newStatus,
        id
      );
    });

    const updatedRecord = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);
    const updatedStats = calculatePlacementStats(updatedRecord.department, updatedRecord.academic_year);

    res.json({
      success: true,
      message: newStatus === 'Pending Approval' && existing.status === 'Changes Requested'
        ? 'Placement record resubmitted for HOD approval'
        : 'Placement record updated successfully',
      status: newStatus,
      record: updatedRecord,
      stats: updatedStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update placement record' });
  }
});

// DELETE /api/placements/records/:id - Delete an individual placement record
app.delete('/api/placements/records/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Placement record not found' });
    }

    if (!checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: 'Access denied for this department' });
    }

    if (user.role === 'faculty') {
      if (existing.submitted_by !== user.id) {
        return res.status(403).json({ error: 'Faculty can only delete their own submissions' });
      }
      if (existing.status !== 'Draft') {
        return res.status(403).json({ error: 'Faculty can only delete draft placement records' });
      }
    }

    db.prepare('DELETE FROM placement_records WHERE id = ?').run(id);

    const updatedStats = calculatePlacementStats(existing.department, existing.academic_year);

    res.json({
      success: true,
      message: 'Placement record deleted successfully',
      stats: updatedStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete placement record' });
  }
});

// POST /api/placements/records/:id/submit - Faculty submit draft placement for approval
app.post('/api/placements/records/:id/submit', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const existing = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Placement record not found' });
    }

    if (user.role === 'faculty' && existing.submitted_by !== user.id) {
      return res.status(403).json({ error: 'Faculty can only submit their own records.' });
    }

    db.prepare(`
      UPDATE placement_records SET
        status = 'Pending Approval',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: 'Placement record submitted for HOD approval',
      status: 'Pending Approval'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/placements/records/:id/approve - HOD/Admin Approve Placement
app.post('/api/placements/records/:id/approve', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { comments } = req.body;

    const existing = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Placement record not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot approve records for ${existing.department}` });
    }

    // Security Rule: Anti-self-approval protection!
    if (existing.submitted_by === user.id) {
      return res.status(403).json({ error: 'Security policy: You cannot approve your own submission.' });
    }

    db.prepare(`
      UPDATE placement_records SET
        status = 'Approved',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_comments = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.name, comments ? comments.trim() : null, id);

    const updatedRecord = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);
    const updatedStats = calculatePlacementStats(existing.department, existing.academic_year);

    res.json({
      success: true,
      message: 'Placement record approved successfully',
      status: 'Approved',
      record: updatedRecord,
      stats: updatedStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/placements/records/:id/request-changes - HOD/Admin Request Changes
app.post('/api/placements/records/:id/request-changes', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { comments } = req.body;

    if (!comments || !comments.trim()) {
      return res.status(400).json({ error: 'Feedback comments explaining the required changes are required.' });
    }

    const existing = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Placement record not found' });
    }

    if (user.role === 'hod' && !checkDepartmentAccess(user, existing.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot review records for ${existing.department}` });
    }

    db.prepare(`
      UPDATE placement_records SET
        status = 'Changes Requested',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_comments = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.name, comments.trim(), id);

    const updatedRecord = db.prepare('SELECT * FROM placement_records WHERE id = ?').get(id);

    res.json({
      success: true,
      message: 'Correction requested from faculty',
      status: 'Changes Requested',
      record: updatedRecord
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compatibility legacy endpoint for placements
app.get('/api/placements', (req, res) => {
  const { department, academic_year } = req.query;
  if (department && academic_year) {
    const stats = calculatePlacementStats(department, academic_year);
    return res.json([stats]);
  }
  res.json([]);
});

// ====================================================
// MODULE 10: RESEARCH, PUBLICATIONS AND PROJECT MANAGEMENT
// ====================================================

// Upload directories for Research and Projects
const researchUploadsDir = path.join(__dirname, 'uploads', 'research');
if (!fs.existsSync(researchUploadsDir)) {
  fs.mkdirSync(researchUploadsDir, { recursive: true });
}

const projectUploadsDir = path.join(__dirname, 'uploads', 'projects');
if (!fs.existsSync(projectUploadsDir)) {
  fs.mkdirSync(projectUploadsDir, { recursive: true });
}

// Helper: check record edit permission
function canEditRecord(user, record) {
  if (!user || !record) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (role === 'hod') {
    return checkDepartmentAccess(user, record.department);
  }
  if (role === 'faculty') {
    if (record.submitted_by !== user.id) return false;
    const s = record.status || 'Draft';
    return s === 'Draft' || s === 'Changes Requested';
  }
  return false;
}

// ----------------------------------------------------
// RESEARCH & PUBLICATIONS ENDPOINTS
// ----------------------------------------------------

// POST /api/research/upload-document - Secure upload for research papers / certificates
app.post('/api/research/upload-document', requireAuth, (req, res) => {
  try {
    const { file_name, file_data } = req.body;
    if (!file_data || !file_name) {
      return res.status(400).json({ error: 'File data and file name are required' });
    }

    const safeBaseName = path.basename(file_name);
    const ext = path.extname(safeBaseName).toLowerCase();
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];

    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Permitted document types are PDF, PNG, and JPG only.' });
    }

    const base64Data = file_data.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds maximum permitted size of 5MB.' });
    }

    const sanitizedUniqueName = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const destination = path.join(researchUploadsDir, sanitizedUniqueName);

    fs.writeFileSync(destination, buffer);

    const relativeUrl = `/api/research/documents/${sanitizedUniqueName}`;
    res.json({
      success: true,
      message: 'Research document uploaded successfully',
      document_path: relativeUrl,
      file_name: safeBaseName
    });
  } catch (err) {
    console.error('Research upload error:', err);
    res.status(500).json({ error: 'Failed to upload research document.' });
  }
});

// GET /api/research/documents/:filename - Secure document retrieval
app.get('/api/research/documents/:filename', requireAuth, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(researchUploadsDir, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve document file' });
  }
});

// GET /api/research/stats - Live calculated statistics
app.get('/api/research/stats', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { department, academic_year } = req.query;
    const isHod = (user.role || '').toLowerCase() === 'hod';
    const deptFilter = isHod ? user.department : (department && department !== 'All' ? department : null);
    const yearFilter = academic_year && academic_year !== 'All' ? academic_year : null;

    const buildCount = (whereExtra, extraParams = []) => {
      let q = 'SELECT COUNT(*) as c FROM research_publications WHERE 1=1';
      const p = [];
      if (deptFilter) {
        q += ' AND (LOWER(department) = LOWER(?) OR department = ?)';
        p.push(deptFilter, deptFilter);
      }
      if (yearFilter) {
        q += ' AND academic_year = ?';
        p.push(yearFilter);
      }
      if (whereExtra) {
        q += ` AND (${whereExtra})`;
        p.push(...extraParams);
      }
      return db.prepare(q).get(...p).c;
    };

    const totalRecords = buildCount(null);
    const approvedPublications = buildCount("status = 'Approved' OR status IS NULL");
    const journalPublications = buildCount("(status = 'Approved' OR status IS NULL) AND publication_type LIKE '%Journal%'");
    const conferencePublications = buildCount("(status = 'Approved' OR status IS NULL) AND publication_type LIKE '%Conference%'");
    const patents = buildCount("(status = 'Approved' OR status IS NULL) AND (publication_type LIKE '%Patent%' OR research_category LIKE '%Patent%')");
    const fundedResearchCount = buildCount("(status = 'Approved' OR status IS NULL) AND funding_amount > 0");

    // Funding sum
    let fundSumQuery = "SELECT COALESCE(SUM(funding_amount), 0) as total FROM research_publications WHERE (status = 'Approved' OR status IS NULL) AND funding_amount > 0";
    const fundParams = [];
    if (deptFilter) {
      fundSumQuery += ' AND (LOWER(department) = LOWER(?) OR department = ?)';
      fundParams.push(deptFilter, deptFilter);
    }
    if (yearFilter) {
      fundSumQuery += ' AND academic_year = ?';
      fundParams.push(yearFilter);
    }
    const totalFundingAmount = db.prepare(fundSumQuery).get(...fundParams).total;

    res.json({
      department: deptFilter || 'All',
      academic_year: yearFilter || 'All',
      total: totalRecords,
      approved: approvedPublications,
      totalRecords,
      approvedPublications,
      journalPublications,
      conferencePublications,
      patents,
      fundedResearchCount,
      totalFundingAmount
    });
  } catch (err) {
    console.error('Error fetching research stats:', err);
    res.status(500).json({ error: 'Failed to fetch research statistics' });
  }
});

// GET /api/research - List research records with filtering and pagination
app.get('/api/research', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      department,
      academic_year,
      publication_type,
      research_area,
      author,
      status,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const role = (user.role || '').toLowerCase();
    const isHod = role === 'hod';
    const deptFilter = isHod ? user.department : (department && department !== 'All' ? department : null);
    const yearFilter = academic_year && academic_year !== 'All' ? academic_year : null;
    const typeFilter = publication_type && publication_type !== 'All' ? publication_type : null;
    const areaFilter = research_area && research_area !== 'All' ? research_area : null;
    const statusFilter = status && status !== 'All' && status !== 'all' ? status : null;

    let query = 'SELECT * FROM research_publications WHERE 1=1';
    const params = [];

    if (deptFilter) {
      query += ' AND (LOWER(department) = LOWER(?) OR department = ?)';
      params.push(deptFilter, deptFilter);
    }

    if (yearFilter) {
      query += ' AND academic_year = ?';
      params.push(yearFilter);
    }

    if (typeFilter) {
      query += ' AND publication_type = ?';
      params.push(typeFilter);
    }

    if (areaFilter) {
      query += ' AND (LOWER(research_area) LIKE ? OR research_area = ?)';
      params.push(`%${areaFilter.toLowerCase()}%`, areaFilter);
    }

    if (statusFilter) {
      query += ' AND status = ?';
      params.push(statusFilter);
    }

    // Role visibility for faculty: can see Approved records of their dept, OR own submissions
    if (role === 'faculty') {
      query += " AND (status = 'Approved' OR submitted_by = ? OR (LOWER(department) = LOWER(?) AND status = 'Pending Approval'))";
      params.push(user.id, user.department || '');
    }

    let rows = db.prepare(query + ' ORDER BY publication_date DESC, id DESC').all(...params);

    // Client-level search across title, authors, journal, doi
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.title && r.title.toLowerCase().includes(s)) ||
        (r.author_names && r.author_names.toLowerCase().includes(s)) ||
        (r.journal_conference_name && r.journal_conference_name.toLowerCase().includes(s)) ||
        (r.research_area && r.research_area.toLowerCase().includes(s)) ||
        (r.doi && r.doi.toLowerCase().includes(s)) ||
        (r.funding_agency && r.funding_agency.toLowerCase().includes(s)) ||
        `#res-${r.id}`.includes(s)
      );
    }

    if (author && author.trim()) {
      const a = author.trim().toLowerCase();
      rows = rows.filter(r => r.author_names && r.author_names.toLowerCase().includes(a));
    }

    // Enrich records with linked students and faculty
    const enriched = rows.map(r => {
      const students = db.prepare(`
        SELECT s.id, s.name, s.register_no, s.department
        FROM research_students rs
        JOIN students s ON rs.student_id = s.id
        WHERE rs.research_id = ?
      `).all(r.id);

      const faculty = db.prepare(`
        SELECT f.id, f.faculty_name, f.designation, f.department
        FROM research_faculty rf
        JOIN faculty f ON rf.faculty_id = f.id
        WHERE rf.research_id = ?
      `).all(r.id);

      return {
        ...r,
        doi: r.doi || r.doi_url,
        doi_url: r.doi_url || r.doi,
        recordCode: `#RES-${r.id}`,
        students,
        faculty
      };
    });

    const total = enriched.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const records = enriched.slice(offset, offset + limitNum);

    res.json({
      records,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  } catch (err) {
    console.error('Error fetching research records:', err);
    res.status(500).json({ error: 'Failed to fetch research records' });
  }
});

// GET /api/research/:id - Detail view
app.get('/api/research/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Research record not found' });
    }

    const students = db.prepare(`
      SELECT s.id, s.name, s.register_no, s.department
      FROM research_students rs
      JOIN students s ON rs.student_id = s.id
      WHERE rs.research_id = ?
    `).all(id);

    const faculty = db.prepare(`
      SELECT f.id, f.faculty_name, f.designation, f.department
      FROM research_faculty rf
      JOIN faculty f ON rf.faculty_id = f.id
      WHERE rf.research_id = ?
    `).all(id);

    const history = db.prepare(`
      SELECT * FROM approval_history
      WHERE record_type = 'research' AND record_id = ?
      ORDER BY created_at DESC
    `).all(id);

    res.json({
      ...record,
      reviewer_comments: record.reviewer_comments || record.review_comments,
      review_comments: record.review_comments || record.reviewer_comments,
      doi: record.doi || record.doi_url,
      doi_url: record.doi_url || record.doi,
      recordCode: `#RES-${record.id}`,
      students,
      faculty,
      history
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch research record detail' });
  }
});

// POST /api/research - Create research publication
app.post('/api/research', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      title,
      description,
      research_category,
      publication_type,
      author_names,
      department,
      journal_conference_name,
      publisher,
      publication_date,
      academic_year,
      doi,
      research_area,
      funding_agency,
      funding_amount,
      document_path,
      student_ids = [],
      faculty_ids = [],
      submit_for_approval = true,
      status: requestedStatus
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Research or publication title is required' });
    }
    if (!publication_type || !publication_type.trim()) {
      return res.status(400).json({ error: 'Publication type is required' });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ error: 'Department is required' });
    }
    if (!publication_date) {
      return res.status(400).json({ error: 'Publication date is required' });
    }
    if (!academic_year) {
      return res.status(400).json({ error: 'Academic year is required' });
    }

    // Role & Department security
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && !checkDepartmentAccess(user, department)) {
      return res.status(403).json({ error: `You are not authorized to create records for ${department}.` });
    }

    // Validate funding amount
    const parsedFunding = parseFloat(funding_amount) || 0;
    if (parsedFunding < 0) {
      return res.status(400).json({ error: 'Funding amount cannot be negative' });
    }

    // Validate students exist
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      for (const sId of student_ids) {
        const student = db.prepare('SELECT id, name, department FROM students WHERE id = ?').get(sId);
        if (!student) {
          return res.status(400).json({ error: `Linked student ID ${sId} does not exist in registry` });
        }
      }
    }

    // Validate faculty exist
    if (Array.isArray(faculty_ids) && faculty_ids.length > 0) {
      for (const fId of faculty_ids) {
        const f = db.prepare('SELECT id, faculty_name FROM faculty WHERE id = ?').get(fId);
        if (!f) {
          return res.status(400).json({ error: `Linked faculty ID ${fId} does not exist in registry` });
        }
      }
    }

    // Resolve department_id
    const deptRow = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(department, department);
    const department_id = deptRow ? deptRow.id : null;

    const initialStatus = requestedStatus || (submit_for_approval ? 'Pending Approval' : 'Draft');

    const cleanDoi = (doi || req.body.doi_url || '').trim() || null;

    const insertStmt = db.prepare(`
      INSERT INTO research_publications (
        title, description, research_category, publication_type, author_names,
        department_id, department, journal_conference_name, publisher, publication_date,
        academic_year, doi, doi_url, research_area, funding_agency, funding_amount, document_path,
        status, submitted_by, submitted_by_name, submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insertStmt.run(
      title.trim(),
      description ? description.trim() : null,
      research_category ? research_category.trim() : null,
      publication_type.trim(),
      author_names ? author_names.trim() : null,
      department_id,
      department.trim(),
      journal_conference_name ? journal_conference_name.trim() : null,
      publisher ? publisher.trim() : null,
      publication_date,
      academic_year,
      cleanDoi,
      cleanDoi,
      research_area ? research_area.trim() : null,
      funding_agency ? funding_agency.trim() : null,
      parsedFunding,
      document_path || null,
      initialStatus,
      user.id,
      user.name
    );

    const newId = result.lastInsertRowid;

    // Link students in junction table
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const linkStudentStmt = db.prepare('INSERT OR IGNORE INTO research_students (research_id, student_id) VALUES (?, ?)');
      for (const sId of student_ids) {
        linkStudentStmt.run(newId, sId);
      }
    }

    // Link faculty in junction table
    if (Array.isArray(faculty_ids) && faculty_ids.length > 0) {
      const linkFacultyStmt = db.prepare('INSERT OR IGNORE INTO research_faculty (research_id, faculty_id) VALUES (?, ?)');
      for (const fId of faculty_ids) {
        linkFacultyStmt.run(newId, fId);
      }
    }

    // Record initial approval history if submitted
    if (initialStatus === 'Pending Approval') {
      recordApprovalHistory('research', newId, 'Draft', 'Pending Approval', user.id, user.name, 'Submitted for approval');
    }

    const createdRecord = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(newId);
    res.status(201).json({
      success: true,
      message: 'Research record created successfully',
      id: newId,
      record: {
        ...createdRecord,
        recordCode: `#RES-${newId}`
      }
    });
  } catch (err) {
    console.error('Error creating research record:', err);
    res.status(500).json({ error: 'Failed to create research record: ' + err.message });
  }
});

// PUT /api/research/:id - Edit research publication
app.put('/api/research/:id', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Research record not found' });
    }

    if (!canEditRecord(user, existing)) {
      return res.status(403).json({ error: 'You are not authorized to edit this research record.' });
    }

    const {
      title,
      description,
      research_category,
      publication_type,
      author_names,
      department,
      journal_conference_name,
      publisher,
      publication_date,
      academic_year,
      doi,
      research_area,
      funding_agency,
      funding_amount,
      document_path,
      student_ids,
      faculty_ids,
      submit_for_approval
    } = req.body;

    const targetDept = department || existing.department;
    if (user.role !== 'admin' && !checkDepartmentAccess(user, targetDept)) {
      return res.status(403).json({ error: `Unauthorized department '${targetDept}'` });
    }

    const parsedFunding = funding_amount !== undefined ? (parseFloat(funding_amount) || 0) : existing.funding_amount;
    if (parsedFunding < 0) {
      return res.status(400).json({ error: 'Funding amount cannot be negative' });
    }

    let newStatus = existing.status;
    let comments = existing.review_comments;
    if (submit_for_approval || existing.status === 'Changes Requested') {
      newStatus = 'Pending Approval';
      comments = null;
    }

    const deptRow = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(targetDept, targetDept);
    const department_id = deptRow ? deptRow.id : existing.department_id;

    db.prepare(`
      UPDATE research_publications SET
        title = ?,
        description = ?,
        research_category = ?,
        publication_type = ?,
        author_names = ?,
        department_id = ?,
        department = ?,
        journal_conference_name = ?,
        publisher = ?,
        publication_date = ?,
        academic_year = ?,
        doi = ?,
        doi_url = ?,
        research_area = ?,
        funding_agency = ?,
        funding_amount = ?,
        document_path = COALESCE(?, document_path),
        status = ?,
        review_comments = ?,
        reviewer_comments = ?,
        submitted_at = CASE WHEN ? = 'Pending Approval' AND status != 'Pending Approval' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title !== undefined ? title.trim() : existing.title,
      description !== undefined ? (description ? description.trim() : null) : (existing.description || null),
      research_category !== undefined ? (research_category ? research_category.trim() : null) : (existing.research_category || null),
      publication_type !== undefined ? publication_type.trim() : existing.publication_type,
      author_names !== undefined ? (author_names ? author_names.trim() : null) : (existing.author_names || null),
      department_id ?? null,
      targetDept,
      journal_conference_name !== undefined ? (journal_conference_name ? journal_conference_name.trim() : null) : (existing.journal_conference_name || null),
      publisher !== undefined ? (publisher ? publisher.trim() : null) : (existing.publisher || null),
      publication_date || existing.publication_date || null,
      academic_year || existing.academic_year || null,
      doi !== undefined ? (doi ? doi.trim() : null) : (existing.doi || existing.doi_url || null),
      doi !== undefined ? (doi ? doi.trim() : null) : (existing.doi_url || existing.doi || null),
      research_area !== undefined ? (research_area ? research_area.trim() : null) : (existing.research_area || null),
      funding_agency !== undefined ? (funding_agency ? funding_agency.trim() : null) : (existing.funding_agency || null),
      parsedFunding ?? 0,
      document_path !== undefined ? document_path : null,
      newStatus || 'Draft',
      comments ?? null,
      comments ?? null,
      newStatus || 'Draft',
      id
    );

    // Sync student links if provided
    if (Array.isArray(student_ids)) {
      db.prepare('DELETE FROM research_students WHERE research_id = ?').run(id);
      const linkStudentStmt = db.prepare('INSERT OR IGNORE INTO research_students (research_id, student_id) VALUES (?, ?)');
      for (const sId of student_ids) {
        linkStudentStmt.run(id, sId);
      }
    }

    // Sync faculty links if provided
    if (Array.isArray(faculty_ids)) {
      db.prepare('DELETE FROM research_faculty WHERE research_id = ?').run(id);
      const linkFacultyStmt = db.prepare('INSERT OR IGNORE INTO research_faculty (research_id, faculty_id) VALUES (?, ?)');
      for (const fId of faculty_ids) {
        linkFacultyStmt.run(id, fId);
      }
    }

    if (existing.status !== newStatus) {
      recordApprovalHistory('research', id, existing.status, newStatus, user.id, user.name, 'Resubmitted after edits');
    }

    const updated = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(id);
    res.json({
      success: true,
      message: 'Research record updated successfully',
      record: {
        ...updated,
        recordCode: `#RES-${id}`
      }
    });
  } catch (err) {
    console.error('Error updating research record:', err);
    res.status(500).json({ error: 'Failed to update research record: ' + err.message });
  }
});

// DELETE /api/research/:id - Delete research record
app.delete('/api/research/:id', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Research record not found' });
    }

    const role = (user.role || '').toLowerCase();
    if (role === 'faculty') {
      if (existing.submitted_by !== user.id || existing.status !== 'Draft') {
        return res.status(403).json({ error: 'Faculty can only delete their own draft records' });
      }
    } else if (role === 'hod') {
      if (!checkDepartmentAccess(user, existing.department)) {
        return res.status(403).json({ error: 'HOD cannot delete records from another department' });
      }
    }

    db.prepare('DELETE FROM research_students WHERE research_id = ?').run(id);
    db.prepare('DELETE FROM research_faculty WHERE research_id = ?').run(id);
    db.prepare('DELETE FROM research_publications WHERE id = ?').run(id);

    res.json({ success: true, message: 'Research record deleted successfully' });
  } catch (err) {
    console.error('Error deleting research record:', err);
    res.status(500).json({ error: 'Failed to delete research record' });
  }
});

// POST /api/research/:id/submit - Submit for approval
app.post('/api/research/:id/submit', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Research record not found' });
    }

    if (existing.submitted_by !== user.id && user.role !== 'admin' && user.role !== 'hod') {
      return res.status(403).json({ error: 'You are not authorized to submit this record' });
    }
    if (existing.status === 'Approved') {
      return res.status(400).json({ error: 'Approved records cannot be resubmitted' });
    }

    const prevStatus = existing.status;
    db.prepare(`
      UPDATE research_publications SET
        status = 'Pending Approval',
        submitted_at = CURRENT_TIMESTAMP,
        review_comments = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    recordApprovalHistory('research', id, prevStatus, 'Pending Approval', user.id, user.name, 'Submitted for approval');

    res.json({ success: true, message: 'Record submitted for approval', status: 'Pending Approval' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit record for approval' });
  }
});

// POST /api/research/:id/approve - Direct approval route
app.post('/api/research/:id/approve', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const record = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Research record not found' });
    }

    const isHod = (user.role || '').toLowerCase() === 'hod';
    if (isHod && !checkDepartmentAccess(user, record.department)) {
      return res.status(403).json({ error: `Cannot approve record outside ${user.department}` });
    }

    if (record.submitted_by === user.id) {
      return res.status(403).json({ error: 'Anti-self-approval: You cannot approve your own submission.' });
    }

    const prev = record.status || 'Pending Approval';
    db.prepare(`
      UPDATE research_publications SET
        status = 'Approved',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_comments = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.name, id);

    recordApprovalHistory('research', id, prev, 'Approved', user.id, user.name, 'Approved');

    res.json({ success: true, message: 'Research record approved', status: 'Approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/:id/request-changes - Request revisions
app.post('/api/research/:id/request-changes', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { comments } = req.body;

    if (!comments || !comments.trim()) {
      return res.status(400).json({ error: 'Feedback comments are required when requesting changes.' });
    }

    const record = db.prepare('SELECT * FROM research_publications WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Research record not found' });
    }

    const isHod = (user.role || '').toLowerCase() === 'hod';
    if (isHod && !checkDepartmentAccess(user, record.department)) {
      return res.status(403).json({ error: `Cannot request changes outside ${user.department}` });
    }

    if (record.submitted_by === user.id) {
      return res.status(403).json({ error: 'Anti-self-approval: You cannot review your own submission.' });
    }

    const prev = record.status || 'Pending Approval';
    const cleanComment = comments.trim();
    db.prepare(`
      UPDATE research_publications SET
        status = 'Changes Requested',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_comments = ?,
        reviewer_comments = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.name, cleanComment, cleanComment, id);

    recordApprovalHistory('research', id, prev, 'Changes Requested', user.id, user.name, cleanComment);

    res.json({ success: true, message: 'Revisions requested', status: 'Changes Requested' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PROJECT MANAGEMENT ENDPOINTS
// ----------------------------------------------------

// POST /api/projects/upload-document - Secure upload for project documents
app.post('/api/projects/upload-document', requireAuth, (req, res) => {
  try {
    const { file_name, file_data } = req.body;
    if (!file_data || !file_name) {
      return res.status(400).json({ error: 'File data and file name are required' });
    }

    const safeBaseName = path.basename(file_name);
    const ext = path.extname(safeBaseName).toLowerCase();
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];

    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Permitted document types are PDF, PNG, and JPG only.' });
    }

    const base64Data = file_data.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds maximum permitted size of 5MB.' });
    }

    const sanitizedUniqueName = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const destination = path.join(projectUploadsDir, sanitizedUniqueName);

    fs.writeFileSync(destination, buffer);

    const relativeUrl = `/api/projects/documents/${sanitizedUniqueName}`;
    res.json({
      success: true,
      message: 'Project document uploaded successfully',
      document_path: relativeUrl,
      file_name: safeBaseName
    });
  } catch (err) {
    console.error('Project upload error:', err);
    res.status(500).json({ error: 'Failed to upload project document.' });
  }
});

// GET /api/projects/documents/:filename - Secure project document retrieval
app.get('/api/projects/documents/:filename', requireAuth, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(projectUploadsDir, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve project document file' });
  }
});

// GET /api/projects/stats - Live calculated statistics
app.get('/api/projects/stats', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { department, academic_year } = req.query;
    const isHod = (user.role || '').toLowerCase() === 'hod';
    const deptFilter = isHod ? user.department : (department && department !== 'All' ? department : null);
    const yearFilter = academic_year && academic_year !== 'All' ? academic_year : null;

    const buildCount = (whereExtra, extraParams = []) => {
      let q = 'SELECT COUNT(*) as c FROM projects WHERE 1=1';
      const p = [];
      if (deptFilter) {
        q += ' AND (LOWER(department) = LOWER(?) OR department = ?)';
        p.push(deptFilter, deptFilter);
      }
      if (yearFilter) {
        q += ' AND academic_year = ?';
        p.push(yearFilter);
      }
      if (whereExtra) {
        q += ` AND (${whereExtra})`;
        p.push(...extraParams);
      }
      return db.prepare(q).get(...p).c;
    };

    const totalProjects = buildCount(null);
    const completedProjects = buildCount("(status = 'Approved' OR status IS NULL) AND project_status = 'Completed'");
    const ongoingProjects = buildCount("(status = 'Approved' OR status IS NULL) AND (project_status = 'Ongoing' OR project_status = 'In Progress')");
    const fundedProjects = buildCount("(status = 'Approved' OR status IS NULL) AND (funding_amount > 0 OR (funding_agency IS NOT NULL AND TRIM(funding_agency) != ''))");
    const awardWinningProjects = buildCount("(status = 'Approved' OR status IS NULL) AND awards_recognition IS NOT NULL AND TRIM(awards_recognition) != ''");

    let fundSumQuery = "SELECT COALESCE(SUM(funding_amount), 0) as total FROM projects WHERE (status = 'Approved' OR status IS NULL) AND funding_amount > 0";
    const fundParams = [];
    if (deptFilter) {
      fundSumQuery += ' AND (LOWER(department) = LOWER(?) OR department = ?)';
      fundParams.push(deptFilter, deptFilter);
    }
    if (yearFilter) {
      fundSumQuery += ' AND academic_year = ?';
      fundParams.push(yearFilter);
    }
    const totalFundingAmount = db.prepare(fundSumQuery).get(...fundParams).total;
    const approvedProjects = buildCount("status = 'Approved' OR status IS NULL");

    res.json({
      department: deptFilter || 'All',
      academic_year: yearFilter || 'All',
      total: totalProjects,
      approved: approvedProjects,
      totalProjects,
      approvedProjects,
      completedProjects,
      ongoingProjects,
      fundedProjects,
      awardWinningProjects,
      totalFundingAmount
    });
  } catch (err) {
    console.error('Error fetching project stats:', err);
    res.status(500).json({ error: 'Failed to fetch project statistics' });
  }
});

// GET /api/projects - List projects with filters and pagination
app.get('/api/projects', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      department,
      academic_year,
      project_category,
      project_status,
      student_id,
      faculty_id,
      status,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const role = (user.role || '').toLowerCase();
    const isHod = role === 'hod';
    const deptFilter = isHod ? user.department : (department && department !== 'All' ? department : null);
    const yearFilter = academic_year && academic_year !== 'All' ? academic_year : null;
    const catParam = project_category || req.query.category;
    const catFilter = catParam && catParam !== 'All' ? catParam : null;
    const pStatusFilter = project_status && project_status !== 'All' ? project_status : null;
    const statusFilter = status && status !== 'All' && status !== 'all' ? status : null;

    let query = 'SELECT * FROM projects WHERE 1=1';
    const params = [];

    if (deptFilter) {
      query += ' AND (LOWER(department) = LOWER(?) OR department = ?)';
      params.push(deptFilter, deptFilter);
    }

    if (yearFilter) {
      query += ' AND academic_year = ?';
      params.push(yearFilter);
    }

    if (catFilter) {
      query += ' AND (LOWER(project_category) = LOWER(?) OR LOWER(project_category) LIKE LOWER(?))';
      params.push(catFilter, `${catFilter.replace(/s$/, '')}%`);
    }

    if (pStatusFilter) {
      query += ' AND project_status = ?';
      params.push(pStatusFilter);
    }

    if (statusFilter) {
      query += ' AND status = ?';
      params.push(statusFilter);
    }

    // Role visibility for faculty
    if (role === 'faculty') {
      query += ' AND (status = "Approved" OR submitted_by = ? OR (LOWER(department) = LOWER(?) AND status = "Pending Approval"))';
      params.push(user.id, user.department || '');
    }

    let rows = db.prepare(query + ' ORDER BY id DESC').all(...params);

    // Linked student filter
    if (student_id) {
      const validProjectIds = db.prepare('SELECT project_id FROM project_students WHERE student_id = ?').all(student_id).map(r => r.project_id);
      rows = rows.filter(r => validProjectIds.includes(r.id));
    }

    // Linked faculty filter
    if (faculty_id) {
      const validProjectIds = db.prepare('SELECT project_id FROM project_faculty WHERE faculty_id = ?').all(faculty_id).map(r => r.project_id);
      rows = rows.filter(r => validProjectIds.includes(r.id) || r.coordinator_faculty_id === parseInt(faculty_id, 10));
    }

    // Client-level search
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.project_title && r.project_title.toLowerCase().includes(s)) ||
        (r.coordinator && r.coordinator.toLowerCase().includes(s)) ||
        (r.project_category && r.project_category.toLowerCase().includes(s)) ||
        (r.industry_partner && r.industry_partner.toLowerCase().includes(s)) ||
        (r.competition_name && r.competition_name.toLowerCase().includes(s)) ||
        (r.awards_recognition && r.awards_recognition.toLowerCase().includes(s)) ||
        `#prj-${r.id}`.includes(s)
      );
    }

    // Enrich records with linked students and faculty
    const enriched = rows.map(r => {
      const students = db.prepare(`
        SELECT s.id, s.name, s.register_no, s.department
        FROM project_students ps
        JOIN students s ON ps.student_id = s.id
        WHERE ps.project_id = ?
      `).all(r.id);

      const faculty = db.prepare(`
        SELECT f.id, f.faculty_name, f.designation, f.department
        FROM project_faculty pf
        JOIN faculty f ON pf.faculty_id = f.id
        WHERE pf.project_id = ?
      `).all(r.id);

      return {
        ...r,
        title: r.title || r.project_title,
        project_title: r.project_title || r.title,
        category: r.project_category,
        project_category: r.project_category,
        recordCode: `#PRJ-${r.id}`,
        students,
        faculty
      };
    });

    const total = enriched.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const records = enriched.slice(offset, offset + limitNum);

    res.json({
      records,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch project records' });
  }
});

// GET /api/projects/:id - Detail view
app.get('/api/projects/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Project record not found' });
    }

    const students = db.prepare(`
      SELECT s.id, s.name, s.register_no, s.department
      FROM project_students ps
      JOIN students s ON ps.student_id = s.id
      WHERE ps.project_id = ?
    `).all(id);

    const faculty = db.prepare(`
      SELECT f.id, f.faculty_name, f.designation, f.department
      FROM project_faculty pf
      JOIN faculty f ON pf.faculty_id = f.id
      WHERE pf.project_id = ?
    `).all(id);

    const history = db.prepare(`
      SELECT * FROM approval_history
      WHERE record_type = 'projects' AND record_id = ?
      ORDER BY created_at DESC
    `).all(id);

    res.json({
      ...record,
      title: record.title || record.project_title,
      project_title: record.project_title || record.title,
      reviewer_comments: record.reviewer_comments || record.review_comments,
      review_comments: record.review_comments || record.reviewer_comments,
      coordinator: record.coordinator || record.project_guide,
      project_guide: record.project_guide || record.coordinator,
      industry_partner: record.industry_partner || record.partner_organization,
      partner_organization: record.partner_organization || record.industry_partner,
      recordCode: `#PRJ-${record.id}`,
      students,
      faculty,
      history
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project record detail' });
  }
});

// POST /api/projects - Create project
app.post('/api/projects', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const {
      project_title,
      description,
      project_category,
      project_type,
      department,
      academic_year,
      start_date,
      completion_date,
      coordinator,
      coordinator_faculty_id,
      project_status,
      funding_agency,
      funding_amount,
      industry_partner,
      competition_name,
      awards_recognition,
      project_url,
      document_path,
      student_ids = [],
      faculty_ids = [],
      submit_for_approval = true,
      status: requestedStatus
    } = req.body;

    const effectiveTitle = (project_title || req.body.title || '').trim();
    const effectiveCategory = (project_category || req.body.category || '').trim();
    const effectiveType = (project_type || req.body.type || 'Capstone Project').trim();
    const effectiveGuide = (coordinator || req.body.project_guide || req.body.guide_name || '').trim();
    const effectiveGuideId = coordinator_faculty_id || req.body.guide_faculty_id ? parseInt(coordinator_faculty_id || req.body.guide_faculty_id, 10) : null;
    const effectivePartner = (industry_partner || req.body.partner_organization || req.body.partner || '').trim() || null;
    const effectiveFundingAgency = (funding_agency || req.body.funding_sponsorship || '').trim() || null;

    if (!effectiveTitle) {
      return res.status(400).json({ error: 'Project title is required' });
    }
    if (!effectiveCategory) {
      return res.status(400).json({ error: 'Project category is required' });
    }
    if (!effectiveType) {
      return res.status(400).json({ error: 'Project type is required' });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ error: 'Department is required' });
    }
    if (!academic_year) {
      return res.status(400).json({ error: 'Academic year is required' });
    }

    // Role & Department security
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && !checkDepartmentAccess(user, department)) {
      return res.status(403).json({ error: `You are not authorized to create records for ${department}.` });
    }

    // Funding validation
    const parsedFunding = parseFloat(funding_amount) || 0;
    if (parsedFunding < 0) {
      return res.status(400).json({ error: 'Funding amount cannot be negative' });
    }

    // Date range validation
    if (start_date && completion_date && start_date > completion_date) {
      return res.status(400).json({ error: 'Start date cannot be after completion date.' });
    }

    // Validate students
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      for (const sId of student_ids) {
        const student = db.prepare('SELECT id FROM students WHERE id = ?').get(sId);
        if (!student) {
          return res.status(400).json({ error: `Linked student ID ${sId} does not exist in registry` });
        }
      }
    }

    // Validate faculty
    if (Array.isArray(faculty_ids) && faculty_ids.length > 0) {
      for (const fId of faculty_ids) {
        const f = db.prepare('SELECT id FROM faculty WHERE id = ?').get(fId);
        if (!f) {
          return res.status(400).json({ error: `Linked faculty ID ${fId} does not exist in registry` });
        }
      }
    }

    const deptRow = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(department, department);
    const department_id = deptRow ? deptRow.id : null;

    const initialStatus = requestedStatus || (submit_for_approval ? 'Pending Approval' : 'Draft');

    const insertStmt = db.prepare(`
      INSERT INTO projects (
        project_title, title, description, project_category, project_type,
        department_id, department, academic_year, start_date, completion_date,
        coordinator, project_guide, coordinator_faculty_id, guide_faculty_id, project_status,
        funding_agency, funding_amount, industry_partner, partner_organization,
        competition_name, awards_recognition, project_url, document_path,
        status, submitted_by, submitted_by_name, submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insertStmt.run(
      effectiveTitle,
      effectiveTitle,
      description ? description.trim() : null,
      effectiveCategory,
      effectiveType,
      department_id,
      department.trim(),
      academic_year,
      start_date || null,
      completion_date || null,
      effectiveGuide || null,
      effectiveGuide || null,
      effectiveGuideId,
      effectiveGuideId,
      project_status || 'Ongoing',
      effectiveFundingAgency,
      parsedFunding,
      effectivePartner,
      effectivePartner,
      competition_name ? competition_name.trim() : null,
      awards_recognition ? awards_recognition.trim() : null,
      project_url ? project_url.trim() : null,
      document_path || null,
      initialStatus,
      user.id,
      user.name
    );

    const newId = result.lastInsertRowid;

    // Link students in junction table
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const linkStudentStmt = db.prepare('INSERT OR IGNORE INTO project_students (project_id, student_id) VALUES (?, ?)');
      for (const sId of student_ids) {
        linkStudentStmt.run(newId, sId);
      }
    }

    // Link faculty in junction table
    if (Array.isArray(faculty_ids) && faculty_ids.length > 0) {
      const linkFacultyStmt = db.prepare('INSERT OR IGNORE INTO project_faculty (project_id, faculty_id) VALUES (?, ?)');
      for (const fId of faculty_ids) {
        linkFacultyStmt.run(newId, fId);
      }
    }

    if (initialStatus === 'Pending Approval') {
      recordApprovalHistory('projects', newId, 'Draft', 'Pending Approval', user.id, user.name, 'Submitted for approval');
    }

    const createdRecord = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId);
    res.status(201).json({
      success: true,
      message: 'Project record created successfully',
      id: newId,
      record: {
        ...createdRecord,
        recordCode: `#PRJ-${newId}`
      }
    });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project: ' + err.message });
  }
});

// PUT /api/projects/:id - Edit project
app.put('/api/projects/:id', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project record not found' });
    }

    if (!canEditRecord(user, existing)) {
      return res.status(403).json({ error: 'You are not authorized to edit this project record.' });
    }

    const {
      project_title,
      description,
      project_category,
      project_type,
      department,
      academic_year,
      start_date,
      completion_date,
      coordinator,
      coordinator_faculty_id,
      project_status,
      funding_agency,
      funding_amount,
      industry_partner,
      competition_name,
      awards_recognition,
      project_url,
      document_path,
      student_ids,
      faculty_ids,
      submit_for_approval
    } = req.body;

    const targetDept = department || existing.department;
    if (user.role !== 'admin' && !checkDepartmentAccess(user, targetDept)) {
      return res.status(403).json({ error: `Unauthorized department '${targetDept}'` });
    }

    const parsedFunding = funding_amount !== undefined ? (parseFloat(funding_amount) || 0) : existing.funding_amount;
    if (parsedFunding < 0) {
      return res.status(400).json({ error: 'Funding amount cannot be negative' });
    }

    const sDate = start_date !== undefined ? start_date : existing.start_date;
    const cDate = completion_date !== undefined ? completion_date : existing.completion_date;
    if (sDate && cDate && sDate > cDate) {
      return res.status(400).json({ error: 'Start date cannot be after completion date.' });
    }

    let newStatus = existing.status;
    let comments = existing.review_comments;
    if (submit_for_approval || existing.status === 'Changes Requested') {
      newStatus = 'Pending Approval';
      comments = null;
    }

    const deptRow = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)').get(targetDept, targetDept);
    const department_id = deptRow ? deptRow.id : existing.department_id;

    const effTitle = project_title !== undefined ? project_title.trim() : (req.body.title !== undefined ? req.body.title.trim() : (existing.project_title || existing.title));
    const effCategory = project_category !== undefined ? project_category.trim() : (req.body.category !== undefined ? req.body.category.trim() : existing.project_category);
    const effType = project_type !== undefined ? project_type.trim() : (req.body.type !== undefined ? req.body.type.trim() : existing.project_type);
    const effGuide = coordinator !== undefined ? coordinator.trim() : (req.body.project_guide !== undefined ? req.body.project_guide.trim() : (req.body.guide_name !== undefined ? req.body.guide_name.trim() : (existing.coordinator || existing.project_guide)));
    const effGuideId = coordinator_faculty_id !== undefined ? (coordinator_faculty_id ? parseInt(coordinator_faculty_id, 10) : null) : (req.body.guide_faculty_id ? parseInt(req.body.guide_faculty_id, 10) : (existing.coordinator_faculty_id || existing.guide_faculty_id));
    const effPartner = industry_partner !== undefined ? industry_partner.trim() : (req.body.partner_organization !== undefined ? req.body.partner_organization.trim() : (req.body.partner !== undefined ? req.body.partner.trim() : (existing.industry_partner || existing.partner_organization)));
    const effFundingAgency = funding_agency !== undefined ? funding_agency.trim() : (req.body.funding_sponsorship !== undefined ? req.body.funding_sponsorship.trim() : existing.funding_agency);

    db.prepare(`
      UPDATE projects SET
        project_title = ?,
        title = ?,
        description = ?,
        project_category = ?,
        project_type = ?,
        department_id = ?,
        department = ?,
        academic_year = ?,
        start_date = ?,
        completion_date = ?,
        coordinator = ?,
        project_guide = ?,
        coordinator_faculty_id = ?,
        guide_faculty_id = ?,
        project_status = ?,
        funding_agency = ?,
        funding_amount = ?,
        industry_partner = ?,
        partner_organization = ?,
        competition_name = ?,
        awards_recognition = ?,
        project_url = ?,
        document_path = COALESCE(?, document_path),
        status = ?,
        review_comments = ?,
        reviewer_comments = ?,
        submitted_at = CASE WHEN ? = 'Pending Approval' AND status != 'Pending Approval' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      effTitle,
      effTitle,
      description !== undefined ? (description ? description.trim() : null) : (existing.description || null),
      effCategory,
      effType,
      department_id ?? null,
      targetDept,
      academic_year || existing.academic_year,
      sDate || null,
      cDate || null,
      effGuide || null,
      effGuide || null,
      effGuideId ?? null,
      effGuideId ?? null,
      project_status || existing.project_status || 'Ongoing',
      effFundingAgency || null,
      parsedFunding ?? 0,
      effPartner || null,
      effPartner || null,
      competition_name !== undefined ? (competition_name ? competition_name.trim() : null) : (existing.competition_name || null),
      awards_recognition !== undefined ? (awards_recognition ? awards_recognition.trim() : null) : (existing.awards_recognition || null),
      project_url !== undefined ? (project_url ? project_url.trim() : null) : (existing.project_url || null),
      document_path !== undefined ? document_path : null,
      newStatus || 'Draft',
      comments ?? null,
      comments ?? null,
      newStatus || 'Draft',
      id
    );

    if (Array.isArray(student_ids)) {
      db.prepare('DELETE FROM project_students WHERE project_id = ?').run(id);
      const linkStudentStmt = db.prepare('INSERT OR IGNORE INTO project_students (project_id, student_id) VALUES (?, ?)');
      for (const sId of student_ids) {
        linkStudentStmt.run(id, sId);
      }
    }

    if (Array.isArray(faculty_ids)) {
      db.prepare('DELETE FROM project_faculty WHERE project_id = ?').run(id);
      const linkFacultyStmt = db.prepare('INSERT OR IGNORE INTO project_faculty (project_id, faculty_id) VALUES (?, ?)');
      for (const fId of faculty_ids) {
        linkFacultyStmt.run(id, fId);
      }
    }

    if (existing.status !== newStatus) {
      recordApprovalHistory('projects', id, existing.status, newStatus, user.id, user.name, 'Resubmitted after edits');
    }

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({
      success: true,
      message: 'Project record updated successfully',
      record: {
        ...updated,
        recordCode: `#PRJ-${id}`
      }
    });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project record: ' + err.message });
  }
});

// DELETE /api/projects/:id - Delete project record
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project record not found' });
    }

    const role = (user.role || '').toLowerCase();
    if (role === 'faculty') {
      if (existing.submitted_by !== user.id || existing.status !== 'Draft') {
        return res.status(403).json({ error: 'Faculty can only delete their own draft records' });
      }
    } else if (role === 'hod') {
      if (!checkDepartmentAccess(user, existing.department)) {
        return res.status(403).json({ error: 'HOD cannot delete records from another department' });
      }
    }

    db.prepare('DELETE FROM project_students WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM project_faculty WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    res.json({ success: true, message: 'Project record deleted successfully' });
  } catch (err) {
    console.error('Error deleting project record:', err);
    res.status(500).json({ error: 'Failed to delete project record' });
  }
});

// POST /api/projects/:id/submit - Submit project
app.post('/api/projects/:id/submit', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project record not found' });
    }

    if (existing.submitted_by !== user.id && user.role !== 'admin' && user.role !== 'hod') {
      return res.status(403).json({ error: 'You are not authorized to submit this record' });
    }
    if (existing.status === 'Approved') {
      return res.status(400).json({ error: 'Approved records cannot be resubmitted' });
    }

    const prevStatus = existing.status;
    db.prepare(`
      UPDATE projects SET
        status = 'Pending Approval',
        submitted_at = CURRENT_TIMESTAMP,
        review_comments = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    recordApprovalHistory('projects', id, prevStatus, 'Pending Approval', user.id, user.name, 'Submitted for approval');

    res.json({ success: true, message: 'Project submitted for approval', status: 'Pending Approval' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit project for approval' });
  }
});

// POST /api/projects/:id/approve - Direct approval route
app.post('/api/projects/:id/approve', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const record = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Project record not found' });
    }

    const isHod = (user.role || '').toLowerCase() === 'hod';
    if (isHod && !checkDepartmentAccess(user, record.department)) {
      return res.status(403).json({ error: `Cannot approve record outside ${user.department}` });
    }

    if (record.submitted_by === user.id) {
      return res.status(403).json({ error: 'Anti-self-approval: You cannot approve your own submission.' });
    }

    const prev = record.status || 'Pending Approval';
    db.prepare(`
      UPDATE projects SET
        status = 'Approved',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_comments = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.name, id);

    recordApprovalHistory('projects', id, prev, 'Approved', user.id, user.name, 'Approved');

    res.json({ success: true, message: 'Project approved', status: 'Approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/request-changes - Request revisions
app.post('/api/projects/:id/request-changes', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { comments } = req.body;

    if (!comments || !comments.trim()) {
      return res.status(400).json({ error: 'Feedback comments are required when requesting changes.' });
    }

    const record = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Project record not found' });
    }

    const isHod = (user.role || '').toLowerCase() === 'hod';
    if (isHod && !checkDepartmentAccess(user, record.department)) {
      return res.status(403).json({ error: `Cannot request changes outside ${user.department}` });
    }

    if (record.submitted_by === user.id) {
      return res.status(403).json({ error: 'Anti-self-approval: You cannot review your own submission.' });
    }

    const prev = record.status || 'Pending Approval';
    db.prepare(`
      UPDATE projects SET
        status = 'Changes Requested',
        reviewed_by = ?,
        reviewed_by_name = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_comments = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.name, comments.trim(), id);

    recordApprovalHistory('projects', id, prev, 'Changes Requested', user.id, user.name, comments.trim());

    res.json({ success: true, message: 'Revisions requested', status: 'Changes Requested' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 9. APPROVAL WORKFLOW & REVIEW ENDPOINTS (HOD & Admin)
// ----------------------------------------------------

function recordApprovalHistory(recordType, recordId, prevStatus, newStatus, reviewerId, reviewerName, comment) {
  try {
    db.prepare(`
      INSERT INTO approval_history (
        record_type, record_id, previous_status, new_status, reviewer_id, reviewer_name, comment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(recordType, recordId, prevStatus || null, newStatus, reviewerId || null, reviewerName || null, comment || null);
  } catch (err) {
    console.error('[ApprovalHistory] Logging failed:', err.message);
  }
}

// GET /api/approvals/stats - Dynamic summary counts for approval cards
app.get('/api/approvals/stats', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { department, academic_year } = req.query;
    const isHod = (user.role || '').toLowerCase() === 'hod';
    const deptFilter = isHod ? user.department : (department && department !== 'All' ? department : null);
    const yearFilter = academic_year && academic_year !== 'All' ? academic_year : null;

    const buildCount = (tableName, statusVal) => {
      let q = `SELECT COUNT(*) as c FROM ${tableName} WHERE 1=1`;
      const p = [];
      if (statusVal) {
        q += ' AND status = ?';
        p.push(statusVal);
      }
      if (deptFilter) {
        q += ' AND (LOWER(department) = LOWER(?) OR department = ?)';
        p.push(deptFilter, deptFilter);
      }
      if (yearFilter) {
        q += ' AND academic_year = ?';
        p.push(yearFilter);
      }
      return db.prepare(q).get(...p).c;
    };

    const pendingAchievements = buildCount('student_achievements', 'Pending Approval');
    const pendingActivities = buildCount('activities', 'Pending Approval');
    const pendingEvents = buildCount('events', 'Pending Approval');
    const pendingPlacements = buildCount('placement_records', 'Pending Approval');
    const pendingResearch = buildCount('research_publications', 'Pending Approval');
    const pendingProjects = buildCount('projects', 'Pending Approval');

    const approvedAchievements = buildCount('student_achievements', 'Approved');
    const approvedActivities = buildCount('activities', 'Approved');
    const approvedEvents = buildCount('events', 'Approved');
    const approvedPlacements = buildCount('placement_records', 'Approved');
    const approvedResearch = buildCount('research_publications', 'Approved');
    const approvedProjects = buildCount('projects', 'Approved');

    const changesAchievements = buildCount('student_achievements', 'Changes Requested');
    const changesActivities = buildCount('activities', 'Changes Requested');
    const changesEvents = buildCount('events', 'Changes Requested');
    const changesPlacements = buildCount('placement_records', 'Changes Requested');
    const changesResearch = buildCount('research_publications', 'Changes Requested');
    const changesProjects = buildCount('projects', 'Changes Requested');

    const totalPending = pendingAchievements + pendingActivities + pendingEvents + pendingPlacements + pendingResearch + pendingProjects;
    const totalApproved = approvedAchievements + approvedActivities + approvedEvents + approvedPlacements + approvedResearch + approvedProjects;
    const totalChangesRequested = changesAchievements + changesActivities + changesEvents + changesPlacements + changesResearch + changesProjects;

    res.json({
      department: deptFilter || 'All',
      academic_year: yearFilter || 'All',
      totalPending,
      pendingAchievements,
      pendingActivities,
      pendingEvents,
      pendingPlacements,
      pendingResearch,
      pendingProjects,
      totalApproved,
      totalChangesRequested
    });
  } catch (err) {
    console.error('Error fetching approval stats:', err);
    res.status(500).json({ error: 'Failed to fetch approval statistics' });
  }
});

// GET /api/approvals/pending - Legacy endpoint kept for backward compatibility
app.get('/api/approvals/pending', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { department, academic_year } = req.query;
    const deptFilter = user.role === 'hod' ? user.department : department;

    let achQuery = "SELECT *, 'achievements' as module FROM student_achievements WHERE status = 'Pending Approval'";
    let actQuery = "SELECT *, 'activities' as module FROM activities WHERE status = 'Pending Approval'";
    let plcQuery = "SELECT *, 'placements' as module FROM placement_records WHERE status = 'Pending Approval'";
    let evQuery = "SELECT *, 'events' as module FROM events WHERE status = 'Pending Approval'";
    const params = [];

    if (deptFilter) {
      achQuery += ' AND department = ?';
      actQuery += ' AND department = ?';
      plcQuery += ' AND department = ?';
      evQuery += ' AND department = ?';
      params.push(deptFilter);
    }
    if (academic_year) {
      achQuery += ' AND academic_year = ?';
      actQuery += ' AND academic_year = ?';
      plcQuery += ' AND academic_year = ?';
      evQuery += ' AND academic_year = ?';
      params.push(academic_year);
    }

    const achievements = db.prepare(achQuery).all(...params);
    const activities = db.prepare(actQuery).all(...params);
    const placements = db.prepare(plcQuery).all(...params);
    const events = db.prepare(evQuery).all(...params);

    res.json({
      department: deptFilter || 'All',
      totalPending: achievements.length + activities.length + placements.length + events.length,
      achievements,
      activities,
      placements,
      events
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// GET /api/approvals/records - Unified multi-module approval query with filtering and pagination
app.get('/api/approvals/records', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const {
      department,
      academic_year,
      record_type,
      status,
      search,
      date_from,
      date_to,
      sort_by = 'date',
      sort_order = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const isHod = (user.role || '').toLowerCase() === 'hod';
    const deptFilter = isHod ? user.department : (department && department !== 'All' ? department : null);
    const yearFilter = academic_year && academic_year !== 'All' ? academic_year : null;
    const statusFilter = status && status !== 'all' && status !== 'All' ? status : null;
    const typeFilter = record_type && record_type !== 'all' && record_type !== 'All' ? record_type.toLowerCase() : null;

    const items = [];
    const shouldInclude = (mod) => !typeFilter || typeFilter === mod;

    // 1. Achievements
    if (shouldInclude('achievements')) {
      let q = `
        SELECT 
          id,
          'achievements' as moduleType,
          'Student Achievement' as moduleLabel,
          title,
          student_name,
          student_id as student_reg_no,
          department,
          academic_year,
          status,
          COALESCE(category, achievement_type, '') as category,
          COALESCE(level, '') as level,
          COALESCE(award, '') as award,
          date as record_date,
          COALESCE(submitted_at, created_at) as submitted_at,
          submitted_by,
          submitted_by_name,
          reviewed_by,
          reviewed_by_name,
          reviewed_at,
          review_comments,
          description,
          certificate_path as certificate_url
        FROM student_achievements WHERE 1=1
      `;
      const p = [];
      if (deptFilter) { q += ' AND (LOWER(department) = LOWER(?) OR department = ?)'; p.push(deptFilter, deptFilter); }
      if (yearFilter) { q += ' AND academic_year = ?'; p.push(yearFilter); }
      if (statusFilter) { q += ' AND status = ?'; p.push(statusFilter); }
      const rows = db.prepare(q).all(...p);
      items.push(...rows);
    }

    // 2. Activities
    if (shouldInclude('activities')) {
      let q = `
        SELECT 
          id,
          'activities' as moduleType,
          'Department Activity' as moduleLabel,
          activity_name as title,
          '' as student_name,
          '' as student_reg_no,
          department,
          academic_year,
          status,
          activity_type as category,
          venue,
          faculty_coordinator,
          date as record_date,
          COALESCE(submitted_at, created_at) as submitted_at,
          submitted_by,
          submitted_by_name,
          reviewed_by,
          reviewed_by_name,
          reviewed_at,
          review_comments,
          description,
          document_path
        FROM activities WHERE 1=1
      `;
      const p = [];
      if (deptFilter) { q += ' AND (LOWER(department) = LOWER(?) OR department = ?)'; p.push(deptFilter, deptFilter); }
      if (yearFilter) { q += ' AND academic_year = ?'; p.push(yearFilter); }
      if (statusFilter) { q += ' AND status = ?'; p.push(statusFilter); }
      const rows = db.prepare(q).all(...p);
      items.push(...rows);
    }

    // 3. Events
    if (shouldInclude('events')) {
      let q = `
        SELECT 
          id,
          'events' as moduleType,
          'Department Event' as moduleLabel,
          event_name as title,
          '' as student_name,
          '' as student_reg_no,
          department,
          academic_year,
          status,
          event_type as category,
          venue,
          organizer,
          coordinator,
          event_date as record_date,
          COALESCE(submitted_at, created_at) as submitted_at,
          submitted_by,
          submitted_by_name,
          reviewed_by,
          reviewed_by_name,
          reviewed_at,
          review_comments,
          description,
          document_path
        FROM events WHERE 1=1
      `;
      const p = [];
      if (deptFilter) { q += ' AND (LOWER(department) = LOWER(?) OR department = ?)'; p.push(deptFilter, deptFilter); }
      if (yearFilter) { q += ' AND academic_year = ?'; p.push(yearFilter); }
      if (statusFilter) { q += ' AND status = ?'; p.push(statusFilter); }
      const rows = db.prepare(q).all(...p);
      items.push(...rows);
    }

    // 4. Placements
    if (shouldInclude('placements')) {
      let q = `
        SELECT 
          pr.id,
          'placements' as moduleType,
          'Placement Record' as moduleLabel,
          (COALESCE(s.name, pr.student_name) || ' (' || pr.company_name || ')') as title,
          COALESCE(s.name, pr.student_name) as student_name,
          COALESCE(s.register_no, pr.register_no) as student_reg_no,
          pr.department,
          pr.academic_year,
          pr.status,
          pr.company_name,
          pr.job_role,
          pr.package,
          pr.placement_status,
          pr.offer_type,
          pr.location,
          pr.placement_date as record_date,
          COALESCE(pr.submitted_at, pr.created_at) as submitted_at,
          pr.submitted_by,
          pr.submitted_by_name,
          pr.reviewed_by,
          pr.reviewed_by_name,
          pr.reviewed_at,
          pr.review_comments,
          pr.offer_details as description
        FROM placement_records pr
        LEFT JOIN students s ON pr.student_id = s.id
        WHERE 1=1
      `;
      const p = [];
      if (deptFilter) { q += ' AND (LOWER(pr.department) = LOWER(?) OR pr.department = ?)'; p.push(deptFilter, deptFilter); }
      if (yearFilter) { q += ' AND pr.academic_year = ?'; p.push(yearFilter); }
      if (statusFilter) { q += ' AND pr.status = ?'; p.push(statusFilter); }
      const rows = db.prepare(q).all(...p);
      items.push(...rows);
    }

    // 5. Research & Publications
    if (shouldInclude('research')) {
      let q = `
        SELECT 
          id,
          'research' as moduleType,
          'Research & Publication' as moduleLabel,
          title,
          '' as student_name,
          '' as student_reg_no,
          department,
          academic_year,
          status,
          publication_type as category,
          research_area as venue,
          COALESCE(author_names, '') as faculty_coordinator,
          publication_date as record_date,
          COALESCE(submitted_at, created_at) as submitted_at,
          submitted_by,
          submitted_by_name,
          reviewed_by,
          reviewed_by_name,
          reviewed_at,
          review_comments,
          description,
          document_path
        FROM research_publications WHERE 1=1
      `;
      const p = [];
      if (deptFilter) { q += ' AND (LOWER(department) = LOWER(?) OR department = ?)'; p.push(deptFilter, deptFilter); }
      if (yearFilter) { q += ' AND academic_year = ?'; p.push(yearFilter); }
      if (statusFilter) { q += ' AND status = ?'; p.push(statusFilter); }
      const rows = db.prepare(q).all(...p);
      items.push(...rows);
    }

    // 6. Projects
    if (shouldInclude('projects')) {
      let q = `
        SELECT 
          id,
          'projects' as moduleType,
          'Project Management' as moduleLabel,
          project_title as title,
          '' as student_name,
          '' as student_reg_no,
          department,
          academic_year,
          status,
          project_category as category,
          project_status as venue,
          COALESCE(coordinator, '') as faculty_coordinator,
          COALESCE(start_date, '') as record_date,
          COALESCE(submitted_at, created_at) as submitted_at,
          submitted_by,
          submitted_by_name,
          reviewed_by,
          reviewed_by_name,
          reviewed_at,
          review_comments,
          description,
          document_path
        FROM projects WHERE 1=1
      `;
      const p = [];
      if (deptFilter) { q += ' AND (LOWER(department) = LOWER(?) OR department = ?)'; p.push(deptFilter, deptFilter); }
      if (yearFilter) { q += ' AND academic_year = ?'; p.push(yearFilter); }
      if (statusFilter) { q += ' AND status = ?'; p.push(statusFilter); }
      const rows = db.prepare(q).all(...p);
      items.push(...rows);
    }

    let filtered = items;

    // Search filter
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(item => {
        const codePrefix = item.moduleType === 'projects' ? 'PRJ' : item.moduleType.substring(0, 3).toUpperCase();
        const idCode = `#${codePrefix}-${item.id}`.toLowerCase();
        return (
          item.id.toString() === s ||
          idCode.includes(s) ||
          (item.title && item.title.toLowerCase().includes(s)) ||
          (item.venue && item.venue.toLowerCase().includes(s)) ||
          (item.category && item.category.toLowerCase().includes(s)) ||
          (item.student_name && item.student_name.toLowerCase().includes(s)) ||
          (item.student_reg_no && item.student_reg_no.toLowerCase().includes(s)) ||
          (item.company_name && item.company_name.toLowerCase().includes(s)) ||
          (item.faculty_coordinator && item.faculty_coordinator.toLowerCase().includes(s)) ||
          (item.submitted_by_name && item.submitted_by_name.toLowerCase().includes(s)) ||
          (item.department && item.department.toLowerCase().includes(s))
        );
      });
    }

    // Date range filter
    if (date_from) {
      filtered = filtered.filter(item => {
        const d = (item.submitted_at || item.record_date || '').split('T')[0];
        return d && d >= date_from;
      });
    }

    if (date_to) {
      filtered = filtered.filter(item => {
        const d = (item.submitted_at || item.record_date || '').split('T')[0];
        return d && d <= date_to;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sort_by === 'id') {
        comparison = a.id - b.id;
      } else if (sort_by === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sort_by === 'type') {
        comparison = (a.moduleLabel || '').localeCompare(b.moduleLabel || '');
      } else if (sort_by === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      } else {
        const dateA = a.submitted_at || a.record_date || '';
        const dateB = b.submitted_at || b.record_date || '';
        comparison = dateA.localeCompare(dateB);
      }
      return sort_order.toLowerCase() === 'asc' ? comparison : -comparison;
    });

    const total = filtered.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const paginatedRecords = filtered.slice(offset, offset + limitNum);

    const records = paginatedRecords.map(r => {
      const codePrefix = r.moduleType === 'projects' ? 'PRJ' : r.moduleType.substring(0, 3).toUpperCase();
      const code = `#${codePrefix}-${r.id}`;
      return {
        ...r,
        record_id: r.id,
        record_code: code,
        recordCode: code
      };
    });

    res.json({
      records,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  } catch (err) {
    console.error('Error fetching approval records:', err);
    res.status(500).json({ error: 'Failed to fetch approval records' });
  }
});

// GET /api/approvals/record/:module/:id - Detailed view for approval modal
app.get('/api/approvals/record/:module/:id', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { module, id } = req.params;

    let tableName;
    if (module === 'achievements') tableName = 'student_achievements';
    else if (module === 'activities') tableName = 'activities';
    else if (module === 'placements') tableName = 'placement_records';
    else if (module === 'events') tableName = 'events';
    else if (module === 'research') tableName = 'research_publications';
    else if (module === 'projects') tableName = 'projects';
    else return res.status(400).json({ error: 'Invalid module specified' });

    let record = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const isHod = (user.role || '').toLowerCase() === 'hod';
    if (isHod && !checkDepartmentAccess(user, record.department)) {
      return res.status(403).json({ error: `Access denied. You cannot view records from department '${record.department}'.` });
    }

    // Enrich record with relational data
    if (module === 'activities') {
      const students = db.prepare(`
        SELECT s.id, s.name, s.register_no, s.department
        FROM activity_students ast
        JOIN students s ON ast.student_id = s.id
        WHERE ast.activity_id = ?
      `).all(id);
      const faculty = db.prepare(`
        SELECT f.id, f.faculty_name, f.faculty_id as employee_id, f.designation, f.department
        FROM activity_faculty af
        JOIN faculty f ON af.faculty_id = f.id
        WHERE af.activity_id = ?
      `).all(id);
      record = { ...record, participating_students: students, participating_faculty: faculty, students, faculty };
    } else if (module === 'events') {
      const students = db.prepare(`
        SELECT s.id, s.name, s.register_no, s.department
        FROM event_students est
        JOIN students s ON est.student_id = s.id
        WHERE est.event_id = ?
      `).all(id);
      const faculty = db.prepare(`
        SELECT f.id, f.faculty_name, f.faculty_id as employee_id, f.designation, f.department
        FROM event_faculty ef
        JOIN faculty f ON ef.faculty_id = f.id
        WHERE ef.event_id = ?
      `).all(id);
      record = { ...record, participating_students: students, participating_faculty: faculty, students, faculty };
    } else if (module === 'placements') {
      if (record.student_id) {
        const student = db.prepare('SELECT id, name, register_no, department, academic_year as batch, current_year FROM students WHERE id = ?').get(record.student_id);
        if (student) record = { ...record, student };
      }
    } else if (module === 'research') {
      const students = db.prepare(`
        SELECT s.id, s.name, s.register_no, s.department
        FROM research_students rs
        JOIN students s ON rs.student_id = s.id
        WHERE rs.research_id = ?
      `).all(id);
      const faculty = db.prepare(`
        SELECT f.id, f.faculty_name, f.designation, f.department
        FROM research_faculty rf
        JOIN faculty f ON rf.faculty_id = f.id
        WHERE rf.research_id = ?
      `).all(id);
      record = { ...record, participating_students: students, participating_faculty: faculty, students, faculty };
    } else if (module === 'projects') {
      const students = db.prepare(`
        SELECT s.id, s.name, s.register_no, s.department
        FROM project_students ps
        JOIN students s ON ps.student_id = s.id
        WHERE ps.project_id = ?
      `).all(id);
      const faculty = db.prepare(`
        SELECT f.id, f.faculty_name, f.designation, f.department
        FROM project_faculty pf
        JOIN faculty f ON pf.faculty_id = f.id
        WHERE pf.project_id = ?
      `).all(id);
      record = { ...record, participating_students: students, participating_faculty: faculty, students, faculty };
    } else if (module === 'infrastructure') {
      const equipment = db.prepare(`SELECT * FROM facility_equipment WHERE facility_id = ? ORDER BY equipment_name ASC`).all(id);
      record = { ...record, equipment, associated_equipment: equipment };
    }

    // Query approval history
    const history = db.prepare(`
      SELECT * FROM approval_history
      WHERE record_type = ? AND record_id = ?
      ORDER BY created_at DESC
    `).all(module, id);

    res.json({
      ...record,
      record,
      history,
      moduleType: module
    });
  } catch (err) {
    console.error('Error fetching record detail for approval:', err);
    res.status(500).json({ error: 'Failed to fetch record detail' });
  }
});

// POST /api/approvals/action - Approve, Request Changes, or Reject
app.post('/api/approvals/action', requireRole(['admin', 'hod']), (req, res) => {
  try {
    const user = req.user;
    const { module, action, comments } = req.body;
    const id = req.body.id || req.body.record_id;

    if (!module || !id || !action) {
      return res.status(400).json({ error: 'Module, ID, and Action ("approve" | "request_changes" | "reject") are required' });
    }

    if (action === 'request_changes' && (!comments || !comments.trim())) {
      return res.status(400).json({ error: 'Feedback comments explaining the required changes are required' });
    }
    if (action === 'reject' && (!comments || !comments.trim())) {
      return res.status(400).json({ error: 'A rejection reason is required when rejecting a submission' });
    }

    let tableName;
    if (module === 'achievements') tableName = 'student_achievements';
    else if (module === 'activities') tableName = 'activities';
    else if (module === 'placements') tableName = 'placement_records';
    else if (module === 'events') tableName = 'events';
    else if (module === 'research') tableName = 'research_publications';
    else if (module === 'projects') tableName = 'projects';
    else return res.status(400).json({ error: 'Invalid module specified' });

    const item = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
    if (!item) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Role check: HOD can only approve their own department
    const isHod = (user.role || '').toLowerCase() === 'hod';
    if (isHod && !checkDepartmentAccess(user, item.department)) {
      return res.status(403).json({ error: `HOD of ${user.department} cannot review records for ${item.department}` });
    }

    // Security check: Prevent self-approval!
    if (item.submitted_by === user.id) {
      return res.status(403).json({ error: 'Security policy: You cannot approve your own submission.' });
    }

    let newStatus = 'Approved';
    if (action === 'request_changes') newStatus = 'Changes Requested';
    else if (action === 'reject') newStatus = 'Rejected';

    const previousStatus = item.status || 'Pending Approval';

    const cleanComment = comments ? comments.trim() : null;
    const hasReviewerComments = module === 'research' || module === 'projects' || module === 'infrastructure';
    if (hasReviewerComments) {
      db.prepare(`
        UPDATE ${tableName} SET
          status = ?,
          reviewed_by = ?,
          reviewed_by_name = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          review_comments = ?,
          reviewer_comments = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, user.id, user.name, cleanComment, cleanComment, id);
    } else {
      db.prepare(`
        UPDATE ${tableName} SET
          status = ?,
          reviewed_by = ?,
          reviewed_by_name = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          review_comments = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, user.id, user.name, cleanComment, id);
    }

    // Record audit in approval_history
    recordApprovalHistory(module, id, previousStatus, newStatus, user.id, user.name, comments ? comments.trim() : null);

    // If placement record, recalculate stats immediately
    if (module === 'placements') {
      calculatePlacementStats(item.department, item.academic_year);
    }

    const updatedRecord = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);

    res.json({
      success: true,
      message: action === 'approve'
        ? 'Record approved successfully'
        : action === 'reject'
        ? 'Record rejected'
        : 'Correction requested from faculty',
      status: newStatus,
      record: updatedRecord
    });
  } catch (err) {
    console.error('Approval action error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/approvals/history/:module/:id - Retrieve approval audit trail
app.get('/api/approvals/history/:module/:id', requireRole(['admin', 'hod', 'faculty']), (req, res) => {
  try {
    const { module, id } = req.params;
    const history = db.prepare(`
      SELECT * FROM approval_history
      WHERE record_type = ? AND record_id = ?
      ORDER BY created_at DESC
    `).all(module, id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 10. REPORT PREVIEW, READINESS & GENERATION (Using Approved Data)
// ----------------------------------------------------

function fetchReportData(departments, academicYear) {
  let targetDepts = departments;
  if (!targetDepts || targetDepts.length === 0 || targetDepts.includes('All')) {
    targetDepts = db.prepare("SELECT name FROM departments WHERE status = 'Active' OR status IS NULL ORDER BY name ASC").all().map(d => d.name);
  }
  if (!Array.isArray(targetDepts)) {
    targetDepts = [targetDepts];
  }

  const aggregated = {};

  for (const dept of targetDepts) {
    // 1. Department info
    const info = db.prepare(`
      SELECT * FROM department_reports
      WHERE (department_name = ? OR department_code = ?) AND academic_year = ?
    `).get(dept, dept, academicYear) || null;

    const deptRecord = db.prepare(`
      SELECT * FROM departments
      WHERE name = ? OR code = ?
    `).get(dept, dept) || null;

    // 2. Student Statistics (from students table)
    const deptStudents = db.prepare(`
      SELECT id, register_no, name, current_year, section, academic_year, status
      FROM students
      WHERE (department = ? OR department_id = (SELECT id FROM departments WHERE name = ? OR code = ? LIMIT 1))
        AND status = 'Active'
      ORDER BY current_year ASC, section ASC, name ASC
    `).all(dept, dept, dept);

    const totalStudents = deptStudents.length > 0 ? deptStudents.length : (info ? info.total_students : 0);

    const yearDistribution = {};
    const batchDistribution = {};
    const sectionDistribution = {};
    deptStudents.forEach(s => {
      const yr = s.current_year ? `Year ${s.current_year}` : 'Unassigned';
      yearDistribution[yr] = (yearDistribution[yr] || 0) + 1;
      const bch = s.academic_year || 'General';
      batchDistribution[bch] = (batchDistribution[bch] || 0) + 1;
      const sec = s.section ? `Section ${s.section}` : 'Section A';
      sectionDistribution[sec] = (sectionDistribution[sec] || 0) + 1;
    });

    // 3. Faculty (from faculty table)
    const faculty = db.prepare(`
      SELECT id, faculty_name, faculty_id, department, academic_year, designation, qualification, publications, research_projects, conferences_attended, awards, description, specialization
      FROM faculty
      WHERE department = ? AND academic_year = ?
      ORDER BY id ASC
    `).all(dept, academicYear);

    // 4. Student achievements (STRICTLY APPROVED ONLY)
    const studentAchievements = db.prepare(`
      SELECT * FROM student_achievements
      WHERE department = ? AND academic_year = ? AND status = 'Approved'
      ORDER BY date DESC
    `).all(dept, academicYear);

    // 5. Activities (STRICTLY APPROVED ONLY)
    const activities = db.prepare(`
      SELECT * FROM activities
      WHERE department = ? AND academic_year = ? AND status = 'Approved'
      ORDER BY date DESC
    `).all(dept, academicYear);

    // 6. Placement: calculated dynamically from individual records (matches Admin & HOD dashboard)
    const placementStats = calculatePlacementStats(dept, academicYear);

    // 7. Detailed individual placement records (STRICTLY APPROVED ONLY)
    const placementRecords = db.prepare(`
      SELECT * FROM placement_records
      WHERE department = ? AND academic_year = ? AND status = 'Approved'
      ORDER BY package DESC
    `).all(dept, academicYear);

    // 8. Events (STRICTLY APPROVED ONLY)
    const events = db.prepare(`
      SELECT * FROM events
      WHERE department = ? AND academic_year = ? AND status = 'Approved'
      ORDER BY event_date DESC
    `).all(dept, academicYear);

    // 9. Research publications (STRICTLY APPROVED ONLY)
    const research = db.prepare(`
      SELECT * FROM research_publications
      WHERE department = ? AND academic_year = ? AND status = 'Approved'
      ORDER BY publication_date DESC
    `).all(dept, academicYear);

    // 10. Projects (STRICTLY APPROVED ONLY)
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT GROUP_CONCAT(s.name, ', ') FROM project_students ps JOIN students s ON ps.student_id = s.id WHERE ps.project_id = p.id) as student_names
      FROM projects p
      WHERE p.department = ? AND p.academic_year = ? AND p.status = 'Approved'
      ORDER BY p.id DESC
    `).all(dept, academicYear);

    aggregated[dept] = {
      deptRecord,
      info: info || {
        department_name: dept,
        hod: deptRecord ? deptRecord.hod : 'Dr. Department Head',
        total_faculty: faculty.length,
        total_students: totalStudents,
        male_students: Math.round(totalStudents * 0.55),
        female_students: Math.round(totalStudents * 0.45),
        courses_count: 4,
        projects_count: projects.length,
        publications_count: research.length,
        events_count: events.length,
        academic_year: academicYear
      },
      studentStats: {
        total: totalStudents,
        yearDistribution,
        batchDistribution,
        sectionDistribution,
        studentsList: deptStudents
      },
      faculty,
      studentAchievements,
      activities,
      events,
      placement: placementStats,
      placementRecords,
      research,
      projects
    };
  }

  return aggregated;
}

function computeInstituteOverview(reportData, academicYear) {
  const depts = Object.keys(reportData);
  let totalStudents = 0;
  let totalFaculty = 0;
  let totalPlaced = 0;
  let totalAchievements = 0;
  let totalActivities = 0;
  let totalEvents = 0;
  let totalResearch = 0;
  let totalProjects = 0;

  depts.forEach(d => {
    const data = reportData[d] || {};
    totalStudents += (data.studentStats?.total || data.info?.total_students || 0);
    totalFaculty += (data.faculty?.length || data.info?.total_faculty || 0);
    totalPlaced += (data.placement?.students_placed || 0);
    totalAchievements += (data.studentAchievements?.length || 0);
    totalActivities += (data.activities?.length || 0);
    totalEvents += (data.events?.length || 0);
    totalResearch += (data.research?.length || 0);
    totalProjects += (data.projects?.length || 0);
  });

  return {
    academicYear,
    totalDepartments: depts.length,
    departmentsList: depts,
    totalStudents,
    totalFaculty,
    totalPlaced,
    totalAchievements,
    totalActivities,
    totalEvents,
    totalResearch,
    totalProjects
  };
}

function computeDepartmentSummaries(reportData) {
  return Object.entries(reportData).map(([deptName, data]) => {
    const info = data.info || {};
    const placement = data.placement || {};
    return {
      departmentName: deptName,
      departmentCode: data.deptRecord ? data.deptRecord.code : (info.department_code || deptName.substring(0, 4).toUpperCase()),
      hod: info.hod || (data.deptRecord ? data.deptRecord.hod : '-'),
      students: (data.studentStats ? data.studentStats.total : 0) || (info.total_students || 0),
      faculty: data.faculty ? data.faculty.length : (info.total_faculty || 0),
      achievements: data.studentAchievements ? data.studentAchievements.length : 0,
      activities: data.activities ? data.activities.length : 0,
      events: data.events ? data.events.length : 0,
      placedStudents: placement.students_placed || 0,
      placementPercentage: placement.placement_percentage || 0,
      highestPackage: placement.highest_package || 0,
      averagePackage: placement.average_package || 0,
      research: data.research ? data.research.length : 0,
      projects: data.projects ? data.projects.length : 0
    };
  });
}

// GET /api/reports/readiness - Check readiness summary across modules before generating report
app.get('/api/reports/readiness', requireAuth, (req, res) => {
  try {
    const academicYear = req.query.academic_year || req.query.academicYear || '2025-26';
    let deptsQuery = req.query.departments || req.query.department;
    let targetDepts = [];

    if (deptsQuery) {
      if (Array.isArray(deptsQuery)) targetDepts = deptsQuery;
      else if (typeof deptsQuery === 'string') targetDepts = deptsQuery.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Role-based Department Lockdown
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'hod') {
      const userDept = req.user.department;
      if (targetDepts.length > 0 && targetDepts.some(d => d.toLowerCase() !== (userDept || '').toLowerCase())) {
        return res.status(403).json({ error: 'HODs are only permitted to check report readiness for their assigned department' });
      }
      targetDepts = userDept ? [userDept] : [];
    } else if (userRole === 'faculty') {
      const userDept = req.user.department;
      if (targetDepts.length > 0 && targetDepts.some(d => d.toLowerCase() !== (userDept || '').toLowerCase())) {
        return res.status(403).json({ error: 'Faculty is only permitted to check report readiness for their assigned department' });
      }
      targetDepts = userDept ? [userDept] : [];
    } else if (targetDepts.length === 0 || targetDepts.includes('All')) {
      targetDepts = db.prepare("SELECT name FROM departments WHERE status = 'Active' OR status IS NULL ORDER BY name ASC").all().map(d => d.name);
    }

    // Helper to query counts by status
    const getModuleBreakdown = (tableName) => {
      let baseSql = `SELECT status, COUNT(*) as c FROM ${tableName} WHERE academic_year = ?`;
      const params = [academicYear];

      if (targetDepts.length > 0) {
        const placeholders = targetDepts.map(() => '?').join(',');
        baseSql += ` AND department IN (${placeholders})`;
        params.push(...targetDepts);
      }

      baseSql += ' GROUP BY status';
      const rows = db.prepare(baseSql).all(...params);

      let total = 0;
      let approved = 0;
      let pending = 0;
      let changesRequested = 0;
      let rejected = 0;

      rows.forEach(r => {
        const count = r.c || 0;
        total += count;
        const st = (r.status || '').toLowerCase();
        if (st === 'approved') approved += count;
        else if (st === 'pending approval' || st === 'pending' || st === 'draft') pending += count;
        else if (st === 'changes requested') changesRequested += count;
        else if (st === 'rejected') rejected += count;
      });

      const percentage = total > 0 ? Math.round((approved / total) * 100) : 100;
      return { total, approved, pending, changesRequested, rejected, percentage };
    };

    const achievements = getModuleBreakdown('student_achievements');
    const activities = getModuleBreakdown('activities');
    const events = getModuleBreakdown('events');
    const placements = getModuleBreakdown('placement_records');
    const research = getModuleBreakdown('research_publications');
    const projects = getModuleBreakdown('projects');

    const totalRecords = achievements.total + activities.total + events.total + placements.total + research.total + projects.total;
    const totalApproved = achievements.approved + activities.approved + events.approved + placements.approved + research.approved + projects.approved;
    const totalPending = achievements.pending + activities.pending + events.pending + placements.pending + research.pending + projects.pending;
    const totalChangesRequested = achievements.changesRequested + activities.changesRequested + events.changesRequested + placements.changesRequested + research.changesRequested + projects.changesRequested;

    const overallReadiness = totalRecords > 0 ? Math.round((totalApproved / totalRecords) * 100) : 100;

    const warnings = [];
    if (totalPending > 0) {
      warnings.push(`${totalPending} pending record(s) across selected sections are currently awaiting approval and will be excluded from the official report.`);
    }
    if (totalChangesRequested > 0) {
      warnings.push(`${totalChangesRequested} record(s) have 'Changes Requested' and will be excluded until re-approved.`);
    }

    res.json({
      academicYear,
      departments: targetDepts,
      sections: {
        achievements,
        activities,
        events,
        placements,
        research,
        projects
      },
      totalRecords,
      totalApproved,
      totalPending,
      totalChangesRequested,
      overallReadiness,
      warnings
    });
  } catch (err) {
    console.error('Report readiness error:', err);
    res.status(500).json({ error: 'Failed to calculate report readiness: ' + err.message });
  }
});

// POST /api/reports/preview
app.post('/api/reports/preview', requireAuth, (req, res) => {
  try {
    const { reportTitle, sectionOrder, customization } = req.body;
    const academicYear = req.body.academicYear || req.body.academic_year;
    let selectedDepartments = req.body.selectedDepartments || req.body.departments;
    if (!selectedDepartments && req.body.department) {
      selectedDepartments = [req.body.department];
    }
    if (!Array.isArray(selectedDepartments)) {
      selectedDepartments = selectedDepartments ? [selectedDepartments] : [];
    }

    // Role-based Department Lockdown
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'hod') {
      const userDept = req.user.department;
      if (selectedDepartments.length === 0 || selectedDepartments.includes('All') || selectedDepartments.some(d => d.toLowerCase() !== (userDept || '').toLowerCase())) {
        return res.status(403).json({ error: 'HODs are only permitted to generate reports for their assigned department' });
      }
      selectedDepartments = userDept ? [userDept] : [];
    } else if (userRole === 'faculty') {
      const userDept = req.user.department;
      if (selectedDepartments.length === 0 || selectedDepartments.includes('All') || selectedDepartments.some(d => d.toLowerCase() !== (userDept || '').toLowerCase())) {
        return res.status(403).json({ error: 'Faculty is only permitted to view reports for their assigned department' });
      }
      selectedDepartments = userDept ? [userDept] : [];
    } else if (selectedDepartments.length === 0 || selectedDepartments.includes('All')) {
      selectedDepartments = db.prepare("SELECT name FROM departments WHERE status = 'Active' OR status IS NULL ORDER BY name ASC").all().map(d => d.name);
    }

    let selectedSections = req.body.selectedSections || req.body.sections;
    if (selectedSections && typeof selectedSections === 'object' && !Array.isArray(selectedSections)) {
      selectedSections = Object.entries(selectedSections)
        .filter(([_, val]) => !!val)
        .map(([key]) => key);
    }
    if (!Array.isArray(selectedSections)) {
      selectedSections = selectedSections ? [selectedSections] : [];
    }
    if (selectedSections.length === 0) {
      selectedSections = [
        'Cover Page',
        'Institute Overview',
        'Department-wise Summary',
        'Department Overview',
        'Student Statistics',
        'Faculty Information',
        'Student Achievements',
        'Department Activities',
        'Events Management',
        'Placement Summary',
        'Research & Publications',
        'Projects & Innovations',
        'Conclusion'
      ];
    }

    if (!academicYear) {
      return res.status(400).json({ error: 'Academic year is required' });
    }
    if (selectedDepartments.length === 0) {
      return res.status(400).json({ error: 'At least one department must be selected' });
    }

    const reportData = fetchReportData(selectedDepartments, academicYear);
    const instituteOverview = computeInstituteOverview(reportData, academicYear);
    const departmentSummaries = computeDepartmentSummaries(reportData);

    const allResearch = Object.values(reportData).flatMap(d => d.research || []);
    const allProjects = Object.values(reportData).flatMap(d => d.projects || []);

    res.json({
      reportTitle: reportTitle || `Institutional Annual Report ${academicYear}`,
      academicYear,
      selectedDepartments,
      selectedSections,
      sectionOrder: sectionOrder || selectedSections,
      customization: customization || {},
      generatedDate: new Date().toISOString(),
      instituteOverview,
      departmentSummaries,
      data: reportData,
      departments: reportData,
      research: allResearch,
      projects: allProjects
    });
  } catch (err) {
    console.error('Preview generation error:', err);
    res.status(500).json({ error: 'Failed to generate report preview: ' + err.message });
  }
});

// POST /api/reports/generate (Generates PDF using PDFKit)
app.post('/api/reports/generate', requireAuth, async (req, res) => {
  try {
    const { reportTitle, sectionOrder, customization } = req.body;
    const academicYear = req.body.academicYear || req.body.academic_year;
    let selectedDepartments = req.body.selectedDepartments || req.body.departments || [];
    let selectedSections = req.body.selectedSections || req.body.sections || [];

    if (!Array.isArray(selectedDepartments)) {
      selectedDepartments = selectedDepartments ? [selectedDepartments] : [];
    }

    // Role-based Department Lockdown
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'hod') {
      const userDept = req.user.department;
      if (selectedDepartments.length === 0 || selectedDepartments.includes('All') || selectedDepartments.some(d => d.toLowerCase() !== (userDept || '').toLowerCase())) {
        return res.status(403).json({ error: 'HODs are only permitted to generate reports for their assigned department' });
      }
      selectedDepartments = userDept ? [userDept] : [];
    } else if (userRole === 'faculty') {
      return res.status(403).json({ error: 'Faculty members are not authorized to generate institute annual reports' });
    } else if (selectedDepartments.length === 0 || selectedDepartments.includes('All')) {
      selectedDepartments = db.prepare("SELECT name FROM departments WHERE status = 'Active' OR status IS NULL ORDER BY name ASC").all().map(d => d.name);
    }

    if (!academicYear || selectedDepartments.length === 0 || !selectedSections || selectedSections.length === 0) {
      return res.status(400).json({ error: 'Missing required configuration: academic year, departments, or sections' });
    }

    const title = reportTitle || `Institutional Annual Report ${academicYear}`;
    const reportData = fetchReportData(selectedDepartments, academicYear);

    const pdfResult = await generateAnnualReportPDF({
      reportTitle: title,
      academicYear,
      selectedDepartments,
      selectedSections,
      sectionOrder: sectionOrder || selectedSections,
      customization: customization || {},
      data: reportData
    });

    const createdBy = req.user ? (req.user.name || req.user.username || req.user.email) : 'System';

    const insertStmt = db.prepare(`
      INSERT INTO generated_reports (
        report_title, academic_year, departments, sections, file_path, file_name, file_size, created_by, status, report_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dbResult = insertStmt.run(
      title,
      academicYear,
      JSON.stringify(selectedDepartments),
      JSON.stringify(selectedSections),
      pdfResult.filePath,
      pdfResult.fileName,
      pdfResult.fileSize,
      createdBy,
      'Completed',
      'Institute Annual Report'
    );

    res.status(201).json({
      success: true,
      report: {
        id: dbResult.lastInsertRowid,
        reportTitle: title,
        academicYear,
        selectedDepartments,
        selectedSections,
        fileName: pdfResult.fileName,
        fileSize: pdfResult.fileSize,
        createdBy,
        downloadUrl: `/api/reports/${dbResult.lastInsertRowid}/download`
      }
    });
  } catch (err) {
    console.error('PDF Generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF report: ' + err.message });
  }
});

// GET /api/reports/student/summary/:id - Retrieve student profile and available approved counts for report builder
// GET /api/reports/student/readiness/:id - Alias for readiness summary audit
const handleStudentSummary = (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const academicYear = req.query.academicYear || req.query.academic_year || 'All';
    const startDate = req.query.startDate || req.query.start_date || null;
    const endDate = req.query.endDate || req.query.end_date || null;

    const student = db.prepare(`
      SELECT s.*, d.code as department_code 
      FROM students s 
      LEFT JOIN departments d ON s.department_id = d.id 
      WHERE s.id = ?
    `).get(id);

    if (!student) {
      return res.status(404).json({ error: 'Student not found in registry' });
    }

    const access = validateStudentAccess(user, student);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error });
    }

    const reportData = getStudentHistoryData(db, student.id, { academicYear, startDate, endDate });

    res.json({
      success: true,
      student: reportData.student,
      academicInfo: reportData.academicInfo,
      readiness: reportData.readiness,
      counts: {
        placements: reportData.readiness.moduleBreakdown.placements.approved,
        achievements: reportData.readiness.moduleBreakdown.achievements.approved,
        activities: reportData.readiness.moduleBreakdown.activities.approved,
        events: reportData.readiness.moduleBreakdown.events.approved,
        research: reportData.readiness.moduleBreakdown.research.approved,
        projects: reportData.readiness.moduleBreakdown.projects.approved,
        total: reportData.summaryCounts.total
      },
      summaryCounts: reportData.summaryCounts,
      placements: reportData.placements,
      achievements: reportData.achievements,
      activities: reportData.activities,
      events: reportData.events,
      research: reportData.research,
      projects: reportData.projects
    });
  } catch (err) {
    console.error('Error fetching student report summary:', err);
    res.status(500).json({ error: 'Failed to fetch student report summary: ' + err.message });
  }
};

app.get('/api/reports/student/summary/:id', requireAuth, handleStudentSummary);
app.get('/api/reports/student/readiness/:id', requireAuth, handleStudentSummary);

// POST /api/reports/student/preview - Full preview using centralized student history service
app.post('/api/reports/student/preview', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const student_id = req.body.student_id || req.body.studentId;
    const academic_year = req.body.academic_year || req.body.academicYear || req.body.year || 'All';
    const selected_sections = req.body.selected_sections || req.body.sections;
    const startDate = req.body.startDate || req.body.start_date || null;
    const endDate = req.body.endDate || req.body.end_date || null;

    if (!student_id) {
      return res.status(400).json({ error: 'Student ID is required to generate preview' });
    }

    const student = db.prepare(`
      SELECT s.*, d.code as department_code 
      FROM students s 
      LEFT JOIN departments d ON s.department_id = d.id 
      WHERE s.id = ?
    `).get(student_id);

    if (!student) {
      return res.status(404).json({ error: 'Selected student does not exist in registry' });
    }

    const access = validateStudentAccess(user, student);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error });
    }

    const sectionsToInclude = Array.isArray(selected_sections) && selected_sections.length > 0
      ? selected_sections
      : ['Student Profile', 'Academic Information', 'Placement History', 'Student Achievements', 'Department Activities', 'Events Participation', 'Research & Publications', 'Projects & Innovations'];

    const reportData = getStudentHistoryData(db, student.id, {
      academicYear: academic_year,
      startDate,
      endDate,
      sections: sectionsToInclude
    });

    const reportTitle = req.body.reportTitle || `Individual Student History Report - ${student.name} (${student.register_no})`;

    res.json({
      success: true,
      reportMode: 'student',
      reportTitle,
      student: reportData.student,
      academicYear: academic_year,
      selectedSections: sectionsToInclude,
      academicInfo: reportData.academicInfo,
      readiness: reportData.readiness,
      counts: {
        placements: reportData.readiness.moduleBreakdown.placements.approved,
        achievements: reportData.readiness.moduleBreakdown.achievements.approved,
        activities: reportData.readiness.moduleBreakdown.activities.approved,
        events: reportData.readiness.moduleBreakdown.events.approved,
        research: reportData.readiness.moduleBreakdown.research.approved,
        projects: reportData.readiness.moduleBreakdown.projects.approved,
        total: reportData.summaryCounts.total
      },
      summaryCounts: reportData.summaryCounts,
      placements: reportData.placements,
      achievements: reportData.achievements,
      activities: reportData.activities,
      events: reportData.events,
      research: reportData.research,
      projects: reportData.projects,
      data: {
        student: reportData.student,
        academicInfo: reportData.academicInfo,
        readiness: reportData.readiness,
        counts: {
          placements: reportData.readiness.moduleBreakdown.placements.approved,
          achievements: reportData.readiness.moduleBreakdown.achievements.approved,
          activities: reportData.readiness.moduleBreakdown.activities.approved,
          events: reportData.readiness.moduleBreakdown.events.approved,
          research: reportData.readiness.moduleBreakdown.research.approved,
          projects: reportData.readiness.moduleBreakdown.projects.approved,
          total: reportData.summaryCounts.total
        },
        summaryCounts: reportData.summaryCounts,
        placements: reportData.placements,
        achievements: reportData.achievements,
        activities: reportData.activities,
        events: reportData.events,
        research: reportData.research,
        projects: reportData.projects
      },
      generatedDate: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error previewing student history report:', err);
    res.status(500).json({ error: 'Failed to generate student report preview: ' + err.message });
  }
});

// POST /api/reports/student/generate - Generate individual student history PDF
app.post('/api/reports/student/generate', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const student_id = req.body.student_id || req.body.studentId;
    const academic_year = req.body.academic_year || req.body.academicYear || req.body.year || 'All';
    const selected_sections = req.body.selected_sections || req.body.sections;
    const startDate = req.body.startDate || req.body.start_date || null;
    const endDate = req.body.endDate || req.body.end_date || null;

    if (!student_id) {
      return res.status(400).json({ error: 'Student ID is required to generate individual report' });
    }

    const student = db.prepare(`
      SELECT s.*, d.code as department_code 
      FROM students s 
      LEFT JOIN departments d ON s.department_id = d.id 
      WHERE s.id = ?
    `).get(student_id);

    if (!student) {
      return res.status(404).json({ error: 'Selected student does not exist in registry' });
    }

    // Role security verification
    const access = validateStudentAccess(user, student);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error });
    }

    const yearScope = academic_year && academic_year !== 'All' ? academic_year.trim() : 'All';
    const sectionsToInclude = Array.isArray(selected_sections) && selected_sections.length > 0
      ? selected_sections
      : ['Student Profile', 'Academic Information', 'Placement History', 'Student Achievements', 'Department Activities', 'Events Participation', 'Research & Publications', 'Projects & Innovations'];

    // Retrieve approved data using centralized service
    const reportData = getStudentHistoryData(db, student.id, {
      academicYear: yearScope,
      startDate,
      endDate,
      sections: sectionsToInclude
    });

    // Generate PDF using PDFKit
    const pdfResult = await generateStudentHistoryPDF({
      student: reportData.student,
      academicYear: yearScope,
      selectedSections: sectionsToInclude,
      placements: reportData.placements,
      achievements: reportData.achievements,
      activities: reportData.activities,
      events: reportData.events,
      research: reportData.research,
      projects: reportData.projects
    });

    const reportTitle = req.body.reportTitle || `Individual Student History Report - ${student.name} (${student.register_no})`;
    const createdBy = user ? (user.name || user.username || user.email) : 'System';

    // Save report in generated_reports database table
    const insertStmt = db.prepare(`
      INSERT INTO generated_reports (
        report_title, academic_year, departments, sections, file_path, file_name, file_size, created_by, status, report_type, student_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dbResult = insertStmt.run(
      reportTitle,
      yearScope,
      JSON.stringify([student.department]),
      JSON.stringify(sectionsToInclude),
      pdfResult.filePath,
      pdfResult.fileName,
      pdfResult.fileSize,
      createdBy,
      'Completed',
      'Student History',
      student.id
    );

    res.status(201).json({
      success: true,
      report: {
        id: dbResult.lastInsertRowid,
        reportTitle,
        report_type: 'Student History',
        student_id: student.id,
        student: {
          id: student.id,
          name: student.name,
          register_no: student.register_no,
          department: student.department
        },
        academicYear: yearScope,
        selectedSections: sectionsToInclude,
        fileName: pdfResult.fileName,
        fileSize: pdfResult.fileSize,
        createdBy,
        downloadUrl: `/api/reports/${dbResult.lastInsertRowid}/download`
      }
    });
  } catch (err) {
    console.error('Student PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate Student History PDF report: ' + err.message });
  }
});

// GET /api/reports (Generated reports list with role-based visibility)
app.get('/api/reports', requireAuth, (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const userDept = (req.user.department || '').toLowerCase();
    const userName = req.user.name || req.user.username || '';

    const rows = db.prepare('SELECT * FROM generated_reports ORDER BY id DESC').all();
    const formatted = rows
      .map(r => ({
        ...r,
        departments: JSON.parse(r.departments || '[]'),
        sections: JSON.parse(r.sections || '[]'),
        downloadUrl: `/api/reports/${r.id}/download`
      }))
      .filter(r => {
        if (userRole === 'admin') return true; // Admin sees all generated reports
        if (userRole === 'hod' || userRole === 'faculty') {
          // Check if report includes user's department or was created by user
          const hasDept = r.departments.some(d => (d || '').toLowerCase() === userDept);
          const isCreator = r.created_by && (r.created_by.toLowerCase() === userName.toLowerCase() || r.created_by.toLowerCase() === req.user.email?.toLowerCase());
          return hasDept || isCreator;
        }
        return false;
      });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching generated reports:', err);
    res.status(500).json({ error: 'Failed to fetch generated reports' });
  }
});

// GET /api/reports/:id/download (CRITICAL DOWNLOAD ENDPOINT)
app.get('/api/reports/:id/download', (req, res) => {
  try {
    const { id } = req.params;
    const report = db.prepare('SELECT * FROM generated_reports WHERE id = ?').get(id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Role check if token is provided
    const user = getCurrentUser(req);
    if (user) {
      const userRole = (user.role || '').toLowerCase();
      const userDept = (user.department || '').toLowerCase();
      const userName = user.name || user.username || '';

      if (userRole === 'hod' || userRole === 'faculty') {
        const depts = JSON.parse(report.departments || '[]');
        const hasDept = depts.some(d => (d || '').toLowerCase() === userDept);
        const isCreator = report.created_by && (report.created_by.toLowerCase() === userName.toLowerCase() || report.created_by.toLowerCase() === user.email?.toLowerCase());
        if (!hasDept && !isCreator) {
          return res.status(403).json({ error: 'Access denied. You do not have permission to download this report.' });
        }
      }
    }

    const filePath = report.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report PDF file not found on disk' });
    }

    const downloadFileName = report.file_name || `Annual_Report_${report.academic_year}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Annual Report Portal backend server running on http://localhost:${PORT}`);
});
