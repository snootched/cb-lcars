/**
 * Debug why rolling statistics aggregation shows wrong values
 */

function debugAggregationCalculation(datasourceName = 'temp_range') {
  console.log('\n🔍 AGGREGATION CALCULATION DEBUG\n' + '='.repeat(80));

  const instance = window.cblcars.debug.msd.MsdInstanceManager.getCurrentInstance();
  if (!instance) return console.error('❌ No MSD instance');

  const dsManager = instance.getDataSourceManager();
  const ds = dsManager.sources.get(datasourceName);
  if (!ds) return console.error('❌ Datasource not found');

  const data = ds.getCurrentData();
  const buffer = data.buffer;

  console.log('📊 BUFFER DATA:');
  console.log('-'.repeat(80));
  const allPoints = buffer.getAll();
  console.log(`Total points: ${allPoints.length}`);

  // Show all points
  allPoints.forEach((p, i) => {
    const date = new Date(p.t).toLocaleString();
    console.log(`  [${i}] ${date} → ${p.v.toFixed(2)}`);
  });

  const values = allPoints.map(p => p.v);
  const manualMin = Math.min(...values);
  const manualMax = Math.max(...values);

  console.log(`\n📈 MANUAL CALCULATION:`);
  console.log(`  Min: ${manualMin.toFixed(2)}`);
  console.log(`  Max: ${manualMax.toFixed(2)}`);

  console.log(`\n🔢 PROCESSOR RESULT:`);
  ds.aggregations.forEach((proc, key) => {
    if (proc.config?.type === 'rolling_statistics') {
      const result = data.aggregations[key];
      console.log(`  Key: ${key}`);
      console.log(`  Result: [${result}]`);
      console.log(`  Window: ${proc.window}ms (${(proc.window / 3600000).toFixed(1)}h)`);

      // Check internal state
      console.log(`\n🔍 PROCESSOR INTERNAL STATE:`);
      console.log(`  _values array length: ${proc._values?.length || 0}`);
      if (proc._values && proc._values.length > 0) {
        console.log(`  _values: [${proc._values.join(', ')}]`);
        console.log(`  _values min: ${Math.min(...proc._values)}`);
        console.log(`  _values max: ${Math.max(...proc._values)}`);
      }

      // Try calling getValue() directly
      console.log(`\n🔧 CALLING getValue() DIRECTLY:`);
      try {
        const directValue = proc.getValue();
        console.log(`  Direct getValue(): [${directValue}]`);
      } catch (error) {
        console.error(`  Error:`, error.message);
      }

      // Check if cutoff is working correctly
      const now = Date.now();
      const cutoff = now - proc.window;
      const cutoffDate = new Date(cutoff).toLocaleString();
      console.log(`\n⏰ WINDOW CUTOFF:`);
      console.log(`  Now: ${new Date(now).toLocaleString()}`);
      console.log(`  Cutoff: ${cutoffDate}`);
      console.log(`  Window: ${proc.window}ms ago`);

      // Check which buffer points are in window
      const pointsInWindow = allPoints.filter(p => p.t >= cutoff);
      console.log(`\n📍 POINTS IN WINDOW:`);
      console.log(`  Total in window: ${pointsInWindow.length} / ${allPoints.length}`);
      if (pointsInWindow.length > 0) {
        const inWindowValues = pointsInWindow.map(p => p.v);
        console.log(`  Min in window: ${Math.min(...inWindowValues).toFixed(2)}`);
        console.log(`  Max in window: ${Math.max(...inWindowValues).toFixed(2)}`);
        pointsInWindow.forEach((p, i) => {
          console.log(`    [${i}] ${new Date(p.t).toLocaleString()} → ${p.v.toFixed(2)}`);
        });
      }
    }
  });

  console.log('\n' + '='.repeat(80));
}

console.log('💡 Run: debugAggregationCalculation("temp_range")');
