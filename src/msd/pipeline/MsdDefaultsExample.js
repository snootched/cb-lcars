/**
 * MSD Defaults Integration Example
 * Shows how the defaults manager integrates with the MSD system for Phase 1
 */

// The defaults manager is automatically initialized in SystemsManager.js
// and available globally at window.cblcars.defaults

// Example 1: Basic font size resolution with viewBox scaling
function exampleFontSizeScaling() {
  const defaults = window.cblcars?.defaults;
  if (!defaults) {
    console.log('Defaults manager not available');
    return;
  }

  console.log('=== Font Size Scaling Example ===');

  const testViewBoxes = [
    { name: 'Small (200x150)', viewBox: [0, 0, 200, 150] },
    { name: 'Reference (400x300)', viewBox: [0, 0, 400, 300] },
    { name: 'Large (800x600)', viewBox: [0, 0, 800, 600] }
  ];

  testViewBoxes.forEach(test => {
    const fontSize = defaults.resolve('text.font_size', { viewBox: test.viewBox });
    console.log(`${test.name}: ${fontSize}`);
  });
}

// Example 2: Text overlay with defaults integration
function exampleTextOverlay() {
  // This is how TextOverlayRenderer uses the defaults manager:

  const defaults = window.cblcars?.defaults;
  if (!defaults) return;

  // Create scaling context
  const scalingContext = {
    viewBox: [0, 0, 800, 600],
    containerElement: document.querySelector('svg')
  };

  // Resolve styled properties with scaling
  const fontSize = defaults.resolve('text.font_size', scalingContext);
  const fontFamily = defaults.resolve('text.font_family', scalingContext);
  const textColor = defaults.resolve('text.color', scalingContext);

  console.log('=== Text Overlay Styling ===');
  console.log(`Font Size: ${fontSize}`);
  console.log(`Font Family: ${fontFamily}`);
  console.log(`Text Color: ${textColor}`);
}

// Example 3: Custom overrides
function exampleCustomOverrides() {
  const defaults = window.cblcars?.defaults;
  if (!defaults) return;

  console.log('=== Custom Overrides Example ===');

  // Set a user override
  defaults.set('user', 'text.font_size', { value: 18, scale: 'viewbox', unit: 'px' });

  // Now all text overlays will use 18px as the base size
  const context = { viewBox: [0, 0, 400, 300] }; // Reference size
  const fontSize = defaults.resolve('text.font_size', context);
  console.log(`Override font size: ${fontSize}`); // Should be "18px"

  // Clear the override
  defaults.set('user', 'text.font_size', undefined);
}

// Example 4: Introspection for debugging
function exampleIntrospection() {
  const defaults = window.cblcars?.defaults;
  if (!defaults) return;

  console.log('=== Defaults Manager State ===');
  const state = defaults.getIntrospectionData();
  console.log('Built-in defaults:', state.layers.builtin);
  console.log('Cache stats:', state.cacheStats);
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.msdDefaultsExamples = {
    fontSizeScaling: exampleFontSizeScaling,
    textOverlay: exampleTextOverlay,
    customOverrides: exampleCustomOverrides,
    introspection: exampleIntrospection
  };
}

export {
  exampleFontSizeScaling,
  exampleTextOverlay,
  exampleCustomOverrides,
  exampleIntrospection
};