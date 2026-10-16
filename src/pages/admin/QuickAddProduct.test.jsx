import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuickAddProduct from './QuickAddProduct';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../components/admin/ImageUploader', () => ({ onChange }) => <><button type="button" onClick={() => onChange([{ url: 'https://media.example/rose.jpg', originalName: 'rose-saree.jpg' }])}>Upload test photo</button><button type="button" onClick={() => onChange([])}>Remove photos</button></>);
let configuration;
beforeEach(() => {
  jest.clearAllMocks();
  configuration = { features: { sizing: true }, attributes: [] };
  api.get.mockImplementation(async path => path === '/catalog-configuration' ? configuration : path.includes('/categories') ? [{ _id: 'sarees', name: 'Sarees' }, { _id: 'tops', name: 'Tops' }] : path.includes('/status') ? { enabled: false } : []);
  api.post.mockResolvedValue({ _id: 'created-product', name: 'Rose saree' });
});
async function fillBasic() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Looks good, add product' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Upload test photo' }));
  fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: 'Rose saree' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sarees', exact: true }));
  fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '999' } });
  fireEvent.change(screen.getByLabelText(/Stock/), { target: { value: '2' } });
  await act(() => Promise.resolve());
}

test('Quick Add Smart Fill keeps supported suggestions editable and persists them in the product payload', async () => {
  api.post.mockImplementation(async path => path.endsWith('/smart-fill') ? { mode: 'notes', suggestion: { name: 'Reviewed wine saree', price: 899, fabric: 'Georgette', highlights: ['Embroidered border'], description: 'An embroidered georgette saree.' }, fieldSources: { price: { source: 'caption', quote: 'Price: 899' } } } : { _id: 'created-product' });
  render(<QuickAddProduct />); await fillBasic();
  fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/ }));
  fireEvent.change(screen.getByLabelText('Supplier notes or product details'), { target: { value: 'Name: Wine saree\nPrice: 899\nFabric: Georgette' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Review suggestions');
  fireEvent.click(screen.getByRole('button', { name: /Apply \d+ selected details/ }));
  expect(screen.getByLabelText(/Product name/)).toHaveValue('Rose saree');
  expect(screen.getByLabelText(/Selling price/)).toHaveValue(899);
  expect(screen.getByLabelText('Highlights')).toHaveValue('Embroidered border');
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/products', expect.objectContaining({ name: 'Rose saree', price: 899, stock: 2, fabric: 'Georgette', highlights: ['Embroidered border'] })));
});
test('quick add saves reviewed free-size details and can reset for another product', async () => {
  render(<QuickAddProduct />); await fillBasic();
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/products', expect.objectContaining({ name: 'Rose saree', price: 999, stock: 2, sizingMode: 'free-size', sizes: [] })));
  expect(await screen.findByRole('link', { name: 'View Product' })).toHaveAttribute('href', '/admin/products/edit?id=created-product');
  fireEvent.click(screen.getByRole('button', { name: 'Add Another' }));
  await act(() => Promise.resolve());
  expect(screen.getByLabelText(/Product name/)).toHaveValue('');
  expect(screen.getByLabelText(/Stock/)).toHaveValue(null);
});
test('failed product create preserves all reviewed fields for retry', async () => {
  api.post.mockRejectedValueOnce(new Error('Inventory unavailable'));
  render(<QuickAddProduct />); await fillBasic();
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  expect(await screen.findByText('Inventory unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText(/Product name/)).toHaveValue('Rose saree');
  expect(screen.getByLabelText(/Stock/)).toHaveValue(2);
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  expect(await screen.findByRole('heading', { name: 'Product added' })).toBeInTheDocument();
});
test('configured required attributes must be entered and persist in the product payload', async () => {
  configuration = { features: { sizing: false }, attributes: [{ key: 'material', label: 'Material', required: true }] };
  render(<QuickAddProduct />); await fillBasic();
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  expect(screen.getByText('Enter Material')).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Material/), { target: { value: 'Cotton' } });
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/products', expect.objectContaining({ attributeValues: { material: 'Cotton' } })));
});

test('mobile-store Quick Add renders and saves category-specific charger specifications', async () => {
  configuration = { industry: 'mobile', features: { sizing: false }, attributes: [{ key: 'model', label: 'Model', type: 'text' }], categoryDefinitions: [{ key: 'chargers', attributes: [
    { key: 'charger_type', label: 'Charger type', type: 'dropdown', required: true, options: ['Wall charger', 'Car charger'] },
    { key: 'output_power', label: 'Output power', type: 'measurement', unit: 'W', required: true },
  ] }] };
  api.get.mockImplementation(async path => path === '/catalog-configuration' ? configuration : path.includes('/categories') ? [{ _id: 'charger', name: 'Chargers', definitionKey: 'chargers' }] : path.includes('/status') ? { enabled: false } : []);
  render(<QuickAddProduct />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Looks good, add product' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Upload test photo' }));
  fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: 'Samsung EP-T2510 Charger' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chargers', exact: true }));
  fireEvent.change(screen.getByLabelText(/^Model/), { target: { value: 'EP-T2510' } });
  fireEvent.change(screen.getByLabelText(/^Charger type/), { target: { value: 'Wall charger' } });
  fireEvent.change(screen.getByLabelText(/^Output power/), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '999' } });
  fireEvent.change(screen.getByLabelText(/Stock/), { target: { value: '2' } });
  expect(screen.queryByLabelText('Fabric')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Occasion')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Looks good, add product' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/products', expect.objectContaining({ category: 'charger', attributeValues: expect.objectContaining({ model: 'EP-T2510', charger_type: 'Wall charger', output_power: '25' }) })));
});

const phoneConfiguration = { industry: 'mobile', features: { sizing: false }, attributes: [{ key: 'model', label: 'Model', type: 'text' }], categoryDefinitions: [{ key: 'smartphones', attributes: [
  { key: 'processor', label: 'Processor', type: 'text' }, { key: 'dimensions', label: 'Device dimensions', type: 'text' }, { key: 'warranty', label: 'Warranty period', type: 'text' },
] }] };
function configurePhonePhotoAI() {
  api.get.mockImplementation(async path => path === '/catalog-configuration' ? phoneConfiguration : path.includes('/categories') ? [{ _id: 'phones', name: 'Smartphones', definitionKey: 'smartphones' }] : path.includes('/status') ? { enabled: true, webSupported: true } : []);
}
test('technology Quick Add photo analysis fetches and fills cited specifications through shared Smart Fill', async () => {
  configurePhonePhotoAI(); localStorage.removeItem('baldev_product_ai_provider');
  const source = { source: 'web', url: 'https://manufacturer.example/phone', title: 'Official phone specifications' };
  api.post.mockImplementation(async path => path.endsWith('/smart-fill') ? { mode: 'web', provider: 'gemini',
    suggestion: { name: 'Apple iPhone 15', category: 'phones', attributeValues: { model: 'iPhone 15', processor: 'A16 Bionic', dimensions: '147.6 x 71.6 x 7.8 mm', warranty: '1 year' } },
    fieldSources: Object.fromEntries(['model', 'processor', 'dimensions', 'warranty'].map(key => ['attribute.' + key, { ...source, ...(key === 'warranty' ? { reviewRequired: true } : {}) }])),
    webSources: [{ url: source.url, title: source.title }], specificationLookup: { status: 'completed', fieldCount: 4 }, warnings: [],
  } : { _id: 'created-phone' });
  render(<QuickAddProduct />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Looks good, add product' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Upload test photo' }));
  await waitFor(() => expect(screen.getByLabelText(/^Processor/)).toHaveValue('A16 Bionic'));
  expect(screen.getByLabelText(/^Device dimensions/)).toHaveValue('147.6 x 71.6 x 7.8 mm');
  expect(screen.getByLabelText(/^Warranty period/)).toHaveValue('');
  expect(screen.getByLabelText(/Selling price/)).toHaveValue(null); expect(screen.getByLabelText(/Stock/)).toHaveValue(null);
  expect(screen.getByRole('link', { name: 'Official phone specifications' })).toHaveAttribute('href', source.url);
  expect(api.post).toHaveBeenCalledWith('/admin/products/smart-fill', expect.objectContaining({ provider: 'gemini', webSearch: true }), expect.any(Object));
  expect(api.post.mock.calls.some(call => call[0].includes('quick-analyze'))).toBe(false);
  fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '30000' } });
  fireEvent.change(screen.getByLabelText(/Stock/), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/products', expect.objectContaining({ attributeValues: expect.objectContaining({ model: 'iPhone 15', processor: 'A16 Bionic' }) })));
});

test('technology photo lookup clearly reports exhausted Gemini quota without pretending to fill specs', async () => {
  configurePhonePhotoAI();
  const message = 'The Gemini quota is currently exhausted.';
  api.post.mockResolvedValue({ mode: 'notes', suggestion: {}, warnings: [message], specificationLookup: { status: 'failed', code: 'AI_QUOTA_EXCEEDED', fieldCount: 0, message } });
  render(<QuickAddProduct />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Looks good, add product' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Upload test photo' }));
  expect(await screen.findByText('Specifications were not fetched: ' + message)).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Smartphones', exact: true })));
  expect(screen.getByLabelText(/^Processor/)).toHaveValue('');
  expect(api.post).toHaveBeenCalledTimes(1);
});
test('sized products can complete their real size chart without leaving Quick Add', async () => {
  render(<QuickAddProduct />); await fillBasic();
  fireEvent.click(screen.getByRole('button', { name: 'Tops', exact: true }));
  fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: 'Rose cotton top' } });
  fireEvent.change(screen.getByLabelText('Sizing'), { target: { value: 'sized' } });
  fireEvent.change(screen.getByLabelText(/Available sizes/), { target: { value: 'M' } });
  await act(() => Promise.resolve());
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Complete the available sizes');
  expect(api.post).not.toHaveBeenCalled();
  for (const input of screen.getAllByRole('spinbutton').filter(item => item.getAttribute('aria-label')?.startsWith('M '))) fireEvent.change(input, { target: { value: '36' } });
  fireEvent.click(screen.getByRole('button', { name: 'Looks good, add product' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/products', expect.objectContaining({ sizingMode: 'sized', sizes: ['M'], sizeChart: expect.objectContaining({ rows: [expect.objectContaining({ size: 'M', chest: 36 })] }) })));
});
test('configuration failures disable creation until a successful retry', async () => {
  const normal = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/catalog-configuration' ? Promise.reject(new Error('Catalog unavailable')) : normal(path));
  render(<QuickAddProduct />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable');
  expect(screen.getByRole('button', { name: 'Looks good, add product' })).toBeDisabled();
  api.get.mockImplementation(normal);
  fireEvent.click(screen.getByRole('button', { name: 'Retry product options' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Looks good, add product' })).toBeEnabled());
});
test('removed media invalidates an in-flight photo analysis', async () => {
  const normal = api.get.getMockImplementation();
  api.get.mockImplementation(path => path.includes('/status') ? Promise.resolve({ enabled: true }) : normal(path));
  let finish;
  api.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<QuickAddProduct />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Looks good, add product' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Upload test photo' }));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Remove photos' }));
  await act(async () => { finish({ enabled: true, suggestion: { name: 'Stale outfit', category: 'Sarees' } }); });
  expect(screen.getByLabelText(/Product name/)).toHaveValue('');
});
