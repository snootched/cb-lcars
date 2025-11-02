import { computeCanonicalChecksum } from '../util/checksum.js';
import { perfTime, perfTimeAsync, perfCount } from '../util/performance.js';
import { loadBuiltinPacks } from './loadBuiltinPacks.js';
import { chartTemplateRegistry } from '../templates/ChartTemplateRegistry.js';

/**
 * Single consolidated merge algorithm - COMPLETE REPLACEMENT
 * Removes all legacy dual merge logic per Milestone 1.1
 *
 * ENHANCED: Now tracks comprehensive provenance including theme system
 */
export async function mergePacks(userConfig) {
  return await perfTimeAsync('merge.total', async () => {
    const layers = await perfTimeAsync('merge.loadLayers', () => loadAllLayers(userConfig));
    const merged = await perfTimeAsync('merge.processSingle', () => processSinglePass(layers));

    // NEW: Register chart templates from packs
    const packLayers = layers.filter(layer => layer.type === 'builtin' || layer.type === 'external');
    packLayers.forEach(layer => {
      if (layer.data.chartTemplates) {
        chartTemplateRegistry.registerFromPack(layer.data.id || layer.pack, layer.data.chartTemplates);
      }
    });

    return merged;
  }, {
    config_overlays: userConfig.overlays?.length || 0,
    config_rules: userConfig.rules?.length || 0,
    config_anchors: Object.keys(userConfig.anchors || {}).length,
    use_packs: userConfig.use_packs?.builtin?.length || 0
  });
}

async function loadAllLayers(userConfig) {
  const layers = [];

  // Load builtin packs first - USE OUR ACTUAL PACK LOADING FUNCTION
  const builtinPackNames = userConfig.use_packs?.builtin || ['core'];
  const builtinPacks = loadBuiltinPacks(builtinPackNames);

  builtinPacks.forEach((pack, index) => {
    if (pack) {
      layers.push({
        type: 'builtin',
        pack: pack.id,
        data: pack,
        priority: 100 + index
      });
    }
  });

  // Load external packs with timeout
  if (userConfig.use_packs?.external?.length > 0) {
    const externalResults = await loadExternalPacks(userConfig.use_packs.external);
    externalResults.forEach((result, index) => {
      if (result.data && !result.error) {
        layers.push({
          type: 'external',
          pack: result.url,
          data: result.data,
          priority: 200 + index
        });
      }
    });
  }

  // User config layer (highest priority)
  layers.push({
    type: 'user',
    pack: 'user_config',
    data: userConfig,
    priority: 1000
  });

  return layers.sort((a, b) => a.priority - b.priority);
}

async function processSinglePass(layers) {
  const merged = {
    version: 1,
    anchors: {},
    overlays: [],
    rules: [],
    animations: [],
    timelines: [],
    animation_presets: {},
    routing: {},
    data_sources: {},
    base_svg: null,
    theme: null,
    view_box: null,
    __provenance: {
      anchors: {},
      overlays: {},
      rules: {},
      animations: {},
      merge_order: [],
      // ✅ NEW: Theme provenance tracking
      theme: {
        active_theme: null,
        source_pack: null,
        requested_theme: null,
        default_theme: null,
        fallback_used: false,
        themes_available: [],
        theme_pack_loaded: false
      },
      // ✅ NEW: Pack information
      packs: {
        builtin: [],
        external: [],
        failed: []
      },
      // ✅ NEW: Style resolution tracking (populated by renderers)
      style_resolution: {},
      // ✅ NEW: Renderer usage tracking (populated by renderers)
      renderers: {}
    }
  };

  // Track theme information
  let themeProvenance = {
    active_theme: null,
    source_pack: null,
    requested_theme: null,
    default_theme: null,
    fallback_used: false,
    themes_available: [],
    theme_pack_loaded: false
  };

  // Track pack loading
  const packInfo = {
    builtin: [],
    external: [],
    failed: []
  };

  // Process each layer in priority order
  for (const layer of layers) {
    perfTime('merge.processLayer', () => processLayer(merged, layer), {
      layer: layer.pack,
      type: layer.type
    });

    // Track merge order
    merged.__provenance.merge_order.push({
      type: layer.type,
      pack: layer.pack,
      priority: layer.priority
    });

    // ✅ NEW: Track pack loading
    if (layer.type === 'builtin') {
      packInfo.builtin.push({
        id: layer.pack,
        has_themes: !!(layer.data.themes),
        has_presets: !!(layer.data.style_presets),
        has_overlays: !!(layer.data.overlays?.length)
      });
    } else if (layer.type === 'external') {
      packInfo.external.push({
        url: layer.pack,
        has_themes: !!(layer.data.themes),
        has_presets: !!(layer.data.style_presets)
      });
    }

    // ✅ NEW: Track theme from builtin_themes pack
    if (layer.pack === 'builtin_themes' && layer.data.themes) {
      themeProvenance.themes_available = Object.keys(layer.data.themes);
      themeProvenance.default_theme = layer.data.defaultTheme || 'lcars-classic';
      themeProvenance.source_pack = 'builtin_themes';
      themeProvenance.theme_pack_loaded = true;
    }

    // ✅ NEW: Track requested theme from user config
    if (layer.type === 'user' && layer.data.theme) {
      themeProvenance.requested_theme = layer.data.theme;
    }
  }

  // ✅ NEW: Determine active theme
  themeProvenance.active_theme = merged.theme || themeProvenance.default_theme;
  themeProvenance.fallback_used = !merged.theme && !!themeProvenance.default_theme;

  // Store theme provenance
  merged.__provenance.theme = themeProvenance;
  merged.__provenance.packs = packInfo;

  // Apply removals after all merges
  perfTime('merge.applyRemovals', () => applyRemovals(merged, layers[layers.length - 1]?.data?.remove));

  // Generate canonical checksum
  merged.checksum = await perfTimeAsync('merge.checksum', () => computeCanonicalChecksum(merged));

  return merged;
}

async function loadBuiltinPack(packName) {
  // Try debug packs first (for development)
  try {
    const dbgPacks = window.cblcars.debug.msd?.packs;
    if (dbgPacks) {
      const dbgSource = packName === 'core'
        ? dbgPacks.core
        : dbgPacks.builtin?.[packName];

      if (dbgSource && typeof dbgSource === 'object') {
        return dbgSource;
      }
    }
  } catch (e) {
    // Fallback to normal loading
  }

  // Normal builtin pack loading would go here
  // For now, return minimal core pack with simulated SVG anchors
  if (packName === 'core') {
    return {
      version: 1,
      // Simulate SVG-extracted anchors
      anchors: {
        svg_bridge: [200, 150],  // Simulated SVG extraction
        svg_warp: [350, 200],    // Simulated SVG extraction
      },
      _extracted_anchors: ['svg_bridge', 'svg_warp'], // Mark as SVG-extracted
    };
  }

  return null;
}

async function loadExternalPacks(urls, options = {}) {
  const {
    timeout = 5000,
    retries = 2,
    retryDelay = 1000,
    enableCaching = true
  } = options;

  const results = [];
  const perfTracker = {
    total_packs: urls.length,
    successful: 0,
    failed: 0,
    retried: 0,
    cached_hits: 0,
    total_time_ms: 0
  };

  const startTime = performance.now();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const packResult = await loadSingleExternalPack(url, {
      timeout,
      retries,
      retryDelay,
      enableCaching,
      index: i
    });

    results.push(packResult);

    // Update performance tracking
    if (packResult.error) {
      perfTracker.failed++;
    } else {
      perfTracker.successful++;
    }

    if (packResult.retryCount > 0) {
      perfTracker.retried++;
    }

    if (packResult.cached) {
      perfTracker.cached_hits++;
    }
  }

  perfTracker.total_time_ms = performance.now() - startTime;

  // Store performance data for debugging - Node.js compatible
  try {
    const debugNamespace = (typeof window !== 'undefined') ? window : global;
    debugNamespace.__msdDebug = debugNamespace.__msdDebug || {};
    debugNamespace.__msdDebug._lastExternalPackPerf = perfTracker;
  } catch (e) {}

  return results;
}

async function loadSingleExternalPack(url, options) {
  const { timeout, retries, retryDelay, enableCaching, index } = options;

  // Check cache first
  if (enableCaching && externalPackCache.has(url)) {
    const cached = externalPackCache.get(url);
    if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
      return {
        url,
        data: cached.data,
        error: cached.error,
        cached: true,
        loadTime: 0,
        retryCount: 0,
        index
      };
    }
  }

  let lastError = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptStart = performance.now();

    try {
      const result = await Promise.race([
        fetchWithValidation(url),
        createTimeoutPromise(timeout, url)
      ]);

      const loadTime = performance.now() - attemptStart;

      // Cache successful result
      if (enableCaching) {
        externalPackCache.set(url, {
          data: result.data,
          error: null,
          timestamp: Date.now()
        });
      }

      return {
        url,
        data: result.data,
        error: null,
        cached: false,
        loadTime,
        retryCount,
        index,
        contentType: result.contentType,
        size: result.size
      };

    } catch (error) {
      lastError = error;
      retryCount = attempt;

      // Don't retry on certain error types
      if (error.name === 'ValidationError' ||
          error.name === 'SyntaxError' ||
          error.message.includes('404')) {
        break;
      }

      // Wait before retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  // Cache failed result to avoid repeated failures
  if (enableCaching) {
    externalPackCache.set(url, {
      data: null,
      error: lastError.message,
      timestamp: Date.now()
    });
  }

  return {
    url,
    data: null,
    error: lastError?.message || 'Unknown error',
    errorType: classifyError(lastError),
    cached: false,
    loadTime: 0,
    retryCount,
    index
  };
}

async function fetchWithValidation(url) {
  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    const error = new Error(`Invalid URL format: ${url}`);
    error.name = 'ValidationError';
    throw error;
  }

  // Perform fetch
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
  }

  // Validate content type
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('text/')) {
    console.warn(`[MSD] External pack ${url} has unexpected content-type: ${contentType}`);
  }

  // Parse JSON with size limits
  const text = await response.text();
  if (text.length > 1024 * 1024) { // 1MB limit
    throw new Error(`External pack ${url} too large: ${text.length} bytes (max 1MB)`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const error = new Error(`Invalid JSON in external pack ${url}: ${e.message}`);
    error.name = 'SyntaxError';
    throw error;
  }

  // Basic MSD structure validation
  if (data && typeof data === 'object') {
    validateExternalPackStructure(data, url);
  }

  return {
    data,
    contentType,
    size: text.length
  };
}

function createTimeoutPromise(timeout, url) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Timeout loading external pack: ${url} (${timeout}ms)`);
      error.name = 'TimeoutError';
      reject(error);
    }, timeout);
  });
}

function validateExternalPackStructure(data, url) {
  // Basic validation - ensure it looks like an MSD pack
  const validFields = ['version', 'anchors', 'overlays', 'rules', 'animations', 'timelines'];
  const dataFields = Object.keys(data);
  const hasValidField = validFields.some(field => dataFields.includes(field));

  if (!hasValidField) {
    console.warn(`[MSD] External pack ${url} doesn't contain recognized MSD fields`);
  }

  // ✅ REMOVED: ID validation is now handled by validateMerged and ValidationService
  // Previously validated individual ID fields here - now centralized
}

function classifyError(error) {
  if (!error) return 'unknown';

  if (error.name === 'TimeoutError') return 'timeout';
  if (error.name === 'ValidationError') return 'validation';
  if (error.name === 'SyntaxError') return 'syntax';
  if (error.message.includes('404')) return 'not_found';
  if (error.message.includes('403')) return 'forbidden';
  if (error.message.includes('network')) return 'network';

  return 'unknown';
}

// Simple cache for external packs
const externalPackCache = new Map();

// Export for testing
export { externalPackCache };

async function processLayer(merged, layer) {
  const collections = ['overlays', 'rules', 'animations', 'timelines'];

  // Process collections with ID-based merging
  for (const collection of collections) {
    if (layer.data[collection] && Array.isArray(layer.data[collection])) {
      perfTime(`merge.collection.${collection}`, () => {
        // Initialize provenance collection if missing
        if (!merged.__provenance[collection]) {
          merged.__provenance[collection] = {};
        }

        for (const item of layer.data[collection]) {
          if (!item.id) continue;

          // Handle inline removal
          if (item.remove === true) {
            const index = merged[collection].findIndex(existing => existing.id === item.id);
            if (index >= 0) {
              merged[collection].splice(index, 1);
              merged.__provenance[collection][item.id] = {
                ...(merged.__provenance[collection][item.id] || {}),
                removed: true,
                removal_source: layer.pack
              };
            }
            continue;
          }

          // Normal merge
          const existingIndex = merged[collection].findIndex(existing => existing.id === item.id);
          const cloned = structuredClone(item);
          delete cloned.remove;

          if (existingIndex >= 0) {
            // Override existing
            merged[collection][existingIndex] = cloned;
            merged.__provenance[collection][item.id] = {
              origin_pack: merged.__provenance[collection][item.id]?.origin_pack || layer.pack,
              overridden: true,
              override_layer: layer.pack
            };
          } else {
            // Add new
            merged[collection].push(cloned);
            merged.__provenance[collection][item.id] = {
              origin_pack: layer.pack,
              overridden: false
            };
          }
        }

        // Track items processed
        perfCount(`merge.items.${collection}`, layer.data[collection].length);
      });
    }
  }

  // Enhanced anchor processing with comprehensive provenance
  if (layer.data.anchors) {
    perfTime('merge.anchors', () => {
      for (const [anchorId, coordinates] of Object.entries(layer.data.anchors)) {
        const existed = anchorId in merged.anchors;
        const previousCoordinates = merged.anchors[anchorId];

        // Set the anchor coordinates
        merged.anchors[anchorId] = coordinates;

        // Determine origin type for this layer
        const originType = determineAnchorOriginType(layer, anchorId);

        if (existed) {
          // Anchor is being overridden
          const existingProvenance = merged.__provenance.anchors[anchorId];

          merged.__provenance.anchors[anchorId] = {
            origin_pack: existingProvenance?.origin_pack || 'unknown',
            origin_type: existingProvenance?.origin_type || 'unknown',
            coordinates: coordinates,
            overridden: true,
            override_source: layer.pack,
            override_type: originType,
            previous_coordinates: previousCoordinates,
            override_history: [
              ...(existingProvenance?.override_history || []),
              {
                pack: layer.pack,
                type: originType,
                coordinates: coordinates,
                previous_coordinates: previousCoordinates,
                timestamp: Date.now()
              }
            ]
          };
        } else {
          // New anchor
          merged.__provenance.anchors[anchorId] = {
            origin_pack: layer.pack,
            origin_type: originType,
            coordinates: coordinates,
            overridden: false,
            override_history: []
          };
        }
      }

      perfCount('merge.anchors', Object.keys(layer.data.anchors).length);
    });
  }

  // Process other top-level properties
  if (layer.data.routing) {
    merged.routing = { ...merged.routing, ...layer.data.routing };
  }

  if (layer.data.data_sources) {
    merged.data_sources = { ...merged.data_sources, ...layer.data.data_sources };
  }

  // Process animation_presets configuration
  if (layer.data.animation_presets) {
    merged.animation_presets = { ...merged.animation_presets, ...layer.data.animation_presets };

    // Track animation_presets provenance
    if (!merged.__provenance.animation_presets) {
      merged.__provenance.animation_presets = {
        origin_pack: layer.pack,
        overridden: false
      };
    } else {
      merged.__provenance.animation_presets.overridden = true;
      merged.__provenance.animation_presets.override_layer = layer.pack;
    }
  }

  // Process base_svg configuration
  if (layer.data.base_svg !== undefined) {
    merged.base_svg = layer.data.base_svg;

    // Track base_svg provenance
    if (!merged.__provenance.base_svg) {
      merged.__provenance.base_svg = {
        origin_pack: layer.pack,
        overridden: false
      };
    } else {
      merged.__provenance.base_svg.overridden = true;
      merged.__provenance.base_svg.override_layer = layer.pack;
    }
  }

  // Process theme configuration
  if (layer.data.theme !== undefined) {
    merged.theme = layer.data.theme;

    // Track theme provenance
    if (!merged.__provenance.theme) {
      merged.__provenance.theme = {
        origin_pack: layer.pack,
        overridden: false
      };
    } else {
      merged.__provenance.theme.overridden = true;
      merged.__provenance.theme.override_layer = layer.pack;
    }
  }

  // Process debug configuration
  if (layer.data.debug) {
    merged.debug = { ...merged.debug, ...layer.data.debug };

    // Track debug config provenance
    if (!merged.__provenance.debug) {
      merged.__provenance.debug = {
        origin_pack: layer.pack,
        overridden: false
      };
    } else {
      merged.__provenance.debug.overridden = true;
      merged.__provenance.debug.override_layer = layer.pack;
    }
  }

  // Process view_box configuration
  if (layer.data.view_box !== undefined) {
    merged.view_box = layer.data.view_box;

    // Track view_box provenance
    if (!merged.__provenance.view_box) {
      merged.__provenance.view_box = {
        origin_pack: layer.pack,
        overridden: false
      };
    } else {
      merged.__provenance.view_box.overridden = true;
      merged.__provenance.view_box.override_layer = layer.pack;
    }
  }
}

function determineAnchorOriginType(layer, anchorId) {
  // Determine the origin type based on layer characteristics
  if (layer.type === 'builtin' || layer.type === 'external') {
    // For builtin/external packs, check if this looks like an SVG-extracted anchor
    if (layer.data._extracted_anchors && layer.data._extracted_anchors.includes(anchorId)) {
      return 'svg';
    }
    return 'pack';
  }

  if (layer.type === 'user') {
    // User-defined anchors
    return 'user';
  }

  return 'unknown';
}

function applyRemovals(merged, removals) {
  if (!removals || typeof removals !== 'object') return;

  const collections = ['overlays', 'rules', 'animations', 'timelines'];

  for (const collection of collections) {
    const removeIds = removals[collection];
    if (Array.isArray(removeIds)) {
      for (const removeId of removeIds) {
        const index = merged[collection].findIndex(item => item.id === removeId);
        if (index >= 0) {
          merged[collection].splice(index, 1);
          merged.__provenance[collection][removeId] = {
            ...(merged.__provenance[collection][removeId] || {}),
            removed: true,
            removal_source: 'global'
          };
        }
      }
    }
  }
}

/**
 * Export collapsed user configuration
 */
export function exportCollapsed(userMsd) {
  const out = {};
  const keep = [
    'version', 'use_packs', 'anchors', 'overlays', 'animations',
    'rules', 'timelines', 'routing',
    'remove', 'debug', 'base_svg',
    'theme'
  ];

  keep.forEach(k => {
    if (userMsd && userMsd[k] !== undefined) {
      out[k] = userMsd[k];
    }
  });

  return out;
}

// Attach debug helpers
try {
  if (typeof window !== 'undefined') {
    window.cblcars = window.cblcars || {};
    window.cblcars.debug = window.cblcars.debug || {};
    window.cblcars.debug.msd = window.cblcars.debug.msd || {};
    window.cblcars.debug.msd.packs = window.cblcars.debug.msd.packs || {};
    window.cblcars.debug.msd.packs.mergePacks = mergePacks;
    window.cblcars.debug.msd.exportCollapsed = () => exportCollapsed(window.cblcars.debug.msd._hudUserMsdConfig || {});
  }
} catch (e) {
  // Ignore in Node.js environments
}