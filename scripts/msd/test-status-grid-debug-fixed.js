#!/usr/bin/env node

/**
 * Status Grid Debug Test
 * Tests the DataSource configuration and availability for Status Grid
 */

console.log('🧪 Status Grid Debug Test');
console.log('='.repeat(50));

// Use a simplified config for debugging
const config = {
  id: 'status_grid_debug_test',
  size: { width: 800, height: 600 },
  data_sources: [
    {
      name: 'temperature_enhanced',
      entity: 'sensor.toronto_feels_like_temperature',
      history: { hours: 6 },
      transformations: [
        {
          type: 'unit_conversion',
          key: 'celsius',
          from_unit: '°C',
          to_unit: '°C'
        }
      ]
    },
    {
      name: 'test_cpu_temp',
      entity: 'sensor.bathroom_dial_battery',
      history: { hours: 24 }
    },
    {
      name: 'test_memory',
      entity: 'sensor.bedroom_dial_battery',
      history: { hours: 24 }
    }
  ]
};

console.log('\n📊 Using config with DataSources:');
config.data_sources?.forEach(ds => {
  console.log(`  - ${ds.name} → ${ds.entity}`);
});

console.log('\n⚠️  This test requires a running browser environment with the MSD system loaded.');
console.log('The actual DataSource debugging should be done in the browser console.');
console.log('\nIn the browser console, try:');
console.log('  window.__msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSources()');
console.log('  StatusGridRenderer.debugDataSourceManagerStatus()');

process.exit(0);