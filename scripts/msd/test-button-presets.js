#!/usr/bin/env node

/**
 * Test CB-LCARS Button Presets System
 * Tests pack loading, defaults manager, and preset application
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');

// Import MSD components
const { loadBuiltinPacks } = await import(resolve(projectRoot, 'src/msd/packs/loadBuiltinPacks.js'));
const { MsdDefaultsManager } = await import(resolve(projectRoot, 'src/msd/pipeline/MsdDefaultsManager.js'));

console.log('🧪 CB-LCARS Button Presets Test\n');

// Test 1: Verify pack loading
console.log('📦 Testing pack loading...');
try {
  const packs = loadBuiltinPacks(['core', 'cb_lcars_buttons']);
  console.log(`✅ Loaded ${packs.length} packs:`, packs.map(p => p.id));

  const cbPack = packs.find(p => p.id === 'cb_lcars_buttons');
  if (cbPack) {
    console.log(`✅ CB-LCARS pack found with ${cbPack.profiles?.length || 0} profiles`);
    console.log(`   Profiles:`, cbPack.profiles?.map(p => p.id) || []);
  } else {
    console.log('❌ CB-LCARS pack not found');
  }
} catch (error) {
  console.log('❌ Pack loading failed:', error.message);
}

// Test 2: Test defaults manager with packs
console.log('\n🎛️ Testing defaults manager...');
try {
  const defaultsManager = new MsdDefaultsManager();
  const packs = loadBuiltinPacks(['core', 'cb_lcars_buttons']);

  // Load pack defaults
  defaultsManager.loadFromPacks(packs);

  // Test key defaults
  const testKeys = [
    'status_grid.cell_radius',
    'status_grid.text_padding',
    'status_grid.text_margin',
    'status_grid.cell_gap',
    'status_grid.label_font_size'
  ];

  console.log('📋 Pack-based defaults:');
  for (const key of testKeys) {
    const value = defaultsManager.resolve(key);
    console.log(`   ${key}: ${value}`);
  }

} catch (error) {
  console.log('❌ Defaults manager test failed:', error.message);
}

// Test 3: Test preset application logic
console.log('\n🎨 Testing preset application...');
try {
  // Simulate StatusGridRenderer preset application
  const mockGridStyle = {
    lcars_button_preset: null,
    cell_radius: 2,
    text_padding: 8,
    normalize_radius: true
  };

  // Simulate preset application for each preset
  const presets = ['lozenge', 'bullet', 'picard-filled', 'badge', 'compact'];

  for (const preset of presets) {
    const testStyle = { ...mockGridStyle, lcars_button_preset: preset };

    console.log(`\n🔸 Testing preset: ${preset}`);
    console.log(`   Before: radius=${testStyle.cell_radius}, padding=${testStyle.text_padding}`);

    // Simulate the preset logic (simplified)
    switch (preset) {
      case 'lozenge':
        testStyle.cell_radius = 12;
        testStyle.text_padding = 10;
        testStyle.text_layout = 'diagonal';
        break;
      case 'bullet':
        testStyle.cell_radius = 8;
        testStyle.text_padding = 8;
        testStyle.text_layout = 'side-by-side';
        break;
      case 'picard-filled':
        testStyle.cell_radius = 0;
        testStyle.text_padding = 12;
        testStyle.lcars_corners = true;
        break;
      case 'badge':
        testStyle.cell_radius = 16;
        testStyle.text_padding = 8;
        break;
      case 'compact':
        testStyle.cell_radius = 4;
        testStyle.text_padding = 6;
        break;
    }

    console.log(`   After:  radius=${testStyle.cell_radius}, padding=${testStyle.text_padding}, layout=${testStyle.text_layout || 'stacked'}`);
  }

} catch (error) {
  console.log('❌ Preset application test failed:', error.message);
}

console.log('\n🏁 Button presets test complete');