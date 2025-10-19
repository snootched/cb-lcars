/**
 * @fileoverview Error Formatter for Validation Messages
 *
 * Formats validation errors into user-friendly messages with:
 * - Clear explanations
 * - Suggestions for fixes
 * - Example corrections
 * - Help URLs
 *
 * @module msd/validation/ErrorFormatter
 */

/**
 * Error Formatter
 *
 * Converts validation errors into user-friendly messages.
 */
export class ErrorFormatter {
  constructor() {
    // Error message templates
    this.templates = new Map([
      ['required_field', 'Required field "{field}" is missing'],
      ['invalid_type', 'Field "{field}" has invalid type. Expected {expected}, got {actual}'],
      ['invalid_format', 'Field "{field}" has invalid format'],
      ['out_of_range', 'Field "{field}" value {value} is out of range ({min} to {max})'],
      ['invalid_reference', 'Reference "{reference}" not found in {referenceType}'],
      ['duplicate_id', 'Duplicate ID "{id}" found'],
      ['invalid_enum', 'Field "{field}" must be one of: {validValues}']
    ]);

    // Suggestion templates
    this.suggestions = new Map([
      ['required_field', 'Add the required "{field}" field to your overlay configuration'],
      ['invalid_type', 'Change "{field}" from {actual} to {expected}'],
      ['invalid_format', 'Check the format of "{field}"'],
      ['out_of_range', 'Use a value between {min} and {max} for "{field}"'],
      ['invalid_reference', 'Ensure "{reference}" exists in {referenceType}'],
      ['duplicate_id', 'Change the ID to a unique value'],
      ['invalid_enum', 'Use one of these values: {validValues}']
    ]);
  }

  /**
   * Format validation result into user-friendly message
   *
   * @param {Object} validationResult - Validation result object
   * @returns {string} Formatted error message
   *
   * @example
   * const formatted = formatter.format(validationResult);
   * console.error(formatted);
   */
  format(validationResult) {
    const parts = [];

    // Format for single overlay
    if (validationResult.overlayId) {
      parts.push(this._formatOverlayErrors(validationResult));
    }

    // Format for multiple overlays
    else if (validationResult.results) {
      parts.push(this._formatMultipleOverlays(validationResult));
    }

    return parts.join('\n\n');
  }

  /**
   * Format errors for single overlay
   *
   * @private
   * @param {Object} result - Validation result
   * @returns {string} Formatted message
   */
  _formatOverlayErrors(result) {
    if (result.valid && result.warnings.length === 0) {
      return `✅ Overlay '${result.overlayId}' is valid`;
    }

    const parts = [];

    // Header
    parts.push(`${result.valid ? '⚠️' : '❌'} Validation ${result.valid ? 'Warnings' : 'Errors'} in overlay '${result.overlayId}' (${result.overlayType}):`);
    parts.push('');

    // Errors
    if (result.errors.length > 0) {
      parts.push('Errors:');
      result.errors.forEach((error, index) => {
        parts.push(`  ${index + 1}. ${this._formatError(error)}`);
      });
      parts.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      parts.push('Warnings:');
      result.warnings.forEach((warning, index) => {
        parts.push(`  ${index + 1}. ${this._formatError(warning)}`);
      });
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Format errors for multiple overlays
   *
   * @private
   * @param {Object} validation - Validation summary
   * @returns {string} Formatted message
   */
  _formatMultipleOverlays(validation) {
    const parts = [];

    // Summary
    parts.push(`📊 Validation Summary:`);
    parts.push(`   Total: ${validation.summary.total} overlays`);
    parts.push(`   ✅ Valid: ${validation.summary.valid}`);
    parts.push(`   ❌ Invalid: ${validation.summary.invalid}`);
    parts.push(`   Errors: ${validation.summary.errors}`);
    parts.push(`   Warnings: ${validation.summary.warnings}`);
    parts.push('');

    // Individual overlay errors
    const invalidResults = validation.results.filter(r => !r.valid || r.warnings.length > 0);

    if (invalidResults.length > 0) {
      parts.push('Details:');
      parts.push('');

      invalidResults.forEach(result => {
        parts.push(this._formatOverlayErrors(result));
      });
    }

    return parts.join('\n');
  }

  /**
   * Format a single error
   *
   * @private
   * @param {Object} error - Error object
   * @returns {string} Formatted error
   */
  _formatError(error) {
    const parts = [];

    // Error message
    const message = error.message || this._getTemplateMessage(error);
    parts.push(`${message}`);

    // Field context
    if (error.field) {
      parts.push(`   Field: ${error.field}`);
    }

    // Value context
    if (error.value !== undefined) {
      parts.push(`   Value: ${JSON.stringify(error.value)}`);
    }

    // Expected value
    if (error.expected) {
      parts.push(`   Expected: ${error.expected}`);
    }

    // Suggestion
    const suggestion = error.suggestion || this._getSuggestion(error);
    if (suggestion) {
      parts.push(`   💡 Fix: ${suggestion}`);
    }

    // Help URL
    if (error.helpUrl) {
      parts.push(`   📖 Learn more: ${error.helpUrl}`);
    }

    return parts.join('\n');
  }

  /**
   * Get error message from template
   *
   * @private
   * @param {Object} error - Error object
   * @returns {string} Error message
   */
  _getTemplateMessage(error) {
    const template = this.templates.get(error.type);
    if (!template) {
      return error.type || 'Unknown error';
    }

    // Replace placeholders
    return this._replacePlaceholders(template, error);
  }

  /**
   * Get suggestion from template
   *
   * @private
   * @param {Object} error - Error object
   * @returns {string} Suggestion
   */
  _getSuggestion(error) {
    const template = this.suggestions.get(error.type);
    if (!template) {
      return null;
    }

    return this._replacePlaceholders(template, error);
  }

  /**
   * Replace placeholders in template
   *
   * @private
   * @param {string} template - Template string
   * @param {Object} data - Data for replacement
   * @returns {string} Formatted string
   */
  _replacePlaceholders(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Add custom error template
   *
   * @param {string} type - Error type
   * @param {string} message - Message template
   * @param {string} [suggestion] - Suggestion template
   */
  addTemplate(type, message, suggestion = null) {
    this.templates.set(type, message);
    if (suggestion) {
      this.suggestions.set(type, suggestion);
    }
  }
}

export default ErrorFormatter;