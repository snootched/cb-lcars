# API Standardization - Revised Implementation Plan

## 🎯 Strategic Approach

### Key Decisions
1. ✅ **No backward compatibility needed** - unreleased system
2. ✅ **Multi-instance API design** - implemented as single-instance initially
3. ✅ **Clean slate implementation** - design API first, implement properly, delete old
4. ✅ **Event system deferred** - add when use case emerges

---

## 📐 API Namespace Structure

```javascript
window.cblcars = {
  // ============================================
  // RUNTIME API: User-facing stable APIs
  // ============================================
  msd: {
    // Instance Management (Phase X: multi-instance)
    getInstance(cardId),
    getCurrentInstance(),
    getAllInstances(),

    // State & Configuration
    getState(cardId),
    getConfig(cardId),
    validate(cardId),

    // Theme Management
    theme: {
      apply(cardId, themeName),
      getCurrent(cardId),
      list()
    },

    // Overlays (User Operations)
    overlays: {
      list(cardId),
      show(cardId, overlayId),
      hide(cardId, overlayId),
      highlight(cardId, overlayId, duration)
    },

    // Actions & Animations
    trigger(cardId, actionId, params),
    animate(cardId, animationId)
  },

  // ============================================
  // DEBUG API: Developer introspection
  // ============================================
  debug: {
    msd: {
      // Current instance shorthand
      get current(),  // Returns debug proxy for current instance

      // Visual Debug Toggles
      enable(feature, cardId),
      disable(feature, cardId),
      toggle(feature, cardId),
      status(cardId),

      // Performance Analysis
      perf: {
        summary(cardId),
        slowestOverlays(cardId, n),
        byRenderer(cardId),
        byOverlay(cardId, overlayId),
        warnings(cardId),
        timeline(cardId),
        compare(cardId)
      },

      // Style Introspection
      styles: {
        resolutions(cardId, overlayId),
        findByToken(cardId, tokenPath),
        provenance(cardId, overlayId),
        listTokens(cardId),
        getTokenValue(cardId, tokenPath)
      },

      // Data Source Introspection
      data: {
        stats(cardId),
        list(cardId),
        get(cardId, sourceName),
        dump(cardId),
        trace(cardId, entityId),
        history(cardId, entityId, n)
      },

      // Routing System
      routing: {
        inspect(cardId, overlayId),
        stats(cardId),
        invalidate(cardId, id),
        inspectAs(cardId, overlayId, mode),
        visualize(cardId, overlayId)
      },

      // Rules Engine
      rules: {
        trace(cardId),
        evaluate(cardId, ruleId),
        listActive(cardId),
        debugRule(cardId, ruleId, state)
      },

      // Chart Validation
      charts: {
        validate(cardId, overlayId),
        validateAll(cardId),
        getFormatSpec(chartType),
        listTypes()
      },

      // Animations
      animations: {
        active(cardId),
        dump(cardId),
        timeline(cardId, timelineId),
        trigger(cardId, animId)
      },

      // Packs (Config Composition)
      packs: {
        list(cardId, type),
        get(cardId, type, id),
        issues(cardId),
        order(cardId)
      },

      // Overlay Introspection
      overlays: {
        list(cardId, filters),
        getBBox(cardId, overlayId),
        getAttachments(cardId, overlayId),
        getRenderer(cardId, overlayId),
        dumpConfig(cardId, overlayId)
      },

      // Pipeline Introspection
      pipeline: {
        getModel(cardId),
        getStage(cardId, stage),
        reRun(cardId, fromStage),
        validate(cardId)
      }
    },

    // CLI Features
    history: CLIHistory,
    complete: CLIAutocomplete,
    cli: InteractiveCLI
  },

  // ============================================
  // ANIMATION API: 3rd party + helpers
  // ============================================
  anim: {
    // Library Wrappers
    animejs: anime,
    anime: anime.animate,
    d3: d3,  // Future

    // Helper Utilities
    utils: anime.utils,
    animateElement: animHelpers.animateElement,
    animateWithRoot: animHelpers.animateWithRoot,
    waitForElement: animHelpers.waitForElement,

    // SVG & Anchor Helpers
    svg: svgHelpers,
    anchors: anchorHelpers,
    findSvgAnchors: anchorHelpers.findSvgAnchors,
    getSvgContent: anchorHelpers.getSvgContent,
    getSvgViewBox: anchorHelpers.getSvgViewBox,
    getSvgAspectRatio: anchorHelpers.getSvgAspectRatio,

    // LCARS Animation Presets
    presets: {
      buttonPress: (target, opts) => {},
      buttonRelease: (target, opts) => {},
      blinkIndicator: (target, opts) => {},
      slideIn: (target, opts) => {},
      countUp: (target, from, to, opts) => {},
      // ... more
    },

    // Scope Management
    scopes: new Map(),
    createScope: (root) => {},
    getScope: (root) => {},

    // MSD Integration (Future)
    msd: {
      animateOverlay: (cardId, overlayId, animId) => {},
      playTimeline: (cardId, timelineId) => {}
    }
  },

  // ============================================
  // DEV API: Internal development tools
  // ============================================
  dev: {
    // Feature flags
    flags: {
      list: () => {},
      get: (name) => {},
      set: (name, value) => {},
      reset: () => {}
    },

    // Internal state inspection
    inspect: {
      systemsManager: () => {},
      modelBuilder: () => {},
      debugManager: () => {}
    },

    // Test utilities
    test: {
      mockHass: (entities) => {},
      mockEntity: (id, state, attrs) => {},
      simulateUpdate: (entityId, newState) => {}
    }
  }
};
```

---

## 🚀 Implementation Phases

### **Phase 0: Foundation (Week 1)**

**Goal:** Create new API structure, implement Runtime API core

#### Day 1-2: Core Structure Files

Create new API orchestrator files:

```
src/api/
  ├── CBLCARSUnifiedAPI.js       # Main entry point & namespace setup
  ├── MsdRuntimeAPI.js            # Runtime tier implementation
  ├── MsdDebugAPI.js              # Debug tier implementation
  ├── MsdDevAPI.js                # Dev tier implementation
  ├── AnimationAPI.js             # Refactored from cb-lcars.js
  └── cli/
      ├── CLIHistory.js           # Command history tracking
      ├── CLIAutocomplete.js      # Autocomplete engine
      └── InteractiveCLI.js       # Interactive wrapper
```

**Key file: CBLCARSUnifiedAPI.js**
```javascript
/**
 * CB-LCARS Unified API
 *
 * Single entry point that orchestrates all API tiers:
 * - Runtime API (window.cblcars.msd)
 * - Debug API (window.cblcars.debug.msd)
 * - Dev API (window.cblcars.dev)
 * - Animation API (window.cblcars.anim)
 */

import { MsdRuntimeAPI } from './MsdRuntimeAPI.js';
import { MsdDebugAPI } from './MsdDebugAPI.js';
import { MsdDevAPI } from './MsdDevAPI.js';
import { AnimationAPI } from './AnimationAPI.js';
import { CLIHistory } from './cli/CLIHistory.js';
import { CLIAutocomplete } from './cli/CLIAutocomplete.js';
import { InteractiveCLI } from './cli/InteractiveCLI.js';

export class CBLCARSUnifiedAPI {
  static attach() {
    if (typeof window === 'undefined') return;

    // Ensure namespace exists
    window.cblcars = window.cblcars || {};

    // Attach Runtime API
    window.cblcars.msd = MsdRuntimeAPI.create();

    // Attach Debug API
    window.cblcars.debug = window.cblcars.debug || {};
    window.cblcars.debug.msd = MsdDebugAPI.create();

    // Attach Dev API
    window.cblcars.dev = MsdDevAPI.create();

    // Attach Animation API (refactored from existing)
    window.cblcars.anim = AnimationAPI.create();

    // Setup CLI features
    window.cblcars.debug.history = new CLIHistory('cblcars.msd');
    window.cblcars.debug.complete = new CLIAutocomplete(window.cblcars.debug.msd);
    window.cblcars.debug.cli = new InteractiveCLI('MSD Debug', window.cblcars.debug.msd);

    console.log('[CB-LCARS] Unified API initialized');
  }

  static detach() {
    if (typeof window === 'undefined') return;

    // Clean up (for testing/reload scenarios)
    delete window.cblcars?.msd;
    delete window.cblcars?.debug?.msd;
    delete window.cblcars?.dev;
  }
}
```

#### Day 3-4: Runtime API Implementation

Implement user-facing methods in `MsdRuntimeAPI.js`:

**Focus on:**
- Instance management (single-instance for now)
- State access (read-only)
- Overlay operations (show/hide/highlight)
- Theme management
- Validation

**Connect to existing systems:**
- Use `MsdInstanceManager` for instance access
- Use `SystemsManager` for state access
- Use `DebugManager` for overlay highlighting

#### Day 5: Testing & Integration

- Test Runtime API with MSD system
- Verify single-instance behavior
- Document all methods
- Create usage examples

---

### **Phase 1: Debug API Core (Week 2)**

**Goal:** Migrate debug functionality from `DebugInterface.js` and `MsdApi.js`

#### Day 1-2: Performance & Routing

Implement:
- `debug.msd.perf.*` - migrate from `DebugInterface.js` (lines 662-997)
- `debug.msd.routing.*` - migrate from `DebugInterface.js` (lines 54-87)

#### Day 3-4: Data, Styles, Charts

Implement:
- `debug.msd.data.*` - migrate from `DebugInterface.js` dataSources section
- `debug.msd.styles.*` - migrate from `DebugInterface.js` (lines 1335-1480)
- `debug.msd.charts.*` - migrate from `DebugInterface.js` (lines 1010-1291)

#### Day 5: Rules, Animations, Packs

Implement:
- `debug.msd.rules.*` - migrate from `DebugInterface.js` (lines 652-656)
- `debug.msd.animations.*` - migrate from `DebugInterface.js` (lines 657-661)
- `debug.msd.packs.*` - migrate from `DebugInterface.js` (lines 1292-1307)

---

### **Phase 2: Debug API Polish & CLI (Week 3)**

**Goal:** Complete debug API, add CLI features, visual debug controls

#### Day 1-2: Visual Debug & Overlay Introspection

Implement:
- `debug.msd.enable/disable/toggle/status` - migrate from `DebugInterface.js` (lines 152-240)
- `debug.msd.overlays.*` - comprehensive overlay introspection
- `debug.msd.pipeline.*` - pipeline stage inspection

#### Day 3: CLI Features

Implement:
- `CLIHistory.js` - localStorage-based command history
- `CLIAutocomplete.js` - suggestion engine
- `InteractiveCLI.js` - help system and interactive wrapper

#### Day 4-5: Testing & Documentation

- Comprehensive debug API testing
- CLI feature testing
- Write API documentation
- Create interactive tutorials

---

### **Phase 3: Cleanup & Migration (Week 4)**

**Goal:** Remove old API exposure, finalize animation API, polish

#### Day 1-2: Old API Removal

**Delete/refactor:**
- `src/msd/api/MsdApi.js` - replace with new RuntimeAPI
- `src/msd/debug/DebugInterface.js` - replace with new DebugAPI
- Remove `window.cblcars.debug.msd` (replace with `window.cblcars.debug.msd`)
- Remove `window.cblcars.msd.api` (replace with `window.cblcars.msd`)

**Update callers:**
- Search for `window.cblcars.debug.msd` usage
- Search for `window.cblcars.msd.api` usage
- Update to new API paths

#### Day 3: Animation API Refinement

- Review `window.cblcars.anim` structure
- Add any missing helpers
- Organize presets library
- Document animation patterns

#### Day 4: Dev API

Implement:
- Feature flag management
- Internal state inspection
- Test utilities (if needed)

#### Day 5: Final Polish

- Complete API documentation
- Usage examples
- Performance validation
- Prepare for HUD integration

---

## 🎨 Error Handling Pattern

All API methods follow consistent error handling:

```javascript
// Success response
{
  success: true,
  data: { /* result */ }
}

// Error response
{
  success: false,
  error: {
    code: 'MSD_INSTANCE_NOT_FOUND',
    message: 'No MSD instance found with ID: xyz',
    details: { /* additional context */ }
  }
}

// Methods that return data directly (no wrapper) should:
// - Return null for "not found" cases
// - Return empty array/object for "no results" cases
// - Log errors to console but don't throw
```

---

## 📝 Documentation Structure

Create comprehensive docs:

```
doc/api/
  ├── README.md                    # API overview
  ├── runtime-api.md               # User-facing API docs
  ├── debug-api.md                 # Developer API docs
  ├── animation-api.md             # Animation system docs
  ├── cli-reference.md             # CLI usage guide
  └── examples/
      ├── basic-overlay-control.md
      ├── performance-debugging.md
      ├── style-introspection.md
      └── animation-patterns.md
```

---

## 🚫 Event System: Deferred

**Decision:** Do NOT implement event system in Phase 0.

**Rationale:**
- No clear use case yet
- Would add complexity without value
- Can be added later when needed

**When to revisit:**
- HUD needs to react to MSD changes
- Other custom cards need MSD integration
- User automations need MSD events

**Future event system design:**
```javascript
// Placeholder for future Phase X
window.cblcars.msd.on('overlay-clicked', (event) => {
  console.log('Overlay clicked:', event.overlayId);
});
```

---

## ✅ Success Criteria

### Phase 0 Complete When:
- [x] New API structure files created
- [x] Runtime API fully implemented
- [x] Single-instance access working
- [x] All Runtime API methods documented
- [x] Zero breaking changes to existing MSD functionality

### Phase 1 Complete When:
- [x] Debug API core implemented
- [x] All performance methods working
- [x] All introspection methods working
- [x] Debug API documented

### Phase 2 Complete When:
- [x] Visual debug controls working
- [x] CLI features implemented
- [x] Interactive help system working
- [x] All debug methods tested

### Phase 3 Complete When:
- [x] Old API files removed
- [x] All callers updated to new API
- [x] Animation API finalized
- [x] Complete documentation published
- [x] Zero regressions in MSD functionality

---

## 🎯 Critical Path

**Bottleneck:** Migrating `DebugInterface.js` (1484 lines)

**Risk Mitigation:**
1. ✅ Create new API structure first (clean slate)
2. ✅ Implement in small batches (perf, routing, data, etc.)
3. ✅ Test each batch before moving on
4. ✅ Keep old API working during migration (parallel run)
5. ✅ Only delete old code when 100% confident

---

## 🔄 Rollback Plan

If anything goes wrong:

1. **Revert to old API** - Old files stay in place until Phase 3
2. **Parallel systems** - New API doesn't affect existing debug interface
3. **Feature flag** - Could add `window.cblcars.config.useNewAPI` toggle

---

## 📊 Timeline Summary

| Week | Phase | Focus | Risk |
|------|-------|-------|------|
| 1 | Foundation | Runtime API, core structure | 🟢 Low |
| 2 | Debug Core | Migrate performance, routing, data | 🟡 Medium |
| 3 | Debug Polish | CLI features, visual debug | 🟡 Medium |
| 4 | Cleanup | Remove old API, finalize | 🟢 Low |

**Total:** 4 weeks to complete API standardization

---

## 🎉 Expected Benefits

After completion:

1. ✅ **Single source of truth** - One clear API structure
2. ✅ **Better DX** - Interactive CLI, autocomplete, help system
3. ✅ **Future-ready** - Multi-instance API design (single-instance impl)
4. ✅ **Clean codebase** - Remove 1700+ lines of legacy API code
5. ✅ **Better docs** - Comprehensive API documentation
6. ✅ **HUD ready** - Debug API ready for HUD integration

---

## 🚀 Next Steps

1. Review & approve this plan
2. Create API structure files (Day 1)
3. Implement Runtime API (Day 1-4)
4. Test & iterate (Day 5)
5. Continue to Phase 1...

---

*Last updated: 2025-10-28*
