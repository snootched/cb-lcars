#!/usr/bin/env node

/**
 * Debug Status Grid Font Size Issues
 * Test script to understand why font sizes aren't taking effect
 */

const path = require('path');

// Set up module path resolution
const projectRoot = path.resolve(__dirname, '../../');
const srcPath = path.join(projectRoot, 'src');

// Add paths for module resolution
if (!process.env.NODE_PATH) {
  process.env.NODE_PATH = srcPath;
  require('module')._initPaths();
}

// Import required modules
const { StatusGridRenderer } = require('../../src/msd/renderer/StatusGridRenderer.js');
const { RendererUtils } = require('../../src/msd/renderer/RendererUtils.js');

console.log('🔍 Status Grid Font Size Debug Test');
console.log('=====================================\n');

// Test 1: Check default font size resolution
console.log('📝 Test 1: Default Font Size Resolution');
console.log('----------------------------------------');

const testStyles = [
  {},  // Empty style (should use defaults)
  { font_size: 20 },  // Explicit font size
  { fontSize: 22 },   // CamelCase variant
  { label_font_size: 24, value_font_size: 20 }  // Individual sizes
];

// Create a mock renderer instance to test private methods
const renderer = new StatusGridRenderer();

testStyles.forEach((style, index) => {
  console.log(`\nStyle ${index + 1}:`, JSON.stringify(style));

  try {
    // Test RendererUtils parsing
    const standardStyles = RendererUtils.parseAllStandardStyles(style);
    console.log(`  standardStyles.text.fontSize: ${standardStyles.text?.fontSize || 'undefined'}`);

    // Test the actual grid style resolution
    const gridStyle = renderer._resolveStatusGridStyles(style, 'test-grid');
    console.log(`  Resolved font_size: ${gridStyle.font_size}`);
    console.log(`  Resolved label_font_size: ${gridStyle.label_font_size}`);
    console.log(`  Resolved value_font_size: ${gridStyle.value_font_size}`);

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
});

// Test 2: Check smart calculation methods
console.log('\n\n📊 Test 2: Smart Calculation Methods');
console.log('-------------------------------------');

const testStyle = { font_size: 16 };
try {
  const spacing = renderer._calculateSmartTextSpacing(testStyle);
  const labelOffset = renderer._calculateSmartLabelOffset(testStyle);
  const valueOffset = renderer._calculateSmartValueOffset(testStyle);

  console.log(`Font size: 16px`);
  console.log(`  Smart text spacing: ${spacing}px`);
  console.log(`  Smart label offset: ${labelOffset}px`);
  console.log(`  Smart value offset: ${valueOffset}px`);
} catch (error) {
  console.log(`❌ Error in smart calculations: ${error.message}`);
}

// Test 3: Check LCARS preset positioning
console.log('\n\n🎯 Test 3: LCARS Preset Positioning');
console.log('------------------------------------');

const mockCell = {
  x: 0, y: 0, width: 200, height: 100
};
const mockGridStyle = {
  lcars_text_preset: 'lozenge',
  text_padding: 8,
  label_font_size: 18,
  value_font_size: 16,
  cell_radius: 12
};

try {
  // Mock the methods that _calculateLCARSPresetPosition depends on
  renderer._getEffectiveCellRadius = () => 12;
  renderer._calculateSmartPadding = (base, radius, fontSize) => Math.max(base, radius * 0.7, fontSize * 0.3);

  const labelPos = renderer._calculateLCARSPresetPosition(
    'lozenge', 0, 0, 200, 100, mockGridStyle, 'label'
  );
  const valuePos = renderer._calculateLCARSPresetPosition(
    'lozenge', 0, 0, 200, 100, mockGridStyle, 'value'
  );

  console.log(`Cell: 200x100px`);
  console.log(`Label position: x=${labelPos.x}, y=${labelPos.y} (${labelPos.anchor}/${labelPos.baseline})`);
  console.log(`Value position: x=${valuePos.x}, y=${valuePos.y} (${valuePos.anchor}/${valuePos.baseline})`);
  console.log(`Vertical separation: ${Math.abs(valuePos.y - labelPos.y)}px`);

} catch (error) {
  console.log(`❌ Error in LCARS preset positioning: ${error.message}`);
}

console.log('\n✅ Debug test completed');