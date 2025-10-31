/**
 * Debug script to analyze the rolling buffer for rolling statistics
 * Shows how much historical data is available for the aggregation window
 */

function analyzeRollingBuffer(datasourceName = 'temp_range') {
  console.log('\n🔍 ROLLING BUFFER ANALYSIS\n' + '='.repeat(80));

  // Get datasource
  const instance = window.cblcars.debug.msd.MsdInstanceManager.getCurrentInstance();
  if (!instance) {
    console.error('❌ No MSD instance found');
    return;
  }

  const dsManager = instance.getDataSourceManager();
  const ds = dsManager.sources.get(datasourceName);
  if (!ds) {
    console.error(`❌ Datasource "${datasourceName}" not found`);
    console.log('Available:', Array.from(dsManager.sources.keys()));
    return;
  }

  const data = ds.getCurrentData();
  console.log(`✅ Datasource: ${datasourceName}`);
  console.log(`Entity: ${data.entity}`);
  console.log('');

  // Analyze buffer
  const buffer = data.buffer;
  if (!buffer || buffer.size() === 0) {
    console.log('⚠️  Buffer is empty - no historical data yet');
    return;
  }

  const bufferSize = buffer.size();
  const bufferCapacity = buffer.capacity;
  const first = buffer.first();
  const last = buffer.last();
  const timeSpanMs = last.t - first.t;
  const timeSpanHours = timeSpanMs / (1000 * 60 * 60);

  console.log('📊 BUFFER STATUS:');
  console.log('-'.repeat(80));
  console.log(`Points stored: ${bufferSize} / ${bufferCapacity} (${(bufferSize/bufferCapacity*100).toFixed(1)}% full)`);
  console.log(`Time span: ${timeSpanHours.toFixed(2)} hours`);
  console.log(`First point: ${new Date(first.t).toLocaleString()} → ${first.v}`);
  console.log(`Last point:  ${new Date(last.t).toLocaleString()} → ${last.v}`);
  console.log('');

  // Analyze rolling statistics configuration
  console.log('📈 ROLLING STATISTICS CONFIG:');
  console.log('-'.repeat(80));

  ds.aggregations.forEach((proc, key) => {
    if (proc.config?.type === 'rolling_statistics') {
      const windowMs = proc.window || 0; // ✅ Use proc.window, not config.windowMs
      const windowHours = windowMs / (1000 * 60 * 60);

      console.log(`Key: ${key}`);
      console.log(`  Window: ${proc.config.window} (${windowMs}ms = ${windowHours.toFixed(1)}h)`);
      console.log(`  Stats: [${proc.config.stats.join(', ')}]`);
      console.log(`  Output format: ${proc.config.output_format}`);
      console.log('');

      // Compare buffer span to window requirement
      if (timeSpanMs < windowMs) {
        const coverage = (timeSpanMs / windowMs * 100).toFixed(1);
        console.log(`  ⚠️  WARNING: Buffer only covers ${coverage}% of requested window!`);
        console.log(`     Need: ${windowHours.toFixed(1)}h of data`);
        console.log(`     Have: ${timeSpanHours.toFixed(2)}h of data`);
        console.log(`     Missing: ${(windowHours - timeSpanHours).toFixed(2)}h`);
      } else {
        console.log(`  ✅ Buffer has sufficient data for full window calculation`);
      }
      console.log('');      // Show current result
      const result = data.aggregations[key];
      console.log(`  Current result: [${result}]`);
      proc.config.stats.forEach((stat, i) => {
        console.log(`    [${i}] ${stat}: ${result[i]}`);
      });
    }
  });

  // Show buffer fill rate
  console.log('\n📉 DATA COLLECTION RATE:');
  console.log('-'.repeat(80));
  const pointsPerHour = bufferSize / timeSpanHours;
  const minutesPerPoint = 60 / pointsPerHour;
  console.log(`Average: ${pointsPerHour.toFixed(1)} points/hour (one point every ${minutesPerPoint.toFixed(1)} minutes)`);

  // Calculate all stats over the actual buffer
  console.log('\n🔢 STATS OVER ACTUAL BUFFER DATA:');
  console.log('-'.repeat(80));
  const allPoints = buffer.getAll();
  const values = allPoints.map(p => p.v);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median = values.length % 2 === 0
    ? (sorted[values.length/2-1] + sorted[values.length/2]) / 2
    : sorted[Math.floor(values.length/2)];

  console.log(`Min:    ${min.toFixed(2)}`);
  console.log(`Max:    ${max.toFixed(2)}`);
  console.log(`Mean:   ${mean.toFixed(2)}`);
  console.log(`Median: ${median.toFixed(2)}`);
  console.log(`Range:  ${(max - min).toFixed(2)}`);

  console.log('\n' + '='.repeat(80));
}// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.cblcars?.debug?.msd?.MsdInstanceManager) {
  console.log('💡 TIP: Call analyzeRollingBuffer("your_datasource_name") to inspect');
}
