/**
 * @fileoverview Button Overlay Schema
 *
 * Validation schema for button overlays.
 * Defines required fields and constraints specific to interactive buttons.
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
        color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        background_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        border_width: {
          type: 'number',
          min: 0,
          max: 20,
          optional: true,
          errorMessage: 'Border width must be between 0 and 20'
        },

        border_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        border_radius: {
          type: 'number',
          min: 0,
          optional: true
        },

        lcars_button_preset: {
          type: 'string',
          optional: true,
          errorMessage: 'LCARS button preset must be a valid preset name'
        },

        font_size: {
          type: 'number',
          min: 6,
          max: 100,
          optional: true,
          errorMessage: 'Font size must be between 6 and 100'
        },

        font_weight: {
          type: 'string',
          enum: ['normal', 'bold'],
          optional: true
        },

        text_transform: {
          type: 'string',
          enum: ['none', 'uppercase', 'lowercase', 'capitalize'],
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