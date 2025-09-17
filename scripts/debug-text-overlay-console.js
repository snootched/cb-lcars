// Browser console debug script for text overlay issues
// Run this in the browser console when you see the text overlay error

console.log('🔍 CB-LCARS Text Overlay Debug Utility');
console.log('=====================================\n');

// Check if MSD pipeline is available
const pipeline = window.__msdDebug?.pipelineInstance;
if (!pipeline) {
  console.error('❌ MSD Pipeline not available. Make sure cb-lcars is loaded.');
} else {
  console.log('✅ MSD Pipeline found');

  // Get the configuration
  const config = pipeline.getRenderedConfig?.();
  if (config && config.overlays) {
    console.log(`📋 Found ${config.overlays.length} overlays in configuration`);

    // Look for text overlays
    const textOverlays = config.overlays.filter(o => o.type === 'text');
    console.log(`📝 Found ${textOverlays.length} text overlays:`);

    textOverlays.forEach((overlay, index) => {
      console.log(`\n${index + 1}. Text Overlay: "${overlay.id}"`);
      console.log('   Raw overlay data:', overlay);
      console.log('   Content sources:');
      console.log(`     - overlay.text: "${overlay.text}"`);
      console.log(`     - overlay.content: "${overlay.content}"`);
      console.log(`     - overlay.data_source: "${overlay.data_source}"`);
      console.log(`     - overlay._raw?.content: "${overlay._raw?.content}"`);
      console.log(`     - overlay._raw?.text: "${overlay._raw?.text}"`);
      console.log(`     - overlay._raw?.data_source: "${overlay._raw?.data_source}"`);

      if (overlay.finalStyle || overlay.style) {
        const style = overlay.finalStyle || overlay.style;
        console.log('   Style sources:');
        console.log(`     - style.value: "${style.value}"`);
        console.log(`     - style.data_source: "${style.data_source}"`);
      }

      // Check position
      console.log('   Position config:');
      console.log(`     - overlay.position: ${JSON.stringify(overlay.position)}`);
    });

    // Check for the specific problematic overlay
    const titleOverlay = textOverlays.find(o => o.id === 'title_overlay');
    if (titleOverlay) {
      console.log('\n🎯 Found problematic "title_overlay":');
      console.log('Full object:', titleOverlay);
    } else {
      console.log('\n⚠️  "title_overlay" not found in text overlays. Check if it exists with different type.');
      // Check all overlays for this ID
      const anyOverlay = config.overlays.find(o => o.id === 'title_overlay');
      if (anyOverlay) {
        console.log('Found overlay with this ID but different type:', anyOverlay);
      }
    }

  } else {
    console.error('❌ No overlay configuration found in pipeline');
  }

  // Check anchors
  const anchors = pipeline.getAnchors?.();
  if (anchors) {
    console.log('\n📍 Available anchors:', Object.keys(anchors));
  } else {
    console.log('\n❌ No anchors found');
  }
}

// Export functions for manual inspection
window.debugTextOverlay = function(overlayId) {
  const pipeline = window.__msdDebug?.pipelineInstance;
  if (!pipeline) {
    console.error('Pipeline not available');
    return;
  }

  const config = pipeline.getRenderedConfig?.();
  const overlay = config?.overlays?.find(o => o.id === overlayId);

  if (!overlay) {
    console.error(`Overlay "${overlayId}" not found`);
    return;
  }

  console.log(`\n🔍 Debugging overlay "${overlayId}":`, overlay);

  // Try to resolve content manually
  const style = overlay.finalStyle || overlay.style || {};
  let content = style.value || overlay.text || overlay.content || '';

  console.log('Manual content resolution:');
  console.log(`1. style.value: "${style.value}"`);
  console.log(`2. overlay.text: "${overlay.text}"`);
  console.log(`3. overlay.content: "${overlay.content}"`);
  console.log(`4. Basic result: "${content}"`);

  if (!content && overlay._raw?.content) {
    content = overlay._raw.content;
    console.log(`5. Found in _raw.content: "${content}"`);
  }
  if (!content && overlay._raw?.text) {
    content = overlay._raw.text;
    console.log(`6. Found in _raw.text: "${content}"`);
  }

  console.log(`Final manual result: "${content}"`);

  return overlay;
};

console.log('\n💡 Run debugTextOverlay("overlay_id") to inspect specific overlays');
console.log('💡 Example: debugTextOverlay("title_overlay")');