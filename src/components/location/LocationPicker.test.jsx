import { StrictMode } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import LocationPicker from './LocationPicker';

test('GPS and map movements require explicit confirmation and work after strict-mode remount checks', () => {
  const change = jest.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: jest.fn(success => success({ coords: { latitude: 28.61, longitude: 77.21, accuracy: 15 } })) } });
  render(<StrictMode><LocationPicker label="Delivery pin" center={{ latitude: 28.61, longitude: 77.21 }} onChange={change} /></StrictMode>);
  fireEvent.click(screen.getByRole('button', { name: 'Choose on map' }));
  expect(screen.getByRole('button', { name: 'Confirm location' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('group', { name: /Delivery pin map/ }), { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm location' }));
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0].longitude).toBeGreaterThan(77.21);
  expect(change.mock.calls[0][0].longitude).toBeLessThan(77.22);
});
