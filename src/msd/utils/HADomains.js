/**
 * Comprehensive list of Home Assistant domain names
 * Used to distinguish HA entities from MSD datasources in triggers_update
 *
 * Source: Home Assistant Core domains as of 2024
 * @module utils/HADomains
 */

/**
 * Known Home Assistant domain names
 * Format: domain.entity_id (e.g., sensor.temperature)
 */
export const HA_DOMAINS = [
  // Core domains
  'alarm_control_panel',
  'automation',
  'binary_sensor',
  'button',
  'calendar',
  'camera',
  'climate',
  'conversation',
  'cover',
  'date',
  'datetime',
  'device_tracker',
  'event',
  'fan',
  'group',
  'humidifier',
  'image',
  'input_boolean',
  'input_button',
  'input_datetime',
  'input_number',
  'input_select',
  'input_text',
  'lawn_mower',
  'light',
  'lock',
  'media_player',
  'notify',
  'number',
  'person',
  'remote',
  'scene',
  'script',
  'select',
  'sensor',
  'siren',
  'stt',
  'sun',
  'switch',
  'text',
  'time',
  'timer',
  'todo',
  'tts',
  'update',
  'vacuum',
  'valve',
  'wake_word',
  'water_heater',
  'weather',
  'zone',

  // Common integration domains
  'air_quality',
  'counter',
  'image_processing',
  'mailbox',
  'plant',
  'proximity',
];

/**
 * Check if a reference string is a Home Assistant entity
 * @param {string} ref - Reference string (e.g., 'sensor.temperature' or 'cpu_temp')
 * @returns {boolean} True if ref is an HA entity
 */
export function isHAEntity(ref) {
  if (!ref || typeof ref !== 'string') {
    return false;
  }

  const parts = ref.split('.');

  if (parts.length < 2) {
    // No dot = simple MSD datasource
    return false;
  }

  // Check if first part is a known HA domain
  return HA_DOMAINS.includes(parts[0]);
}

/**
 * Parse a trigger reference into type and identifier
 * @param {string} ref - Reference string
 * @returns {Object} { type: 'ha_entity' | 'msd_datasource', id: string, path?: string }
 */
export function parseTriggerReference(ref) {
  if (!ref || typeof ref !== 'string') {
    return null;
  }

  const parts = ref.split('.');

  if (parts.length < 2) {
    // Simple datasource name (no dots)
    return {
      type: 'msd_datasource',
      id: ref
    };
  }

  // Check if it's an HA entity
  if (HA_DOMAINS.includes(parts[0])) {
    return {
      type: 'ha_entity',
      id: ref  // Full entity_id
    };
  }

  // Otherwise it's a datasource with path
  return {
    type: 'msd_datasource',
    id: parts[0],           // Base datasource name
    path: parts.slice(1).join('.')  // Path like 'transformations.celsius'
  };
}
