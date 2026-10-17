import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Sparkles, Undo2 } from 'lucide-react';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { draftAttributeDefinitions } from '../../utils/draftAttributes';
import { isTechnologyCatalog } from '../../utils/catalogPresentation';
import { applySmartPatch, automaticSpecificationPatch, displaySmartValue, fieldValue, safeSearchSuggestionUrl, sameValue, selectedSmartPatch, smartInputSignature, smartPhotos, smartProvider, smartProviders, smartRequest, snapshotForm, suggestionRows } from '../../utils/productSmartFill';
import './ProductSmartFill.css';

export default function ProductSmartFill({ form, categories, structure, onApply, apiPrefix = '/admin', priceField = 'price', seo = true, disabled = false, autoStart = false }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [webSearch, setWebSearch] = useState(true);
  const [autoSpecifications, setAutoSpecifications] = useState(true);
  const [selection, setSelection] = useState(null);
  const [status, setStatus] = useState(null);
  const [providerPreference, setProviderPreference] = useState(() => { try { return localStorage.getItem('baldev_product_ai_provider') || ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [replace, setReplace] = useState(false);
  const [undo, setUndo] = useState(null);
  const request = useRef(null);
  const statusRequest = useRef(null);
  const autoStarted = useRef(false);
  const photos = useMemo(() => smartPhotos(form), [form]);
  const chosen = useMemo(() => (selection ?? photos.slice(0, 4)).filter(url => photos.includes(url)).slice(0, 4), [selection, photos]);
  const providers = smartProviders(status);
  const provider = smartProvider(status, providerPreference);
  const providerInfo = providers.find(item => item.id === provider);
  const technologyCatalog = isTechnologyCatalog(structure);
  const inputs = smartInputSignature(form, { provider, notes, photos: chosen, webSearch, autoSpecifications });
  const currentForm = useRef(form); currentForm.current = form;
  const currentInputs = useRef(inputs); currentInputs.current = inputs;
  const stale = preview && preview.inputs !== inputs;

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (autoStart) setOpen(true); }, [autoStart]);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    statusRequest.current = api.get(`${apiPrefix}/products/smart-fill/status`, { silent: true, cache: 'no-store' })
      .then(value => { if (alive) setStatus(value); return value; })
      .catch(() => { if (alive) setStatus(null); return null; });
    return () => { alive = false; };
  }, [open, apiPrefix]);

  const analyze = useCallback(async () => {
    if (request.current || disabled) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setNotice(''); setPreview(null); setReplace(false);
    const baseline = snapshotForm(form);
    try {
      const availability = await statusRequest.current;
      if (controller.signal.aborted) return;
      const chosenProvider = smartProvider(availability, providerPreference);
      const hasAI = smartProviders(availability).some(item => item.enabled);
      const result = await api.post(`${apiPrefix}/products/smart-fill`, smartRequest(baseline, notes, chosen, webSearch, hasAI ? chosenProvider : undefined), { silent: true, signal: controller.signal });
      if (controller.signal.aborted) return;
      const reviewAttributes = draftAttributeDefinitions(structure, categories, {
        ...baseline, category: result.suggestion?.category || baseline.category,
        subCategory: result.suggestion?.subCategory || baseline.subCategory,
      });
      const rowOptions = { categories, structure: { ...structure, attributes: reviewAttributes }, priceField, seo };
      const requestInputs = JSON.stringify({ ...JSON.parse(inputs), provider: chosenProvider });
      const unchanged = JSON.stringify({ ...JSON.parse(currentInputs.current), provider: chosenProvider }) === requestInputs;
      const autoPatch = technologyCatalog && autoSpecifications && unchanged && result.specificationLookup?.status !== 'failed'
        ? automaticSpecificationPatch(suggestionRows(result, baseline, rowOptions), currentForm.current) : [];
      const reviewedBaseline = applySmartPatch(baseline, autoPatch);
      const rows = suggestionRows(result, reviewedBaseline, rowOptions);
      if (autoPatch.length) {
        onApply(autoPatch); setUndo(autoPatch);
        setNotice(`${autoPatch.filter(row => row.key.startsWith('attributeValues.')).length} verified specifications filled. Review the remaining suggestions, then save.`);
      }
      setPreview({ rows, autoPatch, specificationLookup: result.specificationLookup, warnings: result.warnings || [], webSources: result.webSources || [], searchSuggestions: result.searchSuggestions || '', mode: result.mode, provider: result.provider || chosenProvider,
        inputs: smartInputSignature(reviewedBaseline, { provider: chosenProvider, notes, photos: chosen, webSearch, autoSpecifications }) });
      setSelected(rows.filter(row => row.empty && !row.evidence?.reviewRequired).map(row => row.key));
      if (!rows.length && !autoPatch.length && !result.warnings?.length) setNotice('No additional fields to fill from these inputs. Your existing details are unchanged.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || 'Smart Fill could not complete. Please try again.');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }, [apiPrefix, autoSpecifications, categories, chosen, disabled, form, inputs, notes, onApply, priceField, providerPreference, seo, structure, technologyCatalog, webSearch]);
  useEffect(() => {
    if (!autoStart || !open || disabled || autoStarted.current) return;
    autoStarted.current = true;
    analyze();
  }, [autoStart, open, disabled, analyze]);
  const togglePhoto = (url) => {
    setSelection(chosen.includes(url) ? chosen.filter(item => item !== url) : chosen.length < 4 ? [...chosen, url] : chosen);
  };
  const patch = preview && !stale ? selectedSmartPatch(preview.rows, selected, form, replace) : [];
  const apply = () => {
    if (!patch.length || disabled) return;
    onApply(patch); setUndo([...(preview.autoPatch || []), ...patch]); setPreview(null);
    setNotice('Reviewed details added to your form. Check stock and any missing information, then save as usual.');
  };

  return <section className="product-smart-fill" aria-label="Smart product fill">
    <button type="button" className="product-smart-fill__toggle" aria-expanded={open} aria-controls={uid} onClick={() => setOpen(value => !value)}>
      <span className="product-smart-fill__icon"><Sparkles size={20} /></span>
      <span><strong>Smart fill</strong><small>Fill details from a model name, photos or notes</small></span>
      <ChevronDown size={18} className={open ? 'is-open' : ''} />
    </button>
    {open && <div id={uid} className="product-smart-fill__body">
      <p>Use clear views of one product. Review suggested details before adding them to your form.</p>
      <div className="product-smart-fill__provider"><label className="product-smart-fill__label" htmlFor={uid + '-provider'}>Generate with</label>
        <select id={uid + '-provider'} value={provider} disabled={busy || disabled || !status || !providers.some(item => item.enabled)} onChange={event => {
          setProviderPreference(event.target.value); setError('');
          try { localStorage.setItem('baldev_product_ai_provider', event.target.value); } catch { /* Preference storage is optional. */ }
        }}>{providers.map(item => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.label}{!item.enabled ? ' · Not configured' : ''}</option>)}</select>
      </div>
      {!!photos.length && <div>
        <p className="product-smart-fill__label">Product photos <span>{chosen.length}/4 selected</span></p>
        <div className="product-smart-fill__photos">{photos.map((url, index) => <button key={url} type="button" disabled={busy || disabled || (!chosen.includes(url) && chosen.length >= 4)} aria-pressed={chosen.includes(url)} aria-label={`Use product photo ${index + 1}`} onClick={() => togglePhoto(url)}>
          <img src={normalizeImageUrl(url)} alt={`Product view ${index + 1}`} loading="lazy" /><span>{chosen.includes(url) ? 'Selected' : 'Select'}</span>
        </button>)}</div>
      </div>}
      <label className="product-smart-fill__label" htmlFor={uid + '-notes'}>Supplier notes or product details</label>
      <textarea id={uid + '-notes'} rows={4} maxLength={7000} value={notes} disabled={busy || disabled} onChange={event => setNotes(event.target.value)} placeholder={'Paste details in English, Hindi or Hinglish. For example:\nModel: Samsung Galaxy A15 5G\nRAM: 8 GB\nStorage: 128 GB\nFor accessories, add the brand, exact model, wattage or connector.'} />
      <label className="product-smart-fill__choice"><input type="checkbox" checked={webSearch} disabled={busy || disabled || providerInfo?.webSupported === false} onChange={event => setWebSearch(event.target.checked)} />Search the internet for model specifications with {providerInfo?.label || 'Gemini'}</label>
      {technologyCatalog && <label className="product-smart-fill__choice"><input type="checkbox" checked={autoSpecifications} disabled={busy || disabled || !webSearch} onChange={event => setAutoSpecifications(event.target.checked)} />Automatically fill verified specifications into empty fields</label>}
      <p className="product-smart-fill__hint">{status?.enabled === false ? 'AI is not configured. You can still fill explicitly stated details from notes.' : 'Choose a category and enter the exact brand and model for verified specs, including appliances and accessories. Include the size or capacity when known.'} Review sources and your exact variant before applying.</p>
      <div className="product-smart-fill__actions">
        <button type="button" className="admin-btn" disabled={busy || disabled} onClick={analyze}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? 'Reading product details…' : 'Suggest details'}</button>
        {busy && <button type="button" className="admin-btn-ghost" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); setNotice('Analysis cancelled.'); }}>Cancel</button>}
        {undo && !busy && <button type="button" className="admin-btn-ghost" disabled={disabled} onClick={() => { onApply(undo, true); setUndo(null); setPreview(null); setNotice('Smart Fill changes undone. Any later manual edits have been kept.'); }}><Undo2 size={15} />Undo last fill</button>}
      </div>
      {error && <p role="alert" className="product-smart-fill__warning">{error}</p>}
      {notice && <p role="status" className="product-smart-fill__notice">{notice}</p>}
      {preview && <div className="product-smart-fill__review">
        <div className="product-smart-fill__review-heading"><strong>Review suggestions</strong><span>{preview.mode !== 'notes' ? `${preview.provider === 'openai' ? 'ChatGPT' : 'Gemini'} · ` : ''}{preview.mode === 'web' ? 'Verified web specs' : preview.mode === 'ai' ? 'Photos & context' : 'From your notes'}</span></div>
        {technologyCatalog && preview.specificationLookup && !['completed', 'disabled'].includes(preview.specificationLookup.status) && <p role="alert" className="product-smart-fill__warning">Specifications were not fetched: {preview.specificationLookup.message}</p>}
        {preview.warnings.filter(warning => !technologyCatalog || warning !== preview.specificationLookup?.message).map(warning => <p key={warning} role="status" className="product-smart-fill__warning">{warning}</p>)}
        {!!preview.webSources.length && <div className="product-smart-fill__sources"><strong>Web sources</strong>{preview.webSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>)}</div>}
        {safeSearchSuggestionUrl(preview.searchSuggestions) && <a className="product-smart-fill__search-suggestions" href={safeSearchSuggestionUrl(preview.searchSuggestions)} target="_blank" rel="noopener noreferrer">Google Search suggestions</a>}
        {stale && <p role="status" className="product-smart-fill__warning">Your AI choice, photos or product details changed. Suggest details again before applying.</p>}
        {!!preview.rows.length && <>
          <label className="product-smart-fill__choice"><input type="checkbox" checked={replace} disabled={disabled || stale} onChange={event => { setReplace(event.target.checked); if (!event.target.checked) setSelected(preview.rows.filter(row => row.empty && !row.evidence?.reviewRequired).map(row => row.key)); }} />Allow replacing selected existing details</label>
          <div className="product-smart-fill__fields">{preview.rows.map(row => {
            const changed = !sameValue(fieldValue(form, row.key), row.before);
            const locked = disabled || stale || changed || (!row.empty && !replace);
            return <label key={row.key} className={'product-smart-fill__field' + (locked ? ' is-protected' : '')}>
              <input type="checkbox" checked={selected.includes(row.key) && !locked} disabled={locked} onChange={event => setSelected(current => event.target.checked ? [...current, row.key] : current.filter(key => key !== row.key))} />
              <span><strong>{row.label}</strong><span className="product-smart-fill__value">{displaySmartValue(row.value, row.key, categories)}</span>
                {!row.empty && <small>Current: {displaySmartValue(fieldValue(form, row.key), row.key, categories)}</small>}
                {changed && <small>Edited since analysis — your change is protected.</small>}
                {row.evidence?.note && <small>{row.evidence.note}</small>}
                {row.evidence?.quote && <small>Source: {row.evidence.quote}{row.evidence.url && <>{' '}<a href={row.evidence.url} target="_blank" rel="noopener noreferrer">Open source</a></>}</small>}
              </span>
            </label>;
          })}</div>
          <div className="product-smart-fill__actions"><button type="button" className="admin-btn" disabled={!patch.length || disabled} onClick={apply}>Apply {patch.length || ''} selected {patch.length === 1 ? 'detail' : 'details'}</button><button type="button" className="admin-btn-ghost" onClick={() => setPreview(null)}>Discard suggestions</button></div>
          <p className="product-smart-fill__hint">Existing values are protected by default. Conflicting selling price and MRP suggestions are skipped together.</p>
        </>}
      </div>}
    </div>}
  </section>;
}
