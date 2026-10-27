import React from 'react';

export default function FormInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  required = false,
  error = '',
  options = [],
  rows = 3,
  min,
  max,
  step,
  readOnly = false,
  className = '',
  helper = ''
}) {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={name}>
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}

      {type === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="form-select"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const text = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={val} value={val}>
                {text}
              </option>
            );
          })}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          rows={rows}
          readOnly={readOnly}
          className="form-textarea"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
          step={step}
          readOnly={readOnly}
          className="form-input"
        />
      )}

      {error && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>{error}</span>}
      {helper && !error && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{helper}</span>}
    </div>
  );
}
