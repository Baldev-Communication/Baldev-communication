export function isTechnologyCatalog(structure) {
  return ['mobile', 'electronics'].includes(structure?.industry || structure?.id)
    || (structure?.features?.technical === true && structure?.features?.sizing === false);
}

export const essentialTechnologySpecifications = new Set([
  'brand', 'model', 'condition', 'warranty', 'ram', 'storage', 'processor',
  'display_size', 'battery', 'output_power', 'connector_type', 'connectivity', 'compatible_devices',
  'screen_size', 'resolution', 'panel_type', 'refresh_rate', 'smart_tv_platform',
  'wash_capacity', 'loading_type', 'automation', 'spin_speed', 'energy_rating',
  'capacity_litres', 'material', 'induction_compatible', 'power_consumption', 'jar_count',
  'jar_capacities', 'iron_type', 'soleplate', 'cooling_capacity_ton', 'appliance_type',
  'protector_type', 'speaker_type', 'headphone_type', 'earphone_type', 'battery_capacity',
]);
