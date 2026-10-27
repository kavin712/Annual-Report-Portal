import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DepartmentForm from './pages/DepartmentForm';
import StudentAchievement from './pages/StudentAchievement';
import FacultyForm from './pages/FacultyForm';
import Activities from './pages/Activities';
import Placement from './pages/Placement';
import Approvals from './pages/Approvals';
import ReportBuilder from './pages/ReportBuilder';
import ReportPreview from './pages/ReportPreview';
import GeneratedReports from './pages/GeneratedReports';
import DepartmentManagement from './pages/DepartmentManagement';
import StudentManagement from './pages/StudentManagement';
import Events from './pages/Events';
import ResearchProjects from './pages/ResearchProjects';
import { api } from './services/api';

const DEFAULT_DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science and Engineering', hod: 'Prof. Ramesh Kumar' },
  { code: 'IT', name: 'Information Technology', hod: 'Prof. Priya S' },
  { code: 'ECE', name: 'Electronics and Communication Engineering', hod: 'Prof. Arun Prakash' }
];

const ACADEMIC_YEARS = ['2023-24', '2024-25', '2025-26', '2026-27'];

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('iarp_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [academicYear, setAcademicYear] = useState('2025-26');
  const [department, setDepartment] = useState(() => {
    const saved = localStorage.getItem('iarp_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u.department && u.department !== 'Administration') {
          return u.department;
        }
      } catch (e) {}
    }
    return 'Computer Science and Engineering';
  });

  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [reportConfig, setReportConfig] = useState(null);

  const location = useLocation();

  useEffect(() => {
    // 1. Fetch departments from database
    api.getDepartments()
      .then((data) => {
        if (data && data.length > 0) {
          setDepartments(data);
        }
      })
      .catch((err) => console.log('Using default departments:', err));

    // 2. Validate current session with backend database
    const token = localStorage.getItem('iarp_token');
    const savedUser = localStorage.getItem('iarp_user');
    if (token || savedUser) {
      api.getMe()
        .then((res) => {
          if (res && res.user) {
            setUser(res.user);
            localStorage.setItem('iarp_user', JSON.stringify(res.user));
            if (res.user.department && res.user.department !== 'Administration') {
              setDepartment(res.user.department);
            }
          }
        })
        .catch(() => {
          // Invalid or expired token: clear credentials
          localStorage.removeItem('iarp_token');
          localStorage.removeItem('iarp_user');
          setUser(null);
        });
    }
  }, []);

  const handleLoginSuccess = (userData, token) => {
    setUser(userData);
    localStorage.setItem('iarp_user', JSON.stringify(userData));
    if (token) {
      localStorage.setItem('iarp_token', token);
    }
    if (userData.department && userData.department !== 'Administration') {
      setDepartment(userData.department);
    }
  };

  const handleLogout = () => {
    api.logout().catch(() => {});
    setUser(null);
    localStorage.removeItem('iarp_user');
    localStorage.removeItem('iarp_token');
  };

  const getPageTitle = (pathname) => {
    switch (pathname) {
      case '/dashboard':
        return user?.role === 'admin'
          ? 'Executive Institutional Dashboard'
          : user?.role === 'hod'
          ? 'HOD Departmental Executive Portal'
          : 'Faculty Submission Portal';
      case '/approvals':
        return 'HOD Verification & Approvals';
      case '/departments':
        return 'Institutional Department Management';
      case '/students':
        return 'Student Management & Master Records';
      case '/department-info':
        return 'Department Profile & Metrics';
      case '/student-achievements':
        return 'Student Achievement Records';
      case '/faculty-info':
        return 'Faculty Information Management';
      case '/activities':
        return 'Departmental Activities & Events';
      case '/events':
        return 'Events Management';
      case '/placements':
        return 'Student Placement Records & Statistics';
      case '/research-projects':
        return 'Research Projects & Grants';
      case '/report-builder':
        return 'Annual Report Customization';
      case '/report-preview':
        return 'Annual Report Preview';
      case '/generated-reports':
        return 'Generated Reports Archive';
      default:
        return 'Institutional Annual Report Portal';
    }
  };

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="app-container">
      {user && !isLoginPage && (
        <Sidebar user={user} onLogout={handleLogout} />
      )}

      <div className="main-content">
        {user && !isLoginPage && (
          <Navbar
            title={getPageTitle(location.pathname)}
            academicYear={academicYear}
            setAcademicYear={setAcademicYear}
            department={department}
            setDepartment={setDepartment}
            departments={departments}
            academicYears={ACADEMIC_YEARS}
            user={user}
          />
        )}

        <main className={user && !isLoginPage ? 'page-wrapper' : ''}>
          <Routes>
            <Route
              path="/login"
              element={<Login onLoginSuccess={handleLoginSuccess} />}
            />

            <Route
              path="/dashboard"
              element={
                user ? (
                  <Dashboard
                    academicYear={academicYear}
                    setAcademicYear={setAcademicYear}
                    department={department}
                    setDepartment={setDepartment}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Approvals Review Route for HOD & Admin */}
            <Route
              path="/approvals"
              element={
                user ? (
                  user.role === 'admin' || user.role === 'hod' ? (
                    <Approvals
                      academicYear={academicYear}
                      department={department}
                      departments={departments}
                      academicYears={ACADEMIC_YEARS}
                      user={user}
                    />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/departments"
              element={
                user ? (
                  <DepartmentManagement user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/students"
              element={
                user ? (
                  <StudentManagement
                    academicYear={academicYear}
                    department={department}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/department-info"
              element={
                user ? (
                  <DepartmentForm
                    academicYear={academicYear}
                    department={department}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/student-achievements"
              element={
                user ? (
                  <StudentAchievement
                    academicYear={academicYear}
                    department={department}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/faculty-info"
              element={
                user ? (
                  user.role === 'admin' || user.role === 'hod' ? (
                    <FacultyForm
                      academicYear={academicYear}
                      department={department}
                      departments={departments}
                      academicYears={ACADEMIC_YEARS}
                      user={user}
                    />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/activities"
              element={
                user ? (
                  <Activities
                    academicYear={academicYear}
                    department={department}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/events"
              element={
                user ? (
                  <Events
                    academicYear={academicYear}
                    department={department}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/placements"
              element={
                user ? (
                  <Placement
                    academicYear={academicYear}
                    department={department}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/research-projects"
              element={
                user ? (
                  <ResearchProjects
                    academicYear={academicYear}
                    department={department}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/research-publications"
              element={<Navigate to="/research-projects" replace />}
            />

            <Route
              path="/projects"
              element={<Navigate to="/research-projects" replace />}
            />

            <Route
              path="/report-builder"
              element={
                user ? (
                  <ReportBuilder
                    academicYear={academicYear}
                    setAcademicYear={setAcademicYear}
                    departments={departments}
                    academicYears={ACADEMIC_YEARS}
                    user={user}
                    onConfigureReport={(cfg) => setReportConfig(cfg)}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/report-preview"
              element={
                user ? (
                  <ReportPreview
                    reportConfig={reportConfig}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/generated-reports"
              element={
                user ? (
                  <GeneratedReports user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="*"
              element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
