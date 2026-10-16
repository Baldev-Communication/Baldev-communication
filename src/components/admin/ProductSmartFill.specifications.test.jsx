import { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductSmartFill from './ProductSmartFill';
import { applySmartPatch } from '../../utils/productSmartFill';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const source = { source: 'web', url: 'https://manufacturer.example/iphone', title: 'Official specifications' };
const structure = { industry: 'mobile', features: { sizing: false }, attributes: [
  { key: 'brand', label: 'Brand', type: 'text' }, { key: 'model', label: 'Model', type: 'text' },
  { key: 'processor', label: 'Processor', type: 'text' }, { key: 'dimensions', label: 'Device dimensions', type: 'text' },
  { key: 'warranty', label: 'Warranty period', type: 'text' },
] };
const result = { provider: 'gemini', mode: 'web', suggestion: { brand: 'Apple', attributeValues: { brand: 'Apple', model: 'iPhone 15', processor: 'A16 Bionic', dimensions: '147.6 x 71.6 x 7.8 mm', warranty: '1 year' } },
  fieldSources: { brand: source, ...Object.fromEntries(['brand', 'model', 'processor', 'dimensions'].map(key => ['attribute.' + key, { ...source, quote: key + ': cited value' }])),
    'attribute.warranty': { ...source, reviewRequired: true, quote: 'Manufacturer warranty: 1 year' },
  }, webSources: [{ url: source.url, title: source.title }], warnings: [], specificationLookup: { status: 'completed', fieldCount: 5 },
};

function Editor({ initial = {}, onFill = jest.fn() }) {
  const [form, setForm] = useState({ name: 'Apple iPhone 15 128 GB', category: 'phones', brand: 'Baldev Communication', price: '', stock: '', attributeValues: {}, ...initial });
  return <>
    <label>Form name<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
    <label>Form category<input value={form.category} readOnly /></label>
    {['processor', 'dimensions', 'warranty'].map(key => <label key={key}>{'Form ' + key}<input value={form.attributeValues[key] || ''} onChange={event => setForm(current => ({ ...current, attributeValues: { ...current.attributeValues, [key]: event.target.value } }))} /></label>)}
    <label>Form price<input value={form.price} readOnly /></label><label>Form stock<input value={form.stock} readOnly /></label>
    <ProductSmartFill form={form} categories={[{ _id: 'phones', name: 'Smartphones' }]} structure={structure} onApply={(patch, undo) => { onFill(patch, undo); setForm(current => applySmartPatch(current, patch, undo)); }} />
  </>;
}
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); api.get.mockResolvedValue({ enabled: true, webSupported: true }); api.post.mockResolvedValue(result); });
afterEach(() => localStorage.clear());
async function start() {
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Generate with' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
}

test('verified mobile specifications fill real form fields automatically and support safe undo', async () => {
  render(<Editor />); await start();
  await waitFor(() => expect(screen.getByLabelText('Form processor')).toHaveValue('A16 Bionic'));
  expect(screen.getByLabelText('Form dimensions')).toHaveValue('147.6 x 71.6 x 7.8 mm');
  expect(screen.getByLabelText('Form warranty')).toHaveValue('');
  expect(screen.getByLabelText('Form price')).toHaveValue(''); expect(screen.getByLabelText('Form stock')).toHaveValue('');
  expect(screen.getByText(/4 verified specifications filled/)).toBeInTheDocument();
  expect(screen.queryByText(/Your AI choice, photos or product details changed/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Official specifications' })).toHaveAttribute('href', source.url);
  fireEvent.change(screen.getByLabelText('Form dimensions'), { target: { value: 'Manually confirmed dimensions' } });
  fireEvent.click(screen.getByRole('button', { name: 'Undo last fill' }));
  expect(screen.getByLabelText('Form processor')).toHaveValue('');
  expect(screen.getByLabelText('Form dimensions')).toHaveValue('Manually confirmed dimensions');
});

test('users can turn automatic specifications off and keep the review workflow', async () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Automatically fill verified specifications into empty fields' }));
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Review suggestions');
  expect(screen.getByLabelText('Form processor')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: /Apply \d+ selected details/ }));
  expect(screen.getByLabelText('Form processor')).toHaveValue('A16 Bionic');
  expect(screen.getByLabelText('Form warranty')).toHaveValue('');
});

test('a verified inferred category and its specifications can fill together', async () => {
  api.post.mockResolvedValue({ ...result, suggestion: { ...result.suggestion, category: 'phones' }, fieldSources: { ...result.fieldSources, category: source } });
  render(<Editor initial={{ category: '' }} />); await start();
  await waitFor(() => expect(screen.getByLabelText('Form processor')).toHaveValue('A16 Bionic'));
  expect(screen.getByLabelText('Form category')).toHaveValue('phones');
  expect(screen.queryByText(/Your AI choice, photos or product details changed/)).not.toBeInTheDocument();
});

test('changing the model during generation prevents automatic specification changes', async () => {
  let finish; api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const onFill = jest.fn(); render(<Editor onFill={onFill} />); await start();
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Form name'), { target: { value: 'Apple iPhone 15 Pro' } });
  finish(result);
  await screen.findByText(/Your AI choice, photos or product details changed/);
  expect(screen.getByLabelText('Form processor')).toHaveValue(''); expect(onFill).not.toHaveBeenCalled();
});

test('quota failures clearly explain why specifications were not fetched', async () => {
  const message = 'The Gemini quota is currently exhausted. Check API billing.';
  api.post.mockResolvedValue({ provider: 'gemini', mode: 'notes', suggestion: { name: 'iPhone 15' }, warnings: [message], specificationLookup: { status: 'failed', code: 'AI_QUOTA_EXCEEDED', fieldCount: 0, message } });
  const onFill = jest.fn(); render(<Editor onFill={onFill} />); await start();
  expect(await screen.findByRole('alert')).toHaveTextContent('Specifications were not fetched: ' + message);
  expect(screen.getAllByText(/quota is currently exhausted/)).toHaveLength(1);
  expect(screen.getByLabelText('Form processor')).toHaveValue(''); expect(onFill).not.toHaveBeenCalled();
});
