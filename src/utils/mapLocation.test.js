import { locationPoint, mapPixel, mapPoint } from './mapLocation';
test('map projection round trips the delivery point without shifting longitude', () => {
  for (const point of [{ latitude: 28.6139, longitude: 77.209 }, { latitude: 0, longitude: 0 }, { latitude: -33.8, longitude: 151.2 }]) {
    const roundTrip = mapPoint(mapPixel(point, 16), 16);
    expect(roundTrip.latitude).toBeCloseTo(point.latitude, 6);
    expect(roundTrip.longitude).toBeCloseTo(point.longitude, 6);
  }
  expect(locationPoint({ latitude: null, longitude: '' })).toBeNull();
});
