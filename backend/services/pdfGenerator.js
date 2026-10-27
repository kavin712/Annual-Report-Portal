const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, '..', 'generated_reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Generate a PDF report using PDFKit
 * @param {Object} options
 * @param {string} options.reportTitle
 * @param {string} options.academicYear
 * @param {Array<string>} options.selectedDepartments
 * @param {Array<string>} options.selectedSections
 * @param {Object} options.data - retrieved departmental data
 * @returns {Promise<{ filePath: string, fileName: string, fileSize: number }>}
 */
const NORM_SECTION_MAP = {
  coverpage: 'Cover Page',
  cover: 'Cover Page',
  instituteoverview: 'Institute Overview',
  overview: 'Institute Overview',
  institutionaloverview: 'Institute Overview',
  departmentwisesummary: 'Department-wise Summary',
  departmentsummary: 'Department-wise Summary',
  departmentcomparison: 'Department-wise Summary',
  departmentoverview: 'Department Overview',
  departmentinformation: 'Department Overview',
  departmentinfo: 'Department Overview',
  studentstatistics: 'Student Statistics',
  studentstats: 'Student Statistics',
  studentdemographics: 'Student Statistics',
  facultyinformation: 'Faculty Information',
  faculty: 'Faculty Information',
  studentachievements: 'Student Achievements',
  achievements: 'Student Achievements',
  studentachievementsandhonors: 'Student Achievements',
  departmentactivities: 'Department Activities',
  activities: 'Department Activities',
  events: 'Events Management',
  eventsmanagement: 'Events Management',
  institutionalevents: 'Events Management',
  placements: 'Placement Summary',
  placementsummary: 'Placement Summary',
  placement: 'Placement Summary',
  researchpublications: 'Research & Publications',
  research: 'Research & Publications',
  researchandpublications: 'Research & Publications',
  publications: 'Research & Publications',
  projects: 'Projects & Innovations',
  projectsandinnovations: 'Projects & Innovations',
  studentprojects: 'Projects & Innovations',
  conclusion: 'Conclusion',
  conclusionandsignatures: 'Conclusion',
  certification: 'Conclusion'
};

function normalizeSectionName(str) {
  if (!str) return '';
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return NORM_SECTION_MAP[clean] || str;
}

function hasSectionEnabled(sections, canonicalName) {
  if (!sections || !Array.isArray(sections) || sections.length === 0) return true;
  const canonicalNorm = canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sections.some(s => {
    const sNorm = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sNorm === canonicalNorm || NORM_SECTION_MAP[sNorm] === canonicalName;
  });
}

function drawInstituteEmblem(doc, centerX, centerY) {
  doc.save();
  // Outer decorative circles
  doc.circle(centerX, centerY, 34).lineWidth(2).strokeColor('#1E3A8A').stroke();
  doc.circle(centerX, centerY, 30).lineWidth(1).strokeColor('#0F766E').stroke();

  // Academic shield contour
  doc.moveTo(centerX - 16, centerY - 14)
     .lineTo(centerX + 16, centerY - 14)
     .lineTo(centerX + 16, centerY + 2)
     .quadraticCurveTo(centerX + 16, centerY + 18, centerX, centerY + 24)
     .quadraticCurveTo(centerX - 16, centerY + 18, centerX - 16, centerY + 2)
     .closePath()
     .fillAndStroke('#EFF6FF', '#1E3A8A');

  // Academic star insignia
  doc.fillColor('#1E3A8A').fontSize(14).font('Helvetica-Bold')
     .text('*', centerX - 4, centerY - 10);
  doc.restore();
}

/**
 * Generate a comprehensive, customizable Institutional Annual Report PDF using PDFKit
 * @param {Object} options
 * @param {string} options.reportTitle
 * @param {string} options.academicYear
 * @param {Array<string>} options.selectedDepartments
 * @param {Array<string>} options.selectedSections
 * @param {Array<string>} [options.sectionOrder]
 * @param {Object} [options.customization]
 * @param {Object} options.data - retrieved departmental data
 * @returns {Promise<{ filePath: string, fileName: string, fileSize: number }>}
 */
function generateAnnualReportPDF({
  reportTitle,
  academicYear,
  selectedDepartments = [],
  selectedSections = [],
  sectionOrder = [],
  customization = {},
  data = {}
}) {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = Date.now();
      const sanitizedTitle = (reportTitle || 'Annual_Report')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);
      const fileName = `${sanitizedTitle}_${academicYear}_${timestamp}.pdf`;
      const filePath = path.join(reportsDir, fileName);

      const instName = customization.instituteName || 'EXCELLENCE INSTITUTE OF TECHNOLOGY';
      const tagline = customization.tagline || 'Accredited by NBA & NAAC with A++ Grade | Autonomous Institution';
      const subtitle = customization.subtitle || 'Annual Institutional Performance & Accreditation Audit';
      const address = customization.address || 'Campus Road, Tech City, Knowledge Park';
      const website = customization.website || 'www.excellence.edu';
      const contact = customization.contact || 'info@excellence.edu | +91 98765 43210';
      const showCoverPage = customization.coverPage !== false && hasSectionEnabled(selectedSections, 'Cover Page');

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: reportTitle || `Institutional Annual Report ${academicYear}`,
          Author: instName,
          Subject: `Official Annual Audit Report for AY ${academicYear}`,
          Keywords: 'annual report, higher education, accreditation, achievements, placements'
        }
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Visual Branding Tokens
      const primaryColor = '#1E3A8A';   // Navy Blue
      const secondaryColor = '#0F766E'; // Deep Teal
      const darkText = '#1E293B';
      const grayText = '#64748B';
      const borderColor = '#CBD5E1';

      // --- SECTION 1: COVER PAGE (IF ENABLED) ---
      if (showCoverPage) {
        // Decorative Top Banner
        doc.rect(40, 40, 515, 8).fill(primaryColor);
        doc.rect(40, 48, 515, 3).fill(secondaryColor);

        // Institutional Emblem
        drawInstituteEmblem(doc, 297, 130);

        // Institution Identity
        doc.fillColor(primaryColor).fontSize(17).font('Helvetica-Bold')
           .text(instName.toUpperCase(), 40, 185, { align: 'center', width: 515 });

        doc.fillColor(grayText).fontSize(9).font('Helvetica')
           .text(tagline, 40, 208, { align: 'center', width: 515 });

        // Divider
        doc.moveTo(140, 228).lineTo(455, 228).strokeColor('#E2E8F0').stroke();

        // Main Report Title
        doc.fillColor(secondaryColor).fontSize(22).font('Helvetica-Bold')
           .text((reportTitle || 'INSTITUTIONAL ANNUAL REPORT').toUpperCase(), 40, 260, { align: 'center', width: 515 });

        // Subtitle
        doc.fillColor(darkText).fontSize(11).font('Helvetica')
           .text(subtitle, 40, 295, { align: 'center', width: 515 });

        // Academic Year Badge
        doc.rect(187, 335, 220, 34).fill('#EFF6FF');
        doc.rect(187, 335, 220, 34).stroke('#BFDBFE');
        doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold')
           .text(`ACADEMIC YEAR: ${academicYear}`, 187, 346, { align: 'center', width: 220 });

        // Department Scope Badge
        const scopeText = selectedDepartments.length > 2
          ? `Comprehensive Institute Report • ${selectedDepartments.length} Academic Departments`
          : `Scope: ${selectedDepartments.join(', ')}`;

        doc.fillColor(grayText).fontSize(9).font('Helvetica-Bold')
           .text(scopeText, 50, 390, { align: 'center', width: 495 });

        // Official Audit Statement Box
        doc.rect(70, 440, 455, 110).fill('#F8FAFC');
        doc.rect(70, 440, 455, 110).stroke(borderColor);

        doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold')
           .text('OFFICIAL RECORD OF INSTITUTIONAL PERFORMANCE', 85, 455);
        doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
           .text(
             'This official annual report contains compiled and verified academic, student, faculty, ' +
             'research, and placement records extracted directly from the Institute Annual ' +
             'Report Portal. All included items reflect records reviewed and approved in accordance with ' +
             'institutional accreditation governance.',
             85, 475, { width: 425, align: 'justify', lineGap: 3 }
           );

        // Metadata Strip at Base of Cover
        const compiledDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });

        doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
           .text(`Address: ${address}   |   Website: ${website}`, 40, 680, { align: 'center', width: 515 });
        doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
           .text(`Contact: ${contact}   |   Date Generated: ${compiledDate}`, 40, 695, { align: 'center', width: 515 });
        doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold')
           .text('STRICTLY CONFIDENTIAL • AUTHENTIC AUDIT RECORD', 40, 715, { align: 'center', width: 515 });

        // Page break to start report contents on Page 2
        doc.addPage();
        doc.y = 45;
      }

      // Metadata summary strip on first content page if cover page not used or at top of body
      if (!showCoverPage) {
        doc.rect(40, 40, 515, 60).fill('#F8FAFC');
        doc.rect(40, 40, 6, 60).fill(primaryColor);
        doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
           .text(instName.toUpperCase(), 55, 48);
        doc.fillColor(secondaryColor).fontSize(11).font('Helvetica-Bold')
           .text((reportTitle || 'Annual Report').toUpperCase(), 55, 66);
        doc.fillColor(grayText).fontSize(8).font('Helvetica')
           .text(`Academic Year: ${academicYear}   |   Departments: ${selectedDepartments.join(', ')}`, 55, 82);
        doc.y = 115;
      }

      // Determine Canonical Section Sequence
      const DEFAULT_CANONICAL_ORDER = [
        'Institute Overview',
        'Department-wise Summary',
        'Department Overview',
        'Student Statistics',
        'Faculty Information',
        'Student Achievements',
        'Department Activities',
        'Events Management',
        'Placement Summary',
        'Research & Publications',
        'Projects & Innovations',
        'Conclusion'
      ];

      // Reorder based on user-provided sectionOrder
      const effectiveOrder = [];
      const userSections = (sectionOrder && sectionOrder.length > 0) ? sectionOrder : selectedSections;

      userSections.forEach(rawSec => {
        const canonical = normalizeSectionName(rawSec);
        if (canonical && canonical !== 'Cover Page' && !effectiveOrder.includes(canonical)) {
          effectiveOrder.push(canonical);
        }
      });

      // Append any selected canonical sections that were omitted in user sectionOrder
      DEFAULT_CANONICAL_ORDER.forEach(defSec => {
        if (hasSectionEnabled(selectedSections, defSec) && !effectiveOrder.includes(defSec)) {
          effectiveOrder.push(defSec);
        }
      });

      // Filter effectiveOrder strictly by selectedSections
      const activeSections = effectiveOrder.filter(sec => hasSectionEnabled(selectedSections, sec));

      // Calculate Institute-Wide Aggregates for High-Level Sections
      let totalStudentsInstitute = 0;
      let totalFacultyInstitute = 0;
      let totalPlacedInstitute = 0;
      let totalAchievementsInstitute = 0;
      let totalActivitiesInstitute = 0;
      let totalEventsInstitute = 0;
      let totalResearchInstitute = 0;
      let totalProjectsInstitute = 0;

      selectedDepartments.forEach(deptName => {
        const d = data[deptName] || {};
        totalStudentsInstitute += (d.studentStats?.total || d.info?.total_students || 0);
        totalFacultyInstitute += (d.faculty?.length || d.info?.total_faculty || 0);
        totalPlacedInstitute += (d.placement?.students_placed || 0);
        totalAchievementsInstitute += (d.studentAchievements?.length || 0);
        totalActivitiesInstitute += (d.activities?.length || 0);
        totalEventsInstitute += (d.events?.length || 0);
        totalResearchInstitute += (d.research?.length || 0);
        totalProjectsInstitute += (d.projects?.length || 0);
      });

      // RENDER REPORT SECTIONS IN REQUESTED ORDER
      activeSections.forEach((sectionName) => {

        // ==========================================
        // SECTION: INSTITUTE OVERVIEW
        // ==========================================
        if (sectionName === 'Institute Overview') {
          checkPageSpace(doc, 150);
          renderSectionHeader(doc, 'Institute Overview & Institutional Academic Standing', secondaryColor);

          const startX = 40;
          const boxY = doc.y;
          doc.rect(startX, boxY, 515, 96).fill('#F8FAFC');
          doc.rect(startX, boxY, 515, 96).stroke(borderColor);

          const instKpis = [
            ['Academic Departments', String(selectedDepartments.length)],
            ['Total Enrolled Students', String(totalStudentsInstitute)],
            ['Faculty Strength', String(totalFacultyInstitute)],
            ['Students Placed', String(totalPlacedInstitute)],
            ['Approved Achievements', String(totalAchievementsInstitute)],
            ['Department Activities', String(totalActivitiesInstitute)],
            ['Institutional Events', String(totalEventsInstitute)],
            ['Research & Patents', String(totalResearchInstitute)],
            ['Academic Projects', String(totalProjectsInstitute)]
          ];

          const colW = 515 / 3;
          instKpis.forEach((item, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const xPos = startX + col * colW;
            const yPos = boxY + 10 + row * 28;

            doc.fillColor(grayText).fontSize(7).font('Helvetica-Bold')
               .text(item[0].toUpperCase(), xPos + 4, yPos, { width: colW - 8, align: 'center' });
            doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold')
               .text(item[1], xPos + 4, yPos + 11, { width: colW - 8, align: 'center' });
          });

          doc.y = boxY + 110;
        }

        // ==========================================
        // SECTION: DEPARTMENT-WISE COMPARATIVE SUMMARY
        // ==========================================
        else if (sectionName === 'Department-wise Summary') {
          checkPageSpace(doc, 120);
          renderSectionHeader(doc, 'Department-wise Comparative Summary', secondaryColor);

          const summaryHeaders = [
            { label: 'Department Name', width: 145 },
            { label: 'Students', width: 45 },
            { label: 'Faculty', width: 45 },
            { label: 'Placed %', width: 45 },
            { label: 'Achiev.', width: 45 },
            { label: 'Activ.', width: 45 },
            { label: 'Events', width: 45 },
            { label: 'Pubs', width: 50 },
            { label: 'Projects', width: 50 }
          ];

          renderTableHeader(doc, summaryHeaders);

          selectedDepartments.forEach((deptName) => {
            checkPageSpace(doc, 22);
            const d = data[deptName] || {};
            const rowY = doc.y;

            const stCount = d.studentStats?.total || d.info?.total_students || 0;
            const fcCount = d.faculty?.length || d.info?.total_faculty || 0;
            const plRate = d.placement?.placement_percentage || 0;
            const acCount = d.studentAchievements?.length || 0;
            const atCount = d.activities?.length || 0;
            const evCount = d.events?.length || 0;
            const pubCount = d.research?.length || 0;
            const prCount = d.projects?.length || 0;

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
               .text(deptName, 45, rowY, { width: 140 });
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica')
               .text(String(stCount), 190, rowY, { width: 40, align: 'center' });
            doc.fillColor(darkText).fontSize(8).font('Helvetica')
               .text(String(fcCount), 235, rowY, { width: 40, align: 'center' });
            doc.fillColor('#047857').fontSize(8).font('Helvetica-Bold')
               .text(`${plRate}%`, 280, rowY, { width: 40, align: 'center' });
            doc.fillColor(darkText).fontSize(8).font('Helvetica')
               .text(String(acCount), 325, rowY, { width: 40, align: 'center' });
            doc.fillColor(darkText).fontSize(8).font('Helvetica')
               .text(String(atCount), 370, rowY, { width: 40, align: 'center' });
            doc.fillColor(darkText).fontSize(8).font('Helvetica')
               .text(String(evCount), 415, rowY, { width: 40, align: 'center' });
            doc.fillColor(darkText).fontSize(8).font('Helvetica')
               .text(String(pubCount), 460, rowY, { width: 45, align: 'center' });
            doc.fillColor(darkText).fontSize(8).font('Helvetica')
               .text(String(prCount), 505, rowY, { width: 45, align: 'center' });

            doc.y = rowY + 18;
            doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
          });

          doc.y += 12;
        }

        // ==========================================
        // SECTION: DEPARTMENT OVERVIEW
        // ==========================================
        else if (sectionName === 'Department Overview') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Department Overview & Academic Leadership', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            checkPageSpace(doc, 90);
            const deptData = data[deptName] || {};
            const info = deptData.info || {};
            const stCount = deptData.studentStats?.total || info.total_students || 0;
            const fcCount = deptData.faculty?.length || info.total_faculty || 0;

            doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
               .text(`Department: ${deptName}`, 45, doc.y);
            doc.y += 14;

            const gridY = doc.y;
            doc.rect(40, gridY, 515, 45).fill('#FAFAFA');
            doc.rect(40, gridY, 515, 45).stroke(borderColor);

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text('Head of Department (HOD):', 50, gridY + 8);
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica').text(info.hod || 'Dr. Department Head', 180, gridY + 8);

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text('Faculty Strength:', 330, gridY + 8);
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica').text(String(fcCount), 420, gridY + 8);

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text('Total Students:', 50, gridY + 26);
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica').text(String(stCount), 180, gridY + 26);

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text('Courses Offered:', 330, gridY + 26);
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica').text(String(info.courses_count || 4), 420, gridY + 26);

            doc.y = gridY + 54;
            if (info.description) {
              doc.fillColor(grayText).fontSize(7.5).font('Helvetica-Oblique')
                 .text(`"${info.description}"`, 45, doc.y, { width: 505 });
              doc.y += 16;
            }
          });
          doc.y += 8;
        }

        // ==========================================
        // SECTION: STUDENT STATISTICS
        // ==========================================
        else if (sectionName === 'Student Statistics') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Student Statistics, Demographics & Year Distribution', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            checkPageSpace(doc, 75);
            const deptData = data[deptName] || {};
            const stats = deptData.studentStats || {};
            const total = stats.total || deptData.info?.total_students || 0;
            const yearDist = stats.yearDistribution || {};
            const sectionDist = stats.sectionDistribution || {};

            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department: ${deptName} (Total Active Students: ${total})`, 45, doc.y);
            doc.y += 12;

            const distStr = Object.keys(yearDist).length > 0
              ? Object.entries(yearDist).map(([yr, cnt]) => `${yr}: ${cnt}`).join('   |   ')
              : 'Year 1: 0   |   Year 2: 0   |   Year 3: 0   |   Year 4: 0';

            const secStr = Object.keys(sectionDist).length > 0
              ? Object.entries(sectionDist).map(([sec, cnt]) => `${sec}: ${cnt}`).join('   |   ')
              : 'Section A: ' + total;

            const statY = doc.y;
            doc.rect(40, statY, 515, 36).fill('#F8FAFC');
            doc.rect(40, statY, 515, 36).stroke(borderColor);

            doc.fillColor(darkText).fontSize(7.5).font('Helvetica-Bold').text('Year Distribution:', 50, statY + 8);
            doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica').text(distStr, 150, statY + 8, { width: 395 });

            doc.fillColor(darkText).fontSize(7.5).font('Helvetica-Bold').text('Section Distribution:', 50, statY + 20);
            doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica').text(secStr, 150, statY + 20, { width: 395 });

            doc.y = statY + 44;
          });
          doc.y += 8;
        }

        // ==========================================
        // SECTION: FACULTY INFORMATION
        // ==========================================
        else if (sectionName === 'Faculty Information') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Faculty Information, Designations & Qualifications', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            const deptData = data[deptName] || {};
            const facultyMembers = deptData.faculty || [];

            checkPageSpace(doc, 45);
            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department of ${deptName}:`, 45, doc.y);
            doc.y += 10;

            if (facultyMembers.length === 0) {
              doc.fillColor(grayText).fontSize(8).font('Helvetica-Oblique')
                 .text('No faculty records logged for this department.', 50, doc.y);
              doc.y += 14;
            } else {
              const facHeaders = [
                { label: 'Faculty Name & ID', width: 130 },
                { label: 'Designation & Qualification', width: 160 },
                { label: 'Specialization', width: 110 },
                { label: 'Pubs', width: 35 },
                { label: 'Proj', width: 35 },
                { label: 'Conf', width: 45 }
              ];

              renderTableHeader(doc, facHeaders);

              facultyMembers.forEach((fac) => {
                checkPageSpace(doc, 24);
                const rowY = doc.y;

                doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
                   .text(fac.faculty_name, 45, rowY, { width: 125 });
                doc.fillColor(grayText).fontSize(7).font('Helvetica')
                   .text(fac.faculty_id || '-', 45, rowY + 9, { width: 125 });

                doc.fillColor(darkText).fontSize(7.5).font('Helvetica-Bold')
                   .text(fac.designation, 175, rowY, { width: 155 });
                doc.fillColor(grayText).fontSize(7).font('Helvetica')
                   .text(fac.qualification || '-', 175, rowY + 9, { width: 155 });

                doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica')
                   .text(fac.specialization || 'Engineering', 335, rowY, { width: 105 });

                doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
                   .text(String(fac.publications || 0), 445, rowY + 3, { width: 30, align: 'center' });
                doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
                   .text(String(fac.research_projects || 0), 480, rowY + 3, { width: 30, align: 'center' });
                doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
                   .text(String(fac.conferences_attended || 0), 515, rowY + 3, { width: 40, align: 'center' });

                doc.y = rowY + 22;
                doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
              });
              doc.y += 10;
            }
          });
          doc.y += 6;
        }

        // ==========================================
        // SECTION: STUDENT ACHIEVEMENTS
        // ==========================================
        else if (sectionName === 'Student Achievements') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Student Achievements, Honors & Awards (Approved)', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            const deptData = data[deptName] || {};
            const achievements = deptData.studentAchievements || [];

            checkPageSpace(doc, 45);
            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department of ${deptName}:`, 45, doc.y);
            doc.y += 10;

            if (achievements.length === 0) {
              doc.fillColor(grayText).fontSize(8).font('Helvetica-Oblique')
                 .text('No approved student achievements for this department.', 50, doc.y);
              doc.y += 14;
            } else {
              const achHeaders = [
                { label: 'Student Name & Reg No', width: 130 },
                { label: 'Category', width: 75 },
                { label: 'Achievement Title', width: 145 },
                { label: 'Event / Organization', width: 105 },
                { label: 'Award / Date', width: 60 }
              ];

              renderTableHeader(doc, achHeaders);

              achievements.forEach((ach) => {
                checkPageSpace(doc, 24);
                const rowY = doc.y;

                doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
                   .text(ach.student_name, 45, rowY, { width: 125 });
                doc.fillColor(grayText).fontSize(7).font('Helvetica')
                   .text(ach.register_no || ach.student_id || '-', 45, rowY + 9, { width: 125 });

                doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica-Bold')
                   .text(ach.achievement_type || ach.category || 'Award', 175, rowY, { width: 70 });

                doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
                   .text(ach.title, 250, rowY, { width: 140 });

                doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
                   .text(ach.event_organization || ach.event_name || '-', 395, rowY, { width: 100 });

                doc.fillColor('#047857').fontSize(7.5).font('Helvetica-Bold')
                   .text(ach.award || ach.date || 'Verified', 500, rowY, { width: 55 });

                doc.y = rowY + 22;
                doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
              });
              doc.y += 10;
            }
          });
          doc.y += 6;
        }

        // ==========================================
        // SECTION: DEPARTMENT ACTIVITIES
        // ==========================================
        else if (sectionName === 'Department Activities') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Departmental Activities, Workshops & Seminars (Approved)', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            const deptData = data[deptName] || {};
            const activities = deptData.activities || [];

            checkPageSpace(doc, 45);
            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department of ${deptName}:`, 45, doc.y);
            doc.y += 10;

            if (activities.length === 0) {
              doc.fillColor(grayText).fontSize(8).font('Helvetica-Oblique')
                 .text('No approved activities logged for this department.', 50, doc.y);
              doc.y += 14;
            } else {
              const actHeaders = [
                { label: 'Activity Name', width: 175 },
                { label: 'Category / Type', width: 95 },
                { label: 'Date & Venue', width: 110 },
                { label: 'Attendees', width: 50 },
                { label: 'Coordinator', width: 85 }
              ];

              renderTableHeader(doc, actHeaders);

              activities.forEach((act) => {
                checkPageSpace(doc, 24);
                const rowY = doc.y;

                doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
                   .text(act.activity_name || act.title, 45, rowY, { width: 170 });

                doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica')
                   .text(act.activity_type || act.category || 'General', 220, rowY, { width: 90 });

                const dateVen = [act.date, act.venue].filter(Boolean).join(' • ');
                doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
                   .text(dateVen || '-', 315, rowY, { width: 105 });

                doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
                   .text(String(act.participants_count || 0), 425, rowY, { width: 45, align: 'center' });

                doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
                   .text(act.faculty_coordinator || act.coordinator || '-', 475, rowY, { width: 80 });

                doc.y = rowY + 20;
                doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
              });
              doc.y += 10;
            }
          });
          doc.y += 6;
        }

        // ==========================================
        // SECTION: EVENTS MANAGEMENT
        // ==========================================
        else if (sectionName === 'Events Management') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Institutional & Departmental Events (Approved)', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            const deptData = data[deptName] || {};
            const events = deptData.events || [];

            checkPageSpace(doc, 45);
            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department of ${deptName}:`, 45, doc.y);
            doc.y += 10;

            if (events.length === 0) {
              doc.fillColor(grayText).fontSize(8).font('Helvetica-Oblique')
                 .text('No approved events recorded for this department.', 50, doc.y);
              doc.y += 14;
            } else {
              const evHeaders = [
                { label: 'Event Title', width: 165 },
                { label: 'Category', width: 85 },
                { label: 'Date & Venue', width: 120 },
                { label: 'Attendees', width: 50 },
                { label: 'Coordinator / Organizer', width: 95 }
              ];

              renderTableHeader(doc, evHeaders);

              events.forEach((ev) => {
                checkPageSpace(doc, 24);
                const rowY = doc.y;

                doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
                   .text(ev.event_name || ev.title, 45, rowY, { width: 160 });

                doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica')
                   .text(ev.event_type || ev.category || 'Event', 210, rowY, { width: 80 });

                const evDateVen = [ev.event_date || ev.date, ev.venue].filter(Boolean).join(' • ');
                doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
                   .text(evDateVen || '-', 295, rowY, { width: 115 });

                const totalPart = (ev.participants_count || ev.student_count || 0);
                doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
                   .text(String(totalPart), 415, rowY, { width: 45, align: 'center' });

                doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
                   .text(ev.coordinator || ev.organizer || '-', 465, rowY, { width: 90 });

                doc.y = rowY + 20;
                doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
              });
              doc.y += 10;
            }
          });
          doc.y += 6;
        }

        // ==========================================
        // SECTION: PLACEMENT SUMMARY & APPROVED OFFERS
        // ==========================================
        else if (sectionName === 'Placement Summary') {
          checkPageSpace(doc, 110);
          renderSectionHeader(doc, 'Placement Progression & Approved Career Offers', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            const deptData = data[deptName] || {};
            const place = deptData.placement || {};
            const placementOffers = deptData.placementRecords || [];

            checkPageSpace(doc, 85);
            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department: ${deptName}`, 45, doc.y);
            doc.y += 10;

            const boxY = doc.y;
            doc.rect(40, boxY, 515, 45).fill('#F8FAFC');
            doc.rect(40, boxY, 515, 45).stroke(borderColor);

            const statCols = [
              { label: 'Eligible', val: place.eligible_students || '0' },
              { label: 'Placed', val: place.students_placed || '0' },
              { label: 'Placement Rate', val: `${place.placement_percentage || '0'}%` },
              { label: 'Highest', val: place.highest_package ? `${place.highest_package} LPA` : '-' },
              { label: 'Average', val: place.average_package ? `${place.average_package} LPA` : '-' },
              { label: 'Companies', val: place.companies_visited || '0' }
            ];

            const itemWidth = 515 / statCols.length;
            statCols.forEach((stat, i) => {
              const x = 40 + (i * itemWidth);
              doc.fillColor(grayText).fontSize(6.5).font('Helvetica-Bold')
                 .text(stat.label.toUpperCase(), x + 2, boxY + 8, { width: itemWidth - 4, align: 'center' });
              doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
                 .text(String(stat.val), x + 2, boxY + 22, { width: itemWidth - 4, align: 'center' });
            });

            doc.y = boxY + 54;

            // Placement Offers Table (Approved)
            if (placementOffers.length > 0) {
              const plHeaders = [
                { label: 'Student Name & Reg No', width: 140 },
                { label: 'Recruiting Company', width: 135 },
                { label: 'Package (LPA)', width: 85 },
                { label: 'Designation / Role', width: 155 }
              ];

              renderTableHeader(doc, plHeaders);

              placementOffers.slice(0, 15).forEach((rec) => {
                checkPageSpace(doc, 20);
                const rowY = doc.y;

                doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
                   .text(rec.student_name, 45, rowY, { width: 135 });
                if (rec.register_no) {
                  doc.fillColor(grayText).fontSize(7).font('Helvetica')
                     .text(rec.register_no, 45, rowY + 9, { width: 135 });
                }

                doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold')
                   .text(rec.company_name, 185, rowY, { width: 130 });

                doc.fillColor('#047857').fontSize(8).font('Helvetica-Bold')
                   .text(rec.package ? `${rec.package} LPA` : '-', 320, rowY, { width: 80 });

                doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
                   .text(rec.job_role || rec.role || 'Software Engineer', 405, rowY, { width: 150 });

                doc.y = rowY + 18;
                doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
              });

              if (placementOffers.length > 15) {
                doc.fillColor(grayText).fontSize(7.5).font('Helvetica-Oblique')
                   .text(`... and ${placementOffers.length - 15} additional approved placement records.`, 45, doc.y + 4);
                doc.y += 16;
              } else {
                doc.y += 8;
              }
            }
          });
          doc.y += 6;
        }

        // ==========================================
        // SECTION: RESEARCH & PUBLICATIONS
        // ==========================================
        else if (sectionName === 'Research & Publications') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Research Publications, Patents & Funded Grants (Approved)', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            const deptData = data[deptName] || {};
            const researchList = deptData.research || [];

            checkPageSpace(doc, 45);
            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department of ${deptName}:`, 45, doc.y);
            doc.y += 10;

            if (researchList.length === 0) {
              doc.fillColor(grayText).fontSize(8).font('Helvetica-Oblique')
                 .text('No approved research publications recorded for this academic year.', 50, doc.y);
              doc.y += 14;
            } else {
              const resHeaders = [
                { label: 'Paper Title & Authors', width: 175 },
                { label: 'Type', width: 75 },
                { label: 'Journal / Publisher / DOI', width: 160 },
                { label: 'Funding / Date', width: 105 }
              ];

              renderTableHeader(doc, resHeaders);

              researchList.forEach((res) => {
                checkPageSpace(doc, 26);
                const rowY = doc.y;

                doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
                   .text(res.title, 45, rowY, { width: 170 });
                if (res.authors) {
                  doc.fillColor(grayText).fontSize(7).font('Helvetica')
                     .text(res.authors, 45, doc.y + 1, { width: 170 });
                }

                doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica-Bold')
                   .text(res.publication_type, 220, rowY, { width: 70 });

                const pubDetails = [
                  res.journal_conference_name || res.publisher || '',
                  res.doi ? `DOI: ${res.doi}` : ''
                ].filter(Boolean).join(' | ');

                doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
                   .text(pubDetails || 'Repository Record', 295, rowY, { width: 155 });

                const fundText = res.funding_amount > 0
                  ? `${res.funding_amount} L (${res.funding_agency || 'Grant'})`
                  : res.publication_date || '-';

                doc.fillColor(res.funding_amount > 0 ? '#047857' : grayText).fontSize(7.5).font('Helvetica-Bold')
                   .text(fundText, 460, rowY, { width: 95 });

                doc.y = Math.max(doc.y, rowY + 22);
                doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
              });
              doc.y += 10;
            }
          });
          doc.y += 6;
        }

        // ==========================================
        // SECTION: PROJECTS & INNOVATIONS
        // ==========================================
        else if (sectionName === 'Projects & Innovations') {
          checkPageSpace(doc, 100);
          renderSectionHeader(doc, 'Academic, Sponsored & Innovation Projects (Approved)', secondaryColor);

          selectedDepartments.forEach((deptName) => {
            const deptData = data[deptName] || {};
            const projectList = deptData.projects || [];

            checkPageSpace(doc, 45);
            doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
               .text(`Department of ${deptName}:`, 45, doc.y);
            doc.y += 10;

            if (projectList.length === 0) {
              doc.fillColor(grayText).fontSize(8).font('Helvetica-Oblique')
                 .text('No approved project records recorded for this academic year.', 50, doc.y);
              doc.y += 14;
            } else {
              const prjHeaders = [
                { label: 'Project Title & Team', width: 185 },
                { label: 'Category / Type', width: 95 },
                { label: 'Guide / Partner', width: 125 },
                { label: 'Status & Awards', width: 110 }
              ];

              renderTableHeader(doc, prjHeaders);

              projectList.forEach((prj) => {
                checkPageSpace(doc, 26);
                const rowY = doc.y;

                doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
                   .text(prj.project_title || prj.title, 45, rowY, { width: 180 });

                if (prj.student_names) {
                  doc.fillColor(grayText).fontSize(7).font('Helvetica')
                     .text(`Team: ${prj.student_names}`, 45, doc.y + 1, { width: 180 });
                }

                doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica')
                   .text(`${prj.project_category || 'Academic'} (${prj.project_type || 'Final Year'})`, 230, rowY, { width: 90 });

                const guidePartner = [
                  prj.coordinator || prj.project_guide ? `Guide: ${prj.coordinator || prj.project_guide}` : '',
                  prj.industry_partner ? `Partner: ${prj.industry_partner}` : ''
                ].filter(Boolean).join(' | ');

                doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
                   .text(guidePartner || '-', 325, rowY, { width: 120 });

                const statusAward = [
                  prj.project_status || 'Completed',
                  prj.awards_recognition ? `★ ${prj.awards_recognition}` : ''
                ].filter(Boolean).join(' | ');

                doc.fillColor(prj.awards_recognition ? '#D97706' : '#047857').fontSize(7.5).font('Helvetica-Bold')
                   .text(statusAward, 450, rowY, { width: 105 });

                doc.y = Math.max(doc.y, rowY + 22);
                doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
              });
              doc.y += 10;
            }
          });
          doc.y += 6;
        }

        // ==========================================
        // SECTION: CONCLUSION & SIGNATURES
        // ==========================================
        else if (sectionName === 'Conclusion') {
          checkPageSpace(doc, 130);
          renderSectionHeader(doc, 'Conclusion & Institutional Certification', secondaryColor);

          doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
             .text(
               `This Institutional Annual Report for Academic Year ${academicYear} represents an authentic compilation ` +
               'of institutional outcomes, academic achievements, placement records, faculty contributions, and research ' +
               'publications across all participating academic departments. ' +
               'All records included herein have undergone institutional review and received verified approval status.',
               45, doc.y, { width: 510, align: 'justify', lineGap: 3 }
             );
          doc.y += 24;

          // Three Official Signature Blocks
          checkPageSpace(doc, 70);
          const sigY = doc.y;
          doc.moveTo(40, sigY).lineTo(555, sigY).strokeColor(borderColor).stroke();
          doc.y += 14;

          const colW = 515 / 3;

          // Signature 1
          doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
             .text('Prepared & Compiled by:', 45, doc.y);
          doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
             .text('Academic Report Committee', 45, doc.y + 12);
          doc.fillColor(grayText).fontSize(7).font('Helvetica-Oblique')
             .text('Verified Portal Extraction', 45, doc.y + 24);

          // Signature 2
          doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
             .text('Reviewed by:', 45 + colW, sigY + 14);
          doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
             .text('Head of Department / IQAC', 45 + colW, sigY + 26);
          doc.fillColor(grayText).fontSize(7).font('Helvetica-Oblique')
             .text('Accreditation Governance Cell', 45 + colW, sigY + 38);

          // Signature 3
          doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
             .text('Approved by:', 45 + colW * 2, sigY + 14);
          doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
             .text('Principal / Director', 45 + colW * 2, sigY + 26);
          doc.fillColor(grayText).fontSize(7).font('Helvetica-Bold')
             .text(instName, 45 + colW * 2, sigY + 38);

          doc.y = sigY + 65;
        }

      }); // End activeSections loop

      // --- PAGE NUMBERING AND HEADERS/FOOTERS ACROSS ALL BUFFERED PAGES ---
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        // Skip headers & footers on the cover page
        if (showCoverPage && i === 0) {
          continue;
        }

        // Running Header on content pages
        if (customization.includeHeader !== false) {
          doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold')
             .text(instName.toUpperCase(), 40, 22, { width: 300 });
          doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
             .text(`ANNUAL REPORT • AY ${academicYear}`, 340, 22, { width: 215, align: 'right' });
          doc.moveTo(40, 32).lineTo(555, 32).strokeColor('#E2E8F0').stroke();
        }

        // Running Footer on content pages
        if (customization.includeFooter !== false) {
          doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#E2E8F0').stroke();
          doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
             .text(`${instName} • Confidential & Verified Academic Audit`, 40, 792);
          doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold')
             .text(`Page ${i + 1} of ${totalPages}`, 450, 792, { width: 105, align: 'right' });
        }
      }

      doc.end();

      writeStream.on('finish', () => {
        const stats = fs.statSync(filePath);
        resolve({
          filePath,
          fileName,
          fileSize: stats.size
        });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function renderSectionHeader(doc, title, color) {
  doc.rect(40, doc.y, 515, 18).fill('#F1F5F9');
  doc.fillColor(color).fontSize(9.5).font('Helvetica-Bold')
     .text(title, 48, doc.y + 4);
  doc.y += 24;
}

function renderTableHeader(doc, headers) {
  const tableY = doc.y;
  doc.rect(40, tableY, 515, 18).fill('#E2E8F0');

  let currentX = 45;
  headers.forEach((h) => {
    doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
       .text(h.label, currentX, tableY + 5, { width: h.width });
    currentX += h.width;
  });

  doc.y = tableY + 22;
}

function checkPageSpace(doc, neededPoints) {
  if (doc.y + neededPoints > 770) {
    doc.addPage();
    doc.y = 45;
  }
}

/**
 * Generate an Individual Student History PDF report using PDFKit
 * @param {Object} options
 * @param {Object} options.student
 * @param {string} options.academicYear
 * @param {Array<string>} options.selectedSections
 * @param {Array<Object>} options.placements
 * @param {Array<Object>} options.achievements
 * @param {Array<Object>} options.activities
 * @param {Array<Object>} options.events
 * @returns {Promise<{ filePath: string, fileName: string, fileSize: number }>}
 */
function generateStudentHistoryPDF({ student, academicYear = 'All', selectedSections = [], placements = [], achievements = [], activities = [], events = [], research = [], projects = [] }) {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = Date.now();
      const cleanReg = (student.register_no || 'STUDENT').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Student_History_${cleanReg}_${timestamp}.pdf`;
      const filePath = path.join(reportsDir, fileName);

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `Individual Student History Report - ${student.name} (${student.register_no})`,
          Author: 'Institutional Annual Report Portal',
          Subject: `Student Record History for ${student.register_no}`,
          Keywords: 'student report, academic history, placements, achievements'
        }
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Colors matching institute branding
      const primaryColor = '#1E3A8A'; // Deep Navy
      const secondaryColor = '#0F766E'; // Teal
      const accentGreen = '#047857'; // Forest Green
      const darkText = '#1E293B';
      const grayText = '#64748B';
      const borderColor = '#CBD5E1';

      // --- 1. COVER / HEADER BANNER ---
      doc.rect(40, 40, 515, 80).fill('#F8FAFC');
      doc.rect(40, 40, 6, 80).fill(primaryColor);

      doc.fillColor(primaryColor).fontSize(15).font('Helvetica-Bold')
         .text('EXCELLENCE INSTITUTE OF TECHNOLOGY', 55, 52);

      doc.fillColor(grayText).fontSize(8.5).font('Helvetica')
         .text('Accredited by NBA & NAAC with A++ Grade | Autonomous Institution', 55, 71);

      doc.fillColor(secondaryColor).fontSize(12.5).font('Helvetica-Bold')
         .text('INDIVIDUAL STUDENT HISTORY REPORT', 55, 87);

      doc.y = 135;

      // --- 2. STUDENT PROFILE & CREDENTIALS CARD ---
      doc.rect(40, doc.y, 515, 100).fill('#F1F5F9');
      doc.rect(40, doc.y, 515, 100).stroke(borderColor);

      const cardY = doc.y + 10;
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold')
         .text((student.name || 'Student Name').toUpperCase(), 55, cardY);
      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold')
         .text('Register No: ', 55, cardY + 16, { continued: true })
         .fillColor(secondaryColor).text(student.register_no || '-');

      const leftColX = 55;
      const rightColX = 310;
      let gridY = cardY + 32;

      // Row 1
      doc.fillColor(grayText).fontSize(8).font('Helvetica-Bold').text('Department:', leftColX, gridY);
      doc.fillColor(darkText).fontSize(8).font('Helvetica').text(student.department || '-', leftColX + 70, gridY, { width: 180 });

      doc.fillColor(grayText).fontSize(8).font('Helvetica-Bold').text('Academic Batch:', rightColX, gridY);
      doc.fillColor(darkText).fontSize(8).font('Helvetica').text(student.academic_year || 'N/A', rightColX + 80, gridY);

      // Row 2
      gridY += 15;
      doc.fillColor(grayText).fontSize(8).font('Helvetica-Bold').text('Current Year:', leftColX, gridY);
      const yearSuffix = student.current_year === 1 ? 'st' : student.current_year === 2 ? 'nd' : student.current_year === 3 ? 'rd' : 'th';
      doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`${student.current_year || 1}${yearSuffix} Year (Sec ${student.section || 'A'})`, leftColX + 70, gridY);

      doc.fillColor(grayText).fontSize(8).font('Helvetica-Bold').text('Student Status:', rightColX, gridY);
      doc.fillColor(student.status === 'Active' ? accentGreen : '#DC2626').fontSize(8).font('Helvetica-Bold').text(student.status || 'Active', rightColX + 80, gridY);

      // Row 3
      gridY += 15;
      doc.fillColor(grayText).fontSize(8).font('Helvetica-Bold').text('Email:', leftColX, gridY);
      doc.fillColor(darkText).fontSize(8).font('Helvetica').text(student.email || 'N/A', leftColX + 70, gridY, { width: 180 });

      doc.fillColor(grayText).fontSize(8).font('Helvetica-Bold').text('Report Scope:', rightColX, gridY);
      doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text(academicYear === 'All' ? 'All Available Years' : `Year ${academicYear}`, rightColX + 80, gridY);

      doc.y = cardY + 110;

      // --- SECTION 1: Academic & Profile Overview ---
      if (selectedSections.length === 0 || selectedSections.some(s => ['Student Profile', 'Profile', 'Academic Information', 'Academic'].includes(s))) {
        checkPageSpace(doc, 75);
        renderSectionHeader(doc, '1. Academic Enrolment & Curricular Affiliation', secondaryColor);

        doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
           .text(
             `This official dossier outlines the complete academic progression, verified competitive accomplishments, and institutional placements for ${student.name} (Register No: ${student.register_no}) affiliated with the Department of ${student.department}. The student is currently registered under batch ${student.academic_year || 'Regular Program'} in Year ${student.current_year || 1}, Section ${student.section || 'A'}.`,
             45, doc.y, { width: 505, align: 'justify', lineGap: 2 }
           );
        doc.y += 28;
      }

      // --- SECTION 2: Placement & Career Records ---
      if (selectedSections.length === 0 || selectedSections.some(s => ['Placement History', 'Placements', 'Placement'].includes(s))) {
        checkPageSpace(doc, 100);
        renderSectionHeader(doc, '2. Placement Offers & Career Progression', secondaryColor);

        if (placements.length === 0) {
          doc.fillColor(grayText).fontSize(8.5).font('Helvetica-Oblique')
             .text('No approved placement or higher education records logged for this student during the selected period.', 45, doc.y);
          doc.y += 18;
        } else {
          const headers = [
            { label: 'Company / Organization', width: 130 },
            { label: 'Package (LPA)', width: 75 },
            { label: 'Status', width: 80 },
            { label: 'Offer Role / Details', width: 150 },
            { label: 'Academic Year', width: 80 }
          ];

          renderTableHeader(doc, headers);

          let highestPkg = 0;
          let pkgSum = 0;
          let validPkgCount = 0;

          placements.forEach((p) => {
            checkPageSpace(doc, 22);
            const rowY = doc.y;

            const pkgVal = parseFloat(p.package) || 0;
            if (pkgVal > highestPkg) highestPkg = pkgVal;
            if (pkgVal > 0) {
              pkgSum += pkgVal;
              validPkgCount++;
            }

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
               .text(p.company_name, 45, rowY, { width: 125 });

            doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
               .text(pkgVal > 0 ? `${pkgVal.toFixed(1)} LPA` : '-', 175, rowY, { width: 70 });

            doc.fillColor(p.placement_status === 'Placed' ? accentGreen : darkText).fontSize(7.5).font('Helvetica')
               .text(p.placement_status || 'Placed', 250, rowY, { width: 75 });

            doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
               .text(p.offer_details || '-', 330, rowY, { width: 145 });

            doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
               .text(p.academic_year || '-', 480, rowY, { width: 75 });

            doc.y = rowY + 20;
            doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
          });

          // Placement summary strip
          doc.y += 4;
          checkPageSpace(doc, 24);
          doc.rect(40, doc.y, 515, 20).fill('#EFF6FF');
          doc.rect(40, doc.y, 515, 20).stroke('#BFDBFE');
          doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
             .text(`Total Offers: ${placements.length}   |   Highest Package: ${highestPkg > 0 ? highestPkg.toFixed(1) + ' LPA' : 'N/A'}   |   Average Package: ${validPkgCount > 0 ? (pkgSum / validPkgCount).toFixed(1) + ' LPA' : 'N/A'}`, 55, doc.y + 6);
          doc.y += 28;
        }
      }

      // --- SECTION 3: Student Achievements & Awards ---
      if (selectedSections.length === 0 || selectedSections.some(s => ['Student Achievements', 'Achievements', 'Achievement'].includes(s))) {
        checkPageSpace(doc, 100);
        renderSectionHeader(doc, '3. Honors, Awards & Competitive Achievements', secondaryColor);

        if (achievements.length === 0) {
          doc.fillColor(grayText).fontSize(8.5).font('Helvetica-Oblique')
             .text('No approved student achievement or competitive awards recorded for this student during the selected period.', 45, doc.y);
          doc.y += 18;
        } else {
          const headers = [
            { label: 'Achievement Title', width: 140 },
            { label: 'Category', width: 75 },
            { label: 'Organizing Body / Event', width: 125 },
            { label: 'Date / Year', width: 70 },
            { label: 'Description', width: 105 }
          ];

          renderTableHeader(doc, headers);

          achievements.forEach((ach) => {
            checkPageSpace(doc, 25);
            const rowY = doc.y;

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
               .text(ach.title, 45, rowY, { width: 135 });

            doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica')
               .text(ach.achievement_type, 185, rowY, { width: 70 });

            doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
               .text(ach.event_organization, 260, rowY, { width: 120 });

            doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
               .text(ach.date || ach.academic_year || '-', 385, rowY, { width: 65 });

            doc.fillColor(grayText).fontSize(7).font('Helvetica')
               .text(ach.description || '-', 455, rowY, { width: 100 });

            doc.y = rowY + 22;
            doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
          });

          doc.y += 4;
          checkPageSpace(doc, 22);
          doc.rect(40, doc.y, 515, 18).fill('#F0FDF4');
          doc.rect(40, doc.y, 515, 18).stroke('#BBF7D0');
          doc.fillColor(accentGreen).fontSize(8).font('Helvetica-Bold')
             .text(`Total Approved Achievements: ${achievements.length} verified item(s)`, 55, doc.y + 5);
          doc.y += 26;
        }
      }

      // --- SECTION 4: Department Activities & Event Participation ---
      if (selectedSections.length === 0 || selectedSections.some(s => ['Department Activities', 'Activities', 'Activity'].includes(s))) {
        checkPageSpace(doc, 80);
        renderSectionHeader(doc, '4. Departmental Activities & Event Participation', secondaryColor);

        if (activities.length === 0) {
          doc.fillColor(grayText).fontSize(8.5).font('Helvetica-Oblique')
             .text('No individual departmental activity participations linked to this student for the selected scope.', 45, doc.y);
          doc.y += 18;
        } else {
          const headers = [
            { label: 'Activity Name', width: 160 },
            { label: 'Type', width: 90 },
            { label: 'Date', width: 75 },
            { label: 'Coordinator / Role', width: 110 },
            { label: 'Details', width: 80 }
          ];

          renderTableHeader(doc, headers);

          activities.forEach((act) => {
            checkPageSpace(doc, 22);
            const rowY = doc.y;

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
               .text(act.activity_name, 45, rowY, { width: 155 });

            doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica')
               .text(act.activity_type || '-', 205, rowY, { width: 85 });

            doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
               .text(act.date || '-', 295, rowY, { width: 70 });

            doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
               .text(act.faculty_coordinator || '-', 370, rowY, { width: 105 });

            doc.fillColor(grayText).fontSize(7).font('Helvetica')
               .text(act.description || '-', 480, rowY, { width: 75 });

            doc.y = rowY + 20;
            doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
          });
          doc.y += 15;
        }
      }

      // --- SECTION 5: Institutional & Departmental Events Participation ---
      if (selectedSections.length === 0 || selectedSections.includes('Events Management') || selectedSections.includes('Events') || selectedSections.includes('Institutional Events')) {
        checkPageSpace(doc, 80);
        renderSectionHeader(doc, '5. Departmental & Institutional Events Participation', secondaryColor);

        if (events.length === 0) {
          doc.fillColor(grayText).fontSize(8.5).font('Helvetica-Oblique')
             .text('No individual event participations linked to this student for the selected scope.', 45, doc.y);
          doc.y += 18;
        } else {
          const headers = [
            { label: 'Event Name', width: 160 },
            { label: 'Category', width: 85 },
            { label: 'Date', width: 70 },
            { label: 'Venue', width: 100 },
            { label: 'Coordinator / Role', width: 100 }
          ];

          renderTableHeader(doc, headers);

          events.forEach((ev) => {
            checkPageSpace(doc, 22);
            const rowY = doc.y;

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
               .text(ev.event_name, 45, rowY, { width: 155 });

            doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica')
               .text(ev.event_type || '-', 205, rowY, { width: 80 });

            doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
               .text(ev.event_date || '-', 290, rowY, { width: 65 });

            doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
               .text(ev.venue || 'Campus', 360, rowY, { width: 95 });

            doc.fillColor(grayText).fontSize(7).font('Helvetica')
               .text(ev.coordinator || '-', 460, rowY, { width: 95 });

            doc.y = rowY + 20;
            doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
          });
          doc.y += 15;
        }
      }

      // --- SECTION 6: Research Contributions & Publications ---
      if (selectedSections.length === 0 || selectedSections.some(s => ['Research & Publications', 'Research Contributions', 'Publications', 'Research'].includes(s))) {
        checkPageSpace(doc, 80);
        renderSectionHeader(doc, '6. Research Contributions, Publications & Patents', secondaryColor);

        if (research.length === 0) {
          doc.fillColor(grayText).fontSize(8.5).font('Helvetica-Oblique')
             .text('No approved research publications or patents linked to this student for the selected scope.', 45, doc.y);
          doc.y += 18;
        } else {
          const headers = [
            { label: 'Publication / Paper Title', width: 170 },
            { label: 'Type', width: 75 },
            { label: 'Journal / Publisher / DOI', width: 160 },
            { label: 'Date / Year', width: 100 }
          ];

          renderTableHeader(doc, headers);

          research.forEach((res) => {
            checkPageSpace(doc, 22);
            const rowY = doc.y;

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
               .text(res.title, 45, rowY, { width: 165 });

            doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica')
               .text(res.publication_type || '-', 215, rowY, { width: 70 });

            const journalDoi = [
              res.journal_conference_name || res.publisher || '',
              res.doi ? `DOI: ${res.doi}` : ''
            ].filter(Boolean).join(' | ');

            doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
               .text(journalDoi || '-', 290, rowY, { width: 155 });

            doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
               .text(res.publication_date || res.academic_year || '-', 450, rowY, { width: 95 });

            doc.y = rowY + 20;
            doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
          });
          doc.y += 15;
        }
      }

      // --- SECTION 7: Student Projects, Innovations & Awards ---
      if (selectedSections.length === 0 || selectedSections.some(s => ['Projects & Innovations', 'Projects', 'Student Projects', 'Awards and project recognition'].includes(s))) {
        checkPageSpace(doc, 80);
        renderSectionHeader(doc, '7. Academic, Hackathon & Innovation Projects', secondaryColor);

        if (projects.length === 0) {
          doc.fillColor(grayText).fontSize(8.5).font('Helvetica-Oblique')
             .text('No approved project participations or project awards linked to this student for the selected scope.', 45, doc.y);
          doc.y += 18;
        } else {
          const headers = [
            { label: 'Project Title', width: 160 },
            { label: 'Category / Type', width: 90 },
            { label: 'Guide / Organization', width: 125 },
            { label: 'Status & Awards', width: 130 }
          ];

          renderTableHeader(doc, headers);

          projects.forEach((prj) => {
            checkPageSpace(doc, 24);
            const rowY = doc.y;

            doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
               .text(prj.project_title, 45, rowY, { width: 155 });

            doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica')
               .text(`${prj.project_category} (${prj.project_type})`, 205, rowY, { width: 85 });

            const partnerGuide = [
              prj.coordinator ? `Guide: ${prj.coordinator}` : '',
              prj.industry_partner ? `Partner: ${prj.industry_partner}` : ''
            ].filter(Boolean).join(' | ');

            doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
               .text(partnerGuide || '-', 295, rowY, { width: 120 });

            const statusAward = [
              prj.project_status || 'Completed',
              prj.awards_recognition ? `★ ${prj.awards_recognition}` : ''
            ].filter(Boolean).join(' | ');

            doc.fillColor(prj.awards_recognition ? '#D97706' : accentGreen).fontSize(7.5).font('Helvetica-Bold')
               .text(statusAward, 420, rowY, { width: 125 });

            doc.y = rowY + 22;
            doc.moveTo(40, doc.y - 2).lineTo(555, doc.y - 2).strokeColor('#F1F5F9').stroke();
          });
          doc.y += 15;
        }
      }

      // --- 8. INSTITUTIONAL VERIFICATION & SIGN-OFF ---
      checkPageSpace(doc, 90);
      doc.y += 10;
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(borderColor).stroke();
      doc.y += 15;

      const signY = doc.y;
      doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
         .text('Prepared & Verified by:', 55, signY);
      doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
         .text('Academic Records Cell', 55, signY + 12);
      doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
         .text('Head of the Department (HOD)', 230, signY);
      doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
         .text(student.department, 230, signY + 12);
      doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold')
         .text('Dean / Principal', 430, signY);
      doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
         .text('Excellence Institute of Technology', 430, signY + 12);

      doc.y = signY + 40;
      doc.fillColor(grayText).fontSize(7).font('Helvetica-Oblique')
         .text('Note: This document is an authentic computerized summary extracted directly from the Institute Annual Report Portal database.', 40, doc.y, { width: 515, align: 'center' });

      // --- 6. PAGE NUMBERING & FOOTERS ON ALL PAGES ---
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#E2E8F0').stroke();
        doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
           .text(`Individual Student History Report — ${student.name} (${student.register_no})`, 40, 792);
        doc.fillColor(grayText).fontSize(7.5).font('Helvetica')
           .text(`Page ${i + 1} of ${totalPages}`, 450, 792, { width: 105, align: 'right' });
      }

      doc.end();

      writeStream.on('finish', () => {
        const stats = fs.statSync(filePath);
        resolve({
          filePath,
          fileName,
          fileSize: stats.size
        });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateAnnualReportPDF,
  generateStudentHistoryPDF
};
