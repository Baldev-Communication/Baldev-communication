import { useEffect, useState } from 'react';
import fallback from '../../assets/generated-brand-logo.svg';
import { normalizeImageUrl } from '../../services/normalize';

export default function StoreLogo({ src, name = 'Baldev Communication', className = '' }) {
  const source = src === fallback ? (name === 'Baldev Communication' ? fallback : '') : normalizeImageUrl(src) || (name === 'Baldev Communication' ? fallback : '');
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  if (source && !failed) return <img src={source} alt={name} className={className} onError={() => setFailed(true)} />;
  return <span role="img" aria-label={name} className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, minWidth: 36, fontWeight: 700, color: 'inherit', fontSize: 18 }}>{name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span>;
}
