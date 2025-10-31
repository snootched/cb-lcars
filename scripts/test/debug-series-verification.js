// Quick verification script for rolling_statistics_series
// Copy/paste into browser console after loading dashboard with test config

console.log('=== Rolling Statistics Series Verification ===\n');

try {
  // Get MSD instance and datasource manager
  const instance = window.cblcars?.debug?.msd?.MsdInstanceManager?.getCurrentInstance();
  if (!instance) {
    console.error('❌ No MSD instance found. Is dashboard loaded?');
  } else {
    const dsManager = instance.getDataSourceManager();
    const sources = Array.from(dsManager.sources.keys());

    console.log('✅ Available datasources:', sources.join(', '));

    // Look for datasources with rolling_statistics_series
    let found = false;

    for (const name of sources) {
      const ds = dsManager.sources.get(name);
      const data = ds.getCurrentData();
      const aggregations = data.aggregations || {};

      // Check each aggregation
      for (const [key, value] of Object.entries(aggregations)) {
        // Time-series aggregations are arrays of [timestamp, stats] pairs
        if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length === 2) {
          found = true;

          console.log(`\n📊 Datasource: ${name}`);
          console.log(`   Aggregation: ${key}`);
          console.log(`   Type: rolling_statistics_series (time-series)`);
          console.log(`   Points: ${value.length}`);

          if (value.length > 0) {
            const first = value[0];
            const last = value[value.length - 1];

            // Format timestamps
            const firstTime = new Date(first[0]).toLocaleString();
            const lastTime = new Date(last[0]).toLocaleString();

            console.log(`   First: [${firstTime}, ${JSON.stringify(first[1])}]`);
            console.log(`   Last:  [${lastTime}, ${JSON.stringify(last[1])}]`);

            // Calculate interval if we have multiple points
            if (value.length > 1) {
              const intervalMs = value[1][0] - value[0][0];
              const intervalMin = Math.round(intervalMs / 60000);
              console.log(`   Interval: ~${intervalMin} minutes`);
            }

            // Check if data looks valid for ApexCharts
            const hasValidStructure = value.every(entry =>
              Array.isArray(entry) &&
              entry.length === 2 &&
              typeof entry[0] === 'number' &&
              Array.isArray(entry[1])
            );

            if (hasValidStructure) {
              console.log('   ✅ Valid ApexCharts rangeArea format');
            } else {
              console.log('   ⚠️ Structure may not be compatible with ApexCharts');
            }

            // Show buffer stats for context
            console.log(`\n   Buffer info:`);
            console.log(`   - Current value: ${data.v}`);
            console.log(`   - Current timestamp: ${new Date(data.t).toLocaleString()}`);
            console.log(`   - Buffer size: ${data.buffer?.size() || 0} points`);
          }
        }
      }
    }

    if (!found) {
      console.log('\n⚠️ No rolling_statistics_series aggregations found.');
      console.log('   Either:');
      console.log('   1. No datasources configured with rolling_statistics_series');
      console.log('   2. Not enough time has passed for first interval calculation');
      console.log('   3. Buffer lacks sufficient data\n');
      console.log('   To test, add this to your YAML:');
      console.log(`
      aggregations:
        - type: rolling_statistics_series
          key: test_series
          window: "1h"
          interval: "5m"
          stats: [min, max]
          max_points: 50
      `);
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
}

console.log('\n=== End Verification ===');
