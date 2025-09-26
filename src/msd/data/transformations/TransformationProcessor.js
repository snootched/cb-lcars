import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

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
      cblcarsLog.warn(`[${this.constructor.name}] Transform failed:`, error);
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

    // Enhanced predefined conversion factors
    this.conversions = {
      // Temperature conversions
      '°f_to_°c': (f) => (f - 32) * 5/9,
      'f_to_c': (f) => (f - 32) * 5/9,
      '°c_to_°f': (c) => (c * 9/5) + 32,
      'c_to_f': (c) => (c * 9/5) + 32,
      'k_to_c': (k) => k - 273.15,
      'c_to_k': (c) => c + 273.15,
      'k_to_f': (k) => (k - 273.15) * 9/5 + 32,
      'f_to_k': (f) => (f - 32) * 5/9 + 273.15,

      // Power conversions
      'w_to_kw': (w) => w / 1000,
      'kw_to_w': (kw) => kw * 1000,
      'kw_to_mw': (kw) => kw / 1000,
      'mw_to_kw': (mw) => mw * 1000,
      'w_to_mw': (w) => w / 1000000,
      'mw_to_w': (mw) => mw * 1000000,

      // Energy conversions
      'wh_to_kwh': (wh) => wh / 1000,
      'kwh_to_wh': (kwh) => kwh * 1000,
      'kwh_to_mwh': (kwh) => kwh / 1000,
      'mwh_to_kwh': (mwh) => mwh * 1000,
      'j_to_kwh': (j) => j / 3600000,
      'kwh_to_j': (kwh) => kwh * 3600000,

      // Data size conversions
      'b_to_kb': (b) => b / 1024,
      'kb_to_mb': (kb) => kb / 1024,
      'mb_to_gb': (mb) => mb / 1024,
      'gb_to_tb': (gb) => gb / 1024,
      'kb_to_b': (kb) => kb * 1024,
      'mb_to_kb': (mb) => mb * 1024,
      'gb_to_mb': (gb) => gb * 1024,
      'tb_to_gb': (tb) => tb * 1024,

      // Pressure conversions
      'hpa_to_mmhg': (hpa) => hpa * 0.750062,
      'mmhg_to_hpa': (mmhg) => mmhg / 0.750062,
      'psi_to_hpa': (psi) => psi * 68.9476,
      'hpa_to_psi': (hpa) => hpa / 68.9476,
      'bar_to_hpa': (bar) => bar * 1000,
      'hpa_to_bar': (hpa) => hpa / 1000,

      // Speed conversions
      'ms_to_kmh': (ms) => ms * 3.6,
      'kmh_to_ms': (kmh) => kmh / 3.6,
      'mph_to_kmh': (mph) => mph * 1.60934,
      'kmh_to_mph': (kmh) => kmh / 1.60934,
      'ms_to_mph': (ms) => ms * 2.23694,
      'mph_to_ms': (mph) => mph / 2.23694,

      // Distance conversions
      'mm_to_cm': (mm) => mm / 10,
      'cm_to_m': (cm) => cm / 100,
      'm_to_km': (m) => m / 1000,
      'ft_to_m': (ft) => ft * 0.3048,
      'm_to_ft': (m) => m / 0.3048,
      'in_to_cm': (inch) => inch * 2.54,
      'cm_to_in': (cm) => cm / 2.54,

      // Volume conversions
      'l_to_ml': (l) => l * 1000,
      'ml_to_l': (ml) => ml / 1000,
      'gal_to_l': (gal) => gal * 3.78541,
      'l_to_gal': (l) => l / 3.78541,

      // Home Assistant specific conversions
      'lux_to_percent': (lux) => Math.min(100, (lux / 1000) * 100),
      'percent_to_decimal': (percent) => percent / 100,
      'decimal_to_percent': (decimal) => decimal * 100,

      // Brightness conversions (common HA use case)
      'brightness_to_percent': (brightness) => Math.round((brightness / 255) * 100),
      'percent_to_brightness': (percent) => Math.round((percent / 100) * 255),
      'brightness_255_to_percent': (brightness) => Math.round((brightness / 255) * 100),
      'percent_to_brightness_255': (percent) => Math.round((percent / 100) * 255),

      // RGB/Color conversions
      'rgb_to_percent': (rgb) => Math.round((rgb / 255) * 100),
      'percent_to_rgb': (percent) => Math.round((percent / 100) * 255),

      // Battery/charge conversions
      'voltage_to_percent': (voltage, min = 3.0, max = 4.2) => Math.max(0, Math.min(100, ((voltage - min) / (max - min)) * 100)),

      // HVAC conversions
      'hvac_percent_to_decimal': (percent) => percent / 100,
      'hvac_decimal_to_percent': (decimal) => decimal * 100,

      // Media volume conversions
      'volume_to_percent': (volume) => Math.round(volume * 100),
      'percent_to_volume': (percent) => percent / 100,

      // Signal strength conversions
      'dbm_to_percent': (dbm) => Math.max(0, Math.min(100, 2 * (dbm + 100))), // Rough WiFi conversion
      'rssi_to_percent': (rssi) => Math.max(0, Math.min(100, (rssi + 100) * 2)), // Generic signal strength

      // Humidity comfort mappings
      'humidity_to_comfort': (humidity) => {
        if (humidity < 30) return 'dry';
        if (humidity > 60) return 'humid';
        return 'comfortable';
      }
    };

    // NEW: Support direct conversion format (e.g., "cm_to_in")
    this.directConversion = config.conversion || config.type === 'unit_conversion' && config.conversion;

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

    // NEW: Direct conversion format (e.g., "cm_to_in")
    if (this.directConversion && this.conversions[this.directConversion]) {
      return this.conversions[this.directConversion](value);
    }

    // Try multiple conversion key formats using from/to units
    if (this.fromUnit && this.toUnit) {
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
    }

    // Simple factor conversion
    if (Number.isFinite(this.factor)) {
      return (value * this.factor) + this.offset;
    }

    // Build error message with available conversions
    const availableConversions = Object.keys(this.conversions).join(', ');
    throw new Error(`No conversion method available for ${this.fromUnit || this.directConversion} to ${this.toUnit || 'unknown'}. Available: ${availableConversions}`);
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
    this.curve = config.curve || 'linear'; // linear, logarithmic, exponential, square, sqrt

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

    // Normalize to 0-1 range
    const ratio = (inputValue - inMin) / (inMax - inMin);

    // Apply curve transformation
    let curvedRatio;
    switch (this.curve) {
      case 'logarithmic':
        curvedRatio = Math.log(1 + ratio * 9) / Math.log(10); // log10(1 + 9*ratio)
        break;
      case 'exponential':
        curvedRatio = (Math.pow(10, ratio) - 1) / 9;
        break;
      case 'square':
        curvedRatio = ratio * ratio;
        break;
      case 'sqrt':
        curvedRatio = Math.sqrt(ratio);
        break;
      case 'linear':
      default:
        curvedRatio = ratio;
        break;
    }

    // Map to output range
    return outMin + curvedRatio * (outMax - outMin);
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

    // Store additional inputs for multi-entity expressions
    this.inputs = config.inputs || [];
    this.hass = config.hass; // For accessing other entities

    // Pre-compile the expression for performance
    try {
      // Enhanced context with inputs support
      this._compiledFunction = new Function('value', 'timestamp', 'buffer', 'Math', 'inputs', 'getEntity', `
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
      // Gather input values from other entities
      const inputs = this.inputs.map(entityId => {
        if (this.hass?.states?.[entityId]) {
          const state = this.hass.states[entityId].state;
          const numValue = parseFloat(state);
          return isNaN(numValue) ? 0 : numValue;
        }
        return 0;
      });

      // Simple getEntity function for expression context
      const getEntity = (entityId) => {
        if (this.hass?.states?.[entityId]) {
          const state = this.hass.states[entityId].state;
          const numValue = parseFloat(state);
          return isNaN(numValue) ? 0 : numValue;
        }
        return 0;
      };

      const result = this._compiledFunction(value, timestamp, buffer, Math, inputs, getEntity);
      return Number.isFinite(result) ? result : null;
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error.message}`);
    }
  }
}

/**
 * Statistical Processor
 * Calculates rolling statistical measures (percentiles, standard deviation, etc.)
 */
export class StatisticalProcessor extends TransformationProcessor {
  constructor(config) {
    super(config);

    this.method = config.method || 'std_dev'; // std_dev, percentile, z_score
    this.windowSize = config.window_size || config.windowSize || 10;
    this.percentile = config.percentile || 95; // For percentile method

    // Rolling window for calculations
    this._window = [];
  }

  _doTransform(value, timestamp, buffer) {
    if (!Number.isFinite(value)) return null;

    // Update rolling window
    this._window.push(value);
    if (this._window.length > this.windowSize) {
      this._window.shift();
    }

    // Need at least 2 values for statistical calculations
    if (this._window.length < 2) return value;

    switch (this.method) {
      case 'std_dev':
        return this._calculateStdDev();
      case 'percentile':
        return this._calculatePercentile();
      case 'z_score':
        return this._calculateZScore(value);
      default:
        throw new Error(`Unknown statistical method: ${this.method}`);
    }
  }

  _calculateStdDev() {
    const mean = this._window.reduce((sum, val) => sum + val, 0) / this._window.length;
    const variance = this._window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this._window.length;
    return Math.sqrt(variance);
  }

  _calculatePercentile() {
    const sorted = [...this._window].sort((a, b) => a - b);
    const index = (this.percentile / 100) * (sorted.length - 1);

    if (Number.isInteger(index)) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }

  _calculateZScore(value) {
    const mean = this._window.reduce((sum, val) => sum + val, 0) / this._window.length;
    const stdDev = this._calculateStdDev();
    return stdDev === 0 ? 0 : (value - mean) / stdDev;
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

    case 'statistical':
      return new StatisticalProcessor(config);

    default:
      throw new Error(`Unknown transformation type: ${config.type}`);
  }
}