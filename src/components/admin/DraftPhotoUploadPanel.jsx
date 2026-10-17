import { useEffect, useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Select } from '../ui/Field';
import DraftUploadDetailsFields from './DraftUploadDetailsFields';
import { applySharedUploadDetails, updateUploadDetail, uploadDetailError } from '../../utils/draftUploadDetails';

export default function DraftPhotoUploadPanel({ categories, structure, uploading, onUpload, onClose }) {
  const [files, setFiles] = useState([]);
  const [photoIds, setPhotoIds] = useState([]);
  const [groupMode, setGroupMode] = useState('single');
  const [photoGroups, setPhotoGroups] = useState([]);
  const [detailsByMode, setDetailsByMode] = useState({});
  const groupDetails = detailsByMode[groupMode] || {};
  const setGroupDetails = update => setDetailsByMode(current => ({ ...current, [groupMode]: typeof update === 'function' ? update(current[groupMode] || {}) : update }));
  const [shared, setShared] = useState({});
  const [replaceShared, setReplaceShared] = useState(false);
  const [manualDetails, setManualDetails] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  const assignments = groupMode === 'single' ? files.map(() => 1)
    : groupMode === 'separate' ? photoIds : photoGroups;
  const groups = [];
  assignments.forEach((id, index) => {
    let group = groups.find(item => item.id === id);
    if (!group) { group = { id, indexes: [] }; groups.push(group); }
    group.indexes.push(index);
  });
  const groupIds = groups.map(group => group.id);

  const add = incoming => {
    const accepted = Array.from(incoming || []).slice(0, 30 - files.length);
    if (!accepted.length) return;
    setFiles(current => [...current, ...accepted]);
    setPhotoIds(current => {
      const next = [...current];
      for (let index = 0; index < accepted.length; index++) next.push(Array.from({ length: 30 }, (_, slot) => slot + 1).find(id => !next.includes(id)));
      return next;
    });
    setPhotoGroups(current => [...current, ...accepted.map(() => 1)]);
  };
  const keepDetails = (details, ids) => Object.fromEntries(Object.entries(details || {}).filter(([id]) => ids.includes(Number(id))));
  const remove = index => {
    setFiles(current => current.filter((_, fileIndex) => fileIndex !== index));
    const remaining = photoGroups.filter((_, fileIndex) => fileIndex !== index);
    const remainingIds = photoIds.filter((_, fileIndex) => fileIndex !== index);
    setPhotoGroups(remaining);
    setPhotoIds(remainingIds);
    setDetailsByMode(current => ({ single: remainingIds.length ? current.single : {}, grouped: keepDetails(current.grouped, remaining), separate: keepDetails(current.separate, remainingIds) }));
  };
  const assign = (index, value) => {
    const id = value === 'new' ? Array.from({ length: 30 }, (_, slot) => slot + 1).find(candidate => !photoGroups.includes(candidate)) : Number(value);
    if (!id) return;
    const next = photoGroups.map((groupId, fileIndex) => fileIndex === index ? id : groupId);
    setPhotoGroups(next);
    setGroupDetails(current => keepDetails(current, next));
  };
  const updateDetail = (id, key, value) => setGroupDetails(current => ({ ...current, [id]: updateUploadDetail(current[id] || {}, key, value, structure, categories) }));
  const applyShared = () => {
    const next = {};
    for (const [index, group] of groups.entries()) {
      const values = applySharedUploadDetails(groupDetails[group.id] || {}, shared, replaceShared, structure, categories);
      const invalid = uploadDetailError(values, structure, categories);
      if (invalid) { setError(`Product ${index + 1}: ${invalid}`); return; }
      next[group.id] = values;
    }
    setGroupDetails(next); setError(''); setNotice(`Shared details applied to ${groups.length} products.`);
  };
  const submit = smartFill => {
    const details = Object.fromEntries(groups.map(group => [group.id, groupDetails[group.id] || {}]));
    const skus = new Set();
    for (const [index, group] of groups.entries()) {
      const value = details[group.id];
      const invalid = uploadDetailError(value, structure, categories);
      if (invalid) { setError(`Product ${index + 1}: ${invalid}`); return; }
      const sku = value.sku?.trim().toLowerCase();
      if (sku && skus.has(sku)) { setError(`Product ${index + 1}: use a different SKU for each product.`); return; }
      if (sku) skus.add(sku);
    }
    setError('');
    const photoGroupsForUpload = groupMode === 'separate' ? files.map((_, index) => index + 1) : assignments;
    const detailsForUpload = groupMode === 'separate' ? Object.fromEntries(groups.map((group, index) => [index + 1, details[group.id]])) : details;
    onUpload({ files, groupMode, photoGroups: photoGroupsForUpload, groupDetails: detailsForUpload, smartFill });
  };

  return <section className="admin-card draft-upload-panel" aria-label="Create drafts from photos">
    <div className="draft-panel-heading"><h2>Create drafts from photos</h2><button type="button" disabled={uploading} onClick={onClose} aria-label="Close upload panel"><X /></button></div>
    <div className="draft-upload-options">
      {[
        ['single', 'One product'],
        ['grouped', 'Group by product'],
        ['separate', 'One per photo'],
      ].map(([mode, title]) => <label key={mode} className={groupMode === mode ? 'is-selected' : ''}><input type="radio" disabled={uploading} name="draft-group" checked={groupMode === mode} onChange={() => setGroupMode(mode)} /><strong>{title}</strong></label>)}
    </div>
    <label className="draft-dropzone"><Upload size={24} /><strong>Choose up to 30 product photos</strong><span>JPG, PNG or WEBP, up to 20MB each. Photos are compressed before storage.</span><input type="file" disabled={uploading} multiple accept="image/jpeg,image/jpg,image/png,image/webp" onChange={event => { add(event.target.files); event.target.value = ''; }} /></label>
    {!!previews.length && <div className="draft-upload-previews">{previews.map(({ file, url }, index) => <figure key={`${file.name}-${file.size}-${index}`}>
      <img src={url} alt={`Product view ${index + 1}`} /><figcaption title={file.name}>{file.name}</figcaption>
      <button type="button" disabled={uploading} onClick={() => remove(index)} aria-label={`Remove photo ${index + 1}`}><X size={14} /></button>
      {groupMode === 'grouped' && <Select aria-label={`Product group for photo ${index + 1}`} value={photoGroups[index] || 1} disabled={uploading} onChange={event => assign(index, event.target.value)}>
        {groupIds.map((id, groupIndex) => <option key={id} value={id}>Product {groupIndex + 1}</option>)}<option value="new" disabled={groupIds.length >= 30}>+ New product</option>
      </Select>}
      {groupMode !== 'separate' && groups.find(group => group.id === assignments[index])?.indexes[0] === index && <b>Cover</b>}
    </figure>)}</div>}
    {groups.length > 1 && <section className="draft-upload-shared" aria-label="Shared product details"><div className="draft-upload-shared__heading"><strong>Shared details</strong><span>Fill once for {groups.length} products</span></div>
      <DraftUploadDetailsFields shared identityOnly={!manualDetails} details={shared} structure={structure} categories={categories} disabled={uploading} onChange={(key, value) => setShared(current => updateUploadDetail(current, key, value, structure, categories))} />
      <div className="draft-upload-shared__actions"><label><input type="checkbox" checked={replaceShared} disabled={uploading} onChange={event => setReplaceShared(event.target.checked)} />Replace filled fields</label><button type="button" className="admin-btn-ghost" disabled={uploading} onClick={applyShared}>Apply to all products</button></div>
    </section>}
    {!!files.length && <div className="draft-upload-groups">{groups.map((group, index) => <section aria-label={`Product ${index + 1}`} className="draft-upload-group" key={group.id}>
      <div className="draft-upload-group__heading"><img src={previews[group.indexes[0]]?.url} alt="" /><div><strong>Product {index + 1}</strong><span>{group.indexes.length} photo{group.indexes.length === 1 ? '' : 's'}</span></div></div>
      <DraftUploadDetailsFields identityOnly={!manualDetails} details={groupDetails[group.id] || {}} structure={structure} categories={categories} disabled={uploading} onChange={(key, value) => updateDetail(group.id, key, value)} />
    </section>)}</div>}
    {!!files.length && <><p className="draft-upload-hint">Photos & model → Smart Fill → price, stock and remaining details.</p><label className="draft-upload-hint"><input type="checkbox" checked={manualDetails} disabled={uploading} onChange={event => setManualDetails(event.target.checked)} /> Add manual details before Smart Fill</label></>}
    {notice && <p role="status" className="draft-upload-hint">{notice}</p>}
    {error && <p role="alert" className="draft-alert is-error">{error}</p>}
    <div className="draft-upload-actions"><span>{files.length ? `${files.length} photos → ${groups.length} draft${groups.length === 1 ? '' : 's'}` : 'No photos selected'}</span><button type="button" className="admin-btn-ghost" disabled={!files.length || uploading} onClick={() => { setFiles([]); setPhotoGroups([]); setPhotoIds([]); setDetailsByMode({}); setShared({}); setError(''); setNotice(''); }}>Clear</button><button type="button" className="admin-btn-ghost" disabled={!files.length || uploading} onClick={() => submit(false)}>Create drafts only</button><button type="button" className="admin-btn" disabled={!files.length || uploading} onClick={() => submit(true)}>{uploading ? 'Creating drafts...' : groups.length > 1 ? 'Create & fill all drafts' : 'Create & start Smart Fill'}</button></div>
  </section>;
}
