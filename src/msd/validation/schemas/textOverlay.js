/**
 * @fileoverview Text Overlay Schema
 *
 * Validation schema for text overlays.
 * Defines required fields and constraints specific to text rendering.
 *
 * STANDARDIZATION: Text-specific properties only
 * - Common style properties inherited from commonSchema
 * - Text content and alignment
 * - SVG text-specific features
 *
 * @module msd/validation/schemas/textOverlay
 */

/**
 * Text overlay validation schema
 */
export const textOverlaySchema = {
  type: 'text',
  extends: 'common',

  // ✅ CHANGED: Neither text nor content required at schema level
  // Custom validator handles the "at least one" requirement
  required: ['position'],

  properties: {
    // ✅ Both text and content are optional (but one is required via validator)
    text: {
      type: 'string',
      minLength: 1,
      optional: true,
      errorMessage: 'Text content cannot be empty'
    },

    // ✅ NEW: Accept content as alternative to text
    content: {
      type: 'string',
      minLength: 1,
      optional: true,
      errorMessage: 'Content cannot be empty'
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Color must be a valid color format (hex, rgb, rgba, or CSS variable)'
        },

        // ✅ ENHANCED: Accept number OR object (for enhanced responsive sizing)
        // Enhanced format: { value: 28, scale: "viewbox", unit: "px" }
        font_size: {
          type: ['number', 'object'],
          min: 6,      // Only applies when type is number
          max: 200,    // Only applies when type is number
          optional: true,
          errorMessage: 'Font size must be a number (6-200) or an enhanced sizing object'
        },

        font_family: {
          type: 'string',
          optional: true
        },

        font_weight: {
          type: 'string',
          enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
          optional: true,
          errorMessage: 'Font weight must be "normal", "bold", or a numeric value (100-900)'
        },

        // ✅ ENHANCED: Support all 6 values (SVG standard + user-friendly aliases)
        text_anchor: {
          type: 'string',
          enum: ['start', 'middle', 'end', 'left', 'center', 'right'],
          optional: true,
          errorMessage: 'Text anchor must be one of: start, middle, end, left, center, right'
        },

        alignment: {
          type: 'string',
          enum: ['left', 'center', 'right'],
          optional: true,
          errorMessage: 'Alignment must be "left", "center", or "right"'
        },

        vertical_alignment: {
          type: 'string',
          enum: ['top', 'middle', 'bottom'],
          optional: true,
          errorMessage: 'Vertical alignment must be "top", "middle", or "bottom"'
        },

        letter_spacing: {
          type: 'number',
          optional: true
        },

        line_height: {
          type: 'number',
          min: 0.5,
          max: 3,
          optional: true,
          errorMessage: 'Line height must be between 0.5 and 3'
        },

        text_transform: {
          type: 'string',
          enum: ['none', 'uppercase', 'lowercase', 'capitalize'],
          optional: true,
          errorMessage: 'Text transform must be "none", "uppercase", "lowercase", or "capitalize"'
        },

        text_decoration: {
          type: 'string',
          enum: ['none', 'underline', 'overline', 'line-through'],
          optional: true,
          errorMessage: 'Text decoration must be "none", "underline", "overline", or "line-through"'
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

        shadow: {
          type: 'boolean',
          optional: true
        },

        shadow_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        shadow_offset_x: {
          type: 'number',
          optional: true
        },

        shadow_offset_y: {
          type: 'number',
          optional: true
        },

        shadow_blur: {
          type: 'number',
          min: 0,
          optional: true
        }
      }
    }
  },

  validators: [
    // ✅ UPDATED: Validate text OR content is present
    (overlay, context) => {
      const hasText = overlay.text && typeof overlay.text === 'string' && overlay.text.length > 0;
      const hasContent = overlay.content && typeof overlay.content === 'string' && overlay.content.length > 0;

      if (!hasText && !hasContent) {
        return {
          valid: false,
          errors: [{
            field: 'text',
            type: 'required_field',
            message: 'Text overlay requires either "text" or "content" field',
            severity: 'error',
            suggestion: 'Add a "text" or "content" field with your text content'
          }]
        };
      }

      return { valid: true };
    },

    // Custom validator: Check if position is valid when anchor is not used
    (overlay, context) => {
      if (!overlay.anchor && !overlay.position) {
        return {
          valid: false,
          errors: [{
            field: 'position',
            type: 'required_field',
            message: 'Position is required when anchor is not specified',
            severity: 'error',
            suggestion: 'Add a "position" field or use an "anchor" reference'
          }]
        };
      }
      return { valid: true };
    }
  ]
};

export default textOverlaySchema;