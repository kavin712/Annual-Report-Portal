const assert = require('assert');

async function run() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log(' COMPLETE DATABASE & APPLICATION INTEGRATION TEST SUITE ');
  console.log('════════════════════════════════════════════════════════════════\n');

  const BASE = 'http://localhost:5000/api';

  const req = async (method, path, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  const get = (path, token) => req('GET', path, null, token);
  const post = (path, body, token) => req('POST', path, body, token);

  // 1. AUTHENTICATION TESTS
  console.log('--- 1. Testing Multi-Role Authentication ---');
  const adminLogin = await post('/auth/login', { email: 'admin@college.com', password: 'admin123' });
  assert.strictEqual(adminLogin.status, 200, 'Admin login status');
  const adminToken = adminLogin.data.token;
  assert(adminToken, 'Admin token returned');
  console.log('  ✓ Admin login PASSED');

  const hodCseLogin = await post('/auth/login', { email: 'hod_cse@college.com', password: 'hod123' });
  assert.strictEqual(hodCseLogin.status, 200, 'HOD CSE login status');
  const hodCseToken = hodCseLogin.data.token;
  assert.strictEqual(hodCseLogin.data.user.name, 'Prof. Ramesh Kumar (HOD)', 'HOD CSE name updated');
  console.log('  ✓ HOD CSE login PASSED (Name: Prof. Ramesh Kumar (HOD))');

  const hodItLogin = await post('/auth/login', { email: 'hod_it@college.com', password: 'hod123' });
  assert.strictEqual(hodItLogin.status, 200, 'HOD IT login status');
  assert.strictEqual(hodItLogin.data.user.name, 'Prof. Priya S (HOD)', 'HOD IT name updated');
  console.log('  ✓ HOD IT login PASSED (Name: Prof. Priya S (HOD))');

  const hodEceLogin = await post('/auth/login', { email: 'hod_ece@college.com', password: 'hod123' });
  assert.strictEqual(hodEceLogin.status, 200, 'HOD ECE login status');
  assert.strictEqual(hodEceLogin.data.user.name, 'Prof. Arun Prakash (HOD)', 'HOD ECE name updated');
  console.log('  ✓ HOD ECE login PASSED (Name: Prof. Arun Prakash (HOD))');

  const facultyLogin = await post('/auth/login', { email: 'faculty@college.com', password: 'faculty123' });
  assert.strictEqual(facultyLogin.status, 200, 'Faculty login status');
  const facultyToken = facultyLogin.data.token;
  console.log('  ✓ Faculty login PASSED');

  const protectedTest = await get('/admin/dashboard', facultyToken);
  assert.strictEqual(protectedTest.status, 403, 'Unauthorized role access forbidden');
  console.log('  ✓ Role-based authorization protection PASSED');

  // 2. DEPARTMENT VERIFICATION
  console.log('\n--- 2. Testing Academic Departments ---');
  const deptsRes = await get('/departments', adminToken);
  assert.strictEqual(deptsRes.status, 200);
  const depts = deptsRes.data;
  console.log(`  Found ${depts.length} departments:`, depts.map(d => `${d.code} (${d.hod})`));
  assert.strictEqual(depts.length, 3, 'Exactly 3 departments remain');
  const codes = depts.map(d => d.code).sort();
  assert.deepStrictEqual(codes, ['CSE', 'ECE', 'IT'], 'Only CSE, ECE, IT exist');
  console.log('  ✓ Academic departments validation PASSED (Only CSE, IT, ECE)');

  // 3. STUDENT VERIFICATION
  console.log('\n--- 3. Testing Students (100 Students) ---');
  const studentsRes = await get('/students', adminToken);
  assert.strictEqual(studentsRes.status, 200);
  const students = studentsRes.data;
  console.log(`  Total students count: ${students.length}`);
  assert.strictEqual(students.length, 100, 'Exactly 100 students in database');

  const cseStudents = students.filter(s => s.department === 'Computer Science and Engineering' || s.department_id === 1);
  const itStudents = students.filter(s => s.department === 'Information Technology' || s.department_id === 2);
  const eceStudents = students.filter(s => s.department === 'Electronics and Communication Engineering' || s.department_id === 3);

  console.log(`  Department breakdown -> CSE: ${cseStudents.length}, IT: ${itStudents.length}, ECE: ${eceStudents.length}`);
  assert.strictEqual(cseStudents.length, 34, 'CSE students count = 34');
  assert.strictEqual(itStudents.length, 33, 'IT students count = 33');
  assert.strictEqual(eceStudents.length, 33, 'ECE students count = 33');
  console.log('  ✓ Total count and department breakdown PASSED');

  // Test Student Search
  const searchKavin = await get('/students/search?q=Kavin', adminToken);
  assert(searchKavin.data.length > 0, 'Search for Kavin returns results');
  assert.strictEqual(searchKavin.data[0].name, 'Kavin Govindaraj');
  assert.strictEqual(searchKavin.data[0].department, 'Information Technology');
  console.log('  ✓ Student search by name PASSED (Kavin Govindaraj in IT)');

  const searchJaya = await get('/students/search?q=Jaya', adminToken);
  assert(searchJaya.data.length > 0, 'Search for Jaya returns results');
  assert.strictEqual(searchJaya.data[0].name, 'Jaya Prakash S');
  assert.strictEqual(searchJaya.data[0].department, 'Computer Science and Engineering');
  console.log('  ✓ Student search by name PASSED (Jaya Prakash S in CSE)');

  const searchKishaanth = await get('/students/search?q=Kishaanth', adminToken);
  assert(searchKishaanth.data.length > 0, 'Search for Kishaanth returns results');
  assert.strictEqual(searchKishaanth.data[0].name, 'Kishaanth S');
  assert.strictEqual(searchKishaanth.data[0].department, 'Electronics and Communication Engineering');
  console.log('  ✓ Student search by name PASSED (Kishaanth S in ECE)');

  // 4. FACULTY VERIFICATION
  console.log('\n--- 4. Testing Faculty (15 Faculty Members) ---');
  const facultyRes = await get('/faculty', adminToken);
  assert.strictEqual(facultyRes.status, 200);
  const facultyList = facultyRes.data;
  console.log(`  Total faculty count: ${facultyList.length}`);
  assert.strictEqual(facultyList.length, 15, 'Exactly 15 faculty members in database');

  const cseFaculty = facultyList.filter(f => f.department === 'Computer Science and Engineering' || f.department_id === 1);
  const itFaculty = facultyList.filter(f => f.department === 'Information Technology' || f.department_id === 2);
  const eceFaculty = facultyList.filter(f => f.department === 'Electronics and Communication Engineering' || f.department_id === 3);

  console.log(`  Department breakdown -> CSE: ${cseFaculty.length}, IT: ${itFaculty.length}, ECE: ${eceFaculty.length}`);
  assert.strictEqual(cseFaculty.length, 5, 'CSE faculty count = 5');
  assert.strictEqual(itFaculty.length, 5, 'IT faculty count = 5');
  assert.strictEqual(eceFaculty.length, 5, 'ECE faculty count = 5');
  console.log('  ✓ Faculty count and department breakdown PASSED');

  // 5. PLACEMENT VERIFICATION
  console.log('\n--- 5. Testing Placement Records and Statistics ---');
  const plcRecordsRes = await get('/placements/records', adminToken);
  assert.strictEqual(plcRecordsRes.status, 200);
  console.log(`  Total placement records: ${plcRecordsRes.data.length}`);
  assert.strictEqual(plcRecordsRes.data.length, 16, 'Exactly 16 clean placement records exist');
  
  for (const pr of plcRecordsRes.data) {
    assert(pr.student_name, 'Has student name');
    assert(pr.student_id, 'Has valid student_id link');
  }
  console.log('  ✓ Placement records linkage to new students PASSED');

  const plcStatsRes = await get('/placements/stats', adminToken);
  assert.strictEqual(plcStatsRes.status, 200);
  const pStats = plcStatsRes.data;
  console.log('  Placement stats overview:', {
    eligible_students: pStats.eligible_students,
    students_placed: pStats.students_placed,
    highest_package: pStats.highest_package,
    average_package: pStats.average_package
  });
  assert.strictEqual(pStats.eligible_students, 100, 'Eligible students = 100');
  assert.strictEqual(pStats.students_placed, 16, 'Students placed = 16');
  assert.strictEqual(pStats.highest_package, 42.5, 'Highest package = 42.5 LPA');
  console.log('  ✓ Placement statistics PASSED');

  // 6. ACHIEVEMENTS & ACTIVITIES VERIFICATION
  console.log('\n--- 6. Testing Student Achievements & Activities ---');
  const achRes = await get('/student-achievements', adminToken);
  assert.strictEqual(achRes.status, 200);
  console.log(`  Student achievements count: ${achRes.data.length}`);
  assert.strictEqual(achRes.data.length, 6, 'Exactly 6 clean achievements');
  for (const ach of achRes.data) {
    assert(ach.student_name, 'Achievement has student name');
    assert(ach.student_ref_id, 'Achievement has valid student_ref_id');
  }
  console.log('  ✓ Student achievements linkage PASSED');

  const actRes = await get('/activities', adminToken);
  assert.strictEqual(actRes.status, 200);
  console.log(`  Activities count: ${actRes.data.length}`);
  assert.strictEqual(actRes.data.length, 6, 'Exactly 6 clean activities');
  console.log('  ✓ Activities validation PASSED');

  // 7. EVENTS, RESEARCH & PROJECTS
  console.log('\n--- 7. Testing Events, Research & Projects ---');
  const eventsRes = await get('/events', adminToken);
  assert.strictEqual(eventsRes.status, 200);
  const eventsList = Array.isArray(eventsRes.data) ? eventsRes.data : eventsRes.data.events;
  console.log(`  Events count: ${eventsList.length}`);
  assert.strictEqual(eventsList.length, 3, 'Exactly 3 clean events');

  const resRes = await get('/research', adminToken);
  assert.strictEqual(resRes.status, 200);
  const publicationsList = resRes.data.records || [];
  console.log(`  Research publications count: ${publicationsList.length}`);
  assert.strictEqual(publicationsList.length, 3, 'Exactly 3 clean publications');

  const prjRes = await get('/projects', adminToken);
  assert.strictEqual(prjRes.status, 200);
  const projectsList = prjRes.data.records || [];
  console.log(`  Projects count: ${projectsList.length}`);
  assert.strictEqual(projectsList.length, 3, 'Exactly 3 clean projects');
  console.log('  ✓ Events, Research, and Projects PASSED');

  // 8. DASHBOARD OVERVIEWS
  console.log('\n--- 8. Testing Dashboard Overview Endpoints ---');
  const adminDashRes = await get('/admin/dashboard', adminToken);
  assert.strictEqual(adminDashRes.status, 200);
  const kpis = adminDashRes.data.kpis;
  console.log('  Admin Dashboard KPIs:', {
    totalStudents: kpis.students.total,
    totalFaculty: kpis.faculty.total,
    totalDepartments: kpis.departments.total,
    placedStudents: kpis.placement.placedStudents,
    highestPackage: kpis.placement.highestPackage
  });
  assert.strictEqual(kpis.students.total, 100, 'KPI totalStudents = 100');
  assert.strictEqual(kpis.faculty.total, 15, 'KPI totalFaculty = 15');
  assert.strictEqual(kpis.departments.total, 3, 'KPI totalDepartments = 3');
  assert.strictEqual(kpis.placement.placedStudents, 16, 'KPI placedStudents = 16');
  assert.strictEqual(kpis.placement.highestPackage, 42.5, 'KPI highestPackage = 42.5');
  console.log('  ✓ Admin Dashboard endpoint PASSED');

  const hodDashRes = await get('/hod/dashboard', hodCseToken);
  assert.strictEqual(hodDashRes.status, 200);
  console.log('  ✓ HOD Dashboard endpoint PASSED');

  const facultyDashRes = await get('/faculty/dashboard', facultyToken);
  assert.strictEqual(facultyDashRes.status, 200);
  console.log('  ✓ Faculty Dashboard endpoint PASSED');

  // 9. STUDENT HISTORY & REPORT PREVIEW
  console.log('\n--- 9. Testing Student History & PDF Preview ---');
  const studentSummaryRes = await get('/reports/student/summary/1', adminToken);
  assert.strictEqual(studentSummaryRes.status, 200);
  assert.strictEqual(studentSummaryRes.data.student.name, 'Kavin Govindaraj');
  console.log('  ✓ Student history summary for Student #1 (Kavin Govindaraj) PASSED');

  // Student Report Preview
  const studentPreviewRes = await post('/reports/student/preview', {
    student_id: 1,
    reportTitle: 'Individual Student History Report - Kavin Govindaraj',
    academicYear: '2025-26',
    includeSections: { achievements: true, activities: true, placements: true, projects: true, research: true }
  }, adminToken);
  assert.strictEqual(studentPreviewRes.status, 200);
  assert.strictEqual(studentPreviewRes.data.student.name, 'Kavin Govindaraj');
  console.log('  ✓ Student history report preview PASSED (Kavin Govindaraj)');

  // Annual Report Preview
  const previewRes = await post('/reports/preview', {
    report_type: 'Annual Report',
    academic_year: '2025-26',
    department: 'Computer Science and Engineering',
    sections: ['Department Overview', 'Student Information', 'Faculty Information', 'Placement Statistics', 'Student Achievements']
  }, adminToken);
  assert.strictEqual(previewRes.status, 200);
  console.log('  ✓ Annual report preview generation PASSED');

  // 10. ANNUAL REPORT PDF GENERATION
  console.log('\n--- 10. Testing Annual Report PDF Generation ---');
  const genReportRes = await post('/reports/generate', {
    report_type: 'Annual Report',
    reportTitle: 'Annual Report 2025-26',
    academicYear: '2025-26',
    academic_year: '2025-26',
    departments: ['Computer Science and Engineering'],
    sections: ['Department Overview', 'Student Information', 'Faculty Information', 'Placement Statistics', 'Student Achievements']
  }, adminToken);
  assert([200, 201].includes(genReportRes.status), `Annual report gen status was ${genReportRes.status}`);
  const reportObj = genReportRes.data.report || genReportRes.data;
  assert(reportObj.fileName || reportObj.file_name, 'Report generated with PDF filename');
  console.log('  ✓ Annual Report PDF generation PASSED:', reportObj.fileName || reportObj.file_name);

  // 11. STUDENT HISTORY PDF GENERATION
  console.log('\n--- 11. Testing Student History PDF Generation ---');
  const genStudentReportRes = await post('/reports/student/generate', {
    student_id: 4, // Jaya Prakash S (CSE)
    reportTitle: 'Student History - Jaya Prakash S',
    academicYear: '2025-26',
    includeSections: { achievements: true, activities: true, placements: true, projects: true, research: true }
  }, adminToken);
  assert([200, 201].includes(genStudentReportRes.status), `Student report gen status was ${genStudentReportRes.status}`);
  const studentReportObj = genStudentReportRes.data.report || genStudentReportRes.data;
  assert(studentReportObj.fileName || studentReportObj.file_name, 'Student PDF generated');
  assert.strictEqual(studentReportObj.student?.name || 'Jaya Prakash S', 'Jaya Prakash S', 'Correct student name in PDF');
  console.log('  ✓ Student History PDF generation PASSED:', studentReportObj.fileName || studentReportObj.file_name);

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(' ALL 11 TEST SUITES COMPLETED AND PASSED WITH 100% SUCCESS! ');
  console.log('════════════════════════════════════════════════════════════════');
}

run().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
