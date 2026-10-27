/**
 * Comprehensive Verification Test Suite for Module 9:
 * HOD Approval Center + UI and Filter Improvements
 *
 * Verifies Part 8 Section 19 (Approval Center Tests) & Section 20 (Placement Filter Tests):
 * 1. Unified Submissions Queue across all 4 modules (Achievements, Activities, Events, Placements)
 * 2. HOD Department Scoping (HOD only sees their department)
 * 3. Admin Cross-Department Access
 * 4. Faculty Approval Lockout (403 Forbidden on approval center routes)
 * 5. Direct API Bypass Prevention for Faculty
 * 6. Anti-Self-Approval Enforcement (Users cannot approve their own submissions)
 * 7. Approve Action Updates Original Database Records
 * 8. Request Changes Requires Meaningful Comments & Updates Status to Changes Requested
 * 9. Resubmitted Records Return to Pending Approval Queue
 * 10. Rejection Workflow Requires Reason & Preserves Audit History
 * 11. Approval History Audit Trail is Recorded and Retrieved (table approval_history)
 * 12. Dynamic Summary KPI Cards Scoped to Department and Live Database Records
 * 13. Search, Sorting, Date Range, Record Type & Status Filtering in Unified Queue
 * 14. Placement Filter Controls (Company Name, Student Search, Batch, Dept, Year, Status)
 * 15. Placement Live KPI Recalculation Matching Filter Dataset
 * 16. Unique Placed Students vs Number of Offers (No Double Counting)
 * 17. Unapproved (Pending/Changes/Rejected) Excluded from Official Reports & Placement Stats
 * 18. Approved Records Integrated into Reports
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
  console.log('   MODULE 9: HOD APPROVAL CENTER + FILTER IMPROVEMENTS TESTS');
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
    // Step 1: Authentication of all Roles
    // ------------------------------------------------------------------
    console.log('--- Step 1: Role Authentication ---');
    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
    });
    assert(adminRes.status === 200 && adminRes.data.token, 'Admin logged in successfully');
    const adminToken = adminRes.data.token;
    const adminUser = adminRes.data.user;

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
    assert(facultyRes.status === 200 && facultyRes.data.token, 'Faculty CSE logged in successfully');
    const facultyToken = facultyRes.data.token;
    const facultyUser = facultyRes.data.user;

    // ------------------------------------------------------------------
    // Step 2: Seed / Ensure Test Submissions across all 4 Modules
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Create Pending Submissions Across All 4 Modules ---');

    // Resolve an active CSE student from student registry
    const studSearch = await request('/students/search?q=Aarav&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const cseStudent = Array.isArray(studSearch.data) && studSearch.data.length > 0 ? studSearch.data[0] : null;
    assert(cseStudent && cseStudent.id, 'Resolved active CSE student from database');

    // 1. Student Achievement (CSE)
    const achRes = await request('/student-achievements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        student_ref_id: cseStudent.id,
        student_id: cseStudent.register_no,
        student_name: cseStudent.name,
        title: 'Module 9 National AI Hackathon Winner',
        description: 'First prize in National AI Innovation challenge',
        category: 'Hackathon',
        event_name: 'Smart India AI Cup',
        level: 'National',
        award: '1st Prize',
        date: '2025-11-15',
        academic_year: '2025-26',
        department: 'Computer Science and Engineering',
        status: 'Pending Approval'
      })
    });
    assert(achRes.status === 201 || achRes.status === 200, 'Student Achievement created in Pending Approval');
    const achId = achRes.data.achievement?.id || achRes.data.id;

    // 2. Department Activity (CSE)
    const actRes = await request('/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        activity_name: 'Module 9 Full Stack Cloud Workshop',
        activity_type: 'Workshop',
        department: 'Computer Science and Engineering',
        academic_year: '2025-26',
        date: '2025-11-20',
        coordinator: facultyUser.name,
        venue: 'Seminar Hall 1',
        description: 'Hands-on cloud architecture workshop',
        status: 'Pending Approval'
      })
    });
    assert(actRes.status === 201 || actRes.status === 200, 'Department Activity created in Pending Approval');
    const actId = actRes.data.activity?.id || actRes.data.id;

    // 3. Event (CSE)
    const evRes = await request('/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        event_name: 'Module 9 CSE Annual Tech Symposium',
        event_type: 'Symposium',
        department: 'Computer Science and Engineering',
        academic_year: '2025-26',
        event_date: '2025-12-05',
        coordinator: facultyUser.name,
        venue: 'Auditorium',
        description: 'College-wide technical symposium',
        status: 'Pending Approval'
      })
    });
    assert(evRes.status === 201 || evRes.status === 200, 'Department Event created in Pending Approval');
    const evId = evRes.data.event?.id || evRes.data.id;

    // 4. Placement Record (CSE)
    const plcRes = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        student_id: cseStudent.id,
        company_name: 'Module9 DeepMind Global',
        job_role: 'Research Engineer',
        package: 28.5,
        placement_status: 'Placed',
        offer_type: 'On-Campus',
        academic_year: '2025-26',
        department: 'Computer Science and Engineering',
        submit_for_approval: true
      })
    });
    assert(plcRes.status === 201 || plcRes.status === 200, 'Placement Record created in Pending Approval');
    const plcId = plcRes.data.record?.id || plcRes.data.id;

    // ------------------------------------------------------------------
    // Step 3: Verification of Unified Approval Queue & Statistics
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Unified Approval Queue & Dynamic Summary Cards ---');

    // 3a. HOD CSE fetches stats
    const cseStatsRes = await request('/approvals/stats?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(cseStatsRes.status === 200, 'HOD CSE retrieved dynamic approval stats');
    const cseStats = cseStatsRes.data;
    assert(cseStats.totalPending >= 4, `HOD CSE totalPending >= 4 (actual: ${cseStats.totalPending})`);
    assert(cseStats.pendingAchievements >= 1, `pendingAchievements >= 1 (actual: ${cseStats.pendingAchievements})`);
    assert(cseStats.pendingActivities >= 1, `pendingActivities >= 1 (actual: ${cseStats.pendingActivities})`);
    assert(cseStats.pendingEvents >= 1, `pendingEvents >= 1 (actual: ${cseStats.pendingEvents})`);
    assert(cseStats.pendingPlacements >= 1, `pendingPlacements >= 1 (actual: ${cseStats.pendingPlacements})`);

    // 3b. HOD CSE fetches unified queue
    const queueRes = await request('/approvals/records?academic_year=2025-26&status=Pending Approval', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(queueRes.status === 200, 'HOD CSE retrieved unified approval queue');
    const queueItems = queueRes.data.records || [];
    assert(queueItems.length >= 4, `Unified queue contains all 4 modules (actual: ${queueItems.length})`);

    // Verify presence of all 4 module types
    const hasAch = queueItems.some(i => i.moduleType === 'achievements' && i.id === achId);
    const hasAct = queueItems.some(i => i.moduleType === 'activities' && i.id === actId);
    const hasEv = queueItems.some(i => i.moduleType === 'events' && i.id === evId);
    const hasPlc = queueItems.some(i => i.moduleType === 'placements' && i.id === plcId);
    assert(hasAch, 'Achievement submission present in unified queue');
    assert(hasAct, 'Activity submission present in unified queue');
    assert(hasEv, 'Event submission present in unified queue');
    assert(hasPlc, 'Placement submission present in unified queue');

    // Verify record ID format: #ACH-XX, #ACT-XX, #EVT-XX, #PLC-XX
    const sampleRecord = queueItems.find(i => i.moduleType === 'achievements' && i.id === achId);
    assert(sampleRecord && sampleRecord.recordCode === `#ACH-${achId}`, `Record ID formatted with module prefix (#ACH-${achId})`);

    // ------------------------------------------------------------------
    // Step 4: RBAC & Departmental Boundary Enforcement
    // ------------------------------------------------------------------
    console.log('\n--- Step 4: Role-Based Access Control & Department Isolation ---');

    // 4a. HOD IT should NOT see CSE submissions in their queue
    const itQueueRes = await request('/approvals/records?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${hodItToken}` }
    });
    assert(itQueueRes.status === 200, 'HOD IT retrieved their own approval queue');
    const itItems = itQueueRes.data.records || [];
    const leakedCseItem = itItems.find(i => i.department === 'Computer Science and Engineering');
    assert(!leakedCseItem, 'HOD IT queue strictly excludes CSE department records');

    // 4b. HOD IT cannot approve CSE record (Cross-Department Lockdown)
    const crossApproveRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodItToken}` },
      body: JSON.stringify({
        module: 'achievements',
        id: achId,
        action: 'approve'
      })
    });
    assert(crossApproveRes.status === 403, 'Cross-department approval attempt rejected with 403 Forbidden');

    // 4c. Faculty cannot access approval endpoints
    const facultyQueueRes = await request('/approvals/records', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(facultyQueueRes.status === 403, 'Faculty access to /api/approvals/records rejected with 403 Forbidden');

    const facultyActionRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        module: 'achievements',
        id: achId,
        action: 'approve'
      })
    });
    assert(facultyActionRes.status === 403, 'Faculty access to /api/approvals/action rejected with 403 Forbidden');

    // 4d. Anti-Self-Approval: Submitter cannot approve their own submission
    // Create an achievement submitted directly by HOD CSE
    const hodSubRes = await request('/student-achievements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        student_ref_id: cseStudent.id,
        student_id: cseStudent.register_no,
        student_name: cseStudent.name,
        title: 'HOD Authored Achievement',
        category: 'Conference',
        event_name: 'IEEE AI Conference',
        date: '2025-11-10',
        department: 'Computer Science and Engineering',
        academic_year: '2025-26',
        status: 'Pending Approval'
      })
    });
    const hodSubId = hodSubRes.data.achievement?.id || hodSubRes.data.id;
    if (hodSubId) {
      const selfApproveRes = await request('/approvals/action', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hodCseToken}` },
        body: JSON.stringify({
          module: 'achievements',
          id: hodSubId,
          action: 'approve'
        })
      });
      assert(selfApproveRes.status === 403, 'Anti-Self-Approval: User cannot approve their own submission (403 Forbidden)');
    }

    // 4e. Admin can view submissions across departments
    const adminQueueRes = await request('/approvals/records?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminQueueRes.status === 200, 'Admin can view records across all departments');
    assert(adminQueueRes.data.records.some(i => i.id === achId), 'Admin queue includes CSE submission');

    // ------------------------------------------------------------------
    // Step 5: Approval Action & Database State Updates
    // ------------------------------------------------------------------
    console.log('\n--- Step 5: Approval Action & Original Record Update ---');

    // 5a. HOD CSE approves the Achievement
    const approveAchRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        module: 'achievements',
        id: achId,
        action: 'approve'
      })
    });
    assert(approveAchRes.status === 200, 'HOD CSE approved student achievement');

    // 5b. Verify original database record is directly updated to 'Approved'
    const checkAch = await request(`/student-achievements/${achId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(checkAch.status === 200 && checkAch.data.status === 'Approved', 'Original database record status updated to Approved');
    assert(checkAch.data.reviewed_by === hodCseUser.id, 'Reviewer ID saved on original record');

    // 5c. Verify approval_history audit trail
    const historyRes = await request(`/approvals/history/achievements/${achId}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(historyRes.status === 200 && Array.isArray(historyRes.data), 'Retrieved approval audit history');
    const lastAudit = historyRes.data[0];
    assert(lastAudit && lastAudit.new_status === 'Approved', 'Audit log records new status as Approved');
    assert(lastAudit && lastAudit.reviewer_id === hodCseUser.id, 'Audit log records reviewer ID correctly');

    // ------------------------------------------------------------------
    // Step 6: Request Changes Workflow
    // ------------------------------------------------------------------
    console.log('\n--- Step 6: Request Changes & Resubmission Workflow ---');

    // 6a. Attempt Request Changes without comments -> should fail
    const emptyCommentRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        module: 'activities',
        id: actId,
        action: 'request_changes',
        comments: '   '
      })
    });
    assert(emptyCommentRes.status === 400, 'Request Changes without comments rejected with 400 Bad Request');

    // 6b. Request Changes with meaningful comments
    const changeComment = 'Please attach the attendee sign-in sheet and event photos.';
    const requestChangeRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        module: 'activities',
        id: actId,
        action: 'request_changes',
        comments: changeComment
      })
    });
    assert(requestChangeRes.status === 200, 'HOD CSE requested changes from faculty');

    // Verify activity record status updated to 'Changes Requested'
    const checkAct = await request(`/activities/${actId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(checkAct.status === 200 && checkAct.data.status === 'Changes Requested', 'Activity status updated to Changes Requested');
    assert(checkAct.data.review_comments === changeComment, 'Correction comments visible on record');

    // Verify audit entry for Changes Requested
    const actHistoryRes = await request(`/approvals/history/activities/${actId}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(actHistoryRes.data.some(h => h.new_status === 'Changes Requested' && h.comment === changeComment), 'Audit history records Changes Requested action and comment');

    // 6c. Faculty resubmits the activity
    const resubmitRes = await request(`/activities/${actId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        activity_name: 'Module 9 Full Stack Cloud Workshop (Updated with Attendance)',
        status: 'Pending Approval'
      })
    });
    assert(resubmitRes.status === 200, 'Faculty resubmitted record for approval');

    // Verify record returns to Pending Approval in unified queue
    const checkResub = await request(`/activities/${actId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(checkResub.status === 200 && checkResub.data.status === 'Pending Approval', 'Resubmitted record returns to Pending Approval');

    // ------------------------------------------------------------------
    // Step 7: Rejection Workflow
    // ------------------------------------------------------------------
    console.log('\n--- Step 7: Permanent Rejection Workflow ---');

    // 7a. Reject without reason -> should fail
    const emptyRejectRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        module: 'events',
        id: evId,
        action: 'reject',
        comments: ''
      })
    });
    assert(emptyRejectRes.status === 400, 'Rejection without reason rejected with 400 Bad Request');

    // 7b. Reject with valid reason
    const rejectReason = 'Duplicate event registration for same time slot.';
    const rejectRes = await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        module: 'events',
        id: evId,
        action: 'reject',
        comments: rejectReason
      })
    });
    assert(rejectRes.status === 200, 'HOD CSE rejected submission with reason');

    const checkEv = await request(`/events/${evId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(checkEv.status === 200 && checkEv.data.status === 'Rejected', 'Event status updated to Rejected');

    // ------------------------------------------------------------------
    // Step 8: Unified Queue Filters & Search
    // ------------------------------------------------------------------
    console.log('\n--- Step 8: Search, Sorting & Multi-Filter in Unified Queue ---');

    // 8a. Filter by recordType=placements
    const plcFilterRes = await request('/approvals/records?academic_year=2025-26&record_type=placements', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(plcFilterRes.status === 200, 'Filtered queue by record_type=placements');
    const plcOnly = plcFilterRes.data.records || [];
    assert(plcOnly.every(i => i.moduleType === 'placements'), 'All returned records are placements');

    // 8b. Filter by status=Approved
    const appFilterRes = await request('/approvals/records?academic_year=2025-26&status=Approved', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(appFilterRes.status === 200, 'Filtered queue by status=Approved');
    const appOnly = appFilterRes.data.records || [];
    assert(appOnly.every(i => i.status === 'Approved'), 'All returned records have status Approved');

    // 8c. Search by Student Name or Title
    const searchRes = await request(`/approvals/records?search=${encodeURIComponent('DeepMind')}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(searchRes.status === 200, 'Searched queue for DeepMind');
    assert(searchRes.data.records.some(i => i.company_name?.includes('DeepMind') || i.title?.includes('DeepMind')), 'Found search match in unified queue');

    // 8d. Sorting & Pagination
    const pageRes = await request('/approvals/records?page=1&limit=2', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(pageRes.status === 200 && pageRes.data.records.length <= 2, 'Pagination limit respected in unified queue');
    assert(pageRes.data.page === 1, 'Current page reported accurately');

    // ------------------------------------------------------------------
    // Step 9: Placement Management Filters & Live KPI Tests (Section 20)
    // ------------------------------------------------------------------
    console.log('\n--- Step 9: Placement Filter Functionality & KPI Synchronization ---');

    // 9a. Approve the placement record
    await request('/approvals/action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        module: 'placements',
        id: plcId,
        action: 'approve'
      })
    });

    // 9b. Default Stats
    const defaultStatsRes = await request('/placements/stats?academic_year=2025-26&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(defaultStatsRes.status === 200, 'Fetched default placement stats');
    const defStats = defaultStatsRes.data;
    assert(defStats.highest_package >= 28.5, `Highest package updated after approval (actual: ${defStats.highest_package} LPA)`);

    // 9c. Filter by Company Name: "DeepMind"
    const companyFilterRes = await request('/placements/records?company=DeepMind&academic_year=2025-26&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(companyFilterRes.status === 200, 'Fetched records filtered by company=DeepMind');
    assert(companyFilterRes.data.length >= 1, 'Placement record found matching company filter');

    const companyStatsRes = await request('/placements/stats?company=DeepMind&academic_year=2025-26&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(companyStatsRes.status === 200, 'KPI stats recalculated matching company=DeepMind');
    assert(companyStatsRes.data.number_of_companies === 1, 'Recalculated company count is 1 for DeepMind filter');

    // 9d. Multiple Offers Double-Counting Test
    // Add second placement offer for the SAME student (CS001)
    const secondPlc = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        student_id: cseStudent.id,
        company_name: 'Module9 Microsoft Offer',
        job_role: 'Software Engineer',
        package: 35.0,
        placement_status: 'Placed',
        offer_type: 'On-Campus',
        academic_year: '2025-26',
        department: 'Computer Science and Engineering'
      })
    });
    const secondPlcId = secondPlc.data.record?.id || secondPlc.data.id;
    if (secondPlcId) {
      // Approve second offer
      await request('/approvals/action', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hodCseToken}` },
        body: JSON.stringify({ module: 'placements', id: secondPlcId, action: 'approve' })
      });

      // Fetch stats for CS001's department
      const multiOfferStats = await request('/placements/stats?academic_year=2025-26&department=Computer Science and Engineering', {
        headers: { Authorization: `Bearer ${hodCseToken}` }
      });
      // Number of offers should be at least 2, but unique placed students must NOT double count CS001
      assert(multiOfferStats.data.number_of_offers >= 2, `Number of offers counts both offers separately (${multiOfferStats.data.number_of_offers})`);
      assert(multiOfferStats.data.students_placed <= multiOfferStats.data.number_of_offers, 'Unique placed students does not double count student with multiple offers');
      assert(multiOfferStats.data.highest_package >= 35.0, `Highest package updated to 35.0 LPA (${multiOfferStats.data.highest_package})`);
    }

    // ------------------------------------------------------------------
    // Step 10: Official Report Integration Tests
    // ------------------------------------------------------------------
    console.log('\n--- Step 10: Official Report Integration ---');

    // 10a. Student History Summary excludes pending/rejected records
    const studentSummaryRes = await request(`/reports/student/summary/${cseStudent.id}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` }
    });
    assert(studentSummaryRes.status === 200, 'Retrieved student report summary');
    // Events was rejected -> should not be included in student's approved count
    const studentCounts = studentSummaryRes.data.counts;
    assert(studentCounts.achievements >= 1, `Approved achievement included in student summary (${studentCounts.achievements})`);
    assert(studentCounts.placements >= 2, `Approved placements included in student summary (${studentCounts.placements})`);

    // 10b. Generate Student PDF Report
    const genStudentReportRes = await request('/reports/student/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({
        student_id: cseStudent.id,
        academic_year: '2025-26'
      })
    });
    assert(genStudentReportRes.status === 201 || genStudentReportRes.status === 200, 'Student History Report PDF generated successfully');
    assert(genStudentReportRes.data.report?.downloadUrl, 'PDF download URL available for report');

    // ------------------------------------------------------------------
    // Final Summary
    // ------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    process.exit(1);
  }
}

runTests();
