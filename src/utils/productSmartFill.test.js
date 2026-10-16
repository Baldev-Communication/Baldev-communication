import { applySmartPatch, automaticSpecificationPatch, selectedSmartPatch, suggestionRows } from './productSmartFill';

test('reviewed brand and packed dimensions fill empty defaults and undo safely', () => {
  const form = {
    name: 'Nova Charger', brand: 'Baldev Communication',
    packageDimensions: { lengthCm: 0, widthCm: 0, heightCm: 0 },
    shippingWeightKg: 0, attributeValues: {},
  };
  const result = { suggestion: {
    brand: 'Nova', packageDimensions: { lengthCm: 30, widthCm: 20, heightCm: 5 },
    shippingWeightKg: 0.45, attributeValues: { brand: 'Nova' },
  }, fieldSources: { brand: { source: 'on_screen', quote: 'Brand: Nova' },
    packageDimensions: { source: 'on_screen', quote: 'Package dimensions: 30 x 20 x 5 cm' },
    shippingWeightKg: { source: 'on_screen', quote: 'Packed weight: 450 g' },
    'attribute.brand': { source: 'on_screen', quote: 'Brand: Nova' } } };
  const rows = suggestionRows(result, form, { structure: { attributes: [{ key: 'brand', label: 'Brand' }] }, seo: false });
  const selected = rows.filter(row => row.empty).map(row => row.key);
  expect(selected).toEqual(expect.arrayContaining(['brand', 'packageDimensions', 'shippingWeightKg', 'attributeValues.brand']));
  const patch = selectedSmartPatch(rows, selected, form);
  const applied = applySmartPatch(form, patch);
  expect(applied.brand).toBe('Nova');
  expect(applied.attributeValues.brand).toBe('Nova');
  expect(applied.packageDimensions).toEqual({ lengthCm: 30, widthCm: 20, heightCm: 5 });
  expect(applied.shippingWeightKg).toBe(0.45);
  expect(applySmartPatch({ ...applied, brand: 'Manually edited' }, patch, true)).toEqual({
    ...form, brand: 'Manually edited', attributeValues: { brand: '' },
  });
});

test('grounded smartphone specs from a category definition appear in review and apply together', () => {
  const form = { name: 'Apple iPhone 17 256', category: '', attributeValues: {} };
  const result = { suggestion: { category: 'phone', attributeValues: { model: 'iPhone 17', storage: '256', processor: 'A19' }, description: 'iPhone 17. Processor: A19.' }, fieldSources: {
    'attribute.model': { source: 'web', url: 'https://example.com/specs' },
    'attribute.storage': { source: 'web', url: 'https://example.com/specs' },
    'attribute.processor': { source: 'web', url: 'https://example.com/specs' },
  } };
  const structure = { attributes: [{ key: 'model', label: 'Model', type: 'text' }], categoryDefinitions: [{ key: 'smartphones', name: 'Smartphones', attributes: [
    { key: 'storage', label: 'Storage', type: 'dropdown', options: ['128', '256'] },
    { key: 'processor', label: 'Processor', type: 'text' },
  ] }] };
  const categories = [{ _id: 'phone', name: 'Smartphones', definitionKey: 'smartphones' }];
  const rows = suggestionRows(result, form, { categories, structure, seo: false });
  expect(rows.map(row => row.key)).toEqual(expect.arrayContaining(['category', 'attributeValues.model', 'attributeValues.storage', 'attributeValues.processor', 'description']));
  const patch = selectedSmartPatch(rows, rows.map(row => row.key), form);
  const applied = applySmartPatch(form, patch);
  expect(applied.category).toBe('phone');
  expect(applied.attributeValues).toEqual({ model: 'iPhone 17', storage: '256', processor: 'A19' });
});

test('store-name brand defaults can be replaced and manufacturer warranty retains its review note', () => {
  const form = { brand: 'Baldev Communication', attributeValues: { brand: 'Baldev Communication' } };
  const rows = suggestionRows({ suggestion: { brand: 'Apple', attributeValues: { brand: 'Apple', warranty: '1 year limited warranty' } }, fieldSources: {
    'attribute.warranty': { source: 'web', reviewRequired: true, note: 'Confirm coverage for this item.' },
  } }, form, { structure: { attributes: [{ key: 'brand', label: 'Brand' }, { key: 'warranty', label: 'Warranty period' }] }, seo: false });
  expect(rows.filter(row => row.empty).map(row => row.key)).toEqual(expect.arrayContaining(['brand', 'attributeValues.brand']));
  expect(rows.find(row => row.key === 'attributeValues.warranty').evidence).toEqual(expect.objectContaining({ reviewRequired: true }));
});

test('automatic specifications require citations and leave commercial, reviewed and edited fields alone', () => {
  const form = { name: 'iPhone 15', price: '', stock: '', attributeValues: { processor: 'Manually entered chip' } };
  const web = { source: 'web', url: 'https://example.com/specs' };
  const rows = [
    { key: 'attributeValues.dimensions', before: undefined, value: '147 x 72 x 8 mm', empty: true, evidence: web },
    { key: 'attributeValues.processor', before: undefined, value: 'A16', empty: true, evidence: web },
    { key: 'attributeValues.condition', value: 'New', empty: true, evidence: web },
    { key: 'attributeValues.warranty', value: '1 year', empty: true, evidence: web },
    { key: 'attributeValues.box_contents', value: 'Cable', empty: true, evidence: { ...web, reviewRequired: true } },
    { key: 'attributeValues.storage', value: '128', empty: true, evidence: { source: 'caption', quote: 'Storage: 128' } },
    { key: 'attributeValues.ram', value: '6', empty: true, evidence: { ...web, url: 'javascript:alert(1)' } },
    { key: 'price', before: '', value: '500', empty: true, evidence: web },
    { key: 'stock', before: '', value: '5', empty: true, evidence: web },
  ];
  expect(automaticSpecificationPatch(rows, form).map(row => row.key)).toEqual(['attributeValues.dimensions']);
});
