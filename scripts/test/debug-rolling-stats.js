/**
 * Debug Script: Rolling Statistics Array Output
 *
 * This script helps verify that rolling_statistics aggregations
 * are returning array data for ApexCharts multi-value charts.
 *
 * Usage:
 * 1. Open browser console on your Home Assistant dashboard
 * 2. Copy and paste this entire script
 * 3. Run: debugRollingStats('temp_range')
 */

window.debugRollingStats = function(datasourceName) {
  console.log('='.repeat(80));
  console.log('ROLLING STATISTICS DEBUG');
  console.log('='.repeat(80));
  console.log(`Target DataSource: ${datasourceName}`);
  console.log('');

  // Use CB-LCARS Debug API
  if (!window.cblcars?.debug?.msd) {
    console.error('❌ CB-LCARS debug API not available!');
    console.log('Make sure the card is loaded.');
    return;
  }
  console.log('✅ Found CB-LCARS debug API');

  // Get the MsdInstanceManager to access datasources
  const MsdInstanceManager = window.cblcars.debug.msd.MsdInstanceManager;
  if (!MsdInstanceManager) {
    console.error('❌ MsdInstanceManager not available!');
    return;
  }

  // Get current instance
  const instance = MsdInstanceManager.getCurrentInstance();
  if (!instance) {
    console.error('❌ No MSD instance found!');
    console.log('Make sure the card has been initialized.');
    return;
  }
  console.log('✅ Found MSD instance');

  // Get DataSourceManager from the instance
  const dataSourceManager = instance.getDataSourceManager?.();
  if (!dataSourceManager) {
    console.error('❌ DataSourceManager not available!');
    return;
  }
  console.log('✅ Found DataSourceManager');

  // Get the specific datasource
  const datasource = dsManager.sources.get(datasourceName);
  if (!datasource) {
    console.error(`❌ DataSource '${datasourceName}' not found!`);
    console.log('\nAvailable datasources:');
    const allSources = Array.from(dsManager.sources.keys());
    allSources.forEach(name => {
      console.log(`  - ${name}`);
    });
    return;
  }
  console.log(`✅ Found datasource: ${datasourceName}`);
  console.log('');

  // Check datasource type
  console.log('📊 DATASOURCE INFO:');
  console.log('-'.repeat(80));
  console.log(`Type: ${datasource.constructor.name}`);
  console.log(`Entity: ${datasource.cfg?.entity || 'N/A (computed source)'}`);
  console.log('');

  // Get current data using the correct API
  const data = datasource.getCurrentData();
  console.log('📈 CURRENT DATA:');
  console.log('-'.repeat(80));
  console.log('Raw value:', data.v);
  console.log('Timestamp:', data.t);
  console.log('Value type:', typeof data.v);
  console.log('Is array?:', Array.isArray(data.v));
  if (Array.isArray(data.v)) {
    console.log('Array length:', data.v.length);
    console.log('Array contents:', data.v);
  }
  console.log('');

  // Check aggregations
  console.log('🔢 AGGREGATIONS:');
  console.log('-'.repeat(80));
  if (data.aggregations && Object.keys(data.aggregations).length > 0) {
    Object.entries(data.aggregations).forEach(([key, value]) => {
      console.log(`\n${key}:`);
      console.log('  Type:', typeof value);
      console.log('  Is array?:', Array.isArray(value));
      if (Array.isArray(value)) {
        console.log('  Array length:', value.length);
        console.log('  Array contents:', value);
      } else if (typeof value === 'object' && value !== null) {
        console.log('  Object keys:', Object.keys(value));
        console.log('  Object contents:', value);
      } else {
        console.log('  Value:', value);
      }
    });
  } else {
    console.log('⚠️  No aggregations found!');
  }
  console.log('');

  // Check for processors
  if (datasource.aggregations && datasource.aggregations.size > 0) {
    console.log('🔧 AGGREGATION PROCESSORS:');
    console.log('-'.repeat(80));
    datasource.aggregations.forEach((processor, key) => {
      console.log(`\n${key}:`);
      console.log('  Type:', processor.config?.type);
      console.log('  Stats:', processor.config?.stats);
      console.log('  Output format:', processor.config?.output_format);
      console.log('  Window:', processor.config?.window);
    });
  }
  console.log('');

  // Check buffer
  console.log('💾 BUFFER INFO:');
  console.log('-'.repeat(80));
  if (data.buffer) {
    console.log(`Size: ${data.bufferSize}`);
    console.log(`Capacity: ${data.buffer.capacity}`);
    if (data.buffer.size() > 0) {
      const first = data.buffer.first();
      const last = data.buffer.last();
      console.log(`First: t=${first.t}, v=${first.v}`);
      console.log(`Last: t=${last.t}, v=${last.v}`);
      const timeSpan = (last.t - first.t) / 1000; // seconds
      console.log(`Time span: ${(timeSpan / 3600).toFixed(1)} hours`);
    }
  } else {
    console.log('⚠️  No buffer found!');
  }
  console.log('');

  // Check buffer
  console.log('💾 BUFFER INFO:');
  console.log('-'.repeat(80));
  const buffer = datasource._buffer;
  if (buffer) {
    const data = buffer.getData();
    console.log('Buffer size:', data.length);
    console.log('Window seconds:', datasource._windowSeconds);
    if (data.length > 0) {
      console.log('First point:', data[0]);
      console.log('Last point:', data[data.length - 1]);
      console.log('Latest 5 points:', data.slice(-5));
    } else {
      console.log('⚠️  Buffer is empty!');
    }
  } else {
    console.log('⚠️  No buffer found!');
  }
  console.log('');

  // Final summary
  console.log('📋 SUMMARY:');
  console.log('-'.repeat(80));
  const hasAggregates = state.aggregates && Object.keys(state.aggregates).length > 0;
  const hasArrayOutput = hasAggregates && Object.values(state.aggregates).some(v => Array.isArray(v));

  if (hasArrayOutput) {
    console.log('✅ SUCCESS: Array output detected in aggregations!');
  } else if (hasAggregates) {
    console.log('⚠️  WARNING: Aggregations exist but no array output detected.');
    console.log('   Check output_format configuration.');
  } else {
    console.log('❌ ERROR: No aggregations found!');
    console.log('   Check datasource configuration.');
  }
  console.log('');
  console.log('='.repeat(80));

  // Return the datasource for further inspection
  return datasource;
};

console.log('✅ Debug script loaded!');
console.log('Usage: debugRollingStats("temp_range")');
console.log('');
console.log('Available commands:');
console.log('  debugRollingStats("datasource_name") - Debug a specific datasource');
console.log('');
