import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShoppingShortcuts from './ShoppingShortcuts';
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
test('sale-only and empty stores do not show rental or occasion placeholders', () => {
  const { container } = render(<ShoppingShortcuts data={{ rentalEnabled: false, occasions: [] }} navigate={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
test('shortcuts encode real occasion names and respect feature switches', () => {
  const navigate = jest.fn(); const data = { rentalEnabled: false, occasions: [{ key: 'party', label: 'Party & evening' }] };
  const { rerender } = render(<ShoppingShortcuts data={data} navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Party & evening' }));
  expect(navigate).toHaveBeenCalledWith('/products?occasion=Party%20%26%20evening');
  rerender(<ShoppingShortcuts data={{ ...data, occasionShoppingEnabled: false }} navigate={navigate} />);
  expect(screen.queryByText('Shop by occasion')).not.toBeInTheDocument();
});
test('stale rental-only and mixed discovery responses cannot enable rental shopping', () => {
  const navigate = jest.fn(); const { rerender } = render(<ShoppingShortcuts data={{ rentalEnabled: true, mode: 'RENTAL_ONLY', occasions: [] }} navigate={navigate} />);
  expect(screen.queryByRole('region', { name: 'Rental shopping' })).not.toBeInTheDocument();
  rerender(<ShoppingShortcuts data={{ rentalEnabled: true, mode: 'SALE_AND_RENTAL', occasions: [] }} navigate={navigate} />);
  expect(screen.queryByRole('button', { name: /Explore rentals/ })).not.toBeInTheDocument();
  expect(navigate).not.toHaveBeenCalled();
});
