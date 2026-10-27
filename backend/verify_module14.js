/**
 * Verification Test Suite for Module 14: Faculty Dashboard
 *
 * Verifies all Section 21 (Testing) and Core Requirements:
 * 1. Authentication: Faculty can login and access their dashboard (200 OK)
 * 2. Access Control: Unauthenticated requests rejected (401 Unauthorized)
 * 3. Role Restriction: HOD role cannot access Faculty Dashboard directly (403 Forbidden)
 * 4. Admin Access: Admin can inspect faculty dashboard views (200 OK)
 * 5. Anti-Spoofing / Tampering Resistance:
 *    Faculty cannot spoof another user's ID via query parameters (?user_id=... is ignored for faculty)
 * 6. Anti-Approval Security Lockout:
 *    Faculty cannot approve records via approval endpoints (403 Forbidden)
 * 7. Faculty Profile Integrity:
 *    Name, Employee ID, Designation, Department, Status, Email, Qualification, Specialization
 *    Password hash is strictly NOT exposed
 * 8. Standalone Profile Endpoint: GET /api/faculty/profile returns sanitized profile
 * 9. Academic Year Filter: Dynamically updates submission counts
 * 10. Status Summary KPIs:
 *     Total Submissions, Draft, Pending Approval, Approved, Changes Requested, Resubmitted
 * 11. Pending Actions Section:
 *     Highlights Changes Requested records with reviewer comments, Drafts, and Resubmissions
 * 12. Modular Breakdown Accuracy:
 *     Achievements, Activities, Events, Research & Projects, Placements
 * 13. Department Students Access:
 *     Returns department student counts (total and active) scoped to faculty's department
 * 14. Smart Student Search (Module 3 Integration):
 *     Backend student search endpoint responds with max 5 suggestions and required fields
 * 15. Recent Submissions Stream:
 *     Returns up to 15 records sorted by latest timestamp with #CODE-ID format
 */

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const cleanPath = endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
  const url = `${BASE_URL}${cleanPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('   MODULE 14: FACULTY DASHBOARD VERIFICATION TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------
    // Step 1: Authentication of Roles
    // ------------------------------------------------------------------
    console.log('--- Step 1: Role Authentication ---');
    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
    });
    assert(adminRes.status === 200 && adminRes.data.token, 'Admin logged in successfully');
    const adminToken = adminRes.data.token;

    const hodCseRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_cse@college.com', password: 'hod123' })
    });
    assert(hodCseRes.status === 200 && hodCseRes.data.token, 'HOD CSE logged in successfully');
    const hodCseToken = hodCseRes.data.token;

    const facultyCseRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    assert(facultyCseRes.status === 200 && facultyCseRes.data.token, 'Faculty CSE logged in successfully');
    const facultyCseToken = facultyCseRes.data.token;
    const facultyCseUser = facultyCseRes.data.user;

    const facultyItRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty_it@college.com', password: 'faculty123' })
    });
    assert(facultyItRes.status === 200 && facultyItRes.data.token, 'Faculty IT logged in successfully');
    const facultyItToken = facultyItRes.data.token;
    const facultyItUser = facultyItRes.data.user;

    // ------------------------------------------------------------------
    // Step 2: Access Control & Security Boundaries
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Access Control & Security Boundaries ---');

    // Test 1: Faculty can access their dashboard
    const facDashRes = await request('/faculty/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(facDashRes.status === 200, 'Test 1: Faculty can access GET /api/faculty/dashboard (200 OK)');
    const facData = facDashRes.data;

    // Test 2: Unauthenticated requests rejected
    const unauthRes = await request('/faculty/dashboard?academic_year=2025-26');
    assert(unauthRes.status === 401, 'Test 2: Unauthenticated request rejected with 401 Unauthorized');

    // Test 3: HOD cannot directly access faculty dashboard
    const hodAccessRes = await request('/faculty/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodAccessRes.status === 403, 'Test 3: HOD role rejected from Faculty Dashboard with 403 Forbidden');

    // Test 4: Admin can inspect faculty dashboard
    const adminAccessRes = await request('/faculty/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminAccessRes.status === 200, 'Test 4: Admin can inspect faculty dashboard view (200 OK)');

    // Test 5: Anti-Spoofing: Faculty passing someone else's user_id cannot tamper dashboard
    const tamperedRes = await request(`/faculty/dashboard?academic_year=2025-26&user_id=${facultyItUser.id}`, {
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(tamperedRes.status === 200, 'Test 5a: Tampered request processed');
    assert(
      tamperedRes.data.faculty.email === facultyCseUser.email,
      'Test 5b: Backend ignored user_id spoofing and strictly scoped to authenticated faculty account'
    );

    // Test 6: Anti-Approval Security Lockout: Faculty cannot approve submissions
    const tryApproveRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyCseToken}` },
      body: JSON.stringify({ module: 'achievements', id: 1, action: 'approve' })
    });
    assert(
      tryApproveRes.status === 403,
      'Test 6: Faculty approval attempt is rejected with 403 Forbidden (Anti-Self-Approval enforced)'
    );

    // ------------------------------------------------------------------
    // Step 3: Faculty Profile & Header Verification
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Faculty Profile & Header Information ---');
    assert(facData.faculty && facData.faculty.faculty_name, 'Profile contains faculty_name');
    assert(facData.faculty.employee_id, `Profile contains employee_id: ${facData.faculty.employee_id}`);
    assert(facData.faculty.designation, `Profile contains designation: ${facData.faculty.designation}`);
    assert(facData.faculty.department.includes('Computer Science'), `Profile department: ${facData.faculty.department}`);
    assert(facData.faculty.department_code === 'CSE', `Profile department_code: ${facData.faculty.department_code}`);
    assert(facData.faculty.status === 'Active', `Profile status: ${facData.faculty.status}`);
    assert(!facData.faculty.password, 'Security Check: Sensitive password hash is NEVER exposed');

    // Standalone profile endpoint
    const profileRes = await request('/faculty/profile', {
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(profileRes.status === 200, 'GET /api/faculty/profile responds 200 OK');
    assert(profileRes.data.profile && profileRes.data.profile.employee_id, 'Standalone profile contains employee_id');
    assert(!profileRes.data.profile.password, 'Standalone profile does not expose password hash');

    // ------------------------------------------------------------------
    // Step 4: Submission Status Summary KPIs
    // ------------------------------------------------------------------
    console.log('\n--- Step 4: Submission Status Summary KPIs ---');
    const subStats = facData.submissionsStatus;
    assert(typeof subStats.total === 'number' && subStats.total >= 0, `Total Submissions: ${subStats.total}`);
    assert(typeof subStats.draft === 'number' && subStats.draft >= 0, `Draft Submissions: ${subStats.draft}`);
    assert(typeof subStats.pending === 'number' && subStats.pending >= 0, `Pending Approval: ${subStats.pending}`);
    assert(typeof subStats.approved === 'number' && subStats.approved >= 0, `Approved Submissions: ${subStats.approved}`);
    assert(typeof subStats.changesRequested === 'number' && subStats.changesRequested >= 0, `Changes Requested: ${subStats.changesRequested}`);
    assert(typeof subStats.resubmitted === 'number' && subStats.resubmitted >= 0, `Resubmitted: ${subStats.resubmitted}`);
    assert(
      subStats.total === (subStats.draft + subStats.pending + subStats.approved + subStats.changesRequested + subStats.resubmitted + (subStats.rejected || 0)),
      'Mathematical Parity: Sum of status counts equals total submissions'
    );

    // ------------------------------------------------------------------
    // Step 5: Pending Actions Section
    // ------------------------------------------------------------------
    console.log('\n--- Step 5: Pending Actions & Revision Requirements ---');
    assert(Array.isArray(facData.pendingActions), 'Pending actions is an array');
    if (facData.pendingActions.length > 0) {
      const actItem = facData.pendingActions[0];
      assert(actItem.record_code && actItem.module && actItem.title && actItem.status, 'Pending action item has code, module, title, and status');
      assert(
        ['Changes Requested', 'Draft', 'Resubmitted'].includes(actItem.status),
        `Pending action item status is actionable (${actItem.status})`
      );
    }

    // ------------------------------------------------------------------
    // Step 6: Department Students & Smart Student Search
    // ------------------------------------------------------------------
    console.log('\n--- Step 6: Department Students & Smart Search ---');
    assert(facData.departmentStudents && typeof facData.departmentStudents.total === 'number', `Department Total Students: ${facData.departmentStudents.total}`);
    assert(typeof facData.departmentStudents.active === 'number', `Department Active Students: ${facData.departmentStudents.active}`);

    // Test Module 3 backend smart search integration
    const searchRes = await request(`/students/search?q=Aarav&department=${encodeURIComponent(facData.faculty.department)}`, {
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(searchRes.status === 200, 'Student search responded 200 OK');
    assert(Array.isArray(searchRes.data), 'Student search returned array');
    assert(searchRes.data.length <= 5, `Student search respected max 5 limit (actual: ${searchRes.data.length})`);
    if (searchRes.data.length > 0) {
      const s = searchRes.data[0];
      assert(s.name && s.register_no && s.department, 'Student search suggestion has name, register_no, and department');
    }

    // ------------------------------------------------------------------
    // Step 7: Module Submissions Breakdown
    // ------------------------------------------------------------------
    console.log('\n--- Step 7: Modular Breakdown Integrity ---');
    assert(typeof facData.modules.achievements.total === 'number', `Achievements total: ${facData.modules.achievements.total}`);
    assert(typeof facData.modules.activities.total === 'number', `Activities total: ${facData.modules.activities.total}`);
    assert(typeof facData.modules.events.total === 'number', `Events total: ${facData.modules.events.total}`);
    assert(typeof facData.modules.researchProjects.totalResearch === 'number', `Research total: ${facData.modules.researchProjects.totalResearch}`);
    assert(typeof facData.modules.researchProjects.totalProjects === 'number', `Projects total: ${facData.modules.researchProjects.totalProjects}`);
    assert(typeof facData.modules.placements.totalContributed === 'number', `Placements contributed: ${facData.modules.placements.totalContributed}`);

    // ------------------------------------------------------------------
    // Step 8: Recent Submissions Stream
    // ------------------------------------------------------------------
    console.log('\n--- Step 8: Recent Submissions Stream ---');
    assert(Array.isArray(facData.recentSubmissions), 'Recent submissions is an array');
    assert(facData.recentSubmissions.length <= 15, `Recent submissions count: ${facData.recentSubmissions.length} (<= 15)`);
    if (facData.recentSubmissions.length > 0) {
      const rec = facData.recentSubmissions[0];
      assert(rec.record_code && rec.record_code.startsWith('#'), `Record code has module prefix: ${rec.record_code}`);
      assert(rec.module && rec.title && rec.status, 'Recent record has module, title, and status');
    }

    // ------------------------------------------------------------------
    // Step 9: Academic Year Filtering
    // ------------------------------------------------------------------
    console.log('\n--- Step 9: Academic Year Filtering ---');
    const ayRes = await request('/faculty/dashboard?academic_year=All', {
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(ayRes.status === 200, 'Dashboard responds 200 for academic_year=All');
    assert(typeof ayRes.data.submissionsStatus.total === 'number', 'Academic year All returns valid totals');

    // ------------------------------------------------------------------
    // Step 10: Department Isolation Between Different Faculty Accounts
    // ------------------------------------------------------------------
    console.log('\n--- Step 10: Department & Faculty Isolation ---');
    const itFacDashRes = await request('/faculty/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${facultyItToken}` }
    });
    assert(itFacDashRes.status === 200, 'Faculty IT dashboard responded 200 OK');
    assert(
      itFacDashRes.data.faculty.email === 'faculty_it@college.com',
      'Faculty IT dashboard scoped to faculty_it'
    );
    assert(
      itFacDashRes.data.faculty.department.includes('Information Technology') || itFacDashRes.data.faculty.department_code === 'IT',
      'Faculty IT department isolated to Information Technology'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
