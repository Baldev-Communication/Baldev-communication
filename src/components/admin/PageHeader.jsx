import { CircleHelp } from 'lucide-react';

export default function PageHeader({ title, note, noteInline = false, actionLabel, actionHref, children }) {
  return (
    <div className="admin-card admin-page-header">
      <div className="admin-page-header__copy">
        <h1>{title}</h1>
        {note && (noteInline ? <p className="admin-page-header__inline-note">{note}</p> : <details className="admin-page-header__note"><summary aria-label={`About ${title}`} title={`About ${title}`}><CircleHelp size={17} /></summary><p>{note}</p></details>)}
      </div>
      <div className="admin-page-header__actions">
        {children}
        {actionLabel && <a href={actionHref} className="admin-btn">{actionLabel}</a>}
      </div>
    </div>
  );
}
