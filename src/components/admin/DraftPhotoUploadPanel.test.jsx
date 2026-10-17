import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DraftPhotoUploadPanel from './DraftPhotoUploadPanel';

const categories = [{ _id: 'phones', name: 'Smartphones', definitionKey: 'smartphones' }];
const structure = { industry: 'mobile', attributes: [
  { key: 'brand', label: 'Brand', type: 'text' }, { key: 'model', label: 'Model', type: 'text' },
  { key: 'condition', label: 'Condition', type: 'dropdown', options: ['New', 'Used', 'Refurbished'] }, { key: 'warranty', label: 'Warranty period', type: 'text' },
], categoryDefinitions: [{ key: 'smartphones', attributes: [{ key: 'ram', label: 'RAM', type: 'dropdown', options: ['6', '8'] }, { key: 'storage', label: 'Storage', type: 'dropdown', options: ['128', '256'] }, { key: 'processor', label: 'Processor', type: 'text' }] }] };
let upload;
beforeEach(() => { URL.createObjectURL = jest.fn(file => 'blob:' + file.name); URL.revokeObjectURL = jest.fn(); upload = jest.fn(); });
const change = (region, label, value) => fireEvent.change(within(region).getByLabelText(label), { target: { value } });
function start(count = 4, mode = 'grouped', manual = true) {
  render(<DraftPhotoUploadPanel categories={categories} structure={structure} uploading={false} onUpload={upload} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/Choose up to 30 product photos/), { target: { files: Array.from({ length: count }, (_, index) => new File(['photo'], `photo-${index}.jpg`, { type: 'image/jpeg' })) } });
  fireEvent.click(screen.getByRole('radio', { name: mode === 'separate' ? 'One per photo' : 'Group by product' }));
  if (mode === 'grouped' && count > 2) {
    fireEvent.change(screen.getByLabelText('Product group for photo 3'), { target: { value: 'new' } });
    for (let index = 3; index < count; index++) fireEvent.change(screen.getByLabelText(`Product group for photo ${index + 1}`), { target: { value: '2' } });
  }
  if (manual) fireEvent.click(screen.getByRole('checkbox', { name: 'Add manual details before Smart Fill' }));
}
test('photo creation asks for identity first and defers commercial fields by default', () => {
  start(4, 'grouped', false);
  const first = screen.getByRole('region', { name: 'Product 1' });
  change(first, 'Category', 'phones'); change(first, 'Exact model', 'Apple iPhone 17'); change(first, 'Storage', '256');
  expect(within(first).queryByLabelText('Selling price')).not.toBeInTheDocument();
  expect(within(first).queryByLabelText('Stock quantity')).not.toBeInTheDocument();
  expect(within(first).queryByLabelText('Condition')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create & fill all drafts' }));
  expect(upload).toHaveBeenCalledWith(expect.objectContaining({ smartFill: true, photoGroups: [1, 1, 2, 2], groupDetails: expect.objectContaining({ 1: expect.objectContaining({ model: 'Apple iPhone 17', storage: '256' }) }) }));
});
test('all grouped products can receive manual sale, stock and detailed information before draft creation', () => {
  start();
  const first = screen.getByRole('region', { name: 'Product 1' }), second = screen.getByRole('region', { name: 'Product 2' });
  change(first, 'Category', 'phones'); change(first, 'Exact model', 'iPhone 17'); change(first, 'Selling price', '600'); change(first, 'MRP', '750'); change(first, 'Stock quantity', '1');
  change(second, 'Exact model', 'iPhone 16'); change(second, 'Selling price', '500'); change(second, 'MRP', '650'); change(second, 'Brand', 'My entered brand');
  const common = screen.getByRole('region', { name: 'Shared product details' });
  change(common, 'Category', 'phones'); change(common, 'Brand', 'Apple'); change(common, 'Condition', 'Used'); change(common, 'Warranty period', '6 months seller warranty'); change(common, 'Stock quantity', '0');
  fireEvent.click(within(common).getByRole('button', { name: 'Apply to all products' }));
  expect(within(second).getByLabelText('Brand')).toHaveValue('My entered brand'); expect(within(first).getByLabelText('Stock quantity')).toHaveValue(1);
  change(first, 'Storage', '256'); change(second, 'Storage', '128');
  fireEvent.click(within(first).getByText('Shipping & returns'));
  change(first, 'Packed weight (kg)', '0.5'); change(first, 'Packed length (cm)', '20'); change(first, 'Packed width (cm)', '10'); change(first, 'Packed height (cm)', '5');
  fireEvent.click(within(first).getByText('All specifications')); change(first, 'Processor', 'Manually confirmed processor');
  fireEvent.click(screen.getByRole('button', { name: 'Create drafts only' }));
  expect(upload).toHaveBeenCalledTimes(1);
  const request = upload.mock.calls[0][0];
  expect(request.photoGroups).toEqual([1, 1, 2, 2]); expect(request.files).toHaveLength(4);
  expect(request.groupDetails[1]).toEqual(expect.objectContaining({ sellingPrice: '600', originalPrice: '750', stock: '1', model: 'iPhone 17', storage: '256', condition: 'Used', warranty: '6 months seller warranty',
    packageDimensions: { lengthCm: '20', widthCm: '10', heightCm: '5' }, attributeValues: { processor: 'Manually confirmed processor' } }));
  expect(request.groupDetails[2]).toEqual(expect.objectContaining({ sellingPrice: '500', stock: '0', model: 'iPhone 16', storage: '128', brand: 'My entered brand' }));
});

test('removing and adding photos cannot move one-per-photo prices onto a different product', () => {
  start(3, 'separate');
  for (let index = 1; index <= 3; index++) change(screen.getByRole('region', { name: `Product ${index}` }), 'Selling price', String(index * 100));
  fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
  expect(within(screen.getByRole('region', { name: 'Product 1' })).getByLabelText('Selling price')).toHaveValue(200);
  fireEvent.change(screen.getByLabelText(/Choose up to 30 product photos/), { target: { files: [new File(['new'], 'new.jpg', { type: 'image/jpeg' })] } });
  expect(within(screen.getByRole('region', { name: 'Product 3' })).getByLabelText('Selling price')).toHaveValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Create drafts only' }));
  expect(upload.mock.calls[0][0].files.map(file => file.name)).toEqual(['photo-1.jpg', 'photo-2.jpg', 'new.jpg']);
  expect(upload.mock.calls[0][0].groupDetails).toEqual({ 1: { sellingPrice: '200' }, 2: { sellingPrice: '300' }, 3: {} });
});

test('switching grouping modes preserves each mode without copying prices into another product', () => {
  start(2, 'separate');
  change(screen.getByRole('region', { name: 'Product 2' }), 'Selling price', '200');
  fireEvent.click(screen.getByRole('radio', { name: 'One product' }));
  expect(within(screen.getByRole('region', { name: 'Product 1' })).getByLabelText('Selling price')).toHaveValue(null);
  change(screen.getByRole('region', { name: 'Product 1' }), 'Selling price', '350');
  fireEvent.click(screen.getByRole('radio', { name: 'One per photo' }));
  expect(within(screen.getByRole('region', { name: 'Product 2' })).getByLabelText('Selling price')).toHaveValue(200);
});

test('bad prices, fractional stock and incomplete parcel dimensions prevent the upload', () => {
  start(1);
  const product = screen.getByRole('region', { name: 'Product 1' });
  change(product, 'Selling price', '100'); change(product, 'MRP', '99');
  fireEvent.click(screen.getByRole('button', { name: 'Create drafts only' })); expect(screen.getByRole('alert')).toHaveTextContent('MRP must be at least');
  change(product, 'MRP', '150'); change(product, 'Stock quantity', '1.5');
  fireEvent.click(screen.getByRole('button', { name: 'Create drafts only' })); expect(screen.getByRole('alert')).toHaveTextContent('whole number');
  change(product, 'Stock quantity', '2'); fireEvent.click(within(product).getByText('Shipping & returns')); change(product, 'Packed length (cm)', '20');
  fireEvent.click(screen.getByRole('button', { name: 'Create drafts only' })); expect(screen.getByRole('alert')).toHaveTextContent('all three packed dimensions');
  expect(upload).not.toHaveBeenCalled();
});

test('shared details replace filled prices only when explicitly selected', () => {
  start(2, 'separate');
  const first = screen.getByRole('region', { name: 'Product 1' }); change(first, 'Selling price', '20');
  const common = screen.getByRole('region', { name: 'Shared product details' }); fireEvent.click(within(common).getByText('More shared details')); change(common, 'Selling price', '40');
  fireEvent.click(within(common).getByRole('button', { name: 'Apply to all products' })); expect(within(first).getByLabelText('Selling price')).toHaveValue(20);
  fireEvent.click(within(common).getByRole('checkbox', { name: 'Replace filled fields' })); fireEvent.click(within(common).getByRole('button', { name: 'Apply to all products' }));
  expect(within(first).getByLabelText('Selling price')).toHaveValue(40);
});

test('nine photos can become three drafts with four, three and two views', () => {
  render(<DraftPhotoUploadPanel categories={categories} structure={structure} uploading={false} onUpload={upload} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Group by product' }));
  const files = Array.from({ length: 9 }, (_, index) => new File(['photo'], `phone-${index + 1}.jpg`, { type: 'image/jpeg' }));
  fireEvent.change(screen.getByLabelText(/Choose up to 30 product photos/), { target: { files } });
  fireEvent.change(screen.getByLabelText('Product group for photo 5'), { target: { value: 'new' } });
  for (const index of [6, 7]) fireEvent.change(screen.getByLabelText(`Product group for photo ${index}`), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Product group for photo 8'), { target: { value: 'new' } });
  fireEvent.change(screen.getByLabelText('Product group for photo 9'), { target: { value: '3' } });
  const first = screen.getByRole('region', { name: 'Product 1' });
  change(first, 'Category', 'phones'); change(first, 'Exact model', 'Apple iPhone 17'); change(first, 'Storage', '256');
  fireEvent.click(screen.getByRole('button', { name: 'Create & fill all drafts' }));
  expect(upload).toHaveBeenCalledWith(expect.objectContaining({ groupMode: 'grouped', photoGroups: [1, 1, 1, 1, 2, 2, 2, 3, 3], smartFill: true,
    groupDetails: expect.objectContaining({ 1: expect.objectContaining({ model: 'Apple iPhone 17', storage: '256' }) }),
  }));
});

test('removed product group details do not leak into a replacement group', () => {
  render(<DraftPhotoUploadPanel categories={[]} structure={structure} uploading={false} onUpload={upload} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Group by product' }));
  const input = screen.getByLabelText(/Choose up to 30 product photos/);
  fireEvent.change(input, { target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })] } });
  fireEvent.change(screen.getByLabelText('Product group for photo 2'), { target: { value: 'new' } });
  change(screen.getByRole('region', { name: 'Product 2' }), 'Exact model', 'Old model');
  fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }));
  fireEvent.change(input, { target: { files: [new File(['c'], 'c.jpg', { type: 'image/jpeg' })] } });
  fireEvent.change(screen.getByLabelText('Product group for photo 2'), { target: { value: 'new' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create drafts only' }));
  expect(upload.mock.calls[0][0].groupDetails[2]).toEqual({});
});
