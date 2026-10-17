import LocationPicker from '../location/LocationPicker';

export default function LocalDeliverySettings({ data, update }) {
  return <section className="store-settings__wide settings-card">
    <h3>Delivery options</h3>
    <div className="grid gap-3 mt-3 md:grid-cols-2">
      <label className="store-settings__toggle"><span><strong>Local self delivery</strong><small>Your team delivers within the configured area.</small></span><input type="checkbox" aria-label="Enable local self delivery" checked={data.localDeliveryEnabled === true} onChange={event => update('localDeliveryEnabled', event.target.checked)} /><i aria-hidden="true" /></label>
      <label className="store-settings__toggle"><span><strong>Existing delivery</strong><small>Use the saved courier or manual delivery setup below.</small></span><input type="checkbox" aria-label="Enable existing delivery" checked={data.standardDeliveryEnabled !== false} onChange={event => update('standardDeliveryEnabled', event.target.checked)} /><i aria-hidden="true" /></label>
    </div>
    {!data.localDeliveryEnabled && data.standardDeliveryEnabled === false && <p role="status" className="admin-note mt-2">Both delivery options are off. New delivery orders cannot be placed.</p>}
    <details className="mt-3" open={data.localDeliveryEnabled || undefined}>
      <summary className="cursor-pointer text-sm font-bold">Local area, fees & store location</summary>
      <div className="grid gap-3 mt-3 md:grid-cols-2">
        <label className="store-settings__field"><span>Delivery radius (km)</span><input type="number" min="0.1" max="50" step="0.1" value={data.localDeliveryRadiusKm ?? 5} onChange={event => update('localDeliveryRadiusKm', event.target.value)} /><small>Straight-line radius from the saved store pin. Default: 5 km.</small></label>
        <label className="store-settings__field"><span>Local delivery fee (INR)</span><input type="number" min="0" max="100000" step="0.01" value={data.localDeliveryFee ?? 0} onChange={event => update('localDeliveryFee', event.target.value)} /><small>Set 0 for free local delivery.</small></label>
        <label className="store-settings__field"><span>Local delivery estimate</span><input maxLength={100} value={data.localDeliveryEstimate || ''} placeholder="e.g. 45–90 minutes, during store hours" onChange={event => update('localDeliveryEstimate', event.target.value)} /><small>Optional customer-facing estimate.</small></label>
        <label className="store-settings__toggle"><span><strong>Local free-delivery offer</strong><small>Use a separate minimum for local orders.</small></span><input type="checkbox" aria-label="Enable local free delivery offer" checked={data.localDeliveryFreeAboveEnabled === true} onChange={event => update('localDeliveryFreeAboveEnabled', event.target.checked)} /><i aria-hidden="true" /></label>
        {data.localDeliveryFreeAboveEnabled && <label className="store-settings__field"><span>Free local delivery above (INR)</span><input type="number" min="0" step="0.01" value={data.localDeliveryFreeAbove ?? 999} onChange={event => update('localDeliveryFreeAbove', event.target.value)} /></label>}
        <div className="md:col-span-2"><LocationPicker label="Store location" value={data.localDeliveryOrigin} onChange={point => update('localDeliveryOrigin', point)} /></div>
      </div>
    </details>
  </section>;
}
