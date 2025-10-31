# CB-LCARS Unified API - Visual Reference

## 🌳 Complete API Tree

```
window.cblcars
│
├── msd                                    [Runtime API - User-facing]
│   ├── getInstance(cardId)                → Get specific instance
│   ├── getCurrentInstance()               → Get current instance
│   ├── getAllInstances()                  → List all instances
│   │
│   ├── getState(cardId)                   → Get card state
│   ├── getConfig(cardId)                  → Get configuration
│   ├── validate(cardId)                   → Validate config
│   │
│   ├── theme                              → Theme management
│   │   ├── apply(cardId, themeName)       → Switch theme
│   │   ├── getCurrent(cardId)             → Get active theme
│   │   └── list()                         → Available themes
│   │
│   ├── overlays                           → Overlay operations
│   │   ├── list(cardId)                   → List overlays
│   │   ├── show(cardId, overlayId)        → Show overlay
│   │   ├── hide(cardId, overlayId)        → Hide overlay
│   │   └── highlight(cardId, overlayId)   → Highlight overlay
│   │
│   ├── trigger(cardId, actionId, params)  → Trigger action
│   └── animate(cardId, animationId)       → Play animation
│
├── debug                                  [Debug Namespace]
│   │
│   ├── msd                                [MSD Debug API - Developer-facing]
│   │   │
│   │   ├── current                        → Shorthand for current instance
│   │   │
│   │   ├── enable(feature, cardId)        → Enable debug feature
│   │   ├── disable(feature, cardId)       → Disable debug feature
│   │   ├── toggle(feature, cardId)        → Toggle debug feature
│   │   ├── status(cardId)                 → Get debug status
│   │   │
│   │   ├── perf                           → Performance analysis
│   │   │   ├── summary(cardId)            → Full perf summary
│   │   │   ├── slowestOverlays(cardId, n) → Find bottlenecks
│   │   │   ├── byRenderer(cardId)         → Perf by renderer type
│   │   │   ├── byOverlay(cardId, ovId)    → Single overlay metrics
│   │   │   ├── warnings(cardId)           → Slow overlay alerts
│   │   │   ├── timeline(cardId)           → Stage timing
│   │   │   └── compare(cardId)            → Compare renderers
│   │   │
│   │   ├── styles                         → Style introspection
│   │   │   ├── resolutions(cardId, ovId)  → Style resolution chain
│   │   │   ├── findByToken(cardId, path)  → Find token usage
│   │   │   ├── provenance(cardId, ovId)   → Full provenance
│   │   │   ├── listTokens(cardId)         → All tokens
│   │   │   └── getTokenValue(cardId, path)→ Resolve token
│   │   │
│   │   ├── data                           → Data source introspection
│   │   │   ├── stats(cardId)              → Data source stats
│   │   │   ├── list(cardId)               → List sources
│   │   │   ├── get(cardId, sourceName)    → Source details
│   │   │   ├── dump(cardId)               → Full data dump
│   │   │   ├── trace(cardId, entityId)    → Trace updates
│   │   │   └── history(cardId, entId, n)  → Value history
│   │   │
│   │   ├── routing                        → Routing system
│   │   │   ├── inspect(cardId, ovId)      → Inspect route
│   │   │   ├── stats(cardId)              → Routing stats
│   │   │   ├── invalidate(cardId, id)     → Clear cache
│   │   │   ├── inspectAs(cardId, id, mode)→ Test modes
│   │   │   └── visualize(cardId, ovId)    → Show visually
│   │   │
│   │   ├── rules                          → Rules engine
│   │   │   ├── trace(cardId)              → Rule execution trace
│   │   │   ├── evaluate(cardId, ruleId)   → Test single rule
│   │   │   ├── listActive(cardId)         → Active rules
│   │   │   └── debugRule(cardId, id, st)  → Dry-run rule
│   │   │
│   │   ├── charts                         → Chart validation
│   │   │   ├── validate(cardId, ovId)     → Validate chart
│   │   │   ├── validateAll(cardId)        → Validate all
│   │   │   ├── getFormatSpec(chartType)   → Format spec
│   │   │   └── listTypes()                → Available types
│   │   │
│   │   ├── animations                     → Animation debugging
│   │   │   ├── active(cardId)             → Currently playing
│   │   │   ├── dump(cardId)               → All animations
│   │   │   ├── timeline(cardId, id)       → Inspect timeline
│   │   │   └── trigger(cardId, animId)    → Manual trigger
│   │   │
│   │   ├── packs                          → Config packs
│   │   │   ├── list(cardId, type)         → List packs
│   │   │   ├── get(cardId, type, id)      → Get pack
│   │   │   ├── issues(cardId)             → Resolution issues
│   │   │   └── order(cardId)              → Merge order
│   │   │
│   │   ├── overlays                       → Overlay introspection
│   │   │   ├── list(cardId, filters)      → Advanced listing
│   │   │   ├── getBBox(cardId, ovId)      → Bounding box
│   │   │   ├── getAttachments(cardId, id) → Attachment points
│   │   │   ├── getRenderer(cardId, ovId)  → Which renderer
│   │   │   └── dumpConfig(cardId, ovId)   → Full config
│   │   │
│   │   ├── pipeline                       → Pipeline introspection
│   │   │   ├── getModel(cardId)           → Resolved model
│   │   │   ├── getStage(cardId, stage)    → Stage output
│   │   │   ├── reRun(cardId, fromStage)   → Re-run from stage
│   │   │   └── validate(cardId)           → Validate pipeline
│   │   │
│   │   └── hud                            → HUD control (future)
│   │       ├── show(cardId)               → Show HUD
│   │       ├── hide(cardId)               → Hide HUD
│   │       ├── toggle(cardId)             → Toggle HUD
│   │       └── state(cardId)              → HUD state
│   │
│   ├── history                            [CLI History]
│   │   ├── add(command)                   → Add to history
│   │   ├── previous()                     → Navigate up
│   │   ├── next()                         → Navigate down
│   │   ├── list(n)                        → Show history
│   │   └── clear()                        → Clear history
│   │
│   ├── complete                           [CLI Autocomplete]
│   │   ├── suggest(partial)               → Show suggestions
│   │   └── complete(partial)              → Auto-complete
│   │
│   └── cli                                [Interactive CLI]
│       ├── $()                            → Enter CLI mode
│       ├── help(category)                 → Show help
│       └── exec(path, ...args)            → Execute method
│
├── anim                                   [Animation API]
│   │
│   ├── animejs                            → Full AnimeJS module
│   ├── anime                              → anime.animate shortcut
│   ├── utils                              → anime.utils (canonical)
│   │
│   ├── animateElement(...)                → Element animation helper
│   ├── animateWithRoot(...)               → Root-scoped animation
│   ├── waitForElement(...)                → Wait for element
│   │
│   ├── svg                                → SVG helpers
│   │   └── (various SVG utilities)
│   │
│   ├── anchors                            → Anchor helpers
│   │   ├── findSvgAnchors(...)
│   │   ├── getSvgContent(...)
│   │   ├── getSvgViewBox(...)
│   │   └── getSvgAspectRatio(...)
│   │
│   ├── presets                            → LCARS animation presets
│   │   ├── buttonPress(target, opts)
│   │   ├── buttonRelease(target, opts)
│   │   ├── blinkIndicator(target, opts)
│   │   ├── slideIn(target, opts)
│   │   ├── slideOut(target, opts)
│   │   ├── fadeIn(target, opts)
│   │   ├── fadeOut(target, opts)
│   │   ├── countUp(target, from, to)
│   │   ├── warningFlash(target, opts)
│   │   └── (more presets...)
│   │
│   ├── scopes                             → Scope management
│   ├── createScope(root)                  → Create animation scope
│   ├── getScope(root)                     → Get scope
│   │
│   └── msd                                → MSD integration (future)
│       ├── animateOverlay(...)
│       └── playTimeline(...)
│
└── dev                                    [Dev API - Internal tools]
    │
    ├── flags                              → Feature flags
    │   ├── list()
    │   ├── get(name)
    │   ├── set(name, value)
    │   └── reset()
    │
    ├── inspect                            → Internal inspection
    │   ├── systemsManager()
    │   ├── modelBuilder()
    │   └── debugManager()
    │
    └── test                               → Test utilities
        ├── mockHass(entities)
        ├── mockEntity(id, state, attrs)
        └── simulateUpdate(entityId, state)
```

---

## 🎨 API Tier Legend

| Tier | Namespace | Purpose | Audience |
|------|-----------|---------|----------|
| **Runtime** | `window.cblcars.msd` | User-facing stable API | Dashboard builders, automations |
| **Debug** | `window.cblcars.debug.msd` | Developer introspection | Developers, theme creators |
| **Animation** | `window.cblcars.anim` | Animation system | All users (3rd party libs) |
| **Dev** | `window.cblcars.dev` | Internal tools | Core developers only |

---

## 📋 Quick Reference by Use Case

### "I want to list all overlays"
```javascript
// User-facing (Runtime)
window.cblcars.msd.overlays.list()

// Developer debug (Debug)
window.cblcars.debug.msd.overlays.list(cardId, { filters: { type: 'button' } })
```

### "I want to check performance"
```javascript
// Full summary
window.cblcars.debug.msd.perf.summary()

// Find slow overlays
window.cblcars.debug.msd.perf.slowestOverlays(5)

// Compare renderers
window.cblcars.debug.msd.perf.compare()
```

### "I want to debug styles"
```javascript
// How was this style resolved?
window.cblcars.debug.msd.styles.resolutions(cardId, 'overlay-1')

// Where is this token used?
window.cblcars.debug.msd.styles.findByToken(cardId, 'colors.accent.primary')

// Full provenance chain
window.cblcars.debug.msd.styles.provenance(cardId, 'overlay-1')
```

### "I want to animate something"
```javascript
// Use preset
window.cblcars.anim.presets.buttonPress(element, { duration: 300 })

// Use AnimeJS directly
window.cblcars.anime(element, {
  translateX: 250,
  duration: 1000
})

// Use helper
window.cblcars.anim.animateElement(cardElement, options, hass)
```

### "I want to use the CLI"
```javascript
// Enter interactive mode
window.cblcars.debug.cli.$()

// Show help
window.cblcars.debug.cli.help()
window.cblcars.debug.cli.help('perf')

// Autocomplete
window.cblcars.debug.complete.suggest('perf.')

// History
window.cblcars.debug.history.list(10)
```

---

## 🔄 Method Argument Patterns

### Optional cardId Parameter
```javascript
// All Runtime API methods accept optional cardId
// Single-instance (Phase 0): cardId ignored, uses current
// Multi-instance (Phase X): cardId selects specific instance

window.cblcars.msd.overlays.list()        // Current instance
window.cblcars.msd.overlays.list(cardId)  // Specific instance (future)
```

### Flexible Arguments
```javascript
// Overlays support multiple call patterns:

// Full: cardId + overlayId + duration
window.cblcars.msd.overlays.highlight(cardId, overlayId, 2000)

// Without cardId: overlayId + duration
window.cblcars.msd.overlays.highlight(overlayId, 2000)

// Minimal: just overlayId
window.cblcars.msd.overlays.highlight(overlayId)
```

### Return Patterns
```javascript
// Success: Return data directly
const overlays = window.cblcars.msd.overlays.list()
// → [{ id: 'ov1', type: 'button', ... }]

// Not found: Return null or empty
const state = window.cblcars.msd.getState('invalid')
// → null

// Error: Return error object
const result = window.cblcars.msd.validate('invalid')
// → { success: false, error: { code: 'MSD_INSTANCE_NOT_FOUND', ... } }
```

---

## 🎯 Features by Phase

### Phase 0 (Week 1) ✅
- Runtime API fully implemented
- Instance management (single-instance)
- State & configuration access
- Overlay operations (list, highlight)
- Theme management
- Validation

### Phase 1 (Week 2) 🔄
- Debug API core
- Performance analysis
- Routing introspection
- Data source debugging
- Style introspection
- Chart validation

### Phase 2 (Week 3) 🔄
- Visual debug controls
- CLI features (history, autocomplete)
- Interactive help system
- Overlay introspection
- Pipeline debugging

### Phase 3 (Week 4) 🔄
- Old API removal
- Animation API finalization
- Dev API (minimal)
- Complete documentation

---

## 💡 Pro Tips

### 1. Use the CLI for Discovery
```javascript
window.cblcars.debug.cli.$()  // Start CLI
help()                         // See categories
help('perf')                   // See performance methods
```

### 2. Autocomplete is Your Friend
```javascript
window.cblcars.debug.complete.suggest('perf.')
// Shows: perf.summary, perf.slowestOverlays, perf.byRenderer, ...
```

### 3. Chain Debug Methods
```javascript
// Find slow overlays, then inspect details
const slow = window.cblcars.debug.msd.perf.slowestOverlays(3)
slow.forEach(ov => {
  console.log(ov.id, window.cblcars.debug.msd.overlays.getBBox(null, ov.id))
})
```

### 4. Use Debug Current Shorthand
```javascript
// Instead of:
window.cblcars.debug.msd.perf.summary(null)

// Use:
window.cblcars.debug.msd.current.perf.summary()
```

---

## 📚 Documentation Links

- **Implementation Plan:** `API_STANDARDIZATION_IMPLEMENTATION_PLAN.md`
- **Key Changes:** `API_STANDARDIZATION_CHANGES_FROM_ORIGINAL.md`
- **Quick Start:** `API_STANDARDIZATION_PHASE0_QUICKSTART.md`
- **Review Summary:** `API_STANDARDIZATION_REVIEW_SUMMARY.md`
- **This Reference:** `API_STANDARDIZATION_VISUAL_REFERENCE.md`

---

*API Structure Reference - Phase 0*
*Last updated: 2025-10-28*
