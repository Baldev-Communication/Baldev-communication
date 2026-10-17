import { draftAttributeDefinitions, firstInvalidDraftAttribute } from './draftAttributes';

export const uploadAttributeFields = { brand: 'brand', model: 'model', ram: 'ram', storage: 'storage', condition: 'condition', warranty: 'warranty', colour: 'colour', country_of_origin: 'countryOfOrigin' };
export const hasUploadValue = value => value !== undefined && value !== null && String(value).trim() !== '';
export const uploadAttributeValue = (details, key) => details[uploadAttributeFields[key]] ?? details.attributeValues?.[key] ?? '';

export function updateUploadDetail(details, field, value, structure, categories) {
  if (field.startsWith('attribute.')) {
    const key = field.slice(10);
    const mapped = uploadAttributeFields[key];
    if (!mapped) return { ...details, attributeValues: { ...details.attributeValues, [key]: value } };
    return { ...details, [mapped]: value, attributeValues: Object.fromEntries(Object.entries(details.attributeValues || {}).filter(([item]) => item !== key)) };
  }
  if (field.startsWith('packageDimensions.')) return { ...details, packageDimensions: { ...details.packageDimensions, [field.slice(18)]: value } };
  const next = { ...details, [field]: value };
  if (field === 'category' && structure) {
    next.subCategory = '';
    next.categoryDefinitionKey = categories.find(item => String(item._id) === String(value))?.definitionKey || '';
    const attributes = draftAttributeDefinitions(structure, categories, next);
    const before = new Map(draftAttributeDefinitions(structure, categories, details).map(item => [item.key, item]));
    const keys = new Set(attributes.map(item => item.key));
    next.attributeValues = Object.fromEntries(Object.entries(details.attributeValues || {}).filter(([key, current]) => {
      const definition = attributes.find(item => item.key === key);
      return keys.has(key) && (!before.has(key) || (before.get(key).unit || '') === (definition.unit || ''))
        && !firstInvalidDraftAttribute([{ ...definition, required: false }], { [key]: current });
    }));
    for (const key of ['condition', 'warranty', 'colour', 'ram', 'storage']) {
      const definition = attributes.find(item => item.key === key);
      if (!definition || firstInvalidDraftAttribute([{ ...definition, required: false }], { [key]: next[key] })) delete next[key];
    }
  }
  return next;
}

export function uploadDetailError(details, structure, categories) {
  const numbers = { sellingPrice: ['Selling price'], originalPrice: ['MRP'], costPrice: ['Cost price'], stock: ['Stock quantity', Infinity, true], gstRate: ['GST rate', 100],
    lowStockAlert: ['Low-stock alert', Infinity, true], reorderQuantity: ['Reorder quantity', Infinity, true], shippingWeightKg: ['Packed weight', 1000], returnWindowDays: ['Return window', 365, true] };
  for (const [field, [label, max = Number.MAX_SAFE_INTEGER, integer]] of Object.entries(numbers)) {
    if (!hasUploadValue(details[field])) continue;
    const number = Number(details[field]);
    const outsideRange = !Number.isFinite(number) || number < 0 || number > max;
    const invalidInteger = integer && !Number.isSafeInteger(number);
    if (outsideRange || invalidInteger) {
      const limit = Number.isFinite(max) && max < Number.MAX_SAFE_INTEGER ? `, up to ${max}` : '';
      return `${label} must be ${integer ? 'a whole number' : 'a number'} of zero or more${limit}.`;
    }
  }
  if (hasUploadValue(details.originalPrice) && hasUploadValue(details.sellingPrice) && Number(details.originalPrice) < Number(details.sellingPrice)) return 'MRP must be at least the selling price.';
  if (details.model && !details.category) return 'Choose a category before adding the exact model.';
  if ((details.ram || details.storage) && !details.model) return 'Enter the exact model before RAM or storage.';
  const dimensions = ['lengthCm', 'widthCm', 'heightCm'].map(key => details.packageDimensions?.[key]);
  if (dimensions.some(hasUploadValue) && !dimensions.every(value => hasUploadValue(value) && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1000)) return 'Enter all three packed dimensions between 0 and 1000 cm.';
  const attributes = draftAttributeDefinitions(structure, categories, details).map(item => ({ ...item, required: false }));
  const values = { ...details.attributeValues, ...Object.fromEntries(Object.entries(uploadAttributeFields).filter(([, field]) => hasUploadValue(details[field])).map(([key, field]) => [key, details[field]])) };
  return firstInvalidDraftAttribute(attributes, values)?.message || '';
}

export function applySharedUploadDetails(details, shared, replace, structure, categories) {
  let next = { ...details };
  if (hasUploadValue(shared.category) && (replace || !hasUploadValue(next.category))) next = updateUploadDetail(next, 'category', shared.category, structure, categories);
  const targetAttributes = new Map(draftAttributeDefinitions(structure, categories, next).map(item => [item.key, item]));
  const sourceAttributes = new Map(draftAttributeDefinitions(structure, categories, shared).map(item => [item.key, item]));
  const applicable = (key, value) => {
    if (!structure || !next.category) return true;
    const definition = targetAttributes.get(key);
    if (!definition || (sourceAttributes.has(key) && (sourceAttributes.get(key).unit || '') !== (definition.unit || ''))) return false;
    return !firstInvalidDraftAttribute([{ ...definition, required: false }], { [key]: value });
  };
  for (const [field, value] of Object.entries(shared)) {
    if (['category', 'attributeValues', 'packageDimensions'].includes(field) || !hasUploadValue(value)) continue;
    const attributeKey = Object.keys(uploadAttributeFields).find(key => uploadAttributeFields[key] === field);
    if (attributeKey && !applicable(attributeKey, value)) continue;
    if (replace || !hasUploadValue(next[field])) next[field] = value;
  }
  for (const [key, value] of Object.entries(shared.attributeValues || {})) if (hasUploadValue(value) && applicable(key, value) && (replace || !hasUploadValue(next.attributeValues?.[key]))) next.attributeValues = { ...next.attributeValues, [key]: value };
  for (const [key, value] of Object.entries(shared.packageDimensions || {})) if (hasUploadValue(value) && (replace || !hasUploadValue(next.packageDimensions?.[key]))) next.packageDimensions = { ...next.packageDimensions, [key]: value };
  return next;
}
