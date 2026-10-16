import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductSmartFill from './ProductSmartFill';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));

const both = { enabled: true, webSupported: true, defaultProvider: 'gemini', providers: [
  { id: 'gemini', label: 'Gemini', enabled: true, webSupported: true },
  { id: 'openai', label: 'ChatGPT', enabled: true, webSupported: true },
] };
const suggestion = { provider: 'openai', mode: 'web', suggestion: { attributeValues: { processor: 'A16 Bionic' } },
  fieldSources: { 'attribute.processor': { source: 'web', quote: 'processor: A16 Bionic', url: 'https://manufacturer.example/specs' } },
  webSources: [{ url: 'https://manufacturer.example/specs', title: 'Official specifications' }], warnings: [],
};
const props = { form: { name: 'iPhone 15 128 GB', attributeValues: {} }, categories: [],
  structure: { attributes: [{ key: 'processor', label: 'Processor', type: 'text' }] }, onApply: jest.fn(),
};
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); api.get.mockResolvedValue(both); api.post.mockResolvedValue(suggestion); });
afterEach(() => localStorage.clear());

async function open() {
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  const select = screen.getByRole('combobox', { name: 'Generate with' });
  await waitFor(() => expect(select).toBeEnabled());
  return select;
}

test('user chooses ChatGPT for web generation and reviews its cited suggestions', async () => {
  const onApply = jest.fn(); render(<ProductSmartFill {...props} onApply={onApply} apiPrefix="/seller" />);
  const select = await open();
  fireEvent.change(select, { target: { value: 'openai' } });
  expect(screen.getByRole('checkbox', { name: /Search the internet/ })).toHaveAccessibleName(/with ChatGPT/);
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('ChatGPT · Verified web specs');
  expect(api.post).toHaveBeenCalledWith('/seller/products/smart-fill', expect.objectContaining({ provider: 'openai', webSearch: true }), expect.any(Object));
  expect(screen.getByRole('link', { name: 'Official specifications' })).toHaveAttribute('href', 'https://manufacturer.example/specs');
  expect(localStorage.getItem('baldev_product_ai_provider')).toBe('openai');
  fireEvent.click(screen.getByRole('button', { name: /Apply 1 selected detail/ }));
  expect(onApply).toHaveBeenCalledWith([expect.objectContaining({ key: 'attributeValues.processor', value: 'A16 Bionic' })]);
});

test('changing the AI provider makes the previous preview stale until generation runs again', async () => {
  render(<ProductSmartFill {...props} />);
  const select = await open(); fireEvent.change(select, { target: { value: 'openai' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('ChatGPT · Verified web specs');
  fireEvent.change(select, { target: { value: 'gemini' } });
  expect(screen.getByText(/Your AI choice, photos or product details changed/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Apply.*selected details/ })).toBeDisabled();
  expect(api.post).toHaveBeenCalledTimes(1);
  api.post.mockResolvedValue({ ...suggestion, provider: 'gemini' });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Gemini · Verified web specs');
  expect(api.post.mock.calls[1][1].provider).toBe('gemini');
});

test('auto-start waits for availability and uses the saved ChatGPT choice for draft photos', async () => {
  localStorage.setItem('baldev_product_ai_provider', 'openai');
  let resolveStatus; api.get.mockReturnValue(new Promise(resolve => { resolveStatus = resolve; }));
  const images = Array.from({ length: 4 }, (_, index) => `/uploads/photo-${index}.webp`);
  render(<ProductSmartFill {...props} form={{ ...props.form, images }} autoStart />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => resolveStatus(both));
  await screen.findByText('Review suggestions');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][1]).toEqual(expect.objectContaining({ provider: 'openai', imageUrls: images }));
});

test('unconfigured providers are disabled and OpenAI-only installations default to ChatGPT', async () => {
  api.get.mockResolvedValue({ ...both, defaultProvider: 'openai', providers: both.providers.map(item => ({ ...item, enabled: item.id === 'openai', webSupported: item.id === 'openai' })) });
  render(<ProductSmartFill {...props} />);
  const select = await open();
  expect(select).toHaveValue('openai');
  expect(screen.getByRole('option', { name: 'Gemini · Not configured' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Review suggestions');
  expect(api.post.mock.calls[0][1].provider).toBe('openai');
});

test('a ChatGPT failure is visible and Gemini is used only after the user selects and retries', async () => {
  api.post.mockRejectedValueOnce(new Error('ChatGPT reached its API quota.'));
  render(<ProductSmartFill {...props} />);
  const select = await open(); fireEvent.change(select, { target: { value: 'openai' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('ChatGPT reached its API quota.');
  expect(select).toHaveValue('openai'); expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.change(select, { target: { value: 'gemini' } });
  api.post.mockResolvedValue({ ...suggestion, provider: 'gemini' });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Gemini · Verified web specs');
  expect(api.post.mock.calls.map(call => call[1].provider)).toEqual(['openai', 'gemini']);
});

test('notes-only parsing remains available when neither provider is configured', async () => {
  api.get.mockResolvedValue({ enabled: false, webSupported: false, providers: both.providers.map(item => ({ ...item, enabled: false, webSupported: false })) });
  api.post.mockResolvedValue({ mode: 'notes', suggestion: {}, warnings: ['Photo AI is not configured.'] });
  render(<ProductSmartFill {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  await screen.findByText(/AI is not configured. You can still fill explicitly stated details/);
  expect(screen.getByRole('combobox', { name: 'Generate with' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('From your notes');
  expect(api.post.mock.calls[0][1]).not.toHaveProperty('provider');
});
