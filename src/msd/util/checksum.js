/**
 * Canonical checksum generation for MSD configurations
 * Uses Web Crypto API for browser compatibility
 */

export async function computeCanonicalChecksum(obj) {
  const cleaned = stripMetaFields(obj);
  const stable = stableStringify(cleaned);

  // Use Web Crypto API (available in browsers and Node 16+)
  const encoder = new TextEncoder();
  const data = encoder.encode(stable);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Return first 10 characters for readability
  return hashHex.substring(0, 10);
}

function stripMetaFields(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(stripMetaFields);
  }

  const cleaned = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip metadata fields that don't affect semantic meaning
    if (key.startsWith('__') ||
        key === 'checksum' ||
        key === 'origin_pack' ||
        key === 'timestamp') {
      continue;
    }

    cleaned[key] = stripMetaFields(value);
  }

  return cleaned;
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map(stableStringify);
    return `[${items.join(',')}]`;
  }

  // Sort object keys for deterministic output
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const value = stableStringify(obj[key]);
    return `"${key}":${value}`;
  });

  return `{${pairs.join(',')}}`;
}

/**
 * Compare two objects for semantic equality (ignoring metadata)
 */
export function semanticEquals(obj1, obj2) {
  const clean1 = stripMetaFields(obj1);
  const clean2 = stripMetaFields(obj2);
  return stableStringify(clean1) === stableStringify(clean2);
}
