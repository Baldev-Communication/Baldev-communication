import { trackEvent } from '../../utils/analytics';
import './ShoppingDiscovery.css';
export default function ShoppingShortcuts({ data, navigate }) {
  if (!data) return null;
  const occasions = data.occasionShoppingEnabled !== false && Array.isArray(data.occasions) ? data.occasions : [];
  if (!occasions.length) return null;
  return <div className="shopping-discovery">
    {!!occasions.length && <section className="shopping-discovery__section" aria-label="Shop by occasion"><h2>Shop by occasion</h2><p>Find pieces for the moments you’re dressing for.</p><div className="shopping-discovery__chips">{occasions.map(item => <button type="button" key={item.key} onClick={() => { trackEvent('HOME_VIEW_ALL', { metadata: { sectionId: 'occasions', occasion: item.label } }); navigate(`/products?occasion=${encodeURIComponent(item.label)}`); }}>{item.label}</button>)}</div></section>}
  </div>;
}
