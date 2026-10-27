/**
 * Comprehensive Verification Test for Module 7: Events Management
 * Validates all 30 points of Section 17 across Faculty, HOD, Correction, Database, Security, and Reports.
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
  console.log('    MODULE 7: EVENTS MANAGEMENT VERIFICATION SUITE   ');
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
    // ------------------------------------------------------------------
    // Step 1: Authentication of all Roles
    // ------------------------------------------------------------------
    console.log('--- Step 1: Authentication ---');
    const facultyRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    assert(facultyRes.status === 200 && facultyRes.data.token, '1. Faculty logs in successfully');
    const facultyToken = facultyRes.data.token;
    const facultyUser = facultyRes.data.user;

    const hodCseRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_cse@college.com', password: 'hod123' })
    });
    assert(hodCseRes.status === 200 && hodCseRes.data.token, '2. HOD CSE logs in successfully');
    const hodCseToken = hodCseRes.data.token;
    const hodCseUser = hodCseRes.data.user;

    const hodItRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod_it@college.com', password: 'hod123' })
    });
    assert(hodItRes.status === 200 && hodItRes.data.token, '3. HOD IT logs in successfully');
    const hodItToken = hodItRes.data.token;

    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
    });
    assert(adminRes.status === 200 && adminRes.data.token, '4. Admin logs in successfully');
    const adminToken = adminRes.data.token;

    // ------------------------------------------------------------------
    // Step 2: Student and Faculty Lookups
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Student & Faculty Search Integration ---');
    const studentSearchRes = await request('/students/search?q=Aarav&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      studentSearchRes.status === 200 && Array.isArray(studentSearchRes.data) && studentSearchRes.data.length > 0 && studentSearchRes.data.length <= 5,
      '5. Student search returns up to 5 matching active students'
    );
    const cseStudent = studentSearchRes.data[0];
    assert(cseStudent && cseStudent.id && cseStudent.name, '6. Selected student has database ID and full name');

    // Get an IT student for security tests
    const itStudentList = await request('/students?department=Information Technology', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const itStudent = Array.isArray(itStudentList.data) ? itStudentList.data[0] : null;

    // Get CSE Faculty
    const cseFacultyList = await request('/faculty?department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(cseFacultyList.status === 200 && cseFacultyList.data.length > 0, '7. Faculty list retrieved for CSE');
    const cseFaculty = cseFacultyList.data[0];

    // Get IT Faculty
    const itFacultyList = await request('/faculty?department=Information Technology', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const itFaculty = itFacultyList.data?.[0];

    // ------------------------------------------------------------------
    // Step 3: Faculty Event Creation & Automatic Department Assignment
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Faculty Event Creation ---');
    const createEventRes = await request('/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        title: 'National AI & Cloud Hackathon 2026',
        event_type: 'Hackathon',
        description: '48-hour competitive coding & AI product prototyping event.',
        department: 'Information Technology', // Malicious attempt to spoof department
        academic_year: '2025-26',
        event_date: '2026-03-15',
        start_time: '09:00',
        end_time: '18:00',
        venue: 'Main Innovation Lab',
        organizer: 'CSE AI Club',
        coordinator_name: 'Dr. Ramesh Sharma',
        coordinator_faculty_id: cseFaculty.id,
        students: [cseStudent.id, cseStudent.id], // Intentional duplicate to test deduplication
        faculty: [cseFaculty.id],
        status: 'Draft'
      })
    });

    assert(createEventRes.status === 201 && createEventRes.data.event, '8. Faculty creates event successfully');
    const createdEvent = createEventRes.data.event;
    assert(
      createdEvent.department === 'Computer Science and Engineering',
      '9. Backend ignores unauthorized department in request body and enforces faculty department (CSE)'
    );
    assert(createdEvent.status === 'Draft', '10. Initial status is Draft');

    // Verify junction tables & deduplication
    const fetchedEvent = await request(`/events/${createdEvent.id}`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      fetchedEvent.status === 200 && fetchedEvent.data.students?.length === 1,
      '11. Duplicate student IDs are automatically deduplicated in junction table'
    );
    assert(
      fetchedEvent.data.students[0].id === cseStudent.id,
      '12. Linked student record matches actual student database ID'
    );
    assert(
      fetchedEvent.data.faculty?.length === 1 && fetchedEvent.data.faculty[0].id === cseFaculty.id,
      '13. Linked faculty record matches actual faculty database ID'
    );

    // ------------------------------------------------------------------
    // Step 4: Cross-Department Validation on Student/Faculty Creation
    // ------------------------------------------------------------------
    console.log('\n--- Step 4: Security & Department Integrity Validation ---');
    if (itStudent) {
      const crossDeptStudentRes = await request('/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${facultyToken}` },
        body: JSON.stringify({
          title: 'Cross Dept Violation Event',
          event_type: 'Workshop',
          academic_year: '2025-26',
          event_date: '2026-04-10',
          students: [itStudent.id] // Belongs to IT, faculty belongs to CSE
        })
      });
      assert(
        crossDeptStudentRes.status === 400,
        '14. Backend rejects selecting students from another department'
      );
    }

    if (itFaculty) {
      const crossDeptFacultyRes = await request('/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${facultyToken}` },
        body: JSON.stringify({
          title: 'Cross Dept Faculty Violation Event',
          event_type: 'Seminar',
          academic_year: '2025-26',
          event_date: '2026-04-10',
          faculty: [itFaculty.id] // Belongs to IT, faculty belongs to CSE
        })
      });
      assert(
        crossDeptFacultyRes.status === 400,
        '15. Backend rejects selecting faculty from another department'
      );
    }

    const invalidIdRes = await request('/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        title: 'Invalid Foreign Key Event',
        event_type: 'Seminar',
        academic_year: '2025-26',
        event_date: '2026-04-10',
        students: [999999]
      })
    });
    assert(invalidIdRes.status === 400, '16. Backend rejects non-existent student IDs');

    // ------------------------------------------------------------------
    // Step 5: Submission to Pending Approval & Anti-Self-Approval
    // ------------------------------------------------------------------
    console.log('\n--- Step 5: Approval Workflow & Anti-Self-Approval ---');
    const submitRes = await request(`/events/${createdEvent.id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      submitRes.status === 200 && submitRes.data.status === 'Pending Approval',
      '17. Faculty submits event; status becomes Pending Approval'
    );

    // Faculty tries to approve own event
    const facultyApproveRes = await request(`/events/${createdEvent.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      facultyApproveRes.status === 403,
      '18. Security: Faculty CANNOT approve their own event (403 Forbidden)'
    );

    // Central approvals action endpoint also blocked for faculty
    const centralApproveRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        module: 'events',
        id: createdEvent.id,
        action: 'approve'
      })
    });
    assert(
      centralApproveRes.status === 403,
      '19. Security: Central approval endpoint blocks faculty self-approval (403 Forbidden)'
    );

    // ------------------------------------------------------------------
    // Step 6: HOD Department Scoping & Correction Request
    // ------------------------------------------------------------------
    console.log('\n--- Step 6: HOD Department Scoping & Correction Request ---');
    // HOD IT tries to view or approve CSE event
    const hodItApproveRes = await request(`/events/${createdEvent.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodItToken}` }
    });
    assert(
      hodItApproveRes.status === 403,
      '20. Security: HOD from another department CANNOT approve CSE event (403 Forbidden)'
    );

    // HOD CSE requests corrections
    const correctionRes = await request(`/events/${createdEvent.id}/request-changes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({ comments: 'Please attach the schedule and clarify guest speaker names.' })
    });
    assert(
      correctionRes.status === 200 && correctionRes.data.status === 'Changes Requested',
      '21. HOD requests corrections; status becomes Changes Requested'
    );

    // Verify comments visible to Faculty
    const eventAfterCorrection = await request(`/events/${createdEvent.id}`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      eventAfterCorrection.data.review_comments === 'Please attach the schedule and clarify guest speaker names.',
      '22. Correction comments are visible to submitting faculty'
    );

    // Faculty edits requested event
    const editRes = await request(`/events/${createdEvent.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        description: '48-hour competitive coding event with Dr. Ananya Sen as keynote speaker.',
        guest_speakers: 'Dr. Ananya Sen, Head of AI Research'
      })
    });
    assert(
      editRes.status === 200 && editRes.data.event?.status === 'Pending Approval',
      '23. Faculty updates event; status automatically returns to Pending Approval'
    );

    // HOD approves the revised event
    const hodApproveRes = await request(`/events/${createdEvent.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(
      hodApproveRes.status === 200 && hodApproveRes.data.status === 'Approved',
      '24. HOD reviews and approves event successfully; status becomes Approved'
    );

    // ------------------------------------------------------------------
    // Step 7: Reports Integration
    // ------------------------------------------------------------------
    console.log('\n--- Step 7: Report Builder & Individual Student History Integration ---');
    // 1. Institute Annual Report Preview
    const reportPreviewRes = await request('/reports/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academicYear: '2025-26',
        selectedDepartments: ['Computer Science and Engineering'],
        selectedSections: ['Events Management']
      })
    });
    assert(
      reportPreviewRes.status === 200 && reportPreviewRes.data?.data?.['Computer Science and Engineering']?.events,
      '25. Approved events are populated in Annual Report data structure'
    );
    const cseEventsInReport = reportPreviewRes.data?.data?.['Computer Science and Engineering']?.events || [];
    const foundApprovedEvent = cseEventsInReport.find((e) => e.id === createdEvent.id);
    assert(foundApprovedEvent !== undefined, '26. Newly approved event is present in Institute Annual Report');

    // 2. Individual Student History Report
    const studentSummaryRes = await request(`/reports/student/summary/${cseStudent.id}`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      studentSummaryRes.status === 200 && studentSummaryRes.data?.counts?.events >= 1,
      '27. Student summary includes approved event participation count'
    );

    const studentPdfRes = await request('/reports/student/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        studentId: cseStudent.id,
        year: '2025-26',
        sections: ['Events Participation', 'Student Profile']
      })
    });
    assert(
      (studentPdfRes.status === 200 || studentPdfRes.status === 201) &&
      studentPdfRes.data?.success &&
      (studentPdfRes.data?.report?.downloadUrl || studentPdfRes.data?.report?.fileUrl),
      '28. Individual Student History PDF generated with Events Participation section'
    );

    // ------------------------------------------------------------------
    // Step 8: Dashboard & Persistence Verification
    // ------------------------------------------------------------------
    console.log('\n--- Step 8: Dashboard & Database Persistence ---');
    const dashboardStats = await request('/dashboard/stats?academicYear=2025-26&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(
      dashboardStats.status === 200 && dashboardStats.data.totalEvents >= 1 && dashboardStats.data.approvedEvents >= 1,
      '29. Dashboard stats dynamically compute totalEvents, approvedEvents, and pendingEvents'
    );

    // Delete confirmation / authorization
    const facultyDeleteApproved = await request(`/events/${createdEvent.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(
      facultyDeleteApproved.status === 403,
      '30. Security: Faculty cannot delete an already Approved event; HOD/Admin control maintained'
    );

    console.log('\n====================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite runtime error:', err);
    process.exit(1);
  }
}

runTests();
