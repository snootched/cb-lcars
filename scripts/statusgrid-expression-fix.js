// Quick fix for StatusGridRenderer expression bug
// Apply this fix by pasting into browser console

console.log('🔧 Applying StatusGridRenderer expression fix...');

// The issue is that StatusGridRenderer uses update data from the wrong source
// when evaluating expressions. We need to make it always fetch the actual entity value.

// This is a runtime patch - the actual fix should be applied to the source code
if (window.__msdDebug?.pipelineInstance?.systemsManager?.renderer?.statusGridRenderer) {
  const renderer = window.__msdDebug.pipelineInstance.systemsManager.renderer.statusGridRenderer;
  console.log('✅ Found StatusGridRenderer for patching');

  // Store original method
  if (!renderer._originalProcessUnifiedContent) {
    renderer._originalProcessUnifiedContent = renderer.processUnifiedContent;

    // Override with fixed version
    renderer.processUnifiedContent = function(content, overlay, updateData) {
      console.log('[StatusGridRenderer-FIXED] Processing content:', content);

      // For expressions, ignore updateData and always fetch actual values
      if (content.includes('?') && content.includes(':')) {
        console.log('[StatusGridRenderer-FIXED] Expression detected - using fresh entity values');
        return renderer._originalProcessUnifiedContent.call(this, content, overlay, null);
      } else {
        // For simple templates, use original logic
        return renderer._originalProcessUnifiedContent.call(this, content, overlay, updateData);
      }
    };

    console.log('✅ StatusGridRenderer patched successfully');
  } else {
    console.log('⚠️ StatusGridRenderer already patched');
  }
} else {
  console.log('❌ StatusGridRenderer not found for patching');
}

// Alternative approach: patch the DataSourceMixin template processing
if (window.DataSourceMixin?.processTemplate) {
  console.log('✅ Found DataSourceMixin.processTemplate for monitoring');

  const originalProcessTemplate = window.DataSourceMixin.processTemplate;
  let callCount = 0;

  window.DataSourceMixin.processTemplate = function(template, updateData) {
    callCount++;
    console.log(`[DataSourceMixin-MONITOR] Call ${callCount}: template="${template}", hasUpdateData=${!!updateData}`);

    if (updateData) {
      console.log(`[DataSourceMixin-MONITOR] Update data:`, updateData);
    }

    const result = originalProcessTemplate.call(this, template, updateData);
    console.log(`[DataSourceMixin-MONITOR] Result: "${result}"`);

    return result;
  };

  console.log('✅ DataSourceMixin.processTemplate monitoring enabled');
} else {
  console.log('❌ DataSourceMixin.processTemplate not found');
}

console.log('🔧 Runtime patches applied. Test the status grid now to see if expressions work correctly.');