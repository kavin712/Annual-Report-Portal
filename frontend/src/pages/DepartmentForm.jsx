import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import FormInput from '../components/FormInput';

export default function DepartmentForm({
  academicYear,
  department,
  departments,
  academicYears
}) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    department_name: department || 'Computer Science and Engineering',
    academic_year: academicYear || '2025-26',
    hod: '',
    total_students: '',
    male_students: '',
    female_students: '',
    total_faculty: '',
    courses_count: '',
    projects_count: '',
    publications_count: '',
    events_count: '',
    description: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      department_name: department,
      academic_year: academicYear
    }));
    loadExistingReport(department, academicYear);
  }, [department, academicYear]);

  const loadExistingReport = async (dept, year) => {
    try {
      const reports = await api.getDepartmentReports(year, dept);
      if (reports && reports.length > 0) {
        const rep = reports[0];
        setFormData({
          department_name: rep.department_name,
          academic_year: rep.academic_year,
          hod: rep.hod || '',
          total_students: rep.total_students || '',
          male_students: rep.male_students || '',
          female_students: rep.female_students || '',
          total_faculty: rep.total_faculty || '',
          courses_count: rep.courses_count || '',
          projects_count: rep.projects_count || '',
          publications_count: rep.publications_count || '',
          events_count: rep.events_count || '',
          description: rep.description || ''
        });
      } else {
        // Clear non-contextual fields
        setFormData((prev) => ({
          ...prev,
          hod: '',
          total_students: '',
          male_students: '',
          female_students: '',
          total_faculty: '',
          courses_count: '',
          projects_count: '',
          publications_count: '',
          events_count: '',
          description: ''
        }));
      }
    } catch (err) {
      console.error('Error fetching department report:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    setMessage({ type: '', text: '' });
  };

  const handleClear = () => {
    setFormData((prev) => ({
      ...prev,
      hod: '',
      total_students: '',
      male_students: '',
      female_students: '',
      total_faculty: '',
      courses_count: '',
      projects_count: '',
      publications_count: '',
      events_count: '',
      description: ''
    }));
    setMessage({ type: 'info', text: 'Form inputs cleared.' });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setMessage({ type: '', text: '' });

    // Client-side validations
    if (!formData.department_name || !formData.academic_year || !formData.hod.trim()) {
      setMessage({ type: 'error', text: 'Department Name, Academic Year, and Head of Department are required.' });
      return false;
    }

    const totalStudents = Number(formData.total_students) || 0;
    const maleStudents = Number(formData.male_students) || 0;
    const femaleStudents = Number(formData.female_students) || 0;

    if (maleStudents + femaleStudents > totalStudents && totalStudents > 0) {
      setMessage({
        type: 'error',
        text: `Male (${maleStudents}) + Female students (${femaleStudents}) exceed Total Students (${totalStudents}). Please adjust counts.`
      });
      return false;
    }

    setLoading(true);
    try {
      const res = await api.saveDepartmentReport(formData);
      setMessage({ type: 'success', text: res.message || 'Department information saved successfully!' });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save department information.' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    const success = await handleSave();
    if (success) {
      navigate('/student-achievements');
    }
  };

  return (
    <div className="content-card">
      <div className="card-header-bar">
        <div>
          <h2>Department Information Form</h2>
          <p>Academic profile, leadership, student counts, and research output.</p>
        </div>
        <div>
          <span className="badge badge-blue">Screen 3</span>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ background: 'none', border: 'none' }}>×</button>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="form-grid">
          <FormInput
            label="Department Name"
            name="department_name"
            type="select"
            value={formData.department_name}
            onChange={handleChange}
            options={departments.map((d) => ({ value: d.name, label: d.name }))}
            required
          />

          <FormInput
            label="Academic Year"
            name="academic_year"
            type="select"
            value={formData.academic_year}
            onChange={handleChange}
            options={academicYears.map((ay) => ({ value: ay, label: ay }))}
            required
          />

          <FormInput
            label="Head of Department (HOD)"
            name="hod"
            placeholder="e.g. Prof. Ramesh Kumar"
            value={formData.hod}
            onChange={handleChange}
            required
          />

          <FormInput
            label="Total Students"
            name="total_students"
            type="number"
            min="0"
            placeholder="e.g. 240"
            value={formData.total_students}
            onChange={handleChange}
          />

          <FormInput
            label="Male Students"
            name="male_students"
            type="number"
            min="0"
            placeholder="e.g. 140"
            value={formData.male_students}
            onChange={handleChange}
          />

          <FormInput
            label="Female Students"
            name="female_students"
            type="number"
            min="0"
            placeholder="e.g. 100"
            value={formData.female_students}
            onChange={handleChange}
          />

          <FormInput
            label="Total Faculty"
            name="total_faculty"
            type="number"
            min="0"
            placeholder="e.g. 18"
            value={formData.total_faculty}
            onChange={handleChange}
          />

          <FormInput
            label="Number of Courses"
            name="courses_count"
            type="number"
            min="0"
            placeholder="e.g. 12"
            value={formData.courses_count}
            onChange={handleChange}
          />

          <FormInput
            label="Number of Student Projects"
            name="projects_count"
            type="number"
            min="0"
            placeholder="e.g. 45"
            value={formData.projects_count}
            onChange={handleChange}
          />

          <FormInput
            label="Number of Publications"
            name="publications_count"
            type="number"
            min="0"
            placeholder="e.g. 28"
            value={formData.publications_count}
            onChange={handleChange}
          />

          <FormInput
            label="Number of Events"
            name="events_count"
            type="number"
            min="0"
            placeholder="e.g. 14"
            value={formData.events_count}
            onChange={handleChange}
          />

          <FormInput
            label="Department Description / Mission"
            name="description"
            type="textarea"
            className="full-width"
            placeholder="Write a brief overview of departmental milestones, research focus, and pedagogical objectives..."
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClear} disabled={loading}>
            Clear
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Department Information'}
          </button>
          <button type="button" className="btn btn-success" onClick={handleNext} disabled={loading}>
            Next: Student Achievements →
          </button>
        </div>
      </form>
    </div>
  );
}
