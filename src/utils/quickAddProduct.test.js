import { applyVisionSuggestion, buildQuickAddPayload, emptyQuickAddForm, validateQuickAdd } from './quickAddProduct';

test('Quick Add keeps photo label facts in the saved payload and required Brand attribute', () => {
  const form = applyVisionSuggestion({
    ...emptyQuickAddForm(), category: 'test-category', price: '499', stock: '2',
    images: [{ url: '/uploads/product.webp', primary: true }],
  }, {
    name: 'Nova Charger', brand: 'Nova', packageDimensions: { lengthCm: 30, widthCm: 20, heightCm: 5 },
    shippingWeightKg: 0.45, countryOfOrigin: 'India',
  }, {}, [], [{ key: 'brand' }, { key: 'country_of_origin' }]);
  expect(form.brand).toBe('Nova');
  expect(form.attributeValues.brand).toBe('Nova');
  expect(form.attributeValues.country_of_origin).toBe('India');
  expect(validateQuickAdd(form)).toEqual({});
  const payload = buildQuickAddPayload(form);
  expect(payload.packageDimensions).toEqual({ lengthCm: 30, widthCm: 20, heightCm: 5 });
  expect(payload.shippingWeightKg).toBe(0.45);
  expect(payload.countryOfOrigin).toBe('India');
  expect(validateQuickAdd({ ...form, packageDimensions: { lengthCm: 30, widthCm: '', heightCm: 5 } }).packageDimensions).toBeTruthy();
});
