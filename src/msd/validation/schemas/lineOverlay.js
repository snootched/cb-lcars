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

  required: ['points'],

  properties: {
    points: {
      type: 'array',
      minItems: 2,
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

        dash_array: {
          type: 'string',
          optional: true,
          errorMessage: 'Dash array must be a string (e.g., "5,5" or "10,5,2,5")'
        },

        dash_offset: {
          type: 'number',
          optional: true
        },

        marker_start: {
          type: 'string',
          enum: ['none', 'arrow', 'dot', 'circle', 'square', 'diamond'],
          optional: true,
          errorMessage: 'Marker start must be "none", "arrow", "dot", "circle", "square", or "diamond"'
        },

        marker_end: {
          type: 'string',
          enum: ['none', 'arrow', 'dot', 'circle', 'square', 'diamond'],
          optional: true,
          errorMessage: 'Marker end must be "none", "arrow", "dot", "circle", "square", or "diamond"'
        },

        marker_mid: {
          type: 'string',
          enum: ['none', 'dot', 'circle', 'square', 'diamond'],
          optional: true,
          errorMessage: 'Marker mid must be "none", "dot", "circle", "square", or "diamond"'
        },

        glow: {
          type: 'boolean',
          optional: true
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
    // Validate points array structure
    (overlay, context) => {
      if (!overlay.points || !Array.isArray(overlay.points)) {
        return { valid: true }; // Already handled by schema
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