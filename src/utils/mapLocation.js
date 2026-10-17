export function locationPoint(value) {
  const valid = (number, max) => ['number', 'string'].includes(typeof number) && String(number).trim() !== '' && Number.isFinite(Number(number)) && Math.abs(Number(number)) <= max;
  return value && valid(value.latitude, 90) && valid(value.longitude, 180) ? { latitude: Number(value.latitude), longitude: Number(value.longitude) } : null;
}
export function mapPixel(point, zoom) {
  const size = 256 * 2 ** zoom;
  const sine = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, point.latitude)) * Math.PI / 180);
  return { x: (point.longitude + 180) / 360 * size, y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size };
}
export function mapPoint(pixel, zoom) {
  const size = 256 * 2 ** zoom;
  const y = Math.max(0, Math.min(size, pixel.y));
  return { latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI, longitude: ((pixel.x / size * 360) % 360 + 360) % 360 - 180 };
}

export function deliveryDirectionsUrl(location) {
  const point = locationPoint(location);
  return point ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${point.latitude},${point.longitude}`)}` : '';
}
