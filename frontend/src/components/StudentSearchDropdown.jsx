import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

/**
 * Reusable Smart Student Search Dropdown
 * 
 * Features:
 * - Live typeahead searching against real database records
 * - Debounced input (250ms) with minimum 2 characters threshold
 * - Strict maximum 5 results displayed
 * - Displays Student Name, Register Number, Department, and Academic Batch
 * - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
 * - Clear selection button
 * - Race-condition protection (discards stale responses)
 */
export default function StudentSearchDropdown({
  label = 'Select Student',
  onSelect,
  onClear,
  selectedStudent = null,
  department = '',
  required = false,
  placeholder = 'Type student name or register number (min 2 chars)...',
  disabled = false
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const latestRequestId = useRef(0);
  const debounceTimer = useRef(null);

  // Sync with preselected or edited student
  useEffect(() => {
    if (selectedStudent && (selectedStudent.name || selectedStudent.student_name)) {
      const name = selectedStudent.name || selectedStudent.student_name;
      const reg = selectedStudent.register_no || selectedStudent.student_id;
      setQuery(`${name} (${reg})`);
    } else if (!selectedStudent) {
      setQuery('');
    }
  }, [selectedStudent]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch search results with debouncing and race-condition prevention
  const triggerSearch = (text) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      const currentId = ++latestRequestId.current;
      setLoading(true);
      setError('');

      try {
        const results = await api.searchStudents(text.trim(), department);
        // Only update if this is the newest request
        if (currentId === latestRequestId.current) {
          // Strictly cap suggestions at 5
          const capped = Array.isArray(results) ? results.slice(0, 5) : [];
          setSuggestions(capped);
          setIsOpen(true);
          setHighlightedIndex(capped.length > 0 ? 0 : -1);
        }
      } catch (err) {
        if (currentId === latestRequestId.current) {
          setError('Search error');
          setSuggestions([]);
        }
      } finally {
        if (currentId === latestRequestId.current) {
          setLoading(false);
        }
      }
    }, 250);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    // If student was already selected and user starts typing again, notify parent
    if (selectedStudent && onClear) {
      onClear();
    }

    triggerSearch(val);
  };

  const handleSelectStudent = (student) => {
    setQuery(`${student.name} (${student.register_no})`);
    setSuggestions([]);
    setIsOpen(false);
    if (onSelect) {
      onSelect(student);
    }
  };

  const handleClearSelection = (e) => {
    e.stopPropagation();
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    if (onClear) {
      onClear();
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && query.length >= 2) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectStudent(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label className="form-label">
          {label} {required && <span className="required">*</span>}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          disabled={disabled}
          style={{
            paddingRight: selectedStudent || query ? '4.5rem' : '2.25rem',
            borderColor: selectedStudent ? '#10b981' : undefined,
            backgroundColor: selectedStudent ? '#f0fdf4' : undefined
          }}
          autoComplete="off"
        />

        {/* Right side controls (loading indicator or clear button) */}
        <div style={{ position: 'absolute', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {loading && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Searching database...">
              ⏳
            </span>
          )}

          {query && !disabled && (
            <button
              type="button"
              onClick={handleClearSelection}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
              title="Clear selection"
            >
              ✕
            </button>
          )}

          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', pointerEvents: 'none' }}>
            🔍
          </span>
        </div>
      </div>

      {/* Dropdown Suggestions List (Max 5 results) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
            marginTop: '4px',
            maxHeight: '280px',
            overflowY: 'auto'
          }}
        >
          {loading && suggestions.length === 0 ? (
            <div style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Searching database...
            </div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No active students found matching "{query}".
            </div>
          ) : (
            <div>
              <div style={{ padding: '0.4rem 0.85rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)' }}>
                Matching Students (Top {suggestions.length} Results)
              </div>
              {suggestions.map((student, idx) => (
                <div
                  key={student.id}
                  onClick={() => handleSelectStudent(student)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                    backgroundColor: idx === highlightedIndex ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      🎓 {student.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
                        {student.register_no}
                      </span>
                      {student.academic_year && ` • Batch: ${student.academic_year}`}
                      {student.current_year && ` • Year: ${student.current_year}`}
                    </div>
                  </div>

                  <div>
                    <span className="badge badge-slate" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                      {student.department}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
