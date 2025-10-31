// Test script for BaseOverlayUpdater fix
// Run this to verify the expression cross-contamination is fixed

console.log('🧪 Testing BaseOverlayUpdater Expression Fix');

const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
const baseUpdater = window.__msdDebug?.pipelineInstance?.systemsManager?.overlayUpdater;

if (!baseUpdater) {
  console.log('❌ BaseOverlayUpdater not found');
} else {
  console.log('✅ BaseOverlayUpdater found');

  // Test the content reference checking manually
  const testContent1 = "{test_cpu_temp > 70 ? 'HOT' : 'OK'}";  // Should NOT reference temperature_enhanced
  const testContent2 = "{temperature_enhanced.transformations.celsius:.1f}°C";  // Should reference temperature_enhanced

  const changedIds = ['sensor.toronto_feels_like_temperature'];  // This is what changes

  console.log('🧮 Testing content reference detection:');

  // Test content that should NOT trigger (test_cpu_temp expression)
  const result1 = baseUpdater._contentReferencesChangedDataSources(testContent1, changedIds);
  console.log(`  "${testContent1}" references changed data:`, result1);

  // Test content that SHOULD trigger (temperature_enhanced expression)
  const result2 = baseUpdater._contentReferencesChangedDataSources(testContent2, changedIds);
  console.log(`  "${testContent2}" references changed data:`, result2);

  // The expected results:
  // result1 should be FALSE (test_cpu_temp != temperature_enhanced)
  // result2 should be TRUE (temperature_enhanced matches)

  console.log('📊 Test Results:');
  console.log(`  test_cpu_temp expression correctly ignored: ${!result1 ? '✅' : '❌'}`);
  console.log(`  temperature_enhanced expression correctly detected: ${result2 ? '✅' : '❌'}`);

  if (!result1 && result2) {
    console.log('🎉 BaseOverlayUpdater fix is working correctly!');
  } else {
    console.log('❌ BaseOverlayUpdater fix needs more work');
  }
}

// Also test simulated update
console.log('🧪 Testing simulated temperature_enhanced update...');
const tempSource = dsm?.getSource('temperature_enhanced');
if (tempSource) {
  const mockEvent = {
    new_state: {
      state: '24.5',
      attributes: { unit_of_measurement: '°C' }
    }
  };

  console.log('📊 Before update - monitoring console for status grid updates...');
  tempSource._handleStateChange(mockEvent);
  console.log('📊 Update complete - check console above for status grid cell processing');
} else {
  console.log('❌ temperature_enhanced source not found');
}