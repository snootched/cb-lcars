import { computeCanonicalChecksum } from '../util/checksum.js';

/**
 * Single consolidated merge algorithm - COMPLETE REPLACEMENT
 * Removes all legacy dual merge logic per Milestone 1.1
 */
export async function mergePacks(userConfig) {
  const startTime = performance.now();

  try {
    const layers = await loadAllLayers(userConfig);
    const merged = await processSinglePass(layers);

    // Add performance tracking
    const duration = performance.now() - startTime;
    merged.__performance = merged.__performance || {};
    merged.__performance.merge_time_ms = Math.round(duration * 100) / 100;

    return merged;
  } catch (error) {
    console.error('MSD merge failed:', error);
    throw error;
  }
}

async function loadAllLayers(userConfig) {
  const layers = [];

  // Load builtin packs first
  const builtinPacks = userConfig.use_packs?.builtin || ['core'];
  for (const packName of builtinPacks) {
    const pack = await loadBuiltinPack(packName);
    if (pack) {
      layers.push({
        type: 'builtin',
        pack: packName,
        data: pack,
        priority: 100
      });
    }
  }

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
    palettes: {},
    profiles: [],
    overlays: [],
    rules: [],
    animations: [],
    timelines: [],
    routing: {},
    data_sources: {},
    active_profiles: ['normal'],
    __provenance: {
      anchors: {},
      palettes: {},
      overlays: {},
      rules: {},
      animations: {},
      merge_order: []
    }
  };

  // Process each layer in priority order
  for (const layer of layers) {
    await processLayer(merged, layer);
    merged.__provenance.merge_order.push({
      type: layer.type,
      pack: layer.pack,
      priority: layer.priority
    });
  }

  // Apply removals after all merges
  applyRemovals(merged, layers[layers.length - 1]?.data?.remove);

  // Generate canonical checksum
  merged.checksum = await computeCanonicalChecksum(merged);

  return merged;
}

async function loadBuiltinPack(packName) {
  // Try debug packs first (for development)
  try {
    const dbgPacks = window.__msdDebug?.packs;
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
  // For now, return minimal core pack
  if (packName === 'core') {
    return {
      version: 1,
      profiles: [
        {
          id: 'normal',
          defaults: {
            line: { color: 'var(--lcars-orange)', width: 2 },
            text: { color: 'var(--lcars-orange)', font_size: 14 }
          }
        }
      ],
      palettes: {
        default: {
          accent1: 'var(--lcars-orange)',
          accent2: 'var(--lcars-yellow)',
          danger: 'var(--lcars-red)',
          info: 'var(--lcars-cyan)'
        }
      }
    };
  }

  return null;
}

async function loadExternalPacks(urls, timeout = 5000) {
  const promises = urls.map(url =>
    Promise.race([
      fetch(url).then(r => r.json()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeout)
      )
    ]).catch(err => ({ error: err.message, url }))
  );

  const results = await Promise.allSettled(promises);
  return results.map((result, i) => ({
    url: urls[i],
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : result.value?.error
  }));
}

async function processLayer(merged, layer) {
  const collections = ['overlays', 'rules', 'animations', 'profiles', 'timelines'];

  // Process collections with ID-based merging
  for (const collection of collections) {
    if (layer.data[collection] && Array.isArray(layer.data[collection])) {
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
    }
  }

  // Process palettes with token-level merging
  if (layer.data.palettes) {
    merged.palettes = merged.palettes || {};
    // Initialize palette provenance if missing
    if (!merged.__provenance.palettes) {
      merged.__provenance.palettes = {};
    }

    for (const [paletteName, tokens] of Object.entries(layer.data.palettes)) {
      if (typeof tokens === 'object' && !Array.isArray(tokens)) {
        const paletteExisted = merged.palettes[paletteName] !== undefined;
        merged.palettes[paletteName] = merged.palettes[paletteName] || {};

        for (const [tokenName, value] of Object.entries(tokens)) {
          merged.palettes[paletteName][tokenName] = value;
        }

        // Add palette provenance
        merged.__provenance.palettes[paletteName] = {
          origin_pack: layer.pack,
          overridden: paletteExisted
        };
      }
    }
  }

  // Process anchors
  if (layer.data.anchors) {
    for (const [anchorId, coordinates] of Object.entries(layer.data.anchors)) {
      // Replace Object.prototype.hasOwnProperty.call with modern approach
      const existed = anchorId in merged.anchors;
      merged.anchors[anchorId] = coordinates;
      merged.__provenance.anchors[anchorId] = {
        origin_pack: layer.pack,
        overridden: existed
      };
    }
  }

  // Process other top-level properties
  if (layer.data.routing) {
    merged.routing = { ...merged.routing, ...layer.data.routing };
  }

  if (layer.data.data_sources) {
    merged.data_sources = { ...merged.data_sources, ...layer.data.data_sources };
  }

  if (Array.isArray(layer.data.active_profiles)) {
    merged.active_profiles = [...layer.data.active_profiles];
  }
}

function applyRemovals(merged, removals) {
  if (!removals || typeof removals !== 'object') return;

  const collections = ['overlays', 'rules', 'animations', 'profiles', 'timelines'];

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
    'rules', 'profiles', 'timelines', 'palettes', 'routing',
    'active_profiles', 'remove'
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
    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug.packs = window.__msdDebug.packs || {};
    window.__msdDebug.packs.mergePacks = mergePacks;
    window.__msdDebug.exportCollapsed = () => exportCollapsed(window.__msdDebug._hudUserMsdConfig || {});
  }
} catch (e) {
  // Ignore in Node.js environments
}
