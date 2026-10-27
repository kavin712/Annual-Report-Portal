import React from 'react';

export default function DataTable({
  columns = [],
  data = [],
  emptyMessage = 'No records found.',
  onEdit,
  onDelete,
  onAction,
  actionLabel = 'Action',
  renderActions
}) {
  if (!data || data.length === 0) {
    return (
      <div className="table-container" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} style={{ width: col.width || 'auto', textAlign: col.align || 'left' }}>
                {col.header}
              </th>
            ))}
            {(onEdit || onDelete || onAction || renderActions) && (
              <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={row.id || rowIndex}>
              {columns.map((col, colIndex) => (
                <td key={colIndex} style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row[col.accessor], row) : (row[col.accessor] ?? '-')}
                </td>
              ))}
              {(onEdit || onDelete || onAction || renderActions) && (
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'center' }}>
                    {renderActions ? (
                      renderActions(row)
                    ) : (
                      <>
                        {onEdit && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onEdit(row)}
                            title="Edit Record"
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => onDelete(row)}
                            title="Delete Record"
                          >
                            Delete
                          </button>
                        )}
                        {onAction && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => onAction(row)}
                          >
                            {actionLabel}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
