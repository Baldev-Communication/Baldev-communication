const definitionKey = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function draftCategoryDefinition(structure, categories = [], form = {}) {
  const definitions = structure?.categoryDefinitions || [];
  const categoryId = form.category?._id || form.category;
  const category = categories.find(item => String(item._id) === String(categoryId));
  const subcategory = String(form.subCategory || '').trim().toLowerCase();
  const child = subcategory && definitions.find(item => item.key === definitionKey(subcategory) || String(item.name || '').toLowerCase() === subcategory);
  const base = [category?.definitionKey, form.categoryDefinitionKey, definitionKey(category?.name)]
    .map(key => definitions.find(item => item.key === key)).find(Boolean);
  let cursor = child;
  for (let depth = 0; cursor && depth < 12; depth++) {
    if (!base || cursor.key === base.key) return child;
    const parentKey = cursor.parentKey;
    cursor = definitions.find(item => item.key === parentKey);
  }
  return base;
}

export function draftAttributeDefinitions(structure, categories = [], form = {}) {
  const definitions = structure?.categoryDefinitions || [];
  const category = categories.find(item => String(item._id) === String(form.category?._id || form.category));
  const categoryDefinition = draftCategoryDefinition(structure, categories, form);
  const merged = new Map((structure?.attributes || []).map(item => [item.key, item]));
  const chain = [];
  let cursor = categoryDefinition;
  while (cursor && chain.length < 12) {
    chain.unshift(cursor);
    const parentKey = cursor.parentKey;
    cursor = definitions.find(item => item.key === parentKey);
  }
  for (const layer of chain) for (const item of layer.attributes || []) {
    if (item && typeof item === 'object' && item.key) merged.set(item.key, { ...merged.get(item.key), ...item });
  }
  for (const item of category?.customAttributes || []) {
    if (item && /^custom_[a-z][a-z0-9_]{0,32}$/.test(item.key)) merged.set(item.key, item);
  }
  return [...merged.values()].filter(item => item.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export function changeProductCategory(form, categoryId, structure, categories = []) {
  const category = categories.find(item => String(item._id) === String(categoryId));
  const next = { ...form, category: categoryId, subCategory: '', categoryDefinitionKey: category?.definitionKey || definitionKey(category?.name) };
  if (!structure) return next;
  const before = new Map(draftAttributeDefinitions(structure, categories, form).map(item => [item.key, item]));
  const after = new Map(draftAttributeDefinitions(structure, categories, next).map(item => [item.key, item]));
  next.attributeValues = Object.fromEntries(Object.entries(form.attributeValues || {}).filter(([key, value]) => {
    const definition = after.get(key);
    if (!definition || (before.has(key) && (before.get(key).unit || '') !== (definition.unit || ''))) return false;
    return !firstInvalidDraftAttribute([{ ...definition, required: false }], { [key]: value });
  }));
  return next;
}

export function firstInvalidDraftAttribute(attributes = [], values = {}) {
  for (const attribute of attributes) {
    const value = String(values?.[attribute.key] ?? '').trim();
    if (!value) {
      if (attribute.required) return { key: attribute.key, message: `Enter ${attribute.label}` };
      continue;
    }
    if (attribute.type === 'boolean' && !['true', 'false', 'yes', 'no'].includes(value.toLowerCase())) {
      return { key: attribute.key, message: `${attribute.label} must be Yes or No` };
    }
    if (['dropdown', 'multi_select'].includes(attribute.type) && attribute.options?.length) {
      const selected = attribute.type === 'multi_select' ? value.split(',').map(item => item.trim()).filter(Boolean) : [value];
      if (selected.some(item => !attribute.options.includes(item))) {
        return { key: attribute.key, message: `Choose a valid ${attribute.label}: ${attribute.options.join(', ')}` };
      }
    }
    if (['number', 'measurement', 'range'].includes(attribute.type)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return { key: attribute.key, message: `${attribute.label} must be a valid number` };
      if (attribute.validation?.min !== undefined && number < attribute.validation.min) return { key: attribute.key, message: `${attribute.label} must be at least ${attribute.validation.min}` };
      if (attribute.validation?.max !== undefined && number > attribute.validation.max) return { key: attribute.key, message: `${attribute.label} must be at most ${attribute.validation.max}` };
    }
    if (attribute.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { key: attribute.key, message: `${attribute.label} must be a valid date` };
    if (attribute.validation?.minLength && value.length < attribute.validation.minLength) return { key: attribute.key, message: `${attribute.label} is too short` };
    if (attribute.validation?.maxLength && value.length > attribute.validation.maxLength) return { key: attribute.key, message: `${attribute.label} is too long` };
  }
  return null;
}
