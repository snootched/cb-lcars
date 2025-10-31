I'll analyze the current MSD implementation for multi-instance support and provide recommendations.Based on my review of the codebase, you are absolutely correct - **the current MSD system is designed for a single instance only**. Here's my comprehensive analysis and recommendation:

## Current Single-Instance Design Evidence

The MSD system has several single-instance assumptions built into its architecture:

### 1. **Global Window References**
```javascript
// PipelineCore.js
window.cblcars.debug.msd = window.cblcars.debug.msd || {};
window.cblcars.debug.msd.pipelineInstance = pipelineApi;
window.cblcars.debug.msd.routing = systemsManager.router;
window.cblcars.debug.msd.systemsManager = systemsManager;

// MsdApi.js
window.cblcars.msd.api = { /* unified API */ };

// Various components use these global references
window.__msdHudBus = (evt, payload) => this.bus.emit(evt, payload || {});
window.__msdHudPanelControls = { /* global panel controls */ };
```

### 2. **Singleton HUD Manager**
The `MsdHudManager` attaches directly to `document.body` and uses global event handlers:
```javascript
// MsdHudManager.js
window.cblcars.debug.msd.hud = {
  manager: this,
  refresh: () => this.refresh(),
  // ... other methods
};
```

### 3. **Global Card Instance Storage**
```javascript
// Multiple storage locations for card instance
window.cb_lcars_card_instance = this;
window._currentCardInstance = this;
window.cblcars.debug.msd.cardInstance = this;
```

### 4. **Shared Resource Managers**
- DataSourceManager, SystemsManager, and other core systems are stored globally
- No namespacing or instance isolation
- Cleanup methods remove global references entirely

## My Recommendation: **Option 1 - Single Instance Protection**

I strongly recommend **Option 1: Add protections for single instance only** for these reasons:

### Why Single Instance is Better:

1. **Resource Efficiency**: Multiple MSD instances would create significant overhead:
   - Each would have its own DataSourceManager, SystemsManager, renderer, etc.
   - Memory usage would multiply unnecessarily
   - HASS subscription conflicts could occur

2. **Complexity Avoidance**: Supporting multiple instances would require:
   - Complete namespace isolation
   - Complex resource sharing decisions
   - Conflict resolution between instances
   - Much more complex cleanup logic

3. **Clear UX Pattern**: Having a single "active" MSD aligns with typical dashboard patterns where one primary system display is active at a time.

4. **Debug/HUD Clarity**: The debug HUD and introspection tools work much better with a single authoritative instance.

## Implementation Strategy

```javascript
// src/msd/pipeline/MsdInstanceManager.js
export class MsdInstanceManager {
  static _currentInstance = null;
  static _currentMountElement = null;

  /**
   * Request MSD instance initialization with single-instance protection
   * @param {Object} userMsdConfig - MSD configuration
   * @param {HTMLElement} mountEl - Mount element
   * @param {Object} hass - Home Assistant instance
   * @returns {Promise<Object>} Pipeline API or existing instance
   */
  static async requestInstance(userMsdConfig, mountEl, hass) {
    // Check if instance already exists
    if (MsdInstanceManager._currentInstance) {
      const existingMount = MsdInstanceManager._currentMountElement;

      cblcarsLog.warn('[MsdInstanceManager] 🚨 MSD instance already exists:', {
        existingMount: existingMount?.tagName,
        requestedMount: mountEl?.tagName,
        sameMount: existingMount === mountEl
      });

      // If same mount element, return existing instance
      if (existingMount === mountEl) {
        cblcarsLog.debug('[MsdInstanceManager] ✅ Returning existing instance for same mount');
        return MsdInstanceManager._currentInstance;
      }

      // Different mount element - this is likely a view change or edit mode
      cblcarsLog.warn('[MsdInstanceManager] ⚠️ Blocking new MSD instance - only one allowed per window');
      cblcarsLog.warn('[MsdInstanceManager] 💡 Call destroyInstance() first if you need to reinitialize');

      // Return a disabled pipeline that explains the situation
      return {
        enabled: false,
        blocked: true,
        reason: 'Another MSD instance is already active',
        existingMount: existingMount?.tagName,
        requestedMount: mountEl?.tagName,
        destroyExisting: () => MsdInstanceManager.destroyInstance(),
        getExistingInstance: () => MsdInstanceManager._currentInstance
      };
    }

    // No existing instance - create new one
    try {
      const pipelineApi = await initMsdPipeline(userMsdConfig, mountEl, hass);

      // Store instance references
      MsdInstanceManager._currentInstance = pipelineApi;
      MsdInstanceManager._currentMountElement = mountEl;

      // Enhanced cleanup on instance
      pipelineApi.destroy = () => MsdInstanceManager.destroyInstance();

      cblcarsLog.debug('[MsdInstanceManager] ✅ New MSD instance created and registered');
      return pipelineApi;

    } catch (error) {
      cblcarsLog.error('[MsdInstanceManager] ❌ Failed to create MSD instance:', error);
      throw error;
    }
  }

  /**
   * Destroy current MSD instance and clean up all resources
   */
  static async destroyInstance() {
    if (!MsdInstanceManager._currentInstance) {
      cblcarsLog.debug('[MsdInstanceManager] No active instance to destroy');
      return;
    }

    cblcarsLog.debug('[MsdInstanceManager] 🧹 Destroying MSD instance...');

    try {
      // Call existing cleanup methods
      const instance = MsdInstanceManager._currentInstance;

      if (instance.systemsManager?.destroy) {
        await instance.systemsManager.destroy();
      }

      // Clear global references
      if (typeof window !== 'undefined') {
        delete window.cblcars.debug.msd?.pipelineInstance;
        delete window.cblcars.debug.msd?.systemsManager;
        delete window.cblcars.debug.msd?.routing;
        delete window.cblcars.debug.msd?.hud;

        // Clear card instance references
        delete window.cb_lcars_card_instance;
        delete window._currentCardInstance;
        delete window._msdCardInstance;

        // Clear HUD references
        delete window.__msdHudBus;
        delete window.__msdHudPanelControls;
      }

      // Clear instance references
      MsdInstanceManager._currentInstance = null;
      MsdInstanceManager._currentMountElement = null;

      cblcarsLog.debug('[MsdInstanceManager] ✅ MSD instance destroyed and references cleared');

    } catch (error) {
      cblcarsLog.error('[MsdInstanceManager] ❌ Error during instance destruction:', error);
    }
  }

  /**
   * Get current active instance (if any)
   */
  static getCurrentInstance() {
    return MsdInstanceManager._currentInstance;
  }

  /**
   * Check if an instance is currently active
   */
  static hasActiveInstance() {
    return !!MsdInstanceManager._currentInstance;
  }

  /**
   * Force replace current instance (for development/debugging)
   */
  static async forceReplace(userMsdConfig, mountEl, hass) {
    cblcarsLog.warn('[MsdInstanceManager] 🔄 Force replacing MSD instance');
    await MsdInstanceManager.destroyInstance();
    return MsdInstanceManager.requestInstance(userMsdConfig, mountEl, hass);
  }
}
```

## Integration Points

**Update cb-lcars-msd.yaml custom field:**
```javascript
// Replace direct initMsdPipeline call with:
const { MsdInstanceManager } = await import('./path/to/MsdInstanceManager.js');
const pipelineApi = await MsdInstanceManager.requestInstance(msdConfig, mount, realHass);

if (!pipelineApi.enabled) {
  if (pipelineApi.blocked) {
    return `<div style="color:orange;padding:10px;">
      MSD instance blocked - ${pipelineApi.reason}
      <br>Mount: ${pipelineApi.requestedMount} (existing: ${pipelineApi.existingMount})
      <br><button onclick="window.__msdForceReplace?.()">Force Replace</button>
    </div>`;
  }
  return `<div style="color:red;padding:10px;">MSD initialization failed</div>`;
}
```

**Add global debugging helpers:**
```javascript
// Expose helpful debugging functions
if (typeof window !== 'undefined') {
  window.__msdForceReplace = () => {
    const currentMount = MsdInstanceManager._currentMountElement;
    if (currentMount) {
      // Trigger re-render of current card to use force replace
      console.log('Use MsdInstanceManager.forceReplace() for clean replacement');
    }
  };

  window.__msdStatus = () => {
    console.table({
      'Has Active Instance': MsdInstanceManager.hasActiveInstance(),
      'Current Mount': MsdInstanceManager._currentMountElement?.tagName || 'none',
      'Instance Enabled': MsdInstanceManager._currentInstance?.enabled || false
    });
  };
}
```

This approach provides:
- Clear single-instance enforcement
- Graceful handling of view switches
- Proper cleanup when needed
- Development-friendly debugging
- Explicit control over instance lifecycle

The overhead is minimal, and it prevents the complex resource conflicts that would arise from multiple instances while providing clear feedback about what's happening.




Preview mode enhancements:

Great question! With the single-instance protection approach, here's what would appear in the **Home Assistant editor preview window**:

## Preview Window Behavior

When Home Assistant is in **edit mode** and shows the card preview, the MSD Instance Manager would detect this scenario and display a clear, informative message instead of blocking or erroring out.

Here's what I recommend implementing:

### Enhanced MsdInstanceManager for Preview Support

```javascript
// src/msd/pipeline/MsdInstanceManager.js
export class MsdInstanceManager {
  static _currentInstance = null;
  static _currentMountElement = null;

  /**
   * Request MSD instance initialization with single-instance and preview support
   * @param {Object} userMsdConfig - MSD configuration
   * @param {HTMLElement} mountEl - Mount element
   * @param {Object} hass - Home Assistant instance
   * @param {boolean} isPreview - Whether this is a preview render
   * @returns {Promise<Object>} Pipeline API or preview content
   */
  static async requestInstance(userMsdConfig, mountEl, hass, isPreview = false) {
    // Handle preview mode specially
    if (isPreview) {
      cblcarsLog.debug('[MsdInstanceManager] 🔍 Preview mode detected - returning preview content');
      return MsdInstanceManager._createPreviewContent(userMsdConfig, mountEl);
    }

    // Check if instance already exists (non-preview)
    if (MsdInstanceManager._currentInstance) {
      const existingMount = MsdInstanceManager._currentMountElement;

      // If same mount element, return existing instance
      if (existingMount === mountEl) {
        return MsdInstanceManager._currentInstance;
      }

      // Different mount element - return informative blocked response
      return {
        enabled: false,
        blocked: true,
        reason: 'Another MSD instance is already active',
        existingMount: existingMount?.tagName,
        requestedMount: mountEl?.tagName,
        html: MsdInstanceManager._createBlockedContent(existingMount, mountEl)
      };
    }

    // No existing instance - create new one
    try {
      const pipelineApi = await initMsdPipeline(userMsdConfig, mountEl, hass);

      MsdInstanceManager._currentInstance = pipelineApi;
      MsdInstanceManager._currentMountElement = mountEl;
      pipelineApi.destroy = () => MsdInstanceManager.destroyInstance();

      return pipelineApi;

    } catch (error) {
      cblcarsLog.error('[MsdInstanceManager] ❌ Failed to create MSD instance:', error);
      throw error;
    }
  }

  /**
   * Create preview content for Home Assistant editor
   * @private
   */
  static _createPreviewContent(userMsdConfig, mountEl) {
    const msdConfig = userMsdConfig?.msd || {};
    const baseSvg = msdConfig.base_svg?.source || 'ncc-1701-a-blue';
    const overlayCount = (msdConfig.overlays || []).length;
    const dataSourceCount = Object.keys(msdConfig.data_sources || {}).length;
    const rulesCount = (msdConfig.rules || []).length;

    return {
      enabled: true,
      preview: true,
      html: `
        <div style="
          width: 100%;
          height: 300px;
          background: linear-gradient(135deg, #001122 0%, #000611 100%);
          border: 2px solid var(--lcars-cyan, #00ffff);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--lcars-cyan, #00ffff);
          font-family: 'Antonio', monospace;
          position: relative;
          overflow: hidden;
        ">
          <!-- Background pattern -->
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image:
              radial-gradient(circle at 20% 20%, rgba(0,255,255,0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(255,170,0,0.1) 0%, transparent 50%);
            z-index: 0;
          "></div>

          <!-- Content -->
          <div style="z-index: 1; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px; color: var(--lcars-orange, #ff9900);">
              CB-LCARS MSD Preview
            </div>

            <div style="font-size: 14px; margin-bottom: 12px;">
              Master Systems Display Configuration
            </div>

            <div style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin: 20px 0;
              font-size: 12px;
              color: var(--lcars-white, #ffffff);
            ">
              <div style="text-align: right;">
                <div>Base SVG:</div>
                <div>Overlays:</div>
                <div>Data Sources:</div>
                <div>Rules:</div>
              </div>
              <div style="text-align: left; color: var(--lcars-yellow, #ffcc00);">
                <div>${baseSvg}</div>
                <div>${overlayCount}</div>
                <div>${dataSourceCount}</div>
                <div>${rulesCount}</div>
              </div>
            </div>

            <div style="
              font-size: 11px;
              opacity: 0.8;
              margin-top: 20px;
              padding: 8px;
              background: rgba(0,0,0,0.3);
              border-radius: 4px;
              border-left: 3px solid var(--lcars-orange, #ff9900);
            ">
              Preview Mode: Full MSD functionality available when dashboard is not in edit mode
            </div>
          </div>

          <!-- Corner accents -->
          <div style="
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            border-top: 3px solid var(--lcars-orange, #ff9900);
            border-right: 3px solid var(--lcars-orange, #ff9900);
            border-radius: 0 8px 0 0;
          "></div>
          <div style="
            position: absolute;
            bottom: 10px;
            left: 10px;
            width: 40px;
            height: 40px;
            border-bottom: 3px solid var(--lcars-cyan, #00ffff);
            border-left: 3px solid var(--lcars-cyan, #00ffff);
            border-radius: 0 0 0 8px;
          "></div>
        </div>
      `
    };
  }

  /**
   * Create blocked instance content
   * @private
   */
  static _createBlockedContent(existingMount, requestedMount) {
    return `
      <div style="
        width: 100%;
        height: 200px;
        background: linear-gradient(135deg, #220011 0%, #110006 100%);
        border: 2px solid var(--lcars-red, #ff0000);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--lcars-red, #ff0000);
        font-family: 'Antonio', monospace;
        text-align: center;
        padding: 20px;
      ">
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">
          ⚠️ MSD Instance Conflict
        </div>

        <div style="font-size: 14px; margin-bottom: 12px; color: var(--lcars-white, #ffffff);">
          Another MSD instance is already active
        </div>

        <div style="font-size: 12px; opacity: 0.8; margin-bottom: 16px;">
          Active: ${existingMount} | Requested: ${requestedMount}
        </div>

        <button onclick="window.__msdForceReplace?.()" style="
          background: var(--lcars-orange, #ff9900);
          color: black;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
          font-weight: bold;
        ">
          FORCE REPLACE
        </button>

        <div style="font-size: 10px; margin-top: 12px; opacity: 0.6;">
          Only one MSD instance allowed per window
        </div>
      </div>
    `;
  }
}
```

### Updated cb-lcars-msd.yaml Integration

```javascript
// In cb-lcars-msd.yaml custom field
const { MsdInstanceManager } = await import('./path/to/MsdInstanceManager.js');

// Detect if we're in preview mode
const isPreview = this.preview ||
                  this.closest('hui-card-preview') ||
                  document.querySelector('hui-panel-mode') ||
                  window.location.hash.includes('edit=1');

const pipelineApi = await MsdInstanceManager.requestInstance(
  msdConfig,
  mount,
  realHass,
  isPreview
);

if (pipelineApi.preview) {
  // Return preview HTML directly
  return pipelineApi.html;
}

if (!pipelineApi.enabled) {
  if (pipelineApi.blocked) {
    // Return blocked instance HTML
    return pipelineApi.html;
  }
  return `<div style="color:red;padding:10px;">MSD initialization failed</div>`;
}

// Normal MSD initialization continues...
```

### Preview Mode Features

The preview would show:

1. **Visual Preview**: A styled representation of the MSD card with LCARS theming
2. **Configuration Summary**: Key stats about the MSD configuration:
   - Base SVG being used
   - Number of overlays configured
   - Number of data sources
   - Number of rules
3. **Clear Status**: Indication that this is preview mode and full functionality is available when not editing
4. **LCARS Styling**: Proper theming consistent with the actual MSD appearance

### Benefits of This Approach

1. **Clear User Feedback**: Users understand exactly what's happening
2. **Configuration Visibility**: They can see their configuration is being recognized
3. **Professional Appearance**: The preview looks polished and intentional
4. **No Confusion**: Clear distinction between preview and blocked states
5. **Debugging Helper**: The "Force Replace" button provides an escape hatch for development

This approach ensures that:
- **Preview mode** shows an informative, styled preview
- **Multiple instances** are clearly blocked with helpful messaging
- **Single active instance** works normally
- **Development workflow** isn't hindered

The preview gives users confidence that their MSD configuration is valid while clearly indicating that the full functionality requires exiting edit mode.