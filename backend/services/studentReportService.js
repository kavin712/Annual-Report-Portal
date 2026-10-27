/**
 * Student Report Service
 * Module 16: Individual Student History PDF & Data Engine
 *
 * Implements centralized data service:
 * getStudentHistoryData(db, studentId, options)
 *
 * Enforces:
 * 1. Strict Student ID foreign-key relationships (NEVER name or register number text matching)
 * 2. Database -> Approved Records Only for official report presentation
 * 3. Complete readiness breakdown (total, approved, pending, changes requested)
 * 4. Academic year and date-range filtering
 * 5. Role-based department access boundaries
 */

/**
 * Validates role-based permission to view/generate report for a student
 * @param {Object} user - Authenticated user object from req.user
 * @param {Object} student - Student record from DB
 * @returns {{ allowed: boolean, error?: string, status?: number }}
 */
function validateStudentAccess(user, student) {
  if (!user) {
    return { allowed: false, status: 401, error: 'Authentication required. Please log in.' };
  }

  if (!student) {
    return { allowed: false, status: 404, error: 'Student record not found in registry.' };
  }

  const role = (user.role || '').toLowerCase();
  if (role === 'admin') {
    return { allowed: true }; // Admin has global access to all students
  }

  const userDept = (user.department || '').trim().toLowerCase();
  const studentDept = (student.department || '').trim().toLowerCase();

  if (role === 'hod') {
    if (userDept !== studentDept) {
      return {
        allowed: false,
        status: 403,
        error: `Access denied. HOD of '${user.department}' is not authorized to access students from '${student.department}'.`
      };
    }
    return { allowed: true };
  }

  if (role === 'faculty') {
    if (userDept !== studentDept) {
      return {
        allowed: false,
        status: 403,
        error: `Access denied. Faculty member from '${user.department}' cannot access students from '${student.department}'.`
      };
    }
    return { allowed: true };
  }

  return { allowed: false, status: 403, error: 'Access denied. Insufficient role permissions.' };
}

/**
 * Centralized Student History Data Engine
 * Used consistently across:
 * - Readiness Audit API
 * - Interactive Preview API
 * - PDF Generation Service
 *
 * @param {Object} db - SQLite database instance
 * @param {number|string} studentId - Student primary key ID
 * @param {Object} options - { academicYear, startDate, endDate, sections }
 * @returns {Object} Structured student history report data
 */
function getStudentHistoryData(db, studentId, options = {}) {
  const numericId = parseInt(studentId, 10);
  if (isNaN(numericId)) {
    throw new Error('Valid numeric Student ID is required.');
  }

  // 1. Fetch Student Profile with department details
  const student = db.prepare(`
    SELECT s.*, d.code as department_code, d.name as department_name, d.hod as department_hod
    FROM students s
    LEFT JOIN departments d ON (s.department_id = d.id OR LOWER(s.department) = LOWER(d.name))
    WHERE s.id = ?
  `).get(numericId);

  if (!student) {
    throw new Error(`Student with ID ${numericId} was not found.`);
  }

  const academicYear = options.academicYear && options.academicYear !== 'All' ? options.academicYear.trim() : 'All';
  const startDate = options.startDate ? options.startDate.trim() : null;
  const endDate = options.endDate ? options.endDate.trim() : null;
  const requestedSections = Array.isArray(options.sections) && options.sections.length > 0 ? options.sections : null;

  // ----------------------------------------------------
  // Helper: Query readiness counters (total, approved, pending, changes requested, rejected)
  // Strictly by Student ID
  // ----------------------------------------------------
  const getReadinessCounters = () => {
    const yClause = academicYear !== 'All' ? ' AND academic_year = ?' : '';
    const yParams = academicYear !== 'All' ? [academicYear] : [];

    // Achievements
    const achRows = db.prepare(`
      SELECT status, COUNT(*) as c
      FROM student_achievements
      WHERE student_ref_id = ?${yClause}
      GROUP BY status
    `).all(numericId, ...yParams);

    // Activities (junction or direct reference)
    const actRows = db.prepare(`
      SELECT a.status, COUNT(DISTINCT a.id) as c
      FROM activities a
      LEFT JOIN activity_students ast ON a.id = ast.activity_id
      WHERE (ast.student_id = ? OR a.student_ref_id = ?)${yClause.replace('academic_year', 'a.academic_year')}
      GROUP BY a.status
    `).all(numericId, numericId, ...yParams);

    // Events (junction)
    const evtRows = db.prepare(`
      SELECT e.status, COUNT(DISTINCT e.id) as c
      FROM events e
      JOIN event_students est ON e.id = est.event_id
      WHERE est.student_id = ?${yClause.replace('academic_year', 'e.academic_year')}
      GROUP BY e.status
    `).all(numericId, ...yParams);

    // Placements
    const plcRows = db.prepare(`
      SELECT status, COUNT(*) as c
      FROM placement_records
      WHERE student_id = ?${yClause}
      GROUP BY status
    `).all(numericId, ...yParams);

    // Research
    const resRows = db.prepare(`
      SELECT r.status, COUNT(DISTINCT r.id) as c
      FROM research_publications r
      JOIN research_students rs ON r.id = rs.research_id
      WHERE rs.student_id = ?${yClause.replace('academic_year', 'r.academic_year')}
      GROUP BY r.status
    `).all(numericId, ...yParams);

    // Projects
    const prjRows = db.prepare(`
      SELECT p.status, COUNT(DISTINCT p.id) as c
      FROM projects p
      JOIN project_students ps ON p.id = ps.project_id
      WHERE ps.student_id = ?${yClause.replace('academic_year', 'p.academic_year')}
      GROUP BY p.status
    `).all(numericId, ...yParams);

    const parseRows = (rows) => {
      let total = 0, approved = 0, pending = 0, changesRequested = 0, rejected = 0;
      rows.forEach(r => {
        const count = r.c || 0;
        total += count;
        const st = (r.status || '').toLowerCase();
        if (st === 'approved') approved += count;
        else if (st === 'pending approval' || st === 'pending' || st === 'draft') pending += count;
        else if (st === 'changes requested') changesRequested += count;
        else if (st === 'rejected') rejected += count;
      });
      return { total, approved, pending, changesRequested, rejected };
    };

    const achievements = parseRows(achRows);
    const activities = parseRows(actRows);
    const events = parseRows(evtRows);
    const placements = parseRows(plcRows);
    const research = parseRows(resRows);
    const projects = parseRows(prjRows);

    const totalRecords = achievements.total + activities.total + events.total + placements.total + research.total + projects.total;
    const totalApproved = achievements.approved + activities.approved + events.approved + placements.approved + research.approved + projects.approved;
    const totalPending = achievements.pending + activities.pending + events.pending + placements.pending + research.pending + projects.pending;
    const totalChangesRequested = achievements.changesRequested + activities.changesRequested + events.changesRequested + placements.changesRequested + research.changesRequested + projects.changesRequested;

    const readinessPct = totalRecords > 0 ? Math.round((totalApproved / totalRecords) * 100) : 100;

    return {
      totalRecords,
      totalApproved,
      totalPending,
      totalChangesRequested,
      readinessPct,
      achievements,
      activities,
      events,
      placements,
      research,
      projects,
      moduleBreakdown: {
        achievements,
        activities,
        events,
        placements,
        research,
        projects
      }
    };
  };

  const readiness = getReadinessCounters();

  // ----------------------------------------------------
  // Query 1: Approved Placements
  // Strictly student_id = ? AND status = 'Approved'
  // ----------------------------------------------------
  let plcSql = `
    SELECT *
    FROM placement_records
    WHERE student_id = ? AND status = 'Approved'
  `;
  const plcParams = [numericId];
  if (academicYear !== 'All') {
    plcSql += ' AND academic_year = ?';
    plcParams.push(academicYear);
  }
  plcSql += ' ORDER BY package DESC, id DESC';
  const placements = db.prepare(plcSql).all(...plcParams);

  // ----------------------------------------------------
  // Query 2: Approved Achievements
  // Strictly student_ref_id = ? AND status = 'Approved'
  // ----------------------------------------------------
  let achSql = `
    SELECT *
    FROM student_achievements
    WHERE student_ref_id = ? AND status = 'Approved'
  `;
  const achParams = [numericId];
  if (academicYear !== 'All') {
    achSql += ' AND academic_year = ?';
    achParams.push(academicYear);
  }
  if (startDate) {
    achSql += ' AND date >= ?';
    achParams.push(startDate);
  }
  if (endDate) {
    achSql += ' AND date <= ?';
    achParams.push(endDate);
  }
  achSql += ' ORDER BY date DESC, id DESC';
  const achievements = db.prepare(achSql).all(...achParams);

  // ----------------------------------------------------
  // Query 3: Approved Department Activities
  // Linked by Student ID junction or ref
  // ----------------------------------------------------
  let actSql = `
    SELECT DISTINCT a.*
    FROM activities a
    LEFT JOIN activity_students ast ON a.id = ast.activity_id
    WHERE (ast.student_id = ? OR a.student_ref_id = ?)
      AND a.status = 'Approved'
  `;
  const actParams = [numericId, numericId];
  if (academicYear !== 'All') {
    actSql += ' AND a.academic_year = ?';
    actParams.push(academicYear);
  }
  if (startDate) {
    actSql += ' AND a.date >= ?';
    actParams.push(startDate);
  }
  if (endDate) {
    actSql += ' AND a.date <= ?';
    actParams.push(endDate);
  }
  actSql += ' ORDER BY a.date DESC, a.id DESC';
  const activities = db.prepare(actSql).all(...actParams);

  // ----------------------------------------------------
  // Query 4: Approved Events Participation
  // Strictly event_students junction by student_id
  // ----------------------------------------------------
  let evtSql = `
    SELECT DISTINCT e.*
    FROM events e
    JOIN event_students est ON e.id = est.event_id
    WHERE est.student_id = ?
      AND e.status = 'Approved'
  `;
  const evtParams = [numericId];
  if (academicYear !== 'All') {
    evtSql += ' AND e.academic_year = ?';
    evtParams.push(academicYear);
  }
  if (startDate) {
    evtSql += ' AND e.event_date >= ?';
    evtParams.push(startDate);
  }
  if (endDate) {
    evtSql += ' AND e.event_date <= ?';
    evtParams.push(endDate);
  }
  evtSql += ' ORDER BY e.event_date DESC, e.id DESC';
  const events = db.prepare(evtSql).all(...evtParams);

  // ----------------------------------------------------
  // Query 5: Approved Research Publications & Patents
  // Strictly research_students junction by student_id
  // ----------------------------------------------------
  let resSql = `
    SELECT DISTINCT r.*
    FROM research_publications r
    JOIN research_students rs ON r.id = rs.research_id
    WHERE rs.student_id = ?
      AND r.status = 'Approved'
  `;
  const resParams = [numericId];
  if (academicYear !== 'All') {
    resSql += ' AND r.academic_year = ?';
    resParams.push(academicYear);
  }
  if (startDate) {
    resSql += ' AND r.publication_date >= ?';
    resParams.push(startDate);
  }
  if (endDate) {
    resSql += ' AND r.publication_date <= ?';
    resParams.push(endDate);
  }
  resSql += ' ORDER BY r.publication_date DESC, r.id DESC';
  const research = db.prepare(resSql).all(...resParams);

  // ----------------------------------------------------
  // Query 6: Approved Projects & Innovations
  // Strictly project_students junction by student_id
  // ----------------------------------------------------
  let prjSql = `
    SELECT DISTINCT p.*,
      (SELECT GROUP_CONCAT(s2.name, ', ')
       FROM project_students ps2
       JOIN students s2 ON ps2.student_id = s2.id
       WHERE ps2.project_id = p.id) as team_members
    FROM projects p
    JOIN project_students ps ON p.id = ps.project_id
    WHERE ps.student_id = ?
      AND p.status = 'Approved'
  `;
  const prjParams = [numericId];
  if (academicYear !== 'All') {
    prjSql += ' AND p.academic_year = ?';
    prjParams.push(academicYear);
  }
  prjSql += ' ORDER BY p.id DESC';
  const projects = db.prepare(prjSql).all(...prjParams);

  // Curricular & Academic Affiliation metadata
  const currentYearNum = parseInt(student.current_year, 10) || 1;
  const yearSuffix = currentYearNum === 1 ? 'st' : currentYearNum === 2 ? 'nd' : currentYearNum === 3 ? 'rd' : 'th';

  const academicInfo = {
    program: 'Bachelor of Technology (B.Tech)',
    department: student.department,
    departmentCode: student.department_code || 'DEPT',
    batch: student.academic_year || 'Regular Program',
    currentYear: `${currentYearNum}${yearSuffix} Year`,
    section: student.section ? `Section ${student.section}` : 'Section A',
    status: student.status || 'Active',
    recordsAvailable: true,
    institution: 'Excellence Institute of Technology'
  };

  return {
    student,
    filters: {
      academicYear,
      startDate,
      endDate,
      sections: requestedSections
    },
    academicInfo,
    readiness,
    // Approved records arrays
    placements,
    achievements,
    activities,
    events,
    research,
    projects,
    summaryCounts: {
      placements: placements.length,
      achievements: achievements.length,
      activities: activities.length,
      events: events.length,
      research: research.length,
      projects: projects.length,
      total: placements.length + achievements.length + activities.length + events.length + research.length + projects.length
    }
  };
}

module.exports = {
  getStudentHistoryData,
  validateStudentAccess
};
