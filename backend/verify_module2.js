/**
 * Comprehensive Verification Suite for Module 2:
 * Department Management — Frontend + Backend + Database
 */
const http = require('http');
const { db } = require('./database');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      ...headers,
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
    };

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING MODULE 2 VERIFICATION TEST SUITE: DEPARTMENT MGMT');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Step 0: Authenticate all roles and obtain signed tokens
  console.log('--- Step 0: Authenticating Users ---');
  const adminLogin = await makeRequest('POST', '/auth/login', { email: 'admin@college.com', password: 'admin123' });
  assert(adminLogin.status === 200, 'Admin login succeeded');
  const adminToken = adminLogin.body.token;

  const hodCseLogin = await makeRequest('POST', '/auth/login', { email: 'hod_cse@college.com', password: 'hod123' });
  assert(hodCseLogin.status === 200, 'HOD CSE login succeeded');
  const hodCseToken = hodCseLogin.body.token;

  const hodItLogin = await makeRequest('POST', '/auth/login', { email: 'hod_it@college.com', password: 'hod123' });
  assert(hodItLogin.status === 200, 'HOD IT login succeeded');
  const hodItToken = hodItLogin.body.token;

  const facultyLogin = await makeRequest('POST', '/auth/login', { email: 'faculty@college.com', password: 'faculty123' });
  assert(facultyLogin.status === 200, 'Faculty login succeeded');
  const facultyToken = facultyLogin.body.token;

  // Requirement 1: Admin can create a department
  console.log('\n--- Requirement 1: Admin can create a department ---');
  const testCode = 'MECH_' + Date.now().toString().slice(-4);
  const testName = 'Mechanical Engineering ' + Date.now().toString().slice(-4);
  const createRes = await makeRequest('POST', '/departments', {
    code: testCode,
    name: testName,
    description: 'Premier department for robotics, thermodynamics, and manufacturing sciences',
    established_year: 2010,
    status: 'Active'
  }, { Authorization: `Bearer ${adminToken}` });

  assert(createRes.status === 201 && createRes.body.id, `Admin successfully created department: ${testName} (ID: ${createRes.body?.id})`);
  const createdDeptId = createRes.body?.id;

  // Requirement 2: Duplicate department codes are rejected
  console.log('\n--- Requirement 2: Duplicate department codes are rejected ---');
  const duplicateCodeRes = await makeRequest('POST', '/departments', {
    code: testCode,
    name: 'Different Name But Same Code',
    established_year: 2012
  }, { Authorization: `Bearer ${adminToken}` });
  assert(duplicateCodeRes.status === 400 && duplicateCodeRes.body.error?.includes('already exists'), 'Duplicate department code rejected with 400 Bad Request');

  // Requirement 3: Department details appear from the database
  console.log('\n--- Requirement 3: Department details appear from database ---');
  const getDeptRes = await makeRequest('GET', `/departments/${createdDeptId}`, null, { Authorization: `Bearer ${adminToken}` });
  assert(getDeptRes.status === 200, 'Department details retrieved from database');
  assert(getDeptRes.body.code === testCode && getDeptRes.body.name === testName, 'Returned department data matches database values');
  assert(getDeptRes.body.description.includes('robotics'), 'Description preserved in database');

  // Requirement 4: Admin can edit department details
  console.log('\n--- Requirement 4: Admin can edit department details ---');
  const updatedName = testName + ' (Autonomous)';
  const editRes = await makeRequest('PUT', `/departments/${createdDeptId}`, {
    code: testCode,
    name: updatedName,
    description: 'Updated comprehensive curriculum and research facilities',
    established_year: 2011,
    status: 'Active'
  }, { Authorization: `Bearer ${adminToken}` });

  assert(editRes.status === 200, 'Admin successfully updated department details');
  const verifyEdit = await makeRequest('GET', `/departments/${createdDeptId}`, null, { Authorization: `Bearer ${adminToken}` });
  assert(verifyEdit.body.name === updatedName, 'Database reflects updated department name');

  // Requirement 5: Admin can assign an existing HOD
  console.log('\n--- Requirement 5: Admin can assign an existing HOD ---');
  // Fetch eligible HODs
  const eligibleHodsRes = await makeRequest('GET', '/departments/eligible-hods', null, { Authorization: `Bearer ${adminToken}` });
  assert(eligibleHodsRes.status === 200 && eligibleHodsRes.body.length >= 3, `Eligible HODs list populated from database (${eligibleHodsRes.body.length} HODs)`);

  const targetHod = eligibleHodsRes.body.find(h => h.email === 'hod_cse@college.com');
  assert(!!targetHod, 'Found eligible HOD target (Dr. Ramesh Sharma)');

  // Assign HOD to the created department
  const assignHodRes = await makeRequest('PUT', `/departments/${createdDeptId}`, {
    code: testCode,
    name: updatedName,
    hod_user_id: targetHod.id,
    established_year: 2011,
    status: 'Active'
  }, { Authorization: `Bearer ${adminToken}` });

  assert(assignHodRes.status === 200, 'HOD successfully assigned to department');

  // Verify HOD assignment in database
  const verifyHodAssignment = await makeRequest('GET', `/departments/${createdDeptId}`, null, { Authorization: `Bearer ${adminToken}` });
  assert(verifyHodAssignment.body.hod_user_id === targetHod.id, 'Department table contains assigned hod_user_id');
  assert(verifyHodAssignment.body.hod.includes('Ramesh Sharma'), 'Department hod name updated');

  // Verify user table has updated department
  const hodUserInDb = db.prepare('SELECT id, department, department_id FROM users WHERE id = ?').get(targetHod.id);
  assert(hodUserInDb.department === updatedName && hodUserInDb.department_id === createdDeptId, 'HOD user record updated with new department and department_id');

  // Requirement 6 & 7: Admin can assign faculty members & faculty counts reflect database relationships
  console.log('\n--- Requirement 6 & 7: Faculty Assignment & Real Database Faculty Counts ---');
  const facultyCandidatesRes = await makeRequest('GET', '/departments/faculty-candidates', null, { Authorization: `Bearer ${adminToken}` });
  assert(facultyCandidatesRes.status === 200 && facultyCandidatesRes.body.length >= 1, `Faculty candidates retrieved (${facultyCandidatesRes.body.length} faculty)`);

  const candidateFaculty = facultyCandidatesRes.body[0];
  const assignFacultyRes = await makeRequest('POST', `/departments/${createdDeptId}/faculty/assign`, {
    user_id: candidateFaculty.id
  }, { Authorization: `Bearer ${adminToken}` });

  assert(assignFacultyRes.status === 200, `Assigned faculty '${candidateFaculty.name}' to department`);

  // Verify faculty count in department table
  const deptListRes = await makeRequest('GET', `/departments?search=${testCode}`, null, { Authorization: `Bearer ${adminToken}` });
  assert(deptListRes.status === 200 && deptListRes.body.length === 1, 'Search query returned target department');
  assert(deptListRes.body[0].faculty_count === 1, `Department faculty count dynamically reflects assigned member (Count: ${deptListRes.body[0].faculty_count})`);

  // Verify department details view contains the assigned faculty member
  const detailsWithFaculty = await makeRequest('GET', `/departments/${createdDeptId}`, null, { Authorization: `Bearer ${adminToken}` });
  assert(detailsWithFaculty.body.faculty.some(f => f.id === candidateFaculty.id), 'Department faculty roster includes assigned faculty member');

  // Requirement 8: HOD can see their assigned department
  console.log('\n--- Requirement 8: HOD can see their assigned department ---');
  // Now targetHod is assigned to updatedName (createdDeptId). Test accessing it with targetHod's token
  const hodViewOwnRes = await makeRequest('GET', `/departments/${createdDeptId}`, null, { Authorization: `Bearer ${hodCseToken}` });
  assert(hodViewOwnRes.status === 200, 'HOD successfully views their own assigned department details');

  // Requirement 9: One HOD cannot access another department's restricted data
  console.log("\n--- Requirement 9: One HOD cannot access another department's restricted data ---");
  // hodItToken is assigned to Information Technology. Attempting to view createdDeptId (Mechanical Engineering)
  const crossDeptView = await makeRequest('GET', `/departments/${createdDeptId}`, null, { Authorization: `Bearer ${hodItToken}` });
  assert(crossDeptView.status === 403, 'HOD IT blocked from viewing restricted details of another department (403 Forbidden)');

  // Requirement 10: Faculty cannot change their department or manage departments
  console.log('\n--- Requirement 10: Faculty cannot change department or manage departments ---');
  const facultyCreateDept = await makeRequest('POST', '/departments', {
    code: 'FAIL_CODE',
    name: 'Unauthorized Dept'
  }, { Authorization: `Bearer ${facultyToken}` });
  assert(facultyCreateDept.status === 403, 'Faculty blocked from creating department (403 Forbidden)');

  const facultyEditDept = await makeRequest('PUT', `/departments/${createdDeptId}`, {
    code: testCode,
    name: 'Tampered Department'
  }, { Authorization: `Bearer ${facultyToken}` });
  assert(facultyEditDept.status === 403, 'Faculty blocked from editing department (403 Forbidden)');

  const facultyAssignMember = await makeRequest('POST', `/departments/${createdDeptId}/faculty/assign`, {
    user_id: candidateFaculty.id
  }, { Authorization: `Bearer ${facultyToken}` });
  assert(facultyAssignMember.status === 403, 'Faculty blocked from modifying faculty assignments (403 Forbidden)');

  // Requirement 11: Unauthorized API requests are rejected
  console.log('\n--- Requirement 11: Unauthorized API requests are rejected ---');
  const unauthDeptGet = await makeRequest('GET', `/departments/${createdDeptId}`);
  assert(unauthDeptGet.status === 401, 'Unauthenticated request to /departments/:id rejected with 401');

  const unauthDeptPost = await makeRequest('POST', '/departments', { code: 'FAIL', name: 'Fail' });
  assert(unauthDeptPost.status === 401, 'Unauthenticated request to POST /departments rejected with 401');

  // Requirement 12: Activate / Deactivate department and persistence
  console.log('\n--- Requirement 12: Activate / Deactivate department and persistence ---');
  const deactivateRes = await makeRequest('PATCH', `/departments/${createdDeptId}/status`, {
    status: 'Inactive'
  }, { Authorization: `Bearer ${adminToken}` });
  assert(deactivateRes.status === 200 && deactivateRes.body.status === 'Inactive', 'Admin deactivated department successfully');

  // Test status filter
  const activeList = await makeRequest('GET', '/departments?status=Active', null, { Authorization: `Bearer ${adminToken}` });
  assert(!activeList.body.some(d => d.id === createdDeptId), 'Inactive department excluded from Active filter');

  const inactiveList = await makeRequest('GET', '/departments?status=Inactive', null, { Authorization: `Bearer ${adminToken}` });
  assert(inactiveList.body.some(d => d.id === createdDeptId), 'Inactive department present in Inactive filter');

  // Requirement 13: Existing login and dashboard features still work
  console.log('\n--- Requirement 13: Existing Login and Dashboard Features Still Work ---');
  const statsRes = await makeRequest('GET', '/dashboard/stats?academic_year=2025-26', null, { Authorization: `Bearer ${adminToken}` });
  assert(statsRes.status === 200, 'Dashboard statistics API functions normally');
  assert(typeof statsRes.body.totalDepartments === 'number', `Dashboard total departments: ${statsRes.body.totalDepartments}`);

  // Restore standard demo users back to default departments
  db.prepare("UPDATE users SET department = 'Computer Science and Engineering', department_id = 1 WHERE email = 'hod_cse@college.com'").run();
  db.prepare("UPDATE users SET department = 'Computer Science and Engineering', department_id = 1 WHERE email = 'faculty@college.com'").run();
  db.prepare("UPDATE departments SET hod = 'Dr. Ramesh Sharma (HOD)', hod_user_id = 3 WHERE id = 1").run();

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
