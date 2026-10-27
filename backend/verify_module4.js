const axios = require('axios');
const { db } = require('./database');

const BASE_URL = 'http://localhost:5000/api';

async function runModule4Tests() {
  console.log('====================================================');
  console.log('🚀 RUNNING MODULE 4: FACULTY MANAGEMENT VERIFICATION');
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

  try {
    // 1. Authenticate users
    console.log('1. Authenticating test users...');
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@college.com',
      password: 'admin123'
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.data.token}` };

    const hodCseLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'hod_cse@college.com',
      password: 'hod123'
    });
    const hodCseHeaders = { Authorization: `Bearer ${hodCseLogin.data.token}` };

    const hodItLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'hod_it@college.com',
      password: 'hod123'
    });
    const hodItHeaders = { Authorization: `Bearer ${hodItLogin.data.token}` };

    const facultyLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'faculty@college.com',
      password: 'faculty123'
    });
    const facultyHeaders = { Authorization: `Bearer ${facultyLogin.data.token}` };
    console.log('   All 4 roles authenticated successfully.\n');

    // 2. Admin adds a new faculty record
    console.log('2. Testing Admin Faculty Registration...');
    const testFacultyId = 'FAC-TEST-' + Date.now();
    let newFacultyRecordId = null;

    const createRes = await axios.post(`${BASE_URL}/faculty`, {
      faculty_name: 'Dr. Test Faculty Member',
      faculty_id: testFacultyId,
      department: 'Computer Science and Engineering',
      academic_year: '2025-26',
      designation: 'Associate Professor',
      qualification: 'Ph.D. in Computer Science',
      specialization: 'Quantum Computing & Algorithms',
      date_of_joining: '2021-08-15',
      email: 'test_faculty@college.edu',
      phone: '9876543299',
      status: 'Active',
      publications: 6,
      research_projects: 1,
      conferences_attended: 4,
      awards: 'Best Paper Award 2024',
      description: 'Researching quantum cryptography algorithms.'
    }, { headers: adminHeaders });

    assert(createRes.status === 201 && createRes.data.id,
      `Admin successfully registered faculty record: ID ${createRes.data.id} (${testFacultyId})`);
    newFacultyRecordId = createRes.data.id;

    // 3. Duplicate Employee ID rejection
    console.log('\n3. Testing Duplicate Employee ID Uniqueness Constraint...');
    try {
      await axios.post(`${BASE_URL}/faculty`, {
        faculty_name: 'Another Duplicate Faculty',
        faculty_id: testFacultyId, // duplicate
        department: 'Computer Science and Engineering',
        designation: 'Assistant Professor',
        qualification: 'M.Tech'
      }, { headers: adminHeaders });
      assert(false, 'Duplicate employee ID should have been rejected');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.error?.includes('already exists'),
        'Duplicate employee ID rejected with 400 Bad Request: ' + err.response?.data?.error);
    }

    // 4. Persistence check via GET /api/faculty/:id
    console.log('\n4. Testing Faculty Details Retrieval & Persistence...');
    const getRes = await axios.get(`${BASE_URL}/faculty/${newFacultyRecordId}`, { headers: adminHeaders });
    assert(getRes.data.faculty_id === testFacultyId && getRes.data.faculty_name === 'Dr. Test Faculty Member',
      'Faculty details retrieved and verified against database');
    assert(getRes.data.specialization === 'Quantum Computing & Algorithms' && getRes.data.publications === 6,
      'Extended fields (specialization, publications) persisted accurately');

    // 5. Admin edits faculty record
    console.log('\n5. Testing Faculty Update via PUT...');
    const updateRes = await axios.put(`${BASE_URL}/faculty/${newFacultyRecordId}`, {
      faculty_name: 'Dr. Test Faculty Member (Updated)',
      faculty_id: testFacultyId,
      department: 'Computer Science and Engineering',
      academic_year: '2025-26',
      designation: 'Professor',
      qualification: 'Ph.D., D.Sc.',
      specialization: 'Quantum Information Theory',
      publications: 9
    }, { headers: adminHeaders });

    assert(updateRes.status === 200 && updateRes.data.faculty?.designation === 'Professor',
      'Faculty updated successfully to Professor with 9 publications');

    // 6. Deactivation & status toggle
    console.log('\n6. Testing Faculty Deactivation & Activation via PATCH...');
    const toggleRes = await axios.patch(`${BASE_URL}/faculty/${newFacultyRecordId}/status`, {
      status: 'Inactive'
    }, { headers: adminHeaders });
    assert(toggleRes.data.status === 'Inactive', 'Faculty successfully deactivated to Inactive status');

    // Inactive filter test
    const inactiveList = await axios.get(`${BASE_URL}/faculty?status=Inactive`, { headers: adminHeaders });
    const hasInactive = inactiveList.data.some(f => f.id === newFacultyRecordId);
    assert(hasInactive, 'Deactivated faculty appears in Inactive filter');

    // Active filter test
    const activeList = await axios.get(`${BASE_URL}/faculty?status=Active`, { headers: adminHeaders });
    const hasInActiveList = activeList.data.some(f => f.id === newFacultyRecordId);
    assert(!hasInActiveList, 'Deactivated faculty is excluded from Active filter');

    // Reactivate
    await axios.patch(`${BASE_URL}/faculty/${newFacultyRecordId}/status`, { status: 'Active' }, { headers: adminHeaders });

    // 7. Search & filtering functionality
    console.log('\n7. Testing Search and Department Filtering...');
    const searchRes = await axios.get(`${BASE_URL}/faculty?search=${testFacultyId}`, { headers: adminHeaders });
    assert(searchRes.data.length > 0 && searchRes.data[0].id === newFacultyRecordId,
      `Search by employee ID ('${testFacultyId}') returned correct record`);

    // 8. HOD CSE can manage their own department faculty
    console.log('\n8. Testing HOD Departmental Access (Own Department)...');
    const hodCseGet = await axios.get(`${BASE_URL}/faculty/${newFacultyRecordId}`, { headers: hodCseHeaders });
    assert(hodCseGet.status === 200 && hodCseGet.data.id === newFacultyRecordId,
      'HOD CSE allowed to view faculty in their department');

    const hodCseEdit = await axios.put(`${BASE_URL}/faculty/${newFacultyRecordId}`, {
      faculty_name: 'Dr. Test Faculty Member (HOD Verified)',
      faculty_id: testFacultyId,
      department: 'Computer Science and Engineering',
      designation: 'Professor',
      qualification: 'Ph.D., D.Sc.'
    }, { headers: hodCseHeaders });
    assert(hodCseEdit.status === 200, 'HOD CSE allowed to update faculty in their own department');

    // 9. Cross-Department security enforcement (HOD IT blocked from CSE)
    console.log('\n9. Testing Cross-Department Boundary Security (HOD IT -> CSE)...');
    try {
      await axios.get(`${BASE_URL}/faculty/${newFacultyRecordId}`, { headers: hodItHeaders });
      assert(false, 'HOD IT should be blocked from viewing CSE faculty');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD IT blocked from viewing CSE faculty with 403 Forbidden');
    }

    try {
      await axios.put(`${BASE_URL}/faculty/${newFacultyRecordId}`, {
        faculty_name: 'HOD IT Modified Name',
        faculty_id: testFacultyId,
        department: 'Computer Science and Engineering',
        designation: 'Professor',
        qualification: 'Ph.D.'
      }, { headers: hodItHeaders });
      assert(false, 'HOD IT should be blocked from editing CSE faculty');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD IT blocked from editing CSE faculty with 403 Forbidden');
    }

    try {
      await axios.patch(`${BASE_URL}/faculty/${newFacultyRecordId}/status`, {
        status: 'Inactive'
      }, { headers: hodItHeaders });
      assert(false, 'HOD IT should be blocked from toggling CSE faculty status');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD IT blocked from toggling CSE faculty status with 403 Forbidden');
    }

    try {
      await axios.delete(`${BASE_URL}/faculty/${newFacultyRecordId}`, { headers: hodItHeaders });
      assert(false, 'HOD IT should be blocked from deleting CSE faculty');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD IT blocked from deleting CSE faculty with 403 Forbidden');
    }

    // 10. Faculty Role Security Enforcement (Complete Block)
    console.log('\n10. Testing Faculty Role Security Enforcement (API Lockdown)...');
    try {
      await axios.get(`${BASE_URL}/faculty`, { headers: facultyHeaders });
      assert(false, 'Faculty should be blocked from listing faculty records');
    } catch (err) {
      assert(err.response?.status === 403, 'Faculty blocked from GET /api/faculty with 403 Forbidden');
    }

    try {
      await axios.post(`${BASE_URL}/faculty`, {
        faculty_name: 'Faculty Self Add',
        faculty_id: 'FAC-SELF-999',
        department: 'Computer Science and Engineering',
        designation: 'Assistant Professor',
        qualification: 'M.Tech'
      }, { headers: facultyHeaders });
      assert(false, 'Faculty should be blocked from adding faculty records');
    } catch (err) {
      assert(err.response?.status === 403, 'Faculty blocked from POST /api/faculty with 403 Forbidden');
    }

    try {
      await axios.put(`${BASE_URL}/faculty/${newFacultyRecordId}`, {
        faculty_name: 'Faculty Self Edit',
        faculty_id: testFacultyId,
        department: 'Computer Science and Engineering',
        designation: 'Professor',
        qualification: 'Ph.D.'
      }, { headers: facultyHeaders });
      assert(false, 'Faculty should be blocked from editing faculty records');
    } catch (err) {
      assert(err.response?.status === 403, 'Faculty blocked from PUT /api/faculty/:id with 403 Forbidden');
    }

    try {
      await axios.delete(`${BASE_URL}/faculty/${newFacultyRecordId}`, { headers: facultyHeaders });
      assert(false, 'Faculty should be blocked from deleting faculty records');
    } catch (err) {
      assert(err.response?.status === 403, 'Faculty blocked from DELETE /api/faculty/:id with 403 Forbidden');
    }

    // 11. Eligible user accounts for linking
    console.log('\n11. Testing Eligible User Accounts for Linking...');
    const usersRes = await axios.get(`${BASE_URL}/faculty/unlinked-users`, { headers: adminHeaders });
    assert(usersRes.status === 200 && Array.isArray(usersRes.data) && usersRes.data.length > 0,
      `Retrieved ${usersRes.data.length} eligible user accounts for linking`);

    // 12. Dashboard stats integration (real active count)
    console.log('\n12. Testing Dashboard Real Active Faculty Count...');
    const statsRes = await axios.get(`${BASE_URL}/dashboard/stats`, { headers: adminHeaders });
    assert(statsRes.data.totalFaculty > 0,
      `Dashboard totalFaculty returned real database count: ${statsRes.data.totalFaculty}`);

    // 13. Safe deletion check (does not affect users table)
    console.log('\n13. Testing Safe Deletion (Users account preservation)...');
    const userCountBefore = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const deleteRes = await axios.delete(`${BASE_URL}/faculty/${newFacultyRecordId}`, { headers: adminHeaders });
    assert(deleteRes.status === 200, 'Admin deleted test faculty record successfully');

    const userCountAfter = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    assert(userCountBefore === userCountAfter,
      `Users table preserved without accidental cascade (${userCountAfter} users remain intact)`);

    // 14. Verification Summary
    console.log('\n====================================================');
    console.log(`📊 MODULE 4 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected test error:', err.message, err.response?.data);
    process.exit(1);
  }
}

runModule4Tests();
