import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Select, TextInput } from '../ui/Field';
import { changeProductCategory, draftAttributeDefinitions, firstInvalidDraftAttribute } from '../../utils/draftAttributes';
import { normalizeImageUrl } from '../../services/normalize';
import DraftSmartFillStage from './DraftSmartFillStage';
import DraftUploadDetailsFields from './DraftUploadDetailsFields';
import { applySmartPatch, displaySmartValue, fieldValue, sameValue, selectedSmartPatch } from '../../utils/productSmartFill';
import { uploadDetailError } from '../../utils/draftUploadDetails';

const idOf = draft => String(draft?._id || draft?.id || '');
const categoryId = value => String(value?._id || value || '');
const initialRow = draft => ({
  ...draft,
  category: categoryId(draft.category),
  brand: draft.brand || draft.attributeValues?.brand || '',
  countryOfOrigin: draft.countryOfOrigin || draft.attributeValues?.country_of_origin || '',
  sellingPrice: draft.sellingPrice ?? draft.price ?? '',
  originalPrice: draft.originalPrice ?? '',
  stock: draft.stock ?? '',
  shippingWeightKg: draft.shippingWeightKg ?? '',
  attributeValues: { ...draft.attributeValues },
});

function conditionAttribute(structure, categories, row) {
  return draftAttributeDefinitions(structure, categories, row).find(attribute => attribute.key === 'condition');
}

function conditionOptions(attribute) {
  if (!attribute) return [];
  return attribute.type === 'boolean' ? ['Yes', 'No'] : attribute.options || [];
}

function attributeValuesFor(row) {
  return { ...row.attributeValues,
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.countryOfOrigin ? { country_of_origin: row.countryOfOrigin } : {}),
  };
}

function rowError(row, structure, categories) {
  const dimensions = row.packageDimensions;
  const blankDimensions = !dimensions || Object.values(dimensions).every(value => value === '' || value == null || Number(value) === 0);
  const detailError = uploadDetailError({ ...row, ...(blankDimensions ? { packageDimensions: undefined } : {}) }, structure, categories);
  if (detailError) return detailError;
  const price = Number(row.sellingPrice || 0);
  const mrp = Number(row.originalPrice || 0);
  const stock = Number(row.stock || 0);
  const gstRate = Number(row.gstRate || 0);
  const weight = Number(row.shippingWeightKg || 0);
  if (row.name?.trim() && row.name.trim().length < 3) return 'Name needs at least 3 characters.';
  if (price < 0 || !Number.isFinite(price)) return 'Enter a valid selling price.';
  if (mrp < 0 || !Number.isFinite(mrp) || (price > 0 && mrp < price)) return 'MRP must be at least the selling price.';
  if (!Number.isSafeInteger(stock) || stock < 0) return 'Stock must be a whole number.';
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) return 'GST must be between 0 and 100%.';
  if (!Number.isFinite(weight) || weight < 0 || weight > 1000) return 'Packed weight must be between 0 and 1000 kg.';
  const attributes = draftAttributeDefinitions(structure, categories, row).map(attribute => ({ ...attribute, required: false }));
  const invalid = firstInvalidDraftAttribute(attributes, attributeValuesFor(row));
  if (invalid) return invalid.message;
  return '';
}

export default function DraftBulkEditor({ drafts, categories, structure, onSave, onClose, apiPrefix = '/admin', smartFillFirst = false }) {
  const [rows, setRows] = useState(() => drafts.map(initialRow));
  const [common, setCommon] = useState({ category: '', brand: '', condition: '', gstRate: '', countryOfOrigin: '', shippingWeightKg: '' });
  const [dirtyIds, setDirtyIds] = useState(() => new Set());
  const [results, setResults] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState(smartFillFirst ? 'ai' : 'manual');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResults, setAiResults] = useState({});
  const continueToManual = useCallback(() => setStage('manual'), []);
  const applyAI = useCallback((id, patch) => {
    if (!patch.length) return;
    setRows(current => current.map(row => idOf(row) === id ? applySmartPatch(row, patch) : row));
    setDirtyIds(current => new Set(current).add(id));
    setResults(current => ({ ...current, [id]: '' }));
  }, []);
  const hasCondition = rows.some(row => Boolean(conditionAttribute(structure, categories, row)));
  const commonConditions = useMemo(() => {
    const configured = rows.map(row => conditionAttribute(structure, categories, common.category ? { ...row, category: common.category } : row)).filter(Boolean);
    if (!configured.length) return [];
    return conditionOptions(configured[0]).filter(option => configured.every(attribute => conditionOptions(attribute).includes(option)));
  }, [categories, common.category, rows, structure]);

  const close = () => {
    if (saving || aiBusy) return;
    if (dirtyIds.size && !window.confirm('Discard unsaved bulk changes?')) return;
    onClose();
  };
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKeyDown); };
  });

  const updateRow = (id, field, value) => {
    setRows(current => current.map(row => {
      if (idOf(row) !== id) return row;
      if (field.startsWith('attribute:')) {
        const key = field.slice(10);
        return { ...row, ...(key === 'warranty' ? { warranty: value } : {}), attributeValues: { ...row.attributeValues, [key]: value } };
      }
      if (field === 'category') {
        const next = changeProductCategory(row, value, structure, categories);
        const options = conditionOptions(conditionAttribute(structure, categories, next));
        if (options.length && next.attributeValues?.condition && !options.includes(next.attributeValues.condition)) {
          next.attributeValues = { ...next.attributeValues, condition: '' };
        }
        return next;
      }
      return { ...row, [field]: value };
    }));
    setDirtyIds(current => new Set(current).add(id));
    setResults(current => ({ ...current, [id]: '' }));
    setMessage('');
  };
  const updateDetail = (id, field, value) => {
    if (field.startsWith('attribute.')) {
      const key = field.slice(10);
      if (['brand', 'country_of_origin'].includes(key)) updateRow(id, key === 'brand' ? 'brand' : 'countryOfOrigin', value);
      updateRow(id, `attribute:${key}`, value);
    } else if (field.startsWith('packageDimensions.')) {
      const row = rows.find(item => idOf(item) === id);
      updateRow(id, 'packageDimensions', { ...row?.packageDimensions, [field.slice(18)]: value });
    } else updateRow(id, field, value);
  };

  const applyCommon = () => {
    if (!Object.values(common).some(value => String(value).trim())) return;
    setRows(current => current.map(row => {
      let next = { ...row, attributeValues: { ...row.attributeValues } };
      if (common.category) {
        next = changeProductCategory(next, common.category, structure, categories);
      }
      if (common.brand.trim()) next.brand = common.brand.trim();
      if (common.gstRate !== '') next.gstRate = common.gstRate;
      if (common.countryOfOrigin.trim()) next.countryOfOrigin = common.countryOfOrigin.trim();
      if (common.shippingWeightKg !== '') next.shippingWeightKg = common.shippingWeightKg;
      const options = conditionOptions(conditionAttribute(structure, categories, next));
      if (common.condition && options.includes(common.condition)) next.attributeValues.condition = common.condition;
      else if (common.category && options.length && next.attributeValues.condition && !options.includes(next.attributeValues.condition)) next.attributeValues.condition = '';
      return next;
    }));
    setDirtyIds(new Set(rows.map(idOf)));
    setResults({}); setMessage('Common values applied. Review each row, then save.');
  };

  const saveAll = async () => {
    if (!dirtyIds.size || saving) return;
    const changed = rows.filter(row => dirtyIds.has(idOf(row)));
    const invalid = changed.find(row => rowError(row, structure, categories));
    if (invalid) {
      const error = rowError(invalid, structure, categories);
      setResults(current => ({ ...current, [idOf(invalid)]: error }));
      setMessage(`${invalid.name || 'Unnamed product'}: ${error}`);
      return;
    }
    setSaving(true); setMessage('');
    const nextResults = {};
    const savedIds = [];
    const savedRows = new Map();
    for (const [index, row] of changed.entries()) {
      const id = idOf(row);
      setMessage(`Saving ${index + 1} of ${changed.length}...`);
      try {
        const saved = await onSave(row);
        savedIds.push(id);
        savedRows.set(id, saved);
        nextResults[id] = 'Saved';
      } catch (error) {
        nextResults[id] = error?.data?.message || error?.message || 'Could not save this draft.';
      }
    }
    setRows(current => current.map(row => savedRows.has(idOf(row)) ? { ...row, revision: savedRows.get(idOf(row))?.revision ?? row.revision } : row));
    setDirtyIds(current => new Set([...current].filter(id => !savedIds.includes(id))));
    setResults(nextResults);
    setMessage(`${savedIds.length} of ${changed.length} draft${changed.length === 1 ? '' : 's'} saved${savedIds.length === changed.length ? '.' : '. Fix the marked rows and retry.'}`);
    setSaving(false);
  };

  return <div className="draft-bulk-overlay" role="dialog" aria-modal="true" aria-labelledby="draft-bulk-title">
    <section className="draft-bulk-editor">
      <header className="draft-bulk-editor__header"><div><h2 id="draft-bulk-title">{rows.length === 1 ? 'Fill 1 draft' : `Fill ${rows.length} drafts together`}</h2><p>{stage === 'ai' ? '1 · Fetch product details' : '2 · Review & complete remaining details'}</p></div><button type="button" onClick={close} disabled={saving || aiBusy} aria-label="Close bulk editor"><X size={20} /></button></header>
      <div className="draft-bulk-editor__content">
        <DraftSmartFillStage rows={rows} categories={categories} structure={structure} apiPrefix={apiPrefix} active={stage === 'ai'} autoStart={smartFillFirst} results={aiResults} setResults={setAiResults} onUpdate={updateDetail} onFilled={applyAI} onContinue={continueToManual} onBusyChange={setAiBusy} />
        {stage === 'manual' && <><div className="draft-ai-summary"><span>Check price, stock, condition and any missing specifications.</span><button type="button" className="admin-btn-ghost" disabled={saving || aiBusy} onClick={() => setStage('ai')}>{Object.keys(aiResults).length ? 'Review / retry Smart Fill' : 'Smart Fill all drafts'}</button></div>
        <fieldset disabled={saving || aiBusy}>
        <section className="draft-bulk-common" aria-label="Details for all drafts"><div className="draft-bulk-common__title"><strong>Apply to all</strong><span>Only filled fields overwrite row values.</span></div><div className="draft-bulk-common__fields">
          <label>Category<Select value={common.category} onChange={event => setCommon(current => ({ ...current, category: event.target.value }))}><option value="">Keep each</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></label>
          <label>Brand<TextInput value={common.brand} maxLength={120} placeholder="Keep each" onChange={event => setCommon(current => ({ ...current, brand: event.target.value }))} /></label>
          {hasCondition && <label>Condition<Select value={common.condition} onChange={event => setCommon(current => ({ ...current, condition: event.target.value }))}><option value="">Keep each</option>{commonConditions.map(option => <option key={option} value={option}>{option}</option>)}</Select></label>}
          <label>GST %<TextInput type="number" min="0" max="100" value={common.gstRate} placeholder="Keep each" onChange={event => setCommon(current => ({ ...current, gstRate: event.target.value }))} /></label>
          <label>Country of origin<TextInput value={common.countryOfOrigin} maxLength={100} placeholder="Keep each" onChange={event => setCommon(current => ({ ...current, countryOfOrigin: event.target.value }))} /></label>
          <label>Packed weight (kg)<TextInput type="number" min="0" step="0.01" value={common.shippingWeightKg} placeholder="Keep each" onChange={event => setCommon(current => ({ ...current, shippingWeightKg: event.target.value }))} /></label>
        </div><button type="button" className="admin-btn-ghost" disabled={saving} onClick={applyCommon}>Apply to all rows</button></section>
        <div className="draft-bulk-rows">{rows.map((row, index) => {
          const id = idOf(row);
          const condition = conditionAttribute(structure, categories, row);
          const options = conditionOptions(condition);
          const selectedCondition = String(row.attributeValues?.condition || '');
          const requiredAttributes = draftAttributeDefinitions(structure, categories, row).filter(attribute => attribute.required && !['brand', 'condition', 'country_of_origin'].includes(attribute.key));
          const missing = firstInvalidDraftAttribute(draftAttributeDefinitions(structure, categories, row), attributeValuesFor(row));
          const image = row.images?.find(item => item.primary)?.url || row.images?.[0]?.url || row.image;
          return <section key={id} className={`draft-bulk-row ${results[id] && results[id] !== 'Saved' ? 'is-error' : ''}`} aria-label={`Product ${index + 1}`}>
            <div className="draft-bulk-row__identity">{image && <img src={normalizeImageUrl(image)} alt="" />}<div><strong>Product {index + 1}</strong><span>{row.images?.length || (row.image ? 1 : 0)} photo{row.images?.length === 1 ? '' : 's'}</span></div>{dirtyIds.has(id) && <small>Unsaved</small>}{missing && <small className="draft-bulk-row__missing">{missing.message}</small>}{results[id] && <em>{results[id]}</em>}</div>
            {aiResults[id] && <DraftAIReview result={aiResults[id]} row={row} categories={categories} onApply={patch => applyAI(id, patch)} />}
            <div className="draft-bulk-row__fields">
              <label>Product name<TextInput value={row.name || ''} maxLength={180} onChange={event => updateRow(id, 'name', event.target.value)} /></label>
              <label>Category<Select value={row.category || ''} onChange={event => updateRow(id, 'category', event.target.value)}><option value="">Choose category</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></label>
              <label>Brand<TextInput value={row.brand || ''} maxLength={120} onChange={event => updateRow(id, 'brand', event.target.value)} /></label>
              {condition && <label>Condition{options.length ? <Select value={selectedCondition} onChange={event => updateRow(id, 'attribute:condition', event.target.value)}><option value="">Choose</option>{selectedCondition && !options.includes(selectedCondition) && <option value={selectedCondition} disabled>Invalid: {selectedCondition}</option>}{options.map(option => <option key={option} value={option}>{option}</option>)}</Select> : <TextInput value={selectedCondition} onChange={event => updateRow(id, 'attribute:condition', event.target.value)} />}</label>}
              <label>Selling price<TextInput type="number" min="0" value={row.sellingPrice} onChange={event => updateRow(id, 'sellingPrice', event.target.value)} /></label>
              <label>MRP<TextInput type="number" min="0" value={row.originalPrice} onChange={event => updateRow(id, 'originalPrice', event.target.value)} /></label>
              <label>Stock<TextInput type="number" min="0" step="1" value={row.stock} onChange={event => updateRow(id, 'stock', event.target.value)} /></label>
              <label>GST %<TextInput type="number" min="0" max="100" value={row.gstRate ?? ''} onChange={event => updateRow(id, 'gstRate', event.target.value)} /></label>
              <label>Colour<TextInput value={Array.isArray(row.colors) ? row.colors.join(', ') : row.colors || ''} placeholder="e.g. Black" onChange={event => updateRow(id, 'colors', event.target.value)} /></label>
              {requiredAttributes.map(attribute => {
                const value = String(row.attributeValues?.[attribute.key] || '');
                const displayValue = attribute.type === 'boolean' && /^(true|false|yes|no)$/i.test(value)
                  ? /^(true|yes)$/i.test(value) ? 'Yes' : 'No' : value;
                const choices = ['dropdown', 'boolean'].includes(attribute.type) ? conditionOptions(attribute) : [];
                return <label key={attribute.key}>{attribute.label}{choices.length ? <Select value={displayValue} onChange={event => updateRow(id, `attribute:${attribute.key}`, event.target.value)}><option value="">Choose</option>{displayValue && !choices.includes(displayValue) && <option value={displayValue} disabled>Invalid: {displayValue}</option>}{choices.map(option => <option key={option} value={option}>{option}</option>)}</Select> : <TextInput value={value} onChange={event => updateRow(id, `attribute:${attribute.key}`, event.target.value)} />}</label>;
              })}
            </div>
            <DraftUploadDetailsFields additionalOnly details={row} categories={categories} structure={structure} disabled={saving || aiBusy} onChange={(field, value) => updateDetail(id, field, value)} />
          </section>;
        })}</div></fieldset></>}
      </div>
      <footer className="draft-bulk-editor__footer">{message && <span role="status">{message}</span>}<button type="button" className="admin-btn-ghost" disabled={saving || aiBusy} onClick={close}>Close</button>{stage === 'manual' && <button type="button" className="admin-btn" disabled={saving || aiBusy || !dirtyIds.size} onClick={saveAll}><Check size={16} />{saving ? 'Saving...' : `Save ${dirtyIds.size} draft${dirtyIds.size === 1 ? '' : 's'}`}</button>}</footer>
    </section>
  </div>;
}

function DraftAIReview({ result, row, categories, onApply }) {
  const [selected, setSelected] = useState([]);
  const suggestions = result.suggestions || [];
  const selectedKeys = selected.includes('attributeValues.warranty') && suggestions.some(item => item.key === 'warranty') ? [...selected, 'warranty'] : selected;
  const patch = selectedSmartPatch(suggestions, selectedKeys, row);
  const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
  return <div className="draft-ai-result">
    {result.error && <p role="alert">{result.error}</p>}
    {result.lookup && result.lookup.status !== 'completed' && <p role="status">{result.lookup.message}</p>}
    <details><summary>{result.count || 0} details filled · Review AI results & sources</summary>
      {(result.warnings || []).filter(warning => warning !== result.lookup?.message).map(warning => <p key={warning}>{warning}</p>)}
      <dl>{suggestions.filter(item => item.key !== 'warranty' || !suggestions.some(other => other.key === 'attributeValues.warranty')).map(item => {
        const filled = sameValue(fieldValue(row, item.key), item.value);
        const confirm = !filled && item.empty && item.evidence?.reviewRequired && (item.key.startsWith('attributeValues.') || item.key === 'warranty') && sameValue(fieldValue(row, item.key), item.before);
        return <div key={item.key}><dt>{item.label}{filled ? ' · Filled' : !item.empty ? ' · Existing value kept' : ' · Review'}</dt><dd>{displaySmartValue(item.value, item.key, categories)}
          {safeUrl(item.evidence?.url) && <> · <a href={safeUrl(item.evidence.url)} target="_blank" rel="noopener noreferrer">Source</a></>}
          {confirm && <label><input type="checkbox" checked={selected.includes(item.key)} onChange={event => setSelected(values => event.target.checked ? [...values, item.key] : values.filter(key => key !== item.key))} />Confirm {item.label}{item.evidence.note ? `: ${item.evidence.note}` : ''}</label>}
        </dd></div>;
      })}</dl>
      {!!patch.length && <button type="button" className="admin-btn-ghost" onClick={() => { onApply(patch); setSelected([]); }}>Apply confirmed details</button>}
      {(result.sources || []).filter(source => safeUrl(source.url)).map(source => <a key={source.url} href={safeUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title || 'Product source'}</a>)}
    </details>
  </div>;
}
