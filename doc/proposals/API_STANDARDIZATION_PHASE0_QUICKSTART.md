# API Standardization - Phase 0 Quick Start Guide

## 🎯 Goal

Create the foundation for unified API structure and implement Runtime API.

**Timeline:** Week 1 (5 days)
**Risk Level:** 🟢 Low (no breaking changes to existing code)

---

## 📋 Pre-flight Checklist

Before starting Phase 0:

- [ ] Review implementation plan
- [ ] Approve API structure
- [ ] Create feature branch: `feature/unified-api-phase0`
- [ ] Ensure MSD system is working (baseline)
- [ ] Back up current `window.cblcars` API structure

---

## 📁 File Structure to Create

```
src/api/
  ├── CBLCARSUnifiedAPI.js           # Main orchestrator
  ├── MsdRuntimeAPI.js               # Runtime tier (user-facing)
  ├── MsdDebugAPI.js                 # Debug tier (developer)
  ├── MsdDevAPI.js                   # Dev tier (internal)
  ├── AnimationAPI.js                # Animation API (refactored)
  └── cli/
      ├── CLIHistory.js              # Command history
      ├── CLIAutocomplete.js         # Autocomplete engine
      └── InteractiveCLI.js          # Interactive wrapper

doc/api/
  ├── README.md                      # API overview
  ├── runtime-api.md                 # User-facing docs
  └── examples/
      └── basic-usage.md             # Getting started
```

---

## 🚀 Day 1: Core Structure

### Task 1.1: Create CBLCARSUnifiedAPI.js

**File:** `src/api/CBLCARSUnifiedAPI.js`

```javascript
/**
 * CB-LCARS Unified API - Main Entry Point
 *
 * Orchestrates all API tiers and provides single attachment point.
 * Call CBLCARSUnifiedAPI.attach() to initialize all APIs.
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

export class CBLCARSUnifiedAPI {
  /**
   * Attach all API tiers to window.cblcars
   */
  static attach() {
    if (typeof window === 'undefined') {
      cblcarsLog.warn('[UnifiedAPI] Window not available, skipping API attach');
      return;
    }

    try {
      // Ensure namespace exists
      window.cblcars = window.cblcars || {};

      cblcarsLog.info('[UnifiedAPI] Attaching unified API structure...');

      // Phase 0: Attach Runtime API
      // TODO: Implement MsdRuntimeAPI
      window.cblcars.msd = {
        _placeholder: true,
        _version: 'phase0'
      };

      // Phase 0: Attach Debug API stub
      window.cblcars.debug = window.cblcars.debug || {};
      window.cblcars.debug.msd = {
        _placeholder: true,
        _version: 'phase0'
      };

      // Phase 0: Attach Dev API stub
      window.cblcars.dev = {
        _placeholder: true,
        _version: 'phase0'
      };

      // Note: Animation API (window.cblcars.anim) is already set up in cb-lcars.js
      // We'll refactor it in Phase 3

      cblcarsLog.info('[UnifiedAPI] ✅ Unified API attached successfully');

    } catch (error) {
      cblcarsLog.error('[UnifiedAPI] Failed to attach API:', error);
    }
  }

  /**
   * Detach APIs (for testing/cleanup)
   */
  static detach() {
    if (typeof window === 'undefined') return;

    try {
      delete window.cblcars?.msd;
      delete window.cblcars?.debug?.msd;
      delete window.cblcars?.dev;

      cblcarsLog.info('[UnifiedAPI] API detached');
    } catch (error) {
      cblcarsLog.error('[UnifiedAPI] Error during detach:', error);
    }
  }

  /**
   * Get API version info
   */
  static getVersion() {
    return {
      phase: 0,
      runtime: window.cblcars?.msd?._version || 'not-loaded',
      debug: window.cblcars?.debug?.msd?._version || 'not-loaded',
      dev: window.cblcars?.dev?._version || 'not-loaded'
    };
  }
}

// Auto-attach when module loads
if (typeof window !== 'undefined') {
  CBLCARSUnifiedAPI.attach();
}
```

### Task 1.2: Wire up to main entry point

**File:** `src/cb-lcars.js`

Add import near the top (after MSD system import):

```javascript
// MSD system import
import './msd/index.js';

// NEW: Unified API system
import { CBLCARSUnifiedAPI } from './api/CBLCARSUnifiedAPI.js';
```

The API will auto-attach when the module loads.

### Task 1.3: Test basic structure

Add to browser console:

```javascript
// Check API structure exists
console.log('Runtime API:', window.cblcars.msd);
console.log('Debug API:', window.cblcars.debug.msd);
console.log('Dev API:', window.cblcars.dev);
console.log('Version:', window.CBLCARSUnifiedAPI?.getVersion?.());
```

---

## 🚀 Day 2: Runtime API - Instance Management

### Task 2.1: Create MsdRuntimeAPI.js

**File:** `src/api/MsdRuntimeAPI.js`

```javascript
/**
 * MSD Runtime API - User-facing stable API
 *
 * Provides high-level operations for dashboard builders and integrations.
 * All methods are safe for user scripts and automations.
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { MsdInstanceManager } from '../msd/pipeline/MsdInstanceManager.js';

export class MsdRuntimeAPI {
  /**
   * Create and return the Runtime API object
   */
  static create() {
    return {
      // ==========================================
      // INSTANCE MANAGEMENT
      // ==========================================

      /**
       * Get MSD instance by ID
       * Currently returns single global instance (multi-instance in Phase X)
       *
       * @param {string} [cardId] - Card ID (ignored in Phase 0)
       * @returns {Object|null} Pipeline API instance or null
       */
      getInstance(cardId = null) {
        try {
          const instance = MsdInstanceManager.getCurrentInstance();
          if (!instance) {
            cblcarsLog.debug('[RuntimeAPI] No MSD instance available');
            return null;
          }
          return instance;
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Error getting instance:', error);
          return null;
        }
      },

      /**
       * Get current/active MSD instance
       *
       * @returns {Object|null} Current pipeline API instance
       */
      getCurrentInstance() {
        return MsdRuntimeAPI.create().getInstance();
      },

      /**
       * Get all MSD instances
       * Currently returns array with single instance (multi-instance in Phase X)
       *
       * @returns {Array} Array of pipeline instances
       */
      getAllInstances() {
        const current = MsdRuntimeAPI.create().getInstance();
        return current ? [current] : [];
      },

      // ==========================================
      // STATE & CONFIGURATION
      // ==========================================

      /**
       * Get current card state
       *
       * @param {string} [cardId] - Card ID (optional)
       * @returns {Object|null} State object or null
       */
      getState(cardId = null) {
        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) return null;

          // Get resolved model as a proxy for state
          const model = instance.getResolvedModel?.();
          if (!model) return null;

          return {
            overlays: model.overlays?.length || 0,
            anchors: Object.keys(model.anchors || {}).length,
            hasDebug: !!model.debug?.enabled
          };
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Error getting state:', error);
          return null;
        }
      },

      /**
       * Get current configuration
       *
       * @param {string} [cardId] - Card ID (optional)
       * @returns {Object|null} Configuration object or null
       */
      getConfig(cardId = null) {
        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) return null;

          const model = instance.getResolvedModel?.();
          return model || null;
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Error getting config:', error);
          return null;
        }
      },

      /**
       * Validate current configuration
       *
       * @param {string} [cardId] - Card ID (optional)
       * @returns {Object} Validation result
       */
      validate(cardId = null) {
        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) {
            return {
              success: false,
              error: {
                code: 'MSD_INSTANCE_NOT_FOUND',
                message: 'No MSD instance available'
              }
            };
          }

          // Validation logic would go here
          // For now, basic check
          const model = instance.getResolvedModel?.();
          const isValid = !!model && Array.isArray(model.overlays);

          return {
            success: isValid,
            issues: isValid ? [] : ['Invalid or missing model']
          };
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Validation error:', error);
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.message,
              details: error
            }
          };
        }
      },

      // ==========================================
      // PLACEHOLDER SECTIONS (implement in Day 3-4)
      // ==========================================

      theme: {
        _placeholder: true
      },

      overlays: {
        _placeholder: true
      },

      trigger: (cardId, actionId, params) => {
        cblcarsLog.warn('[RuntimeAPI] trigger() not yet implemented');
      },

      animate: (cardId, animationId) => {
        cblcarsLog.warn('[RuntimeAPI] animate() not yet implemented');
      }
    };
  }
}
```

### Task 2.2: Wire up Runtime API

**File:** `src/api/CBLCARSUnifiedAPI.js`

Update the attach() method:

```javascript
import { MsdRuntimeAPI } from './MsdRuntimeAPI.js';

// In attach() method, replace placeholder:
window.cblcars.msd = MsdRuntimeAPI.create();
```

### Task 2.3: Test instance management

Browser console:

```javascript
// Test instance access
const instance = window.cblcars.msd.getInstance();
console.log('Instance:', instance);

const current = window.cblcars.msd.getCurrentInstance();
console.log('Current:', current);

const all = window.cblcars.msd.getAllInstances();
console.log('All instances:', all);

// Test state access
const state = window.cblcars.msd.getState();
console.log('State:', state);

const config = window.cblcars.msd.getConfig();
console.log('Config:', config);

// Test validation
const validation = window.cblcars.msd.validate();
console.log('Validation:', validation);
```

---

## 🚀 Day 3: Runtime API - Overlays

### Task 3.1: Implement overlay operations

Add to `MsdRuntimeAPI.js`:

```javascript
overlays: {
  /**
   * List all overlays
   *
   * @param {string} [cardId] - Card ID (optional)
   * @returns {Array} Array of overlay objects
   */
  list(cardId = null) {
    try {
      const instance = MsdRuntimeAPI.create().getInstance(cardId);
      if (!instance) return [];

      const model = instance.getResolvedModel?.();
      if (!model?.overlays) return [];

      return model.overlays.map(overlay => ({
        id: overlay.id,
        type: overlay.type,
        position: overlay.position,
        size: overlay.size
      }));
    } catch (error) {
      cblcarsLog.error('[RuntimeAPI] Error listing overlays:', error);
      return [];
    }
  },

  /**
   * Show overlay (make visible)
   *
   * @param {string} [cardId] - Card ID (optional)
   * @param {string} overlayId - Overlay ID
   * @returns {boolean} Success
   */
  show(cardId, overlayId) {
    // Handle single-arg case: show(overlayId)
    if (typeof cardId === 'string' && overlayId === undefined) {
      overlayId = cardId;
      cardId = null;
    }

    cblcarsLog.warn('[RuntimeAPI] overlays.show() not yet implemented');
    return false;
  },

  /**
   * Hide overlay (make invisible)
   *
   * @param {string} [cardId] - Card ID (optional)
   * @param {string} overlayId - Overlay ID
   * @returns {boolean} Success
   */
  hide(cardId, overlayId) {
    if (typeof cardId === 'string' && overlayId === undefined) {
      overlayId = cardId;
      cardId = null;
    }

    cblcarsLog.warn('[RuntimeAPI] overlays.hide() not yet implemented');
    return false;
  },

  /**
   * Highlight overlay temporarily
   *
   * @param {string} [cardId] - Card ID (optional)
   * @param {string} overlayId - Overlay ID
   * @param {number} [duration] - Duration in ms (default: 2000)
   * @returns {boolean} Success
   */
  highlight(cardId, overlayId, duration = 2000) {
    // Handle arg variations
    if (typeof cardId === 'string' && typeof overlayId === 'string') {
      // highlight(cardId, overlayId, duration)
    } else if (typeof cardId === 'string' && typeof overlayId === 'number') {
      // highlight(overlayId, duration)
      duration = overlayId;
      overlayId = cardId;
      cardId = null;
    } else if (typeof cardId === 'string') {
      // highlight(overlayId)
      overlayId = cardId;
      cardId = null;
    }

    try {
      // Use MsdIntrospection if available
      if (window.MsdIntrospection?.highlight) {
        window.MsdIntrospection.highlight([overlayId], { duration });
        return true;
      }

      cblcarsLog.warn('[RuntimeAPI] Highlight not available (MsdIntrospection not loaded)');
      return false;
    } catch (error) {
      cblcarsLog.error('[RuntimeAPI] Error highlighting overlay:', error);
      return false;
    }
  }
}
```

---

## 🚀 Day 4: Runtime API - Theme & Actions

Continue implementing remaining Runtime API methods...

---

## 🚀 Day 5: Testing & Documentation

### Task 5.1: Comprehensive testing

Create test script:

```javascript
// Test all Runtime API methods
console.group('Runtime API Tests');

// Instance management
console.log('getInstance:', window.cblcars.msd.getInstance());
console.log('getCurrentInstance:', window.cblcars.msd.getCurrentInstance());
console.log('getAllInstances:', window.cblcars.msd.getAllInstances());

// State & config
console.log('getState:', window.cblcars.msd.getState());
console.log('getConfig:', window.cblcars.msd.getConfig());
console.log('validate:', window.cblcars.msd.validate());

// Overlays
console.log('overlays.list:', window.cblcars.msd.overlays.list());
// Test highlight if MSD card is rendered
// window.cblcars.msd.overlays.highlight('some-overlay-id');

console.groupEnd();
```

### Task 5.2: Document API

**File:** `doc/api/runtime-api.md`

Create comprehensive documentation with examples.

---

## ✅ Success Criteria for Phase 0

- [ ] New API structure files created
- [ ] Runtime API fully implemented
- [ ] All methods documented
- [ ] Testing completed
- [ ] Zero breaking changes to existing MSD
- [ ] `window.cblcars.msd` namespace working

---

## 🔧 Troubleshooting

### Issue: API not attaching

**Check:**
1. Import added to `cb-lcars.js`
2. No console errors during load
3. `window.cblcars` exists

### Issue: getInstance() returns null

**Check:**
1. MSD card is actually rendered on dashboard
2. `MsdInstanceManager.getCurrentInstance()` returns instance
3. Check `window.cblcars.debug.msd.pipelineInstance`

### Issue: Methods not working

**Check:**
1. `MsdRuntimeAPI.create()` is being called
2. No errors in console
3. Instance is available

---

## 📚 Resources

- Implementation plan: `doc/proposals/API_STANDARDIZATION_IMPLEMENTATION_PLAN.md`
- Changes from original: `doc/proposals/API_STANDARDIZATION_CHANGES_FROM_ORIGINAL.md`
- Current MsdApi: `src/msd/api/MsdApi.js`
- Current DebugInterface: `src/msd/debug/DebugInterface.js`

---

## 🎯 Next Phase

When Phase 0 is complete:
- Move to Phase 1: Debug API Core
- Implement performance, routing, data introspection
- See implementation plan for details

---

*Last updated: 2025-10-28*
