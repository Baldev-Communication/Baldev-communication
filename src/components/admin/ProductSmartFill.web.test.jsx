import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductSmartFill from './ProductSmartFill';
import api from '../../services/api';
import { safeSearchSuggestionUrl } from '../../utils/productSmartFill';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));

test('Gemini search HTML is reduced to an allowed Google search link', () => {
  expect(safeSearchSuggestionUrl('<a href="https://www.google.com/search?q=iPhone+17">Search</a>')).toBe('https://www.google.com/search?q=iPhone+17');
  expect(safeSearchSuggestionUrl('<a href="javascript:alert(1)">Search</a>')).toBe('');
  expect(safeSearchSuggestionUrl('<a href="https://example.com/search">Search</a>')).toBe('');
});

test('model Smart Fill requests web specs, shows sources and applies reviewed attributes', async () => {
  api.get.mockResolvedValue({ enabled: true, webSupported: true });
  api.post.mockResolvedValue({
    mode: 'web', suggestion: { attributeValues: { processor: 'Dimensity 6100+' } },
    fieldSources: { 'attribute.processor': { source: 'web', quote: 'processor: Dimensity 6100+', url: 'https://example.com/specs', title: 'Manufacturer specs' } },
    webSources: [{ url: 'https://example.com/specs', title: 'Manufacturer specs' }],
    searchSuggestions: '<a href="https://www.google.com/search?q=Galaxy+A15">Google Search suggestion</a>', warnings: [],
  });
  const onApply = jest.fn();
  const form = { name: 'Galaxy A15 5G', attributeValues: { model: 'Galaxy A15 5G', ram: '8', storage: '128' }, images: [] };
  render(<ProductSmartFill form={form} categories={[]} structure={{ attributes: [{ key: 'processor', label: 'Processor' }] }} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Review suggestions');
  expect(api.post).toHaveBeenCalledWith('/admin/products/smart-fill', expect.objectContaining({ webSearch: true, existing: expect.objectContaining({ name: 'Galaxy A15 5G', attributeValues: form.attributeValues }) }), expect.objectContaining({ silent: true }));
  expect(screen.getByRole('link', { name: 'Manufacturer specs' })).toHaveAttribute('href', 'https://example.com/specs');
  expect(screen.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', 'https://example.com/specs');
  expect(screen.getByRole('link', { name: 'Google Search suggestions' })).toHaveAttribute('href', 'https://www.google.com/search?q=Galaxy+A15');
  fireEvent.click(screen.getByRole('button', { name: /Apply 1 selected detail/ }));
  expect(onApply).toHaveBeenCalledWith([expect.objectContaining({ key: 'attributeValues.processor', value: 'Dimensity 6100+' })]);
  await waitFor(() => expect(screen.getByText(/Reviewed details added/)).toBeInTheDocument());
});

test('web specs from a newly identified phone category appear for review', async () => {
  api.get.mockResolvedValue({ enabled: true, webSupported: true });
  api.post.mockResolvedValue({ mode: 'web', suggestion: { category: 'phones', attributeValues: { processor: 'A19', dimensions: '147 x 72 x 8 mm' } }, fieldSources: {}, webSources: [], warnings: [] });
  render(<ProductSmartFill form={{ name: 'iPhone 17', images: [{ url: '/uploads/phone.webp' }], attributeValues: {} }} categories={[{ _id: 'phones', name: 'Smartphones', definitionKey: 'smartphones' }]} structure={{ attributes: [{ key: 'dimensions', label: 'Dimensions', type: 'text' }], categoryDefinitions: [{ key: 'smartphones', attributes: [{ key: 'processor', label: 'Processor', type: 'text' }] }] }} onApply={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Review suggestions');
  expect(screen.getByText('A19')).toBeInTheDocument();
  expect(screen.getByText('147 x 72 x 8 mm')).toBeInTheDocument();
});
