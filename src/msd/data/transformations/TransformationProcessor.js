/**
 * TransformationProcessor - Base class for data transformations
 *
 * Features:
 * - Chainable transformations with configurable keys
 * - Type-safe transformation pipeline
 * - Error handling and fallback values
 * - Performance tracking
 */

export class TransformationProcessor {
  constructor(config) {
    this.config = { ...config };
    this.key = config.key || this.constructor.name.toLowerCase();
    this.enabled = config.enabled !== false;

    // Performance tracking
    this._stats = {
      transformations: 0,
      errors: 0,
      totalTime: 0
    };
  }

  /**
   * Transform a value with timing and error handling
   * @param {number} value - Input value
   * @param {number} timestamp - Current timestamp
   * @param {RollingBuffer} buffer - Historical data buffer
   * @returns {number|null} Transformed value or null on error
   */
  transform(value, timestamp, buffer) {
    if (!this.enabled) return value;

    const startTime = performance.now();

    try {
      const result = this._doTransform(value, timestamp, buffer);

      this._stats.transformations++;
      this._stats.totalTime += performance.now() - startTime;

      return result;
    } catch (error) {
      this._stats.errors++;
      console.warn(`[${this.constructor.name}] Transform failed:`, error);
      return this._getFallbackValue(value);
    }
  }

  /**
   * Override this method in subclasses to implement transformation logic
   * @protected
   * @param {number} value - Input value
   * @param {number} timestamp - Current timestamp
   * @param {RollingBuffer} buffer - Historical data buffer
   * @returns {number} Transformed value
   */
  _doTransform(value, timestamp, buffer) {
    throw new Error('_doTransform must be implemented by subclasses');
  }

  /**
   * Get fallback value on transformation error
   * @protected
   * @param {number} originalValue - Original input value
   * @returns {number|null} Fallback value
   */
  _getFallbackValue(originalValue) {
    return originalValue; // Default: return original value
  }

  /**
   * Get transformation statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      key: this.key,
      enabled: this.enabled,
      avgTime: this._stats.transformations > 0 ?
        this._stats.totalTime / this._stats.transformations : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this._stats = {
      transformations: 0,
      errors: 0,
      totalTime: 0
    };
  }
}

/**
 * Unit Conversion Processor
 * Converts between different units using configurable factors or functions
 */
export class UnitConversionProcessor extends TransformationProcessor {
  constructor(config) {
    super(config);

    // Predefined conversion factors
    this.conversions = {
      '°f_to_°c': (f) => (f - 32) * 5/9,
      'f_to_c': (f) => (f - 32) * 5/9,
      '°c_to_°f': (c) => (c * 9/5) + 32,
      'c_to_f': (c) => (c * 9/5) + 32,
      'w_to_kw': (w) => w / 1000,
      'kw_to_w': (kw) => kw * 1000,
      'kb_to_mb': (kb) => kb / 1024,
      'mb_to_gb': (mb) => mb / 1024
    };

    this.fromUnit = config.from?.toLowerCase();
    this.toUnit = config.to?.toLowerCase();
    this.factor = config.factor;
    this.offset = config.offset || 0;
    this.customFunction = config.customFunction;
  }  _doTransform(value, timestamp, buffer) {
    if (!Number.isFinite(value)) return null;

    // Custom function takes precedence
    if (this.customFunction && typeof this.customFunction === 'function') {
      return this.customFunction(value);
    }

    // Try multiple conversion key formats
    const conversionKeys = [
      `${this.fromUnit}_to_${this.toUnit}`,
      `${this.fromUnit.replace(/°/g, '')}_to_${this.toUnit.replace(/°/g, '')}`,
      `${this.fromUnit.replace(/[°\s]/g, '')}_to_${this.toUnit.replace(/[°\s]/g, '')}`
    ];

    for (const conversionKey of conversionKeys) {
      if (this.conversions[conversionKey]) {
        return this.conversions[conversionKey](value);
      }
    }

    // Simple factor conversion
    if (Number.isFinite(this.factor)) {
      return (value * this.factor) + this.offset;
    }

    throw new Error(`No conversion method available for ${this.fromUnit} to ${this.toUnit}. Available: ${Object.keys(this.conversions).join(', ')}`);
  }
}

/**
 * Scale/Range Processor
 * Maps input values from one range to another range
 */
export class ScaleProcessor extends TransformationProcessor {
  constructor(config) {
    super(config);

    this.inputRange = config.input_range || config.inputRange || [0, 100];
    this.outputRange = config.output_range || config.outputRange || [0, 1];
    this.clamp = config.clamp !== false; // Default to true

    if (!Array.isArray(this.inputRange) || this.inputRange.length !== 2) {
      throw new Error('input_range must be an array of 2 numbers');
    }
    if (!Array.isArray(this.outputRange) || this.outputRange.length !== 2) {
      throw new Error('output_range must be an array of 2 numbers');
    }
  }

  _doTransform(value, timestamp, buffer) {
    if (!Number.isFinite(value)) return null;

    const [inMin, inMax] = this.inputRange;
    const [outMin, outMax] = this.outputRange;

    // Clamp input if enabled
    let inputValue = this.clamp ?
      Math.max(inMin, Math.min(inMax, value)) : value;

    // Linear interpolation
    const ratio = (inputValue - inMin) / (inMax - inMin);
    return outMin + ratio * (outMax - outMin);
  }
}

/**
 * Smoothing Processor
 * Applies various smoothing algorithms to reduce noise
 */
export class SmoothingProcessor extends TransformationProcessor {
  constructor(config) {
    super(config);

    this.method = config.method || 'exponential';
    this.alpha = config.alpha || 0.3; // For exponential smoothing
    this.windowSize = config.window_size || config.windowSize || 5; // For moving average

    // State for smoothing algorithms
    this._lastSmoothed = null;
    this._window = [];
  }

  _doTransform(value, timestamp, buffer) {
    if (!Number.isFinite(value)) return null;

    switch (this.method) {
      case 'exponential':
        return this._exponentialSmooth(value);

      case 'moving_average':
        return this._movingAverage(value);

      case 'median':
        return this._medianFilter(value);

      default:
        throw new Error(`Unknown smoothing method: ${this.method}`);
    }
  }

  _exponentialSmooth(value) {
    if (this._lastSmoothed === null) {
      this._lastSmoothed = value;
      return value;
    }

    this._lastSmoothed = this.alpha * value + (1 - this.alpha) * this._lastSmoothed;
    return this._lastSmoothed;
  }

  _movingAverage(value) {
    this._window.push(value);

    if (this._window.length > this.windowSize) {
      this._window.shift();
    }

    const sum = this._window.reduce((acc, val) => acc + val, 0);
    return sum / this._window.length;
  }

  _medianFilter(value) {
    this._window.push(value);

    if (this._window.length > this.windowSize) {
      this._window.shift();
    }

    const sorted = [...this._window].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0 ?
      (sorted[mid - 1] + sorted[mid]) / 2 :
      sorted[mid];
  }
}

/**
 * Expression Processor
 * Evaluates JavaScript expressions with context
 */
export class ExpressionProcessor extends TransformationProcessor {
  constructor(config) {
    super(config);

    this.expression = config.expression;
    if (!this.expression) {
      throw new Error('Expression is required for ExpressionProcessor');
    }

    // Pre-compile the expression for performance
    try {
      this._compiledFunction = new Function('value', 'timestamp', 'buffer', 'Math', `
        "use strict";
        return (${this.expression});
      `);
    } catch (error) {
      throw new Error(`Failed to compile expression: ${error.message}`);
    }
  }

  _doTransform(value, timestamp, buffer) {
    if (!Number.isFinite(value)) return null;

    try {
      const result = this._compiledFunction(value, timestamp, buffer, Math);
      return Number.isFinite(result) ? result : null;
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error.message}`);
    }
  }
}

/**
 * Create a transformation processor from configuration
 * @param {Object} config - Transformation configuration
 * @returns {TransformationProcessor} Configured processor instance
 */
export function createTransformationProcessor(config) {
  if (!config || !config.type) {
    throw new Error('Transformation config must specify a type');
  }

  switch (config.type) {
    case 'unit_conversion':
      return new UnitConversionProcessor(config);

    case 'scale':
      return new ScaleProcessor(config);

    case 'smooth':
      return new SmoothingProcessor(config);

    case 'expression':
      return new ExpressionProcessor(config);

    default:
      throw new Error(`Unknown transformation type: ${config.type}`);
  }
}