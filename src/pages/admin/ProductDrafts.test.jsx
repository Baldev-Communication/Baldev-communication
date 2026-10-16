import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductDrafts from './ProductDrafts';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), upload: jest.fn() }));
jest.mock('../../hooks/useDesktopFeedback', () => () => ({ notify: () => false }));
jest.mock('../../utils/catalogOptions', () => ({ fetchCategories: async () => [{ _id: 'cat', name: 'Sarees' }], fetchSubcategories: async () => [] }));

let mockQuery;
let mockSave;
let mockArchive;
let mockRestore;
let mockDelete;
let mockPublish;
let mockUpload;
jest.mock('../../store/apiSlice', () => ({
  useGetProductDraftsQuery: () => mockQuery,
  useUpdateProductDraftMutation: () => [mockSave, { isLoading: false }],
  useArchiveProductDraftMutation: () => [mockArchive, { isLoading: false }],
  useRestoreProductDraftMutation: () => [mockRestore, { isLoading: false }],
  useDeleteProductDraftMutation: () => [mockDelete, { isLoading: false }],
  usePublishSelectedDraftsMutation: () => [mockPublish, { isLoading: false }],
  useBulkUploadProductDraftsMutation: () => [mockUpload, { isLoading: false }],
}));

const draft = {
  _id: 'draft-a', name: 'Rose saree', category: { _id: 'cat', name: 'Sarees' },
  price: 1000, sellingPrice: 1000, originalPrice: 1200, stock: 2,
  sizes: [], colors: [], images: [{ url: '/uploads/a.jpg', primary: true }],
  sizingMode: 'free-size', revision: 2, status: 'draft', updatedAt: '2026-09-10T10:00:00.000Z',
  readiness: { state: 'review', score: 87, issues: [], warnings: ['Add packed weight'] },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  localStorage.clear();
  api.get.mockResolvedValue({ features: { sizing: false }, attributes: [] });
  mockQuery = {
    data: { data: [draft, { ...draft, _id: 'draft-b', name: 'Green saree' }], meta: { page: 1, total: 2, totalPages: 1, summary: { draft: 2, published: 0, archived: 0, incomplete: 0, ready: 0, review: 2 } } },
    isLoading: false, isFetching: false, refetch: jest.fn(),
  };
  mockSave = jest.fn(({ body }) => ({ unwrap: async () => ({ success: true, data: { ...body, _id: 'draft-a', revision: 3 } }) }));
  mockArchive = jest.fn(() => ({ unwrap: async () => ({ success: true }) }));
  mockRestore = jest.fn(() => ({ unwrap: async () => ({ success: true }) }));
  mockDelete = jest.fn(() => ({ unwrap: async () => ({ success: true }) }));
  mockPublish = jest.fn(() => ({ unwrap: async () => ({ success: true, message: 'Selected drafts published successfully', data: { results: [{ id: 'draft-a', status: 'published' }] } }) }));
  mockUpload = jest.fn(() => ({ unwrap: async () => ({ success: true, data: { drafts: [{}] } }) }));
});
afterEach(() => jest.restoreAllMocks());

test('opens a focused editor, applies reviewed Smart Fill values, and saves with revision protection', async () => {
  mockQuery.data.data = [{ ...draft, name: '', price: 0, sellingPrice: 0 }];
  api.post.mockResolvedValue({ mode: 'notes', suggestion: { name: 'Wine saree', price: 899, description: 'Wine saree with a floral border.' }, fieldSources: { price: { source: 'caption', quote: 'Price 899' } } });
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  fireEvent.change(screen.getByLabelText('Supplier notes or product details'), { target: { value: 'Name: Wine saree\nPrice: 899' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Review suggestions');
  fireEvent.click(screen.getByRole('button', { name: /Apply \d+ selected details?/ }));
  expect(screen.getByLabelText(/Product name/)).toHaveValue('Wine saree');
  fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
    id: 'draft-a', apiPrefix: '/admin', body: expect.objectContaining({ name: 'Wine saree', sellingPrice: 899, baseRevision: 2 }),
  })));
});

test('mobile-store draft content uses electronics wording and hides fashion fields', async () => {
  api.get.mockResolvedValue({ industry: 'mobile', features: { sizing: false }, attributes: [] });
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Content & SEO' }));
  expect(screen.getByLabelText('Use and care instructions')).toBeInTheDocument();
  expect(screen.queryByLabelText('Fabric / material')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Occasion')).not.toBeInTheDocument();
  await act(async () => { await Promise.resolve(); });
});

test('creating photo drafts can open the first draft and run Smart Fill immediately', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:photo');
  URL.revokeObjectURL = jest.fn();
  const created = { ...draft, _id: 'new-photo-draft', name: '', category: null, images: [{ url: '/uploads/new-photo.webp', primary: true }] };
  mockUpload.mockImplementation(() => ({ unwrap: async () => ({ success: true, data: { drafts: [created] } }) }));
  api.post.mockResolvedValue({ mode: 'ai', suggestion: { name: 'Apple iPhone 17' }, fieldSources: {} });
  render(<ProductDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'Create from photos' }));
  fireEvent.change(screen.getByLabelText(/Choose up to 30 product photos/), { target: { files: [new File(['photo'], 'phone.jpg', { type: 'image/jpeg' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create & start Smart Fill' }));
  await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ groupMode: 'single' })));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/products/smart-fill', expect.objectContaining({ imageUrls: ['/uploads/new-photo.webp'] }), expect.any(Object)));
  expect(screen.getByText('Review suggestions')).toBeInTheDocument();
});

test('invalid legacy Condition is visible as a choice and cannot repeatedly fail publication', async () => {
  api.get.mockResolvedValue({ features: { sizing: false }, attributes: [{ key: 'condition', label: 'Condition', type: 'dropdown', required: true, options: ['New', 'Refurbished', 'Used'] }] });
  mockQuery.data.data = [{ ...draft, attributeValues: { condition: 'Good' } }];
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  const condition = await screen.findByRole('combobox', { name: /Condition/ });
  expect(condition).toHaveValue('Good');
  expect(screen.getByText('Allowed: New, Refurbished, Used')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Save & publish/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid Condition');
  expect(condition).toHaveFocus();
  expect(mockPublish).not.toHaveBeenCalled();
  fireEvent.change(condition, { target: { value: 'Used' } });
  fireEvent.click(screen.getByRole('button', { name: /Save & publish/ }));
  await waitFor(() => expect(mockPublish).toHaveBeenCalled());
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ attributeValues: { condition: 'Used' } }) }));
});

test('bulk selection publishes through the structured batch endpoint and keeps failed rows selected', async () => {
  mockPublish.mockImplementation(() => ({ unwrap: async () => ({ success: true, message: '1 draft published; 1 needs attention.', data: { results: [{ id: 'draft-a', status: 'published' }, { id: 'draft-b', status: 'failed', message: 'Add price' }] } }) }));
  render(<ProductDrafts />);
  const boxes = await screen.findAllByRole('checkbox', { name: /Select .*saree/ });
  fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
  fireEvent.click(screen.getByRole('button', { name: /Publish selected/ }));
  await waitFor(() => expect(mockPublish).toHaveBeenCalledWith({ ids: ['draft-a', 'draft-b'], apiPrefix: '/admin' }));
  expect(await screen.findByRole('status')).toHaveTextContent('1 draft published; 1 needs attention.');
  expect(boxes[0]).not.toBeChecked();
  expect(boxes[1]).toBeChecked();
});

test('fills shared and per-product draft details in one bulk editor without mixing photos', async () => {
  render(<ProductDrafts />);
  const boxes = await screen.findAllByRole('checkbox', { name: /Select .*saree/ });
  fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Fill details together' }));
  const dialog = screen.getByRole('dialog', { name: 'Fill 2 drafts together' });
  const common = within(dialog).getByRole('region', { name: 'Details for all drafts' });
  fireEvent.change(within(common).getByLabelText('Brand'), { target: { value: 'Apple' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply to all rows' }));
  const first = within(dialog).getByRole('region', { name: 'Product 1' });
  const second = within(dialog).getByRole('region', { name: 'Product 2' });
  fireEvent.change(within(first).getByLabelText('Selling price'), { target: { value: '950' } });
  fireEvent.change(within(second).getByLabelText('Selling price'), { target: { value: '850' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save 2 drafts' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft-a', body: expect.objectContaining({ brand: 'Apple', sellingPrice: 950, images: draft.images, baseRevision: 2, saveMode: 'manual' }) }));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft-b', body: expect.objectContaining({ brand: 'Apple', sellingPrice: 850, images: draft.images, baseRevision: 2, saveMode: 'manual' }) }));
});

test('bulk editor exposes required category attributes and keeps failed draft rows for retry', async () => {
  api.get.mockResolvedValue({ features: { sizing: false }, attributes: [
    { key: 'condition', label: 'Condition', type: 'dropdown', required: true, options: ['New', 'Used'] },
    { key: 'storage', label: 'Storage', type: 'text', required: true },
  ] });
  mockSave.mockImplementation(({ id, body }) => ({ unwrap: async () => {
    if (id === 'draft-b' && mockSave.mock.calls.filter(([args]) => args.id === 'draft-b').length === 1) {
      throw { data: { code: 'DRAFT_STALE', message: 'Draft changed in another tab.' } };
    }
    return { success: true, data: { ...body, _id: id, revision: 3 } };
  } }));
  render(<ProductDrafts />);
  const boxes = await screen.findAllByRole('checkbox', { name: /Select .*saree/ });
  fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Fill details together' }));
  const dialog = screen.getByRole('dialog', { name: 'Fill 2 drafts together' });
  const rows = [within(dialog).getByRole('region', { name: 'Product 1' }), within(dialog).getByRole('region', { name: 'Product 2' })];
  rows.forEach((row, index) => {
    fireEvent.change(within(row).getByLabelText('Condition'), { target: { value: 'Used' } });
    fireEvent.change(within(row).getByLabelText('Storage'), { target: { value: index ? '128 GB' : '256 GB' } });
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save 2 drafts' }));
  await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('1 of 2 drafts saved'));
  expect(within(dialog).getByRole('button', { name: 'Save 1 draft' })).toBeEnabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save 1 draft' }));
  await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('1 of 1 draft saved'));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft-b', body: expect.objectContaining({ attributeValues: expect.objectContaining({ condition: 'Used', storage: '128 GB' }) }) }));
});

test('multiple photo drafts open the combined editor immediately after upload', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:photo');
  URL.revokeObjectURL = jest.fn();
  const created = [draft, { ...draft, _id: 'draft-b', name: 'Green saree' }];
  mockUpload.mockImplementation(() => ({ unwrap: async () => ({ success: true, data: { drafts: created } }) }));
  render(<ProductDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'Create from photos' }));
  fireEvent.click(screen.getByRole('radio', { name: 'One per photo' }));
  fireEvent.change(screen.getByLabelText(/Choose up to 30 product photos/), { target: { files: [
    new File(['one'], 'one.jpg', { type: 'image/jpeg' }), new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
  ] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create & fill all drafts' }));
  expect(await screen.findByRole('dialog', { name: 'Fill 2 drafts together' })).toBeInTheDocument();
});

test('archives an active draft instead of deleting it directly', async () => {
  render(<ProductDrafts />);
  const archiveButtons = await screen.findAllByRole('button', { name: 'Archive draft' });
  fireEvent.click(archiveButtons[0]);
  await waitFor(() => expect(mockArchive).toHaveBeenCalledWith({ id: 'draft-a', apiPrefix: '/admin' }));
  expect(screen.getByRole('status')).toHaveTextContent('Draft archived');
  expect(mockDelete).not.toHaveBeenCalled();
});

test('shows a stale-edit recovery action when another tab updated the draft', async () => {
  mockSave.mockImplementation(() => ({ unwrap: async () => { throw { data: { code: 'DRAFT_STALE', message: 'This draft changed in another tab.' } }; } }));
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: 'Changed name' } });
  fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
  expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('This draft changed');
});

test('archived drafts require typed confirmation before permanent deletion', async () => {
  const archived = { ...draft, status: 'archived', readiness: { state: 'archived', score: 0, issues: [], warnings: [] } };
  mockQuery.data = { data: [archived], meta: { page: 1, total: 1, totalPages: 1, summary: { draft: 0, published: 0, archived: 1 } } };
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const confirmation = screen.getByLabelText(/Type Rose saree to confirm/);
  expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
  fireEvent.change(confirmation, { target: { value: 'Rose saree' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 'draft-a', confirm: 'Rose saree', baseRevision: 2, apiPrefix: '/admin' }));
});

test('load errors keep retry available', async () => {
  mockQuery = { ...mockQuery, error: { data: { message: 'Draft database unavailable' } } };
  render(<ProductDrafts />);
  expect(screen.getByRole('alert')).toHaveTextContent('Draft database unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mockQuery.refetch).toHaveBeenCalledTimes(1);
  await screen.findByText('Rose saree');
});

test('draft queue count excludes published records and exposes separate published history', async () => {
  mockQuery.data.meta.summary = { draft: 2, published: 4, archived: 0 };
  render(<ProductDrafts />);
  expect(await screen.findByRole('button', { name: 'Drafts 2' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Published 4' }));
  expect(screen.getByRole('button', { name: 'Published 4' })).toHaveClass('is-active');
});

test('published draft cleanup explains product safety and requires typed confirmation', async () => {
  mockQuery.data = { data: [{ ...draft, status: 'published', publishedProductId: 'product-a' }], meta: { summary: { published: 1 } } };
  render(<ProductDrafts />);
  expect(await screen.findByRole('link', { name: 'Edit product' })).toHaveAttribute('href', '/admin/products/edit?id=product-a');
  fireEvent.click(screen.getByRole('button', { name: 'Remove draft' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('product, images and inventory remain unchanged');
  const button = screen.getByRole('button', { name: 'Delete permanently' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type Rose saree to confirm/), { target: { value: draft.name } });
  fireEvent.click(button);
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 'draft-a', confirm: draft.name, baseRevision: 2, apiPrefix: '/admin' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Its product is unchanged');
});

test('archived published draft history is also removable without restoring its product', async () => {
  mockQuery.data.data = [{ ...draft, status: 'archived', publishedProductId: 'product-a' }];
  render(<ProductDrafts />);
  expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mockDelete).not.toHaveBeenCalled();
});

test('published history does not offer an edit link to a permanently deleted product', async () => {
  mockQuery.data.data = [{ ...draft, status: 'published', publishedProductId: 'product-a', publishedProductDeleted: true }];
  render(<ProductDrafts />);
  expect(await screen.findByText('Product permanently removed')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit product' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove draft' })).toBeEnabled();
});
