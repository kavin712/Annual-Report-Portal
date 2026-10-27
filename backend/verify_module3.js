const axios = require('axios');
const path = require('path');
const { getDb } = require('./database');

const BASE_URL = 'http://localhost:5000/api';

async function runModule3Tests() {
  console.log('====================================================');
  console.log('🚀 RUNNING MODULE 3 VERIFICATION SUITE');
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
    const adminToken = adminLogin.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const hodLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'hod_cse@college.com',
      password: 'hod123'
    });
    const hodToken = hodLogin.data.token;
    const hodHeaders = { Authorization: `Bearer ${hodToken}` };

    const facultyLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'faculty@college.com',
      password: 'faculty123'
    });
    const facultyToken = facultyLogin.data.token;
    const facultyHeaders = { Authorization: `Bearer ${facultyToken}` };
    console.log('   All 3 roles authenticated successfully.\n');

    // 2. Admin registers a new student
    console.log('2. Testing Admin Student Registration...');
    const testRegNo = 'CSE-2022-TEST-' + Date.now();
    let newStudentId = null;

    const createRes = await axios.post(`${BASE_URL}/students`, {
      register_no: testRegNo,
      name: 'Test Verification Student',
      department: 'Computer Science and Engineering',
      academic_year: '2022-26',
      current_year: '4th Year',
      section: 'B',
      email: 'test_student@college.com',
      phone: '9876543210',
      status: 'Active'
    }, { headers: adminHeaders });

    newStudentId = createRes.data.id || createRes.data.student?.id;
    assert(createRes.status === 201 && newStudentId, `Admin registered student successfully (ID: ${newStudentId})`);

    // 3. Duplicate register number rejection
    console.log('\n3. Testing Duplicate Register Number Uniqueness Constraint...');
    try {
      await axios.post(`${BASE_URL}/students`, {
        register_no: testRegNo,
        name: 'Another Student',
        department: 'Computer Science and Engineering',
        academic_year: '2022-26',
        current_year: '4th Year'
      }, { headers: adminHeaders });
      assert(false, 'Duplicate register number should have been rejected');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.error?.includes('already exists'),
        'Duplicate register number rejected with 400 error: ' + err.response?.data?.error);
    }

    // 4. Persistence check
    console.log('\n4. Testing Student Details Persistence...');
    const getRes = await axios.get(`${BASE_URL}/students/${newStudentId}`, { headers: adminHeaders });
    assert(getRes.data.register_no === testRegNo && getRes.data.name === 'Test Verification Student',
      'Student details retrieved and match database record');

    // 5. RBAC: HOD and Faculty blocked from creating/editing students
    console.log('\n5. Testing RBAC: HOD & Faculty permission enforcement...');
    try {
      await axios.post(`${BASE_URL}/students`, {
        register_no: 'HOD-REG-' + Date.now(),
        name: 'HOD Created Student',
        department: 'Computer Science and Engineering'
      }, { headers: hodHeaders });
      assert(false, 'HOD creation should have returned 403');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD student creation blocked with 403 Forbidden');
    }

    try {
      await axios.put(`${BASE_URL}/students/${newStudentId}`, {
        name: 'HOD Modified Student'
      }, { headers: hodHeaders });
      assert(false, 'HOD modification should have returned 403');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD student modification blocked with 403 Forbidden');
    }

    try {
      await axios.post(`${BASE_URL}/students`, {
        register_no: 'FAC-REG-' + Date.now(),
        name: 'Faculty Created Student',
        department: 'Computer Science and Engineering'
      }, { headers: facultyHeaders });
      assert(false, 'Faculty creation should have returned 403');
    } catch (err) {
      assert(err.response?.status === 403, 'Faculty student creation blocked with 403 Forbidden');
    }

    // 6. Search by name & register number
    console.log('\n6. Testing Student Search API (Real DB matches)...');
    const searchNameRes = await axios.get(`${BASE_URL}/students/search?q=Kavin`, { headers: adminHeaders });
    assert(searchNameRes.data.length > 0 && searchNameRes.data[0].name.includes('Kavin'),
      `Search by name ('Kavin') returned real match: ${searchNameRes.data[0]?.name}`);

    const searchRegRes = await axios.get(`${BASE_URL}/students/search?q=CSE-2023-071`, { headers: adminHeaders });
    assert(searchRegRes.data.length > 0 && searchRegRes.data[0].register_no === 'CSE-2023-071',
      `Search by register no ('CSE-2023-071') returned: ${searchRegRes.data[0]?.name}`);

    // 7. Maximum 5 results strictly enforced
    console.log('\n7. Testing Dropdown Limit (Max 5 results)...');
    const broadSearch = await axios.get(`${BASE_URL}/students/search?q=202`, { headers: adminHeaders });
    assert(broadSearch.data.length <= 5 && broadSearch.data.length > 0,
      `Broad search ('202') returned ${broadSearch.data.length} records (strictly <= 5)`);

    // 8. Short query (<2 chars) returns empty
    console.log('\n8. Testing Short Query Handling...');
    const shortSearch = await axios.get(`${BASE_URL}/students/search?q=k`, { headers: adminHeaders });
    assert(shortSearch.data.length === 0, 'Short query (< 2 characters) returned empty array []');

    // 9. Integration with Placement module using student_id
    console.log('\n9. Testing Placement Module Integration with student_id...');
    const placeRes = await axios.post(`${BASE_URL}/placements/records`, {
      student_id: newStudentId,
      company_name: 'Microsoft Research',
      package: 24.5,
      placement_status: 'Placed',
      department: 'Computer Science and Engineering',
      academic_year: '2025-26',
      offer_details: 'Research Intern'
    }, { headers: adminHeaders });

    assert(placeRes.status === 201 && placeRes.data.id,
      `Placement saved with valid student_id: record ID ${placeRes.data.id}`);

    // Verify placement record has student_id linked in DB
    const placedRecord = await axios.get(`${BASE_URL}/placements/records?department=Computer Science and Engineering&academic_year=2025-26`, { headers: adminHeaders });
    const matchRecord = placedRecord.data.find(r => r.id === placeRes.data.id);
    assert(matchRecord && matchRecord.student_id === newStudentId && matchRecord.student_name === 'Test Verification Student',
      `Placement record verified in database with student_id ${matchRecord?.student_id} and name '${matchRecord?.student_name}'`);

    // 10. Rejection of invalid/inactive student_id for placement
    console.log('\n10. Testing Rejection of Invalid student_id...');
    try {
      await axios.post(`${BASE_URL}/placements/records`, {
        student_id: 999999, // nonexistent ID
        company_name: 'Test Corp',
        package: 10,
        placement_status: 'Placed',
        department: 'Computer Science and Engineering',
        academic_year: '2025-26'
      }, { headers: adminHeaders });
      assert(false, 'Invalid student_id should have been rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Invalid student_id rejected with 400 Bad Request');
    }

    // 11. Student Deactivation and Inactive Search/Creation Blocking
    console.log('\n11. Testing Student Deactivation & Inactive Handling...');
    const toggleRes = await axios.patch(`${BASE_URL}/students/${newStudentId}/status`, {
      status: 'Inactive'
    }, { headers: adminHeaders });
    assert(toggleRes.data.status === 'Inactive', 'Admin deactivated student successfully');

    // Inactive student must not appear in search dropdown
    const inactiveSearchRes = await axios.get(`${BASE_URL}/students/search?q=${testRegNo}`, { headers: adminHeaders });
    assert(inactiveSearchRes.data.length === 0, 'Deactivated student does NOT appear in active search dropdown');

    // Inactive student cannot be used for new placement
    try {
      await axios.post(`${BASE_URL}/placements/records`, {
        student_id: newStudentId,
        company_name: 'Oracle Corp',
        package: 12,
        placement_status: 'Placed',
        department: 'Computer Science and Engineering',
        academic_year: '2025-26'
      }, { headers: adminHeaders });
      assert(false, 'Inactive student should be rejected for new placement');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.error?.includes('inactive'),
        'Inactive student rejected for new placement record: ' + err.response?.data?.error);
    }

    // 12. Student Achievement Integration
    console.log('\n12. Testing Student Achievement Integration with student_ref_id...');
    // Reactivate student for achievement test
    await axios.patch(`${BASE_URL}/students/${newStudentId}/status`, { status: 'Active' }, { headers: adminHeaders });

    const achRes = await axios.post(`${BASE_URL}/student-achievements`, {
      student_ref_id: newStudentId,
      achievement_type: 'Technical',
      title: 'Winner - National Smart Hackathon 2025',
      event_organization: 'IIT Madras',
      date: '2025-11-15',
      department: 'Computer Science and Engineering',
      academic_year: '2025-26',
      description: 'Built AI model for environmental monitoring'
    }, { headers: adminHeaders });

    assert(achRes.status === 201 && achRes.data.id,
      `Student achievement saved with student_ref_id: ID ${achRes.data.id}`);

    // Verify history on student detail endpoint
    const historyRes = await axios.get(`${BASE_URL}/students/${newStudentId}`, { headers: adminHeaders });
    assert(historyRes.data.placements?.length > 0 && historyRes.data.achievements?.length > 0,
      `Student detail returns related placement records (${historyRes.data.placements.length}) and achievements (${historyRes.data.achievements.length})`);

    // 13. Department Scoping Enforcement for HOD/Faculty
    console.log('\n13. Testing Department Scoping Enforcement...');
    // HOD CSE searches should only return CSE students
    const hodSearchRes = await axios.get(`${BASE_URL}/students/search?q=202`, { headers: hodHeaders });
    const allCSE = hodSearchRes.data.length > 0 && hodSearchRes.data.every(s => s.department === 'Computer Science and Engineering');
    assert(allCSE, `HOD search is strictly scoped to their department (${hodSearchRes.data.length} CSE students returned)`);

    // Clean up test student
    try {
      const { db } = require('./database');
      db.prepare('DELETE FROM placement_records WHERE student_id = ?').run(newStudentId);
      db.prepare('DELETE FROM student_achievements WHERE student_ref_id = ?').run(newStudentId);
      db.prepare('DELETE FROM students WHERE id = ?').run(newStudentId);
    } catch (e) {}

    // 14. Verification Summary
    console.log('\n====================================================');
    console.log(`📊 MODULE 3 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
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

runModule3Tests();
