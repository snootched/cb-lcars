// MSD v1 is now the stable system - feature flag no longer needed
// Keep this file for future feature flags

export const FEATURE_FLAGS = {
  // Future features can be added here
  // Example: MSD_V2_BETA: false
};

// Helper function for future feature flags
export function isFeatureEnabled(flagName) {
  return FEATURE_FLAGS[flagName] === true;
}