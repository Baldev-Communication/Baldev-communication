import { draftAttributeDefinitions, firstInvalidDraftAttribute } from './draftAttributes';
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
