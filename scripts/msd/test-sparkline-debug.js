/**
 * Sparkline Debug Test - Check data availability from console
 * This script helps debug why sparklines show "OFFLINE" status
 */

console.log('🔍 MSD Sparkline Debug Test');
console.log('============================\n');

// Instructions for console debugging
console.log('📋 CONSOLE DEBUGGING INSTRUCTIONS:');
console.log('');
console.log('1. Open your browser\'s Developer Tools (F12)');
console.log('2. Navigate to the Console tab');
console.log('3. Copy and paste the following debug commands:');
console.log('');

console.log('🔹 Check if MSD Debug Pipeline is available:');
console.log('```javascript');
console.log('console.log("MSD Debug Pipeline:", window.__msdDebug);');
console.log('console.log("Pipeline Instance:", window.__msdDebug?.pipelineInstance);');
console.log('console.log("Systems Manager:", window.__msdDebug?.pipelineInstance?.systemsManager);');
console.log('console.log("Data Source Manager:", window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager);');
console.log('```');
console.log('');

console.log('🔹 Check available data sources:');
console.log('```javascript');
console.log('const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;');
console.log('if (dsm) {');
console.log('  console.log("Data Sources:", Array.from(dsm.sources.keys()));');
console.log('  console.log("Sources Map:", dsm.sources);');
console.log('  dsm.sources.forEach((source, name) => {');
console.log('    console.log(`Source ${name}:`, source);');
console.log('    console.log(`Current Data:`, source.getCurrentData());');
console.log('    const currentData = source.getCurrentData();');
console.log('    if (currentData?.buffer) {');
console.log('      console.log(`Buffer for ${name}:`, currentData.buffer.getAll());');
console.log('    }');
console.log('  });');
console.log('} else {');
console.log('  console.log("❌ DataSourceManager not available");');
console.log('}');
console.log('```');
console.log('');

console.log('🔹 Test specific sparkline data retrieval:');
console.log('```javascript');
console.log('// Replace "your_source_name" with actual source name from your config');
console.log('const testSourceName = "your_source_name"; // UPDATE THIS');
console.log('');
console.log('const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;');
console.log('if (dsm) {');
console.log('  const source = dsm.getSource(testSourceName);');
console.log('  console.log(`Testing source "${testSourceName}":`, source);');
console.log('  ');
console.log('  if (source) {');
console.log('    const currentData = source.getCurrentData();');
console.log('    console.log("Current Data:", currentData);');
console.log('    ');
console.log('    if (currentData?.buffer) {');
console.log('      const bufferData = currentData.buffer.getAll();');
console.log('      console.log("Buffer Data:", bufferData);');
console.log('      console.log("Buffer Length:", bufferData.length);');
console.log('      ');
console.log('      // Convert to sparkline format');
console.log('      const sparklineData = bufferData.map(point => ({');
console.log('        timestamp: point.t,');
console.log('        value: point.v');
console.log('      }));');
console.log('      console.log("Sparkline Data:", sparklineData);');
console.log('    } else {');
console.log('      console.log("❌ No buffer available");');
console.log('    }');
console.log('  } else {');
console.log('    console.log("❌ Source not found");');
console.log('    console.log("Available sources:", Array.from(dsm.sources.keys()));');
console.log('  }');
console.log('} else {');
console.log('  console.log("❌ DataSourceManager not available");');
console.log('}');
console.log('```');
console.log('');

console.log('🔹 Check sparkline overlays in DOM:');
console.log('```javascript');
console.log('const sparklines = document.querySelectorAll(\'[data-overlay-type="sparkline"]\');');
console.log('console.log("Sparkline elements found:", sparklines.length);');
console.log('sparklines.forEach((el, i) => {');
console.log('  console.log(`Sparkline ${i}:`);');
console.log('  console.log("  ID:", el.getAttribute("data-overlay-id"));');
console.log('  console.log("  Source:", el.getAttribute("data-source"));');
console.log('  console.log("  Status:", el.getAttribute("data-status"));');
console.log('  console.log("  Element:", el);');
console.log('});');
console.log('```');
console.log('');

console.log('🔹 Manual sparkline data test:');
console.log('```javascript');
console.log('// Test the SparklineRenderer directly');
console.log('const testResult = window.SparklineRenderer?.getHistoricalDataForSparkline("your_source_name");');
console.log('console.log("Manual test result:", testResult);');
console.log('```');
console.log('');

console.log('📊 COMMON ISSUES TO CHECK:');
console.log('');
console.log('1. ❓ MSD not initialized:');
console.log('   - window.__msdDebug is undefined');
console.log('   - Solution: Wait for MSD to fully load');
console.log('');
console.log('2. ❓ Data source not configured:');
console.log('   - Source name in overlay doesn\'t match data_sources config');
console.log('   - Solution: Check YAML configuration');
console.log('');
console.log('3. ❓ No historical data:');
console.log('   - Buffer exists but is empty');
console.log('   - Solution: Wait for data to accumulate or check entity');
console.log('');
console.log('4. ❓ History not enabled:');
console.log('   - Data source lacks history configuration');
console.log('   - Solution: Add history.enabled: true to data source');
console.log('');

console.log('🎯 EXPECTED WORKING CONFIG EXAMPLE:');
console.log('```yaml');
console.log('data_sources:');
console.log('  test_sensor:');
console.log('    entity: sensor.cpu_percent  # Replace with actual entity');
console.log('    history:');
console.log('      enabled: true');
console.log('      hours: 2');
console.log('');
console.log('overlays:');
console.log('  - id: test_sparkline');
console.log('    type: sparkline');
console.log('    source: test_sensor  # Must match data source name');
console.log('    position: [100, 100]');
console.log('    size: [200, 60]');
console.log('```');
console.log('');

console.log('✅ Run these commands in your browser console and report back with the results!');
console.log('');

console.log('💡 TIP: If you see data but sparklines still show OFFLINE,');
console.log('   there might be an issue with the SparklineRenderer integration.');
console.log('   In that case, we\'ll need to check the renderer code path.');
