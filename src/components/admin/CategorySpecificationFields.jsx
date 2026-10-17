const types = [
  ['text', 'Text'], ['textarea', 'Long text'], ['number', 'Number'], ['measurement', 'Number with unit'],
  ['dropdown', 'Choose one'], ['multi_select', 'Choose multiple'], ['boolean', 'Yes / No'], ['date', 'Date'],
];

export default function CategorySpecificationFields({ fields = [], onChange, disabled }) {
  const update = (index, patch) => onChange(fields.map((field, position) => position === index ? { ...field, ...patch } : field));
  return <details className="category-form__section" open={fields.length > 0 || undefined}>
    <summary className="cursor-pointer font-black">Additional specification fields ({fields.length}/30)</summary>
    <p className="my-2 text-xs text-slate-500">Add fields for this category. They appear in products, drafts and Smart Fill.</p>
    <div className="grid gap-3">
      {fields.map((field, index) => <fieldset key={field.key} disabled={disabled} className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold">Field {index + 1}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold">Field name<input required maxLength={80} aria-label={`Specification ${index + 1} name`} className="admin-field__control" value={field.label} onChange={event => update(index, { label: event.target.value })} placeholder="e.g. Bowl diameter" /></label>
          <label className="grid gap-1 text-xs font-bold">Field type<select className="admin-field__control" aria-label={`Specification ${index + 1} type`} value={field.type} onChange={event => update(index, { type: event.target.value })}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {field.type === 'measurement' && <label className="grid gap-1 text-xs font-bold">Unit<input className="admin-field__control" maxLength={20} aria-label={`Specification ${index + 1} unit`} value={field.unit || ''} onChange={event => update(index, { unit: event.target.value })} placeholder="cm, kg, l, W..." /></label>}
          {['dropdown', 'multi_select'].includes(field.type) && <label className="grid gap-1 text-xs font-bold sm:col-span-2">Choices (comma separated)<input required className="admin-field__control" maxLength={5000} value={field.optionsText ?? (field.options || []).join(', ')} onChange={event => update(index, { optionsText: event.target.value, options: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label>}
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={field.required === true} onChange={event => update(index, { required: event.target.checked })} />Required before publishing</label>
          <button type="button" className="justify-self-end text-xs font-bold text-rose-700" onClick={() => onChange(fields.filter((_, position) => position !== index))}>Remove field {index + 1}</button>
        </div>
      </fieldset>)}
    </div>
    <button type="button" disabled={disabled || fields.length >= 30} className="admin-btn-ghost mt-3" onClick={() => onChange([...fields, { key: `custom_f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, label: '', type: 'text', unit: '', options: [], required: false }])}>Add specification field</button>
  </details>;
}
