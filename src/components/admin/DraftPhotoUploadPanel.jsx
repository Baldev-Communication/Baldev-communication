import { useEffect, useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Select, TextInput } from '../ui/Field';

export default function DraftPhotoUploadPanel({ categories, uploading, onUpload, onClose }) {
  const [files, setFiles] = useState([]);
  const [groupMode, setGroupMode] = useState('single');
  const [photoGroups, setPhotoGroups] = useState([]);
  const [groupDetails, setGroupDetails] = useState({});
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  const assignments = groupMode === 'single' ? files.map(() => 1)
    : groupMode === 'separate' ? files.map((_, index) => index + 1) : photoGroups;
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
    setPhotoGroups(current => [...current, ...accepted.map(() => 1)]);
  };
  const keepGroupDetails = assignments => setGroupDetails(current => Object.fromEntries(Object.entries(current).filter(([id]) => assignments.includes(Number(id)))));
  const remove = index => {
    setFiles(current => current.filter((_, fileIndex) => fileIndex !== index));
    const remaining = photoGroups.filter((_, fileIndex) => fileIndex !== index);
    setPhotoGroups(remaining);
    keepGroupDetails(remaining);
  };
  const assign = (index, value) => {
    const id = value === 'new' ? Array.from({ length: 30 }, (_, slot) => slot + 1).find(candidate => !photoGroups.includes(candidate)) : Number(value);
    if (!id) return;
    const next = photoGroups.map((groupId, fileIndex) => fileIndex === index ? id : groupId);
    setPhotoGroups(next);
    keepGroupDetails(next);
  };
  const updateDetail = (id, key, value) => setGroupDetails(current => ({ ...current, [id]: { ...current[id], [key]: value } }));
  const submit = smartFill => {
    const details = Object.fromEntries(groups.map(group => [group.id, groupDetails[group.id] || {}]));
    const incomplete = groups.find(group => {
      const value = details[group.id];
      return (value.model && !value.category) || ((value.ram || value.storage) && !value.model);
    });
    if (incomplete) {
      setError(`Choose a category and exact model for Product ${groups.indexOf(incomplete) + 1} before adding phone details.`);
      return;
    }
    setError('');
    onUpload({ files, groupMode, photoGroups: assignments, groupDetails: details, smartFill });
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
    {!!files.length && groupMode !== 'separate' && <div className="draft-upload-groups">{groups.map((group, index) => <div className="draft-upload-group" key={group.id}>
      <div className="draft-upload-group__heading"><img src={previews[group.indexes[0]]?.url} alt="" /><div><strong>Product {index + 1}</strong><span>{group.indexes.length} photo{group.indexes.length === 1 ? '' : 's'}</span></div></div>
      <div className="draft-upload-group__fields">
        <label>Category <Select value={groupDetails[group.id]?.category || ''} disabled={uploading} onChange={event => updateDetail(group.id, 'category', event.target.value)}><option value="">Choose category</option>{categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}</Select></label>
        <label>Exact phone model <TextInput value={groupDetails[group.id]?.model || ''} maxLength={120} disabled={uploading} placeholder="e.g. Apple iPhone 17" onChange={event => updateDetail(group.id, 'model', event.target.value)} /></label>
        <label>RAM (GB) <TextInput value={groupDetails[group.id]?.ram || ''} inputMode="numeric" maxLength={3} disabled={uploading} placeholder="e.g. 8" onChange={event => updateDetail(group.id, 'ram', event.target.value)} /></label>
        <label>Storage (GB) <TextInput value={groupDetails[group.id]?.storage || ''} inputMode="numeric" maxLength={4} disabled={uploading} placeholder="e.g. 256" onChange={event => updateDetail(group.id, 'storage', event.target.value)} /></label>
      </div>
    </div>)}</div>}
    {!!files.length && groupMode !== 'separate' && <p className="draft-upload-hint">Phone specs: enter the exact model and storage.{groups.length > 1 && ' After upload, fill shared and product details together.'}</p>}
    {error && <p role="alert" className="draft-alert is-error">{error}</p>}
    <div className="draft-upload-actions"><span>{files.length ? `${files.length} photos → ${groups.length} draft${groups.length === 1 ? '' : 's'}` : 'No photos selected'}</span><button type="button" className="admin-btn-ghost" disabled={!files.length || uploading} onClick={() => { setFiles([]); setPhotoGroups([]); setGroupDetails({}); }}>Clear</button><button type="button" className="admin-btn-ghost" disabled={!files.length || uploading} onClick={() => submit(false)}>Create drafts only</button><button type="button" className="admin-btn" disabled={!files.length || uploading} onClick={() => submit(true)}>{uploading ? 'Creating drafts...' : groups.length > 1 ? 'Create & fill all drafts' : 'Create & start Smart Fill'}</button></div>
  </section>;
}
