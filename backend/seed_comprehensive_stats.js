/**
 * Comprehensive Statistical Data Seeder
 * Populates realistic, internally consistent statistical records for all 100 students
 * Across:
 *  - Placements (Placed students, packages, multiple offers, unplaced status)
 *  - Student Achievements (Technical competitions, hackathons, certifications, sports, cultural, research)
 *  - Department Activities & Events with student junction participation
 *  - Projects & Research Publications with student links
 *
 * Rules:
 *  - Preserves 100 students, 15 faculty, and 3 departments (CSE, IT, ECE)
 *  - All records strictly foreign-keyed to valid student IDs
 *  - Clearly tagged as Sample/Demo data
 *  - Idempotent: checks for existing sample records and avoids duplicates
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'annual_report.db');
const db = new DatabaseSync(dbPath);

console.log('=== Starting Statistical Data Seeding ===');

// Verify master data
const students = db.prepare('SELECT id, register_no, name, department_id, department FROM students ORDER BY id ASC').all();
const faculty = db.prepare('SELECT id, faculty_id, faculty_name, department_id, department FROM faculty ORDER BY id ASC').all();
const departments = db.prepare('SELECT id, code, name FROM departments ORDER BY id ASC').all();

console.log(`Found ${students.length} students, ${faculty.length} faculty, ${departments.length} departments.`);
if (students.length !== 100) {
  console.warn(`WARNING: Expected 100 students, found ${students.length}`);
}

const cseStudents = students.filter(s => s.department_id === 1);
const itStudents = students.filter(s => s.department_id === 2);
const eceStudents = students.filter(s => s.department_id === 3);

console.log(`Student distribution: CSE=${cseStudents.length}, IT=${itStudents.length}, ECE=${eceStudents.length}`);

// Target Academic Year
const targetYear = '2025-26';

// ---------------------------------------------------------------------
// 1. SEED PLACEMENTS
// Target: ~70 unique placed students (CSE: 24/34, IT: 24/33, ECE: 22/33)
// Yields realistic placement percentages (~70% CSE, ~72% IT, ~66% ECE; Overall ~70%)
// Some students will have multiple offers (e.g. Dream + Super Dream)
// Remaining 30 students remain unplaced or opted for higher studies/entrepreneurship.
// ---------------------------------------------------------------------

const companies = [
  { name: 'Google India', role: 'Software Engineer', pkg: 42.5, type: 'Dream' },
  { name: 'Microsoft India', role: 'Software Development Engineer', pkg: 38.0, type: 'Dream' },
  { name: 'Amazon AWS', role: 'Cloud Support Associate', pkg: 32.0, type: 'Dream' },
  { name: 'Cisco Systems', role: 'Network Software Engineer', pkg: 24.0, type: 'Dream' },
  { name: 'Qualcomm', role: 'Hardware/Firmware Engineer', pkg: 22.5, type: 'Dream' },
  { name: 'Texas Instruments', role: 'Embedded Systems Engineer', pkg: 21.0, type: 'Dream' },
  { name: 'Oracle India', role: 'Member Technical Staff', pkg: 18.5, type: 'Core' },
  { name: 'Zoho Corporation', role: 'Software Developer', pkg: 8.5, type: 'Core' },
  { name: 'Cognizant (GenC Elevate)', role: 'Digital Specialist Engineer', pkg: 6.5, type: 'Mass' },
  { name: 'TCS (Digital)', role: 'Systems Engineer', pkg: 7.2, type: 'Mass' },
  { name: 'TCS (Ninja)', role: 'Assistant System Engineer', pkg: 4.2, type: 'Mass' },
  { name: 'Infosys (Power Programmer)', role: 'Specialist Programmer', pkg: 9.5, type: 'Core' },
  { name: 'Infosys (SE)', role: 'Systems Engineer', pkg: 4.0, type: 'Mass' },
  { name: 'Wipro Technologies', role: 'Project Engineer', pkg: 4.5, type: 'Mass' },
  { name: 'Robert Bosch', role: 'Embedded Software Engineer', pkg: 10.0, type: 'Core' },
  { name: 'Schneider Electric', role: 'Graduate Engineer Trainee', pkg: 7.5, type: 'Core' },
  { name: 'L&T Technology Services', role: 'Design Engineer', pkg: 5.5, type: 'Core' }
];

console.log('\n--- Seeding Placement Records ---');
const insertPlacementStmt = db.prepare(`
  INSERT INTO placement_records (
    student_name, register_no, department, academic_year, company_name, package,
    placement_status, offer_details, status, submitted_by, submitted_by_name,
    student_id, department_id, job_role, location, placement_date, offer_type,
    submitted_at, reviewed_by, reviewed_by_name, reviewed_at, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    DATETIME('now'), 1, 'Institutional Administrator', DATETIME('now'), DATETIME('now'), DATETIME('now')
  )
`);

// Check existing placements
const existingPlacements = db.prepare('SELECT student_id, company_name FROM placement_records').all();
const existingPlacementKeys = new Set(existingPlacements.map(p => `${p.student_id}_${p.company_name?.toLowerCase()}`));

let placementsAdded = 0;

function assignPlacementsForDept(studentList, deptName, deptId, countToPlace) {
  for (let i = 0; i < countToPlace && i < studentList.length; i++) {
    const student = studentList[i];
    
    // Choose appropriate company based on department and student index
    let comp1;
    if (deptId === 1) { // CSE
      comp1 = companies[i % 12]; // top tech & mass
    } else if (deptId === 2) { // IT
      comp1 = companies[(i + 2) % 13];
    } else { // ECE
      // bias towards Qualcomm, TI, Bosch, Cisco, Schneider
      const eceCompanies = [companies[4], companies[5], companies[3], companies[14], companies[15], companies[16], companies[7], companies[8], companies[9], companies[10]];
      comp1 = eceCompanies[i % eceCompanies.length];
    }

    const key1 = `${student.id}_${comp1.name.toLowerCase()}`;
    if (!existingPlacementKeys.has(key1)) {
      insertPlacementStmt.run(
        student.name,
        student.register_no,
        deptName,
        targetYear,
        comp1.name,
        comp1.pkg,
        'Placed',
        `Offer Letter Ref: ${comp1.name.substring(0, 3).toUpperCase()}-2025-${student.id} (Sample Data)`,
        'Approved',
        1,
        'Institutional Administrator',
        student.id,
        deptId,
        comp1.role,
        'Bengaluru / Chennai',
        '2025-11-15',
        comp1.type
      );
      existingPlacementKeys.add(key1);
      placementsAdded++;
    }

    // Top 4 students in each department get a second offer (multiple offers)
    if (i < 4) {
      let comp2 = (deptId === 3) ? companies[14] : companies[7]; // Bosch or Zoho
      const key2 = `${student.id}_${comp2.name.toLowerCase()}`;
      if (!existingPlacementKeys.has(key2)) {
        insertPlacementStmt.run(
          student.name,
          student.register_no,
          deptName,
          targetYear,
          comp2.name,
          comp2.pkg,
          'Placed',
          `Second Offer Ref: ${comp2.name.substring(0, 3).toUpperCase()}-2025-${student.id}-B (Sample Data)`,
          'Approved',
          1,
          'Institutional Administrator',
          student.id,
          deptId,
          comp2.role,
          'Chennai',
          '2025-12-05',
          'Core'
        );
        existingPlacementKeys.add(key2);
        placementsAdded++;
      }
    }
  }
}

// 24 CSE students placed, 24 IT students placed, 22 ECE students placed (Total 70 placed, 30 unplaced)
assignPlacementsForDept(cseStudents, 'Computer Science and Engineering', 1, 24);
assignPlacementsForDept(itStudents, 'Information Technology', 2, 24);
assignPlacementsForDept(eceStudents, 'Electronics and Communication Engineering', 3, 22);

console.log(`Placements added in this run: ${placementsAdded}`);

// ---------------------------------------------------------------------
// 2. SEED STUDENT ACHIEVEMENTS
// Target: ~45 realistic achievements across Hackathons, Technical Competitions,
// Certifications, Sports, Cultural, Research Paper Presentations.
// ---------------------------------------------------------------------
console.log('\n--- Seeding Student Achievements ---');

const achievementTemplates = [
  { category: 'Hackathon', type: 'Hackathon', level: 'National', award: '1st Prize', title: 'Smart India Hackathon (SIH 2025) Winner in AI Category', org: 'Ministry of Education & AICTE' },
  { category: 'Hackathon', type: 'Hackathon', level: 'National', award: 'Finalist', title: 'Hack-o-Heist 36-Hour Hackathon Finalist', org: 'IIT Madras Shaastra' },
  { category: 'Competition', type: 'Technical Competition', level: 'National', award: '1st Prize', title: 'National CodeQuest Algorithmic Challenge Winner', org: 'IEEE Computer Society' },
  { category: 'Competition', type: 'Technical Competition', level: 'State', award: '2nd Prize', title: 'State Level Web Design & UI/UX Sprint', org: 'Anna University Techfest' },
  { category: 'Competition', type: 'Technical Competition', level: 'National', award: '3rd Prize', title: 'Autonomous Robotics Obstacle Navigation Challenge', org: 'RoboTech National Symposium' },
  { category: 'Certification', type: 'Certification', level: 'International', award: 'Certified Professional', title: 'AWS Certified Solutions Architect - Associate', org: 'Amazon Web Services (AWS)' },
  { category: 'Certification', type: 'Certification', level: 'International', award: 'Certified Professional', title: 'Google Associate Cloud Engineer Certification', org: 'Google Cloud Platform' },
  { category: 'Certification', type: 'Certification', level: 'National', award: 'Elite + Gold', title: 'NPTEL Course on Deep Learning & NLP (Top 1%)', org: 'IIT Kharagpur / SWAYAM' },
  { category: 'Paper Presentation', type: 'Research Publication', level: 'International', award: 'Best Paper Award', title: 'Best Paper on Edge AI for Precision Agriculture', org: 'IEEE International Conference on Smart Systems (ICISS)' },
  { category: 'Sports', type: 'Sports', level: 'Inter-Collegiate', award: 'Winner / Gold Medal', title: 'Inter-Collegiate Badminton Championship Singles Winner', org: 'Zonal Sports Board' },
  { category: 'Sports', type: 'Sports', level: 'State', award: 'Runner Up', title: 'State Level Inter-University Table Tennis Tournament', org: 'Tamil Nadu Sports Development' },
  { category: 'Cultural', type: 'Cultural', level: 'Inter-Collegiate', award: '1st Prize', title: 'Annual Inter-College Western Music Solo Championship', org: 'Culturals Fest 2025' },
  { category: 'Awards', type: 'Award', level: 'Institute', award: 'Special Recognition', title: 'Dean’s Academic Excellence & Innovation Recognition', org: 'Institution Academic Council' }
];

const insertAchievementStmt = db.prepare(`
  INSERT INTO student_achievements (
    student_name, student_id, department, academic_year, achievement_type,
    title, event_organization, date, description, created_at, status,
    submitted_by, submitted_by_name, reviewed_by, review_comments,
    student_ref_id, category, event_name, level, award, department_id,
    updated_at, submitted_at, reviewed_by_name, reviewed_at
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, DATETIME('now'), 'Approved',
    1, 'Institutional Administrator', 1, 'Verified official credential (Sample Data)',
    ?, ?, ?, ?, ?, ?,
    DATETIME('now'), DATETIME('now'), 'Institutional Administrator', DATETIME('now')
  )
`);

const existingAchievements = db.prepare('SELECT student_ref_id, title FROM student_achievements').all();
const existingAchKeys = new Set(existingAchievements.map(a => `${a.student_ref_id}_${a.title?.toLowerCase()}`));

let achievementsAdded = 0;

function assignAchievementsForDept(studentList, deptName, deptId, count) {
  for (let i = 0; i < count && i < studentList.length; i++) {
    const student = studentList[i];
    const tmpl = achievementTemplates[(i * 3 + deptId) % achievementTemplates.length];
    const key = `${student.id}_${tmpl.title.toLowerCase()}`;

    if (!existingAchKeys.has(key)) {
      insertAchievementStmt.run(
        student.name,
        student.register_no,
        deptName,
        targetYear,
        tmpl.type,
        tmpl.title,
        tmpl.org,
        '2025-09-20',
        `Sample achievement record for student ${student.name} (${student.register_no}). Verified for annual report showcase.`,
        student.id,
        tmpl.category,
        tmpl.org,
        tmpl.level,
        tmpl.award,
        deptId
      );
      existingAchKeys.add(key);
      achievementsAdded++;
    }
  }
}

// 15 CSE, 15 IT, 14 ECE = 44 total achievements
assignAchievementsForDept(cseStudents, 'Computer Science and Engineering', 1, 15);
assignAchievementsForDept(itStudents, 'Information Technology', 2, 15);
assignAchievementsForDept(eceStudents, 'Electronics and Communication Engineering', 3, 14);

console.log(`Achievements added in this run: ${achievementsAdded}`);

// ---------------------------------------------------------------------
// 3. SEED DEPARTMENT ACTIVITIES & EVENTS
// Ensure each department has rich workshops, seminars, and hackathons
// Link participating students through `activity_students` and `event_students`
// ---------------------------------------------------------------------
console.log('\n--- Seeding Activities, Events & Student Links ---');

const sampleActivities = [
  // CSE Activities
  {
    deptId: 1,
    deptName: 'Computer Science and Engineering',
    name: 'Hands-on Workshop on Generative AI & LLM Fine-Tuning',
    type: 'Workshop',
    date: '2025-08-18',
    count: 20,
    facCoord: 'Prof. Ramesh Kumar',
    facId: 1,
    desc: 'Intensive 2-day technical workshop covering PyTorch, Hugging Face transformers, and LLM quantization (Sample Data).'
  },
  {
    deptId: 1,
    deptName: 'Computer Science and Engineering',
    name: 'National Level Technical Symposium: CYBERBLAZE 2025',
    type: 'Technical Symposium',
    date: '2025-10-14',
    count: 25,
    facCoord: 'Prof. Meena Devi',
    facId: 2,
    desc: 'Annual flagship symposium hosting coding challenges, web-a-thon, and technical paper presentations (Sample Data).'
  },
  {
    deptId: 1,
    deptName: 'Computer Science and Engineering',
    name: 'Expert Lecture on Cloud Microservices & Kubernetes',
    type: 'Guest Lecture',
    date: '2025-11-05',
    count: 18,
    facCoord: 'Prof. Senthil Kumar P',
    facId: 3,
    desc: 'Industry guest lecture by Principal Cloud Architect from AWS (Sample Data).'
  },
  // IT Activities
  {
    deptId: 2,
    deptName: 'Information Technology',
    name: 'DevSecOps & CI/CD Pipeline Bootcamp',
    type: 'Bootcamp',
    date: '2025-08-25',
    count: 22,
    facCoord: 'Prof. Priya S',
    facId: 6,
    desc: 'Hands-on training session on automated security testing, Docker, and GitHub Actions (Sample Data).'
  },
  {
    deptId: 2,
    deptName: 'Information Technology',
    name: 'State Level Coding Marathon: CODE-A-THON 2025',
    type: 'Coding Contest',
    date: '2025-09-30',
    count: 24,
    facCoord: 'Prof. Karthikeyan R',
    facId: 7,
    desc: '12-hour continuous algorithmic contest testing data structures and dynamic programming (Sample Data).'
  },
  {
    deptId: 2,
    deptName: 'Information Technology',
    name: 'Seminar on Blockchain & Decentralized Identity Protocols',
    type: 'Seminar',
    date: '2025-11-12',
    count: 16,
    facCoord: 'Prof. Deepa V',
    facId: 8,
    desc: 'Technical talk exploring Ethereum smart contracts and zero-knowledge proofs (Sample Data).'
  },
  // ECE Activities
  {
    deptId: 3,
    deptName: 'Electronics and Communication Engineering',
    name: 'VLSI Chip Design & Verification using Cadence Tools',
    type: 'Workshop',
    date: '2025-09-08',
    count: 20,
    facCoord: 'Prof. Arun Prakash',
    facId: 11,
    desc: '3-day practical training on ASIC synthesis and digital design verification (Sample Data).'
  },
  {
    deptId: 3,
    deptName: 'Electronics and Communication Engineering',
    name: 'Industrial IoT & Sensor Networks Hands-on Workshop',
    type: 'Workshop',
    date: '2025-10-22',
    count: 22,
    facCoord: 'Prof. Sangeetha M',
    facId: 12,
    desc: 'Practical lab with ESP32, MQTT protocols, and cloud IoT dashboards (Sample Data).'
  },
  {
    deptId: 3,
    deptName: 'Electronics and Communication Engineering',
    name: 'Technical Symposium: ELECTROSPARK 2025',
    type: 'Technical Symposium',
    date: '2025-11-20',
    count: 25,
    facCoord: 'Prof. Rajesh K',
    facId: 13,
    desc: 'Circuit debugging competitions, paper presentations, and robotic maze solver events (Sample Data).'
  }
];

const insertActivityStmt = db.prepare(`
  INSERT INTO activities (
    activity_name, department, academic_year, activity_type, date,
    participants_count, faculty_coordinator, description, created_at,
    status, submitted_by, submitted_by_name, reviewed_by, review_comments,
    venue, organizer, coordinator, coordinator_faculty_id, department_id,
    updated_at, submitted_at, reviewed_by_name, reviewed_at
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, DATETIME('now'),
    'Approved', 1, 'Institutional Administrator', 1, 'Approved departmental event (Sample Data)',
    'Campus Auditorium & Labs', 'Department Association', ?, ?, ?,
    DATETIME('now'), DATETIME('now'), 'Institutional Administrator', DATETIME('now')
  )
`);

const insertActivityStudentStmt = db.prepare(`
  INSERT OR IGNORE INTO activity_students (activity_id, student_id, created_at)
  VALUES (?, ?, DATETIME('now'))
`);

const existingActivities = db.prepare('SELECT id, activity_name, department_id FROM activities').all();
const existingActNames = new Set(existingActivities.map(a => a.activity_name?.toLowerCase()));

let activitiesAdded = 0;
let actStudentsAdded = 0;

for (const act of sampleActivities) {
  let actId;
  if (!existingActNames.has(act.name.toLowerCase())) {
    const res = insertActivityStmt.run(
      act.name,
      act.deptName,
      targetYear,
      act.type,
      act.date,
      act.count,
      act.facCoord,
      act.desc,
      act.facCoord,
      act.facId,
      act.deptId
    );
    actId = res.lastInsertRowid;
    existingActNames.add(act.name.toLowerCase());
    activitiesAdded++;
  } else {
    const found = existingActivities.find(a => a.activity_name?.toLowerCase() === act.name.toLowerCase());
    actId = found?.id;
  }

  // Link students from this department
  if (actId) {
    const deptStudents = (act.deptId === 1) ? cseStudents : (act.deptId === 2 ? itStudents : eceStudents);
    // Link up to 18 students per activity to reflect high participation
    for (let k = 0; k < Math.min(18, deptStudents.length); k++) {
      try {
        insertActivityStudentStmt.run(actId, deptStudents[k].id);
        actStudentsAdded++;
      } catch (e) {
        // Ignore unique constraint
      }
    }
  }
}

console.log(`Activities added: ${activitiesAdded}, Activity-Student links added: ${actStudentsAdded}`);

// ---------------------------------------------------------------------
// 4. SEED EVENTS
// Flagship College Events with cross-department student links
// ---------------------------------------------------------------------
console.log('\n--- Seeding Flagship Events & Student Links ---');

const sampleEvents = [
  {
    name: 'ANNUAL TECHFEST — INNOVEX 2025',
    type: 'College Annual Fest',
    deptId: 1,
    deptName: 'Computer Science and Engineering',
    date: '2025-10-28',
    count: 85,
    coord: 'Prof. Ramesh Kumar',
    coordId: 1,
    desc: 'Annual institution-wide technical festival with inter-college hackathon, project expo, and competitive programming (Sample Data).'
  },
  {
    name: 'NATIONAL CONFERENCE ON ADVANCES IN COMPUTING (NCAC 2025)',
    type: 'Conference',
    deptId: 2,
    deptName: 'Information Technology',
    date: '2025-11-18',
    count: 65,
    coord: 'Prof. Priya S',
    coordId: 6,
    desc: 'National conference featuring peer-reviewed research papers and keynote addresses from IEEE fellows (Sample Data).'
  },
  {
    name: 'ELECTRO-INNOVATION SUMMIT & HARDWARE EXPO 2025',
    type: 'Exhibition',
    deptId: 3,
    deptName: 'Electronics and Communication Engineering',
    date: '2025-12-02',
    count: 70,
    coord: 'Prof. Arun Prakash',
    coordId: 11,
    desc: 'Showcase of student-built IoT, embedded electronics, and smart hardware prototypes (Sample Data).'
  }
];

const insertEventStmt = db.prepare(`
  INSERT INTO events (
    event_name, event_type, description, department_id, department,
    event_date, start_time, end_time, venue, organizer,
    coordinator, coordinator_faculty_id, academic_year, event_status,
    participants_count, external_guests, status, submitted_by,
    submitted_by_name, submitted_at, reviewed_by, reviewed_by_name,
    reviewed_at, review_comments, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, '09:00 AM', '05:00 PM', 'Institutional Convention Centre', 'Institution Academic Council',
    ?, ?, ?, 'Completed',
    ?, 'Dr. S. Ramanathan, Director of Tech Research', 'Approved', 1,
    'Institutional Administrator', DATETIME('now'), 1, 'Institutional Administrator',
    DATETIME('now'), 'Institutional signature event verified (Sample Data)', DATETIME('now'), DATETIME('now')
  )
`);

const insertEventStudentStmt = db.prepare(`
  INSERT OR IGNORE INTO event_students (event_id, student_id, created_at)
  VALUES (?, ?, DATETIME('now'))
`);

const existingEvents = db.prepare('SELECT id, event_name FROM events').all();
const existingEventNames = new Set(existingEvents.map(e => e.event_name?.toLowerCase()));

let eventsAdded = 0;
let eventStudentsAdded = 0;

for (const evt of sampleEvents) {
  let evtId;
  if (!existingEventNames.has(evt.name.toLowerCase())) {
    const res = insertEventStmt.run(
      evt.name,
      evt.type,
      evt.desc,
      evt.deptId,
      evt.deptName,
      evt.date,
      evt.coord,
      evt.coordId,
      targetYear,
      evt.count
    );
    evtId = res.lastInsertRowid;
    existingEventNames.add(evt.name.toLowerCase());
    eventsAdded++;
  } else {
    const found = existingEvents.find(e => e.event_name?.toLowerCase() === evt.name.toLowerCase());
    evtId = found?.id;
  }

  if (evtId) {
    // Link ~25 students from each department to make institute-wide event
    for (let k = 0; k < 15; k++) {
      if (k < cseStudents.length) {
        insertEventStudentStmt.run(evtId, cseStudents[k].id);
        eventStudentsAdded++;
      }
      if (k < itStudents.length) {
        insertEventStudentStmt.run(evtId, itStudents[k].id);
        eventStudentsAdded++;
      }
      if (k < eceStudents.length) {
        insertEventStudentStmt.run(evtId, eceStudents[k].id);
        eventStudentsAdded++;
      }
    }
  }
}

console.log(`Events added: ${eventsAdded}, Event-Student links added: ${eventStudentsAdded}`);

// ---------------------------------------------------------------------
// 5. SEED PROJECTS & RESEARCH PUBLICATIONS
// ---------------------------------------------------------------------
console.log('\n--- Seeding Capstone Projects & Publications ---');

const sampleProjects = [
  {
    title: 'Autonomous Drone Navigation using Edge AI and Computer Vision',
    deptId: 1,
    deptName: 'Computer Science and Engineering',
    category: 'AI & Robotics',
    funding: 150000,
    sponsor: 'DST-SERB Student Research Grant',
    guide: 'Prof. Ramesh Kumar',
    students: [cseStudents[0], cseStudents[1], cseStudents[2]]
  },
  {
    title: 'Zero-Knowledge Cryptographic Authentication for Healthcare Records',
    deptId: 2,
    deptName: 'Information Technology',
    category: 'Cybersecurity',
    funding: 120000,
    sponsor: 'Industry Sponsored (Cognizant Technology Solutions)',
    guide: 'Prof. Priya S',
    students: [itStudents[0], itStudents[1], itStudents[2]]
  },
  {
    title: 'Low-Power LoRaWAN Smart Agriculture Sensor Mesh with Solar Harvesting',
    deptId: 3,
    deptName: 'Electronics and Communication Engineering',
    category: 'IoT & Embedded',
    funding: 180000,
    sponsor: 'Tamil Nadu State Council for Science and Technology (TNSCST)',
    guide: 'Prof. Arun Prakash',
    students: [eceStudents[0], eceStudents[1], eceStudents[2]]
  }
];

const insertProjectStmt = db.prepare(`
  INSERT INTO projects (
    title, project_title, department_id, department, academic_year,
    project_type, project_category, project_guide, funding_agency, funding_amount,
    awards_recognition, status, submitted_by, submitted_by_name,
    reviewed_by, reviewed_by_name, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?,
    'Sponsored Research / Capstone', ?, ?, ?, ?,
    'National Student Innovation Award (Sample Data)', 'Approved', 1, 'Institutional Administrator',
    1, 'Institutional Administrator', DATETIME('now'), DATETIME('now')
  )
`);

const insertProjectStudentStmt = db.prepare(`
  INSERT OR IGNORE INTO project_students (project_id, student_id, role, created_at)
  VALUES (?, ?, ?, DATETIME('now'))
`);

const existingProjects = db.prepare('SELECT id, COALESCE(project_title, title) as title FROM projects').all();
const existingProjTitles = new Set(existingProjects.map(p => p.title?.toLowerCase()));

let projectsAdded = 0;
for (const prj of sampleProjects) {
  let prjId;
  if (!existingProjTitles.has(prj.title.toLowerCase())) {
    const res = insertProjectStmt.run(
      prj.title,
      prj.title,
      prj.deptId,
      prj.deptName,
      targetYear,
      prj.category,
      prj.guide,
      prj.sponsor,
      prj.funding
    );
    prjId = res.lastInsertRowid;
    existingProjTitles.add(prj.title.toLowerCase());
    projectsAdded++;
  } else {
    const found = existingProjects.find(p => p.title?.toLowerCase() === prj.title.toLowerCase());
    prjId = found?.id;
  }

  if (prjId && prj.students) {
    prj.students.forEach((s, idx) => {
      if (s) {
        insertProjectStudentStmt.run(prjId, s.id, idx === 0 ? 'Team Lead' : 'Core Researcher');
      }
    });
  }
}

console.log(`Projects added: ${projectsAdded}`);

// ---------------------------------------------------------------------
// SUMMARY OF DATABASE RECONCILIATION
// ---------------------------------------------------------------------
console.log('\n=== Seeding Completed Successfully! ===');
const finalStudentCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
const finalFacultyCount = db.prepare('SELECT COUNT(*) as c FROM faculty').get().c;
const finalDeptCount = db.prepare('SELECT COUNT(*) as c FROM departments').get().c;
const finalPlcCount = db.prepare('SELECT COUNT(*) as c FROM placement_records').get().c;
const finalAchCount = db.prepare('SELECT COUNT(*) as c FROM student_achievements').get().c;
const finalActCount = db.prepare('SELECT COUNT(*) as c FROM activities').get().c;
const finalEvCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
const finalPrjCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;

console.log(`Summary of master data:`);
console.log(` - Students: ${finalStudentCount} (Expected 100)`);
console.log(` - Faculty: ${finalFacultyCount} (Expected 15)`);
console.log(` - Departments: ${finalDeptCount} (Expected 3)`);
console.log(`Summary of statistical records:`);
console.log(` - Placements: ${finalPlcCount} records`);
console.log(` - Achievements: ${finalAchCount} records`);
console.log(` - Activities: ${finalActCount} records`);
console.log(` - Events: ${finalEvCount} records`);
console.log(` - Projects: ${finalPrjCount} records`);
