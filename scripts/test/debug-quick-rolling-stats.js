/**
 * QUICK DEBUG: Paste this in browser console to check rolling stats
 *
 * Steps:
 * 1. Open Home Assistant dashboard with your cb-lcars-msd card
 * 2. Open browser console (F12)
 * 3. Copy/paste this entire script
 * 4. It will automatically run and show results
 */

(function quickDebugRollingStats() {
  console.log('\n🔍 QUICK ROLLING STATS DEBUG\n' + '='.repeat(60));

  // Use CB-LCARS debug API
  if (!window.cblcars?.debug?.msd?.MsdInstanceManager) {
    console.error('❌ CB-LCARS debug API not available!');
    console.log('Make sure the card is loaded.');
    return;
  }

  // Get current instance and datasources
  const instance = window.cblcars.debug.msd.MsdInstanceManager.getCurrentInstance();
  if (!instance) {
    console.error('❌ No MSD instance found!');
    return;
  }

  const dsManager = instance.getDataSourceManager?.();
  if (!dsManager) {
    console.error('❌ DataSourceManager not available!');
    return;
  }

  const allSources = dsManager.sources;
  console.log(`\n📊 Found ${allSources.size} datasources:\n`);

  allSources.forEach((ds, name) => {
    const data = ds.getCurrentData();
    if (!data.aggregations) return;

    const hasRollingStats = Object.keys(data.aggregations).some(key => {
      const proc = ds.aggregations?.get(key);
      return proc?.config?.type === 'rolling_statistics';
    });

    if (hasRollingStats) {
      console.log(`\n🎯 ${name}:`);
      Object.entries(data.aggregations).forEach(([key, value]) => {
        const proc = ds.aggregations?.get(key);
        if (proc?.config?.type === 'rolling_statistics') {
          console.log(`  ${key}:`, value);
          console.log(`    Type: ${Array.isArray(value) ? `✅ Array[${value.length}]` : '⚠️  ' + typeof value}`);
          if (Array.isArray(value)) {
            value.forEach((v, i) => {
              console.log(`      [${i}] ${proc.config.stats[i]}: ${v}`);
            });
          }
        }
      });
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ Debug complete!\n');

  // Look specifically for temp_range
  const tempRange = allSources.get('temp_range');
  if (tempRange) {
    console.log('\n🎯 FOCUSED CHECK: temp_range');
    console.log('='.repeat(60));

    const data = tempRange.getCurrentData();
    console.log('Raw data:', data);

    if (data.aggregations?.hourly_range) {
      const val = data.aggregations.hourly_range;
      console.log('\nhourly_range value:', val);
      console.log('Type:', Array.isArray(val) ? `Array[${val.length}]` : typeof val);

      if (Array.isArray(val)) {
        console.log('✅ SUCCESS: Array output confirmed!');
        console.log('Contents:', val);
      } else {
        console.log('⚠️  Not an array. Check your config:');
        console.log('   - Make sure output_format: array (not "array")');
        console.log('   - Make sure window: "24h" (needs quotes)');
      }
    } else {
      console.log('❌ hourly_range not found in aggregations!');
      console.log('Available aggregations:', Object.keys(data.aggregations || {}));
    }
  } else {
    console.log('\n⚠️  "temp_range" datasource not found!');
    console.log('Available datasources:', Array.from(allSources.keys()));
  }

})();
