function enabledByDefault(value) {
  return !['false', '0', 'no', 'off'].includes(String(value ?? 'true').trim().toLowerCase());
}

export const reelProductImportEnabled = enabledByDefault(process.env.REACT_APP_ENABLE_REEL_PRODUCT_IMPORT);

// This storefront sells products; rental UI is not available in this deployment.
export const rentalShoppingEnabled = false;
