/**
 * RollingBuffer - Efficient circular buffer for time-series data
 *
 * Features:
 * - Fixed capacity with automatic overflow handling
 * - Time-based slicing for windowed data access
 * - Optimized for sparkline/ribbon real-time updates
 * - Memory efficient - no array reallocations during normal operation
 */
export class RollingBuffer {
  constructor(capacity = 100) {
    if (capacity < 1) {
      throw new Error('RollingBuffer capacity must be at least 1');
    }

    // Cap capacity at reasonable maximum for memory efficiency
    this.capacity = Math.min(capacity, 1000);

    // Pre-allocate arrays for performance
    this._timestamps = new Array(capacity);
    this._values = new Array(capacity);

    // Circular buffer state
    this._head = 0;      // Next write position
    this._size = 0;      // Current number of items
    this._full = false;  // Whether we've wrapped around

    // Performance tracking
    this._stats = {
      pushes: 0,
      overwrites: 0,
      queries: 0
    };

    // Add coalescing state
    this._lastPushTime = 0;
    this._coalescingThresholdMs = 10; // Coalesce pushes within 10ms
  }

  /**
   * Add a new data point (timestamp, value)
   * Automatically handles capacity overflow by replacing oldest data
   */
  push(timestamp, value) {
    // Enhanced timestamp validation
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const oneHourFromNow = now + (60 * 60 * 1000);

    // Check for reasonable timestamp range
    if (timestamp < oneYearAgo || timestamp > oneHourFromNow) {
      console.debug(`[RollingBuffer] Suspicious timestamp: ${timestamp} (${new Date(timestamp).toISOString()}), current: ${now} (${new Date(now).toISOString()})`);
      // Don't reject, but log for debugging
    }

    // Validate inputs
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      console.debug('[RollingBuffer] Invalid timestamp:', timestamp);
      return;
    }

    if (typeof value !== 'number' || !isFinite(value)) {
      console.debug(`[RollingBuffer] Invalid value: ${value} for timestamp ${timestamp}`);
      return;
    }

    // AGGRESSIVE COALESCING: Skip if very recent push with similar timestamp
    if (this._size > 0 && (now - this._lastPushTime) < this._coalescingThresholdMs) {
      // Check if timestamp is very close to last timestamp
      const lastIndex = this._head === 0 ? this.capacity - 1 : this._head - 1;
      const lastTimestamp = this._timestamps[lastIndex];

      if (Math.abs(timestamp - lastTimestamp) < 1000) { // Within 1 second
        // COALESCE: Just update the value, don't add new point
        this._values[lastIndex] = value;
        this._stats.overwrites++; // Count as coalescence
        this._lastPushTime = now;
        return;
      }
    }

    // Store at current head position
    this._timestamps[this._head] = timestamp;
    this._values[this._head] = value;

    // Update statistics
    this._stats.pushes++;
    if (this._full) {
      this._stats.overwrites++;
    }

    // Advance head pointer (circular)
    this._head = (this._head + 1) % this.capacity;

    // Update size tracking
    if (this._size < this.capacity) {
      this._size++;
    } else {
      this._full = true;
    }

    this._lastPushTime = now;

    // Only log occasionally to avoid console spam
    //if (this._stats.pushes % 100 === 0 || this._size <= 5) {
    //  console.debug(`[RollingBuffer] Added point: ${value} at ${new Date(timestamp).toISOString()} (buffer size: ${this._size}, total pushes: ${this._stats.pushes})`);
    //}
  }

  /**
   * Add method (alias for push for compatibility)
   * @param {number} timestamp - Data timestamp
   * @param {number} value - Data value
   */
  add(timestamp, value) {
    return this.push(timestamp, value);
  }

  /**
   * Get data as parallel arrays { t: timestamps[], v: values[] }
   * Returns data in chronological order (oldest first)
   */
  getArrays() {
    this._stats.queries++;

    if (this._size === 0) {
      return { t: [], v: [] };
    }

    const t = new Array(this._size);
    const v = new Array(this._size);

    // Calculate start position (oldest data)
    const startPos = this._full ? this._head : 0;

    // Copy data in chronological order
    for (let i = 0; i < this._size; i++) {
      const bufferIndex = (startPos + i) % this.capacity;
      t[i] = this._timestamps[bufferIndex];
      v[i] = this._values[bufferIndex];
    }

    return { t, v };
  }

  /**
   * Get all data points in chronological order
   * @returns {Array} Array of {t: timestamp, v: value} objects
   */
  getAll() {
    this._stats.queries++;

    if (this._size === 0) {
      return [];
    }

    const result = new Array(this._size);

    // Calculate start position (oldest data)
    const startPos = this._full ? this._head : 0;

    // Copy data in chronological order
    for (let i = 0; i < this._size; i++) {
      const bufferIndex = (startPos + i) % this.capacity;
      result[i] = {
        t: this._timestamps[bufferIndex],
        v: this._values[bufferIndex]
      };
    }

    return result;
  }

  /**
   * Get data points newer than specified time window (in milliseconds)
   * @param {number} msWindow - Time window in milliseconds from now
   * @returns {object} { t: timestamps[], v: values[] }
   */
  sliceSince(msWindow) {
    this._stats.queries++;

    if (this._size === 0 || !Number.isFinite(msWindow) || msWindow <= 0) {
      return { t: [], v: [] };
    }

    const cutoffTime = Date.now() - msWindow;
    const { t, v } = this.getArrays();

    // Find first index where timestamp >= cutoffTime
    let startIndex = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] >= cutoffTime) {
        startIndex = i;
        break;
      }
    }

    // Return slice from startIndex to end
    return {
      t: t.slice(startIndex),
      v: v.slice(startIndex)
    };
  }

  /**
   * Get the most recent data point
   * @returns {object|null} { t: timestamp, v: value } or null if empty
   */
  last() {
    if (this._size === 0) {
      return null;
    }

    // Most recent item is just before current head position
    const lastIndex = this._head === 0 ? this.capacity - 1 : this._head - 1;

    return {
      t: this._timestamps[lastIndex],
      v: this._values[lastIndex]
    };
  }

  /**
   * Get the oldest data point
   * @returns {object|null} { t: timestamp, v: value } or null if empty
   */
  first() {
    if (this._size === 0) {
      return null;
    }

    const firstIndex = this._full ? this._head : 0;

    return {
      t: this._timestamps[firstIndex],
      v: this._values[firstIndex]
    };
  }

  /**
   * Clear all data while preserving capacity
   */
  clear() {
    this._head = 0;
    this._size = 0;
    this._full = false;

    // Performance: don't actually clear arrays, just reset pointers
    // Data will be naturally overwritten as new data comes in
  }

  /**
   * Get current buffer statistics
   */
  getStats() {
    return {
      capacity: this.capacity,
      size: this._size,
      utilization: this._size / this.capacity,
      pushes: this._stats.pushes,
      overwrites: this._stats.overwrites,
      queries: this._stats.queries,
      overwriteRate: this._stats.pushes > 0 ? this._stats.overwrites / this._stats.pushes : 0
    };
  }

  /**
   * Check if buffer is at full capacity
   */
  isFull() {
    return this._full;
  }

  /**
   * Get number of items currently stored
   */
  size() {
    return this._size;
  }

  /**
   * Debug method: validate internal consistency
   * @returns {boolean} true if consistent
   */
  _validateConsistency() {
    const issues = [];

    // Check size bounds
    if (this._size < 0 || this._size > this.capacity) {
      issues.push(`Invalid size: ${this._size} (capacity: ${this.capacity})`);
    }

    // Check head bounds
    if (this._head < 0 || this._head >= this.capacity) {
      issues.push(`Invalid head: ${this._head} (capacity: ${this.capacity})`);
    }

    // Check full flag consistency
    if (this._full && this._size !== this.capacity) {
      issues.push(`Full flag inconsistent: full=${this._full}, size=${this._size}, capacity=${this.capacity}`);
    }

    // Check timestamp ordering (within stored data)
    if (this._size > 1) {
      const { t } = this.getArrays();
      for (let i = 1; i < t.length; i++) {
        if (t[i] < t[i-1]) {
          issues.push(`Timestamp ordering violation at index ${i}: ${t[i-1]} -> ${t[i]}`);
          break; // Only report first violation
        }
      }
    }

    if (issues.length > 0) {
      console.warn('[RollingBuffer] Consistency issues:', issues);
      return false;
    }

    return true;
  }

  /**
   * Get recent points (compatibility method for DataSource) - FIXED VERSION
   * @param {number} count - Number of recent points to return
   * @returns {Array} Array of recent data points
   */
  getRecent(count = 100) {
    if (this._size === 0) {
      return [];
    }

    const points = [];
    const maxCount = Math.min(count, this._size);

    for (let i = 0; i < maxCount; i++) {
      const index = (this._head - 1 - i + this.capacity) % this.capacity;
      const point = {
        t: this._timestamps[index],
        v: this._values[index]
      };
      if (point.t !== undefined && point.v !== undefined) {
        points.push({
          timestamp: point.t,
          value: point.v,
          t: point.t,
          v: point.v
        });
      }
    }

    return points;
  }
}
