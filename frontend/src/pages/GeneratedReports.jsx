import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import DataTable from '../components/DataTable';

export default function GeneratedReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await api.getGeneratedReports();
      setReports(data || []);
    } catch (err) {
      console.error('Failed to load generated reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (report) => {
    setDownloadingId(report.id);
    const downloadUrl = api.getDownloadUrl(report.id);

    // Create an invisible anchor and trigger browser download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', report.file_name || `${report.report_title}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingId(null);
    }, 1200);
  };

  const columns = [
    {
      header: 'Report Title',
      accessor: 'report_title',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{val}</strong>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {row.file_name} ({Math.round((row.file_size || 0) / 1024)} KB)
          </div>
        </div>
      )
    },
    {
      header: 'Academic Year',
      accessor: 'academic_year',
      render: (val) => <span className="badge badge-blue">{val}</span>
    },
    {
      header: 'Departments Included',
      accessor: 'departments',
      render: (depts) => {
        if (!depts || depts.length === 0) return '-';
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {depts.map((d) => (
              <span key={d} className="badge badge-slate" style={{ fontSize: '0.7rem' }}>
                {d}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      header: 'Sections',
      accessor: 'sections',
      render: (sections) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {sections?.length || 0} sections included
        </span>
      )
    },
    {
      header: 'Generated Date',
      accessor: 'generated_date',
      render: (dateStr) => {
        if (!dateStr) return '-';
        return (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {new Date(dateStr).toLocaleString()}
          </span>
        );
      }
    }
  ];

  return (
    <div className="content-card">
      <div className="card-header-bar">
        <div>
          <h2>Generated Reports Archive</h2>
          <p>Repository of previously compiled annual report documents and PDF downloads.</p>
        </div>
        <div>
          <span className="badge badge-teal">Screen 10</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={reports}
        emptyMessage="No reports have been generated yet. Go to Report Builder to create your first report!"
        renderActions={(row) => (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleDownload(row)}
            disabled={downloadingId === row.id}
            title="Download PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span>⬇</span>
            <span>{downloadingId === row.id ? 'Downloading...' : 'Download PDF'}</span>
          </button>
        )}
      />
    </div>
  );
}
