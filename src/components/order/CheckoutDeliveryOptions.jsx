import LocationPicker from '../location/LocationPicker';

export default function CheckoutDeliveryOptions({ config, method, onMethodChange, address, onLocationChange, saving, error, disabled }) {
  if (!config?.local?.enabled && config?.standardEnabled !== false) return null;
  const local = config?.local || {};
  return <section className="my-3 rounded-xl border border-slate-200 bg-white p-3" aria-label="Delivery options">
    <h3 className="text-sm font-bold mb-2">Choose delivery</h3>
    <fieldset disabled={disabled || saving} className="grid gap-2 text-sm">
      {local.enabled && <label className="flex gap-2 items-start rounded-lg border border-slate-200 p-3"><input type="radio" name="checkout-delivery-method" value="LOCAL" checked={method === 'LOCAL'} onChange={() => onMethodChange('LOCAL')} /><span><strong>Store local delivery</strong><small className="block text-slate-500">Within {local.radiusKm} km · {Number(local.fee) === 0 ? 'Free' : `₹${Number(local.fee).toLocaleString('en-IN')}`}{local.estimate ? ` · ${local.estimate}` : ''}</small>{local.freeAboveEnabled && <small className="block text-slate-500">Free above ₹{Number(local.freeAbove).toLocaleString('en-IN')}</small>}</span></label>}
      {config.standardEnabled !== false && <label className="flex gap-2 items-start rounded-lg border border-slate-200 p-3"><input type="radio" name="checkout-delivery-method" value="STANDARD" checked={method === 'STANDARD'} onChange={() => onMethodChange('STANDARD')} /><span><strong>Standard delivery</strong><small className="block text-slate-500">Availability and fee are confirmed in the order total.</small></span></label>}
      {!local.enabled && config.standardEnabled === false && <p role="status">Delivery is currently unavailable. Please contact the store.</p>}
    </fieldset>
    {method === 'LOCAL' && local.enabled && (address?._id ? <div className="mt-3"><LocationPicker key={address._id} label="Delivery address pin" value={address.location} center={local.origin} onChange={onLocationChange} disabled={disabled || saving} />{saving && <p className="text-xs mt-2" role="status">Saving delivery location...</p>}</div> : <p className="text-xs mt-2">Select a delivery address to confirm its map pin.</p>)}
    {error && <p role="alert" className="text-xs text-rose-700 mt-2">{error}</p>}
  </section>;
}
