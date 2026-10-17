import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CategorySpecificationFields from './CategorySpecificationFields';

function Form() {
  const [fields, setFields] = useState([]);
  return <><CategorySpecificationFields fields={fields} onChange={setFields} /><output data-testid="fields">{JSON.stringify(fields)}</output></>;
}

test('admin defines typed fields with units, required choices and stable identifiers', () => {
  render(<Form />);
  fireEvent.click(screen.getByText(/Additional specification fields/));
  fireEvent.click(screen.getByRole('button', { name: 'Add specification field' }));
  const original = JSON.parse(screen.getByTestId('fields').textContent)[0].key;
  fireEvent.change(screen.getByLabelText('Specification 1 name'), { target: { value: 'Bowl diameter' } });
  fireEvent.change(screen.getByLabelText('Specification 1 type'), { target: { value: 'measurement' } });
  fireEvent.change(screen.getByLabelText('Specification 1 unit'), { target: { value: 'cm' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Required before publishing' }));
  expect(JSON.parse(screen.getByTestId('fields').textContent)[0]).toMatchObject({ key: original, label: 'Bowl diameter', type: 'measurement', unit: 'cm', required: true });
  fireEvent.change(screen.getByLabelText('Specification 1 type'), { target: { value: 'dropdown' } });
  fireEvent.change(screen.getByLabelText('Choices (comma separated)'), { target: { value: 'Small, Large,' } });
  expect(screen.getByLabelText('Choices (comma separated)')).toHaveValue('Small, Large,');
  expect(JSON.parse(screen.getByTestId('fields').textContent)[0].options).toEqual(['Small', 'Large']);
  fireEvent.click(screen.getByRole('button', { name: 'Remove field 1' }));
  expect(screen.getByTestId('fields')).toHaveTextContent('[]');
});
