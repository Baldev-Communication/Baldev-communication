import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DraftBulkEditor from './DraftBulkEditor';
import api from '../../services/api';
import { getMobileLoaderSnapshot } from '../../utils/mobileLoader';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const categories = [{ _id: 'phones', name: 'Phones' }];
const structure = { industry: 'mobile', features: { sizing: false }, attributes: [
  { key: 'brand', label: 'Brand', type: 'text', required: true },
  { key: 'model', label: 'Model', type: 'text', required: true },
  { key: 'condition', label: 'Condition', type: 'dropdown', required: true, options: ['New', 'Used'] },
  { key: 'warranty', label: 'Warranty period', type: 'text', required: true },
  { key: 'processor', label: 'Processor', type: 'text' },
  { key: 'dimensions', label: 'Device dimensions', type: 'text' },
  { key: 'battery', label: 'Battery', type: 'number', unit: 'mAh' },
] };
const source = { source: 'web', url: 'https://manufacturer.example/specs', title: 'Manufacturer specifications' };
const draft = (id, count = 2) => ({ _id: id, name: '', category: 'phones', revision: 2, attributeValues: { model: `Phone ${id}` },
  images: Array.from({ length: count }, (_, index) => ({ url: `/uploads/${id}-${index}.webp`, primary: index === 0 })) });
const response = model => ({ provider: 'gemini', mode: 'web', specificationLookup: { status: 'completed', fieldCount: 5 },
  suggestion: { name: `Acme ${model}`, brand: 'Acme', price: 5, originalPrice: 10, stock: 999,
    description: `${model}. Verified processor and dimensions.`, shortDescription: 'Verified product details', warranty: '1 year',
    packageDimensions: { lengthCm: 1, widthCm: 2, heightCm: 3 }, shippingWeightKg: 1,
    attributeValues: { brand: 'Acme', processor: `${model} CPU`, battery: '5000', dimensions: '150 x 72 x 8 mm', condition: 'New', warranty: '1 year' } },
  fieldSources: { brand: source, name: source, price: { source: 'caption' }, originalPrice: { source: 'caption' },
    description: { source: 'web' }, ...Object.fromEntries(['brand', 'processor', 'battery', 'dimensions', 'condition'].map(key => [`attribute.${key}`, source])),
    warranty: { ...source, reviewRequired: true }, 'attribute.warranty': { ...source, reviewRequired: true, note: 'Confirm actual coverage.' } }, webSources: [source], warnings: [] });
let onSave;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  api.get.mockResolvedValue({ enabled: true, providers: [{ id: 'gemini', label: 'Gemini', enabled: true }, { id: 'openai', label: 'ChatGPT', enabled: true }] });
  api.post.mockImplementation(async (_url, body) => response(body.existing.attributeValues.model));
  onSave = jest.fn(async row => ({ ...row, revision: 3 }));
});
function open(drafts, props = {}) { return render(<DraftBulkEditor drafts={drafts} categories={categories} structure={structure} onSave={onSave} onClose={jest.fn()} smartFillFirst {...props} />); }

test('all grouped products run sequential internet AI before manual fields and save their own specs and photos', async () => {
  let finishFirst;
  api.post.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
  const first = { ...draft('a', 4), brand: 'Entered brand', attributeValues: { model: 'Phone a', processor: 'Entered CPU' } };
  open([first, draft('b', 3)]);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(screen.queryByLabelText('Selling price')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Fetching product 1 of 2');
  expect(getMobileLoaderSnapshot()).toBe(false);
  await act(async () => finishFirst(response('Phone a')));
  await screen.findByText('2 · Review & complete remaining details');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenNthCalledWith(1, '/admin/products/smart-fill', expect.objectContaining({ webSearch: true, imageUrls: first.images.map(image => image.url) }), expect.any(Object));
  expect(api.post).toHaveBeenNthCalledWith(2, '/admin/products/smart-fill', expect.objectContaining({ imageUrls: draft('b', 3).images.map(image => image.url) }), expect.any(Object));
  expect(getMobileLoaderSnapshot()).toBe(false);
  const rows = ['Product 1', 'Product 2'].map(name => screen.getByRole('region', { name }));
  expect(within(rows[0]).getByLabelText('Brand')).toHaveValue('Entered brand');
  for (const [index, row] of rows.entries()) {
    expect(within(row).getByLabelText('Selling price')).toHaveValue(null);
    expect(within(row).getByLabelText('Stock')).toHaveValue(null);
    expect(within(row).getByLabelText('Condition')).toHaveValue('');
    expect(within(row).getByLabelText('Warranty period')).toHaveValue('');
    fireEvent.click(within(row).getByText('All specifications'));
    expect(within(row).getByLabelText('Processor')).toHaveValue(index ? 'Phone b CPU' : 'Entered CPU');
    expect(within(row).getByLabelText('Device dimensions')).toHaveValue('150 x 72 x 8 mm');
    fireEvent.change(within(row).getByLabelText('Selling price'), { target: { value: String(100 + index) } });
    fireEvent.change(within(row).getByLabelText('MRP'), { target: { value: '200' } });
    fireEvent.change(within(row).getByLabelText('Stock'), { target: { value: '1' } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save 2 drafts' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({ _id: 'a', revision: 2, images: first.images, brand: 'Entered brand', sellingPrice: '100', attributeValues: expect.objectContaining({ processor: 'Entered CPU', dimensions: '150 x 72 x 8 mm' }) }));
  expect(onSave.mock.calls[1][0].images).toEqual(draft('b', 3).images);
  expect(onSave.mock.calls[1][0].packageDimensions).toBeUndefined();
});

test('provider preference uses the seller endpoint and warranty is applied only after confirmation', async () => {
  localStorage.setItem('baldev_product_ai_provider', 'openai');
  open([draft('a')], { apiPrefix: '/seller' });
  await screen.findByText('2 · Review & complete remaining details');
  expect(api.post).toHaveBeenCalledWith('/seller/products/smart-fill', expect.objectContaining({ provider: 'openai', webSearch: true }), expect.any(Object));
  const row = screen.getByRole('region', { name: 'Product 1' });
  fireEvent.click(within(row).getByText(/Review AI results & sources/));
  expect(within(row).getByRole('link', { name: 'Manufacturer specifications' })).toHaveAttribute('href', source.url);
  fireEvent.click(within(row).getByRole('checkbox', { name: /Confirm Warranty period/ }));
  fireEvent.click(within(row).getByRole('button', { name: 'Apply confirmed details' }));
  expect(within(row).getByLabelText('Warranty period')).toHaveValue('1 year');
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(within(row).getByLabelText('Warranty period'), { target: { value: '6 months seller warranty' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 draft' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ warranty: '6 months seller warranty', attributeValues: expect.objectContaining({ warranty: '6 months seller warranty' }) })));
});

test('quota failure stops the queue, exposes manual completion and retries only unfinished drafts', async () => {
  api.post.mockImplementationOnce(async () => response('Phone a'))
    .mockRejectedValueOnce(Object.assign(new Error('AI quota exhausted. Retry later.'), { status: 429, code: 'AI_QUOTA_EXCEEDED' }));
  open([draft('a'), draft('b'), draft('c')]);
  await screen.findByText('2 · Review & complete remaining details');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent('AI quota exhausted');
  expect(screen.getAllByLabelText('Selling price')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Review / retry Smart Fill' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fetch remaining details' }));
  await screen.findByText('2 · Review & complete remaining details');
  expect(api.post).toHaveBeenCalledTimes(4);
  expect(api.post.mock.calls.slice(2).map(([, body]) => body.existing.attributeValues.model)).toEqual(['Phone b', 'Phone c']);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('cancelling AI protects grouped images and allows manual completion without a second request', async () => {
  api.post.mockImplementation((_url, _body, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true });
  }));
  open([draft('a', 4), draft('b', 3)]);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Smart Fill' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel Smart Fill' })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Continue to manual details' }));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('region', { name: 'Product 1' })).toHaveTextContent('4 photos');
  expect(screen.getByRole('region', { name: 'Product 2' })).toHaveTextContent('3 photos');
  expect(getMobileLoaderSnapshot()).toBe(false);
});

test('availability errors offer a working retry and never hide the manual fallback', async () => {
  api.get.mockRejectedValueOnce(new Error('Connection failed'));
  open([draft('a')]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry availability' }));
  await screen.findByText('2 · Review & complete remaining details');
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('legacy empty parcel defaults remain saveable and partial parcel dimensions are rejected', async () => {
  open([{ ...draft('a'), packageDimensions: { lengthCm: 0, widthCm: 0, heightCm: 0 } }], { smartFillFirst: false });
  const product = screen.getByRole('region', { name: 'Product 1' });
  fireEvent.change(within(product).getByLabelText('Product name'), { target: { value: 'Updated phone' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 draft' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  fireEvent.click(within(product).getByText('Shipping & returns'));
  fireEvent.change(within(product).getByLabelText('Packed length (cm)'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 draft' }));
  expect(await screen.findByRole('status')).toHaveTextContent('all three packed dimensions');
  expect(onSave).toHaveBeenCalledTimes(1);
});

test('a quota failure returned inside a successful API response also stops the batch', async () => {
  api.post.mockResolvedValueOnce({ suggestion: {}, specificationLookup: { status: 'failed', code: 'AI_QUOTA_EXCEEDED', message: 'Provider quota exhausted.' }, warnings: ['Provider quota exhausted.'] });
  open([draft('a'), draft('b')]);
  await screen.findByText('2 · Review & complete remaining details');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Provider quota exhausted.')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Selling price')).toHaveLength(2);
});

test('a large batch waits under the request limit and can cancel the queued wait', async () => {
  jest.useFakeTimers();
  try {
    open(Array.from({ length: 12 }, (_, index) => draft(String(index))));
    await screen.findByText('Waiting for the next AI slot · 11 of 12');
    expect(api.post).toHaveBeenCalledTimes(10);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Smart Fill' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel Smart Fill' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Continue to manual details' }));
    expect(screen.getAllByLabelText('Selling price')).toHaveLength(12);
    expect(api.post).toHaveBeenCalledTimes(10);
    expect(getMobileLoaderSnapshot()).toBe(false);
  } finally { jest.useRealTimers(); }
});
