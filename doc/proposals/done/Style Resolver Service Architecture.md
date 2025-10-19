# Style Resolver Service Architecture

## Overview

The **Style Resolver Service** is a centralized system for resolving style properties across all MSD components. It consolidates style resolution logic, provides intelligent caching, supports runtime theme updates, and enables powerful style composition features.

## Goals

1. **Centralization** - Single source of truth for style resolution
2. **Performance** - Intelligent caching and memoization
3. **Consistency** - Uniform style resolution across all renderers
4. **Extensibility** - Easy to add new style features and resolution strategies
5. **Theme Integration** - Deep integration with theme system and token resolution
6. **Runtime Updates** - Support dynamic theme switching without full re-render
7. **Debugging** - Comprehensive provenance tracking for style resolution

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Style Resolver Service                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Resolution │  │    Cache     │  │  Provenance  │      │
│  │    Engine    │  │   Manager    │  │   Tracker    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Token     │  │   Preset     │  │   Validator  │      │
│  │   Resolver   │  │   Manager    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│Theme Manager │    │   Renderers  │    │ Debug Tools  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Core Components

#### 1. Resolution Engine
The main orchestrator that coordinates style resolution.

**Responsibilities:**
- Coordinate resolution pipeline
- Apply resolution strategies
- Handle fallback chains
- Manage context propagation

**Resolution Priority Chain:**
```
1. Explicit Value (from overlay config)
2. Token Reference (e.g., 'colors.primary')
3. Theme Default (from active theme)
4. Component Default (from component schema)
5. System Fallback (hardcoded fallback)
```

#### 2. Cache Manager
Manages intelligent caching of resolved styles.

**Responsibilities:**
- Cache resolved values
- Invalidate on theme changes
- Provide cache statistics
- Support partial cache invalidation

**Caching Strategy:**
```javascript
{
  // Per-overlay cache
  overlays: {
    'overlay-id': {
      resolvedStyles: { /* cached styles */ },
      timestamp: 1234567890,
      themeVersion: 'v2.1.0'
    }
  },

  // Token resolution cache
  tokens: {
    'colors.primary': '#FF9900',
    'spacing.medium': 16
  },

  // Preset cache
  presets: {
    'lozenge': { /* preset styles */ }
  }
}
```

#### 3. Provenance Tracker
Tracks style resolution for debugging (integrates with Phase 5.2B).

**Responsibilities:**
- Record resolution path for each property
- Track token usage
- Identify fallback usage
- Generate resolution reports

#### 4. Token Resolver
Resolves token references to actual values.

**Responsibilities:**
- Parse token paths (e.g., 'colors.ui.primary')
- Resolve from theme
- Support nested tokens
- Cache token resolutions

**Token Resolution:**
```javascript
// Simple token
'colors.primary' → theme.colors.primary → '#FF9900'

// Nested token
'colors.ui.primary' → theme.colors.ui.primary → '#FF9900'

// Token reference in token
'colors.accent' → theme.colors.accent → 'colors.primary' → '#FF9900'

// Context-aware token (with viewBox)
'spacing.medium' → theme.spacing.medium(viewBox) → 16
```

#### 5. Preset Manager
Applies style presets to overlays.

**Responsibilities:**
- Load presets from configuration
- Apply preset styles
- Support preset inheritance
- Merge preset with explicit styles

**Preset Application:**
```javascript
// Overlay config
{
  type: 'text',
  style: {
    lcars_text_preset: 'lozenge',
    color: '#00FF00'  // Override preset color
  }
}

// Resolution
1. Load 'lozenge' preset
2. Apply preset styles
3. Override with explicit 'color'
4. Resolve remaining properties
```

#### 6. Validator
Validates resolved styles against schemas.

**Responsibilities:**
- Validate style values
- Type checking
- Range validation
- Provide helpful error messages

## API Design

### Core Service API

```javascript
class StyleResolverService {
  constructor(themeManager, config = {}) {
    this.themeManager = themeManager;
    this.config = config;
    this.cache = new CacheManager();
    this.tokenResolver = new TokenResolver(themeManager);
    this.presetManager = new PresetManager(config.presets);
    this.validator = new StyleValidator();
    this.provenanceTracker = new ProvenanceTracker();
  }

  /**
   * Resolve a single style property
   *
   * @param {Object} options - Resolution options
   * @param {string} options.property - Property name (e.g., 'color')
   * @param {*} options.value - Explicit value from config
   * @param {string} options.tokenPath - Token path to resolve
   * @param {*} options.defaultValue - Final fallback value
   * @param {Object} options.context - Resolution context (viewBox, etc.)
   * @param {string} options.componentType - Component type for defaults
   * @returns {Object} Resolution result { value, source, provenance }
   */
  resolveProperty(options) { }

  /**
   * Resolve all styles for an overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Resolution context
   * @returns {Object} { resolvedStyles, provenance }
   */
  resolveOverlayStyles(overlay, context = {}) { }

  /**
   * Resolve styles with preset application
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Resolution context
   * @returns {Object} { resolvedStyles, provenance }
   */
  resolveWithPreset(overlay, context = {}) { }

  /**
   * Invalidate cache (on theme change)
   *
   * @param {string} scope - 'all', 'overlay', 'token', 'preset'
   * @param {string} id - Specific ID to invalidate
   */
  invalidateCache(scope = 'all', id = null) { }

  /**
   * Get resolution provenance for debugging
   *
   * @param {string} overlayId - Overlay ID
   * @returns {Object} Provenance data
   */
  getProvenance(overlayId) { }

  /**
   * Subscribe to theme changes
   *
   * @param {Function} callback - Called when theme changes
   * @returns {Function} Unsubscribe function
   */
  onThemeChange(callback) { }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats
   */
  getCacheStats() { }
}
```

### Resolution Context

```javascript
{
  // Required
  overlayId: 'my-overlay',
  overlayType: 'text',
  componentType: 'text',

  // Optional
  viewBox: [0, 0, 400, 200],
  containerElement: <element>,
  theme: 'lcars-modern',

  // Advanced
  parentStyles: { /* inherited styles */ },
  renderPhase: 'initial' | 'update',
  cacheEnabled: true
}
```

### Resolution Result

```javascript
{
  // Resolved value
  value: '#FF9900',

  // Source of value
  source: 'token' | 'explicit' | 'theme' | 'preset' | 'default' | 'fallback',

  // Provenance (Phase 5.2B integration)
  provenance: {
    property: 'color',
    explicitValue: undefined,
    tokenPath: 'colors.primary',
    tokenValue: '#FF9900',
    themeDefault: '#FF9900',
    componentDefault: '#FFFFFF',
    fallbackValue: '#999999',
    resolvedFrom: 'token',
    timestamp: 1234567890
  },

  // Validation
  valid: true,
  warnings: []
}
```

## Integration with Existing Systems

### Integration Touchpoints

The Style Resolver Service integrates with the following components:

#### 1. PipelineCore - Service Initialization
**Location:** `src/msd/pipeline/PipelineCore.js`

**Changes:**
- Instantiate StyleResolverService during pipeline initialization
- Pass ThemeManager reference
- Expose on `window.cblcars.styleResolver`

**Impact:** One-time setup, minimal changes, backward compatible

#### 2. SystemsManager - Service Registration
**Location:** `src/msd/systems/SystemsManager.js`

**Changes:**
- Add StyleResolverService to managed systems
- Provide access to other systems
- Include in cleanup/lifecycle management

**Impact:** Standard system registration pattern

#### 3. BaseRenderer - Core Integration
**Location:** `src/msd/renderer/BaseRenderer.js`

**Changes:**
- Update `_resolveStyleProperty()` to use StyleResolverService internally
- Existing API stays the same (no changes needed in subclasses)
- Add service reference in constructor

**Impact:** Drop-in replacement, fully backward compatible

**Example Integration:**
```javascript
export class BaseRenderer {
  constructor() {
    super();
    this.rendererName = 'BaseRenderer';
    this.themeManager = this._resolveThemeManager();

    // ✅ NEW: Get StyleResolverService instance
    this.styleResolver = window.cblcars?.styleResolver ||
                         new StyleResolverService(this.themeManager);
  }

  _resolveStyleProperty(styleValue, tokenPath, fallback, context) {
    // ✅ UPDATED: Use StyleResolverService internally
    const result = this.styleResolver.resolveProperty({
      property: tokenPath.split('.').pop(),
      value: styleValue,
      tokenPath: tokenPath,
      defaultValue: fallback,
      context: {
        ...context,
        componentType: this.rendererName.replace('Renderer', '').toLowerCase()
      }
    });

    // Track for provenance (Phase 5.2B)
    this._trackStyleResolution(tokenPath, {
      source: result.source,
      value: result.value,
      provenance: result.provenance
    });

    return result.value;
  }
}
```

#### 4. Non-BaseRenderer Renderers - Special Handling
**Location:** `src/msd/renderer/TextOverlayRenderer.js`, `src/msd/renderer/ApexChartsOverlayRenderer.js`

**Changes:**
These renderers don't extend BaseRenderer, so they need direct integration:

**For TextOverlayRenderer:**
- Add StyleResolverService reference
- Update style resolution methods to use service
- Maintain existing static method pattern

**For ApexChartsOverlayRenderer:**
- Update `_resolveChartStyleProperty()` to use service
- Integrate with singleton pattern
- Maintain existing architecture

**Impact:** Targeted updates to specific methods, backward compatible

**Example for TextOverlayRenderer:**
```javascript
export class TextOverlayRenderer {
  constructor() {
    // ✅ NEW: Get StyleResolverService
    this.styleResolver = window.cblcars?.styleResolver;
  }

  _resolveTextStyleProperty(property, explicitValue, tokenPath, defaultValue, context) {
    if (!this.styleResolver) {
      // Fallback to manual resolution if service not available
      return this._manualResolve(explicitValue, tokenPath, defaultValue);
    }

    // ✅ USE: StyleResolverService
    const result = this.styleResolver.resolveProperty({
      property,
      value: explicitValue,
      tokenPath,
      defaultValue,
      context: { ...context, componentType: 'text' }
    });

    return result.value;
  }
}
```

**Example for ApexChartsOverlayRenderer:**
```javascript
export class ApexChartsOverlayRenderer {
  _resolveChartStyleProperty(property, explicitValue, themeDefault, adapterDefault) {
    const styleResolver = window.cblcars?.styleResolver;

    if (!styleResolver) {
      // Fallback to existing manual resolution
      return this._manualChartStyleResolution(explicitValue, themeDefault, adapterDefault);
    }

    // ✅ USE: StyleResolverService
    const result = styleResolver.resolveProperty({
      property,
      value: explicitValue,
      tokenPath: `chart.${property}`,
      defaultValue: adapterDefault,
      context: {
        overlayId: this._currentOverlayId,
        componentType: 'apexchart'
      }
    });

    // Track for provenance
    this._trackStyleResolution(property, {
      source: result.source,
      value: result.value,
      explicitValue,
      themeDefault,
      adapterDefault
    });

    return result.value;
  }
}
```

#### 5. ThemeManager - Change Notifications
**Location:** Theme system

**Changes:**
- Add theme change notification system
- Call StyleResolver cache invalidation on theme switch
- Register callback for theme updates

**Impact:** Small addition to theme switching logic

**Example Integration:**
```javascript
export class ThemeManager {
  constructor() {
    // ... existing code ...

    // ✅ NEW: Notify StyleResolver of theme changes
    this.styleResolverCallbacks = new Set();
  }

  setActiveTheme(themeName) {
    // ... existing theme switching logic ...

    // ✅ NEW: Notify StyleResolver
    this.styleResolverCallbacks.forEach(callback => {
      callback(themeName, this.getActiveTheme());
    });
  }

  subscribeToThemeChanges(callback) {
    this.styleResolverCallbacks.add(callback);
    return () => this.styleResolverCallbacks.delete(callback);
  }
}
```

#### 6. RulesEngine - Automatic Integration
**Location:** Rules engine overlay patching

**Changes:**
- **No code changes required**
- Rules continue to apply style patches normally
- StyleResolver automatically resolves patched styles
- Better performance due to caching

**Impact:** Automatic benefit, zero code changes

**How It Works:**
```yaml
# RulesEngine config (unchanged)
rules:
  - when:
      condition: template
      value_template: "{{ states('sensor.temperature') | float > 75 }}"
    patches:
      - target: { overlay_id: temp-display }
        apply:
          style:
            color: colors.alert  # ← StyleResolver handles token resolution
```

**What Happens:**
1. RulesEngine applies patch with `color: 'colors.alert'`
2. Renderer receives updated overlay config
3. Renderer calls `_resolveStyleProperty()` (now using StyleResolver)
4. StyleResolver resolves token `colors.alert` → actual color value
5. StyleResolver caches result for performance
6. Provenance tracks that this came from a rule-applied token

**Separation of Concerns:**
- **RulesEngine:** *WHEN to change styles* (conditional logic)
- **StyleResolver:** *HOW to resolve style values* (token resolution, caching)

#### 7. DebugInterface - New Commands
**Location:** `src/msd/debug/DebugInterface.js`

**Changes:**
- Add commands for cache inspection
- Add commands for resolution debugging
- Integrate with Phase 5.2B provenance

**Impact:** New debug functionality, additive only

#### 8. Configuration - Optional Presets
**Location:** MSD configuration

**Changes:**
- Load presets if configured (opt-in)
- Pass to StyleResolverService
- Define preset structure

**Impact:** Only if using presets feature

### Integration Visual Map

```
┌─────────────────────────────────────────────────────┐
│                  PipelineCore                        │ ← 1. Initialize Service
│  - Creates StyleResolverService                      │
│  - Passes to SystemsManager                          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                SystemsManager                        │ ← 2. Register Service
│  - styleResolver: StyleResolverService               │
│  - Lifecycle management                              │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┬──────────────┬───────────────┐
        ▼                               ▼              ▼               ▼
┌─────────────────┐          ┌──────────────┐  ┌─────────────┐ ┌──────────────┐
│  BaseRenderer   │          │ ThemeManager │  │ RulesEngine │ │ Non-Base     │
│  ← 3. Use       │          │ ← 5. Notify  │  │ ← 6. Auto   │ │ Renderers    │
│     Service     │          │    on change │  │    Benefit  │ │ ← 4. Direct  │
└─────────────────┘          └──────────────┘  └─────────────┘ └──────────────┘
        │                                                               │
        ▼                                                               ▼
┌─────────────────────────────────────────────────────┐    ┌─────────────────┐
│   BaseRenderer Subclasses (Most Renderers)          │    │ TextOverlay     │
│   - LineOverlayRenderer                              │    │ ApexCharts      │
│   - ButtonRenderer                                   │    │ (Special cases) │
│   - StatusGridRenderer                               │    └─────────────────┘
│   ← NO CHANGES NEEDED                                │
└─────────────────────────────────────────────────────┘
```

### Integration Impact Summary

| Component | Changes Required | Risk Level | Backward Compat |
|-----------|-----------------|------------|-----------------|
| PipelineCore | Initialize service | Low | ✅ Yes |
| SystemsManager | Register service | Low | ✅ Yes |
| BaseRenderer | Update one method | Medium | ✅ Yes |
| Non-Base Renderers | Update style resolution | Medium | ✅ Yes |
| ThemeManager | Add notifications | Low | ✅ Yes |
| BaseRenderer Subclasses | None | None | ✅ Yes |
| RulesEngine | None | None | ✅ Yes |
| DebugInterface | Add commands | Low | ✅ Yes (additive) |
| Config | Optional presets | Low | ✅ Yes (opt-in) |

## Implementation Strategy

### Phase 1: Foundation (Week 1)
**Goal:** Core service with basic resolution and caching

- [ ] Create StyleResolverService class structure
- [ ] Implement Resolution Engine
- [ ] Implement basic Token Resolver
- [ ] Add simple Cache Manager
- [ ] Create Provenance Tracker
- [ ] Unit tests for core functionality
- [ ] Initialize in PipelineCore
- [ ] Register in SystemsManager

**Deliverable:** Working service that can resolve basic properties

### Phase 2: BaseRenderer Integration (Week 1-2)
**Goal:** Integrate with BaseRenderer and subclasses

- [ ] Update BaseRenderer._resolveStyleProperty()
- [ ] Ensure backward compatibility
- [ ] Test with all BaseRenderer subclasses
- [ ] Verify provenance tracking works
- [ ] Integration tests

**Deliverable:** All BaseRenderer subclasses automatically use service

### Phase 3: Non-Base Renderer Integration (Week 2)
**Goal:** Update TextOverlayRenderer and ApexChartsOverlayRenderer

- [ ] Update TextOverlayRenderer style resolution
- [ ] Update ApexChartsOverlayRenderer style resolution
- [ ] Maintain existing APIs
- [ ] Add fallback for when service unavailable
- [ ] Integration tests

**Deliverable:** All renderers use StyleResolverService

### Phase 4: Theme Integration (Week 2-3)
**Goal:** Full theme system integration with change notifications

- [ ] Add ThemeManager notification system
- [ ] Implement cache invalidation on theme change
- [ ] Support runtime theme switching
- [ ] Test theme change scenarios
- [ ] Performance benchmarks

**Deliverable:** Dynamic theme switching without full re-render

### Phase 5: Preset System (Week 3)
**Goal:** Implement preset loading and application

- [ ] Implement PresetManager
- [ ] Preset loading from config
- [ ] Preset inheritance
- [ ] Merge strategies
- [ ] Preset validation
- [ ] Integration tests

**Deliverable:** Working preset system (opt-in)

### Phase 6: Advanced Features (Week 3-4)
**Goal:** Validation, advanced caching, optimization

- [ ] Implement StyleValidator
- [ ] Smart cache invalidation strategies
- [ ] Performance optimization
- [ ] LRU cache eviction
- [ ] Batch resolution support
- [ ] Performance tests

**Deliverable:** Production-ready service with optimization

### Phase 7: Debug Tools & Documentation (Week 4)
**Goal:** Complete debugging tools and documentation

- [ ] Add DebugInterface commands
- [ ] Cache inspection tools
- [ ] Resolution debugging tools
- [ ] Complete API documentation
- [ ] Usage examples
- [ ] Migration guide
- [ ] Performance guidelines

**Deliverable:** Fully documented service with debug tools

## Usage Examples

### Basic Property Resolution

```javascript
const styleResolver = new StyleResolverService(themeManager);

// Resolve a single property
const colorResult = styleResolver.resolveProperty({
  property: 'color',
  value: overlay.style?.color,
  tokenPath: 'colors.primary',
  defaultValue: '#FF9900',
  context: {
    overlayId: 'my-text',
    overlayType: 'text',
    viewBox: [0, 0, 400, 200]
  }
});

console.log(colorResult.value);        // '#FF9900'
console.log(colorResult.source);       // 'token'
console.log(colorResult.provenance);   // { ... }
```

### Overlay Style Resolution

```javascript
// Resolve all styles for an overlay
const result = styleResolver.resolveOverlayStyles(overlay, {
  overlayId: overlay.id,
  overlayType: overlay.type,
  viewBox: [0, 0, 400, 200]
});

console.log(result.resolvedStyles);
// {
//   color: '#FF9900',
//   fontSize: 18,
//   fontFamily: 'Antonio',
//   ...
// }

console.log(result.provenance);
// {
//   color: { source: 'token', ... },
//   fontSize: { source: 'explicit', ... }
// }
```

### Preset Application

```javascript
// Overlay with preset
const overlay = {
  id: 'my-button',
  type: 'button',
  style: {
    lcars_button_preset: 'lozenge',
    color: '#00FF00'  // Override preset
  }
};

const result = styleResolver.resolveWithPreset(overlay, context);

// Result includes:
// - Base preset styles
// - Explicit overrides applied
// - Remaining properties resolved via token/theme/default chain
```

### Runtime Theme Change

```javascript
// Subscribe to theme changes
const unsubscribe = styleResolver.onThemeChange((newTheme) => {
  console.log('Theme changed to:', newTheme);

  // Cache automatically invalidated
  // Re-resolve styles for visible overlays
  visibleOverlays.forEach(overlay => {
    const newStyles = styleResolver.resolveOverlayStyles(overlay, context);
    applyStyles(overlay.id, newStyles.resolvedStyles);
  });
});

// Later: unsubscribe()
```

### Cache Management

```javascript
// Invalidate all cache
styleResolver.invalidateCache('all');

// Invalidate specific overlay
styleResolver.invalidateCache('overlay', 'my-text');

// Invalidate token cache
styleResolver.invalidateCache('token', 'colors.primary');

// Get cache stats
const stats = styleResolver.getCacheStats();
console.log(stats);
// {
//   overlays: { count: 12, hits: 156, misses: 23 },
//   tokens: { count: 45, hits: 890, misses: 12 },
//   presets: { count: 5, hits: 67, misses: 2 }
// }
```

### Debugging

```javascript
// Get resolution provenance
const provenance = styleResolver.getProvenance('my-overlay');

console.log(provenance);
// {
//   overlayId: 'my-overlay',
//   properties: {
//     color: {
//       value: '#FF9900',
//       source: 'token',
//       tokenPath: 'colors.primary',
//       ...
//     }
//   }
// }

// Find properties using a specific token
const overlaysUsingToken = styleResolver.findPropertiesUsingToken('colors.primary');
// [
//   { overlayId: 'text-1', property: 'color' },
//   { overlayId: 'button-2', property: 'borderColor' }
// ]
```

## Performance Considerations

### Caching Strategy

1. **Eager Caching** - Cache on first resolution
2. **Smart Invalidation** - Only invalidate affected styles on theme change
3. **LRU Eviction** - Limit cache size with least-recently-used eviction
4. **Partial Updates** - Support updating specific properties without full re-resolution

### Optimization Techniques

1. **Memoization** - Memoize token resolution paths
2. **Batch Resolution** - Resolve multiple properties in single pass
3. **Lazy Evaluation** - Only resolve properties when accessed
4. **Pre-computation** - Pre-compute common token paths at theme load

### Performance Targets

- **Single Property Resolution:** < 1ms
- **Full Overlay Resolution:** < 5ms
- **Cache Hit:** < 0.1ms
- **Theme Switch:** < 50ms for all overlays

## Migration Guide

### For Renderer Authors

**Before (using BaseRenderer):**
```javascript
const color = this._resolveStyleProperty(
  overlay.style?.color,
  'colors.primary',
  resolveToken,
  '#FF9900',
  context
);
```

**After (using StyleResolverService):**
```javascript
const color = this._resolveStyleProperty(
  overlay.style?.color,
  'colors.primary',
  '#FF9900',
  context
);
// Same API! Integration handled by BaseRenderer
```

### For Direct Users

**Before (manual resolution):**
```javascript
let color = overlay.style?.color;
if (!color && resolveToken) {
  color = resolveToken('colors.primary', '#FF9900', context);
}
if (!color) {
  color = themeManager.getDefault('text', 'color', '#FF9900');
}
```

**After (using service):**
```javascript
const styleResolver = window.cblcars.styleResolver;
const result = styleResolver.resolveProperty({
  property: 'color',
  value: overlay.style?.color,
  tokenPath: 'colors.primary',
  defaultValue: '#FF9900',
  context: { overlayId: overlay.id, overlayType: overlay.type }
});
const color = result.value;
```

## Testing Strategy

### Unit Tests

- Token resolution with various path formats
- Fallback chain behavior
- Cache hit/miss scenarios
- Theme change invalidation
- Preset application and merging

### Integration Tests

- BaseRenderer integration
- Non-Base Renderer integration (TextOverlay, ApexCharts)
- Theme Manager integration
- Full overlay resolution pipeline
- Runtime theme switching
- Performance benchmarks

### Manual Testing

- Visual verification of resolved styles
- Theme switching in live dashboard
- Cache effectiveness monitoring
- Debug tool functionality

## Security Considerations

1. **Token Injection** - Validate token paths to prevent malicious traversal
2. **Cache Poisoning** - Validate cached values before use
3. **Resource Limits** - Limit cache size to prevent memory exhaustion
4. **Input Validation** - Validate all user-provided style values

## Future Enhancements

### Style Composition
Allow combining multiple style sources:
```javascript
style: {
  compose: ['base-button', 'primary-accent', 'large-size']
}
```

### Style Inheritance
Support parent-child style inheritance:
```javascript
{
  id: 'parent',
  style: { color: '#FF9900' },
  children: [
    { id: 'child', style: { inherit: ['color'] } }
  ]
}
```

### Style Animations
Animate style transitions:
```javascript
style: {
  color: {
    value: '#FF9900',
    transition: {
      duration: 500,
      easing: 'easeInOutQuad'
    }
  }
}
```

**Note:** Conditional styles are NOT included here as they are already handled by the RulesEngine. The RulesEngine determines *when* to change styles, while StyleResolverService determines *how* to resolve style values. This is a perfect separation of concerns.

## Related Documentation

- [Theme System Architecture](theme-system.md)
- [Phase 5: Provenance System](phase-5-provenance-system.md)
- [BaseRenderer API](../api/base-renderer.md)
- [Token Reference Guide](../reference/token-reference.md)
- [RulesEngine Documentation](rules-engine.md)