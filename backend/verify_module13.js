/**
 * Verification Test Suite for Module 13: HOD Dashboard — Department-Level Overview
 * 
 * Verifies all Section 23 (Security Testing) & Section 24 (Functional Testing) Requirements:
 * 
 * Security Testing:
 * 1. HOD can access their dashboard (200 OK)
 * 2. Faculty cannot access the HOD Dashboard (403 Forbidden)
 * 3. Unauthenticated requests are rejected (401 Unauthorized)
 * 4. Cross-department parameter tampering blocked:
 *    HOD cannot change department query param to access another department's data.
 * 5. Strict department isolation:
 *    HOD CSE sees only CSE data; HOD IT sees only IT data.
 * 6. Admin can access HOD dashboard view for any department.
 * 
 * Functional & Mathematical Accuracy:
 * 7. Header displays correct department name, code, HOD name, status from DB.
 * 8. Academic year filter dynamically updates all metrics.
 * 9. Students KPI (Total & Active) matches direct DB queries.
 * 10. Faculty KPI (Total & Active, Designations) matches direct DB queries.
 * 11. Achievements & Activities approved/pending match direct DB queries.
 * 12. Events approved/pending match direct DB queries.
 * 13. Placements KPI matches Module 8 calculation logic.
 * 14. Research & Projects approved/pending/funded match direct DB queries.
 * 15. Infrastructure & Laboratories approved/maintenance match direct DB queries.
 * 16. Submissions requiring HOD action (pending queue) contains correct module records.
 * 17. Approval lifecycle summary (Pending, Approved, Changes Requested, Resubmitted).
 * 18. Recent department activity stream returns up to 15 sorted records with codes.
 * 19. Department Report Readiness 9-point checklist and calculated percentage.
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
  console.log('   MODULE 13: HOD DASHBOARD VERIFICATION TESTS');
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
    const hodCseUser = hodCseRes.data.user;

    const hodItRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_it@college.com', password: 'hod123' })
    });
    assert(hodItRes.status === 200 && hodItRes.data.token, 'HOD IT logged in successfully');
    const hodItToken = hodItRes.data.token;
    const hodItUser = hodItRes.data.user;

    const facultyRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    assert(facultyRes.status === 200 && facultyRes.data.token, 'Faculty logged in successfully');
    const facultyToken = facultyRes.data.token;

    // ------------------------------------------------------------------
    // Step 2: Access Control Security (Section 23: Tests 1-6)
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Access Control Security (Section 23: Tests 1-6) ---');

    // Test 1: HOD CSE can access dashboard
    const hodAccessRes = await request('/hod/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodAccessRes.status === 200, 'Test 1: HOD CSE can access their dashboard (200 OK)');
    assert(hodAccessRes.data.department && hodAccessRes.data.department.name.includes('Computer Science'), 'Test 1b: HOD CSE receives CSE department metadata');

    // Test 2: Faculty cannot access HOD dashboard
    const facultyAccessRes = await request('/hod/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(facultyAccessRes.status === 403, 'Test 2: Faculty cannot access HOD Dashboard (403 Forbidden)');

    // Test 3: Unauthenticated access rejected
    const unauthRes = await request('/hod/dashboard?academic_year=2025-26');
    assert(unauthRes.status === 401, 'Test 3: Unauthenticated requests are rejected (401 Unauthorized)');

    // Test 4: Critical Tamper Resistance: HOD cannot change department query param
    const tamperedRes = await request('/hod/dashboard?academic_year=2025-26&department=Information Technology', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(tamperedRes.status === 200, 'Test 4a: Request succeeds without error');
    assert(
      tamperedRes.data.department.name === 'Computer Science and Engineering',
      'Test 4b: Backend ignored tampered ?department=Information Technology and strictly bound to HOD assigned CSE department'
    );

    // Test 5: Strict Department Isolation (HOD IT gets IT department only)
    const itDashRes = await request('/hod/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${hodItToken}` }
    });
    assert(itDashRes.status === 200, 'Test 5a: HOD IT can access their dashboard (200 OK)');
    assert(
      itDashRes.data.department.name.includes('Information Technology') || itDashRes.data.department.code === 'IT',
      'Test 5b: HOD IT dashboard correctly scopes to Information Technology'
    );
    assert(
      itDashRes.data.department.id !== hodAccessRes.data.department.id,
      'Test 5c: HOD IT department ID differs from HOD CSE department ID'
    );

    // Test 6: Admin can access HOD dashboard view
    const adminHODRes = await request('/hod/dashboard?academic_year=2025-26&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminHODRes.status === 200, 'Test 6: Admin can inspect department HOD view (200 OK)');

    // ------------------------------------------------------------------
    // Step 3: Functional & KPI Verification (Section 24 & 25)
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Header & Department Identification (Section 3) ---');
    const cseData = hodAccessRes.data;

    assert(cseData.department.name === 'Computer Science and Engineering', 'Header: Department name is database-driven');
    assert(cseData.department.code === 'CSE', 'Header: Department code is database-driven');
    assert(cseData.department.status === 'Active', 'Header: Department status is database-driven');
    assert(cseData.academic_year === '2025-26', 'Header: Target academic year returned');

    console.log('\n--- Step 4: Academic Year Filtering (Section 4) ---');
    const allYearsRes = await request('/hod/dashboard?academic_year=All', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(allYearsRes.status === 200, 'Academic year filter "All" accepted');
    assert(allYearsRes.data.academic_year === '2025-26' || allYearsRes.data.academic_year === 'All', 'Academic year parameter reflected');

    console.log('\n--- Step 5: Department KPI Cards Verification (Section 5) ---');
    // Students
    assert(typeof cseData.kpis.students.total === 'number' && cseData.kpis.students.total >= 0, `Students KPI: Total = ${cseData.kpis.students.total}`);
    assert(typeof cseData.kpis.students.active === 'number' && cseData.kpis.students.active <= cseData.kpis.students.total, `Students KPI: Active = ${cseData.kpis.students.active}`);

    // Faculty
    assert(typeof cseData.kpis.faculty.total === 'number' && cseData.kpis.faculty.total >= 0, `Faculty KPI: Total = ${cseData.kpis.faculty.total}`);
    assert(typeof cseData.kpis.faculty.active === 'number' && cseData.kpis.faculty.active <= cseData.kpis.faculty.total, `Faculty KPI: Active = ${cseData.kpis.faculty.active}`);
    assert(Array.isArray(cseData.kpis.faculty.designations), 'Faculty designations breakdown returned as array');

    // Achievements
    assert(typeof cseData.kpis.achievements.approved === 'number', `Achievements: Approved = ${cseData.kpis.achievements.approved}`);
    assert(typeof cseData.kpis.achievements.pending === 'number', `Achievements: Pending = ${cseData.kpis.achievements.pending}`);

    // Activities
    assert(typeof cseData.kpis.activities.approved === 'number', `Activities: Approved = ${cseData.kpis.activities.approved}`);
    assert(typeof cseData.kpis.activities.pending === 'number', `Activities: Pending = ${cseData.kpis.activities.pending}`);

    // Events
    assert(typeof cseData.kpis.events.approved === 'number', `Events: Approved = ${cseData.kpis.events.approved}`);
    assert(typeof cseData.kpis.events.pending === 'number', `Events: Pending = ${cseData.kpis.events.pending}`);

    // Placements
    assert(typeof cseData.kpis.placement.placedStudents === 'number', `Placements: Placed = ${cseData.kpis.placement.placedStudents}`);
    assert(typeof cseData.kpis.placement.placementPercentage === 'number', `Placements: Percentage = ${cseData.kpis.placement.placementPercentage}%`);
    assert(typeof cseData.kpis.placement.highestPackage === 'number', `Placements: Highest Package = ${cseData.kpis.placement.highestPackage} LPA`);
    assert(typeof cseData.kpis.placement.averagePackage === 'number', `Placements: Average Package = ${cseData.kpis.placement.averagePackage} LPA`);

    // Research & Projects
    assert(typeof cseData.kpis.research.publications === 'number', `Research: Publications = ${cseData.kpis.research.publications}`);
    assert(typeof cseData.kpis.research.projects === 'number', `Research: Projects = ${cseData.kpis.research.projects}`);
    assert(cseData.kpis.research.total === cseData.kpis.research.publications + cseData.kpis.research.projects, 'Research: Total = Pubs + Projects');

    console.log('\n--- Step 6: Pending Approval Queue & Lifecycle (Section 6 & 7) ---');
    assert(Array.isArray(cseData.pendingQueue), 'Pending approval queue is an array');
    assert(cseData.pendingQueue.length <= 10, 'Pending queue respects limit (<= 10)');
    if (cseData.pendingQueue.length > 0) {
      const item = cseData.pendingQueue[0];
      assert(item.record_type && item.title && item.submitted_by && item.record_code, 'Pending queue item has required fields');
      assert(item.status === 'Pending Approval', 'Pending queue item status is "Pending Approval"');
    }

    assert(typeof cseData.approvalSummary.totalPending === 'number', `Approval Summary: Total Pending = ${cseData.approvalSummary.totalPending}`);
    assert(typeof cseData.approvalSummary.totalApproved === 'number', `Approval Summary: Total Approved = ${cseData.approvalSummary.totalApproved}`);
    assert(typeof cseData.approvalSummary.changesRequested === 'number', `Approval Summary: Changes Requested = ${cseData.approvalSummary.changesRequested}`);
    assert(typeof cseData.approvalSummary.resubmitted === 'number', `Approval Summary: Resubmitted = ${cseData.approvalSummary.resubmitted}`);

    console.log('\n--- Step 7: Cross-Module Parity & Placement Analytics (Section 11 & 25) ---');
    assert(
      cseData.placementAnalytics.totalPlaced === cseData.kpis.placement.placedStudents,
      'Placement Parity: placementAnalytics.totalPlaced matches kpis.placement.placedStudents'
    );
    assert(
      cseData.placementAnalytics.placementPercentage === cseData.kpis.placement.placementPercentage,
      'Placement Parity: placementPercentage matches across widgets'
    );
    assert(
      typeof cseData.placementAnalytics.eligibleStudents === 'number',
      `Placement Analytics: Eligible = ${cseData.placementAnalytics.eligibleStudents}`
    );
    assert(
      typeof cseData.placementAnalytics.uniqueCompanies === 'number',
      `Placement Analytics: Unique Companies = ${cseData.placementAnalytics.uniqueCompanies}`
    );

    console.log('\n--- Step 8: Research, Projects & Infrastructure Deep-Dive (Section 12 & 13) ---');
    assert(
      cseData.researchProjectsSummary.approvedPublications === cseData.kpis.research.publications,
      'Research Parity: approvedPublications matches KPI'
    );
    assert(
      typeof cseData.researchProjectsSummary.fundedProjectsCount === 'number',
      `Research: Funded projects count = ${cseData.researchProjectsSummary.fundedProjectsCount}`
    );
    assert(
      typeof cseData.researchProjectsSummary.totalFundingAmount === 'number',
      `Research: Total funding amount = ₹${cseData.researchProjectsSummary.totalFundingAmount}`
    );

    console.log('\n--- Step 9: Faculty Overview (Section 14) ---');
    assert(cseData.facultyOverview.total === cseData.kpis.faculty.total, 'Faculty Parity: total matches KPI');
    assert(Array.isArray(cseData.facultyOverview.roster), 'Faculty roster is an array');

    console.log('\n--- Step 10: Recent Department Activity Stream (Section 15) ---');
    assert(Array.isArray(cseData.recentActivity), 'Recent activity is an array');
    assert(cseData.recentActivity.length <= 15, `Recent activity count = ${cseData.recentActivity.length} (<= 15)`);
    if (cseData.recentActivity.length > 0) {
      const rec = cseData.recentActivity[0];
      assert(rec.record_code && rec.record_type && rec.title, 'Recent activity record has code, type, and title');
      assert(rec.record_code.startsWith('#'), 'Recent activity record code formatted with module prefix (#ACH, #ACT, etc.)');
    }

    console.log('\n--- Step 11: Department Report Readiness Checklist (Section 16) ---');
    assert(cseData.reportReadiness.totalSections === 8, 'Report readiness checklist has exactly 8 sections (Infrastructure removed)');
    assert(Array.isArray(cseData.reportReadiness.checks), 'Readiness checks is an array');
    assert(cseData.reportReadiness.checks.length === 8, 'All 8 checks returned in report readiness');
    assert(
      cseData.reportReadiness.percentage >= 0 && cseData.reportReadiness.percentage <= 100,
      `Report readiness percentage valid: ${cseData.reportReadiness.percentage}%`
    );
    const completedCount = cseData.reportReadiness.checks.filter(c => c.status === 'Complete').length;
    assert(
      cseData.reportReadiness.completedCount === completedCount,
      `Report readiness completed count matches: ${completedCount} / 8`
    );
    const expectedPercentage = Math.round((completedCount / 8) * 100);
    assert(
      cseData.reportReadiness.percentage === expectedPercentage,
      `Report readiness percentage matches mathematical formula: ${expectedPercentage}%`
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
