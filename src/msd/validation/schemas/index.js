/**
 * @fileoverview Schema Export Index
 *
 * Central export point for all overlay validation schemas.
 * Imports and registers all schemas with SchemaRegistry.
 *
 * @module msd/validation/schemas
 */

import { commonSchema } from './common.js';
import { textOverlaySchema } from './textOverlay.js';
import { buttonOverlaySchema } from './buttonOverlay.js';
import { lineOverlaySchema } from './lineOverlay.js';
import { apexChartOverlaySchema } from './apexChartOverlay.js';
import { statusGridOverlaySchema } from './statusGridOverlay.js';

// Re-export all schemas
export {
  commonSchema,
  textOverlaySchema,
  buttonOverlaySchema,
  lineOverlaySchema,
  apexChartOverlaySchema,
  statusGridOverlaySchema
};

/**
 * Register all schemas with SchemaRegistry
 *
 * @param {SchemaRegistry} schemaRegistry - Schema registry instance
 *
 * @example
 * import { registerAllSchemas } from './schemas/index.js';
 *
 * const schemaRegistry = new SchemaRegistry();
 * registerAllSchemas(schemaRegistry);
 */
export function registerAllSchemas(schemaRegistry) {
  // Register common schema (inherited by all)
  schemaRegistry.registerCommon(commonSchema);

  // Register type-specific schemas
  schemaRegistry.register('text', textOverlaySchema);
  schemaRegistry.register('button', buttonOverlaySchema);
  schemaRegistry.register('line', lineOverlaySchema);
  schemaRegistry.register('apexchart', apexChartOverlaySchema);
  schemaRegistry.register('status_grid', statusGridOverlaySchema);
}