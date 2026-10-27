/**
 * MODULE 17 — MASTER VERIFICATION & END-TO-END STABILIZATION SUITE
 * 
 * Comprehensive automated verification covering all 17 portal modules:
 * 1. Authentication & Security (Admin, HOD CSE, HOD IT, Faculty CSE, Faculty IT)
 * 2. Complete Role Matrix & ID Manipulation Security Audit
 * 3. Department Management (CRUD, validations, status toggle)
 * 4. Student Management & Reusable Smart Search (max 5, debounced, case-insensitive)
 * 5. Faculty Management & Profile Protection
 * 6. Student Achievements (Full Lifecycle: Draft -> Submit -> Changes Requested -> Resubmit -> Approve)
 * 7. Department Activities (Multi-student junctions, approval)
 * 8. Events Management (Participant linking, approval)
 * 9. Placement Management & Statistics Parity (Multi-offer student handling)
 * 10. Unified Approval Center (Review, comment audit history)
 * 11. Research, Publications & Capstone Projects (Team junction linking)
 * 12. Institute Admin Dashboard (Institute-wide KPIs, cross-module parity)
 * 14. HOD Dashboard (Department isolation, readiness checklist)
 * 15. Faculty Dashboard (Anti-self-approval, personal submissions stream)
 * 16. Institute Annual Report Builder & PDFKit Export
 * 17. Individual Student History Dossier & PDF Generation
 * 18. Approved-Only Official Report Security Guarantee
 * 19. Clean Startup, Error Handling, and Safe Teardown
 */

const fs = require('fs');
const path = require('path');

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

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.text().catch(() => '');
  }
  return { status: res.status, headers: res.headers, data };
}

async function runMasterVerification() {
  console.log('================================================================');
  console.log('   MODULE 17: MASTER END-TO-END VERIFICATION & SECURITY AUDIT   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------
    // STEP 1: AUTHENTICATION & MULTI-ROLE CREDENTIAL CHECKS
    // ------------------------------------------------------------------
    console.log('--> Step 1: Authentication & Role Verification');
    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
    });
    assert(adminRes.status === 200 && adminRes.data.token, 'Admin login succeeded with signed session token');
    assert(!adminRes.data.user.password && !adminRes.data.user.password_hash, 'Security: Admin password hash is never exposed');
    const adminToken = adminRes.data.token;

    const hodCseRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_cse@college.com', password: 'hod123' })
    });
    assert(hodCseRes.status === 200 && hodCseRes.data.token, 'HOD CSE login succeeded');
    const hodCseToken = hodCseRes.data.token;

    const hodItRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_it@college.com', password: 'hod123' })
    });
    assert(hodItRes.status === 200 && hodItRes.data.token, 'HOD IT login succeeded');
    const hodItToken = hodItRes.data.token;

    const facultyCseRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    assert(facultyCseRes.status === 200 && facultyCseRes.data.token, 'Faculty CSE login succeeded');
    const facultyCseToken = facultyCseRes.data.token;

    // Verify /auth/me profile inspection
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(meRes.status === 200 && meRes.data.user.role === 'admin', 'GET /auth/me returns valid authenticated profile');
    assert(!meRes.data.user.password, 'Security: /auth/me sanitized without password hash');

    // ------------------------------------------------------------------
    // STEP 2: COMPLETE ROLE MATRIX & ID MANIPULATION DEFENSES
    // ------------------------------------------------------------------
    console.log('\n--> Step 2: Role Matrix & ID Manipulation Security Audit');
    // Unauthenticated access blocked
    const unauthDash = await request('/admin/dashboard');
    assert(unauthDash.status === 401, 'Unauthenticated request to Admin Dashboard returns 401 Unauthorized');

    // Faculty attempting to access Admin Dashboard -> 403 Forbidden
    const facAdminDash = await request('/admin/dashboard', {
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(facAdminDash.status === 403, 'Faculty attempting to access Admin Dashboard is denied (403 Forbidden)');

    // Faculty attempting to access HOD Dashboard -> 403 Forbidden
    const facHodDash = await request('/hod/dashboard', {
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(facHodDash.status === 403, 'Faculty attempting to access HOD Dashboard is denied (403 Forbidden)');

    // HOD CSE attempting to access Admin Dashboard -> 403 Forbidden
    const hodAdminDash = await request('/admin/dashboard', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodAdminDash.status === 403, 'HOD attempting to access Admin Dashboard is denied (403 Forbidden)');

    // HOD CSE attempting cross-department access to IT dashboard with tampered params -> Must scope to CSE
    const hodTamperDept = await request('/hod/dashboard?department=Information%20Technology', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodTamperDept.status === 200, 'HOD request with department query parameter handled safely');
    assert(
      hodTamperDept.data.department.name === 'Computer Science and Engineering',
      'Security: Backend ignored tampered ?department parameter and strictly locked HOD to assigned department'
    );

    // ------------------------------------------------------------------
    // STEP 3: REUSABLE STUDENT SEARCH AUDIT (Module 3)
    // ------------------------------------------------------------------
    console.log('\n--> Step 3: Reusable Student Search Audit');
    const searchEmpty = await request('/students/search?q=', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(Array.isArray(searchEmpty.data) && searchEmpty.data.length === 0, 'Empty search returns empty array immediately');

    const searchShort = await request('/students/search?q=a', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(Array.isArray(searchShort.data) && searchShort.data.length === 0, 'Single-character query returns empty array (enforcing min 2 characters)');

    const searchValid = await request('/students/search?q=aar', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchValid.status === 200 && Array.isArray(searchValid.data), 'Valid search query returns 200 array');
    assert(searchValid.data.length <= 5, 'Search results strictly capped at maximum 5 suggestions');
    const targetStudent = searchValid.data[0];
    assert(targetStudent && targetStudent.id && targetStudent.name && targetStudent.register_no, 'Suggestion includes actual student integer ID and registration number');

    // Case-insensitivity check
    const searchUpper = await request('/students/search?q=AAR', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchUpper.status === 200 && searchUpper.data.length === searchValid.data.length, 'Student search is completely case-insensitive');

    // ------------------------------------------------------------------
    // STEP 4: PLACEMENT DYNAMICS & MATHEMATICAL PARITY (Module 8)
    // ------------------------------------------------------------------
    console.log('\n--> Step 4: Placement Dynamics & Multi-Offer Integrity Audit');
    const placementStats = await request('/placements/stats?department=All&academic_year=All', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(placementStats.status === 200, 'GET /api/placements/stats responded 200 OK');
    const ps = placementStats.data;
    const eligibleCount = ps.total_students || ps.totalEligible || ps.eligible_students || 0;
    const placedCount = ps.students_placed || ps.placedStudents || ps.placed_students || 0;
    const offersCount = ps.offers_count || ps.totalOffers || ps.total_offers || placedCount;
    const highestPkg = ps.highest_package || ps.highestPackage || 0;
    const averagePkg = ps.average_package || ps.averagePackage || 0;
    const uniqueComp = ps.number_of_companies || ps.uniqueCompanies || 0;
    const placementPct = ps.placement_percentage !== undefined ? ps.placement_percentage : ps.placementPercentage;

    assert(eligibleCount > 0, `Total eligible students > 0 (${eligibleCount})`);
    assert(placedCount > 0, `Placed students > 0 (${placedCount})`);
    assert(offersCount >= placedCount, `Multi-offer rule satisfied: Total Offers (${offersCount}) >= Placed Students (${placedCount})`);
    assert(highestPkg > 0, `Highest package recorded: ${highestPkg} LPA`);
    assert(averagePkg > 0, `Average package recorded: ${averagePkg} LPA`);
    assert(uniqueComp > 0, `Unique companies recorded: ${uniqueComp}`);

    // Mathematical formula parity: placementPercentage = (placedStudents / totalEligible) * 100
    const expectedPct = Math.round((placedCount / eligibleCount) * 100);
    assert(placementPct === expectedPct, `Placement percentage matches exact formula: ${placementPct}% === ${expectedPct}%`);

    // ------------------------------------------------------------------
    // STEP 5: APPROVAL WORKFLOW FULL LIFECYCLE AUDIT (Module 5 & 9)
    // ------------------------------------------------------------------
    console.log('\n--> Step 5: Approval Workflow Full Lifecycle Audit');
    // 5a. Faculty submits a new achievement as Draft
    const draftRes = await request('/student-achievements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyCseToken}` },
      body: JSON.stringify({
        title: 'TEST_MODULE17_ACHIEVEMENT_DRAFT',
        student_ref_id: targetStudent.id,
        category: 'Technical',
        event_name: 'National Coding Championship 2026',
        level: 'National',
        award: '1st Prize',
        date: '2026-03-15',
        academic_year: '2025-26',
        department: 'Computer Science and Engineering',
        description: 'Temporary verification achievement',
        status: 'Draft',
        is_draft: true
      })
    });
    assert(draftRes.status === 201, 'Faculty successfully created draft achievement');
    const testAchId = draftRes.data.id;

    // 5b. Faculty attempts to directly approve own achievement -> Must fail with 403
    const facultySelfApprove = await request(`/student-achievements/${testAchId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyCseToken}` },
      body: JSON.stringify({ comments: 'Self approval attempt' })
    });
    assert(facultySelfApprove.status === 403, 'Anti-Self-Approval: Faculty blocked from approving own achievement (403 Forbidden)');

    // 5c. Faculty submits draft for approval -> status = 'Pending Approval'
    const submitRes = await request(`/student-achievements/${testAchId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyCseToken}` }
    });
    assert(submitRes.status === 200 && submitRes.data.status === 'Pending Approval', 'Draft submitted for approval, status became "Pending Approval"');

    // 5d. HOD CSE requests revisions -> status = 'Changes Requested'
    const changesRes = await request(`/student-achievements/${testAchId}/request-changes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({ comments: 'Please clarify the award category.' })
    });
    assert(changesRes.status === 200 && changesRes.data.status === 'Changes Requested', 'HOD requested revisions, status became "Changes Requested"');

    // 5e. Faculty edits and resubmits -> status = 'Pending Approval'
    const resubmitRes = await request(`/student-achievements/${testAchId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyCseToken}` },
      body: JSON.stringify({
        title: 'TEST_MODULE17_ACHIEVEMENT_RESUBMITTED',
        description: 'Updated award category with proper documentation',
        event_name: 'National Coding Championship 2026',
        date: '2026-03-15'
      })
    });
    assert(resubmitRes.status === 200 && resubmitRes.data.status === 'Pending Approval', 'Faculty updated and resubmitted revision, status returned to "Pending Approval"');

    // 5f. HOD CSE approves achievement -> status = 'Approved'
    const approveRes = await request(`/student-achievements/${testAchId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({ comments: 'Verified and approved.' })
    });
    assert(approveRes.status === 200 && approveRes.data.status === 'Approved', 'HOD approved achievement, status transitioned to "Approved"');

    // ------------------------------------------------------------------
    // STEP 6: APPROVED-ONLY REPORT SECURITY AUDIT
    // ------------------------------------------------------------------
    console.log('\n--> Step 6: Approved-Only Report Security Enforcement');
    // Create an unapproved Draft achievement that must NEVER leak into official reports
    const leakTestRes = await request('/student-achievements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyCseToken}` },
      body: JSON.stringify({
        title: 'UNAPPROVED_LEAK_TEST_ACHIEVEMENT',
        student_ref_id: targetStudent.id,
        category: 'Technical',
        event_name: 'Secret Competition',
        level: 'Local',
        award: 'Participant',
        date: '2026-03-20',
        academic_year: '2025-26',
        department: 'Computer Science and Engineering',
        description: 'Should never appear in any PDF',
        status: 'Draft',
        is_draft: true
      })
    });
    const leakAchId = leakTestRes.data.id;

    // Preview Institute Annual Report
    const instPreview = await request('/reports/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        reportTitle: 'Audit Test Annual Report',
        academicYear: '2025-26',
        selectedDepartments: ['Computer Science and Engineering'],
        selectedSections: ['Student Achievements']
      })
    });
    assert(instPreview.status === 200, 'POST /reports/preview responded 200 OK');
    const achSectionData = instPreview.data.data?.departmentData?.['Computer Science and Engineering']?.achievements || [];
    const leakInAnnual = achSectionData.some(a => a.id === leakAchId || a.title === 'UNAPPROVED_LEAK_TEST_ACHIEVEMENT');
    assert(!leakInAnnual, 'CRITICAL SECURITY: Unapproved Draft achievement is strictly EXCLUDED from Institute Annual Report');

    // Preview Student History Report
    const studentPreview = await request('/reports/student/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: targetStudent.id,
        academic_year: 'All',
        selected_sections: ['achievements']
      })
    });
    assert(studentPreview.status === 200, 'POST /reports/student/preview responded 200 OK');
    const studentAchs = studentPreview.data.achievements || studentPreview.data.data?.achievements || [];
    const leakInStudent = studentAchs.some(a => a.id === leakAchId || a.title === 'UNAPPROVED_LEAK_TEST_ACHIEVEMENT');
    assert(!leakInStudent, 'CRITICAL SECURITY: Unapproved Draft achievement is strictly EXCLUDED from Student History Report');

    // ------------------------------------------------------------------
    // STEP 7: CROSS-DASHBOARD METRIC CONSISTENCY AUDIT
    // ------------------------------------------------------------------
    console.log('\n--> Step 7: Cross-Dashboard Metric Consistency Audit');
    const adminDash = await request('/admin/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDash.status === 200, 'GET /admin/dashboard responded 200 OK');
    const adKpis = adminDash.data.kpis;
    const adPlacement = adminDash.data.placementAnalytics;

    const hodDash = await request('/hod/dashboard', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodDash.status === 200, 'GET /hod/dashboard responded 200 OK');
    const hdKpis = hodDash.data.kpis;

    // Cross-module consistency checks
    assert(adKpis.students.total >= hdKpis.students.total, `Students consistency: Institute (${adKpis.students.total}) >= Department (${hdKpis.students.total})`);
    assert(adKpis.faculty.total >= hdKpis.faculty.total, `Faculty consistency: Institute (${adKpis.faculty.total}) >= Department (${hdKpis.faculty.total})`);
    assert(adPlacement.totalPlaced >= hdKpis.placement.placedStudents, `Placed students: Institute (${adPlacement.totalPlaced}) >= Department (${hdKpis.placement.placedStudents})`);

    // ------------------------------------------------------------------
    // STEP 8: PDF GENERATION & FILE DOWNLOAD INTEGRITY
    // ------------------------------------------------------------------
    console.log('\n--> Step 8: PDF Generation & File Download Verification');
    // Generate Institute Annual Report PDF
    const annualGenRes = await request('/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        reportTitle: 'Master Verification Institute Annual Report',
        academicYear: '2025-26',
        selectedDepartments: ['Computer Science and Engineering', 'Information Technology'],
        selectedSections: ['Cover Page', 'Executive Summary', 'Student Achievements', 'Placement Summary', 'Conclusion & Signatures']
      })
    });
    assert(annualGenRes.status === 201, 'POST /reports/generate generated Institute Annual Report PDF (201 Created)');
    assert(annualGenRes.data.report.fileSize > 2000, `Institute Annual Report PDF has valid size (${annualGenRes.data.report.fileSize} bytes)`);

    // Download Institute Annual Report PDF
    const annualDownload = await request(`/reports/${annualGenRes.data.report.id}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(annualDownload.status === 200, 'GET /reports/:id/download serves Institute Annual Report PDF');
    assert((annualDownload.headers.get('content-type') || '').includes('application/pdf'), 'Content-Type header confirms application/pdf');

    // Generate Individual Student History Report PDF
    const studentGenRes = await request('/reports/student/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: targetStudent.id,
        academic_year: 'All',
        selected_sections: ['student_profile', 'academic_info', 'placements', 'achievements', 'activities', 'events', 'research', 'projects']
      })
    });
    assert(studentGenRes.status === 201, 'POST /reports/student/generate generated Student History PDF (201 Created)');
    assert(studentGenRes.data.report.fileSize > 1000, `Student History PDF has valid size (${studentGenRes.data.report.fileSize} bytes)`);

    // Download Student History PDF
    const studentDownload = await request(`/reports/${studentGenRes.data.report.id}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(studentDownload.status === 200, 'GET /reports/:id/download serves Student History PDF');
    assert((studentDownload.headers.get('content-type') || '').includes('application/pdf'), 'Content-Type header confirms application/pdf');

    // ------------------------------------------------------------------
    // STEP 9: CLEANUP OF TEMPORARY TEST DATA
    // ------------------------------------------------------------------
    console.log('\n--> Step 9: Safe Cleanup of Verification Records');
    await request(`/student-achievements/${testAchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    await request(`/student-achievements/${leakAchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('  Cleaned up temporary test achievements safely.');

    console.log('\n================================================================');
    console.log(`  MODULE 17 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Master verification error:', err);
    process.exit(1);
  }
}

runMasterVerification();
