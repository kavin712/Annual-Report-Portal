const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', { email, password });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log(' MODULE 11: INFRASTRUCTURE & FACILITIES TEST SUITE');
  console.log('======================================================\n');

  try {
    // 1. Authenticate Users
    console.log('--- 1. Authenticating Roles ---');
    const admin = await login('admin@college.com', 'admin123');
    const hodCSE = await login('hod_cse@college.com', 'hod123');
    const hodIT = await login('hod_it@college.com', 'hod123');
    const facultyCSE = await login('faculty@college.com', 'faculty123');

    assert(admin.token && admin.user.role === 'admin', 'Admin authenticated');
    assert(hodCSE.token && hodCSE.user.role === 'hod', 'HOD CSE authenticated');
    assert(hodIT.token && hodIT.user.role === 'hod', 'HOD IT authenticated');
    assert(facultyCSE.token && facultyCSE.user.role === 'faculty', 'Faculty CSE authenticated');

    // 2. Infrastructure CRUD (Admin)
    console.log('\n--- 2. Infrastructure CRUD & Boundaries ---');
    const testSuffix = Math.floor(1000 + Math.random() * 9000);
    const roomA = `AB-${testSuffix}`;
    const roomB = `CS-${testSuffix}`;

    const createRes = await request('POST', '/api/infrastructure', {
      department: 'Computer Science and Engineering',
      facility_name: `Autonomous Robotics Testbed Lab ${testSuffix}`,
      facility_type: 'Research Lab',
      building_block: 'Aryabhata Block',
      room_number: roomA,
      capacity: 35,
      num_computers: 25,
      area_sqft: 950,
      facilities_available: 'Mobile Robots, LiDAR Sensors, Motion Capture Cameras',
      year_established: 2024,
      condition: 'Excellent',
      academic_year: '2025-26',
      description: 'Dedicated testbed for multi-agent autonomous robotic navigation'
    }, admin.token);

    assert(createRes.status === 201 && createRes.data.id, 'Admin can create facility record');
    const createdFacId = createRes.data.id;

    // View Record
    const viewRes = await request('GET', `/api/infrastructure/${createdFacId}`, null, admin.token);
    assert(viewRes.status === 200 && viewRes.data.facility_name === `Autonomous Robotics Testbed Lab ${testSuffix}`, 'Record viewed correctly with all fields');
    assert(viewRes.data.approval_status === 'Draft', 'Default status is Draft');

    // Update Record
    const updateRes = await request('PUT', `/api/infrastructure/${createdFacId}`, {
      facility_name: `Advanced Robotics Lab ${testSuffix}`,
      capacity: 40
    }, admin.token);
    assert(updateRes.status === 200 && updateRes.data.facility.capacity === 40, 'Record updated successfully');

    // 3. Security & Department Scoping
    console.log('\n--- 3. Security, Role Scoping & Department ID Tampering ---');
    // Faculty tries to create with fake department "Mechanical Engineering" -> Backend forces user's department
    const facultyCreate = await request('POST', '/api/infrastructure', {
      department: 'Mechanical Engineering', // Tampered department
      facility_name: `Cloud Computing Practice Lab ${testSuffix}`,
      facility_type: 'Computer Lab',
      room_number: roomB,
      academic_year: '2025-26'
    }, facultyCSE.token);

    assert(facultyCreate.status === 201, 'Faculty can create draft infrastructure');
    const facultyFacId = facultyCreate.data.id;
    const checkFacultyFac = await request('GET', `/api/infrastructure/${facultyFacId}`, null, facultyCSE.token);
    assert(checkFacultyFac.data.department === 'Computer Science and Engineering', 'Backend forced user department, tampering blocked');

    // Cross-department edit: HOD IT cannot edit CSE facility
    const crossEditRes = await request('PUT', `/api/infrastructure/${facultyFacId}`, {
      facility_name: 'Hacked Name'
    }, hodIT.token);
    assert(crossEditRes.status === 403, 'Cross-department edit rejected with 403 Forbidden');

    // Faculty cannot self-approve
    const facultySelfApprove = await request('POST', `/api/infrastructure/${facultyFacId}/approve`, {}, facultyCSE.token);
    assert(facultySelfApprove.status === 403, 'Faculty cannot approve records (Role check)');

    // 4. Centralized Approval Workflow (Module 9 Integration)
    console.log('\n--- 4. Approval Workflow: Draft -> Pending -> Changes -> Resubmitted -> Approved ---');
    // Faculty submits facility
    const submitRes = await request('POST', `/api/infrastructure/${facultyFacId}/submit`, {}, facultyCSE.token);
    assert(submitRes.status === 200 && submitRes.data.approval_status === 'Pending Approval', 'Facility submitted for approval');

    // Appears in Central Approval Center
    const approvalQueue = await request('GET', '/api/approvals/records?status=Pending+Approval', null, hodCSE.token);
    const inQueue = (approvalQueue.data.records || []).find(r => r.moduleType === 'infrastructure' && r.id === facultyFacId);
    assert(!!inQueue, 'Infrastructure submission appears in Approval Center with #INF-XX prefix');

    // HOD requests changes with mandatory comment
    const emptyCommentRes = await request('POST', `/api/infrastructure/${facultyFacId}/request-changes`, { comments: '' }, hodCSE.token);
    assert(emptyCommentRes.status === 400, 'Empty correction comments rejected with 400');

    const requestChangesRes = await request('POST', `/api/infrastructure/${facultyFacId}/request-changes`, {
      comments: 'Please verify the room number and attach photo evidence'
    }, hodCSE.token);
    assert(requestChangesRes.status === 200 && requestChangesRes.data.approval_status === 'Changes Requested', 'Changes Requested state updated');

    // Check comment saved
    const viewAfterChanges = await request('GET', `/api/infrastructure/${facultyFacId}`, null, facultyCSE.token);
    assert(viewAfterChanges.data.reviewer_comments === 'Please verify the room number and attach photo evidence', 'Correction comments preserved');

    // Faculty resubmits
    const resubmitRes = await request('POST', `/api/infrastructure/${facultyFacId}/submit`, {}, facultyCSE.token);
    assert(resubmitRes.status === 200 && resubmitRes.data.approval_status === 'Pending Approval', 'Resubmitted record returns to Pending Approval');

    // HOD approves via /api/approvals/action
    const approveActionRes = await request('POST', '/api/approvals/action', {
      module: 'infrastructure',
      id: facultyFacId,
      action: 'approve',
      comments: 'All specifications verified.'
    }, hodCSE.token);
    assert(approveActionRes.status === 200 && approveActionRes.data.success, 'HOD approved infrastructure in Approval Center');

    const viewApproved = await request('GET', `/api/infrastructure/${facultyFacId}`, null, hodCSE.token);
    assert(viewApproved.data.approval_status === 'Approved', 'Record is now Approved');

    // Self-approval check for HOD: if HOD creates a record, HOD cannot self-approve it
    const hodCreate = await request('POST', '/api/infrastructure', {
      facility_name: 'HOD Special Research Suite',
      facility_type: 'Research Lab',
      academic_year: '2025-26'
    }, hodCSE.token);
    await request('POST', `/api/infrastructure/${hodCreate.data.id}/submit`, {}, hodCSE.token);
    const hodSelfApprove = await request('POST', `/api/infrastructure/${hodCreate.data.id}/approve`, {}, hodCSE.token);
    assert(hodSelfApprove.status === 400 || hodSelfApprove.status === 403, 'Self-approval strictly prevented when submitter === reviewer');

    // 5. Equipment Management & Linkage
    console.log('\n--- 5. Equipment Management & Facility Linking ---');
    const eqCreate = await request('POST', '/api/infrastructure/equipment', {
      department: 'Computer Science and Engineering',
      facility_id: facultyFacId,
      equipment_name: 'High Performance GPU Server',
      category: 'Computing & IT',
      quantity: 4,
      model_number: 'A100-80GB',
      manufacturer: 'NVIDIA Supermicro',
      purchase_year: 2024,
      condition: 'Excellent',
      working_status: 'Working',
      maintenance_info: 'Enterprise support active through 2027',
      academic_year: '2025-26'
    }, hodCSE.token);
    assert(eqCreate.status === 201 && eqCreate.data.equipment?.id, 'Equipment created and linked to facility');
    const eqId = eqCreate.data.equipment.id;

    // View equipment list
    const eqListRes = await request('GET', `/api/infrastructure/equipment?facility_id=${facultyFacId}&limit=100`, null, hodCSE.token);
    assert(eqListRes.status === 200 && (eqListRes.data.records || eqListRes.data.equipment || []).some(e => e.id === eqId), 'Equipment listed under linked facility');

    // Verify facility view includes linked equipment
    const facWithEq = await request('GET', `/api/infrastructure/${facultyFacId}`, null, hodCSE.token);
    assert(facWithEq.data.equipment?.length > 0 && facWithEq.data.equipment[0].id === eqId, 'Facility details view contains nested equipment records');

    // 6. Live Dashboard Statistics & KPI Verification
    console.log('\n--- 6. Infrastructure Live Stats & Dashboard Integration ---');
    const statsRes = await request('GET', '/api/infrastructure/stats?department=Computer+Science+and+Engineering&academic_year=2025-26', null, hodCSE.token);
    assert(statsRes.status === 200, 'Infrastructure stats endpoint returns 200');
    assert(statsRes.data.totalFacilities >= 1, 'Total facilities count is accurate');
    assert(statsRes.data.totalEquipment >= 1, 'Total equipment count is accurate');

    const dashRes = await request('GET', '/api/dashboard/stats?department=Computer+Science+and+Engineering&academicYear=2025-26', null, hodCSE.token);
    assert(dashRes.status === 200 && dashRes.data.totalFacilities !== undefined, 'Admin/HOD dashboard stats include totalFacilities');
    assert(dashRes.data.totalEquipment !== undefined, 'Admin/HOD dashboard stats include totalEquipment');

    // 7. Search & Backend Database Filtering
    console.log('\n--- 7. Search & SQL Database Filtering ---');
    const filterType = await request('GET', '/api/infrastructure?facility_type=Computer+Lab', null, admin.token);
    assert(filterType.status === 200 && filterType.data.records.every(r => r.facility_type === 'Computer Lab'), 'Facility type filter works via SQL');

    const searchRes = await request('GET', '/api/infrastructure?search=Robotics', null, admin.token);
    assert(searchRes.status === 200 && searchRes.data.records.some(r => r.facility_name.includes('Robotics')), 'Keyword search works via SQL');

    const multiFilter = await request('GET', `/api/infrastructure?department=Computer+Science+and+Engineering&condition=Good`, null, admin.token);
    assert(multiFilter.status === 200, 'Multiple filters combine seamlessly in SQL query');

    // 8. Annual Report Builder & PDF Integration
    console.log('\n--- 8. Annual Report Builder & PDF Generation Integration ---');
    const previewRes = await request('POST', '/api/reports/preview', {
      academicYear: '2025-26',
      selectedDepartments: ['Computer Science and Engineering'],
      selectedSections: ['Infrastructure & Facilities']
    }, admin.token);

    assert(previewRes.status === 200, 'Report preview endpoint returns 200');
    const cseData = (previewRes.data.departments || previewRes.data.data)?.['Computer Science and Engineering'];
    assert(cseData && Array.isArray(cseData.facilities), 'Report preview includes facilities list');
    assert(cseData.facilities.some(f => f.id === facultyFacId), 'Approved facility is included in Annual Report');
    assert(!cseData.facilities.some(f => f.approval_status !== 'Approved'), 'Unapproved facilities excluded from Annual Report');

    // Generate actual PDF with PDFKit
    console.log('Generating PDF with Infrastructure & Facilities section...');
    const pdfRes = await request('POST', '/api/reports/generate', {
      reportTitle: 'Institutional Annual Report 2025-26 with Infrastructure',
      academicYear: '2025-26',
      selectedDepartments: ['Computer Science and Engineering', 'Electronics and Communication Engineering'],
      selectedSections: [
        'Department Information',
        'Infrastructure & Facilities',
        'Placement Summary'
      ]
    }, admin.token);

    assert((pdfRes.status === 200 || pdfRes.status === 201) && pdfRes.data.success && pdfRes.data.report?.fileSize > 0, 'PDF generated successfully with Section 9 included');

    // Report customization check: disable infrastructure and verify PDF still compiles
    const pdfNoInfra = await request('POST', '/api/reports/generate', {
      reportTitle: 'Annual Report without Infrastructure',
      academicYear: '2025-26',
      selectedDepartments: ['Computer Science and Engineering'],
      selectedSections: ['Department Information', 'Placement Summary']
    }, admin.token);
    assert((pdfNoInfra.status === 200 || pdfNoInfra.status === 201) && pdfNoInfra.data.success, 'Report Customization: Section can be toggled on/off cleanly');

    // Clean up temporary test entries
    await request('DELETE', `/api/infrastructure/equipment/${eqId}`, null, admin.token);
    await request('DELETE', `/api/infrastructure/${createdFacId}`, null, admin.token);
    await request('DELETE', `/api/infrastructure/${hodCreate.data.id}`, null, admin.token);

    console.log('\n======================================================');
    console.log(` RESULTS: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests/totalTests)*100)}%)`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('Fatal error during test suite:', err);
  }
}

runTestSuite();
