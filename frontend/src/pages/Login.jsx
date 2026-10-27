import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.login(email, password);
      if (data.success && data.user) {
        onLoginSuccess(data.user, data.token);
        navigate('/dashboard');
      } else {
        setError('Login failed. Please check credentials.');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <span>🏛️</span>
          </div>
          <h1>Institutional Report Portal</h1>
          <p>Annual Departmental Accreditation & Reporting System</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Demo Accounts Quick Fill */}
        <div className="demo-account-pills">
          <h5>⚡ Demo Credentials (Click to auto-fill)</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="demo-buttons">
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemoAccount('admin@college.com', 'admin123')}
                title="Institutional Admin: Global Access"
              >
                👑 Admin
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemoAccount('faculty@college.com', 'faculty123')}
                title="CSE Faculty: Data Entry & Submissions"
              >
                👨‍🏫 Faculty (CSE)
              </button>
            </div>
            
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.2rem' }}>
              Department HOD Logins:
            </div>
            <div className="demo-buttons">
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemoAccount('hod_cse@college.com', 'hod123')}
                title="HOD of Computer Science & Engineering"
              >
                🎓 HOD CSE
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemoAccount('hod_it@college.com', 'hod123')}
                title="HOD of Information Technology"
              >
                🎓 HOD IT
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemoAccount('hod_ece@college.com', 'hod123')}
                title="HOD of Electronics & Communication"
              >
                🎓 HOD ECE
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" htmlFor="email">
              Email Address <span className="required">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="e.g. admin@college.com or hod_cse@college.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" htmlFor="password">
              Password <span className="required">*</span>
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal →'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Autonomous Accreditation Framework • Role-Based Portal
        </div>
      </div>
    </div>
  );
}
