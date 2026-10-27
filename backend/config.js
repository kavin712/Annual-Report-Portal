const path = require('path');
const fs = require('fs');

// Simple zero-dependency .env loader
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_PATH: process.env.DATABASE_PATH
    ? path.resolve(__dirname, process.env.DATABASE_PATH)
    : path.join(__dirname, 'annual_report.db'),
  SESSION_SECRET: process.env.SESSION_SECRET || 'iarp_secure_session_secret_default_key',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
