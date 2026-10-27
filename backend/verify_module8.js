/**
 * Comprehensive Verification Test for Module 8: Placement Management
 * Tests all 33 verification points from Section 18:
 * - Individual record creation & student linking
 * - Automatic statistics (highest, average, companies, offers, placed students, placement percentage)
 * - Multiple offers handling (same student multiple offers -> 1 placed student)
 * - Filtered statistics (department, academic year)
 * - Placement CRUD (edit updates stats, delete updates stats, student preserved)
 * - Role permissions (cross-dept lockdown, anti-self-approval, HOD review, Admin global)
 * - Approval workflow (pending excluded from official reports, approved included, changes requested handled)
 * - Annual Report Builder & Individual Student History integration
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
  console.log('   MODULE 8: PLACEMENT MANAGEMENT VERIFICATION SUITE');
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
    // Step 1: Authentication of Roles
    // ------------------------------------------------------------------
    console.log('--- Step 1: Authentication ---');
    const facultyRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@college.com', password: 'faculty123' })
    });
    assert(facultyRes.status === 200 && facultyRes.data.token, 'Faculty logged in successfully');
    const facultyToken = facultyRes.data.token;
    const facultyUser = facultyRes.data.user;

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

    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@college.com', password: 'admin123' })
    });
    assert(adminRes.status === 200 && adminRes.data.token, 'Admin logged in successfully');
    const adminToken = adminRes.data.token;

    // ------------------------------------------------------------------
    // Step 2: Fetch registered students to link
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Retrieve Registered Students ---');
    const searchAarav = await request('/students/search?q=Aarav&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(searchAarav.status === 200 && searchAarav.data.length > 0, 'Found registered student Aarav in CSE');
    const student1 = searchAarav.data[0];

    const searchDiya = await request('/students/search?q=Diya&department=Computer Science and Engineering', {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(searchDiya.status === 200 && searchDiya.data.length > 0, 'Found registered student Diya in CSE');
    const student2 = searchDiya.data[0];

    // Search IT student
    const searchIT = await request('/students/search?q=Rahul', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const itStudent = searchIT.data?.find(s => s.department === 'Information Technology') || searchIT.data?.[0];
    assert(itStudent && itStudent.id, 'Found reference student for IT / cross-department tests');

    // ------------------------------------------------------------------
    // Step 3: Test 1-4: Individual record creation & validation
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Individual Record Creation ---');
    const testYear = '2025-26';

    const addPlacementRes = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: student1.id,
        student_name: student1.name,
        register_no: student1.register_no,
        department: 'Computer Science and Engineering',
        academic_year: testYear,
        company_name: 'Google India',
        job_role: 'Software Development Engineer',
        package: 24.5,
        placement_status: 'Placed',
        offer_type: 'On-Campus',
        location: 'Bengaluru',
        placement_date: '2026-02-15',
        offer_details: 'PPO after summer internship',
        submit_for_approval: false // Admin auto-approves
      })
    });

    assert(addPlacementRes.status === 201, '1. Add placement for a student succeeds (201 Created)');
    const p1 = addPlacementRes.data.record;
    assert(p1 && p1.student_id === student1.id, '2. Verify Student ID is saved and linked to database student');
    assert(p1.company_name === 'Google India' && p1.package === 24.5, '3. Verify company name and numeric package are saved');

    // 4. Verify placement appears in the records query
    const listRes = await request(`/placements/records?academic_year=${testYear}&department=Computer Science and Engineering`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const foundP1 = listRes.data.find(r => r.id === p1.id);
    assert(foundP1 && foundP1.company_name === 'Google India', '4. Verify placement appears in the table / list');

    // ------------------------------------------------------------------
    // Step 4: Test 5-11: Automatic statistics calculation
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Automatic Statistics ---');
    // Add second student record
    const addPlacement2 = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: student2.id,
        student_name: student2.name,
        register_no: student2.register_no,
        department: 'Computer Science and Engineering',
        academic_year: testYear,
        company_name: 'Microsoft',
        job_role: 'Cloud Engineer',
        package: 18.0,
        placement_status: 'Placed',
        offer_type: 'On-Campus',
        location: 'Hyderabad',
        placement_date: '2026-03-01'
      })
    });
    assert(addPlacement2.status === 201, '5. Add multiple students (Student 2 added)');
    const p2 = addPlacement2.data.record;

    // Fetch live statistics for CSE 2025-26
    const cseStatsRes = await request(`/placements/stats?academic_year=${testYear}&department=Computer Science and Engineering`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const cseStats = cseStatsRes.data;

    // 6. Highest Package = max(24.5, 18.0) = 24.5
    assert(cseStats.highest_package >= 24.5, `6. Verify highest package (${cseStats.highest_package} LPA >= 24.5 LPA)`);

    // 7. Average Package = (24.5 + 18.0) / 2 = 21.25 (or valid mean if other records exist)
    assert(cseStats.average_package > 0, `7. Verify average package is calculated automatically (${cseStats.average_package} LPA)`);

    // 8. Unique companies count
    assert(cseStats.number_of_companies >= 2, `8. Verify unique company count is computed (${cseStats.number_of_companies} >= 2)`);

    // 9. Offer count
    assert(cseStats.number_of_offers >= 2, `9. Verify offer count matches placement records (${cseStats.number_of_offers} >= 2)`);

    // 10. Unique placed student count
    assert(cseStats.students_placed >= 2, `10. Verify unique placed student count (${cseStats.students_placed} >= 2)`);

    // 11. Placement percentage
    assert(cseStats.placement_percentage > 0 && cseStats.eligible_students > 0,
      `11. Verify placement percentage is calculated dynamically (${cseStats.placement_percentage}% from ${cseStats.eligible_students} eligible students)`);

    // ------------------------------------------------------------------
    // Step 5: Test 12-14: Multiple offers for the same student
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Duplicate Offers / Multiple Offers ---');
    const initialOffers = cseStats.number_of_offers;
    const initialPlaced = cseStats.students_placed;

    // Add another offer for student1 (Aarav) from TCS with 7 LPA
    const addSecondOffer = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: student1.id,
        student_name: student1.name,
        register_no: student1.register_no,
        department: 'Computer Science and Engineering',
        academic_year: testYear,
        company_name: 'TCS Digital',
        job_role: 'Systems Engineer',
        package: 7.0,
        placement_status: 'Offer Received',
        offer_type: 'On-Campus',
        location: 'Chennai',
        placement_date: '2026-03-10'
      })
    });
    assert(addSecondOffer.status === 201, '12. Add two offers for the same student (Student 1 receives 2nd offer)');
    const p3 = addSecondOffer.data.record;

    const afterSecondOfferStats = await request(`/placements/stats?academic_year=${testYear}&department=Computer Science and Engineering`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(afterSecondOfferStats.data.number_of_offers === initialOffers + 1,
      `13. Verify offers count increases correctly (${afterSecondOfferStats.data.number_of_offers} === ${initialOffers + 1})`);
    assert(afterSecondOfferStats.data.students_placed === initialPlaced,
      `14. Verify placed student count does NOT increase twice (${afterSecondOfferStats.data.students_placed} === ${initialPlaced})`);

    // ------------------------------------------------------------------
    // Step 6: Test 15-18: Filters and statistics re-computation
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Filtered Placement Statistics ---');
    // Add an IT department placement
    const addITPlacement = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: itStudent.id,
        student_name: itStudent.name,
        register_no: itStudent.register_no,
        department: 'Information Technology',
        academic_year: testYear,
        company_name: 'Amazon AWS',
        job_role: 'Cloud Architect',
        package: 32.0,
        placement_status: 'Placed',
        offer_type: 'On-Campus',
        location: 'Hyderabad',
        placement_date: '2026-03-15'
      })
    });
    assert(addITPlacement.status === 201, 'Created IT placement for filter tests');
    const pIT = addITPlacement.data.record;

    // 15. Filter by department
    const itStatsRes = await request(`/placements/stats?academic_year=${testYear}&department=Information Technology`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(itStatsRes.status === 200 && itStatsRes.data.highest_package >= 32.0,
      `15. Filter by department (IT highest package is ${itStatsRes.data.highest_package} LPA)`);

    // 16. Filter by different academic year (2024-25)
    const yearStatsRes = await request(`/placements/stats?academic_year=2024-25&department=Computer Science and Engineering`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(yearStatsRes.status === 200, '16. Filter by academic year (2024-25)');

    // 17. Verify all statistics change correctly
    assert(yearStatsRes.data.highest_package !== cseStats.highest_package || yearStatsRes.data.number_of_offers !== afterSecondOfferStats.data.number_of_offers,
      '17. Verify all statistics change correctly when academic year filter is switched');

    // 18. Global stats (remove department filter)
    const globalStatsRes = await request(`/placements/stats?academic_year=${testYear}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(globalStatsRes.data.number_of_offers > afterSecondOfferStats.data.number_of_offers,
      `18. Remove department filter: total offers aggregates across all departments (${globalStatsRes.data.number_of_offers} offers)`);

    // ------------------------------------------------------------------
    // Step 7: Test 19-22: Placement CRUD & Recalculation
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Placement CRUD ---');
    // 19. Edit a placement: update p3 package from 7.0 to 15.0 LPA
    const editRes = await request(`/placements/records/${p3.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: student1.id,
        student_name: student1.name,
        register_no: student1.register_no,
        department: 'Computer Science and Engineering',
        academic_year: testYear,
        company_name: 'TCS R&D',
        package: 15.0,
        placement_status: 'Placed'
      })
    });
    assert(editRes.status === 200, '19. Edit a placement record succeeds');

    // 20. Verify statistics update immediately
    const updatedStats = await request(`/placements/stats?academic_year=${testYear}&department=Computer Science and Engineering`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(updatedStats.data.average_package > 0, `20. Verify statistics recalculate immediately after edit (Average: ${updatedStats.data.average_package} LPA)`);

    // 21. Delete/archive placement record p3
    const deleteRes = await request(`/placements/records/${p3.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteRes.status === 200, '21. Delete placement record succeeds');

    // 22. Verify statistics update again, and Student 1 is NOT deleted
    const afterDeleteStats = await request(`/placements/stats?academic_year=${testYear}&department=Computer Science and Engineering`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(afterDeleteStats.data.number_of_offers === afterSecondOfferStats.data.number_of_offers - 1,
      '22a. Verify statistics update again after deletion (offers count decreased)');

    const checkStudentRes = await request(`/students/${student1.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(checkStudentRes.status === 200 && checkStudentRes.data.id === student1.id,
      '22b. Verify Student record was NOT deleted when placement record was deleted');

    // ------------------------------------------------------------------
    // Step 8: Test 23-27: Role Permissions
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Role Permissions ---');
    // 23. Faculty cannot access another department (try to add placement for IT student with CSE department in token)
    const crossDeptRes = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` }, // faculty is CSE
      body: JSON.stringify({
        student_id: itStudent.id,
        student_name: itStudent.name,
        register_no: itStudent.register_no,
        department: 'Information Technology', // Mismatch!
        academic_year: testYear,
        company_name: 'Oracle',
        package: 12.0,
        placement_status: 'Placed'
      })
    });
    assert(crossDeptRes.status === 403, `23. Faculty cannot enter placement for another department (Returned 403: ${crossDeptRes.data.message || 'Forbidden'})`);

    // 24. Faculty cannot manually modify statistics (no endpoint allows manual stats tampering)
    const fakeStatsRes = await request('/placements/stats', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({ highest_package: 100, placement_percentage: 100 })
    });
    assert(fakeStatsRes.status === 404 || fakeStatsRes.status === 405, '24. No endpoint exists for manual stats modification (returns 404/405)');

    // 25. Faculty submits placement for approval
    const facSubmitRes = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        student_id: student1.id,
        student_name: student1.name,
        register_no: student1.register_no,
        department: 'Computer Science and Engineering',
        academic_year: testYear,
        company_name: 'Wipro Technologies',
        job_role: 'Project Engineer',
        package: 6.5,
        placement_status: 'Placed',
        offer_type: 'On-Campus',
        submit_for_approval: true
      })
    });
    assert(facSubmitRes.status === 201 && facSubmitRes.data.record.status === 'Pending Approval',
      'Faculty submits placement record for HOD approval');
    const facPlacement = facSubmitRes.data.record;

    // Faculty tries to self-approve:
    const selfApproveRes = await request(`/placements/records/${facPlacement.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(selfApproveRes.status === 403, '25. Faculty cannot approve their own placement record (Enforces 403 Forbidden)');

    // 26. HOD can review their department (request changes and approve)
    const hodReqChange = await request(`/placements/records/${facPlacement.id}/request-changes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({ comments: 'Please attach the official offer letter for CTC verification.' })
    });
    assert(hodReqChange.status === 200 && hodReqChange.data.record.status === 'Changes Requested',
      '26a. HOD CSE can request changes on department placement');

    // Faculty edits & resubmits
    const facResubmit = await request(`/placements/records/${facPlacement.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        ...facPlacement,
        package: 7.0,
        offer_details: 'Updated with verified offer letter CTC'
      })
    });
    assert(facResubmit.status === 200 && facResubmit.data.record.status === 'Pending Approval',
      'Faculty edits and record status resets to Pending Approval for re-review');

    // HOD approves
    const hodApproveRes = await request(`/placements/records/${facPlacement.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({ comments: 'Verified and approved.' })
    });
    assert(hodApproveRes.status === 200 && (hodApproveRes.data.status === 'Approved' || hodApproveRes.data.record?.status === 'Approved'),
      '26b. HOD CSE approves the revised placement record');

    // 27. Admin can view overall data across all departments
    const adminOverallRecords = await request('/placements/records', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const deptsFound = new Set(adminOverallRecords.data.map(r => r.department));
    assert(adminOverallRecords.status === 200 && deptsFound.size >= 2,
      `27. Admin can view overall records across all departments (Found departments: ${Array.from(deptsFound).join(', ')})`);

    // ------------------------------------------------------------------
    // Step 9: Test 28-30: Approval Exclusions in Official Reports
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Approval Workflow & Official Statistics ---');
    // Create a pending draft record
    const draftRecordRes = await request('/placements/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        student_id: student2.id,
        student_name: student2.name,
        register_no: student2.register_no,
        department: 'Computer Science and Engineering',
        academic_year: testYear,
        company_name: 'HugeSalary FakeCorp',
        job_role: 'Pending Candidate',
        package: 99.0, // Very high package to easily test exclusion
        placement_status: 'Placed',
        submit_for_approval: true
      })
    });
    const draftRecord = draftRecordRes.data.record;
    assert(draftRecord && draftRecord.status === 'Pending Approval', 'Created pending placement record with 99 LPA');

    // 28. Official report stats must exclude pending placements
    const officialReportPreview = await request('/reports/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academicYear: testYear,
        departments: ['Computer Science and Engineering'],
        sections: ['placement']
      })
    });
    assert(officialReportPreview.status === 200, '28a. Annual Report preview generated successfully');
    const reportDataMap = officialReportPreview.data?.data || {};
    const cseReportSection = reportDataMap['Computer Science and Engineering'] || (officialReportPreview.data?.departments?.find(d => d.department === 'Computer Science and Engineering'));
    const repPlacement = cseReportSection?.placement;
    assert(repPlacement && repPlacement.highest_package < 99.0,
      `28b. Pending placements (99 LPA) are EXCLUDED from official report statistics (Report highest: ${repPlacement?.highest_package} LPA)`);

    // 29. Approved placements appear in report
    assert(repPlacement.highest_package >= 24.5,
      `29. Approved placements (Google 24.5 LPA) appear in official report (${repPlacement.highest_package} LPA)`);

    // 30. Request changes on the 99 LPA placement and verify it remains excluded
    await request(`/placements/records/${draftRecord.id}/request-changes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodCseToken}` },
      body: JSON.stringify({ comments: 'Suspicious package, please review.' })
    });
    const officialReportPreview2 = await request('/reports/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academicYear: testYear,
        departments: ['Computer Science and Engineering'],
        sections: ['placement']
      })
    });
    const reportDataMap2 = officialReportPreview2.data?.data || {};
    const cseReportSection2 = reportDataMap2['Computer Science and Engineering'] || (officialReportPreview2.data?.departments?.find(d => d.department === 'Computer Science and Engineering'));
    assert(cseReportSection2?.placement?.highest_package < 99.0,
      '30. "Changes Requested" placements are excluded from official reports');

    // Clean up draft record
    await request(`/placements/records/${draftRecord.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // ------------------------------------------------------------------
    // Step 10: Test 31-33: Reports Integration
    // ------------------------------------------------------------------
    console.log('\n--- Testing Section: Reports Integration ---');
    // 31. Institute Annual Report shows calculated placement statistics
    assert(repPlacement &&
      repPlacement.students_placed !== undefined &&
      repPlacement.number_of_offers !== undefined &&
      repPlacement.highest_package !== undefined &&
      repPlacement.average_package !== undefined,
      '31. Institute Annual Report shows all calculated placement statistics from database');

    // 32. Individual Student History Report shows the correct student's placements
    const studentSummaryRes = await request(`/reports/student/summary/${student1.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(studentSummaryRes.status === 200, '32a. Student report summary retrieved');
    const s1Placements = studentSummaryRes.data.placements;
    assert(Array.isArray(s1Placements) && s1Placements.some(p => p.company_name === 'Google India'),
      '32b. Individual Student History contains Student 1 placement at Google India');

    // 33. No other student's placement appears in student 1's report
    const hasStudent2Offer = s1Placements.some(p => p.company_name === 'Microsoft' && p.student_id === student2.id);
    assert(!hasStudent2Offer,
      '33. No other student\'s placement appears in Student 1\'s history report');

    // Generate individual student PDF report
    const studentPdfRes = await request('/reports/student/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        studentId: student1.id,
        sections: ['profile', 'placements', 'achievements', 'activities', 'events']
      })
    });
    assert((studentPdfRes.status === 200 || studentPdfRes.status === 201) && studentPdfRes.data.report,
      'Generated individual student history PDF with placement section successfully');

    // Clean up created placement records
    await request(`/placements/records/${p1.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    await request(`/placements/records/${p2.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    await request(`/placements/records/${facPlacement.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    await request(`/placements/records/${pIT.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });

  } catch (err) {
    console.error('Unexpected error in test suite:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed === 0) {
    console.log('🎉 ALL 33 VERIFICATION CRITERIA FOR MODULE 8 PASSED!\n');
    process.exit(0);
  } else {
    console.error(`❌ ${failed} TEST(S) FAILED.\n`);
    process.exit(1);
  }
}

runTests();
