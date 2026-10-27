/**
 * Comprehensive Verification Test for Module 6: Department Activities
 * Validates all 30 points across Faculty, HOD, Correction, Database, Security, and Reports.
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
  console.log('====================================================');
  console.log(' MODULE 6: DEPARTMENT ACTIVITIES VERIFICATION SUITE');
  console.log('====================================================\n');

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
    // 1. Authenticate users
    console.log('--- Step 1: Authentication ---');
    const facultyRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    assert(facultyRes.status === 200 && facultyRes.data.token, '1. Faculty logs in successfully');
    const facultyToken = facultyRes.data.token;
    const facultyUser = facultyRes.data.user;

    const hodRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_cse@college.com', password: 'hod123' })
    });
    assert(hodRes.status === 200 && hodRes.data.token, 'HOD logs in successfully');
    const hodToken = hodRes.data.token;
    const hodUser = hodRes.data.user;

    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
    });
    assert(adminRes.status === 200 && adminRes.data.token, 'Admin logs in successfully');
    const adminToken = adminRes.data.token;

    // 2. Query active students and faculty in CSE
    console.log('\n--- Step 2: Student & Faculty Setup ---');
    const searchRes = await request('/students/search?q=an&department=Computer%20Science%20and%20Engineering', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(searchRes.status === 200 && Array.isArray(searchRes.data) && searchRes.data.length > 0 && searchRes.data.length <= 5, '4. Smart student search returns max 5 results matching department');
    const student1 = searchRes.data[0];

    // Find another student in CSE
    const allStudentsRes = await request('/students?department=Computer%20Science%20and%20Engineering', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const studentsInDept = Array.isArray(allStudentsRes.data) ? allStudentsRes.data : [];
    const student2 = studentsInDept.find(s => s.id !== student1.id) || student1;

    // Find CSE faculty
    const facRes = await request('/faculty?department=Computer%20Science%20and%20Engineering', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const cseFaculty = Array.isArray(facRes.data) ? facRes.data : [];
    const leadFaculty = cseFaculty[0] || { id: 1, faculty_name: 'Dr. Coordinator' };
    const memberFaculty = cseFaculty[1] || leadFaculty;

    // 3. Faculty creates an activity
    console.log('\n--- Step 3: Faculty Activity Creation & Validation ---');
    const createRes = await request('/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        activity_name: 'Automated Test Hackathon 2026',
        activity_type: 'Hackathon',
        department: 'Electrical and Electronics Engineering', // Attempt to spoof department
        academic_year: '2025-26',
        date: '2026-03-15',
        venue: 'Main Auditorium',
        organizer: 'CSE Tech Club',
        faculty_coordinator: leadFaculty.faculty_name,
        coordinator_faculty_id: leadFaculty.id,
        description: 'Test hackathon for Module 6 verification',
        student_ids: [student1.id, student2.id],
        faculty_ids: [memberFaculty.id],
        is_draft: false
      })
    });

    assert(createRes.status === 201, '2. Faculty creates an activity');
    const newActivityId = createRes.data.id;

    // Fetch the created record to verify department was locked to faculty's department
    const getCreatedRes = await request(`/activities/${newActivityId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      getCreatedRes.status === 200 && getCreatedRes.data.department === facultyUser.department,
      '3. Correct department is automatically assigned (tampered department was overridden)'
    );
    assert(
      getCreatedRes.data.status === 'Pending Approval',
      '6. Status becomes Pending Approval on submit'
    );
    assert(
      getCreatedRes.data.students.length >= 1,
      '22a. Student relationships are saved via junction table'
    );
    assert(
      getCreatedRes.data.faculty.length >= 1,
      '22b. Faculty relationships are saved via junction table'
    );

    // 4. Duplicate student selection prevention
    console.log('\n--- Step 4: Duplicate & Cross-Department Security ---');
    const dupRes = await request('/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        activity_name: 'Duplicate Test',
        activity_type: 'Workshop',
        department: facultyUser.department,
        academic_year: '2025-26',
        date: '2026-03-16',
        faculty_coordinator: leadFaculty.faculty_name,
        student_ids: [student1.id, student1.id] // duplicate student id
      })
    });
    assert(dupRes.status === 400, '23. Duplicate student selection is rejected by backend');

    // Cross-department student injection rejection
    const itStudentRes = await request('/students?department=Information%20Technology', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const foreignStudent = (Array.isArray(itStudentRes.data) ? itStudentRes.data : [])[0];
    if (foreignStudent) {
      const crossStudentRes = await request('/activities', {
        method: 'POST',
        headers: { Authorization: `Bearer ${facultyToken}` },
        body: JSON.stringify({
          activity_name: 'Cross Student Test',
          activity_type: 'Workshop',
          department: facultyUser.department,
          academic_year: '2025-26',
          date: '2026-03-16',
          faculty_coordinator: leadFaculty.faculty_name,
          student_ids: [foreignStudent.id]
        })
      });
      assert(crossStudentRes.status === 400, '27. Foreign department student ID is rejected');
    }

    // 5. Faculty cannot approve
    console.log('\n--- Step 5: Faculty Role Restrictions ---');
    const facApproveRes = await request(`/activities/${newActivityId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({ comments: 'Self approval attempt' })
    });
    assert(facApproveRes.status === 403, '7 & 24. Faculty cannot access HOD approval endpoint directly');

    // 6. HOD Review & Request Corrections
    console.log('\n--- Step 6: HOD Review & Corrections Workflow ---');
    const hodListRes = await request('/activities?status=Pending%20Approval', {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    assert(hodListRes.status === 200, '8. HOD logs in and accesses activities');
    const pendingInDept = (hodListRes.data || []).filter(a => a.id === newActivityId);
    assert(pendingInDept.length > 0, '9. HOD sees pending activities from their department');

    const hodDetailRes = await request(`/activities/${newActivityId}`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    assert(hodDetailRes.status === 200 && hodDetailRes.data.students.length > 0, '10. HOD can view activity details');

    // HOD requests corrections
    const reqChangesRes = await request(`/activities/${newActivityId}/request-changes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: JSON.stringify({ comments: 'Please attach the official certificate and clarify the venue details.' })
    });
    assert(reqChangesRes.status === 200, '12 & 13. HOD requests corrections with review comments');

    // 7. Faculty Receives Changes Requested & Resubmits
    console.log('\n--- Step 7: Faculty Resubmission Cycle ---');
    const afterChangesRes = await request(`/activities/${newActivityId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(afterChangesRes.data.status === 'Changes Requested', '15. Faculty receives Changes Requested status');
    assert(
      afterChangesRes.data.review_comments.includes('attach the official certificate'),
      '16. Faculty sees HOD review comments'
    );

    // Faculty edits the activity
    const facultyEditRes = await request(`/activities/${newActivityId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        activity_name: 'Automated Test Hackathon 2026 - Revised',
        activity_type: 'Hackathon',
        department: facultyUser.department,
        academic_year: '2025-26',
        date: '2026-03-15',
        venue: 'Main Auditorium - Hall B',
        organizer: 'CSE Tech Club & ACM',
        faculty_coordinator: leadFaculty.faculty_name,
        coordinator_faculty_id: leadFaculty.id,
        description: 'Updated with complete guidelines',
        student_ids: [student1.id],
        is_draft: false
      })
    });
    assert(facultyEditRes.status === 200, '17. Faculty edits the activity');
    assert(facultyEditRes.data.status === 'Pending Approval', '18 & 19. Status becomes Pending Approval again on resubmit');

    // 8. HOD Cross-department protection
    console.log('\n--- Step 8: Cross-Department Protection ---');
    // Create an activity in IT using Admin
    const itDeptName = 'Information Technology';
    const itActRes = await request('/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        activity_name: 'IT Cloud Systems Workshop',
        activity_type: 'Workshop',
        department: itDeptName,
        academic_year: '2025-26',
        date: '2026-04-10',
        faculty_coordinator: 'Dr. IT Faculty',
        is_draft: false
      })
    });
    const itActId = itActRes.data.id;

    // CSE HOD attempts to view or approve IT activity
    const hodCrossGetRes = await request(`/activities/${itActId}`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    assert(hodCrossGetRes.status === 403, '14. HOD cannot access another department\'s activities');

    const hodCrossApproveRes = await request(`/activities/${itActId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: JSON.stringify({ comments: 'Illegal approval' })
    });
    assert(hodCrossApproveRes.status === 403, '26. HOD cannot modify/approve another department\'s activity');

    // Faculty cross-department edit attempt
    const facCrossEditRes = await request(`/activities/${itActId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({ activity_name: 'Hacked title' })
    });
    assert(facCrossEditRes.status === 403, '25. Faculty cannot modify another department\'s activity');

    // 9. HOD Approves Activity
    console.log('\n--- Step 9: HOD Approval ---');
    const hodApproveRes = await request(`/activities/${newActivityId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: JSON.stringify({ comments: 'Verified and approved for publication in annual report.' })
    });
    assert(hodApproveRes.status === 200, '11. HOD can approve faculty-submitted activity');

    // 10. Report Integration Checks
    console.log('\n--- Step 10: Report Integration (Annual & Student Reports) ---');
    // Create a pending activity that must NOT appear in reports
    const pendingDraftRes = await request('/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        activity_name: 'Unapproved Secret Activity',
        activity_type: 'Workshop',
        department: facultyUser.department,
        academic_year: '2025-26',
        date: '2026-04-20',
        faculty_coordinator: leadFaculty.faculty_name,
        student_ids: [student1.id],
        is_draft: true
      })
    });
    const unapprovedId = pendingDraftRes.data.id;

    // Check Institute Annual Report Data
    const reportDataRes = await request('/reports/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academicYear: '2025-26',
        selectedDepartments: ['Computer Science and Engineering'],
        selectedSections: ['Department Activities']
      })
    });
    assert(reportDataRes.status === 200, 'Institute Annual Report preview accessible');
    const cseReportActivities = reportDataRes.data.data['Computer Science and Engineering']?.activities || [];
    const hasApproved = cseReportActivities.some(a => a.id === newActivityId);
    const hasUnapproved = cseReportActivities.some(a => a.id === unapprovedId);
    assert(hasApproved, '28. Approved activities appear in the Institute Annual Report');
    assert(!hasUnapproved, '30a. Pending / Draft activities do not appear in Institute Annual Report');

    // Check Student History Report Data
    const studentReportRes = await request(`/reports/student/summary/${student1.id}`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(studentReportRes.status === 200, 'Student report summary fetched successfully');
    assert(studentReportRes.data.counts.activities >= 1, '29. Student-linked activities appear in Individual Student History Report');

    // 11. Database Persistence Verification
    console.log('\n--- Step 11: Database Persistence ---');
    const verifyPersistRes = await request(`/activities/${newActivityId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      verifyPersistRes.status === 200 && verifyPersistRes.data.status === 'Approved',
      '20 & 21. Data remains persistent in database'
    );

    // Clean up test activities
    await request(`/activities/${itActId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    await request(`/activities/${unapprovedId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
