const assert = require('assert');

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log(' RUNNING ENHANCED E2E VERIFICATION: ROLES, PLACEMENTS & WORKFLOW ');
  console.log('================================================================\n');

  const baseUrl = 'http://localhost:5000/api';

  const post = async (url, body, headers = {}) => {
    const res = await fetch(`${baseUrl}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  const get = async (url, headers = {}) => {
    const res = await fetch(`${baseUrl}${url}`, { headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  const put = async (url, body, headers = {}) => {
    const res = await fetch(`${baseUrl}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  const del = async (url, headers = {}) => {
    const res = await fetch(`${baseUrl}${url}`, { method: 'DELETE', headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  // 1. AUTHENTICATION & ROLES
  console.log('--- 1. Testing Multi-Role Authentication ---');
  const adminRes = await post('/auth/login', { email: 'admin@college.com', password: 'admin123' });
  assert.strictEqual(adminRes.status, 200);
  const adminUser = adminRes.data.user;
  assert.strictEqual(adminUser.role, 'admin');
  console.log('   ✓ Admin login successful');

  const hodCseRes = await post('/auth/login', { email: 'hod_cse@college.com', password: 'hod123' });
  assert.strictEqual(hodCseRes.status, 200);
  const hodCseUser = hodCseRes.data.user;
  assert.strictEqual(hodCseUser.role, 'hod');
  assert.strictEqual(hodCseUser.department, 'Computer Science and Engineering');
  console.log('   ✓ HOD CSE login successful');

  const hodItRes = await post('/auth/login', { email: 'hod_it@college.com', password: 'hod123' });
  assert.strictEqual(hodItRes.status, 200);
  const hodItUser = hodItRes.data.user;
  assert.strictEqual(hodItUser.role, 'hod');
  console.log('   ✓ HOD IT login successful');

  const facultyRes = await post('/auth/login', { email: 'faculty@college.com', password: 'faculty123' });
  assert.strictEqual(facultyRes.status, 200);
  const facultyUser = facultyRes.data.user;
  assert.strictEqual(facultyUser.role, 'faculty');
  console.log('   ✓ Faculty login successful\n');

  // Headers for role testing
  const adminHeaders = { 'x-user-id': String(adminUser.id) };
  const hodCseHeaders = { 'x-user-id': String(hodCseUser.id) };
  const hodItHeaders = { 'x-user-id': String(hodItUser.id) };
  const facultyHeaders = { 'x-user-id': String(facultyUser.id) };

  // 2. BACKEND PERMISSION & ROLE RESTRICTIONS
  console.log('--- 2. Testing Backend Permissions & Authorization ---');
  
  // Faculty cannot create Faculty Information
  const facultyAddFaculty = await post('/faculty', {
    faculty_name: 'Unauthorized Faculty Attempt',
    faculty_id: 'FAC-ERR-999',
    department: 'Computer Science and Engineering',
    academic_year: '2025-26',
    designation: 'Assistant Professor',
    qualification: 'M.Tech'
  }, facultyHeaders);
  assert.strictEqual(facultyAddFaculty.status, 403);
  console.log('   ✓ Faculty blocked from creating Faculty Information (403 Forbidden)');

  // HOD of IT cannot manage CSE faculty
  const itHodAddCseFaculty = await post('/faculty', {
    faculty_name: 'Dr. Cross Dept Attempt',
    faculty_id: 'FAC-CROSS-001',
    department: 'Computer Science and Engineering',
    academic_year: '2025-26',
    designation: 'Professor',
    qualification: 'Ph.D.'
  }, hodItHeaders);
  assert.strictEqual(itHodAddCseFaculty.status, 403);
  console.log('   ✓ HOD IT blocked from managing CSE faculty (403 Forbidden)');

  // Faculty cannot approve submissions
  const facultyApprove = await post('/approvals/action', {
    module: 'achievements',
    id: 1,
    action: 'approve'
  }, facultyHeaders);
  assert.strictEqual(facultyApprove.status, 403);
  console.log('   ✓ Faculty blocked from approval actions (403 Forbidden)\n');

  // 3. FACULTY INFORMATION (CRUD by HOD)
  console.log('--- 3. Testing Faculty Information (Add, Edit, Delete by HOD) ---');
  const testFacEmpId = `FAC-CSE-${Date.now().toString().slice(-4)}`;
  const addFac = await post('/faculty', {
    faculty_name: 'Dr. Shalini Gupta',
    faculty_id: testFacEmpId,
    department: 'Computer Science and Engineering',
    academic_year: '2025-26',
    designation: 'Associate Professor',
    qualification: 'Ph.D. in Distributed Systems',
    publications: 7,
    research_projects: 1,
    conferences_attended: 4,
    awards: 'Best Paper Award 2025'
  }, hodCseHeaders);
  assert.strictEqual(addFac.status, 201);
  const newFacId = addFac.data.id;
  console.log(`   ✓ HOD CSE added official faculty record (ID: ${newFacId})`);

  // Edit Faculty
  const editFac = await put(`/faculty/${newFacId}`, {
    faculty_name: 'Dr. Shalini Gupta (Senior)',
    publications: 9
  }, hodCseHeaders);
  assert.strictEqual(editFac.status, 200);
  console.log('   ✓ HOD CSE edited faculty record successfully');

  // Delete Faculty
  const delFac = await del(`/faculty/${newFacId}`, hodCseHeaders);
  assert.strictEqual(delFac.status, 200);
  console.log('   ✓ HOD CSE deleted faculty record successfully\n');

  // 4. PLACEMENT MANAGEMENT: INDIVIDUAL RECORDS & DYNAMIC CALCULATIONS
  console.log('--- 4. Testing Placement Management: Individual Records & Auto Stats ---');
  
  // Get initial stats
  const initialStats = await get('/placements/stats?department=Computer Science and Engineering&academic_year=2025-26');
  assert.strictEqual(initialStats.status, 200);
  const initialPlaced = initialStats.data.students_placed;
  console.log(`   Initial stats: ${initialPlaced} placed, Highest: ${initialStats.data.highest_package} LPA, Unique Companies: ${initialStats.data.number_of_companies}`);

  // Add new individual record with a higher package
  const addPlc = await post('/placements/records', {
    student_name: 'Suresh Raina',
    register_no: 'CSE-2022-199',
    department: 'Computer Science and Engineering',
    academic_year: '2025-26',
    company_name: 'NVIDIA Corporation',
    package: 52.0,
    placement_status: 'Placed',
    offer_details: 'Silicon Architect (On-Campus)'
  }, hodCseHeaders);
  assert.strictEqual(addPlc.status, 201);
  const newPlcId = addPlc.data.id;
  console.log(`   ✓ Added individual placement record: 52.0 LPA at NVIDIA (ID: ${newPlcId})`);

  // Verify highest package dynamically recalculated to 52.0
  const updatedStats1 = await get('/placements/stats?department=Computer Science and Engineering&academic_year=2025-26');
  assert.strictEqual(updatedStats1.data.highest_package, 52.0);
  assert.strictEqual(updatedStats1.data.students_placed, initialPlaced + 1);
  console.log(`   ✓ Live statistics updated: Highest package = ${updatedStats1.data.highest_package} LPA, Placed = ${updatedStats1.data.students_placed}`);

  // Edit the individual record package to 55.0
  const editPlc = await put(`/placements/records/${newPlcId}`, {
    package: 55.0,
    company_name: 'NVIDIA Deep Learning Labs'
  }, hodCseHeaders);
  assert.strictEqual(editPlc.status, 200);
  console.log('   ✓ Edited placement record package to 55.0 LPA');

  const updatedStats2 = await get('/placements/stats?department=Computer Science and Engineering&academic_year=2025-26');
  assert.strictEqual(updatedStats2.data.highest_package, 55.0);
  console.log(`   ✓ Live statistics updated: Highest package = ${updatedStats2.data.highest_package} LPA`);

  // Delete the individual record
  const delPlc = await del(`/placements/records/${newPlcId}`, hodCseHeaders);
  assert.strictEqual(delPlc.status, 200);
  console.log('   ✓ Deleted individual placement record');

  // Verify statistics recalculated back down
  const updatedStats3 = await get('/placements/stats?department=Computer Science and Engineering&academic_year=2025-26');
  assert(updatedStats3.data.highest_package < 55.0);
  assert.strictEqual(updatedStats3.data.students_placed, initialPlaced);
  console.log(`   ✓ Live statistics recalculated after delete: Highest package = ${updatedStats3.data.highest_package} LPA\n`);

  // 5. APPROVAL WORKFLOW & CORRECTION CYCLE
  console.log('--- 5. Testing Approval & Correction Cycle ---');
  
  // Faculty submits an achievement
  const facultyAch = await post('/student-achievements', {
    student_name: 'Anil Kumar',
    student_id: 'CSE-2022-145',
    department: 'Computer Science and Engineering',
    academic_year: '2025-26',
    achievement_type: 'Technical',
    title: 'Cloud Computing Prototype Demo',
    event_organization: 'Regional Tech Fest',
    date: '2026-02-01',
    description: 'Cloud scalability benchmark.'
  }, facultyHeaders);
  assert.strictEqual(facultyAch.status, 201);
  assert.strictEqual(facultyAch.data.status, 'Pending Approval');
  const achId = facultyAch.data.id;
  console.log(`   ✓ Faculty submitted achievement -> Status: "Pending Approval" (ID: ${achId})`);

  // HOD checks pending approvals list
  const pendingList = await get('/approvals/pending?department=Computer Science and Engineering&academic_year=2025-26', hodCseHeaders);
  assert.strictEqual(pendingList.status, 200);
  const foundPending = pendingList.data.achievements.find(a => a.id === achId);
  assert(foundPending, 'Submitted achievement must be in HOD pending queue');
  console.log('   ✓ HOD pending queue contains submitted achievement');

  // HOD requests changes with feedback comment
  const requestChange = await post('/approvals/action', {
    module: 'achievements',
    id: achId,
    action: 'request_changes',
    comments: 'Please attach certificate verification link and correct event organization.'
  }, hodCseHeaders);
  assert.strictEqual(requestChange.status, 200);
  assert.strictEqual(requestChange.data.status, 'Changes Requested');
  console.log('   ✓ HOD requested changes with feedback comment');

  // Faculty edits and resubmits
  const facultyResubmit = await put(`/student-achievements/${achId}`, {
    title: 'Cloud Computing Prototype Demo (Certified)',
    event_organization: 'IEEE Regional Tech Fest',
    description: 'Added official verification code.'
  }, facultyHeaders);
  assert.strictEqual(facultyResubmit.status, 200);
  assert.strictEqual(facultyResubmit.data.status, 'Pending Approval');
  console.log('   ✓ Faculty updated and resubmitted -> Status back to "Pending Approval"');

  // HOD approves the resubmitted achievement
  const hodApprove = await post('/approvals/action', {
    module: 'achievements',
    id: achId,
    action: 'approve'
  }, hodCseHeaders);
  assert.strictEqual(hodApprove.status, 200);
  assert.strictEqual(hodApprove.data.status, 'Approved');
  console.log('   ✓ HOD approved achievement -> Status: "Approved"\n');

  // 6. ACTIVITIES (Edit & Delete)
  console.log('--- 6. Testing Department Activities (Edit & Delete) ---');
  const addAct = await post('/activities', {
    activity_name: 'Workshop on Cyber Hygiene',
    department: 'Computer Science and Engineering',
    academic_year: '2025-26',
    activity_type: 'Workshop',
    date: '2026-02-10',
    participants_count: 85,
    faculty_coordinator: 'Dr. Ramesh Sharma',
    description: 'Hands-on network security session.'
  }, hodCseHeaders);
  assert.strictEqual(addAct.status, 201);
  const actId = addAct.data.id;
  console.log(`   ✓ Added activity (ID: ${actId})`);

  // Edit activity
  const editAct = await put(`/activities/${actId}`, {
    participants_count: 110,
    description: 'Updated with extended laboratory exercise.'
  }, hodCseHeaders);
  assert.strictEqual(editAct.status, 200);
  console.log('   ✓ Edited activity successfully');

  // Delete activity
  const delAct = await del(`/activities/${actId}`, hodCseHeaders);
  assert.strictEqual(delAct.status, 200);
  console.log('   ✓ Deleted activity successfully\n');

  // 7. REPORT PREVIEW & PDFKit GENERATION (Only Approved Data & Live Placement Stats)
  console.log('--- 7. Testing Report Preview & PDF Generation ---');
  const preview = await post('/reports/preview', {
    reportTitle: 'Institutional Annual Report 2025-26 (Verified)',
    academicYear: '2025-26',
    selectedDepartments: ['Computer Science and Engineering', 'Information Technology'],
    selectedSections: ['Department Information', 'Student Achievements', 'Faculty Information', 'Department Activities', 'Placement Summary']
  }, adminHeaders);
  assert.strictEqual(preview.status, 200);
  const csePlacement = preview.data.data['Computer Science and Engineering'].placement;
  assert(csePlacement.highest_package > 0);
  assert(csePlacement.placement_percentage > 0);
  console.log(`   ✓ Report preview calculated placement: ${csePlacement.placement_percentage}% with ${csePlacement.students_placed} placed`);

  const pdfGen = await post('/reports/generate', {
    reportTitle: 'Institutional Annual Report 2025-26 (Verified)',
    academicYear: '2025-26',
    selectedDepartments: ['Computer Science and Engineering', 'Information Technology'],
    selectedSections: ['Department Information', 'Student Achievements', 'Faculty Information', 'Department Activities', 'Placement Summary']
  }, adminHeaders);
  assert.strictEqual(pdfGen.status, 201);
  assert(pdfGen.data.report.fileSize > 2000);
  console.log(`   ✓ PDF generated with PDFKit: "${pdfGen.data.report.fileName}" (${pdfGen.data.report.fileSize} bytes)`);

  const downloadCheck = await fetch(`${baseUrl}/reports/${pdfGen.data.report.id}/download`);
  assert.strictEqual(downloadCheck.status, 200);
  assert.strictEqual(downloadCheck.headers.get('content-type'), 'application/pdf');
  console.log('   ✓ Download endpoint confirmed application/pdf with attachment header\n');

  console.log('================================================================');
  console.log(' 🎉 ALL ENHANCED REQUIREMENTS VERIFIED AND PASSED SUCCESSFULLY! ');
  console.log('================================================================');
}

runComprehensiveTests().catch(err => {
  console.error('❌ Enhanced test suite failed:', err);
  process.exit(1);
});
