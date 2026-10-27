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

async function runTests() {
  console.log('================================================================');
  console.log('  MODULE 16: INDIVIDUAL STUDENT HISTORY PDF VERIFICATION SUITE  ');
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
    // 1. Authenticate users
    console.log('--> Step 1: User Logins');
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

    // 2. Student Search API Verification (Module 3 Reuse)
    console.log('\n--> Step 2: Student Search Verification');
    const searchByName = await request('/students/search?q=kav', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchByName.status === 200, 'Student search by name returns 200');
    assert(Array.isArray(searchByName.data), 'Search returns an array');
    assert(searchByName.data.length <= 5, 'Search capped at maximum 5 suggestions');
    const foundKavin = searchByName.data.find(s => s.name.toLowerCase().includes('kav'));
    assert(foundKavin && foundKavin.id, 'Search found student with real DB integer ID');

    const searchByReg = await request(`/students/search?q=${foundKavin.register_no.substring(0, 5)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchByReg.status === 200 && searchByReg.data.length > 0, 'Search by register number case-insensitively succeeds');

    // Retrieve full students list
    const allStudentsRes = await request('/students', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const studentsList = allStudentsRes.data.students || allStudentsRes.data || [];
    const cseStudent = studentsList.find(s => s.department === 'Computer Science and Engineering') || foundKavin;
    const itStudent = studentsList.find(s => s.department === 'Information Technology');

    console.log(`\n  Target CSE Student: ID=${cseStudent?.id}, Name=${cseStudent?.name}, Dept=${cseStudent?.department}`);
    if (itStudent) {
      console.log(`  Target IT Student: ID=${itStudent?.id}, Name=${itStudent?.name}, Dept=${itStudent?.department}`);
    }

    // 3. Security & Department Scope Validation
    console.log('\n--> Step 3: Role Security & Department Access Enforcement');
    // Unauthenticated
    const unauthRes = await request(`/reports/student/summary/${cseStudent.id}`);
    assert(unauthRes.status === 401, 'Unauthenticated access to student summary returns 401 Unauthorized');

    // Admin can access both CSE and IT students
    const adminAccessCse = await request(`/reports/student/summary/${cseStudent.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminAccessCse.status === 200, 'Admin can access CSE student summary');

    if (itStudent) {
      const adminAccessIt = await request(`/reports/student/summary/${itStudent.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(adminAccessIt.status === 200, 'Admin can access IT student summary');

      // HOD CSE accessing IT student -> MUST BE 403 Forbidden
      const hodCrossDept = await request(`/reports/student/summary/${itStudent.id}`, {
        headers: { Authorization: `Bearer ${hodCseToken}` }
      });
      assert(hodCrossDept.status === 403, 'HOD CSE querying IT student returns 403 Forbidden');

      // HOD CSE previewing IT student -> MUST BE 403 Forbidden
      const hodPreviewCross = await request('/reports/student/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hodCseToken}` },
        body: JSON.stringify({ student_id: itStudent.id })
      });
      assert(hodPreviewCross.status === 403, 'HOD CSE previewing IT student returns 403 Forbidden');

      // HOD CSE generating IT student PDF -> MUST BE 403 Forbidden
      const hodGenCross = await request('/reports/student/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hodCseToken}` },
        body: JSON.stringify({ student_id: itStudent.id })
      });
      assert(hodGenCross.status === 403, 'HOD CSE generating IT student PDF returns 403 Forbidden');

      // HOD IT accessing IT student -> 200 OK
      const hodItAccess = await request(`/reports/student/summary/${itStudent.id}`, {
        headers: { Authorization: `Bearer ${hodItToken}` }
      });
      assert(hodItAccess.status === 200, 'HOD IT can access student in their own IT department');
    }

    // HOD CSE accessing CSE student -> 200 OK
    const hodCseAccess = await request(`/reports/student/summary/${cseStudent.id}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(hodCseAccess.status === 200, 'HOD CSE can access student in their own department');

    // 4. Centralized Data Service & Summary Breakdown
    console.log('\n--> Step 4: Summary & Readiness Check Logic');
    assert(adminAccessCse.data.success === true, 'Summary endpoint returns success: true');
    assert(adminAccessCse.data.student && adminAccessCse.data.student.id === cseStudent.id, 'Summary returns verified student matching integer ID');
    assert(typeof adminAccessCse.data.counts === 'object', 'Summary returns structured counts object');
    assert(typeof adminAccessCse.data.readiness === 'object', 'Summary returns detailed readiness breakdown');
    assert(typeof adminAccessCse.data.readiness.achievements === 'object', 'Readiness includes achievements breakdown');
    assert(typeof adminAccessCse.data.readiness.placements === 'object', 'Readiness includes placements breakdown');

    // 5. Preview API Verification (Strict Approved Status & Student ID Match)
    console.log('\n--> Step 5: Report Preview API (Approved Records Only & Student ID Relationship)');
    const previewRes = await request('/reports/student/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: cseStudent.id,
        academic_year: 'All',
        selected_sections: ['student_profile', 'academic_info', 'placements', 'achievements', 'activities', 'events', 'research', 'projects']
      })
    });

    assert(previewRes.status === 200, 'Student preview endpoint returns 200 OK');
    assert(previewRes.data.reportMode === 'student', 'Preview returns reportMode: "student"');
    assert(previewRes.data.data && previewRes.data.data.student, 'Preview data includes student profile');

    const previewData = previewRes.data.data;
    // Verify all returned records have status = 'Approved'
    const allPlacementsApproved = (previewData.placements || []).every(r => r.status === 'Approved');
    assert(allPlacementsApproved, 'All preview placements have status = "Approved"');

    const allAchievementsApproved = (previewData.achievements || []).every(r => r.status === 'Approved');
    assert(allAchievementsApproved, 'All preview achievements have status = "Approved"');

    const allActivitiesApproved = (previewData.activities || []).every(r => r.status === 'Approved');
    assert(allActivitiesApproved, 'All preview activities have status = "Approved"');

    const allEventsApproved = (previewData.events || []).every(r => r.status === 'Approved');
    assert(allEventsApproved, 'All preview events have status = "Approved"');

    const allResearchApproved = (previewData.research || []).every(r => r.status === 'Approved');
    assert(allResearchApproved, 'All preview research papers have status = "Approved"');

    const allProjectsApproved = (previewData.projects || []).every(r => r.status === 'Approved');
    assert(allProjectsApproved, 'All preview projects have status = "Approved"');

    // 6. Student Identity Isolation Test
    console.log('\n--> Step 6: Student Identity Safety & Multi-Offer Integrity');
    if (previewData.placements && previewData.placements.length > 0) {
      const allBelong = previewData.placements.every(p => p.student_id === cseStudent.id);
      assert(allBelong, 'Strict Student ID foreign-key matching verified across all placement records');
      console.log(`  Placements found for ${cseStudent.name}: ${previewData.placements.length} offer(s)`);
      previewData.placements.forEach((p, i) => {
        console.log(`    Offer ${i+1}: ${p.company_name} - ${p.package || p.ctc} LPA (${p.status})`);
      });
    }

    // 7. PDF Generation Endpoint Verification
    console.log('\n--> Step 7: Student History PDF Generation');
    const genRes = await request('/reports/student/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: cseStudent.id,
        academic_year: 'All',
        selected_sections: ['student_profile', 'academic_info', 'placements', 'achievements', 'activities', 'events', 'research', 'projects']
      })
    });

    assert(genRes.status === 201, 'Student report generate endpoint returns 201 Created');
    assert(genRes.data.success === true, 'Response indicates success = true');
    assert(genRes.data.report && genRes.data.report.id, 'Report ID is returned');
    assert(genRes.data.report.fileName && genRes.data.report.fileName.endsWith('.pdf'), 'File name is a valid PDF filename');
    assert(genRes.data.report.fileSize > 1000, `Generated PDF has valid size (${genRes.data.report.fileSize} bytes)`);

    const reportId = genRes.data.report.id;
    const downloadRes = await request(`/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(downloadRes.status === 200, 'Report download endpoint returns 200 OK');
    const contentType = downloadRes.headers.get('content-type') || '';
    assert(contentType.includes('application/pdf'), 'Download serves application/pdf content type');

    // 8. Empty State Test: Student with no records
    console.log('\n--> Step 8: Empty States Handling');
    const emptyStudent = studentsList.find(s => s.id !== cseStudent.id && s.id !== itStudent?.id) || cseStudent;
    const emptyPreview = await request('/reports/student/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: emptyStudent.id,
        academic_year: '2010-11',
        selected_sections: ['student_profile', 'placements', 'achievements']
      })
    });
    assert(emptyPreview.status === 200, 'Preview handles zero records gracefully');
    assert(emptyPreview.data.counts.placements === 0, 'Placements count is 0 in empty scope');

    const emptyPdfGen = await request('/reports/student/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: emptyStudent.id,
        academic_year: '2010-11',
        selected_sections: ['student_profile', 'placements', 'achievements']
      })
    });
    assert(emptyPdfGen.status === 201, 'PDF successfully generated even when records are empty');

    // 9. Report History Integration
    console.log('\n--> Step 9: Report History Integration');
    const historyRes = await request('/reports', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(historyRes.status === 200, 'Report history endpoint returns 200 OK');
    const historyList = historyRes.data.reports || historyRes.data || [];
    const foundInHistory = historyList.find(r => r.id === reportId);
    assert(foundInHistory && foundInHistory.report_type === 'Student History', 'Generated report is persisted with report_type = "Student History"');
    assert(foundInHistory && foundInHistory.status === 'Completed', 'Generated report has status = "Completed"');

    console.log('\n================================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
