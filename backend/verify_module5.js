const assert = require('assert');
const { db } = require('./database');

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const cleanPath = endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
  const url = `${BASE_URL}${cleanPath}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('application/pdf')) {
    data = await response.arrayBuffer();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    data
  };
}

async function runModule5Tests() {
  console.log('====================================================');
  console.log('🚀 RUNNING MODULE 5: STUDENT ACHIEVEMENTS VERIFICATION');
  console.log('====================================================\n');

  // Step 1: Authenticate users
  console.log('1. Authenticating test users...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
  });
  assert.strictEqual(adminLogin.status, 200);
  const adminToken = adminLogin.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const hodCseLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'hod_cse@college.com', password: 'hod123' })
  });
  assert.strictEqual(hodCseLogin.status, 200);
  const hodCseToken = hodCseLogin.data.token;
  const hodCseHeaders = { Authorization: `Bearer ${hodCseToken}` };

  const hodItLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'hod_it@college.com', password: 'hod123' })
  });
  assert.strictEqual(hodItLogin.status, 200);
  const hodItToken = hodItLogin.data.token;
  const hodItHeaders = { Authorization: `Bearer ${hodItToken}` };

  const facultyLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
  });
  assert.strictEqual(facultyLogin.status, 200);
  const facultyToken = facultyLogin.data.token;
  const facultyHeaders = { Authorization: `Bearer ${facultyToken}` };
  const facultyUser = facultyLogin.data.user;

  console.log('   All roles authenticated successfully.\n');

  // Step 2: Student Search Dropdown returns at most 5 real active suggestions
  console.log('2. Testing Smart Student Search...');
  const searchRes = await request('/students/search?q=an', { headers: facultyHeaders });
  assert.strictEqual(searchRes.status, 200);
  assert.ok(Array.isArray(searchRes.data), 'Expected search results array');
  assert.ok(searchRes.data.length > 0 && searchRes.data.length <= 5, 'Results must be <= 5');
  const targetStudent = searchRes.data[0];
  assert.ok(targetStudent.id && targetStudent.name && targetStudent.register_no, 'Student must contain real DB fields');
  console.log(`  ✅ PASS: Student search returned ${searchRes.data.length} records (<= 5). Found: ${targetStudent.name} (${targetStudent.register_no})`);

  // Step 3: Rejection of non-existent or inactive student ID
  console.log('\n3. Testing Student Existence & Active Validation on Add...');
  const fakeStudentRes = await request('/student-achievements', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      student_ref_id: 999999,
      title: 'Unverified Student Award',
      event_name: 'Hackathon',
      date: '2026-03-15',
      academic_year: '2025-26',
      department: 'Computer Science and Engineering',
      category: 'Technical'
    })
  });
  assert.strictEqual(fakeStudentRes.status, 400);
  assert.ok(fakeStudentRes.data.error.includes('Selected student does not exist'));
  console.log('  ✅ PASS: Non-existent student ID was rejected with 400 Bad Request');

  // Step 4: Faculty creates an achievement for an authorized student -> Status: 'Pending Approval'
  console.log('\n4. Testing Faculty Achievement Submission (Draft & Approval Workflow)...');
  const uniqueTitle = `SIH AI Dispatch Finalist ${Date.now()}`;
  const facultySub = await request('/student-achievements', {
    method: 'POST',
    headers: facultyHeaders,
    body: JSON.stringify({
      student_ref_id: targetStudent.id,
      title: uniqueTitle,
      category: 'Technical',
      level: 'National',
      award: '1st Prize (Winner)',
      event_name: 'Smart India Hackathon 2026',
      date: '2026-04-10',
      academic_year: '2025-26',
      department: facultyUser.department,
      description: 'Built autonomous AI ambulance routing system with real-time lane clearance.',
      certificate_path: '/uploads/certificates/demo_cert.pdf'
    })
  });
  assert.strictEqual(facultySub.status, 201);
  assert.strictEqual(facultySub.data.status, 'Pending Approval');
  const achievementId = facultySub.data.id;
  console.log(`  ✅ PASS: Faculty submitted achievement (ID: ${achievementId}) -> Status: 'Pending Approval'`);

  // Step 5: Verify correct student ID and fields are stored in the database
  console.log('\n5. Testing Database Storage & Field Fidelity...');
  const dbRecord = db.prepare('SELECT * FROM student_achievements WHERE id = ?').get(achievementId);
  assert.ok(dbRecord, 'Record must exist in SQLite database');
  assert.strictEqual(dbRecord.student_ref_id, targetStudent.id);
  assert.strictEqual(dbRecord.student_name, targetStudent.name);
  assert.strictEqual(dbRecord.student_id, targetStudent.register_no);
  assert.strictEqual(dbRecord.level, 'National');
  assert.strictEqual(dbRecord.award, '1st Prize (Winner)');
  assert.strictEqual(dbRecord.submitted_by, facultyUser.id);
  console.log('  ✅ PASS: Record persisted in SQLite with exact foreign key references, student ID, level, and award.');

  // Step 6: HOD of the department sees it in their queue / list
  console.log('\n6. Testing HOD Departmental Visibility...');
  const hodList = await request(`/student-achievements?department=${encodeURIComponent(facultyUser.department)}&status=Pending Approval`, {
    headers: hodCseHeaders
  });
  assert.strictEqual(hodList.status, 200);
  const foundInHod = hodList.data.find(a => a.id === achievementId);
  assert.ok(foundInHod, 'HOD CSE must see the submission in their pending queue');
  console.log('  ✅ PASS: HOD CSE successfully retrieved the pending achievement from department queue.');

  // Step 7: Cross-department access is blocked (HOD IT cannot view or modify CSE achievements)
  console.log('\n7. Testing Cross-Department Boundary Security...');
  const crossDeptView = await request(`/student-achievements/${achievementId}`, { headers: hodItHeaders });
  assert.strictEqual(crossDeptView.status, 403);
  console.log('  ✅ PASS: HOD IT blocked from viewing CSE achievement (403 Forbidden)');

  const crossDeptApprove = await request(`/student-achievements/${achievementId}/approve`, {
    method: 'POST',
    headers: hodItHeaders,
    body: JSON.stringify({ comments: 'Illegal HOD cross-approval attempt' })
  });
  assert.strictEqual(crossDeptApprove.status, 403);
  console.log('  ✅ PASS: HOD IT blocked from approving CSE achievement (403 Forbidden)');

  // Step 8: Faculty cannot approve their own submissions (Anti-self-approval)
  console.log('\n8. Testing Anti-Self-Approval Enforcement...');
  const selfApprove = await request(`/student-achievements/${achievementId}/approve`, {
    method: 'POST',
    headers: facultyHeaders,
    body: JSON.stringify({ comments: 'Self approval attempt' })
  });
  assert.strictEqual(selfApprove.status, 403);
  console.log('  ✅ PASS: Faculty blocked from approving submission (403 Forbidden)');

  // Step 9: HOD Requests Changes with Feedback
  console.log('\n9. Testing Revision Request Workflow (Pending Approval -> Changes Requested)...');
  const requestChanges = await request(`/student-achievements/${achievementId}/request-changes`, {
    method: 'POST',
    headers: hodCseHeaders,
    body: JSON.stringify({ comments: 'Please attach official verification link and specify team members.' })
  });
  assert.strictEqual(requestChanges.status, 200);
  assert.strictEqual(requestChanges.data.status, 'Changes Requested');

  const afterChanges = db.prepare('SELECT status, review_comments FROM student_achievements WHERE id = ?').get(achievementId);
  assert.strictEqual(afterChanges.status, 'Changes Requested');
  assert.strictEqual(afterChanges.review_comments, 'Please attach official verification link and specify team members.');
  console.log('  ✅ PASS: Status transitioned to "Changes Requested" with HOD comments preserved in DB.');

  // Step 10: Faculty can view review feedback and resubmit (Changes Requested -> Pending Approval)
  console.log('\n10. Testing Faculty Resubmission after Feedback...');
  const facultyView = await request(`/student-achievements/${achievementId}`, { headers: facultyHeaders });
  assert.strictEqual(facultyView.status, 200);
  assert.strictEqual(facultyView.data.review_comments, 'Please attach official verification link and specify team members.');

  const resubmit = await request(`/student-achievements/${achievementId}`, {
    method: 'PUT',
    headers: facultyHeaders,
    body: JSON.stringify({
      title: `${uniqueTitle} (Verified with link)`,
      description: 'Autonomous AI ambulance routing. Team members: Anil, Suresh, Sneha. Verified on SIH portal.'
    })
  });
  assert.strictEqual(resubmit.status, 200);
  assert.strictEqual(resubmit.data.status, 'Pending Approval');
  console.log('  ✅ PASS: Faculty updated achievement and resubmitted -> Status returned to "Pending Approval".');

  // Step 11: HOD Approves Resubmission
  console.log('\n11. Testing HOD Approval (Pending Approval -> Approved)...');
  const approveRes = await request(`/student-achievements/${achievementId}/approve`, {
    method: 'POST',
    headers: hodCseHeaders,
    body: JSON.stringify({ comments: 'Verified and Approved by HOD.' })
  });
  assert.strictEqual(approveRes.status, 200);
  assert.strictEqual(approveRes.data.status, 'Approved');

  const approvedInDb = db.prepare('SELECT status, reviewed_by FROM student_achievements WHERE id = ?').get(achievementId);
  assert.strictEqual(approvedInDb.status, 'Approved');
  console.log('  ✅ PASS: Submission approved by HOD -> Status: "Approved".');

  // Step 12: Faculty cannot edit already Approved achievement
  console.log('\n12. Testing Faculty Lockout on Approved Achievements...');
  const lockedEdit = await request(`/student-achievements/${achievementId}`, {
    method: 'PUT',
    headers: facultyHeaders,
    body: JSON.stringify({ title: 'Tampered Title After Approval' })
  });
  assert.strictEqual(lockedEdit.status, 403);
  console.log('  ✅ PASS: Faculty blocked from modifying approved record (403 Forbidden).');

  // Step 13: Unapproved achievements do not appear in official PDFs
  console.log('\n13. Testing Report Builder PDF Integration (Unapproved Exclusion)...');
  // First, create an unapproved draft / pending achievement
  const pendingAch = await request('/student-achievements', {
    method: 'POST',
    headers: facultyHeaders,
    body: JSON.stringify({
      student_ref_id: targetStudent.id,
      title: `Secret Pending Hackathon ${Date.now()}`,
      category: 'Technical',
      event_name: 'Unverified Event',
      date: '2026-05-01',
      academic_year: '2025-26',
      department: facultyUser.department,
      is_draft: true
    })
  });
  assert.strictEqual(pendingAch.status, 201);
  const draftId = pendingAch.data.id;

  // Generate Student History PDF
  const pdfRes = await request('/reports/student/generate', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      student_id: targetStudent.id,
      academic_year: 'All',
      selected_sections: ['Student Achievements']
    })
  });
  assert.strictEqual(pdfRes.status, 201);
  assert.ok(pdfRes.data.report?.fileName?.startsWith('Student_History_'));
  assert.ok(pdfRes.data.report?.fileSize > 2000);
  console.log(`  ✅ PASS: Student History PDF successfully generated: ${pdfRes.data.report.fileName} (${pdfRes.data.report.fileSize} bytes)`);

  const downloadPdf = await request(`/reports/${pdfRes.data.report.id}/download`, { headers: adminHeaders });
  assert.strictEqual(downloadPdf.status, 200);
  assert.strictEqual(downloadPdf.headers.get('content-type'), 'application/pdf');
  console.log('  ✅ PASS: Verified student report PDF downloaded with application/pdf header.');

  // Check preview endpoint: unapproved record MUST NOT appear in report data
  const reportData = await request('/reports/preview', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYear: '2025-26',
      selectedDepartments: [facultyUser.department],
      selectedSections: ['Student Achievements']
    })
  });
  assert.strictEqual(reportData.status, 200);
  const deptAchList = reportData.data.data?.[facultyUser.department]?.achievements || [];
  const foundDraft = deptAchList.find(a => a.id === draftId);
  assert.strictEqual(foundDraft, undefined, 'Unapproved draft achievement must NEVER appear in report data');
  console.log('  ✅ PASS: Draft & Unapproved achievements strictly excluded from official reports.');

  // Clean up draft record
  await request(`/student-achievements/${draftId}`, { method: 'DELETE', headers: facultyHeaders });

  // Step 14: Certificate Document Upload Test
  console.log('\n14. Testing Secure Certificate Upload & Download...');
  const fakePdfBase64 = Buffer.from('%PDF-1.4 demo certificate text').toString('base64');
  const uploadRes = await request('/student-achievements/upload-certificate', {
    method: 'POST',
    headers: facultyHeaders,
    body: JSON.stringify({
      file_name: 'state_certificate_award.pdf',
      file_data: fakePdfBase64
    })
  });
  assert.strictEqual(uploadRes.status, 200);
  assert.ok(uploadRes.data.certificate_path.includes('/certificates/cert_'));
  console.log(`  ✅ PASS: Certificate safely uploaded -> Stored path: ${uploadRes.data.certificate_path}`);

  // Download test
  const downloadRes = await request(uploadRes.data.certificate_path, { headers: facultyHeaders });
  assert.strictEqual(downloadRes.status, 200);
  console.log('  ✅ PASS: Secure certificate download returned 200 OK.');

  // Step 15: Clean up test achievement
  console.log('\n15. Cleaning up test records...');
  const deleteRes = await request(`/student-achievements/${achievementId}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert.strictEqual(deleteRes.status, 200);
  console.log('  ✅ PASS: Test achievement safely deleted.');

  console.log('\n====================================================');
  console.log('📊 MODULE 5 VERIFICATION COMPLETE: ALL 15 TESTS PASSED!');
  console.log('====================================================\n');
}

runModule5Tests().catch((err) => {
  console.error('\n❌ Module 5 verification failed:', err);
  process.exit(1);
});
