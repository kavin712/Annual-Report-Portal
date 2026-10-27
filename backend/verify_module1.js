/**
 * Automated Verification Suite for Module 1:
 * Connect Database, Backend and Authentication
 */
const http = require('http');
const { db } = require('./database');
const { verifyPassword } = require('./services/auth');

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
  console.log('====================================================');
  console.log('🧪 RUNNING MODULE 1 VERIFICATION TEST SUITE');
  console.log('====================================================\n');

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

  // TEST 1: Database Connection and Hashed Password Verification
  console.log('--- TEST 1: Database Connection & Secure Password Hashes ---');
  try {
    const users = db.prepare('SELECT id, email, role, department, password FROM users').all();
    assert(users.length >= 5, `Database active with ${users.length} users in 'users' table`);

    let allHashed = true;
    for (const u of users) {
      const isScryptHash = typeof u.password === 'string' && u.password.includes(':') && u.password.length > 50;
      if (!isScryptHash) {
        allHashed = false;
        console.error(`User ${u.email} has unhashed password: ${u.password}`);
      }
    }
    assert(allHashed, 'All passwords in database are stored as secure cryptographically salted scrypt hashes (no plain-text passwords)');
  } catch (err) {
    assert(false, `Database inspection failed: ${err.message}`);
  }

  // TEST 2: Valid Authentication for All Roles
  console.log('\n--- TEST 2: Valid Authentication & Signed Session Tokens ---');
  let adminToken, hodCseToken, hodItToken, facultyToken;
  let adminUser, hodCseUser, hodItUser, facultyUser;

  try {
    // Admin Login
    const adminRes = await makeRequest('POST', '/auth/login', { email: 'admin@college.com', password: 'admin123' });
    assert(adminRes.status === 200 && adminRes.body.token, 'Admin login succeeded and returned signed session token');
    assert(adminRes.body.user && adminRes.body.user.role === 'admin' && !adminRes.body.user.password, 'Admin user object returned without password field');
    adminToken = adminRes.body.token;
    adminUser = adminRes.body.user;

    // HOD CSE Login
    const hodCseRes = await makeRequest('POST', '/auth/login', { email: 'hod_cse@college.com', password: 'hod123' });
    assert(hodCseRes.status === 200 && hodCseRes.body.user.role === 'hod' && hodCseRes.body.user.department === 'Computer Science and Engineering', 'HOD CSE login succeeded with assigned department');
    hodCseToken = hodCseRes.body.token;
    hodCseUser = hodCseRes.body.user;

    // HOD IT Login
    const hodItRes = await makeRequest('POST', '/auth/login', { email: 'hod_it@college.com', password: 'hod123' });
    assert(hodItRes.status === 200 && hodItRes.body.user.role === 'hod' && hodItRes.body.user.department === 'Information Technology', 'HOD IT login succeeded with assigned department');
    hodItToken = hodItRes.body.token;
    hodItUser = hodItRes.body.user;

    // Faculty Login
    const facultyRes = await makeRequest('POST', '/auth/login', { email: 'faculty@college.com', password: 'faculty123' });
    assert(facultyRes.status === 200 && facultyRes.body.user.role === 'faculty' && facultyRes.body.user.department === 'Computer Science and Engineering', 'Faculty login succeeded with assigned department');
    facultyToken = facultyRes.body.token;
    facultyUser = facultyRes.body.user;
  } catch (err) {
    assert(false, `Authentication failed: ${err.message}`);
  }

  // TEST 3: Invalid Login Rejection
  console.log('\n--- TEST 3: Invalid Login Rejection ---');
  try {
    const wrongPassRes = await makeRequest('POST', '/auth/login', { email: 'admin@college.com', password: 'wrongpassword' });
    assert(wrongPassRes.status === 401, 'Login with incorrect password rejected with 401 Unauthorized');

    const nonExistentRes = await makeRequest('POST', '/auth/login', { email: 'unknown@college.com', password: 'anypassword' });
    assert(nonExistentRes.status === 401, 'Login with nonexistent email rejected with 401 Unauthorized');

    const missingFieldsRes = await makeRequest('POST', '/auth/login', { email: 'admin@college.com' });
    assert(missingFieldsRes.status === 400, 'Login with missing fields rejected with 400 Bad Request');
  } catch (err) {
    assert(false, `Invalid login test failed: ${err.message}`);
  }

  // TEST 4: Session Verification Endpoint (/api/auth/me)
  console.log('\n--- TEST 4: Profile Verification & Tamper Resistance ---');
  try {
    const meRes = await makeRequest('GET', '/auth/me', null, { Authorization: `Bearer ${adminToken}` });
    assert(meRes.status === 200 && meRes.body.user.email === 'admin@college.com', 'GET /api/auth/me successfully verifies session token against database');

    const unauthRes = await makeRequest('GET', '/auth/me');
    assert(unauthRes.status === 401, 'GET /api/auth/me without token rejected with 401');

    const tamperedRes = await makeRequest('GET', '/auth/me', null, { Authorization: `Bearer ${adminToken}TAMPERED` });
    assert(tamperedRes.status === 401, 'GET /api/auth/me with tampered token rejected with 401');
  } catch (err) {
    assert(false, `Session verification failed: ${err.message}`);
  }

  // TEST 5: Role Authorization & Server-Side Privilege Enforcement
  console.log('\n--- TEST 5: Backend Authorization & Privilege Enforcement ---');
  try {
    const uniqueSuffix = Date.now().toString().slice(-4);
    const createDeptByAdmin = await makeRequest('POST', '/departments', {
      code: 'TEST_' + uniqueSuffix,
      name: 'Test Temporary Department ' + uniqueSuffix,
      hod: 'Prof. Tester'
    }, { Authorization: `Bearer ${adminToken}` });
    assert(createDeptByAdmin.status === 201, 'Admin can create department (/api/departments)');

    // 5b. Faculty CANNOT create departments (403 Forbidden)
    const createDeptByFaculty = await makeRequest('POST', '/departments', {
      code: 'FAIL_DEPT',
      name: 'Unauthorized Dept'
    }, { Authorization: `Bearer ${facultyToken}` });
    assert(createDeptByFaculty.status === 403, 'Faculty blocked from creating department (403 Forbidden)');

    // 5c. Faculty CANNOT access pending approvals endpoint (403 Forbidden)
    const pendingByFaculty = await makeRequest('GET', '/approvals/pending', null, { Authorization: `Bearer ${facultyToken}` });
    assert(pendingByFaculty.status === 403, 'Faculty blocked from viewing approval queues (403 Forbidden)');

    // 5d. HOD CAN access pending approvals endpoint (200 OK)
    const pendingByHod = await makeRequest('GET', '/approvals/pending', null, { Authorization: `Bearer ${hodCseToken}` });
    assert(pendingByHod.status === 200 && pendingByHod.body.department === 'Computer Science and Engineering', 'HOD CSE authorized to access approval queues locked to their department');

    // 5e. Faculty CANNOT create faculty members in /api/faculty (403 Forbidden)
    const facultyCreateByFaculty = await makeRequest('POST', '/faculty', {
      name: 'Unauthorized Faculty Entry',
      department: 'Computer Science and Engineering',
      academic_year: '2025-26',
      designation: 'Professor'
    }, { Authorization: `Bearer ${facultyToken}` });
    assert(facultyCreateByFaculty.status === 403, 'Faculty blocked from creating faculty records in /api/faculty (403 Forbidden)');
  } catch (err) {
    assert(false, `Authorization enforcement failed: ${err.message}`);
  }

  // TEST 6: Cross-Department Isolation (HOD cannot access another department)
  console.log('\n--- TEST 6: Cross-Department Boundary Enforcement ---');
  try {
    // HOD IT attempting to modify Department Report for CSE
    const crossDeptReport = await makeRequest('POST', '/department-reports', {
      department_code: 'CSE',
      department_name: 'Computer Science and Engineering',
      academic_year: '2025-26',
      hod: 'Malicious Change',
      total_students: 500,
      total_faculty: 30
    }, { Authorization: `Bearer ${hodItToken}` });
    assert(crossDeptReport.status === 403, 'HOD IT blocked from modifying CSE Department Reports (403 Forbidden)');

    // HOD CSE allowed to modify CSE Department Report
    const allowedDeptReport = await makeRequest('POST', '/department-reports', {
      department_code: 'CSE',
      department_name: 'Computer Science and Engineering',
      academic_year: '2025-26',
      hod: 'Dr. Ramesh Sharma',
      total_students: 480,
      total_faculty: 35
    }, { Authorization: `Bearer ${hodCseToken}` });
    assert(allowedDeptReport.status === 200, 'HOD CSE allowed to modify CSE Department Reports (200 OK)');
  } catch (err) {
    assert(false, `Cross-department isolation test failed: ${err.message}`);
  }

  // TEST 7: Dashboard Statistics Connected to Real Database
  console.log('\n--- TEST 7: Real Database Dashboard Queries ---');
  try {
    const statsAdmin = await makeRequest('GET', '/dashboard/stats?academic_year=2025-26', null, { Authorization: `Bearer ${adminToken}` });
    assert(statsAdmin.status === 200, 'Dashboard statistics endpoint returned 200 OK');
    assert(typeof statsAdmin.body.totalDepartments === 'number' && statsAdmin.body.totalDepartments >= 3, `Real total departments count: ${statsAdmin.body.totalDepartments}`);
    assert(typeof statsAdmin.body.totalStudents === 'number', `Real total students calculated from database: ${statsAdmin.body.totalStudents}`);
    assert(typeof statsAdmin.body.totalFaculty === 'number', `Real total faculty calculated from database: ${statsAdmin.body.totalFaculty}`);
    assert(typeof statsAdmin.body.totalActivities === 'number', `Real total activities calculated from database: ${statsAdmin.body.totalActivities}`);

    const statsFaculty = await makeRequest('GET', '/dashboard/stats?academic_year=2025-26', null, { Authorization: `Bearer ${facultyToken}` });
    assert(statsFaculty.status === 200 && typeof statsFaculty.body.mySubmissions === 'number', `Faculty dashboard returns individual submission metrics: ${statsFaculty.body.mySubmissions}`);
  } catch (err) {
    assert(false, `Dashboard verification failed: ${err.message}`);
  }

  // TEST 8: Logout Endpoint
  console.log('\n--- TEST 8: Logout Endpoint ---');
  try {
    const logoutRes = await makeRequest('POST', '/auth/logout', null, { Authorization: `Bearer ${adminToken}` });
    assert(logoutRes.status === 200 && logoutRes.body.success, 'POST /api/auth/logout returned 200 OK');
  } catch (err) {
    assert(false, `Logout endpoint failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
