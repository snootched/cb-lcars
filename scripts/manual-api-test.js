/**
 * Manual API Test
 *
 * Paste this in console to manually test if CBLCARSUnifiedAPI.attach() works
 */

console.log('🧪 Manual API Attachment Test\n');

// Check if API class is available
if (typeof window.CBLCARSUnifiedAPI === 'undefined') {
  console.error('❌ CBLCARSUnifiedAPI class not found in window!');
  console.log('   This means the module was tree-shaken or not loaded.');
} else {
  console.log('✅ CBLCARSUnifiedAPI class found\n');

  // Check current state
  console.log('📋 Before manual attach:');
  console.log('  - perf exists:', 'perf' in window.cblcars.debug.msd);
  console.log('  - data exists:', 'data' in window.cblcars.debug.msd);
  console.log('  - visual exists:', 'visual' in window.cblcars.debug.msd);

  // Try manual attach
  console.log('\n🔧 Calling window.CBLCARSUnifiedAPI.attach()...\n');
  try {
    window.CBLCARSUnifiedAPI.attach();
    console.log('✅ Manual attach completed\n');
  } catch (e) {
    console.error('❌ Manual attach failed:', e);
  }

  // Check after attach
  console.log('📋 After manual attach:');
  console.log('  - perf exists:', 'perf' in window.cblcars.debug.msd);
  console.log('  - data exists:', 'data' in window.cblcars.debug.msd);
  console.log('  - visual exists:', 'visual' in window.cblcars.debug.msd);

  if ('perf' in window.cblcars.debug.msd) {
    console.log('  - perf type:', typeof window.cblcars.debug.msd.perf);
    if (typeof window.cblcars.debug.msd.perf === 'object') {
      console.log('  - perf methods:', Object.keys(window.cblcars.debug.msd.perf));
    }
  }
}
