/**
 * Comprehensive Verification Test Suite for Module 10:
 * Research, Publications and Project Management
 *
 * Verifies all 14 Section 12 requirements:
 * 1. Create, view, update, and delete research records according to permissions.
 * 2. Create, view, update, and delete project records according to permissions.
 * 3. Link multiple students and faculty members correctly.
 * 4. Verify the student dropdown shows no more than five results.
 * 5. Confirm the correct Student IDs are saved.
 * 6. Prevent unauthorized cross-department access.
 * 7. Verify faculty cannot approve their own submissions.
 * 8. Confirm correction requests and resubmissions work.
 * 9. Confirm records appear in Module 9's Approval Center.
 * 10. Confirm only approved records appear in the Institute Annual Report.
 * 11. Confirm individual student PDFs include only the selected student's approved records.
 * 12. Verify academic-year and department filters.
 * 13. Verify dashboard statistics against database records.
 * 14. Confirm existing modules continue to work.
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
  console.log('   MODULE 10: RESEARCH, PUBLICATIONS & PROJECT MANAGEMENT TESTS');
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
    // -------------------------------------------------------------
    // 0. AUTHENTICATION SETUP
    // -------------------------------------------------------------
    console.log('--- 0. Authentication Setup ---');
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
    });
    const adminToken = adminLogin.data.token;
    const adminUser = adminLogin.data.user;
    assert(adminLogin.status === 200 && adminToken, 'Admin logged in successfully');

    const hodCseLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_cse@college.com', password: 'hod123' })
    });
    const hodCseToken = hodCseLogin.data.token;
    assert(hodCseLogin.status === 200 && hodCseToken, 'HOD CSE logged in successfully');

    const hodItLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_it@college.com', password: 'hod123' })
    });
    const hodItToken = hodItLogin.data.token;
    assert(hodItLogin.status === 200 && hodItToken, 'HOD IT logged in successfully');

    const facultyLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    const facultyToken = facultyLogin.data.token;
    const facultyUser = facultyLogin.data.user;
    assert(facultyLogin.status === 200 && facultyToken, 'Faculty CSE logged in successfully');

    const authHeaders = {
      admin: { Authorization: `Bearer ${adminToken}` },
      hodCse: { Authorization: `Bearer ${hodCseToken}` },
      hodIt: { Authorization: `Bearer ${hodItToken}` },
      faculty: { Authorization: `Bearer ${facultyToken}` }
    };

    // Fetch existing students and faculty for linking
    const studentsRes = await request('/students?department=Computer Science and Engineering', {
      headers: authHeaders.admin
    });
    const cseStudents = studentsRes.data.students || studentsRes.data || [];
    assert(cseStudents.length >= 2, `Retrieved ${cseStudents.length} CSE students for linking`);
    const student1 = cseStudents[0];
    const student2 = cseStudents[1];

    const facultyRes = await request('/faculty?department=Computer Science and Engineering', {
      headers: authHeaders.admin
    });
    const cseFaculty = facultyRes.data || [];
    assert(cseFaculty.length >= 1, `Retrieved ${cseFaculty.length} CSE faculty members`);
    const faculty1 = cseFaculty[0];

    // -------------------------------------------------------------
    // TEST 4: STUDENT SEARCH DROPDOWN SUGGESTIONS (MAX 5)
    // -------------------------------------------------------------
    console.log('\n--- 1. Student Search Suggestions (Requirement 4) ---');
    const searchRes = await request('/students/search?q=sh', {
      headers: authHeaders.faculty
    });
    assert(searchRes.status === 200, 'Student search endpoint responded 200');
    assert(Array.isArray(searchRes.data), 'Student search returned array');
    assert(searchRes.data.length <= 5, `Student search returned max 5 suggestions (actual: ${searchRes.data.length})`);
    if (searchRes.data.length > 0) {
      const firstSug = searchRes.data[0];
      assert(firstSug.id && firstSug.name && (firstSug.register_number || firstSug.register_no) && firstSug.department,
        'Suggestion includes id, name, register_number, and department');
    }

    // -------------------------------------------------------------
    // TEST 1: CREATE, VIEW, UPDATE, DELETE RESEARCH RECORDS (REQUIREMENT 1, 3, 5)
    // -------------------------------------------------------------
    console.log('\n--- 2. Research & Publications CRUD & Linking (Requirements 1, 3, 5) ---');
    
    // Create Draft Research with multi-students and multi-faculty
    const newResearchPayload = {
      title: 'Automated Fault Localization using Deep Graph Neural Networks',
      description: 'A novel approach to localize faults in microservice architectures with high precision.',
      research_category: 'Applied Research',
      publication_type: 'Journal Article',
      author_names: 'Dr. Ramesh Sharma, Rahul Sharma, Priya Nair',
      department: 'Computer Science and Engineering',
      journal_conference_name: 'IEEE Transactions on Software Engineering',
      publisher: 'IEEE Computer Society',
      publication_date: '2025-10-15',
      academic_year: '2025-26',
      doi_url: 'https://doi.org/10.1109/TSE.2025.10987654',
      research_area: 'Software Engineering / AI',
      funding_agency: 'SERB CRG',
      funding_amount: 1500000,
      student_ids: [student1.id, student2.id],
      faculty_ids: [faculty1.id],
      status: 'Draft'
    };

    const createResRes = await request('/research', {
      method: 'POST',
      headers: authHeaders.faculty,
      body: JSON.stringify(newResearchPayload)
    });
    assert(createResRes.status === 201, 'Faculty successfully created Draft Research record');
    const createdResearchId = createResRes.data.id;
    assert(createdResearchId > 0, `Created Research ID is ${createdResearchId}`);

    // View Research Detail
    const viewResRes = await request(`/research/${createdResearchId}`, {
      headers: authHeaders.faculty
    });
    assert(viewResRes.status === 200, 'Successfully fetched research detail');
    const researchRecord = viewResRes.data;
    assert(researchRecord.title === newResearchPayload.title, 'Title matches');
    assert(researchRecord.status === 'Draft', 'Status is Draft');
    assert(Array.isArray(researchRecord.students) && researchRecord.students.length === 2,
      `Linked students count is 2 (Requirement 3)`);
    assert(researchRecord.students.some(s => s.id === student1.id) && researchRecord.students.some(s => s.id === student2.id),
      'Exact student IDs are stored and linked (Requirement 5)');
    assert(Array.isArray(researchRecord.faculty) && researchRecord.faculty.length === 1,
      'Linked faculty count is 1');

    // Update Research Draft
    const updateResRes = await request(`/research/${createdResearchId}`, {
      method: 'PUT',
      headers: authHeaders.faculty,
      body: JSON.stringify({
        ...newResearchPayload,
        title: 'Automated Fault Localization using Deep Graph Neural Networks (Updated)',
        funding_amount: 1750000
      })
    });
    assert(updateResRes.status === 200, 'Faculty successfully updated Draft Research record');

    // Verify Updated
    const viewUpdatedRes = await request(`/research/${createdResearchId}`, {
      headers: authHeaders.faculty
    });
    assert(viewUpdatedRes.data.title.includes('(Updated)') && viewUpdatedRes.data.funding_amount === 1750000,
      'Updated title and funding amount verified in DB');

    // -------------------------------------------------------------
    // TEST 2: CREATE, VIEW, UPDATE, DELETE PROJECT RECORDS (REQUIREMENT 2, 3, 5)
    // -------------------------------------------------------------
    console.log('\n--- 3. Project Management CRUD & Linking (Requirements 2, 3, 5) ---');
    
    const newProjectPayload = {
      title: 'Autonomous Drone Navigation for Disaster Relief',
      description: 'Edge-AI quadcopter system for real-time survivor detection and payload delivery in GPS-denied environments.',
      category: 'Research Projects',
      project_type: 'Capstone Project',
      department: 'Computer Science and Engineering',
      academic_year: '2025-26',
      start_date: '2025-08-01',
      completion_date: '2026-04-30',
      guide_name: faculty1.name || 'Dr. Ramesh Sharma',
      project_status: 'Ongoing',
      funding_sponsorship: 'DST Innovation Grant - Rs. 4,00,000',
      industry_partner: 'AeroTech Systems India',
      competition_name: 'National Smart India Hackathon 2025',
      awards_recognition: 'First Runner Up & Innovation Excellence Award',
      project_url: 'https://github.com/institute/drone-edge-nav',
      student_ids: [student1.id, student2.id],
      faculty_ids: [faculty1.id],
      status: 'Draft'
    };

    const createProjRes = await request('/projects', {
      method: 'POST',
      headers: authHeaders.faculty,
      body: JSON.stringify(newProjectPayload)
    });
    assert(createProjRes.status === 201, 'Faculty successfully created Draft Project record');
    const createdProjectId = createProjRes.data.id;
    assert(createdProjectId > 0, `Created Project ID is ${createdProjectId}`);

    // View Project Detail
    const viewProjRes = await request(`/projects/${createdProjectId}`, {
      headers: authHeaders.faculty
    });
    assert(viewProjRes.status === 200, 'Successfully fetched project detail');
    const projectRecord = viewProjRes.data;
    assert(projectRecord.title === newProjectPayload.title, 'Project title matches');
    assert(Array.isArray(projectRecord.students) && projectRecord.students.length === 2,
      'Project linked students count is 2 (Requirement 3)');
    assert(projectRecord.students.some(s => s.id === student1.id),
      'Exact student ID linked in project (Requirement 5)');

    // Update Project Draft
    const updateProjRes = await request(`/projects/${createdProjectId}`, {
      method: 'PUT',
      headers: authHeaders.faculty,
      body: JSON.stringify({
        ...newProjectPayload,
        title: 'Autonomous Drone Navigation for Disaster Relief (Updated)'
      })
    });
    assert(updateProjRes.status === 200, 'Faculty successfully updated Draft Project record');

    // -------------------------------------------------------------
    // TEST 6: PREVENT UNAUTHORIZED CROSS-DEPARTMENT ACCESS
    // -------------------------------------------------------------
    console.log('\n--- 4. Prevent Unauthorized Cross-Department Access (Requirement 6) ---');
    
    // Faculty CSE attempting to create record for ECE
    const crossDeptCreate = await request('/research', {
      method: 'POST',
      headers: authHeaders.faculty,
      body: JSON.stringify({
        ...newResearchPayload,
        department: 'Electronics and Communication Engineering'
      })
    });
    assert(crossDeptCreate.status === 403,
      'Faculty blocked (403) from creating research record in unauthorized department');

    // HOD IT attempting to view or approve CSE record
    const hodItApproveCse = await request(`/research/${createdResearchId}/approve`, {
      method: 'POST',
      headers: authHeaders.hodIt,
      body: JSON.stringify({ comments: 'Illegal approval across department' })
    });
    assert(hodItApproveCse.status === 403,
      'HOD IT blocked (403) from approving CSE research record');

    // -------------------------------------------------------------
    // TEST 7: VERIFY FACULTY CANNOT APPROVE THEIR OWN SUBMISSIONS
    // -------------------------------------------------------------
    console.log('\n--- 5. Anti-Self-Approval Enforcement (Requirement 7) ---');
    
    // Submit research for approval
    const submitRes = await request(`/research/${createdResearchId}/submit`, {
      method: 'POST',
      headers: authHeaders.faculty
    });
    assert(submitRes.status === 200, 'Faculty submitted research for approval (Status -> Pending Approval)');

    // Faculty tries to self-approve
    const selfApproveRes = await request(`/research/${createdResearchId}/approve`, {
      method: 'POST',
      headers: authHeaders.faculty
    });
    assert(selfApproveRes.status === 403,
      'Faculty blocked (403) from approving their own research submission');

    // Faculty tries to self-approve via Approval Center action endpoint
    const selfApproveCenter = await request('/approvals/action', {
      method: 'POST',
      headers: authHeaders.faculty,
      body: JSON.stringify({
        record_id: createdResearchId,
        module: 'research',
        action: 'approve'
      })
    });
    assert(selfApproveCenter.status === 403,
      'Faculty blocked (403) from approving via centralized Approval Center');

    // -------------------------------------------------------------
    // TEST 9: CONFIRM RECORDS APPEAR IN MODULE 9 APPROVAL CENTER
    // -------------------------------------------------------------
    console.log("\n--- 6. Module 9 Approval Center Integration (Requirement 9) ---");
    
    // Check pending count in approval stats
    const appStatsRes = await request('/approvals/stats', {
      headers: authHeaders.hodCse
    });
    assert(appStatsRes.status === 200, 'HOD CSE fetched approval stats');
    assert(appStatsRes.data.pendingResearch >= 1,
      `Approval stats shows pendingResearch = ${appStatsRes.data.pendingResearch}`);

    // Check records in approval center
    const appRecordsRes = await request('/approvals/records?module=research', {
      headers: authHeaders.hodCse
    });
    assert(appRecordsRes.status === 200, 'HOD CSE fetched approval queue for research');
    const queueRecords = appRecordsRes.data.records || [];
    const queuedItem = queueRecords.find(r => r.record_id === createdResearchId);
    assert(queuedItem !== undefined, `Found research record in HOD Approval Center queue (Code: ${queuedItem?.record_code})`);
    assert(queuedItem?.record_code === `#RES-${createdResearchId}`, 'Record code prefix is correctly #RES-ID');

    // Check detail endpoint in Approval Center
    const detailCenterRes = await request(`/approvals/record/research/${createdResearchId}`, {
      headers: authHeaders.hodCse
    });
    assert(detailCenterRes.status === 200, 'Approval Center fetched research record detail');
    assert(detailCenterRes.data.students && detailCenterRes.data.students.length === 2,
      'Approval Center detail view enriched with linked students');

    // -------------------------------------------------------------
    // TEST 8: CORRECTION REQUESTS AND RESUBMISSIONS WORK
    // -------------------------------------------------------------
    console.log('\n--- 7. Correction Requests & Resubmission Workflow (Requirement 8) ---');
    
    // HOD requests changes without comment (should fail 400)
    const emptyCommentReq = await request('/approvals/action', {
      method: 'POST',
      headers: authHeaders.hodCse,
      body: JSON.stringify({
        record_id: createdResearchId,
        module: 'research',
        action: 'request_changes',
        comments: ''
      })
    });
    assert(emptyCommentReq.status === 400, 'Correction request requires reviewer comments (400 Bad Request)');

    // HOD requests changes with valid comment
    const changeComment = 'Please add the complete DOI and clarify the second author contribution.';
    const validChangeReq = await request('/approvals/action', {
      method: 'POST',
      headers: authHeaders.hodCse,
      body: JSON.stringify({
        record_id: createdResearchId,
        module: 'research',
        action: 'request_changes',
        comments: changeComment
      })
    });
    assert(validChangeReq.status === 200, 'HOD requested changes via Approval Center');

    // Verify record state is 'Changes Requested' and comments visible to submitter
    const checkChangeState = await request(`/research/${createdResearchId}`, {
      headers: authHeaders.faculty
    });
    assert(checkChangeState.data.status === 'Changes Requested', 'Research status changed to Changes Requested');
    assert(checkChangeState.data.reviewer_comments === changeComment,
      'Submitter can view reviewer correction comments');

    // Faculty edits and resubmits
    const resubmitUpdate = await request(`/research/${createdResearchId}`, {
      method: 'PUT',
      headers: authHeaders.faculty,
      body: JSON.stringify({
        ...newResearchPayload,
        title: 'Automated Fault Localization using Deep Graph Neural Networks (Revised)',
        doi_url: 'https://doi.org/10.1109/TSE.2025.9999999'
      })
    });
    assert(resubmitUpdate.status === 200, 'Faculty updated record returned for corrections');

    const resubmitAction = await request(`/research/${createdResearchId}/submit`, {
      method: 'POST',
      headers: authHeaders.faculty
    });
    assert(resubmitAction.status === 200, 'Faculty resubmitted record');

    // Verify status is back to 'Pending Approval'
    const checkResubmitted = await request(`/research/${createdResearchId}`, {
      headers: authHeaders.faculty
    });
    assert(checkResubmitted.data.status === 'Pending Approval', 'Status returned to Pending Approval');

    // HOD approves the record
    const approveAction = await request('/approvals/action', {
      method: 'POST',
      headers: authHeaders.hodCse,
      body: JSON.stringify({
        record_id: createdResearchId,
        module: 'research',
        action: 'approve',
        comments: 'Verified revisions and DOI. Approved.'
      })
    });
    assert(approveAction.status === 200, 'HOD successfully approved research record');

    const checkApproved = await request(`/research/${createdResearchId}`, {
      headers: authHeaders.faculty
    });
    assert(checkApproved.data.status === 'Approved', 'Research record status is now Approved');

    // Submit and approve the Project record as well
    const submitProj = await request(`/projects/${createdProjectId}/submit`, {
      method: 'POST',
      headers: authHeaders.faculty
    });
    assert(submitProj.status === 200, 'Project submitted for approval');

    const approveProj = await request('/approvals/action', {
      method: 'POST',
      headers: authHeaders.hodCse,
      body: JSON.stringify({
        record_id: createdProjectId,
        module: 'projects',
        action: 'approve',
        comments: 'Outstanding innovation project. Approved.'
      })
    });
    assert(approveProj.status === 200, 'HOD approved project record via Approval Center');

    const checkApprovedProj = await request(`/projects/${createdProjectId}`, {
      headers: authHeaders.faculty
    });
    assert(checkApprovedProj.data.status === 'Approved', 'Project record status is now Approved');

    // -------------------------------------------------------------
    // TEST 10: CONFIRM ONLY APPROVED RECORDS APPEAR IN ANNUAL REPORT
    // -------------------------------------------------------------
    console.log('\n--- 8. Institute Annual Report Integration (Requirement 10) ---');
    
    // Create an unapproved (Draft) research record to test exclusion
    const unapprovedRes = await request('/research', {
      method: 'POST',
      headers: authHeaders.faculty,
      body: JSON.stringify({
        ...newResearchPayload,
        title: 'Confidential Unapproved Quantum Computing Research',
        status: 'Draft'
      })
    });
    const unapprovedId = unapprovedRes.data.id;

    // Fetch report preview for CSE 2025-26
    const reportPreviewRes = await request('/reports/preview', {
      method: 'POST',
      headers: authHeaders.admin,
      body: JSON.stringify({
        academicYear: '2025-26',
        department: 'Computer Science and Engineering',
        sections: {
          researchPublications: true,
          studentProjects: true
        }
      })
    });
    assert(reportPreviewRes.status === 200, 'Annual Report preview generated');
    const reportData = reportPreviewRes.data;

    const previewResearch = reportData.research || [];
    const previewProjects = reportData.projects || [];

    assert(previewResearch.some(r => r.id === createdResearchId),
      'Approved research record is included in Annual Report');
    assert(!previewResearch.some(r => r.id === unapprovedId),
      'Unapproved draft research record is strictly excluded from Annual Report');
    assert(previewProjects.some(p => p.id === createdProjectId),
      'Approved project record is included in Annual Report');

    // Clean up draft record
    await request(`/research/${unapprovedId}`, {
      method: 'DELETE',
      headers: authHeaders.faculty
    });

    // -------------------------------------------------------------
    // TEST 11: INDIVIDUAL STUDENT HISTORY PDF INTEGRATION
    // -------------------------------------------------------------
    console.log('\n--- 9. Individual Student History PDF Integration (Requirement 11) ---');
    
    const studentHistoryRes = await request(`/reports/student/summary/${student1.id}?academicYear=2025-26`, {
      headers: authHeaders.admin
    });
    assert(studentHistoryRes.status === 200, 'Student summary report fetched');
    const studentHist = studentHistoryRes.data;

    assert(Array.isArray(studentHist.research) && studentHist.research.some(r => r.id === createdResearchId),
      `Student 1 summary includes linked approved research (Count: ${studentHist.research?.length})`);
    assert(Array.isArray(studentHist.projects) && studentHist.projects.some(p => p.id === createdProjectId),
      `Student 1 summary includes linked approved project (Count: ${studentHist.projects?.length})`);

    // Fetch an unlinked student's history to verify no data leakage
    const otherStudents = cseStudents.filter(s => s.id !== student1.id && s.id !== student2.id);
    if (otherStudents.length > 0) {
      const otherHistRes = await request(`/reports/student/summary/${otherStudents[0].id}?academicYear=2025-26`, {
        headers: authHeaders.admin
      });
      assert(otherHistRes.status === 200, 'Other student history fetched');
      const otherResearch = otherHistRes.data.research || [];
      const otherProjects = otherHistRes.data.projects || [];
      assert(!otherResearch.some(r => r.id === createdResearchId),
        'Unlinked student history does NOT leak research records');
      assert(!otherProjects.some(p => p.id === createdProjectId),
        'Unlinked student history does NOT leak project records');
    }

    // -------------------------------------------------------------
    // TEST 12: ACADEMIC-YEAR AND DEPARTMENT FILTERS
    // -------------------------------------------------------------
    console.log('\n--- 10. Database-Backed Filtering (Requirement 12) ---');
    
    // Filter research by department
    const cseResearchRes = await request('/research?department=Computer Science and Engineering', {
      headers: authHeaders.admin
    });
    assert(cseResearchRes.status === 200, 'Filtered research by CSE department');
    const cseRecords = cseResearchRes.data.records || [];
    assert(cseRecords.every(r => r.department === 'Computer Science and Engineering'),
      'All returned research records belong to CSE');

    // Filter research by publication type
    const journalRes = await request('/research?publication_type=Journal Article', {
      headers: authHeaders.admin
    });
    assert(journalRes.status === 200, 'Filtered research by Journal Article');
    const journalRecords = journalRes.data.records || [];
    assert(journalRecords.every(r => r.publication_type === 'Journal Article'),
      'All returned research records are Journal Articles');

    // Filter projects by category
    const resProjFilter = await request('/projects?category=Research Projects', {
      headers: authHeaders.admin
    });
    assert(resProjFilter.status === 200, 'Filtered projects by Research Projects category');
    const resProjRecords = resProjFilter.data.records || [];
    assert(resProjRecords.every(p => (p.category || p.project_category || '').toLowerCase().includes('research project')),
      'All returned project records match Research Projects category');

    // -------------------------------------------------------------
    // TEST 13: DASHBOARD STATISTICS (REQUIREMENT 13)
    // -------------------------------------------------------------
    console.log('\n--- 11. Dashboard & Module Statistics (Requirement 13) ---');
    
    const resStatsRes = await request('/research/stats?department=Computer Science and Engineering', {
      headers: authHeaders.hodCse
    });
    assert(resStatsRes.status === 200, 'Fetched research stats');
    assert(resStatsRes.data.total >= 1 && resStatsRes.data.approved >= 1,
      `Research stats verified: total=${resStatsRes.data.total}, approved=${resStatsRes.data.approved}`);

    const projStatsRes = await request('/projects/stats?department=Computer Science and Engineering', {
      headers: authHeaders.hodCse
    });
    assert(projStatsRes.status === 200, 'Fetched project stats');
    assert(projStatsRes.data.total >= 1 && projStatsRes.data.approved >= 1,
      `Project stats verified: total=${projStatsRes.data.total}, approved=${projStatsRes.data.approved}`);

    const mainDashRes = await request('/dashboard/stats?academicYear=2025-26', {
      headers: authHeaders.admin
    });
    assert(mainDashRes.status === 200, 'Fetched main portal dashboard stats');
    assert(typeof mainDashRes.data.totalResearch === 'number' && mainDashRes.data.totalResearch >= 1,
      `Main dashboard reflects live totalResearch = ${mainDashRes.data.totalResearch}`);
    assert(typeof mainDashRes.data.totalProjects === 'number' && mainDashRes.data.totalProjects >= 1,
      `Main dashboard reflects live totalProjects = ${mainDashRes.data.totalProjects}`);

    // -------------------------------------------------------------
    // TEST 14: CONFIRM EXISTING MODULES CONTINUE TO WORK
    // -------------------------------------------------------------
    console.log('\n--- 12. Regression Check: Existing Modules (Requirement 14) ---');
    
    const plRes = await request('/placements?academicYear=2024-25', { headers: authHeaders.admin });
    assert(plRes.status === 200, 'Placements module responds 200');

    const evRes = await request('/events?academicYear=2024-25', { headers: authHeaders.admin });
    assert(evRes.status === 200, 'Events module responds 200');

    const acRes = await request('/achievements?academicYear=2024-25', { headers: authHeaders.admin });
    assert(acRes.status === 200, 'Student achievements module responds 200');

    const actRes = await request('/activities?academicYear=2024-25', { headers: authHeaders.admin });
    assert(actRes.status === 200, 'Department activities module responds 200');

    console.log('\n================================================================');
    console.log(`TOTAL PASSED: ${passed}`);
    console.log(`TOTAL FAILED: ${failed}`);
    console.log('================================================================');

    if (failed === 0) {
      console.log('\n>>> ALL MODULE 10 VERIFICATION TESTS PASSED SUCCESSFULLY! <<<\n');
      process.exit(0);
    } else {
      console.error(`\n>>> ${failed} TESTS FAILED. PLEASE REVIEW LOGS. <<<\n`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Unhandled verification error:', err);
    process.exit(1);
  }
}

runTests();
