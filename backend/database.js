const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { hashPassword } = require('./services/auth');

// Centralized database connection with error handling
let db;
try {
  // Ensure directory exists
  const dbDir = path.dirname(config.DATABASE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new DatabaseSync(config.DATABASE_PATH);
  // Enable foreign keys and WAL mode for high concurrency & integrity
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  console.log(`[Database] Connected successfully to SQLite database at: ${config.DATABASE_PATH}`);
} catch (err) {
  console.error('[Database] Failed to open SQLite database:', err.message);
  throw err;
}

/**
 * Execute operations within an atomic SQLite transaction
 * @param {Function} fn
 * @returns {*}
 */
function withTransaction(fn) {
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = fn(db);
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function initDatabase() {
  try {
    // Create base tables safely
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL, -- 'admin', 'hod', 'faculty'
        department TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        hod TEXT,
        established_year INTEGER
      );

      CREATE TABLE IF NOT EXISTS department_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_code TEXT NOT NULL,
        department_name TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        hod TEXT NOT NULL,
        total_students INTEGER DEFAULT 0,
        male_students INTEGER DEFAULT 0,
        female_students INTEGER DEFAULT 0,
        total_faculty INTEGER DEFAULT 0,
        courses_count INTEGER DEFAULT 0,
        projects_count INTEGER DEFAULT 0,
        publications_count INTEGER DEFAULT 0,
        events_count INTEGER DEFAULT 0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(department_code, academic_year)
      );

      CREATE TABLE IF NOT EXISTS student_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_name TEXT NOT NULL,
        student_id TEXT NOT NULL,
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        achievement_type TEXT NOT NULL,
        title TEXT NOT NULL,
        event_organization TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'Approved',
        submitted_by INTEGER,
        submitted_by_name TEXT,
        reviewed_by INTEGER,
        review_comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS faculty (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        faculty_name TEXT NOT NULL,
        faculty_id TEXT NOT NULL,
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        designation TEXT NOT NULL,
        qualification TEXT NOT NULL,
        publications INTEGER DEFAULT 0,
        research_projects INTEGER DEFAULT 0,
        conferences_attended INTEGER DEFAULT 0,
        awards TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_name TEXT NOT NULL,
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        date TEXT NOT NULL,
        participants_count INTEGER DEFAULT 0,
        faculty_coordinator TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'Approved',
        submitted_by INTEGER,
        submitted_by_name TEXT,
        reviewed_by INTEGER,
        review_comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS placement_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_name TEXT NOT NULL,
        register_no TEXT NOT NULL,
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        company_name TEXT NOT NULL,
        package REAL DEFAULT 0,
        placement_status TEXT NOT NULL,
        offer_details TEXT,
        status TEXT DEFAULT 'Approved',
        submitted_by INTEGER,
        submitted_by_name TEXT,
        reviewed_by INTEGER,
        review_comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS placement_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        eligible_students INTEGER DEFAULT 0,
        students_placed INTEGER DEFAULT 0,
        highest_package REAL DEFAULT 0,
        average_package REAL DEFAULT 0,
        companies_visited INTEGER DEFAULT 0,
        placement_percentage REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(department, academic_year)
      );

      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        register_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department_id INTEGER,
        department TEXT NOT NULL,
        academic_year TEXT,
        current_year INTEGER DEFAULT 1,
        section TEXT,
        email TEXT,
        phone TEXT,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS generated_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_title TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        departments TEXT NOT NULL,
        sections TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        created_by TEXT,
        status TEXT DEFAULT 'Completed',
        generated_date DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activity_students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(activity_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS activity_faculty (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(activity_id, faculty_id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT,
        department_id INTEGER REFERENCES departments(id),
        department TEXT NOT NULL,
        event_date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        venue TEXT,
        organizer TEXT,
        coordinator TEXT,
        coordinator_faculty_id INTEGER REFERENCES faculty(id),
        academic_year TEXT NOT NULL,
        event_status TEXT DEFAULT 'Scheduled',
        participants_count INTEGER DEFAULT 0,
        external_guests TEXT,
        document_path TEXT,
        status TEXT DEFAULT 'Approved',
        submitted_by INTEGER REFERENCES users(id),
        submitted_by_name TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_by_name TEXT,
        reviewed_at DATETIME,
        review_comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS event_faculty (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, faculty_id)
      );

      CREATE TABLE IF NOT EXISTS approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_type TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        reviewer_id INTEGER REFERENCES users(id),
        reviewer_name TEXT,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS research_publications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        research_category TEXT,
        publication_type TEXT NOT NULL,
        author_names TEXT,
        department_id INTEGER REFERENCES departments(id),
        department TEXT NOT NULL,
        journal_conference_name TEXT,
        publisher TEXT,
        publication_date TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        doi TEXT,
        research_area TEXT,
        funding_agency TEXT,
        funding_amount REAL DEFAULT 0,
        document_path TEXT,
        status TEXT DEFAULT 'Pending Approval',
        submitted_by INTEGER REFERENCES users(id),
        submitted_by_name TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_by_name TEXT,
        reviewed_at DATETIME,
        review_comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS research_students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        research_id INTEGER NOT NULL REFERENCES research_publications(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(research_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS research_faculty (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        research_id INTEGER NOT NULL REFERENCES research_publications(id) ON DELETE CASCADE,
        faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(research_id, faculty_id)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_title TEXT NOT NULL,
        description TEXT,
        project_category TEXT NOT NULL,
        project_type TEXT NOT NULL,
        department_id INTEGER REFERENCES departments(id),
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        start_date TEXT,
        completion_date TEXT,
        coordinator TEXT,
        coordinator_faculty_id INTEGER REFERENCES faculty(id),
        project_status TEXT DEFAULT 'Ongoing',
        funding_agency TEXT,
        funding_amount REAL DEFAULT 0,
        industry_partner TEXT,
        competition_name TEXT,
        awards_recognition TEXT,
        project_url TEXT,
        document_path TEXT,
        status TEXT DEFAULT 'Pending Approval',
        submitted_by INTEGER REFERENCES users(id),
        submitted_by_name TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_by_name TEXT,
        reviewed_at DATETIME,
        review_comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS project_faculty (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, faculty_id)
      );

    `);

    // Clean up unnecessary infrastructure and equipment tables safely if present
    try {
      db.exec('DROP TABLE IF EXISTS facility_equipment;');
      db.exec('DROP TABLE IF EXISTS infrastructure_facilities;');
    } catch (e) {
      // Ignored if already removed
    }

    // Safe schema migrations
    runMigrations();

    // Migrate plain-text passwords to secure hashes
    migrateUserPasswords();

    // Seed synthetic data
    seedSyntheticData();
  } catch (err) {
    console.error('[Database] Initialization error:', err);
    throw err;
  }
}

function runMigrations() {
  const addColumnIfNotExists = (tableName, columnName, columnDef) => {
    try {
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      const exists = columns.some((c) => c.name === columnName);
      if (!exists) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
        console.log(`[Migration] Added column ${columnName} to table ${tableName}`);
      }
    } catch (e) {
      console.warn(`[Migration] Could not add column ${columnName} to ${tableName}:`, e.message);
    }
  };

  addColumnIfNotExists('users', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  addColumnIfNotExists('student_achievements', 'status', "TEXT DEFAULT 'Approved'");
  addColumnIfNotExists('student_achievements', 'submitted_by', 'INTEGER');
  addColumnIfNotExists('student_achievements', 'submitted_by_name', 'TEXT');
  addColumnIfNotExists('student_achievements', 'submitted_at', 'DATETIME');
  addColumnIfNotExists('student_achievements', 'reviewed_by', 'INTEGER');
  addColumnIfNotExists('student_achievements', 'reviewed_by_name', 'TEXT');
  addColumnIfNotExists('student_achievements', 'reviewed_at', 'DATETIME');
  addColumnIfNotExists('student_achievements', 'review_comments', 'TEXT');

  addColumnIfNotExists('activities', 'status', "TEXT DEFAULT 'Approved'");
  addColumnIfNotExists('activities', 'submitted_by', 'INTEGER');
  addColumnIfNotExists('activities', 'submitted_by_name', 'TEXT');
  addColumnIfNotExists('activities', 'submitted_at', 'DATETIME');
  addColumnIfNotExists('activities', 'reviewed_by', 'INTEGER');
  addColumnIfNotExists('activities', 'reviewed_by_name', 'TEXT');
  addColumnIfNotExists('activities', 'reviewed_at', 'DATETIME');
  addColumnIfNotExists('activities', 'review_comments', 'TEXT');

  addColumnIfNotExists('placement_records', 'status', "TEXT DEFAULT 'Approved'");
  addColumnIfNotExists('placement_records', 'submitted_by', 'INTEGER');
  addColumnIfNotExists('placement_records', 'submitted_by_name', 'TEXT');
  addColumnIfNotExists('placement_records', 'reviewed_by', 'INTEGER');
  addColumnIfNotExists('placement_records', 'review_comments', 'TEXT');

  // Module 2: Department Management Schema Updates
  addColumnIfNotExists('departments', 'description', 'TEXT');
  addColumnIfNotExists('departments', 'hod_user_id', 'INTEGER');
  addColumnIfNotExists('departments', 'status', "TEXT DEFAULT 'Active'");
  addColumnIfNotExists('departments', 'created_at', 'DATETIME');
  addColumnIfNotExists('departments', 'updated_at', 'DATETIME');

  addColumnIfNotExists('users', 'department_id', 'INTEGER');

  // Module 3: Student Management Schema Updates
  addColumnIfNotExists('placement_records', 'student_id', 'INTEGER');
  addColumnIfNotExists('student_achievements', 'student_ref_id', 'INTEGER');
  addColumnIfNotExists('activities', 'student_ref_id', 'INTEGER');

  // Module 4: Faculty Information Management Schema Updates
  addColumnIfNotExists('faculty', 'user_id', 'INTEGER');
  addColumnIfNotExists('faculty', 'department_id', 'INTEGER');
  addColumnIfNotExists('faculty', 'specialization', 'TEXT');
  addColumnIfNotExists('faculty', 'date_of_joining', 'TEXT');
  addColumnIfNotExists('faculty', 'email', 'TEXT');
  addColumnIfNotExists('faculty', 'phone', 'TEXT');
  addColumnIfNotExists('faculty', 'status', "TEXT DEFAULT 'Active'");
  addColumnIfNotExists('faculty', 'updated_at', 'DATETIME');

  // Module 5: Student Achievements Schema Updates
  addColumnIfNotExists('student_achievements', 'category', 'TEXT');
  addColumnIfNotExists('student_achievements', 'event_name', 'TEXT');
  addColumnIfNotExists('student_achievements', 'level', 'TEXT');
  addColumnIfNotExists('student_achievements', 'award', 'TEXT');
  addColumnIfNotExists('student_achievements', 'certificate_path', 'TEXT');
  addColumnIfNotExists('student_achievements', 'department_id', 'INTEGER');
  addColumnIfNotExists('student_achievements', 'updated_at', 'DATETIME');

  // Module 6: Department Activities Schema Updates
  addColumnIfNotExists('activities', 'venue', 'TEXT');
  addColumnIfNotExists('activities', 'organizer', 'TEXT');
  addColumnIfNotExists('activities', 'coordinator', 'TEXT');
  addColumnIfNotExists('activities', 'coordinator_faculty_id', 'INTEGER');
  addColumnIfNotExists('activities', 'department_id', 'INTEGER');
  addColumnIfNotExists('activities', 'document_path', 'TEXT');
  // Module 7: Events Management Schema Updates
  addColumnIfNotExists('events', 'department_id', 'INTEGER');
  addColumnIfNotExists('events', 'start_time', 'TEXT');
  addColumnIfNotExists('events', 'end_time', 'TEXT');
  addColumnIfNotExists('events', 'venue', 'TEXT');
  addColumnIfNotExists('events', 'organizer', 'TEXT');
  addColumnIfNotExists('events', 'coordinator', 'TEXT');
  addColumnIfNotExists('events', 'coordinator_faculty_id', 'INTEGER');
  addColumnIfNotExists('events', 'event_status', "TEXT DEFAULT 'Scheduled'");
  addColumnIfNotExists('events', 'participants_count', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('events', 'external_guests', 'TEXT');
  addColumnIfNotExists('events', 'document_path', 'TEXT');
  addColumnIfNotExists('events', 'status', "TEXT DEFAULT 'Approved'");
  addColumnIfNotExists('events', 'submitted_by', 'INTEGER');
  addColumnIfNotExists('events', 'submitted_by_name', 'TEXT');
  addColumnIfNotExists('events', 'submitted_at', 'DATETIME');
  addColumnIfNotExists('events', 'reviewed_by', 'INTEGER');
  addColumnIfNotExists('events', 'reviewed_by_name', 'TEXT');
  addColumnIfNotExists('events', 'reviewed_at', 'DATETIME');
  addColumnIfNotExists('events', 'review_comments', 'TEXT');
  addColumnIfNotExists('events', 'updated_at', 'DATETIME');

  // Module 8: Placement Management Schema Updates
  addColumnIfNotExists('placement_records', 'department_id', 'INTEGER');
  addColumnIfNotExists('placement_records', 'job_role', 'TEXT');
  addColumnIfNotExists('placement_records', 'location', 'TEXT');
  addColumnIfNotExists('placement_records', 'placement_date', 'TEXT');
  addColumnIfNotExists('placement_records', 'offer_type', 'TEXT');
  addColumnIfNotExists('placement_records', 'submitted_at', 'DATETIME');
  addColumnIfNotExists('placement_records', 'reviewed_by_name', 'TEXT');
  addColumnIfNotExists('placement_records', 'reviewed_at', 'DATETIME');

  // Module 10: Research, Publications & Project Management Schema Compatibility Updates
  addColumnIfNotExists('research_publications', 'doi', 'TEXT');
  addColumnIfNotExists('research_publications', 'doi_url', 'TEXT');
  addColumnIfNotExists('research_publications', 'reviewer_comments', 'TEXT');
  addColumnIfNotExists('research_publications', 'review_comments', 'TEXT');

  addColumnIfNotExists('projects', 'project_title', 'TEXT');
  addColumnIfNotExists('projects', 'title', 'TEXT');
  addColumnIfNotExists('projects', 'coordinator', 'TEXT');
  addColumnIfNotExists('projects', 'project_guide', 'TEXT');
  addColumnIfNotExists('projects', 'coordinator_faculty_id', 'INTEGER');
  addColumnIfNotExists('projects', 'guide_faculty_id', 'INTEGER');
  addColumnIfNotExists('projects', 'industry_partner', 'TEXT');
  addColumnIfNotExists('projects', 'partner_organization', 'TEXT');
  addColumnIfNotExists('projects', 'reviewer_comments', 'TEXT');
  addColumnIfNotExists('projects', 'review_comments', 'TEXT');

  try {
    db.exec(`
      UPDATE research_publications SET doi = doi_url WHERE doi IS NULL AND doi_url IS NOT NULL;
      UPDATE research_publications SET doi_url = doi WHERE doi_url IS NULL AND doi IS NOT NULL;
      UPDATE research_publications SET reviewer_comments = review_comments WHERE reviewer_comments IS NULL AND review_comments IS NOT NULL;
      UPDATE research_publications SET review_comments = reviewer_comments WHERE review_comments IS NULL AND reviewer_comments IS NOT NULL;

      UPDATE projects SET project_title = title WHERE project_title IS NULL AND title IS NOT NULL;
      UPDATE projects SET title = project_title WHERE title IS NULL AND project_title IS NOT NULL;
      UPDATE projects SET coordinator = project_guide WHERE coordinator IS NULL AND project_guide IS NOT NULL;
      UPDATE projects SET project_guide = coordinator WHERE project_guide IS NULL AND coordinator IS NOT NULL;
      UPDATE projects SET coordinator_faculty_id = guide_faculty_id WHERE coordinator_faculty_id IS NULL AND guide_faculty_id IS NOT NULL;
      UPDATE projects SET guide_faculty_id = coordinator_faculty_id WHERE guide_faculty_id IS NULL AND coordinator_faculty_id IS NOT NULL;
      UPDATE projects SET industry_partner = partner_organization WHERE industry_partner IS NULL AND partner_organization IS NOT NULL;
      UPDATE projects SET partner_organization = industry_partner WHERE partner_organization IS NULL AND industry_partner IS NOT NULL;
      UPDATE projects SET reviewer_comments = review_comments WHERE reviewer_comments IS NULL AND review_comments IS NOT NULL;
      UPDATE projects SET review_comments = reviewer_comments WHERE review_comments IS NULL AND reviewer_comments IS NOT NULL;
    `);
  } catch (errSync) {
    console.warn('[Migration] Module 10 sync notice:', errSync.message);
  }

  // Module 15 & 16: Generated Reports Metadata
  addColumnIfNotExists('generated_reports', 'created_by', 'TEXT');
  addColumnIfNotExists('generated_reports', 'status', "TEXT DEFAULT 'Completed'");
  addColumnIfNotExists('generated_reports', 'report_type', "TEXT DEFAULT 'Annual Report'");
  addColumnIfNotExists('generated_reports', 'student_id', 'INTEGER');

  migrateDepartmentRelationships();
  migrateFacultyRelationships();
  migrateStudentAchievementRelationships();
  migrateActivityRelationships();
  migrateEventRelationships();
  migratePlacementRelationships();
  seedEvents();
}

/**
 * Initialize and synchronize department relationships and HOD assignments
 */
function migrateDepartmentRelationships() {
  try {
    // 1. Ensure all departments have default status & timestamps
    db.exec(`
      UPDATE departments SET status = 'Active' WHERE status IS NULL;
      UPDATE departments SET created_at = datetime('now') WHERE created_at IS NULL;
      UPDATE departments SET updated_at = datetime('now') WHERE updated_at IS NULL;
    `);

    // 2. Link departments to hod users based on department name / hod role
    const depts = db.prepare('SELECT id, name, code, hod, hod_user_id FROM departments').all();
    for (const d of depts) {
      if (!d.hod_user_id) {
        const hodUser = db.prepare(`
          SELECT id, name FROM users 
          WHERE role = 'hod' AND (department = ? OR department = ?)
          LIMIT 1
        `).get(d.name, d.code);

        if (hodUser) {
          db.prepare(`
            UPDATE departments SET hod_user_id = ?, hod = ? WHERE id = ?
          `).run(hodUser.id, hodUser.name, d.id);
        }
      }
    }

    // 3. Link users.department_id based on users.department
    const users = db.prepare('SELECT id, department, department_id FROM users WHERE department IS NOT NULL').all();
    for (const u of users) {
      if (!u.department_id) {
        const dept = db.prepare('SELECT id FROM departments WHERE name = ? OR code = ? LIMIT 1').get(u.department, u.department);
        if (dept) {
          db.prepare('UPDATE users SET department_id = ? WHERE id = ?').run(dept.id, u.id);
        }
      }
    }
  } catch (err) {
    console.warn('[Migration] Department relationship migration notice:', err.message);
  }
}

/**
 * Automatically migrate any legacy plain-text passwords to secure scrypt hashes
 */
function migrateUserPasswords() {
  try {
    const users = db.prepare('SELECT id, email, password FROM users').all();
    let migratedCount = 0;

    for (const u of users) {
      // If password does not contain ':' it is unhashed
      if (!u.password.includes(':')) {
        const hashedPassword = hashPassword(u.password);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, u.id);
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      console.log(`[Database] Successfully migrated ${migratedCount} plain-text user passwords to secure scrypt hashes.`);
    }
  } catch (err) {
    console.error('[Database] Password migration error:', err.message);
  }
}

function seedSyntheticData() {
  // Seed base departments if missing
  const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
  if (deptCount === 0) {
    const insertDept = db.prepare(`
      INSERT INTO departments (code, name, hod, established_year)
      VALUES (?, ?, ?, ?)
    `);
    insertDept.run('CSE', 'Computer Science and Engineering', 'Prof. Ramesh Kumar', 2005);
    insertDept.run('IT', 'Information Technology', 'Prof. Priya S', 2008);
    insertDept.run('ECE', 'Electronics and Communication Engineering', 'Prof. Arun Prakash', 2006);
  }

  // Ensure default demo users exist with secure hashes
  const ensureUser = (email, plainPassword, name, role, department) => {
    const existing = db.prepare('SELECT id, password FROM users WHERE email = ?').get(email.toLowerCase());
    if (!existing) {
      const hashed = hashPassword(plainPassword);
      db.prepare(`
        INSERT INTO users (email, password, name, role, department)
        VALUES (?, ?, ?, ?, ?)
      `).run(email.toLowerCase(), hashed, name, role, department);
    } else if (!existing.password.includes(':')) {
      // Ensure existing is hashed
      const hashed = hashPassword(existing.password);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, existing.id);
    }
  };

  // 1. Admin
  ensureUser('admin@college.com', 'admin123', 'Institutional Administrator', 'admin', 'Administration');

  // 2. HODs
  ensureUser('hod_cse@college.com', 'hod123', 'Prof. Ramesh Kumar (HOD)', 'hod', 'Computer Science and Engineering');
  ensureUser('hod_it@college.com', 'hod123', 'Prof. Priya S (HOD)', 'hod', 'Information Technology');
  ensureUser('hod_ece@college.com', 'hod123', 'Prof. Arun Prakash (HOD)', 'hod', 'Electronics and Communication Engineering');

  // 3. Faculty
  ensureUser('faculty@college.com', 'faculty123', 'Prof. Ramesh Kumar', 'faculty', 'Computer Science and Engineering');
  ensureUser('faculty_it@college.com', 'faculty123', 'Prof. Karthikeyan R', 'faculty', 'Information Technology');
  ensureUser('faculty_ece@college.com', 'faculty123', 'Prof. Sangeetha M', 'faculty', 'Electronics and Communication Engineering');

  // Seed individual placement records if empty
  const placementRecordCount = db.prepare('SELECT COUNT(*) as count FROM placement_records').get().count;
  if (placementRecordCount === 0) {
    const insertPlacementRecord = db.prepare(`
      INSERT INTO placement_records (
        student_name, register_no, department, academic_year,
        company_name, package, placement_status, offer_details,
        status, submitted_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const records = [
      ['Jaya Prakash S', 'CSE-2022-001', 'Computer Science and Engineering', '2025-26', 'Google', 42.5, 'Placed', 'Software Engineer (On-Campus)', 'Approved', 'Prof. Ramesh Kumar (HOD)'],
      ['Sivaguru P', 'CSE-2022-002', 'Computer Science and Engineering', '2025-26', 'Microsoft', 38.0, 'Placed', 'Cloud Solutions Architect', 'Approved', 'Prof. Ramesh Kumar (HOD)'],
      ['Kavin Govindaraj', 'IT-2022-001', 'Information Technology', '2025-26', 'Adobe Systems', 36.0, 'Placed', 'Product Engineering Intern/FTE', 'Approved', 'Prof. Priya S (HOD)'],
      ['Kanthavi C', 'IT-2022-002', 'Information Technology', '2025-26', 'Zoho Corporation', 14.0, 'Placed', 'Software Engineer', 'Approved', 'Prof. Priya S (HOD)'],
      ['Kishaanth S', 'ECE-2022-001', 'Electronics and Communication Engineering', '2025-26', 'Qualcomm', 28.0, 'Placed', 'Hardware Silicon Engineer', 'Approved', 'Prof. Arun Prakash (HOD)'],
      ['Sanjith A S', 'ECE-2022-002', 'Electronics and Communication Engineering', '2025-26', 'Texas Instruments', 26.5, 'Placed', 'Analog Design Engineer', 'Approved', 'Prof. Arun Prakash (HOD)']
    ];

    for (const rec of records) {
      insertPlacementRecord.run(...rec);
    }
  }

  // Seed base students if empty
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  if (studentCount === 0) {
    const insertStudent = db.prepare(`
      INSERT INTO students (
        register_no, name, department_id, department,
        academic_year, current_year, section, email, phone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedStudents = [
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,,
,,,,,,,,,
    ];

    for (const s of seedStudents) {
      insertStudent.run(...s);
    }
  }

  // Seed base faculty if empty
  const facultyCount = db.prepare('SELECT COUNT(*) as count FROM faculty').get().count;
  if (facultyCount === 0) {
    const insertFaculty = db.prepare(`
      INSERT INTO faculty (
        faculty_name, faculty_id, department_id, department, academic_year,
        designation, qualification, specialization, date_of_joining,
        email, phone, status, publications, research_projects,
        conferences_attended, awards, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const seedFaculty = [
      // CSE
      ['Prof. Ramesh Kumar', 'FAC-CSE-001', 1, 'Computer Science and Engineering', '2025-26', 'Professor & HOD', 'Ph.D. (Computer Science)', 'Artificial Intelligence & Distributed Systems', '2015-06-15', 'ramesh.kumar@college.edu', '9876500001', 'Active', 18, 4, 12, 'Best Researcher Award 2023', 'HOD of CSE'],
      ['Prof. Meena Devi', 'FAC-CSE-002', 1, 'Computer Science and Engineering', '2025-26', 'Associate Professor', 'Ph.D.', 'Machine Learning & Cloud Architecture', '2018-08-01', 'meena.devi@college.edu', '9876500002', 'Active', 12, 3, 8, 'Excellence in Teaching 2024', 'AI & ML Curriculum Coordinator'],
      ['Prof. Senthil Kumar P', 'FAC-CSE-003', 1, 'Computer Science and Engineering', '2025-26', 'Assistant Professor', 'M.Tech', 'Cybersecurity & Networks', '2020-07-15', 'senthil.kumar.p@college.edu', '9876500003', 'Active', 8, 2, 6, 'Faculty Mentor 2023', 'Cyber Lab In-charge'],
      ['Prof. Lakshmi Priya K', 'FAC-CSE-004', 1, 'Computer Science and Engineering', '2025-26', 'Assistant Professor', 'M.E.', 'Data Science & Big Data', '2021-09-01', 'lakshmi.priya.k@college.edu', '9876500004', 'Active', 6, 1, 4, 'Research Grant Award 2024', 'Data Systems Specialist'],
      ['Prof. Saravanan P', 'FAC-CSE-005', 1, 'Computer Science and Engineering', '2025-26', 'Assistant Professor', 'M.E.', 'Software Engineering & DevOps', '2022-01-10', 'saravanan.p@college.edu', '9876500005', 'Active', 4, 1, 3, 'Teaching Innovation 2024', 'Full Stack Project Guide'],

      // IT
      ['Prof. Priya S', 'FAC-IT-001', 2, 'Information Technology', '2025-26', 'Professor & HOD', 'Ph.D. (Information Technology)', 'Enterprise Computing & Big Data', '2016-01-10', 'priya.s@college.edu', '9876500006', 'Active', 15, 3, 10, 'Distinguished Faculty 2023', 'HOD of IT'],
      ['Prof. Karthikeyan R', 'FAC-IT-002', 2, 'Information Technology', '2025-26', 'Associate Professor', 'Ph.D.', 'Web Architectures & Cryptography', '2017-09-01', 'karthikeyan.r@college.edu', '9876500007', 'Active', 10, 2, 7, 'Best Mentor 2024', 'Information Security Coordinator'],
      ['Prof. Kavitha R', 'FAC-IT-003', 2, 'Information Technology', '2025-26', 'Assistant Professor', 'M.Tech', 'Cloud Systems & Virtualization', '2019-06-20', 'kavitha.r@college.edu', '9876500008', 'Active', 7, 2, 5, 'Excellence in Research 2023', 'Cloud Lab In-charge'],
      ['Prof. Mohan Raj M', 'FAC-IT-004', 2, 'Information Technology', '2025-26', 'Assistant Professor', 'M.E.', 'Full-Stack Development & Mobile Apps', '2021-08-15', 'mohan.raj.m@college.edu', '9876500009', 'Active', 5, 1, 4, 'Young Faculty Award', 'Mobile Systems Guide'],
      ['Prof. Geetha R', 'FAC-IT-005', 2, 'Information Technology', '2025-26', 'Assistant Professor', 'M.Tech', 'Information Retrieval & NLP', '2022-03-01', 'geetha.r@college.edu', '9876500010', 'Active', 4, 1, 3, 'Faculty Excellence 2024', 'Student Project Mentor'],

      // ECE
      ['Prof. Arun Prakash', 'FAC-ECE-001', 3, 'Electronics and Communication Engineering', '2025-26', 'Professor & HOD', 'Ph.D. (VLSI Design)', 'Microelectronics & Semiconductor Design', '2014-04-20', 'arun.prakash@college.edu', '9876500011', 'Active', 20, 5, 14, 'IEEE Senior Member', 'HOD of ECE'],
      ['Prof. Sangeetha M', 'FAC-ECE-002', 3, 'Electronics and Communication Engineering', '2025-26', 'Associate Professor', 'Ph.D.', 'Embedded Systems & IoT Devices', '2017-11-01', 'sangeetha.m@college.edu', '9876500012', 'Active', 11, 2, 8, 'Best Innovator Award', 'Embedded Lab Coordinator'],
      ['Prof. Vijay Anand S', 'FAC-ECE-003', 3, 'Electronics and Communication Engineering', '2025-26', 'Assistant Professor', 'M.E.', '5G/6G Wireless Communication', '2019-07-10', 'vijay.anand.s@college.edu', '9876500013', 'Active', 8, 2, 6, 'Faculty Mentor 2023', 'RF & Antenna Specialist'],
      ['Prof. Divya S', 'FAC-ECE-004', 3, 'Electronics and Communication Engineering', '2025-26', 'Assistant Professor', 'M.Tech', 'Signal & Image Processing', '2021-02-15', 'divya.s@college.edu', '9876500014', 'Active', 6, 1, 5, 'Teaching Excellence 2024', 'Digital Signal Processing Guide'],
      ['Prof. Pradeep Kumar S', 'FAC-ECE-005', 3, 'Electronics and Communication Engineering', '2025-26', 'Assistant Professor', 'M.E.', 'Robotics & Control Systems', '2022-06-01', 'pradeep.kumar.s@college.edu', '9876500015', 'Active', 4, 1, 3, 'Innovation Award 2024', 'Robotics Club Advisor']
    ];

    for (const f of seedFaculty) {
      insertFaculty.run(...f);
    }
  }

  // Link existing placement records to student_id
  try {
    db.exec(`
      UPDATE placement_records 
      SET student_id = (SELECT s.id FROM students s WHERE s.register_no = placement_records.register_no LIMIT 1)
      WHERE student_id IS NULL;
    `);
  } catch (e) {}

  migrateFacultyRelationships();

  seedEvents();
  seedResearchAndProjects();

  console.log('[Database] Initialization, migration, and seed checks complete.');
}

/**
 * Synchronize faculty foreign keys: department_id and user_id
 */
function migrateFacultyRelationships() {
  try {
    // 1. Ensure status is Active if null
    db.exec(`UPDATE faculty SET status = 'Active' WHERE status IS NULL;`);

    // 2. Link department_id where missing
    db.exec(`
      UPDATE faculty 
      SET department_id = (
        SELECT id FROM departments 
        WHERE LOWER(departments.name) = LOWER(faculty.department) 
           OR LOWER(departments.code) = LOWER(faculty.department) 
        LIMIT 1
      )
      WHERE department_id IS NULL;
    `);

    // 3. Link user_id from users table where matching email or name
    db.exec(`
      UPDATE faculty 
      SET user_id = (
        SELECT id FROM users 
        WHERE LOWER(users.email) = LOWER(faculty.email) 
           OR LOWER(users.name) = LOWER(faculty.faculty_name)
        LIMIT 1
      )
      WHERE user_id IS NULL;
    `);
  } catch (err) {
    console.warn('[Migration] Faculty relationship migration notice:', err.message);
  }
}

/**
 * Synchronize student achievement foreign keys and default values
 */
function migrateStudentAchievementRelationships() {
  try {
    // 1. Link student_ref_id to students(id) based on register_no
    db.exec(`
      UPDATE student_achievements 
      SET student_ref_id = (
        SELECT s.id FROM students s 
        WHERE UPPER(s.register_no) = UPPER(student_achievements.student_id) 
        LIMIT 1
      )
      WHERE student_ref_id IS NULL;
    `);

    // 2. Link department_id from departments
    db.exec(`
      UPDATE student_achievements 
      SET department_id = (
        SELECT id FROM departments 
        WHERE LOWER(departments.name) = LOWER(student_achievements.department) 
           OR LOWER(departments.code) = LOWER(student_achievements.department) 
        LIMIT 1
      )
      WHERE department_id IS NULL;
    `);

    // 3. Populate category from achievement_type if category is null
    db.exec(`
      UPDATE student_achievements 
      SET category = achievement_type 
      WHERE category IS NULL;
    `);

    // 4. Populate event_name from event_organization if event_name is null
    db.exec(`
      UPDATE student_achievements 
      SET event_name = event_organization 
      WHERE event_name IS NULL;
    `);

    // 5. Populate level if null
    db.exec(`
      UPDATE student_achievements 
      SET level = 'National' 
      WHERE level IS NULL;
    `);

    // 6. Populate award if null
    db.exec(`
      UPDATE student_achievements 
      SET award = '1st Prize' 
      WHERE award IS NULL;
    `);

    // 7. Ensure timestamps
    db.exec(`
      UPDATE student_achievements 
      SET created_at = datetime('now') 
      WHERE created_at IS NULL;
      UPDATE student_achievements 
      SET updated_at = datetime('now') 
      WHERE updated_at IS NULL;
    `);
  } catch (err) {
    console.warn('[Migration] Student achievements migration notice:', err.message);
  }
}

/**
 * Synchronize department activities foreign keys, coordinator, and relationships
 */
function migrateActivityRelationships() {
  try {
    // 1. Link department_id from departments table
    db.exec(`
      UPDATE activities 
      SET department_id = (
        SELECT id FROM departments 
        WHERE LOWER(departments.name) = LOWER(activities.department) 
           OR LOWER(departments.code) = LOWER(activities.department) 
        LIMIT 1
      )
      WHERE department_id IS NULL;
    `);

    // 2. Default venue and organizer if null
    db.exec(`
      UPDATE activities SET venue = 'Campus Main Auditorium' WHERE venue IS NULL;
      UPDATE activities SET organizer = department || ' Association' WHERE organizer IS NULL;
      UPDATE activities SET coordinator = faculty_coordinator WHERE coordinator IS NULL AND faculty_coordinator IS NOT NULL;
    `);

    // 3. Link student_ref_id to activity_students if present
    db.exec(`
      INSERT OR IGNORE INTO activity_students (activity_id, student_id)
      SELECT id, student_ref_id FROM activities WHERE student_ref_id IS NOT NULL;
    `);

    // 4. Link coordinator to coordinator_faculty_id if matching faculty found
    db.exec(`
      UPDATE activities 
      SET coordinator_faculty_id = (
        SELECT id FROM faculty 
        WHERE LOWER(faculty.faculty_name) = LOWER(activities.faculty_coordinator)
           OR LOWER(faculty.faculty_name) = LOWER(activities.coordinator)
        LIMIT 1
      )
      WHERE coordinator_faculty_id IS NULL;
    `);

    // 5. Ensure timestamps
    db.exec(`
      UPDATE activities SET created_at = datetime('now') WHERE created_at IS NULL;
      UPDATE activities SET updated_at = datetime('now') WHERE updated_at IS NULL;
    `);
  } catch (err) {
    console.warn('[Migration] Activity relationship migration notice:', err.message);
  }
}

/**
 * Synchronize events foreign keys and relationships
 */
function migrateEventRelationships() {
  try {
    // 1. Populate department_id from departments table
    db.exec(`
      UPDATE events 
      SET department_id = (
        SELECT id FROM departments 
        WHERE LOWER(departments.name) = LOWER(events.department) 
           OR LOWER(departments.code) = LOWER(events.department) 
        LIMIT 1
      )
      WHERE department_id IS NULL;
    `);

    // 2. Link coordinator to coordinator_faculty_id if matching faculty found
    db.exec(`
      UPDATE events 
      SET coordinator_faculty_id = (
        SELECT id FROM faculty 
        WHERE LOWER(faculty.faculty_name) = LOWER(events.coordinator)
        LIMIT 1
      )
      WHERE coordinator_faculty_id IS NULL;
    `);

    // 3. Ensure timestamps
    db.exec(`
      UPDATE events SET created_at = datetime('now') WHERE created_at IS NULL;
      UPDATE events SET updated_at = datetime('now') WHERE updated_at IS NULL;
    `);
  } catch (err) {
    console.warn('[Migration] Event relationship migration notice:', err.message);
  }
}

/**
 * Synchronize placement records relationships, foreign keys, and defaults
 */
function migratePlacementRelationships() {
  try {
    // 1. Link student_id to students(id) based on register_no
    db.exec(`
      UPDATE placement_records 
      SET student_id = (
        SELECT s.id FROM students s 
        WHERE UPPER(s.register_no) = UPPER(placement_records.register_no) 
        LIMIT 1
      )
      WHERE student_id IS NULL;
    `);

    // 2. Link department_id from departments
    db.exec(`
      UPDATE placement_records 
      SET department_id = (
        SELECT id FROM departments 
        WHERE LOWER(departments.name) = LOWER(placement_records.department) 
           OR LOWER(departments.code) = LOWER(placement_records.department) 
        LIMIT 1
      )
      WHERE department_id IS NULL;
    `);

    // 3. Populate job_role from offer_details if job_role is null
    db.exec(`
      UPDATE placement_records 
      SET job_role = offer_details 
      WHERE job_role IS NULL AND offer_details IS NOT NULL;
    `);

    // 4. Ensure status and timestamps
    db.exec(`
      UPDATE placement_records SET status = 'Approved' WHERE status IS NULL;
      UPDATE placement_records SET created_at = datetime('now') WHERE created_at IS NULL;
      UPDATE placement_records SET updated_at = datetime('now') WHERE updated_at IS NULL;
    `);
  } catch (err) {
    console.warn('[Migration] Placement relationship migration notice:', err.message);
  }
}

/**
 * Seed sample events with student and faculty links if events table is empty
 */
function seedEvents() {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
    if (count > 0) return;

    console.log('[Seed] Seeding sample events for 2025-26...');

    // Fetch CSE, IT, ECE departments
    const cseDept = db.prepare("SELECT id, name FROM departments WHERE code = 'CSE' OR name LIKE '%Computer Science%'").get();
    const itDept = db.prepare("SELECT id, name FROM departments WHERE code = 'IT' OR name LIKE '%Information Tech%'").get();
    const eceDept = db.prepare("SELECT id, name FROM departments WHERE code = 'ECE' OR name LIKE '%Electronics%'").get();

    // Fetch faculty coordinators
    const cseFaculty = db.prepare("SELECT id, faculty_name FROM faculty WHERE department = ? LIMIT 2").all(cseDept ? cseDept.name : 'Computer Science and Engineering');
    const itFaculty = db.prepare("SELECT id, faculty_name FROM faculty WHERE department = ? LIMIT 2").all(itDept ? itDept.name : 'Information Technology');
    const eceFaculty = db.prepare("SELECT id, faculty_name FROM faculty WHERE department = ? LIMIT 2").all(eceDept ? eceDept.name : 'Electronics and Communication Engineering');

    // Fetch sample students for junction links
    const cseStudents = db.prepare("SELECT id, name FROM students WHERE department = ? AND status = 'Active' LIMIT 3").all(cseDept ? cseDept.name : 'Computer Science and Engineering');
    const itStudents = db.prepare("SELECT id, name FROM students WHERE department = ? AND status = 'Active' LIMIT 3").all(itDept ? itDept.name : 'Information Technology');

    const insertEvent = db.prepare(`
      INSERT INTO events (
        event_name, event_type, description, department_id, department,
        event_date, start_time, end_time, venue, organizer,
        coordinator, coordinator_faculty_id, academic_year, event_status,
        participants_count, external_guests, status, submitted_by, submitted_by_name,
        reviewed_by, reviewed_by_name, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertStudentLink = db.prepare(`
      INSERT OR IGNORE INTO event_students (event_id, student_id) VALUES (?, ?)
    `);

    const insertFacultyLink = db.prepare(`
      INSERT OR IGNORE INTO event_faculty (event_id, faculty_id) VALUES (?, ?)
    `);

    // 1. CSE Event: National AI & Autonomous Systems Hackathon
    const ev1 = insertEvent.run(
      'National AI & Autonomous Systems Hackathon 2026',
      'Hackathon',
      '36-hour national level hackathon focused on Generative AI, Robotics, and Computer Vision.',
      cseDept ? cseDept.id : 1,
      cseDept ? cseDept.name : 'Computer Science and Engineering',
      '2026-03-12',
      '09:00',
      '18:00',
      'Campus Innovation Hub & Auditorium',
      'CSE Tech Association & ACM Student Chapter',
      cseFaculty[0] ? cseFaculty[0].faculty_name : 'Prof. Ramesh Kumar',
      cseFaculty[0] ? cseFaculty[0].id : 1,
      '2025-26',
      'Completed',
      120,
      'Mr. Vikram Verma (Chief Architect, OpenAI Research)',
      'Approved',
      1,
      'System Administrator',
      2,
      'Prof. Ramesh Kumar'
    );
    const ev1Id = ev1.lastInsertRowid;
    for (const s of cseStudents) {
      insertStudentLink.run(ev1Id, s.id);
    }
    if (cseFaculty[1]) {
      insertFacultyLink.run(ev1Id, cseFaculty[1].id);
    }

    // 2. CSE Event: Industry 4.0 & Cloud Architecture Seminar
    const ev2 = insertEvent.run(
      'Industry 4.0 & Cloud Architecture Seminar',
      'Seminar',
      'Expert talk on enterprise cloud solutions, microservices, and kubernetes deployment.',
      cseDept ? cseDept.id : 1,
      cseDept ? cseDept.name : 'Computer Science and Engineering',
      '2026-02-20',
      '10:30',
      '13:00',
      'Seminar Hall 2',
      'Department of Computer Science',
      cseFaculty[1] ? cseFaculty[1].faculty_name : 'Prof. Meena Devi',
      cseFaculty[1] ? cseFaculty[1].id : 2,
      '2025-26',
      'Completed',
      85,
      'Dr. Anirudh Sen (Director of Engineering, AWS India)',
      'Approved',
      1,
      'System Administrator',
      2,
      'Prof. Ramesh Kumar'
    );
    const ev2Id = ev2.lastInsertRowid;
    if (cseStudents[0]) insertStudentLink.run(ev2Id, cseStudents[0].id);

    // 3. IT Event: Cybersecurity & Zero-Trust Architecture FDP
    const ev3 = insertEvent.run(
      'Faculty Development Program on Zero-Trust Cybersecurity',
      'FDP',
      'One-week intensive faculty development program covering ethical hacking, network defence, and cryptanalysis.',
      itDept ? itDept.id : 2,
      itDept ? itDept.name : 'Information Technology',
      '2026-01-15',
      '09:30',
      '16:30',
      'IT Department Virtual Lab 1',
      'Dept of Information Technology & CERT-In',
      itFaculty[0] ? itFaculty[0].faculty_name : 'Prof. Priya S',
      itFaculty[0] ? itFaculty[0].id : 3,
      '2025-26',
      'Completed',
      45,
      'Dr. P. K. Nambiar (Senior Scientist, Cyber Security Cell)',
      'Approved',
      1,
      'System Administrator',
      3,
      'Prof. Priya S'
    );
    const ev3Id = ev3.lastInsertRowid;
    for (const s of itStudents) {
      insertStudentLink.run(ev3Id, s.id);
    }
    if (itFaculty[1]) {
      insertFacultyLink.run(ev3Id, itFaculty[1].id);
    }

    // 4. ECE Event: Microelectronics & Semiconductor Fabrication Workshop
    const ev4 = insertEvent.run(
      'Hands-on Workshop on Semiconductor Fabrication & VLSI',
      'Workshop',
      'Practical training session on modern EDA tools, cadence simulation, and CMOS fabrication.',
      eceDept ? eceDept.id : 3,
      eceDept ? eceDept.name : 'Electronics and Communication Engineering',
      '2026-02-05',
      '10:00',
      '17:00',
      'VLSI Design Centre',
      'IEEE Communications Society',
      eceFaculty[0] ? eceFaculty[0].faculty_name : 'Prof. Arun Prakash',
      eceFaculty[0] ? eceFaculty[0].id : null,
      '2025-26',
      'Completed',
      60,
      'Dr. Manoj K. (Principal Scientist, ISRO Semiconductor Lab)',
      'Approved',
      1,
      'System Administrator',
      5,
      'Prof. Arun Prakash'
    );

    console.log('[Seed] Sample events created successfully.');
  } catch (err) {
    console.warn('[Seed] Event seed notice:', err.message);
  }
}

/**
 * Seed sample research publications and projects for 2025-26
 */
function seedResearchAndProjects() {
  try {
    const resCount = db.prepare('SELECT COUNT(*) as count FROM research_publications').get().count;
    const cseDept = db.prepare("SELECT id, name FROM departments WHERE code = 'CSE' OR name LIKE '%Computer Science%'").get();
    const itDept = db.prepare("SELECT id, name FROM departments WHERE code = 'IT' OR name LIKE '%Information Tech%'").get();
    const eceDept = db.prepare("SELECT id, name FROM departments WHERE code = 'ECE' OR name LIKE '%Electronics%'").get();

    const cseFaculty = db.prepare("SELECT id, faculty_name FROM faculty WHERE department = ? LIMIT 2").all(cseDept ? cseDept.name : 'Computer Science and Engineering');
    const itFaculty = db.prepare("SELECT id, faculty_name FROM faculty WHERE department = ? LIMIT 2").all(itDept ? itDept.name : 'Information Technology');
    const eceFaculty = db.prepare("SELECT id, faculty_name FROM faculty WHERE department = ? LIMIT 2").all(eceDept ? eceDept.name : 'Electronics and Communication Engineering');

    const cseStudents = db.prepare("SELECT id, name, register_no FROM students WHERE department = ? AND status = 'Active' LIMIT 3").all(cseDept ? cseDept.name : 'Computer Science and Engineering');
    const itStudents = db.prepare("SELECT id, name, register_no FROM students WHERE department = ? AND status = 'Active' LIMIT 3").all(itDept ? itDept.name : 'Information Technology');

    if (resCount === 0) {
      console.log('[Seed] Seeding sample research publications...');
      const insRes = db.prepare(`
        INSERT INTO research_publications (
          title, description, research_category, publication_type, author_names,
          department_id, department, journal_conference_name, publisher, publication_date,
          academic_year, doi, research_area, funding_agency, funding_amount,
          status, submitted_by, submitted_by_name, reviewed_by, reviewed_by_name, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const insResStudent = db.prepare(`INSERT OR IGNORE INTO research_students (research_id, student_id) VALUES (?, ?)`);
      const insResFaculty = db.prepare(`INSERT OR IGNORE INTO research_faculty (research_id, faculty_id) VALUES (?, ?)`);

      // 1. CSE Journal Article (Funded)
      const r1 = insRes.run(
        'Federated Learning Framework for Edge-Enabled IoT Healthcare Diagnostics',
        'Novel privacy-preserving federated optimization framework applied across multi-hospital edge clusters.',
        'Artificial Intelligence',
        'Journal Article',
        'Prof. Ramesh Kumar, Jaya Prakash S, Prof. Priya S',
        cseDept ? cseDept.id : 1,
        cseDept ? cseDept.name : 'Computer Science and Engineering',
        'IEEE Transactions on Industrial Informatics',
        'IEEE',
        '2025-10-14',
        '2025-26',
        '10.1109/TII.2025.3341902',
        'Edge Computing & AI',
        'DST-SERB Core Research Grant',
        450000,
        'Approved',
        1,
        'System Administrator',
        2,
        'Prof. Ramesh Kumar'
      );
      if (cseStudents[0]) insResStudent.run(r1.lastInsertRowid, cseStudents[0].id);
      if (cseFaculty[0]) insResFaculty.run(r1.lastInsertRowid, cseFaculty[0].id);

      // 2. CSE Conference Paper
      const r2 = insRes.run(
        'Deep Reinforcement Learning for Autonomous UAV Navigation in GPS-Denied Environments',
        'End-to-end vision-based obstacle avoidance architecture evaluated on physical quadcopter platforms.',
        'Robotics & AI',
        'Conference Paper',
        'Prof. Ramesh Kumar, Sivaguru P',
        cseDept ? cseDept.id : 1,
        cseDept ? cseDept.name : 'Computer Science and Engineering',
        'ACM SIGKDD International Conference on Knowledge Discovery and Data Mining',
        'ACM',
        '2025-11-20',
        '2025-26',
        '10.1145/3580305.3599541',
        'Autonomous Systems',
        null,
        0,
        'Approved',
        1,
        'System Administrator',
        2,
        'Prof. Ramesh Kumar'
      );
      if (cseStudents[1]) insResStudent.run(r2.lastInsertRowid, cseStudents[1].id);
      if (cseFaculty[0]) insResFaculty.run(r2.lastInsertRowid, cseFaculty[0].id);

      // 3. IT Patent
      const r3 = insRes.run(
        'System and Method for Decentralized Zero-Knowledge Cross-Chain Identity Verification',
        'Cryptographic protocol enabling interoperable zero-knowledge credential verification across disparate distributed ledgers.',
        'Cybersecurity & Cryptography',
        'Patent',
        'Prof. Priya S, Kavin Govindaraj',
        itDept ? itDept.id : 2,
        itDept ? itDept.name : 'Information Technology',
        'Indian Patent Office (Application No. 202541098231)',
        'Govt. of India Controller General of Patents',
        '2026-01-18',
        '2025-26',
        'https://ipindiaservices.gov.in/patentsearch',
        'Zero Trust Cryptography',
        'MeitY R&D Grant',
        300000,
        'Approved',
        1,
        'System Administrator',
        3,
        'Prof. Priya S'
      );
      if (itStudents[0]) insResStudent.run(r3.lastInsertRowid, itStudents[0].id);
      if (itFaculty[0]) insResFaculty.run(r3.lastInsertRowid, itFaculty[0].id);
    }

    const prjCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    if (prjCount === 0) {
      console.log('[Seed] Seeding sample projects...');
      const insPrj = db.prepare(`
        INSERT INTO projects (
          project_title, description, project_category, project_type,
          department_id, department, academic_year, start_date, completion_date,
          coordinator, coordinator_faculty_id, project_status, funding_agency, funding_amount,
          industry_partner, competition_name, awards_recognition, project_url,
          status, submitted_by, submitted_by_name, reviewed_by, reviewed_by_name, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const insPrjStudent = db.prepare(`INSERT OR IGNORE INTO project_students (project_id, student_id) VALUES (?, ?)`);
      const insPrjFaculty = db.prepare(`INSERT OR IGNORE INTO project_faculty (project_id, faculty_id) VALUES (?, ?)`);

      // 1. CSE Project: Smart Campus Autonomous Electric Shuttle (Industry Sponsored & Award Winning)
      const p1 = insPrj.run(
        'Smart Campus Autonomous Electric Shuttle (SCAES)',
        'Full-scale lidar-guided autonomous electric vehicle designed for campus mobility and handicap transit.',
        'Industry-Sponsored Project',
        'Capstone',
        cseDept ? cseDept.id : 1,
        cseDept ? cseDept.name : 'Computer Science and Engineering',
        '2025-26',
        '2025-07-01',
        '2026-04-15',
        cseFaculty[0] ? cseFaculty[0].faculty_name : 'Prof. Ramesh Kumar',
        cseFaculty[0] ? cseFaculty[0].id : 1,
        'Ongoing',
        'Tata Motors Innovation Challenge Fund',
        250000,
        'Tata Motors Mobility Labs',
        'Smart India Mobility Hackathon 2026',
        '1st Prize & National Innovation Trophy',
        'https://github.com/excellence-tech/campus-autonomous-shuttle',
        'Approved',
        1,
        'System Administrator',
        2,
        'Prof. Ramesh Kumar'
      );
      if (cseStudents[0]) insPrjStudent.run(p1.lastInsertRowid, cseStudents[0].id);
      if (cseStudents[1]) insPrjStudent.run(p1.lastInsertRowid, cseStudents[1].id);
      if (cseFaculty[0]) insPrjFaculty.run(p1.lastInsertRowid, cseFaculty[0].id);

      // 2. IT Project: Decentralized Health Records Exchange Protocol
      const p2 = insPrj.run(
        'Decentralized Healthcare Records Exchange on IPFS & Ethereum',
        'Encrypted patient-consented medical record exchange network with zero-knowledge auditing.',
        'Research Project',
        'Major Project',
        itDept ? itDept.id : 2,
        itDept ? itDept.name : 'Information Technology',
        '2025-26',
        '2025-08-10',
        '2026-03-30',
        itFaculty[0] ? itFaculty[0].faculty_name : 'Prof. Priya S',
        itFaculty[0] ? itFaculty[0].id : 3,
        'Completed',
        'Institutional Seed Grant',
        75000,
        'Apollo Hospitals Digital Health Division',
        null,
        'Best Department Capstone Project Award',
        'https://github.com/excellence-tech/med-vault-ipfs',
        'Approved',
        1,
        'System Administrator',
        3,
        'Prof. Priya S'
      );
      if (itStudents[0]) insPrjStudent.run(p2.lastInsertRowid, itStudents[0].id);
      if (itFaculty[0]) insPrjFaculty.run(p2.lastInsertRowid, itFaculty[0].id);

      // 3. ECE Project: Ultra-Low-Power VLSI Cardiac Monitor
      const p3 = insPrj.run(
        'Ultra-Low-Power Sub-Threshold VLSI Architecture for Wearable ECG Monitoring',
        'Custom 28nm CMOS chip layout operating at 0.4V for continuous cardiac anomaly classification.',
        'Funded Project',
        'R&D',
        eceDept ? eceDept.id : 3,
        eceDept ? eceDept.name : 'Electronics and Communication Engineering',
        '2025-26',
        '2025-06-01',
        '2026-05-20',
        eceFaculty[0] ? eceFaculty[0].faculty_name : 'Prof. Arun Prakash',
        eceFaculty[0] ? eceFaculty[0].id : 5,
        'Ongoing',
        'DRDO Life Sciences Directorate Grant',
        380000,
        'Semiconductor R&D Cell',
        null,
        'Gold Medal at National Science & Engineering Fair 2025',
        'https://github.com/excellence-tech/vlsi-ecg-core',
        'Approved',
        1,
        'System Administrator',
        4,
        'Prof. Arun Prakash'
      );
    }
  } catch (err) {
    console.warn('[Seed] Research and Project seed notice:', err.message);
  }
}

module.exports = {
  db,
  withTransaction,
  initDatabase
};
