/**
 * Object hashing utilities for semantic comparison
 * Used by animation registry and other caching systems
 */

/**
 * Compute deterministic hash of an object
 */
export function computeObjectHash(obj) {
  const normalized = normalizeForHashing(obj);
  const serialized = stableStringify(normalized);
  return simpleHash(serialized);
}

/**
 * Normalize object for consistent hashing
 */
function normalizeForHashing(obj) {
  if (obj === null || obj === undefined) return null;

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(normalizeForHashing);
  }

  const normalized = {};
  Object.keys(obj).sort().forEach(key => {
    normalized[key] = normalizeForHashing(obj[key]);
  });

  return normalized;
}

/**
 * Stable JSON stringify with sorted keys
 */
function stableStringify(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => `"${key}":${stableStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Simple but effective hash function
 */
function simpleHash(str) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert to positive string
  return Math.abs(hash).toString(36);
}

/**
 * Compare two objects for semantic equality
 */
export function objectsEqual(a, b) {
  return computeObjectHash(a) === computeObjectHash(b);
}

/**
 * Hash array of objects consistently
 */
export function hashArray(arr) {
  if (!Array.isArray(arr)) return computeObjectHash(arr);

  const hashes = arr.map(computeObjectHash);
  return simpleHash(hashes.join('|'));
}
