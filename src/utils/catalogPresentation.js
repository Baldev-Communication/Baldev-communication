export function isTechnologyCatalog(structure) {
  return ['mobile', 'electronics'].includes(structure?.industry || structure?.id)
    || (structure?.features?.technical === true && structure?.features?.sizing === false);
}

export const essentialTechnologySpecifications = new Set([
  'brand', 'model', 'condition', 'warranty', 'ram', 'storage', 'processor',
  'display_size', 'battery', 'output_power', 'connector_type', 'connectivity', 'compatible_devices',
]);
