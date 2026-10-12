import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  expect(await screen.findByRole('button', { name: 'Draft queue 2' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Published history 4' }));
  expect(screen.getByRole('button', { name: 'Published history 4' })).toHaveClass('is-active');
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
