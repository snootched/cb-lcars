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
    // Validate inputs
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      console.warn('[RollingBuffer] Invalid timestamp:', timestamp);
      return;
    }

    if (!Number.isFinite(value)) {
      console.warn('[RollingBuffer] Invalid value:', value);
      return;
    }

    // AGGRESSIVE COALESCING: Skip if very recent push with similar timestamp
    const now = Date.now();
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
}
