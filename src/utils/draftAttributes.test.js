import { changeProductCategory, draftAttributeDefinitions, firstInvalidDraftAttribute } from './draftAttributes';
import { suggestionRows } from './productSmartFill';

const structure = {
  attributes: [{ key: 'condition', label: 'Condition', type: 'dropdown', required: true, options: ['New', 'Refurbished', 'Used'] }],
  categoryDefinitions: [{ key: 'smartphones', name: 'Smartphones', attributes: [{ key: 'processor', label: 'Processor', type: 'text', required: true }] }],
};

test('draft editor resolves category specifications and rejects unsupported saved choices', () => {
  const attributes = draftAttributeDefinitions(structure, [{ _id: 'cat', name: 'Smartphones', definitionKey: 'smartphones' }], { category: 'cat' });
  expect(attributes.map(item => item.key)).toEqual(['condition', 'processor']);
  expect(firstInvalidDraftAttribute(attributes, { condition: 'Good', processor: 'A19' })).toEqual({ key: 'condition', message: 'Choose a valid Condition: New, Refurbished, Used' });
  expect(firstInvalidDraftAttribute(attributes, { condition: 'Used' })).toEqual({ key: 'processor', message: 'Enter Processor' });
  expect(firstInvalidDraftAttribute(attributes, { condition: 'Used', processor: 'A19' })).toBeNull();
});

test('Smart Fill cannot offer a Condition value the catalog rejects', () => {
  const rows = suggestionRows({ suggestion: { attributeValues: { condition: 'Good' } } }, { attributeValues: {} }, { structure, seo: false });
  expect(rows).toEqual([]);
});

test('category custom fields are available in every draft resolver and cannot replace core fields', () => {
  const categories = [{ _id: 'tv', definitionKey: 'televisions', customAttributes: [
    { key: 'custom_mount', label: 'Mount size', type: 'measurement', unit: 'mm', required: true },
    { key: 'condition', label: 'Unsafe override' },
  ] }];
  const catalog = { ...structure, categoryDefinitions: [...structure.categoryDefinitions, { key: 'televisions', attributes: [{ key: 'screen_size', label: 'Screen size', type: 'measurement', unit: 'in' }] }] };
  const resolved = draftAttributeDefinitions(catalog, categories, { category: 'tv', categoryDefinitionKey: 'smartphones' });
  expect(resolved.map(item => item.key)).toEqual(['condition', 'screen_size', 'custom_mount']);
  expect(firstInvalidDraftAttribute(resolved, { condition: 'New', screen_size: '43' }).key).toBe('custom_mount');
  expect(firstInvalidDraftAttribute(resolved, { condition: 'New', screen_size: '43', custom_mount: '200' })).toBeNull();
});

test('switching from a phone to an appliance drops phone fields and values whose units changed', () => {
  const catalog = { attributes: structure.attributes, categoryDefinitions: [
    { key: 'phones', attributes: [{ key: 'ram', type: 'number', unit: 'GB' }, { key: 'weight', type: 'measurement', unit: 'g' }] },
    { key: 'cookers', attributes: [{ key: 'capacity', type: 'measurement', unit: 'l' }, { key: 'weight', type: 'measurement', unit: 'kg' }] },
  ] };
  const categories = [{ _id: 'p', definitionKey: 'phones' }, { _id: 'c', definitionKey: 'cookers' }];
  const switched = changeProductCategory({ category: 'p', subCategory: 'phone child', attributeValues: { ram: '8', weight: '180', condition: 'New' } }, 'c', catalog, categories);
  expect(switched.attributeValues).toEqual({ condition: 'New' });
  expect(switched.subCategory).toBe('');
  const resolved = draftAttributeDefinitions(catalog, categories, { category: 'c', subCategory: 'phones' });
  expect(resolved.some(item => item.key === 'ram')).toBe(false);
});
