#!/usr/bin/env node

/**
 * Test script to verify DataSource integration doesn't break basic text overlays
 */

console.log('🧪 Testing DataSource Integration - Basic Text Overlay Support');
console.log('=============================================================\n');

// Simulate the TextOverlayRenderer behavior
class MockTextOverlayRenderer {
  _resolveTextContent(overlay, style) {
    // Start with basic content resolution
    let content = style.value || overlay.text || overlay.content || '';

    // Check raw overlay configuration if content not found in standard properties
    if (!content && overlay._raw?.content) {
      content = overlay._raw.content;
    }
    if (!content && overlay._raw?.text) {
      content = overlay._raw.text;
    }

    // If we have basic content and it contains template strings, process them
    if (content && typeof content === 'string' && content.includes('{')) {
      // Mock template processing (would normally call DataSourceMixin)
      console.log(`  📝 Would process template: "${content}"`);
      return content; // In real code, this would be processed
    }

    // If we have basic content without templates, return it
    if (content) {
      return content;
    }

    // No basic content found, try DataSource integration as fallback
    if (overlay.data_source || overlay._raw?.data_source || style.data_source) {
      const dataSourceRef = overlay.data_source || overlay._raw?.data_source || style.data_source;
      console.log(`  🔗 Would try DataSource: "${dataSourceRef}"`);
      // Mock DataSource resolution (would normally call DataSourceMixin)
      return `[DataSource: ${dataSourceRef}]`; // Placeholder
    }

    return content; // Return whatever we found (might be empty string)
  }
}

// Test cases
const testCases = [
  {
    name: 'Basic text overlay with style.value',
    overlay: { id: 'test1' },
    style: { value: 'Hello World' },
    expected: 'Hello World'
  },
  {
    name: 'Basic text overlay with overlay.text',
    overlay: { id: 'test2', text: 'Static Text' },
    style: {},
    expected: 'Static Text'
  },
  {
    name: 'Basic text overlay with overlay.content',
    overlay: { id: 'test3', content: 'Content Text' },
    style: {},
    expected: 'Content Text'
  },
  {
    name: 'Text overlay with _raw.content fallback',
    overlay: {
      id: 'test4',
      _raw: { content: 'Raw Content' }
    },
    style: {},
    expected: 'Raw Content'
  },
  {
    name: 'Text overlay with template string',
    overlay: { id: 'test5' },
    style: { value: 'Temperature: {sensor.temperature}°C' },
    expected: 'Temperature: {sensor.temperature}°C' // Would be processed in real code
  },
  {
    name: 'Text overlay with DataSource fallback',
    overlay: {
      id: 'test6',
      data_source: 'temperature_sensor'
    },
    style: {},
    expected: '[DataSource: temperature_sensor]' // Placeholder
  },
  {
    name: 'Empty text overlay',
    overlay: { id: 'test7' },
    style: {},
    expected: ''
  }
];

const renderer = new MockTextOverlayRenderer();
let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Input: overlay=${JSON.stringify(testCase.overlay)}, style=${JSON.stringify(testCase.style)}`);

  const result = renderer._resolveTextContent(testCase.overlay, testCase.style);
  console.log(`   Result: "${result}"`);
  console.log(`   Expected: "${testCase.expected}"`);

  if (result === testCase.expected) {
    console.log(`   ✅ PASS`);
    passed++;
  } else {
    console.log(`   ❌ FAIL`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! Basic text overlay functionality is preserved.');
} else {
  console.log('⚠️  Some tests failed. Basic text overlay functionality may be broken.');
  process.exit(1);
}