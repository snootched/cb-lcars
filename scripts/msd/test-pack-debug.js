#!/usr/bin/env node

/**
 * Debug Pack Loading in Live MSD System
 */

console.log('🔍 Pack Loading Debug\n');

// Simulate browser environment check
const checkBrowserDebug = `
// Run this in browser console:

console.log('=== PACK LOADING DEBUG ===');

// 1. Check MSD pipeline exists
const pipeline = window.__msdDebug?.pipelineInstance;
console.log('Pipeline exists:', !!pipeline);

// 2. Check merged config
const merged = pipeline?.mergedConfig;
console.log('use_packs config:', merged?.use_packs);

// 3. Check defaults manager
const dm = pipeline?.defaultsManager;
console.log('Defaults manager exists:', !!dm);
console.log('Pack layer exists:', !!dm?.layers?.get('pack'));
console.log('Pack layer size:', dm?.layers?.get('pack')?.size || 0);

// 4. Test specific defaults
if (dm) {
  console.log('Key defaults:', {
    cell_radius: dm.resolve('status_grid.cell_radius'),
    text_padding: dm.resolve('status_grid.text_padding'),
    cell_gap: dm.resolve('status_grid.cell_gap')
  });
}

// 5. Check provenance
const provenance = merged?.__provenance?.merge_order;
console.log('Merge order:', provenance?.map(p => \`\${p.type}:\${p.pack}\`));

// 6. Test StatusGridRenderer connection
try {
  const renderer = new window.StatusGridRenderer();
  console.log('Renderer connected to defaults:', !!renderer.defaultsManager);
  console.log('Test resolve:', renderer._getDefault('status_grid.cell_radius', 'NOT_FOUND'));
} catch (e) {
  console.log('StatusGridRenderer test failed:', e.message);
}

console.log('=== END DEBUG ===');
`;

console.log('Copy and paste this into your browser console:');
console.log('=' * 50);
console.log(checkBrowserDebug);
console.log('=' * 50);

console.log('\n📋 What to look for:');
console.log('✅ Pipeline exists: should be true');
console.log('✅ use_packs config: should show your builtin array');
console.log('✅ Defaults manager exists: should be true');
console.log('✅ Pack layer size: should be > 0 if packs loaded');
console.log('✅ Key defaults: should show actual values, not null');
console.log('✅ Merge order: should include cb_lcars_buttons');
console.log('✅ Renderer connected: should be true');
console.log('✅ Test resolve: should show a number, not "NOT_FOUND"');

console.log('\n🚨 Common Issues:');
console.log('❌ use_packs missing → Add to MSD config');
console.log('❌ Pack layer size 0 → Pipeline not calling loadFromPacks()');
console.log('❌ Renderer not connected → Connection logic failed');
console.log('❌ Test resolve returns NOT_FOUND → Defaults not working');