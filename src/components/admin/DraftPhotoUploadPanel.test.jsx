import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import DraftPhotoUploadPanel from './DraftPhotoUploadPanel';

beforeEach(() => {
  URL.createObjectURL = jest.fn(file => `blob:${file.name}`);
  URL.revokeObjectURL = jest.fn();
});

test('nine photos can become three drafts with four, three and two views', () => {
  const onUpload = jest.fn();
  render(<DraftPhotoUploadPanel categories={[{ _id: '0123456789abcdef01234567', name: 'Smartphones' }]} uploading={false} onUpload={onUpload} onClose={jest.fn()} />);
  fireEvent.click(screen.getByText('Group by product'));
  const files = Array.from({ length: 9 }, (_, index) => new File(['photo'], `phone-${index + 1}.jpg`, { type: 'image/jpeg' }));
  fireEvent.change(screen.getByLabelText(/Choose up to 30 product photos/), { target: { files } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Product group for photo 5' }), { target: { value: 'new' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Product group for photo 6' }), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Product group for photo 7' }), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Product group for photo 8' }), { target: { value: 'new' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Product group for photo 9' }), { target: { value: '3' } });
  const categories = screen.getAllByRole('combobox', { name: 'Category' });
  fireEvent.change(categories[0], { target: { value: '0123456789abcdef01234567' } });
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Exact phone model' })[0], { target: { value: 'Apple iPhone 17' } });
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Storage (GB)' })[0], { target: { value: '256' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create & start Smart Fill' }));
  expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({
    groupMode: 'grouped', photoGroups: [1, 1, 1, 1, 2, 2, 2, 3, 3], smartFill: true,
    groupDetails: expect.objectContaining({ 1: expect.objectContaining({ model: 'Apple iPhone 17', storage: '256' }) }),
  }));
});

test('removed product group details do not leak into a replacement group', () => {
  const onUpload = jest.fn();
  render(<DraftPhotoUploadPanel categories={[]} uploading={false} onUpload={onUpload} onClose={jest.fn()} />);
  fireEvent.click(screen.getByText('Group by product'));
  const input = screen.getByLabelText(/Choose up to 30 product photos/);
  fireEvent.change(input, { target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })] } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Product group for photo 2' }), { target: { value: 'new' } });
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Exact phone model' })[1], { target: { value: 'Old model' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }));
  fireEvent.change(input, { target: { files: [new File(['c'], 'c.jpg', { type: 'image/jpeg' })] } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Product group for photo 2' }), { target: { value: 'new' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create drafts only' }));
  expect(onUpload.mock.calls[0][0].groupDetails[2]).toEqual({});
});
