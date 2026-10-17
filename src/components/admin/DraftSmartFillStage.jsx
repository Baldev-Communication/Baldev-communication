import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import api from '../../services/api';
import DraftUploadDetailsFields from './DraftUploadDetailsFields';
import { draftAttributeDefinitions } from '../../utils/draftAttributes';
import { automaticDraftPatch, smartPhotos, smartProvider, smartProviders, smartRequest, snapshotForm, suggestionRows } from '../../utils/productSmartFill';

const idOf = row => String(row._id || row.id || '');
const wait = (duration, signal) => new Promise(resolve => {
  const finish = () => { window.clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
  const timer = window.setTimeout(finish, duration);
  signal.addEventListener('abort', finish, { once: true });
  if (signal.aborted) finish();
});

export default function DraftSmartFillStage({ rows, categories, structure, apiPrefix, active, autoStart, results, setResults, onUpdate, onFilled, onContinue, onBusyChange }) {
  const [status, setStatus] = useState(null);
  const [ready, setReady] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusAttempt, setStatusAttempt] = useState(0);
  const [preference, setPreference] = useState(() => { try { return localStorage.getItem('baldev_product_ai_provider') || ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const controllerRef = useRef(null);
  const recentRequestsRef = useRef([]);
  const started = useRef(false);
  const provider = smartProvider(status, preference);
  const available = smartProviders(status);
  const current = useRef({ rows, results }); current.current = { rows, results };

  useEffect(() => {
    if (!active || ready) return undefined;
    const controller = new AbortController();
    api.get(`${apiPrefix}/products/smart-fill/status`, { silent: true, cache: 'no-store', signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setStatus(value); setReady(true); setStatusError(''); } })
      .catch(error => { if (!controller.signal.aborted) setStatusError(error.message || 'AI availability could not be checked.'); });
    return () => controller.abort();
  }, [active, apiPrefix, ready, statusAttempt]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (controllerRef.current || !ready || !structure) return;
    const controller = new AbortController(); controllerRef.current = controller;
    const all = current.current.rows;
    const remaining = all.filter(row => current.current.results[idOf(row)]?.state !== 'done');
    const targets = (remaining.length ? remaining : all).map(snapshotForm);
    setBusy(true); onBusyChange(true);
    try {
      for (const [index, baseline] of targets.entries()) {
        if (controller.signal.aborted) break;
        const id = idOf(baseline);
        const recentRequests = recentRequestsRef.current;
        // Leave headroom under the API's per-user limit, including quick notes
        // requests. A cancelled wait never starts another provider request.
        while (recentRequests.length && recentRequests[0] <= Date.now() - 60000) recentRequests.shift();
        if (recentRequests.length >= 10) {
          setProgress(`Waiting for the next AI slot · ${index + 1} of ${targets.length}`);
          await wait(Math.max(1, recentRequests[0] + 60000 - Date.now()), controller.signal);
        }
        if (controller.signal.aborted) break;
        recentRequests.push(Date.now());
        setProgress(`Fetching product ${index + 1} of ${targets.length}`);
        setResults(value => ({ ...value, [id]: { ...value[id], state: 'running', error: '' } }));
        try {
          const result = await api.post(`${apiPrefix}/products/smart-fill`, smartRequest(baseline, '', smartPhotos(baseline).slice(0, 4), true,
            available.some(item => item.enabled) ? provider : undefined), { silent: true, signal: controller.signal });
          if (controller.signal.aborted) break;
          const attributes = draftAttributeDefinitions(structure, categories, { ...baseline, category: result.suggestion?.category || baseline.category });
          const suggestions = suggestionRows(result, baseline, { categories, structure: { ...structure, attributes }, priceField: 'sellingPrice' });
          const patch = automaticDraftPatch(suggestions, baseline);
          onFilled(id, patch);
          const lookup = result.specificationLookup;
          const incomplete = lookup && !['completed', 'disabled'].includes(lookup.status);
          setResults(value => ({ ...value, [id]: { state: incomplete ? 'attention' : 'done', count: patch.length, suggestions,
            lookup, sources: result.webSources || [], warnings: result.warnings || [], provider: result.provider || provider } }));
          if (['AI_QUOTA_EXCEEDED', 'AI_ACCESS_DENIED', 'AI_KEY_MISSING'].includes(lookup?.code)) break;
        } catch (error) {
          if (controller.signal.aborted) break;
          setResults(value => ({ ...value, [id]: { state: 'error', error: error.message || 'Smart Fill could not complete. Retry this draft.' } }));
          // Stop the batch when the provider or API asks us to wait; already
          // filled drafts remain available and retries only include pending rows.
          if (error.status === 429 || ['AI_QUOTA_EXCEEDED', 'AI_ACCESS_DENIED', 'SMART_FILL_UNAVAILABLE'].includes(error.code)) break;
        }
      }
      if (!controller.signal.aborted) onContinue();
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null; setBusy(false); onBusyChange(false); setProgress('');
        setResults(value => Object.fromEntries(Object.entries(value).map(([id, result]) => [id, result.state === 'running' ? { ...result, state: 'attention', error: 'Analysis cancelled. Retry when ready.' } : result])));
      }
    }
  }, [apiPrefix, available, categories, onBusyChange, onContinue, onFilled, provider, ready, setResults, structure]);

  useEffect(() => {
    if (!autoStart || !active || !ready || !structure || started.current) return;
    started.current = true; run();
  }, [active, autoStart, ready, run, structure]);

  if (!active) return null;
  return <section className="draft-ai-stage" aria-label="Smart Fill drafts">
    <div className="draft-ai-stage__toolbar"><label>Generate with<select value={provider} disabled={busy || !ready || !available.some(item => item.enabled)} onChange={event => {
      setPreference(event.target.value);
      try { localStorage.setItem('baldev_product_ai_provider', event.target.value); } catch { /* Optional preference. */ }
    }}>{available.map(item => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.label}{item.enabled ? '' : ' · Not configured'}</option>)}</select></label>
      <button type="button" className="admin-btn" disabled={busy || !ready || !structure} onClick={run}><Sparkles size={16} />{Object.keys(results).length ? 'Fetch remaining details' : 'Run Smart Fill'}</button>
      {busy ? <button type="button" className="admin-btn-ghost" onClick={() => controllerRef.current?.abort()}>Cancel Smart Fill</button>
        : <button type="button" className="admin-btn-ghost" onClick={onContinue}>Continue to manual details</button>}
    </div>
    <p className="draft-upload-hint">Exact model, size or capacity improves internet results. Price, stock and item condition follow after Smart Fill.</p>
    {statusError && <p role="alert">{statusError} <button type="button" onClick={() => { setStatusError(''); setStatusAttempt(value => value + 1); }}>Retry availability</button></p>}
    {ready && status?.enabled === false && <p role="status">AI is not configured. Enter details manually or configure Gemini / ChatGPT in settings.</p>}
    {busy && <div className="draft-ai-progress" role="status" aria-live="polite"><Loader2 size={18} className="animate-spin" />{progress || 'Preparing Smart Fill…'}</div>}
    <div className="draft-bulk-rows">{rows.map((row, index) => <section className="draft-bulk-row" key={idOf(row)} aria-label={`AI product ${index + 1}`}>
      <strong>Product {index + 1}{row.name ? ` · ${row.name}` : ''}</strong>
      <DraftUploadDetailsFields identityOnly details={row} categories={categories} structure={structure} disabled={busy} onChange={(field, value) => {
        onUpdate(idOf(row), field, value); setResults(currentResults => { const next = { ...currentResults }; delete next[idOf(row)]; return next; });
      }} />
      {results[idOf(row)]?.error && <p role="alert">{results[idOf(row)].error}</p>}
      {results[idOf(row)]?.lookup && <p className="draft-upload-hint">{results[idOf(row)].lookup.message}</p>}
    </section>)}</div>
  </section>;
}
