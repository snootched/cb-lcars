/**
 * @fileoverview StatusGrid Overlay Schema
 *
 * Validation schema for StatusGrid overlays.
 * Defines required fields and constraints specific to status grid rendering.
 *
 * STANDARDIZATION: Grid-specific properties only
 * - Common style properties inherited from commonSchema
 * - Grid layout (rows, columns, cells)
 * - Cell-specific styling
 *
 * @module msd/validation/schemas/statusGridOverlay
 */

/**
 * StatusGrid overlay validation schema
 */
export const statusGridOverlaySchema = {
  type: 'status_grid',
  extends: 'common',

  required: ['position', 'size', 'cells'],

  properties: {
    cells: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          // ✅ ENHANCED: Entity is now fully optional
          entity: {
            type: 'string',
            optional: true,
            errorMessage: 'Cell entity must be a valid Home Assistant entity ID'
          },
          label: {
            type: 'string',
            optional: true
          },
          // ✅ NEW: Added value property for static content
          value: {
            type: ['string', 'number', 'boolean'],
            optional: true,
            errorMessage: 'Cell value must be a string, number, or boolean'
          },
          color: {
            type: 'string',
            format: 'color',
            optional: true
          },
          // ✅ NEW: Cell-level tags for bulk targeting in rules
          tags: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
              pattern: /^[a-zA-Z0-9_-]+$/
            },
            optional: true,
            errorMessage: 'Cell tags must be an array of alphanumeric strings (with hyphens/underscores)'
          }
        }
      },
      errorMessage: 'Cells must be an array of cell configuration objects'
    },

    rows: {
      type: 'number',
      min: 1,
      max: 20,
      optional: true,
      integer: true,
      errorMessage: 'Rows must be an integer between 1 and 20'
    },

    columns: {
      type: 'number',
      min: 1,
      max: 20,
      optional: true,
      integer: true,
      errorMessage: 'Columns must be an integer between 1 and 20'
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        // NOTE: Common style properties (color, border, text, padding) inherited from commonSchema

        // ============================================================================
        // GRID-SPECIFIC PROPERTIES
        // ============================================================================

        // Grid Layout
        cell_gap: {
          type: 'number',
          min: 0,
          max: 50,
          optional: true,
          errorMessage: 'Cell gap must be between 0 and 50'
        },

        cell_spacing: {
          type: 'number',
          min: 0,
          max: 50,
          optional: true
        },

        cell_radius: {
          type: 'number',
          min: 0,
          optional: true
        },

        cell_padding: {
          type: 'number',
          min: 0,
          optional: true
        },

        normalize_radius: {
          type: 'boolean',
          optional: true
        },

        // Cell Coloring
        cell_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        // Text Layout
        text_layout: {
          type: 'string',
          enum: ['stacked', 'side-by-side', 'label-only', 'value-only'],
          optional: true,
          errorMessage: 'Text layout must be "stacked", "side-by-side", "label-only", or "value-only"'
        },

        text_alignment: {
          type: 'string',
          enum: ['left', 'center', 'right'],
          optional: true
        },

        label_position: {
          type: 'string',
          enum: ['top', 'bottom', 'left', 'right', 'center'],
          optional: true
        },

        value_position: {
          type: 'string',
          enum: ['top', 'bottom', 'left', 'right', 'center'],
          optional: true
        },

        show_labels: {
          type: 'boolean',
          optional: true
        },

        show_values: {
          type: 'boolean',
          optional: true
        },

        // Individual font sizes (can override text.label.font_size / text.value.font_size)
        label_font_size: {
          type: 'number',
          min: 6,
          max: 100,
          optional: true,
          errorMessage: 'Label font size must be between 6 and 100'
        },

        value_font_size: {
          type: 'number',
          min: 6,
          max: 100,
          optional: true,
          errorMessage: 'Value font size must be between 6 and 100'
        },

        // Interaction
        hover_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        hover_scale: {
          type: 'number',
          min: 1,
          max: 2,
          optional: true,
          errorMessage: 'Hover scale must be between 1 and 2'
        },

        // LCARS Presets
        lcars_button_preset: {
          type: 'string',
          optional: true
        },

        lcars_text_preset: {
          type: 'string',
          optional: true
        }
      }
    }
  },

  validators: [
    // Validate grid dimensions match cell count
    (overlay, context) => {
      if (!overlay.cells || !Array.isArray(overlay.cells)) {
        return { valid: true }; // Already handled by schema
      }

      const cellCount = overlay.cells.length;
      const rows = overlay.rows || Math.ceil(Math.sqrt(cellCount));
      const columns = overlay.columns || Math.ceil(cellCount / rows);
      const totalCells = rows * columns;

      const warnings = [];

      if (totalCells < cellCount) {
        warnings.push({
          field: 'cells',
          type: 'grid_overflow',
          message: `Grid has ${rows}×${columns} = ${totalCells} cells, but ${cellCount} cells are defined`,
          severity: 'warning',
          suggestion: `Increase rows or columns to accommodate all cells`
        });
      }

      if (totalCells > cellCount && (overlay.rows || overlay.columns)) {
        warnings.push({
          field: 'cells',
          type: 'grid_underflow',
          message: `Grid has ${rows}×${columns} = ${totalCells} cells, but only ${cellCount} cells are defined`,
          severity: 'warning',
          suggestion: 'Empty cells will be displayed'
        });
      }

      return warnings.length > 0 ? { valid: true, warnings } : { valid: true };
    }

    // ✅ REMOVED: Entity validation - entity is now fully optional
  ]
};

export default statusGridOverlaySchema;