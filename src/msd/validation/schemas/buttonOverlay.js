/**
 * @fileoverview Button Overlay Schema
 *
 * Validation schema for button overlays.
 * Defines required fields and constraints specific to interactive buttons.
 *
 * STANDARDIZATION: Button-specific properties only
 * - Common style properties inherited from commonSchema
 * - Action validation (tap, hold, double_tap)
 * - Button-specific features (presets, brackets, labels, values)
 *
 * @module msd/validation/schemas/buttonOverlay
 */

/**
 * Button overlay validation schema
 */
export const buttonOverlaySchema = {
  type: 'button',
  extends: 'common',

  required: ['position', 'size'],

  properties: {
    label: {
      type: 'string',
      optional: true,
      errorMessage: 'Label must be a string'
    },

    value: {
      type: 'string',
      optional: true,
      errorMessage: 'Value must be a string'
    },

    tap_action: {
      type: 'object',
      optional: true,
      properties: {
        action: {
          type: 'string',
          enum: ['none', 'toggle', 'call-service', 'navigate', 'url', 'more-info'],
          errorMessage: 'Action must be one of: none, toggle, call-service, navigate, url, more-info'
        },

        service: {
          type: 'string',
          optional: true
        },

        service_data: {
          type: 'object',
          optional: true
        },

        navigation_path: {
          type: 'string',
          optional: true
        },

        url_path: {
          type: 'string',
          format: 'url',
          optional: true
        },

        entity: {
          type: 'string',
          optional: true
        }
      }
    },

    hold_action: {
      type: 'object',
      optional: true,
      properties: {
        action: {
          type: 'string',
          enum: ['none', 'toggle', 'call-service', 'navigate', 'url', 'more-info']
        }
      }
    },

    double_tap_action: {
      type: 'object',
      optional: true,
      properties: {
        action: {
          type: 'string',
          enum: ['none', 'toggle', 'call-service', 'navigate', 'url', 'more-info']
        }
      }
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        // NOTE: Common style properties (color, border, text, padding) inherited from commonSchema

        // ============================================================================
        // BUTTON-SPECIFIC PROPERTIES
        // ============================================================================

        // LCARS Presets
        lcars_button_preset: {
          type: 'string',
          optional: true,
          errorMessage: 'LCARS button preset must be a valid preset name'
        },

        lcars_text_preset: {
          type: 'string',
          optional: true
        },

        // Button Content Control
        show_labels: {
          type: 'boolean',
          optional: true
        },

        show_values: {
          type: 'boolean',
          optional: true
        },

        label_position: {
          type: 'string',
          enum: ['center-top', 'center-bottom', 'left', 'right', 'center'],
          optional: true
        },

        value_position: {
          type: 'string',
          enum: ['center-top', 'center-bottom', 'left', 'right', 'center'],
          optional: true
        },

        // LCARS Bracket Styling
        bracket_style: {
          type: 'boolean',
          optional: true
        },

        bracket_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        bracket_width: {
          type: 'number',
          min: 0,
          max: 10,
          optional: true
        },

        bracket_gap: {
          type: 'number',
          min: 0,
          optional: true
        },

        bracket_extension: {
          type: 'number',
          min: 0,
          optional: true
        },

        bracket_opacity: {
          type: 'number',
          min: 0,
          max: 1,
          optional: true
        }
      }
    }
  },

  validators: [
    // Validate tap_action completeness
    (overlay, context) => {
      const errors = [];

      if (overlay.tap_action) {
        const action = overlay.tap_action.action;

        // call-service requires service field
        if (action === 'call-service' && !overlay.tap_action.service) {
          errors.push({
            field: 'tap_action.service',
            type: 'required_field',
            message: 'Service is required when action is "call-service"',
            severity: 'error',
            suggestion: 'Add "service" field to tap_action'
          });
        }

        // navigate requires navigation_path
        if (action === 'navigate' && !overlay.tap_action.navigation_path) {
          errors.push({
            field: 'tap_action.navigation_path',
            type: 'required_field',
            message: 'Navigation path is required when action is "navigate"',
            severity: 'error',
            suggestion: 'Add "navigation_path" field to tap_action'
          });
        }

        // url requires url_path
        if (action === 'url' && !overlay.tap_action.url_path) {
          errors.push({
            field: 'tap_action.url_path',
            type: 'required_field',
            message: 'URL path is required when action is "url"',
            severity: 'error',
            suggestion: 'Add "url_path" field to tap_action'
          });
        }
      }

      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    }
  ]
};

export default buttonOverlaySchema;