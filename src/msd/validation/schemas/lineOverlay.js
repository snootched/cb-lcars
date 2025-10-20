/**
 * @fileoverview Line Overlay Schema
 *
 * Validation schema for line overlays.
 * Defines required fields and constraints specific to line rendering.
 *
 * @module msd/validation/schemas/lineOverlay
 */

/**
 * Line overlay validation schema
 */
export const lineOverlaySchema = {
  type: 'line',
  extends: 'common',

  // ✅ CHANGED: points not required at schema level
  // Custom validator handles conditional requirement
  required: [],

  properties: {
    points: {
      type: 'array',
      minItems: 2,
      optional: true,  // ✅ Made optional
      items: {
        type: 'array',
        length: 2,
        items: {
          type: 'number'
        }
      },
      errorMessage: 'Points must be an array of at least 2 coordinate pairs [[x1, y1], [x2, y2], ...]'
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

        stroke_width: {
          type: 'number',
          min: 0.5,
          max: 50,
          optional: true,
          errorMessage: 'Stroke width must be between 0.5 and 50'
        },

        line_cap: {
          type: 'string',
          enum: ['butt', 'round', 'square'],
          optional: true,
          errorMessage: 'Line cap must be "butt", "round", or "square"'
        },

        line_join: {
          type: 'string',
          enum: ['miter', 'round', 'bevel'],
          optional: true,
          errorMessage: 'Line join must be "miter", "round", or "bevel"'
        },

        // ✅ ENHANCED: Accept string OR array for easier configuration
        // String format: "5,5" (SVG standard)
        // Array format: [5, 5] (easier to configure)
        dash_array: {
          type: ['string', 'array'],
          optional: true,
          items: {  // Only applies when type is array
            type: 'number'
          },
          errorMessage: 'Dash array must be a string ("5,5") or array ([5, 5])'
        },

        dash_offset: {
          type: 'number',
          optional: true
        },

        // ✅ ENHANCED: Accept string OR object (for enhanced marker configuration)
        // Simple format: "arrow"
        // Enhanced format: { type: "diamond", size: "medium", color: "var(--lcars-red)", rotate: false }
        marker_start: {
          type: ['string', 'object'],
          enum: ['none', 'arrow', 'dot', 'circle', 'square', 'diamond'],  // Only applies when type is string
          optional: true,
          errorMessage: 'Marker start must be a marker type string or an enhanced marker configuration object'
        },

        marker_end: {
          type: ['string', 'object'],
          enum: ['none', 'arrow', 'dot', 'circle', 'square', 'diamond'],  // Only applies when type is string
          optional: true,
          errorMessage: 'Marker end must be a marker type string or an enhanced marker configuration object'
        },

        marker_mid: {
          type: ['string', 'object'],
          enum: ['none', 'dot', 'circle', 'square', 'diamond'],  // Only applies when type is string
          optional: true,
          errorMessage: 'Marker mid must be a marker type string or an enhanced marker configuration object'
        },

        // ✅ ENHANCED: Accept boolean OR object (for enhanced glow configuration)
        // Enhanced format: { color: "var(--lcars-orange)", blur: 30, intensity: 10 }
        glow: {
          type: ['boolean', 'object'],
          optional: true,
          errorMessage: 'Glow must be a boolean or an enhanced glow configuration object'
        },

        glow_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        glow_size: {
          type: 'number',
          min: 0,
          max: 50,
          optional: true,
          errorMessage: 'Glow size must be between 0 and 50'
        },

        smoothing: {
          type: 'string',
          enum: ['none', 'linear', 'bezier', 'spline', 'constrained'],
          optional: true,
          errorMessage: 'Smoothing must be "none", "linear", "bezier", "spline", or "constrained"'
        }
      }
    }
  },

  validators: [
    // ✅ NEW: Conditional points requirement
    (overlay, context) => {
      const hasPoints = overlay.points && Array.isArray(overlay.points) && overlay.points.length >= 2;
      const hasAttachment = overlay.attach_to || overlay.attachTo;

      // Points required UNLESS line uses attachment-based positioning
      if (!hasPoints && !hasAttachment) {
        return {
          valid: false,
          errors: [{
            field: 'points',
            type: 'required_field',
            message: 'Line overlay requires "points" field unless using "attach_to"',
            severity: 'error',
            suggestion: 'Add a "points" field with coordinate pairs, or use "attach_to" for attachment-based positioning'
          }]
        };
      }

      return { valid: true };
    },

    // Validate points array structure (if present)
    (overlay, context) => {
      if (!overlay.points || !Array.isArray(overlay.points)) {
        return { valid: true }; // Already handled by conditional validator
      }

      const errors = [];

      // Check each point
      overlay.points.forEach((point, index) => {
        if (!Array.isArray(point)) {
          errors.push({
            field: `points[${index}]`,
            type: 'invalid_type',
            message: `Point ${index} must be an array [x, y]`,
            severity: 'error'
          });
        } else if (point.length !== 2) {
          errors.push({
            field: `points[${index}]`,
            type: 'invalid_length',
            message: `Point ${index} must have exactly 2 coordinates [x, y]`,
            expected: 2,
            actual: point.length,
            severity: 'error'
          });
        } else {
          // Validate numeric coordinates
          point.forEach((coord, coordIndex) => {
            if (typeof coord !== 'number') {
              errors.push({
                field: `points[${index}][${coordIndex}]`,
                type: 'invalid_type',
                message: `Coordinate must be a number`,
                expected: 'number',
                actual: typeof coord,
                severity: 'error'
              });
            }
          });
        }
      });

      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    }
  ]
};

export default lineOverlaySchema;