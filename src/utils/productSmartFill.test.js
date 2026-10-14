import { applySmartPatch, selectedSmartPatch, suggestionRows } from './productSmartFill';

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
