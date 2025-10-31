#!/usr/bin/env node

/**
 * Quick test of StylePresetManager
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Import the new systems
const { loadBuiltinPacks } = await import(`${projectRoot}/src/msd/packs/loadBuiltinPacks.js`);
const { StylePresetManager } = await import(`${projectRoot}/src/msd/presets/StylePresetManager.js`);

console.log('🚀 Quick StylePresetManager Test\n');

// Load packs and test
const packs = loadBuiltinPacks(['core', 'cb_lcars_buttons']);
console.log(`Loaded ${packs.length} packs`);

const stylePresetManager = new StylePresetManager();
await stylePresetManager.initialize(packs);

console.log('StylePresetManager initialized:', stylePresetManager.initialized);

// Test the lozenge preset specifically
const lozengePreset = stylePresetManager.getPreset('status_grid', 'lozenge');
console.log('Lozenge preset found:', !!lozengePreset);

if (lozengePreset) {
  console.log('Lozenge preset keys:', Object.keys(lozengePreset));
  console.log('Sample values:', {
    cell_radius: lozengePreset.cell_radius,
    text_padding: lozengePreset.text_padding,
    lcars_text_preset: lozengePreset.lcars_text_preset
  });
} else {
  console.log('DEBUG: Available presets for status_grid:', stylePresetManager.getAvailablePresets('status_grid'));
  console.log('DEBUG: Available overlay types:', stylePresetManager.getAvailableOverlayTypes());
}

console.log('\n✅ Quick test complete');