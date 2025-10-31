#!/usr/bin/env node

/**
 * Test the new StylePresetManager system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Import the new systems
const { loadBuiltinPacks } = await import(`${projectRoot}/src/msd/packs/loadBuiltinPacks.js`);
const { StylePresetManager } = await import(`${projectRoot}/src/msd/presets/StylePresetManager.js`);
const { PackRegistry } = await import(`${projectRoot}/src/msd/packs/PackRegistry.js`);

console.log('🎨 CB-LCARS StylePresetManager Test');
console.log('===================================\n');

// Test 1: Load packs and initialize StylePresetManager
console.log('📦 Test 1: Loading packs and initializing StylePresetManager');
const packs = loadBuiltinPacks(['core', 'cb_lcars_buttons']);

const stylePresetManager = new StylePresetManager();
await stylePresetManager.initialize(packs);

console.log(`✅ StylePresetManager initialized with ${packs.length} packs\n`);

// Test 2: Test preset resolution
console.log('🎯 Test 2: Testing preset resolution');

const testPresets = [
  { type: 'status_grid', name: 'lozenge' },
  { type: 'status_grid', name: 'bullet' },
  { type: 'status_grid', name: 'picard-filled' },
  { type: 'status_grid', name: 'badge' },
  { type: 'status_grid', name: 'nonexistent' }
];

testPresets.forEach(({ type, name }) => {
  const preset = stylePresetManager.getPreset(type, name);
  if (preset) {
    console.log(`   ✅ ${type}.${name}: FOUND`);
    console.log(`      Keys: ${Object.keys(preset).slice(0, 6).join(', ')}${Object.keys(preset).length > 6 ? '...' : ''}`);
    console.log(`      Sample values: cell_radius=${preset.cell_radius}, text_padding=${preset.text_padding}`);
  } else {
    console.log(`   ❌ ${type}.${name}: NOT FOUND`);
  }
});

// Test 3: Test available presets
console.log('\n📋 Test 3: Available presets');
const availableTypes = stylePresetManager.getAvailableOverlayTypes();
console.log(`Available overlay types: ${availableTypes.join(', ')}`);

availableTypes.forEach(type => {
  const presets = stylePresetManager.getAvailablePresets(type);
  console.log(`   ${type}: ${presets.join(', ')}`);
});

// Test 4: Test PackRegistry
console.log('\n📦 Test 4: Testing PackRegistry');
const packRegistry = new PackRegistry();
await packRegistry.initialize(packs);

console.log('Pack registry initialized. Available packs:');
packRegistry.getPackIds().forEach(packId => {
  const pack = packRegistry.getPack(packId);
  console.log(`   ${packId}: v${pack.version}`);
  console.log(`     - Profiles: ${pack.profiles?.length || 0}`);
  console.log(`     - Style presets: ${pack.style_presets ? Object.keys(pack.style_presets).join(', ') : 'none'}`);
  console.log(`     - Palettes: ${pack.palettes ? Object.keys(pack.palettes).join(', ') : 'none'}`);
});

// Test 5: Debug information
console.log('\n🔍 Test 5: Debug information');
const styleDebug = stylePresetManager.getDebugInfo();
console.log('StylePresetManager debug:', {
  initialized: styleDebug.initialized,
  packCount: styleDebug.packCount,
  cacheSize: styleDebug.cacheSize,
  presetsByType: Object.keys(styleDebug.presetsByType).map(type =>
    `${type}(${styleDebug.presetsByType[type].length})`
  ).join(', ')
});

const packDebug = packRegistry.getDebugInfo();
console.log('PackRegistry debug:', {
  initialized: packDebug.initialized,
  packCount: packDebug.packCount,
  totalOverlays: packDebug.packDetails.reduce((sum, p) => sum + p.overlayCount, 0),
  totalAnimations: packDebug.packDetails.reduce((sum, p) => sum + p.animationCount, 0)
});

console.log('\n✅ StylePresetManager test complete!');