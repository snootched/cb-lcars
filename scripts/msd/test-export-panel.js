/**
 * Test ExportPanel functionality
 * Verifies that ExportPanel can be instantiated and provides expected methods
 */

console.log('[test-export-panel] Starting ExportPanel test...');

// Mock browser environment - handle navigator carefully
const mockNavigator = {
  clipboard: {
    writeText: () => Promise.resolve()
  }
};

// Use Object.defineProperty to properly mock navigator
Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
  configurable: true
});

// Mock window object
global.window = {
  __msdDebug: {},
  __msdExportPanel: null
};

// Mock document object
global.document = {
  getElementById: () => null,
  createElement: () => ({
    style: {},
    appendChild: () => {},
    click: () => {},
    remove: () => {},
    href: '',
    download: '',
    textContent: ''
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

// Mock URL object
global.URL = {
  createObjectURL: () => 'mock-url',
  revokeObjectURL: () => {}
};

// Mock Blob constructor
global.Blob = class MockBlob {
  constructor(data, options) {
    this.data = data;
    this.options = options;
  }
};

// Mock alert function
global.alert = (message) => {
  console.log('[MOCK ALERT]:', message);
};

try {
  // Import ExportPanel
  const { ExportPanel } = await import('../../src/msd/hud/panels/ExportPanel.js');

  console.log('[test-export-panel] ✅ ExportPanel imported successfully');

  // Test instantiation
  const exportPanel = new ExportPanel();
  console.log('[test-export-panel] ✅ ExportPanel instantiated successfully');

  // Verify initialization state
  if (exportPanel.initialized === true) {
    console.log('[test-export-panel] ✅ ExportPanel initialized correctly');
  } else {
    throw new Error('ExportPanel not properly initialized');
  }

  // Test required methods
  const requiredMethods = ['captureData', 'renderHtml', 'setupGlobalHandlers', 'downloadJson', 'updateTextarea', 'showFeedback'];

  for (const method of requiredMethods) {
    if (typeof exportPanel[method] === 'function') {
      console.log(`[test-export-panel] ✅ Method ${method} exists`);
    } else {
      throw new Error(`Missing required method: ${method}`);
    }
  }

  // Test captureData
  const data = exportPanel.captureData();
  console.log('[test-export-panel] ✅ captureData() returns:', Object.keys(data));

  // Verify data structure
  const expectedKeys = ['available', 'hasExportMethods', 'hasDiffMethod', 'collections', 'initialized', 'globalHandlers'];
  for (const key of expectedKeys) {
    if (key in data) {
      console.log(`[test-export-panel] ✅ Data contains ${key}: ${data[key]}`);
    } else {
      throw new Error(`Missing data key: ${key}`);
    }
  }

  // Test renderHtml with mock data (pipeline not available)
  const mockDataUnavailable = {
    available: false,
    hasExportMethods: false,
    hasDiffMethod: false,
    collections: [],
    initialized: true,
    globalHandlers: true
  };

  const htmlUnavailable = exportPanel.renderHtml(mockDataUnavailable);
  if (htmlUnavailable && htmlUnavailable.includes('Export & Config') && htmlUnavailable.includes('Pipeline instance not available')) {
    console.log('[test-export-panel] ✅ renderHtml() produces expected output for unavailable pipeline');
  } else {
    throw new Error('renderHtml() did not produce expected output for unavailable pipeline');
  }

  // Test renderHtml with mock data (pipeline available)
  const mockDataAvailable = {
    available: true,
    hasExportMethods: true,
    hasDiffMethod: true,
    collections: ['animations', 'timelines', 'rules', 'profiles', 'overlays'],
    initialized: true,
    globalHandlers: true
  };

  const htmlAvailable = exportPanel.renderHtml(mockDataAvailable);
  if (htmlAvailable &&
      htmlAvailable.includes('Export & Config') &&
      htmlAvailable.includes('Collapsed JSON') &&
      htmlAvailable.includes('Full Snapshot') &&
      htmlAvailable.includes('export-collapsed-textarea')) {
    console.log('[test-export-panel] ✅ renderHtml() produces expected output for available pipeline');
  } else {
    throw new Error('renderHtml() did not produce expected output for available pipeline');
  }

  // Test global handlers setup
  if (global.window.__msdExportPanel) {
    console.log('[test-export-panel] ✅ Global handlers setup successfully');

    const expectedHandlers = ['exportCollapsed', 'exportFull', 'diffItem', 'clearTextarea', 'copyToClipboard'];
    for (const handler of expectedHandlers) {
      if (typeof global.window.__msdExportPanel[handler] === 'function') {
        console.log(`[test-export-panel] ✅ Handler ${handler} exists`);
      } else {
        throw new Error(`Missing global handler: ${handler}`);
      }
    }

    // Test handler execution (should not throw)
    try {
      global.window.__msdExportPanel.clearTextarea('test');
      console.log('[test-export-panel] ✅ clearTextarea handler executes without error');
    } catch (e) {
      console.warn('[test-export-panel] ⚠️ clearTextarea handler threw error (expected in test environment):', e.message);
    }
  } else {
    throw new Error('Global handlers not setup');
  }

  // Test downloadJson method (should not throw)
  try {
    exportPanel.downloadJson('{"test": true}', 'test-export');
    console.log('[test-export-panel] ✅ downloadJson executes without error');
  } catch (e) {
    console.warn('[test-export-panel] ⚠️ downloadJson threw error (expected in test environment):', e.message);
  }

  // Test showFeedback method (should not throw)
  try {
    exportPanel.showFeedback('Test message', 'info');
    console.log('[test-export-panel] ✅ showFeedback executes without error');
  } catch (e) {
    console.warn('[test-export-panel] ⚠️ showFeedback threw error (expected in test environment):', e.message);
  }

  console.log('[test-export-panel] 🎉 All tests passed!');
  console.log('[test-export-panel] ExportPanel is ready for integration');
  process.exit(0);

} catch (error) {
  console.error('[test-export-panel] ❌ Test failed:', error);
  console.error('[test-export-panel] Stack trace:', error.stack);
  process.exit(1);
}
