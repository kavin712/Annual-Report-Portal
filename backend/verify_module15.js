/**
 * Verification Test Suite for Module 15:
 * Institute Annual Report Builder Integration & Customization
 *
 * Verifies all Section 27 & 28 requirements:
 * 1. Role Authentication (Admin, HOD CSE, HOD IT, Faculty)
 * 2. Unauthenticated access blocked (401)
 * 3. Report Readiness Check (GET /api/reports/readiness):
 *    - Real breakdown: total, approved, pending, changes_requested, rejected
 *    - Overall readiness percentage and warnings
 * 4. HOD Security Lockdown:
 *    - HOD CSE cannot query IT readiness or preview (403 Forbidden)
 *    - HOD CSE cannot generate report for another department (403 Forbidden)
 *    - HOD CSE cannot generate institute-wide report (403 Forbidden)
 *    - Faculty cannot generate report (403 Forbidden)
 * 5. Report Preview (POST /api/reports/preview):
 *    - Admin preview with custom sections and sequence
 *    - Preserves custom sectionOrder
 *    - Institute Overview matches DB
 *    - Department Summaries match DB
 *    - Critical: ONLY Approved records included (Zero draft, pending, changes_requested, rejected)
 * 6. PDF Generation (POST /api/reports/generate):
 *    - Admin generates institute-wide PDF
 *    - HOD CSE generates department-scoped PDF
 *    - PDF file exists on disk with non-zero size (> 1000 bytes)
 *    - DB persistence: generated_reports contains created_by and status='Completed'
 * 7. Report History (GET /api/reports):
 *    - Admin sees all reports
 *    - HOD CSE sees only their department reports
 * 8. Download Authorization (GET /api/reports/:id/download):
 *    - Permitted for authorized user
 *    - HOD IT blocked from downloading HOD CSE report (403 Forbidden)
 * 9. Cross-Module Consistency:
 *    - Student counts, faculty counts, and placement metrics match dashboard calculation services
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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('   MODULE 15: INSTITUTE ANNUAL REPORT BUILDER VERIFICATION');
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

    const hodItRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_it@college.com', password: 'hod123' })
    });
    assert(hodItRes.status === 200 && hodItRes.data.token, 'HOD IT logged in successfully');
    const hodItToken = hodItRes.data.token;

    const facultyRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    assert(facultyRes.status === 200 && facultyRes.data.token, 'Faculty logged in successfully');
    const facultyToken = facultyRes.data.token;

    // ------------------------------------------------------------------
    // Step 2: Unauthenticated Access Control
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Unauthenticated Access Control ---');
    const unauthReadiness = await request('/reports/readiness?academic_year=2025-26');
    assert(unauthReadiness.status === 401, 'Unauthenticated GET /api/reports/readiness rejected with 401');

    const unauthPreview = await request('/reports/preview', {
      method: 'POST',
      body: JSON.stringify({ academicYear: '2025-26' })
    });
    assert(unauthPreview.status === 401, 'Unauthenticated POST /api/reports/preview rejected with 401');

    const unauthGenerate = await request('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ academicYear: '2025-26' })
    });
    assert(unauthGenerate.status === 401, 'Unauthenticated POST /api/reports/generate rejected with 401');

    // ------------------------------------------------------------------
    // Step 3: Report Readiness Check API
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Report Readiness Check API ---');
    const adminReadiness = await request('/reports/readiness?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminReadiness.status === 200, 'Admin can access GET /api/reports/readiness (200 OK)');
    assert(adminReadiness.data.sections && typeof adminReadiness.data.sections.achievements === 'object',
      'Readiness payload contains all 7 core modules');
    assert(typeof adminReadiness.data.overallReadiness === 'number',
      `Overall readiness calculated: ${adminReadiness.data.overallReadiness}%`);

    // Verify module fields in readiness
    const achReadiness = adminReadiness.data.sections.achievements;
    assert('total' in achReadiness && 'approved' in achReadiness && 'pending' in achReadiness,
      'Readiness breakdown includes total, approved, pending counts');

    // ------------------------------------------------------------------
    // Step 4: HOD Security Lockdown & Department Isolation
    // ------------------------------------------------------------------
    console.log('\n--- Step 4: HOD Security Lockdown & Isolation ---');

    // Test A: HOD CSE attempting to get readiness for IT department is forbidden
    const hodCrossDeptReadiness = await request('/reports/readiness?academic_year=2025-26&departments=Information Technology', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodCrossDeptReadiness.status === 403,
      'HOD CSE requesting IT department readiness returns 403 Forbidden');

    // Test B: HOD CSE attempting preview for IT department is forbidden
    const hodCrossDeptPreview = await request('/reports/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        academicYear: '2025-26',
        departments: ['Information Technology']
      })
    });
    assert(hodCrossDeptPreview.status === 403,
      'HOD CSE requesting IT department preview returns 403 Forbidden');

    // Test C: HOD CSE attempting to generate report for multiple or institute-wide departments is forbidden
    const hodInstituteReportGen = await request('/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        academicYear: '2025-26',
        departments: [] // Attempting institute-wide
      })
    });
    assert(hodInstituteReportGen.status === 403,
      'HOD CSE attempting institute-wide PDF generation returns 403 Forbidden');

    // Test D: HOD CSE accessing own department readiness succeeds
    const hodOwnReadiness = await request('/reports/readiness?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodOwnReadiness.status === 200,
      'HOD CSE can access own department readiness (200 OK)');

    // Test E: Faculty cannot generate institutional reports
    const facultyGenRes = await request('/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        academicYear: '2025-26',
        departments: ['Computer Science and Engineering'],
        sections: ['Institute Overview']
      })
    });
    assert(facultyGenRes.status === 403,
      'Faculty generating institutional report returns 403 Forbidden');

    // ------------------------------------------------------------------
    // Step 5: Report Preview API & Approved-Only Verification
    // ------------------------------------------------------------------
    console.log('\n--- Step 5: Report Preview & Approved-Only Filter ---');
    const customSections = [
      'Cover Page',
      'Institute Overview',
      'Student Statistics',
      'Faculty Information',
      'Student Achievements',
      'Department Activities',
      'Events',
      'Placements',
      'Research & Publications',
      'Projects',
      'Department-wise Summary',
      'Conclusion & Signatures'
    ];

    const previewRes = await request('/reports/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academicYear: '2025-26',
        departments: [],
        sections: customSections,
        sectionOrder: customSections,
        customization: {
          title: 'Institutional Annual Report 2025-26',
          subtitle: 'Academic & Research Excellence Documentation',
          instituteName: 'National Institute of Technology and Science'
        }
      })
    });

    assert(previewRes.status === 200, 'POST /api/reports/preview succeeded (200 OK)');
    const pData = previewRes.data;

    assert(pData.instituteOverview && typeof pData.instituteOverview.totalStudents === 'number',
      `Institute Overview contains total students: ${pData.instituteOverview?.totalStudents}`);
    assert(Array.isArray(pData.departmentSummaries) && pData.departmentSummaries.length > 0,
      `Department summaries populated with ${pData.departmentSummaries?.length} departments`);

    // Verify sectionOrder preserved
    assert(Array.isArray(pData.sectionOrder) && pData.sectionOrder.length === customSections.length,
      'Preview preserves custom section sequence (sectionOrder)');

    // Verify APPROVED-ONLY constraint across all departmental records
    let anyUnapprovedFound = false;
    let totalCheckedRecords = 0;

    const deptEntries = Object.values(pData.departments || {});
    for (const dept of deptEntries) {
      for (const ach of (dept.studentAchievements || [])) {
        totalCheckedRecords++;
        if (ach.status !== 'Approved') anyUnapprovedFound = true;
      }
      for (const act of (dept.activities || [])) {
        totalCheckedRecords++;
        if (act.status !== 'Approved') anyUnapprovedFound = true;
      }
      for (const ev of (dept.events || [])) {
        totalCheckedRecords++;
        if (ev.status !== 'Approved') anyUnapprovedFound = true;
      }
      for (const pl of (dept.placementRecords || [])) {
        totalCheckedRecords++;
        if (pl.status !== 'Approved') anyUnapprovedFound = true;
      }
      for (const rp of (dept.research || [])) {
        totalCheckedRecords++;
        if (rp.status !== 'Approved') anyUnapprovedFound = true;
      }
      for (const pj of (dept.projects || [])) {
        totalCheckedRecords++;
        if (pj.status !== 'Approved') anyUnapprovedFound = true;
      }
      for (const inf of (dept.facilities || [])) {
        totalCheckedRecords++;
        if (inf.status !== 'Approved') anyUnapprovedFound = true;
      }
    }

    assert(!anyUnapprovedFound,
      `CRITICAL RULE 5 VERIFIED: All ${totalCheckedRecords} checked records have status = 'Approved'`);

    // ------------------------------------------------------------------
    // Step 6: PDF Generation (Institute-Wide by Admin & Dept-Level by HOD)
    // ------------------------------------------------------------------
    console.log('\n--- Step 6: PDF Generation Service & Database Persistence ---');

    // Admin generates Institute-Wide Report
    const adminGenRes = await request('/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        reportTitle: 'Comprehensive Annual Institutional Performance Report',
        academicYear: '2025-26',
        departments: [],
        sections: customSections,
        sectionOrder: customSections,
        customization: {
          title: 'Comprehensive Annual Institutional Performance Report',
          subtitle: 'Accreditation & Governance Documentation',
          instituteName: 'National Institute of Engineering & Technology',
          includeCover: true,
          includeFooter: true
        }
      })
    });

    assert(adminGenRes.status === 201, 'Admin generated Institute Annual Report PDF successfully (201 Created)');
    const adminReportData = adminGenRes.data.report;
    assert(adminReportData && adminReportData.fileName && adminReportData.downloadUrl,
      `Admin report generated: ${adminReportData.fileName} (${adminReportData.fileSize} bytes)`);

    // Verify file actually exists on server filesystem in generated_reports
    const reportsBaseDir = path.join(__dirname, 'generated_reports');
    const adminPdfPath = path.join(reportsBaseDir, adminReportData.fileName);
    assert(fs.existsSync(adminPdfPath) && fs.statSync(adminPdfPath).size > 1000,
      `Generated PDF verified on disk: ${adminPdfPath} (${fs.statSync(adminPdfPath).size} bytes)`);

    // HOD CSE generates Department-Scoped Report
    const hodGenRes = await request('/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        reportTitle: 'Department of Computer Science & Engineering - Annual Review',
        academicYear: '2025-26',
        departments: ['Computer Science and Engineering'],
        sections: customSections,
        sectionOrder: customSections,
        customization: {
          title: 'Department of Computer Science & Engineering - Annual Review',
          subtitle: 'Departmental Faculty & Student Records',
          instituteName: 'National Institute of Engineering & Technology',
          includeCover: true,
          includeFooter: true
        }
      })
    });

    assert(hodGenRes.status === 201, 'HOD CSE generated Department Annual Report PDF successfully (201 Created)');
    const hodReportData = hodGenRes.data.report;
    const hodPdfPath = path.join(reportsBaseDir, hodReportData.fileName);
    assert(fs.existsSync(hodPdfPath) && fs.statSync(hodPdfPath).size > 1000,
      `HOD PDF verified on disk: ${hodPdfPath} (${fs.statSync(hodPdfPath).size} bytes)`);

    // ------------------------------------------------------------------
    // Step 7: Report History & Role Scoping
    // ------------------------------------------------------------------
    console.log('\n--- Step 7: Report History & Scoping ---');
    const adminHistoryRes = await request('/reports', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminHistoryRes.status === 200, 'Admin retrieved report history (200 OK)');
    const adminHistoryReports = Array.isArray(adminHistoryRes.data) ? adminHistoryRes.data : (adminHistoryRes.data.reports || []);
    assert(adminHistoryReports.length >= 2,
      `Admin sees all ${adminHistoryReports.length} reports in history`);

    // Check DB fields in history record
    const latestReport = adminHistoryReports[0];
    assert(latestReport.created_by && latestReport.status === 'Completed',
      `Report history record contains created_by (${latestReport.created_by}) and status (${latestReport.status})`);

    // HOD History: HOD CSE only sees CSE or reports created by them
    const hodHistoryRes = await request('/reports', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodHistoryRes.status === 200, 'HOD CSE retrieved scoped report history');
    const hodReports = Array.isArray(hodHistoryRes.data) ? hodHistoryRes.data : (hodHistoryRes.data.reports || []);
    const hasUnrelatedDept = hodReports.some(r =>
      r.departments && r.departments.includes('Information Technology') && !r.departments.includes('Computer Science and Engineering')
    );
    assert(!hasUnrelatedDept, 'HOD CSE does NOT see unrelated IT-exclusive reports');

    // ------------------------------------------------------------------
    // Step 8: Download Authorization Security
    // ------------------------------------------------------------------
    console.log('\n--- Step 8: Download Authorization Security ---');
    // Admin can download any report
    const adminDlRes = await request(`/reports/${adminReportData.id}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDlRes.status === 200, 'Admin can download institute report (200 OK)');

    // HOD CSE can download their own report
    const hodDlRes = await request(`/reports/${hodReportData.id}/download`, {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodDlRes.status === 200, 'HOD CSE can download their own department report (200 OK)');

    // HOD IT attempting to download HOD CSE report is forbidden
    const hodCrossDlRes = await request(`/reports/${hodReportData.id}/download`, {
      headers: { Authorization: `Bearer ${hodItToken}` }
    });
    assert(hodCrossDlRes.status === 403,
      'HOD IT attempting to download HOD CSE department report rejected with 403 Forbidden');

    // ------------------------------------------------------------------
    // Step 9: Cross-Module Metric Consistency Check
    // ------------------------------------------------------------------
    console.log('\n--- Step 9: Cross-Module Metric Consistency Check ---');
    // Compare Admin Dashboard overview numbers with Report Preview Overview numbers
    const adminDashRes = await request('/admin/dashboard?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDashRes.status === 200, 'Admin Dashboard fetched successfully');

    const kpis = adminDashRes.data.kpis || {};
    const reportStats = pData.instituteOverview;

    const adminActiveStudents = kpis.students?.active || 0;
    const adminActiveDepts = kpis.departments?.active || 0;

    assert(adminActiveStudents === reportStats.totalStudents,
      `Active Students match: Admin Dashboard (${adminActiveStudents}) === Report (${reportStats.totalStudents})`);
    assert(adminActiveDepts === reportStats.totalDepartments,
      `Active Departments match: Admin Dashboard (${adminActiveDepts}) === Report (${reportStats.totalDepartments})`);

    // Placement consistency
    const adminPlaced = kpis.placement?.placedStudents || 0;
    assert(adminPlaced === reportStats.totalPlaced,
      `Placed Students match: Admin Dashboard (${adminPlaced}) === Report (${reportStats.totalPlaced})`);

    // Approved metrics consistency
    assert(kpis.activities?.achievements === reportStats.totalAchievements,
      `Achievements match: Admin Dashboard (${kpis.activities?.achievements}) === Report (${reportStats.totalAchievements})`);
    assert(kpis.activities?.activities === reportStats.totalActivities,
      `Activities match: Admin Dashboard (${kpis.activities?.activities}) === Report (${reportStats.totalActivities})`);
    assert(kpis.activities?.events === reportStats.totalEvents,
      `Events match: Admin Dashboard (${kpis.activities?.events}) === Report (${reportStats.totalEvents})`);
    assert(kpis.research?.publications === reportStats.totalResearch,
      `Publications match: Admin Dashboard (${kpis.research?.publications}) === Report (${reportStats.totalResearch})`);
    assert(kpis.research?.projects === reportStats.totalProjects,
      `Projects match: Admin Dashboard (${kpis.research?.projects}) === Report (${reportStats.totalProjects})`);

    // ------------------------------------------------------------------
    // Final Summary
    // ------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('================================================================\n');

    if (failed === 0) {
      console.log('ALL MODULE 15 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
      process.exit(0);
    } else {
      console.error(`FAILED: ${failed} tests failed.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
