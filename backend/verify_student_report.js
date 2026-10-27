const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { db } = require('./database');

const BASE_URL = 'http://localhost:5000/api';

async function runStudentReportTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING INDIVIDUAL STUDENT REPORT VERIFICATION');
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
    console.log('   Users authenticated.\n');

    // 2. Search student for report builder
    console.log('2. Testing Student Search for Report Builder...');
    const searchRes = await axios.get(`${BASE_URL}/students/search?q=Aarav`, { headers: adminHeaders });
    assert(searchRes.data.length > 0 && searchRes.data[0].name === 'Aarav Kumar',
      `Found registered student: ${searchRes.data[0]?.name} (${searchRes.data[0]?.register_no})`);

    const studentId = searchRes.data[0].id;
    const studentDept = searchRes.data[0].department;

    // 3. Retrieve student report summary & approved counts
    console.log('\n3. Testing Student Report Summary & Counts API...');
    const summaryRes = await axios.get(`${BASE_URL}/reports/student/summary/${studentId}`, { headers: adminHeaders });
    assert(summaryRes.data.success && summaryRes.data.student && summaryRes.data.counts,
      `Retrieved summary: ${summaryRes.data.counts?.placements} placement(s), ${summaryRes.data.counts?.achievements} achievement(s)`);

    // 4. Department boundary enforcement on summary
    console.log('\n4. Testing Department Boundary on Summary Endpoint...');
    // HOD CSE can view CSE student summary
    const hodCseSummary = await axios.get(`${BASE_URL}/reports/student/summary/${studentId}`, { headers: hodCseHeaders });
    assert(hodCseSummary.status === 200, 'HOD CSE allowed to access CSE student summary');

    // HOD IT blocked from CSE student summary
    try {
      await axios.get(`${BASE_URL}/reports/student/summary/${studentId}`, { headers: hodItHeaders });
      assert(false, 'HOD IT should be blocked from CSE student summary');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD IT blocked from viewing CSE student summary with 403 Forbidden');
    }

    // 5. Generate Individual Student History PDF
    console.log('\n5. Testing Individual Student History PDF Generation...');
    const generateRes = await axios.post(`${BASE_URL}/reports/student/generate`, {
      student_id: studentId,
      academic_year: 'All',
      selected_sections: [
        'Student Profile',
        'Academic Information',
        'Placement History',
        'Student Achievements',
        'Department Activities'
      ]
    }, { headers: adminHeaders });

    assert(generateRes.status === 201 && generateRes.data.report?.id,
      `Student PDF generated successfully: Report ID ${generateRes.data.report?.id}`);
    assert(generateRes.data.report?.fileName?.startsWith('Student_History_'),
      `Safe filename generated: ${generateRes.data.report?.fileName}`);
    assert(generateRes.data.report?.fileSize > 2000,
      `Valid non-empty PDF file generated (${generateRes.data.report?.fileSize} bytes)`);

    const reportId = generateRes.data.report.id;

    // 6. Test PDF Download endpoint
    console.log('\n6. Testing Secure PDF Download Endpoint...');
    const downloadRes = await axios.get(`${BASE_URL}/reports/${reportId}/download`, {
      headers: adminHeaders,
      responseType: 'arraybuffer'
    });

    assert(downloadRes.status === 200, 'Download endpoint returned 200 OK');
    assert(downloadRes.headers['content-type'] === 'application/pdf', 'Response has Content-Type: application/pdf');
    assert(downloadRes.data.length > 2000, `Downloaded PDF payload is intact (${downloadRes.data.length} bytes)`);

    // 7. Test unapproved/pending records exclusion
    console.log('\n7. Testing Unapproved / Pending Records Exclusion...');
    // Add a pending achievement for this student
    const pendingAchResult = db.prepare(`
      INSERT INTO student_achievements (
        student_ref_id, student_name, student_id, department, academic_year,
        achievement_type, title, event_organization, date, status, submitted_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      studentId, 'Aarav Kumar', 'CSE-2022-041', 'Computer Science and Engineering', '2025-26',
      'Technical', 'Unapproved Test Hackathon Draft', 'Test Org', '2025-10-01', 'Pending Approval', 'Faculty'
    );

    // Summary count should NOT include Pending Approval records
    const summaryAfterPending = await axios.get(`${BASE_URL}/reports/student/summary/${studentId}`, { headers: adminHeaders });
    assert(summaryAfterPending.data.counts.achievements === summaryRes.data.counts.achievements,
      `Pending achievement correctly excluded from approved count (${summaryAfterPending.data.counts.achievements} approved)`);

    // Cleanup pending achievement
    db.prepare('DELETE FROM student_achievements WHERE id = ?').run(pendingAchResult.lastInsertRowid);

    // 8. Cross-department generation security
    console.log('\n8. Testing Cross-Department Generation Authorization...');
    try {
      await axios.post(`${BASE_URL}/reports/student/generate`, {
        student_id: studentId,
        academic_year: 'All'
      }, { headers: hodItHeaders });
      assert(false, 'HOD IT should be blocked from generating CSE student report');
    } catch (err) {
      assert(err.response?.status === 403, 'HOD IT blocked from generating CSE student report with 403 Forbidden');
    }

    // 9. Student with empty history generates gracefully
    console.log('\n9. Testing Empty History Student Handling...');
    const emptyStudent = db.prepare("SELECT id, name, register_no FROM students WHERE name = 'Pooja Sundaram'").get();
    if (emptyStudent) {
      const emptyGenRes = await axios.post(`${BASE_URL}/reports/student/generate`, {
        student_id: emptyStudent.id,
        academic_year: 'All'
      }, { headers: adminHeaders });

      assert(emptyGenRes.status === 201 && emptyGenRes.data.report?.fileSize > 1000,
        `Student with no prior history generated PDF gracefully (${emptyGenRes.data.report?.fileName})`);
    }

    // 10. Regression check: Option A (Institute Annual Report) still functions
    console.log('\n10. Testing Option A: Institute Annual Report Regression...');
    const instituteGenRes = await axios.post(`${BASE_URL}/reports/generate`, {
      reportTitle: 'Verification Institute Annual Report 2025-26',
      academicYear: '2025-26',
      selectedDepartments: ['Computer Science and Engineering'],
      selectedSections: ['Department Information', 'Student Achievements', 'Placement Summary']
    }, { headers: adminHeaders });

    assert(instituteGenRes.status === 201 && instituteGenRes.data.report?.id,
      `Institute Annual Report (Option A) generated successfully: ID ${instituteGenRes.data.report?.id}`);

    // Verification Summary
    console.log('\n====================================================');
    console.log(`📊 STUDENT REPORT VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
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

runStudentReportTests();
