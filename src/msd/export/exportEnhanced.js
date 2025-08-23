/**
 * Enhanced export system with metadata control and canonicalization
 * Supports multiple export formats and parity testing
 */

/**
 * Export full snapshot with comprehensive metadata options
 */
export function exportFullSnapshot(mergedConfig, options = {}) {
  const {
    includeProvenance = true,
    includePerformance = false,
    includeInternal = false,
    minify = false,
    format = 'json'
  } = options;

  const snapshot = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    export_options: {
      includeProvenance,
      includePerformance,
      includeInternal,
      minify
    }
  };

  // Core configuration (always included)
  snapshot.config = extractCoreConfig(mergedConfig);

  // Optional metadata sections
  if (includeProvenance) {
    snapshot.provenance = sanitizeProvenance(mergedConfig.__provenance);
  }

  if (includePerformance) {
    snapshot.performance = extractPerformanceData(mergedConfig);
  }

  if (includeInternal) {
    snapshot.internal = extractInternalData(mergedConfig);
  }

  // Apply canonicalization
  const canonicalized = canonicalizeSnapshot(snapshot);

  // Format conversion
  if (format === 'yaml') {
    return convertToYaml(canonicalized);
  }

  return minify ? JSON.stringify(canonicalized) : JSON.stringify(canonicalized, null, 2);
}

/**
 * Export collapsed user configuration (user layer only)
 */
export function exportCollapsed(userConfig, options = {}) {
  const {
    stripMeta = true,
    canonicalize = true,
    format = 'json'
  } = options;

  let exported = extractUserLayer(userConfig);

  if (stripMeta) {
    exported = stripMetadata(exported);
  }

  if (canonicalize) {
    exported = canonicalizeConfig(exported);
  }

  if (format === 'yaml') {
    return convertToYaml(exported);
  }

  return JSON.stringify(exported, null, 2);
}

/**
 * Export semantic diff between two configurations
 */
export function exportConfigDiff(configA, configB, options = {}) {
  const diff = {
    timestamp: new Date().toISOString(),
    comparison: {
      a_checksum: configA.checksum,
      b_checksum: configB.checksum,
      identical: configA.checksum === configB.checksum
    },
    changes: {}
  };

  if (!diff.comparison.identical) {
    diff.changes = computeSemanticDiff(configA, configB);
  }

  return JSON.stringify(diff, null, 2);
}

function extractCoreConfig(mergedConfig) {
  const core = {};
  const coreFields = [
    'version', 'view_box', 'anchors', 'palettes', 'profiles',
    'overlays', 'rules', 'animations', 'timelines', 'routing',
    'data_sources', 'active_profiles'
  ];

  coreFields.forEach(field => {
    if (mergedConfig[field] !== undefined) {
      core[field] = structuredClone(mergedConfig[field]);
    }
  });

  return core;
}

function extractUserLayer(userConfig) {
  const userOnly = {};
  const userFields = [
    'version', 'use_packs', 'base_svg', 'view_box', 'anchors',
    'palettes', 'overlays', 'rules', 'animations', 'profiles',
    'timelines', 'routing', 'data_sources', 'active_profiles', 'remove'
  ];

  userFields.forEach(field => {
    if (userConfig[field] !== undefined) {
      userOnly[field] = structuredClone(userConfig[field]);
    }
  });

  return userOnly;
}

function stripMetadata(config) {
  const stripped = structuredClone(config);

  // Remove internal fields
  const metaFields = [
    '__provenance', '__performance', '__issues', '__raw_msd',
    'checksum', 'origin_pack', '_extracted_anchors', '_styleSources'
  ];

  function removeMetaFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(removeMetaFields);
    }

    const cleaned = {};
    Object.keys(obj).forEach(key => {
      if (!metaFields.includes(key) && !key.startsWith('__')) {
        cleaned[key] = removeMetaFields(obj[key]);
      }
    });

    return cleaned;
  }

  return removeMetaFields(stripped);
}

function canonicalizeConfig(config) {
  function canonicalizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(canonicalizeObject);
    }

    // Sort keys for deterministic output
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = canonicalizeObject(obj[key]);
    });

    return sorted;
  }

  return canonicalizeObject(config);
}

function canonicalizeSnapshot(snapshot) {
  // Specific ordering for snapshot sections
  const ordered = {};
  const sectionOrder = ['timestamp', 'version', 'export_options', 'config', 'provenance', 'performance', 'internal'];

  sectionOrder.forEach(section => {
    if (snapshot[section] !== undefined) {
      ordered[section] = canonicalizeConfig(snapshot[section]);
    }
  });

  return ordered;
}

function sanitizeProvenance(provenance) {
  if (!provenance) return null;

  const sanitized = structuredClone(provenance);

  // Remove sensitive data from provenance
  function sanitizeProvenanceData(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(sanitizeProvenanceData);
    }

    const cleaned = {};
    Object.keys(obj).forEach(key => {
      if (key === 'override_history') {
        // Limit history to prevent huge exports
        const history = obj[key];
        cleaned[key] = Array.isArray(history) ? history.slice(-5) : history;
      } else {
        cleaned[key] = sanitizeProvenanceData(obj[key]);
      }
    });

    return cleaned;
  }

  return sanitizeProvenanceData(sanitized);
}

function extractPerformanceData(mergedConfig) {
  // Extract performance data from global tracker if available
  try {
    const debugNamespace = (typeof window !== 'undefined') ? window : global;
    const perfData = debugNamespace.__msdPerf?.getAll?.();

    if (perfData) {
      return {
        session: perfData.session,
        summary: perfData.summary,
        merge_time_ms: mergedConfig.__performance?.merge_time_ms
      };
    }
  } catch (e) {}

  return {
    merge_time_ms: mergedConfig.__performance?.merge_time_ms || null
  };
}

function extractInternalData(mergedConfig) {
  return {
    checksum: mergedConfig.checksum,
    validation_issues: mergedConfig.__issues || null,
    merge_order: mergedConfig.__provenance?.merge_order || null
  };
}

function computeSemanticDiff(configA, configB) {
  const changes = {
    added: {},
    removed: {},
    modified: {},
    collections: {}
  };

  const coreFields = ['anchors', 'palettes', 'overlays', 'rules', 'animations', 'profiles', 'timelines'];

  coreFields.forEach(field => {
    const aValue = configA[field];
    const bValue = configB[field];

    if (JSON.stringify(aValue) !== JSON.stringify(bValue)) {
      if (Array.isArray(aValue) && Array.isArray(bValue)) {
        changes.collections[field] = diffCollection(aValue, bValue);
      } else {
        changes.modified[field] = {
          before: aValue,
          after: bValue
        };
      }
    }
  });

  return changes;
}

function diffCollection(collectionA, collectionB) {
  const aById = new Map(collectionA.filter(item => item.id).map(item => [item.id, item]));
  const bById = new Map(collectionB.filter(item => item.id).map(item => [item.id, item]));

  const diff = {
    added: [],
    removed: [],
    modified: []
  };

  // Find added items
  bById.forEach((item, id) => {
    if (!aById.has(id)) {
      diff.added.push(item);
    }
  });

  // Find removed and modified items
  aById.forEach((itemA, id) => {
    if (!bById.has(id)) {
      diff.removed.push(itemA);
    } else {
      const itemB = bById.get(id);
      if (JSON.stringify(itemA) !== JSON.stringify(itemB)) {
        diff.modified.push({
          id,
          before: itemA,
          after: itemB
        });
      }
    }
  });

  return diff;
}

function convertToYaml(obj) {
  // Simplified YAML converter for basic structures
  // In production, would use a proper YAML library
  return `# Generated YAML - simplified conversion\n${JSON.stringify(obj, null, 2)}`;
}

// Node.js and browser compatibility
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdExport = {
    exportFullSnapshot,
    exportCollapsed,
    exportConfigDiff
  };
}
