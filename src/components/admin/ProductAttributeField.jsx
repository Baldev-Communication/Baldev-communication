export default function ProductAttributeField({ attribute, value, onChange, error }) {
  const label = <span>{attribute.label}{attribute.unit ? ` (${attribute.unit})` : ''}{attribute.required && <em>*</em>}</span>;
  const common = {
    value: value ?? '', required: Boolean(attribute.required),
    onChange: event => onChange(event.target.value),
    'aria-invalid': Boolean(error),
    'data-required-attribute': attribute.required && !String(value ?? '').trim() ? attribute.key : undefined,
    className: 'admin-field__control',
  };
  if (attribute.type === 'multi_select' && attribute.options?.length) {
    const selected = new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean));
    return <fieldset className="admin-field" data-required-attribute={common['data-required-attribute']} tabIndex={attribute.required ? -1 : undefined}>
      <legend>{label}</legend><div className="flex flex-wrap gap-2 rounded-xl border border-theme-border bg-white p-3">{attribute.options.map(option => <label key={option} className={`admin-flag ${selected.has(option) ? 'is-on' : ''}`}><input type="checkbox" checked={selected.has(option)} onChange={() => { const next = new Set(selected); if (next.has(option)) next.delete(option); else next.add(option); onChange([...next].join(', ')); }} />{option}</label>)}</div>
      {error && <span className="admin-field__error">{error}</span>}
    </fieldset>;
  }
  const numeric = ['number', 'measurement', 'range'].includes(attribute.type);
  let control;
  if (attribute.type === 'boolean') control = <select {...common}><option value="">Choose</option><option value="Yes">Yes</option><option value="No">No</option></select>;
  else if (attribute.type === 'dropdown') control = <select {...common}><option value="">Choose {attribute.label.toLowerCase()}</option>{(attribute.options || []).map(option => <option key={option} value={option}>{option}</option>)}</select>;
  else if (attribute.type === 'textarea') control = <textarea {...common} rows={4} />;
  else control = <input {...common} type={attribute.type === 'date' ? 'date' : numeric ? 'number' : 'text'} step={numeric ? 'any' : undefined}
    min={numeric ? attribute.validation?.min : undefined} max={numeric ? attribute.validation?.max : undefined}
    minLength={!numeric ? attribute.validation?.minLength : undefined} maxLength={!numeric ? attribute.validation?.maxLength : undefined}
    placeholder={attribute.type === 'multi_select' ? 'Enter comma-separated values' : attribute.type === 'color' ? 'Example: Black or #14213d' : ''} />;
  return <label className={`admin-field${attribute.type === 'textarea' ? ' lg:col-span-2' : ''}`}>{label}{control}{error && <span className="admin-field__error">{error}</span>}</label>;
}
