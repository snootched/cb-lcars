#!/usr/bin/env node

/**
 * Test pack structure and style_presets loading
 * This helps debug why StatusGridRenderer can't find presets
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Import the pack loading system
const { loadBuiltinPacks } = await import(`${projectRoot}/src/msd/packs/loadBuiltinPacks.js`);
const { MsdDefaultsManager } = await import(`${projectRoot}/src/msd/defaults/MsdDefaultsManager.js`);

console.log('🔍 CB-LCARS Pack Structure Debug Test');
console.log('=====================================\n');

// Test 1: Load packs directly
console.log('📦 Test 1: Loading builtin packs directly');
const packs = loadBuiltinPacks(['core', 'cb_lcars_buttons']);

console.log(`Loaded ${packs.length} packs:`);
packs.forEach(pack => {
  console.log(`\n📋 Pack: ${pack.id} (v${pack.version})`);
  console.log(`   - Profiles: ${pack.profiles?.length || 0}`);
  console.log(`   - Has style_presets: ${!!pack.style_presets}`);

  if (pack.style_presets) {
    console.log(`   - Style preset types: ${Object.keys(pack.style_presets).join(', ')}`);

    if (pack.style_presets.status_grid) {
      console.log(`   - Status grid presets: ${Object.keys(pack.style_presets.status_grid).join(', ')}`);

      // Show the lozenge preset specifically
      if (pack.style_presets.status_grid.lozenge) {
        console.log(`   - Lozenge preset keys: ${Object.keys(pack.style_presets.status_grid.lozenge).join(', ')}`);
      }
    }
  }
});

// Test 2: Test defaults manager with these packs
console.log('\n🔧 Test 2: Testing MsdDefaultsManager with these packs');

try {
  const defaultsManager = new MsdDefaultsManager();

  // Initialize with packs
  await defaultsManager.initializeWithPacks(packs);

  console.log('✅ DefaultsManager initialized successfully');

  // Test introspection
  const introspection = defaultsManager.getIntrospectionData();
  console.log('\n🔍 Introspection data:');
  console.log(`   - Has layers: ${!!introspection.layers}`);
  console.log(`   - Has pack layers: ${!!introspection.layers?.pack}`);

  if (introspection.layers?.pack) {
    const packKeys = Object.keys(introspection.layers.pack);
    console.log(`   - Pack layer keys (first 5): ${packKeys.slice(0, 5).join(', ')}`);
    console.log(`   - Total pack layer keys: ${packKeys.length}`);

    // Check if any pack data looks like actual pack objects vs flattened settings
    const samplePackData = introspection.layers.pack[packKeys[0]];
    console.log(`   - Sample pack data type: ${typeof samplePackData}`);
    console.log(`   - Sample pack data is string: ${typeof samplePackData === 'string'}`);
  }

  // Test specific preset resolution
  console.log('\n🎯 Test 3: Testing preset resolution');

  const presetPaths = [
    'status_grid.presets.lozenge',
    'presets.status_grid.lozenge',
    'style_presets.status_grid.lozenge',
    'cb_lcars_buttons.style_presets.status_grid.lozenge'
  ];

  presetPaths.forEach(path => {
    try {
      const result = defaultsManager.resolve(path);
      console.log(`   ✅ Path "${path}": ${result ? 'FOUND' : 'null'}`);
      if (result && typeof result === 'object') {
        console.log(`      Keys: ${Object.keys(result).slice(0, 5).join(', ')}`);
      }
    } catch (error) {
      console.log(`   ❌ Path "${path}": ERROR - ${error.message}`);
    }
  });

  // Test if raw packs are accessible
  if (introspection.rawPacks) {
    console.log(`\n📦 Raw packs available: ${introspection.rawPacks.length}`);
    introspection.rawPacks.forEach((pack, i) => {
      console.log(`   ${i + 1}. ${pack.id} - has style_presets: ${!!pack.style_presets}`);
    });
  } else {
    console.log('\n❌ No raw packs available in introspection');
  }

} catch (error) {
  console.error('❌ DefaultsManager test failed:', error);
  console.error('Stack:', error.stack);
}

console.log('\n✅ Pack structure debug test complete');