import { useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, Minus, Plus } from 'lucide-react';
import { locationPoint, mapPixel, mapPoint } from '../../utils/mapLocation';
import './LocationPicker.css';

export default function LocationPicker({ value, onChange, center, label = 'Delivery location', disabled = false }) {
  const saved = locationPoint(value);
  const initial = saved || locationPoint(center);
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState(initial || { latitude: 20.5937, longitude: 78.9629 });
  const [selected, setSelected] = useState(Boolean(saved));
  const [zoom, setZoom] = useState(initial ? 16 : 5);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [size, setSize] = useState({ width: 512, height: 260 });
  const viewport = useRef(null), drag = useRef(null), alive = useRef(true), gpsRequest = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; gpsRequest.current += 1; }; }, []);
  useEffect(() => {
    if (!open || !viewport.current) return undefined;
    const resize = () => { if (viewport.current) setSize({ width: viewport.current.clientWidth || 512, height: 260 }); };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(viewport.current);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [open]);
  const begin = () => {
    const next = locationPoint(value) || locationPoint(center);
    if (next) { setPoint(next); setZoom(16); }
    setSelected(Boolean(locationPoint(value))); setOpen(true); setError('');
  };
  const gps = () => {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Choose the place on the map.'); return; }
    const request = ++gpsRequest.current;
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(result => {
      if (!alive.current || request !== gpsRequest.current) return;
      const next = locationPoint(result.coords);
      if (next) { setPoint(next); setZoom(18); setSelected(true); }
      setLocating(false);
      if (result.coords.accuracy > 100) setError('Location is approximate. Move the pin to the correct building before confirming.');
    }, () => {
      if (!alive.current || request !== gpsRequest.current) return;
      setLocating(false); setError('Could not get your location. Allow location access or choose the place on the map.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  };
  const position = mapPixel(point, zoom);
  const tiles = [];
  for (let x = Math.floor((position.x - size.width / 2) / 256); x <= Math.floor((position.x + size.width / 2) / 256); x++) {
    for (let y = Math.floor((position.y - size.height / 2) / 256); y <= Math.floor((position.y + size.height / 2) / 256); y++) {
      const count = 2 ** zoom;
      if (y < 0 || y >= count) continue;
      tiles.push({ x, y, tileX: ((x % count) + count) % count });
    }
  }
  const move = (dx, dy) => { setPoint(mapPoint({ x: position.x + dx, y: position.y + dy }, zoom)); setSelected(true); };
  const pointerDown = event => {
    if (disabled || event.button > 0) return;
    gpsRequest.current += 1; setLocating(false);
    drag.current = { clientX: event.clientX, clientY: event.clientY, pixel: position, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = event => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.clientX, dy = event.clientY - drag.current.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 4 && !drag.current.moved) return;
    drag.current.moved = true;
    setPoint(mapPoint({ x: drag.current.pixel.x - dx, y: drag.current.pixel.y - dy }, zoom)); setSelected(true);
  };
  const pointerUp = event => {
    if (!drag.current) return;
    if (!drag.current.moved) {
      const box = event.currentTarget.getBoundingClientRect();
      move(event.clientX - box.left - size.width / 2, event.clientY - box.top - size.height / 2);
    }
    drag.current = null;
  };
  return <div className="location-picker">
    <div className="location-picker__heading"><strong><MapPin size={16} />{label}</strong><span>{saved ? 'Pin saved' : 'Pin not set'}</span></div>
    {!open ? <button type="button" disabled={disabled} className="location-picker__button" onClick={begin}>{saved ? 'Change location' : 'Choose on map'}</button> : <>
      <div className="location-picker__toolbar"><button type="button" disabled={disabled || locating} onClick={gps}><Crosshair size={16} />{locating ? 'Finding location...' : 'Use my current location'}</button><span><button type="button" disabled={disabled || zoom <= 3} aria-label="Zoom out" onClick={() => setZoom(value => value - 1)}><Minus size={17} /></button><button type="button" disabled={disabled || zoom >= 19} aria-label="Zoom in" onClick={() => setZoom(value => value + 1)}><Plus size={17} /></button></span></div>
      <div ref={viewport} className="location-picker__map" role="group" tabIndex={disabled ? -1 : 0} aria-label={`${label} map. Drag or tap to choose a pin. Arrow keys move the pin.`}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => { if (disabled) return; const shifts = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }; if (shifts[event.key]) { event.preventDefault(); move(...shifts[event.key]); } }}>
        {tiles.map(tile => <img key={`${zoom}/${tile.x}/${tile.y}`} alt="" draggable="false" referrerPolicy="strict-origin-when-cross-origin" src={`https://tile.openstreetmap.org/${zoom}/${tile.tileX}/${tile.y}.png`} style={{ left: tile.x * 256 - position.x + size.width / 2, top: tile.y * 256 - position.y + size.height / 2 }} />)}
        <MapPin className="location-picker__pin" size={34} fill="currentColor" aria-hidden="true" />
        <a className="location-picker__attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onPointerDown={event => event.stopPropagation()}>© OpenStreetMap contributors</a>
      </div>
      <p>Move the map or tap the building entrance, then confirm. This pin must match the written address.</p>
      {error && <p role="status" className="location-picker__error">{error}</p>}
      <div className="location-picker__actions"><button type="button" disabled={disabled || locating || !selected} onClick={() => { onChange({ latitude: Number(point.latitude.toFixed(7)), longitude: Number(point.longitude.toFixed(7)) }); setOpen(false); }}>Confirm location</button><button type="button" disabled={disabled} onClick={() => { gpsRequest.current += 1; setLocating(false); setOpen(false); }}>Cancel</button></div>
    </>}
  </div>;
}
