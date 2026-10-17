import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import QuickViewModal from './QuickViewModal';
const mockAdd = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ addToCart: mockAdd }) }));
test('quick view keeps unavailable items out of the bag while still opening full details', () => {
  const onOpenFull = jest.fn();
  render(<QuickViewModal product={{ _id: 'saree', name: 'Silk saree', stock: 0, price: 1599 }} onClose={jest.fn()} onOpenFull={onOpenFull} />);
  fireEvent.click(screen.getByRole('button', { name: 'Out of stock' }));
  expect(mockAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View full details' }));
  expect(onOpenFull).toHaveBeenCalledTimes(1);
});

test('a cached rental-only product cannot start a rental or consume sale stock', () => {
  mockAdd.mockClear();
  render(<QuickViewModal product={{ _id: 'old-rental', name: 'Old item', stock: 5, price: 1000, commerceMode: 'RENTAL_ONLY' }} onClose={jest.fn()} onOpenFull={jest.fn()} />);
  expect(screen.queryByText(/Check rental/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Out of stock' }));
  expect(mockAdd).not.toHaveBeenCalled();
});
