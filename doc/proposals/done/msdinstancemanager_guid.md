# MSD Instance Manager GUID-Based Identity Implementation Plan

**Document Version:** 1.0
**Date:** 2025-10-14
**Author:** CB-LCARS Development Team
**Status:** Planning / Ready for Implementation

---

## Executive Summary

The MSD Instance Manager currently uses DOM element reference equality to determine if an instance request is for an existing card. This approach fails when the DOM is recreated (e.g., waking from suspend, page refresh, dashboard edit mode exit) because the mount element reference changes even though it's logically the same card.

This document outlines a GUID-based identity system that will:
- ✅ Survive DOM recreation events
- ✅ Distinguish between legitimate re-initialization and multiple instance conflicts
- ✅ Maintain the single-instance protection architecture
- ✅ Require minimal code changes (isolated to `MsdInstanceManager.js`)

---

## Problem Analysis

### Current Behavior

```javascript
// MsdInstanceManager.js - Current problematic logic
if (MsdInstanceManager._currentInstance) {
  const existingMount = MsdInstanceManager._currentMountElement;

  if (existingMount === mountEl) {  // ❌ Fails on DOM recreation
    return MsdInstanceManager._currentInstance;
  }

  // Block as "different" instance
  return { blocked: true, ... };
}
```

### Root Cause

**DOM Reference Equality (`===`)** breaks when:
- Browser wakes from suspend
- Tab backgrounded/foregrounded
- Dashboard exits edit mode
- Shadow DOM rebuilt
- Page refresh

The new `mountEl` is a different JavaScript object reference, even though it represents the same logical card.

### Why This Happens

```javascript
// BEFORE suspend/refresh:
mountEl1 = <div#msd-wrapper>  // Memory address: 0x1234

// AFTER waking/refresh:
mountEl2 = <div#msd-wrapper>  // Memory address: 0x5678

// mountEl1 === mountEl2  →  false ❌
```

---

## Solution: GUID-Based Identity

### Core Concept

Instead of tracking DOM elements, track **card instances** with stable GUIDs:

```javascript
// Card instance gets GUID on first boot
cardInstance._msdInstanceGuid = 'msd_abc123xyz789'

// Instance Manager tracks by GUID, not DOM reference
MsdInstanceManager._currentInstanceGuid = 'msd_abc123xyz789'
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Survives DOM Recreation** | GUID lives on card instance object, persists through DOM changes |
| **Logical Identity** | Same card = same GUID; different card = different GUID |
| **Minimal Changes** | Only `MsdInstanceManager.js` needs modification |
| **Backward Compatible** | Blocking logic still works for truly different cards |
| **Debugging Friendly** | GUIDs visible in logs for troubleshooting |

---

## Implementation Plan

### Phase 1: GUID Generation and Storage

#### 1.1 GUID Generator Utility

**Location:** `src/msd/pipeline/MsdInstanceManager.js`

```javascript
/**
 * Generate a unique GUID for MSD instance identification
 * Format: msd_[timestamp]_[random]
 * Example: msd_1697302742156_a3f9c2b1
 *
 * @returns {string} Unique GUID string
 * @private
 */
static _generateGuid() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `msd_${timestamp}_${random}`;
}
```

**Rationale:**
- Timestamp ensures uniqueness across time
- Random component prevents collisions within same millisecond
- `msd_` prefix makes it identifiable in logs
- Compact format (24-28 characters)

#### 1.2 Card Instance GUID Assignment

**Location:** `src/cb-lcars/cb-lcars-msd.yaml` - Custom field initialization

```javascript
// In custom_fields.msd_comprehensive section
// BEFORE calling MsdInstanceManager.requestInstance():

if (!this._msdInstanceGuid) {
  // Generate stable GUID for this card instance
  this._msdInstanceGuid = window.cblcars.debug.msd.MsdInstanceManager._generateGuid();

  cblcarsLog.debug('[MSD Card] Generated instance GUID:', {
    guid: this._msdInstanceGuid,
    cardId: this.id,
    timestamp: new Date().toISOString()
  });
}
```

**Rationale:**
- GUID stored directly on card instance (`this`)
- Persists through DOM recreation (card instance survives)
- Generated once per card, reused on all subsequent renders
- Available before pipeline initialization

#### 1.3 Instance Manager GUID Tracking

**Location:** `src/msd/pipeline/MsdInstanceManager.js`

```javascript
export class MsdInstanceManager {
  static _currentInstance = null;
  static _currentMountElement = null;
  static _currentInstanceGuid = null;  // ✅ NEW: Track by GUID
  static _isInitializing = false;
  static _initializationPromise = null;

  // ... rest of class
}
```

---

### Phase 2: Instance Request Logic Refactor

#### 2.1 Extract Card Instance from Mount Element

**Location:** `src/msd/pipeline/MsdInstanceManager.js` - New helper method

```javascript
/**
 * Extract card instance from mount element by traversing shadow DOM
 * The card instance has stable identity even when DOM recreates
 *
 * @param {HTMLElement|ShadowRoot} mountEl - Mount element or shadow root
 * @returns {Object|null} Card instance with _msdInstanceGuid or null
 * @private
 */
static _getCardInstanceFromMount(mountEl) {
  try {
    // Method 1: Check global references (most reliable)
    const globalCard = window.cb_lcars_card_instance ||
                      window._currentCardInstance ||
                      window.cblcars.debug.msd?.cardInstance;

    if (globalCard && globalCard._msdInstanceGuid) {
      cblcarsLog.debug('[MsdInstanceManager] Found card instance via globals:',
        globalCard._msdInstanceGuid);
      return globalCard;
    }

    // Method 2: Traverse up from mount through shadow boundaries
    let current = mountEl;
    for (let i = 0; i < 10 && current; i++) {
      // Check if current element IS the card
      if (current._msdInstanceGuid) {
        cblcarsLog.debug('[MsdInstanceManager] Found card instance via traversal:',
          current._msdInstanceGuid);
        return current;
      }

      // Move to parent or shadow host
      current = current.parentElement;

      // If we hit a shadow boundary, jump to host
      if (!current && mountEl.getRootNode && mountEl.getRootNode() !== document) {
        const shadowRoot = mountEl.getRootNode();
        if (shadowRoot.host) {
          current = shadowRoot.host;
          mountEl = current; // Update for next getRootNode check
        }
      }
    }

    cblcarsLog.warn('[MsdInstanceManager] Could not find card instance with GUID');
    return null;

  } catch (error) {
    cblcarsLog.error('[MsdInstanceManager] Error extracting card instance:', error);
    return null;
  }
}
```

**Rationale:**
- Robust traversal through shadow DOM boundaries
- Fallback to global references (set in YAML)
- Returns card instance object (stable identity)
- Handles edge cases gracefully

#### 2.2 GUID-Based Instance Matching

**Location:** `src/msd/pipeline/MsdInstanceManager.js` - `requestInstance()` method

```javascript
static async requestInstance(userMsdConfig, mountEl, hass, isPreview = false) {
  cblcarsLog.debug('[MsdInstanceManager] 🚀 requestInstance called:', {
    hasExistingInstance: !!MsdInstanceManager._currentInstance,
    currentGuid: MsdInstanceManager._currentInstanceGuid,
    isInitializing: MsdInstanceManager._isInitializing,
    isPreview,
    timestamp: new Date().toISOString()
  });

  // Handle preview mode specially (unchanged)
  if (isPreview) {
    return MsdInstanceManager._createPreviewContent(userMsdConfig, mountEl);
  }

  // ✅ NEW: Extract card instance and its GUID
  const requestingCard = MsdInstanceManager._getCardInstanceFromMount(mountEl);
  const requestingGuid = requestingCard?._msdInstanceGuid;

  cblcarsLog.debug('[MsdInstanceManager] Request identity:', {
    hasCardInstance: !!requestingCard,
    requestingGuid: requestingGuid,
    currentGuid: MsdInstanceManager._currentInstanceGuid
  });

  // Handle race condition (unchanged)
  if (MsdInstanceManager._isInitializing && MsdInstanceManager._initializationPromise) {
    try {
      const existingInstance = await MsdInstanceManager._initializationPromise;

      // ✅ CHANGED: Check GUID match instead of mount element
      if (existingInstance &&
          requestingGuid &&
          MsdInstanceManager._currentInstanceGuid === requestingGuid) {
        cblcarsLog.debug('[MsdInstanceManager] ✅ Returning completed initialization (GUID match)');
        return existingInstance;
      }
    } catch (error) {
      cblcarsLog.warn('[MsdInstanceManager] ⚠️ Previous initialization failed');
    }
  }

  // ✅ CHANGED: Check if instance exists with GUID comparison
  if (MsdInstanceManager._currentInstance && MsdInstanceManager._currentInstanceGuid) {

    // ✅ NEW: GUID-based matching (legitimate re-initialization)
    if (requestingGuid && requestingGuid === MsdInstanceManager._currentInstanceGuid) {
      cblcarsLog.debug('[MsdInstanceManager] ✅ GUID match - returning existing instance', {
        guid: requestingGuid,
        reason: 'same_card_reinitializing'
      });
      return MsdInstanceManager._currentInstance;
    }

    // ✅ NEW: Different GUID = truly different card (block it)
    if (requestingGuid && requestingGuid !== MsdInstanceManager._currentInstanceGuid) {
      cblcarsLog.warn('[MsdInstanceManager] 🚨 Different GUID - blocking new instance:', {
        existingGuid: MsdInstanceManager._currentInstanceGuid,
        requestingGuid: requestingGuid
      });

      return {
        enabled: false,
        blocked: true,
        reason: 'Different MSD card instance already active',
        existingGuid: MsdInstanceManager._currentInstanceGuid,
        requestingGuid: requestingGuid,
        html: MsdInstanceManager._createBlockedContentWithGuid(
          MsdInstanceManager._currentInstanceGuid,
          requestingGuid
        ),
        destroyExisting: () => MsdInstanceManager.destroyInstance(),
        getExistingInstance: () => MsdInstanceManager._currentInstance
      };
    }

    // ✅ FALLBACK: No GUID on requesting card (shouldn't happen but be defensive)
    if (!requestingGuid) {
      cblcarsLog.warn('[MsdInstanceManager] ⚠️ No GUID on requesting card - blocking as precaution');
      return {
        enabled: false,
        blocked: true,
        reason: 'Instance already active and no GUID on new request',
        html: MsdInstanceManager._createBlockedContent(
          MsdInstanceManager._currentMountElement,
          mountEl
        )
      };
    }
  }

  // ✅ CHANGED: Store GUID when creating new instance
  MsdInstanceManager._isInitializing = true;
  MsdInstanceManager._currentInstanceGuid = requestingGuid;
  MsdInstanceManager._initializationPromise =
    MsdInstanceManager._performInitialization(userMsdConfig, mountEl, hass, requestingGuid);

  try {
    const pipelineApi = await MsdInstanceManager._initializationPromise;
    return pipelineApi;
  } finally {
    MsdInstanceManager._isInitializing = false;
    MsdInstanceManager._initializationPromise = null;
  }
}
```

---

### Phase 3: Enhanced Error Messages

#### 3.1 GUID-Enhanced Blocked Content

**Location:** `src/msd/pipeline/MsdInstanceManager.js` - New method

```javascript
/**
 * Create blocked instance content with GUID information
 * Provides clearer debugging info for developers
 *
 * @param {string} existingGuid - GUID of active instance
 * @param {string} requestingGuid - GUID of blocked request
 * @returns {string} HTML content for blocked state
 * @private
 */
static _createBlockedContentWithGuid(existingGuid, requestingGuid) {
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
        Another MSD card instance is already active
      </div>

      <div style="
        font-size: 11px;
        opacity: 0.8;
        margin-bottom: 16px;
        font-family: monospace;
        background: rgba(0,0,0,0.3);
        padding: 8px;
        border-radius: 4px;
      ">
        <div style="margin-bottom: 4px;">
          <span style="color: var(--lcars-orange, #ff9900);">Active:</span>
          ${existingGuid}
        </div>
        <div>
          <span style="color: var(--lcars-cyan, #00ffff);">Blocked:</span>
          ${requestingGuid}
        </div>
      </div>

      <div style="
        font-size: 12px;
        color: var(--lcars-orange, #ff9900);
        background: rgba(255, 153, 0, 0.1);
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid var(--lcars-orange, #ff9900);
      ">
        💡 Only one MSD card allowed per window
      </div>

      <div style="font-size: 10px; margin-top: 12px; opacity: 0.6;">
        Refresh the page to reset instances
      </div>
    </div>
  `;
}
```

---

### Phase 4: Cleanup and Lifecycle

#### 4.1 Enhanced Destroy Method

**Location:** `src/msd/pipeline/MsdInstanceManager.js` - `destroyInstance()` method

```javascript
static async destroyInstance() {
  if (!MsdInstanceManager._currentInstance) {
    cblcarsLog.debug('[MsdInstanceManager] No active instance to destroy');
    return;
  }

  cblcarsLog.debug('[MsdInstanceManager] 🧹 Destroying MSD instance:', {
    guid: MsdInstanceManager._currentInstanceGuid,
    timestamp: new Date().toISOString()
  });

  try {
    // Existing cleanup (unchanged)
    const instance = MsdInstanceManager._currentInstance;

    if (instance.systemsManager?.destroy) {
      await instance.systemsManager.destroy();
    }

    if (instance.destroy && typeof instance.destroy === 'function') {
      await instance.destroy();
    }

    // Clear global references (unchanged)
    if (typeof window !== 'undefined') {
      delete window.cblcars.debug.msd?.pipelineInstance;
      delete window.cblcars.debug.msd?.systemsManager;
      delete window.cblcars.debug.msd?.routing;
      delete window.cblcars.debug.msd?.hud;
      delete window.cb_lcars_card_instance;
      delete window._currentCardInstance;
      delete window._msdCardInstance;
      delete window.__msdHudBus;
      delete window.__msdHudPanelControls;
      delete window.cblcars.debug.msd?.cardInstance;
      delete window.cblcars.debug.msd?.debugManager;
    }

    // ✅ CHANGED: Clear instance AND GUID
    MsdInstanceManager._currentInstance = null;
    MsdInstanceManager._currentMountElement = null;
    MsdInstanceManager._currentInstanceGuid = null; // ✅ NEW

    cblcarsLog.debug('[MsdInstanceManager] ✅ MSD instance destroyed and GUID cleared');

  } catch (error) {
    cblcarsLog.error('[MsdInstanceManager] ❌ Error during destruction:', error);
  }
}
```

#### 4.2 Force Replace with GUID

**Location:** `src/msd/pipeline/MsdInstanceManager.js` - `forceReplace()` method

```javascript
static async forceReplace(userMsdConfig, mountEl, hass) {
  const replacingCard = MsdInstanceManager._getCardInstanceFromMount(mountEl);
  const replacingGuid = replacingCard?._msdInstanceGuid;

  cblcarsLog.warn('[MsdInstanceManager] 🔄 Force replacing MSD instance:', {
    oldGuid: MsdInstanceManager._currentInstanceGuid,
    newGuid: replacingGuid
  });

  await MsdInstanceManager.destroyInstance();
  return MsdInstanceManager.requestInstance(userMsdConfig, mountEl, hass);
}
```

---

### Phase 5: Debug Utilities

#### 5.1 Enhanced Status Command

**Location:** `src/msd/pipeline/MsdInstanceManager.js` - Bottom of file (global helpers)

```javascript
if (typeof window !== 'undefined') {
  // ✅ ENHANCED: Show GUID in status
  window.__msdStatus = () => {
    const cardInstance = window.cb_lcars_card_instance || window._currentCardInstance;

    const status = {
      'Has Active Instance': MsdInstanceManager.hasActiveInstance(),
      'Current GUID': MsdInstanceManager._currentInstanceGuid || 'none',
      'Card Instance GUID': cardInstance?._msdInstanceGuid || 'none',
      'GUIDs Match': MsdInstanceManager._currentInstanceGuid === cardInstance?._msdInstanceGuid,
      'Current Mount': MsdInstanceManager._currentMountElement?.tagName || 'none',
      'Instance Enabled': MsdInstanceManager._currentInstance?.enabled || false,
      'Is Initializing': MsdInstanceManager._isInitializing,
      'Timestamp': new Date().toISOString()
    };

    console.table(status);
    return status;
  };

  // ✅ NEW: GUID inspection helper
  window.__msdInspectGuid = () => {
    const cardInstance = window.cb_lcars_card_instance || window._currentCardInstance;

    console.group('🔍 MSD GUID Inspection');
    console.log('Active Instance GUID:', MsdInstanceManager._currentInstanceGuid);
    console.log('Card Instance:', cardInstance);
    console.log('Card Instance GUID:', cardInstance?._msdInstanceGuid);
    console.log('Shadow Root:', cardInstance?.shadowRoot);
    console.log('Mount Element:', MsdInstanceManager._currentMountElement);
    console.groupEnd();
  };
}
```

---

## Testing Strategy

### Test Case 1: Normal Initialization

**Scenario:** First load of MSD card

**Expected:**
1. Card instance gets new GUID
2. Instance Manager stores GUID
3. Pipeline initializes successfully
4. GUID visible in logs

**Validation:**
```javascript
// In console:
window.__msdStatus()
// Should show matching GUIDs
```

---

### Test Case 2: Wake from Suspend

**Scenario:** Browser wakes from sleep, DOM recreated

**Expected:**
1. Custom field runs again
2. Card instance has EXISTING GUID (persisted)
3. Instance Manager recognizes GUID match
4. Returns existing pipeline (no re-initialization)
5. No "instance conflict" error

**Validation:**
```javascript
// Before suspend:
window.__msdStatus()
// Note the GUID

// After wake:
window.__msdStatus()
// GUID should be SAME
// "GUIDs Match" should be true
```

---

### Test Case 3: Dashboard Refresh

**Scenario:** Exit edit mode, DOM fully rebuilt

**Expected:**
1. Same behavior as Test Case 2
2. GUID survives rebuild
3. Existing pipeline reused
4. No unnecessary re-initialization

---

### Test Case 4: Multiple Cards (Conflict)

**Scenario:** Second MSD card added to dashboard

**Expected:**
1. Second card gets DIFFERENT GUID
2. Instance Manager detects GUID mismatch
3. Second card shows "blocked" message
4. Blocked message shows BOTH GUIDs
5. First card continues working

**Validation:**
```javascript
// Should see blocked message with:
// Active: msd_1234567890_abc123
// Blocked: msd_1234567899_xyz789
```

---

### Test Case 5: Force Replace

**Scenario:** Developer runs `window.__msdForceReplace()`

**Expected:**
1. Old instance destroyed (GUID cleared)
2. New instance created with existing card GUID
3. Pipeline re-initializes
4. Card continues functioning

---

## Migration Notes

### Breaking Changes

**None** - This is fully backward compatible:
- Existing MSD cards will work immediately
- GUIDs generated automatically on first render
- No config changes required
- No API changes

### Upgrade Path

1. Deploy updated `MsdInstanceManager.js`
2. No card configs need modification
3. Users will see improved behavior automatically
4. Wake-from-suspend issue fixed transparently

---

## Known Edge Cases

### Edge Case 1: No Card Instance Available

**Situation:** Mount element can't be traced back to card

**Handling:**
```javascript
if (!requestingGuid) {
  // Fall back to mount element comparison (old behavior)
  // Or block as precaution
}
```

**Risk:** Low - global references usually work

---

### Edge Case 2: GUID Collision

**Situation:** Two cards get same GUID (astronomically unlikely)

**Probability:** ~1 in 10^15 with timestamp + random

**Handling:** Accept risk (same as UUID v4 collision risk)

---

### Edge Case 3: Manual DOM Manipulation

**Situation:** Developer manually destroys/recreates card

**Handling:** GUID persists on card instance object, survives manipulation

---

## Future Enhancements

### Phase 6: Multi-Instance Support (Future)

If we ever want to support multiple MSD cards:

```javascript
// Instead of single instance:
static _instances = new Map(); // guid -> instance

// Track multiple:
MsdInstanceManager._instances.set(guid, instance);
```

**But:** Requires massive refactoring of:
- Global window references
- HUD Manager singleton
- Shared resource managers
- Event bus systems

**Decision:** Not worth it for current use case

---

### Phase 7: GUID Persistence (Future)

Store GUID in localStorage for even more stability:

```javascript
const storageKey = `msd_guid_${cardConfigHash}`;
const persistedGuid = localStorage.getItem(storageKey);
```

**Benefits:**
- Survives full page reload
- Survives browser restart

**Risks:**
- localStorage limitations
- Config hash computation complexity

---

## Implementation Checklist

- [ ] Add `_generateGuid()` static method
- [ ] Add `_getCardInstanceFromMount()` static method
- [ ] Add `_currentInstanceGuid` to class properties
- [ ] Modify YAML to assign GUID on card boot
- [ ] Update `requestInstance()` GUID comparison logic
- [ ] Update `_performInitialization()` to accept GUID
- [ ] Add `_createBlockedContentWithGuid()` method
- [ ] Update `destroyInstance()` to clear GUID
- [ ] Update `forceReplace()` to handle GUID
- [ ] Enhance `window.__msdStatus()` with GUID info
- [ ] Add `window.__msdInspectGuid()` helper
- [ ] Test Case 1: Normal initialization
- [ ] Test Case 2: Wake from suspend
- [ ] Test Case 3: Dashboard refresh
- [ ] Test Case 4: Multiple cards conflict
- [ ] Test Case 5: Force replace
- [ ] Update inline documentation
- [ ] Add console log messages for GUID operations

---

## Documentation Updates

### Files to Update

1. **MsdInstanceManager.js** - JSDoc for all new methods
2. **Debug Commands Reference** - Document `__msdInspectGuid()`
3. **Troubleshooting Guide** - Add "Wake from suspend" section
4. **Architecture Docs** - Explain GUID lifecycle

---

## Conclusion

This GUID-based approach solves the wake-from-suspend issue with:

✅ **Minimal code changes** (isolated to `MsdInstanceManager.js`)
✅ **Zero config changes** (automatic GUID generation)
✅ **Full backward compatibility** (works with existing cards)
✅ **Better debugging** (GUIDs visible in logs and error messages)
✅ **Future-proof** (foundation for multi-instance support if needed)

The implementation is straightforward and low-risk, providing immediate value without requiring refactoring of the broader MSD system.