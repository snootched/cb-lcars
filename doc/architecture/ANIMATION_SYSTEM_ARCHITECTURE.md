# Animation System Architecture Diagram

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                     CB-LCARS MSD Animation System                ┃
┃                           Phase 1 Complete                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─────────────────────────────────────────────────────────────────┐
│                         User Interfaces                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   YAML Config    │              │   Runtime API    │        │
│  │                  │              │                  │        │
│  │  overlays:       │              │  animate()       │        │
│  │    my_overlay:   │              │  stopAnimation() │        │
│  │      animations: │              │  pauseAnimation()│        │
│  │        - preset  │              │  resumeAnimation()        │
│  │        - trigger │              │                  │        │
│  └──────────────────┘              └──────────────────┘        │
│           │                                  │                  │
│           │                                  │                  │
│           ▼                                  ▼                  │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │ Config Processor │              │   Debug API      │        │
│  │                  │              │                  │        │
│  │  - Parse YAML    │              │  active()        │        │
│  │  - Validate      │              │  dump()          │        │
│  │  - Extract       │              │  registryStats() │        │
│  │  - Report errors │              │  inspect()       │        │
│  └──────────────────┘              │  trigger()       │        │
│           │                         └──────────────────┘        │
└───────────┼─────────────────────────────────┼──────────────────┘
            │                                 │
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Animation Manager                          │
│                    (Central Orchestrator)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Scope Management                     │    │
│  │                                                         │    │
│  │  scopes: Map {                                         │    │
│  │    'overlay_1' => {                                    │    │
│  │      scope: anime.js scope,                            │    │
│  │      element: HTMLElement,                             │    │
│  │      config: overlayConfig,                            │    │
│  │      triggerManager: TriggerManager                    │    │
│  │    }                                                   │    │
│  │  }                                                     │    │
│  └────────────────────────────────────────────────────────┘    │
│           │                                                     │
│           ├──► createScopeForOverlay(overlayId)                │
│           ├──► destroyOverlayScope(overlayId)                  │
│           └──► playAnimation(overlayId, animDef)               │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Custom Presets                        │    │
│  │                                                         │    │
│  │  customPresets: {                                      │    │
│  │    'my_pulse': {                                       │    │
│  │      type: 'pulse',                                    │    │
│  │      duration: 800,                                    │    │
│  │      color: 'var(--lcars-orange)'                      │    │
│  │    }                                                   │    │
│  │  }                                                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │                                 │
            ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────┐
│   Trigger Manager    │          │  Animation Registry  │
│   (Per Overlay)      │          │   (Semantic Cache)   │
├──────────────────────┤          ├──────────────────────┤
│                      │          │                      │
│  ┌────────────────┐  │          │  ┌────────────────┐  │
│  │   on_load      │  │          │  │  Cached Anims  │  │
│  │  (auto-play)   │  │          │  │                │  │
│  └────────────────┘  │          │  │  LRU Eviction  │  │
│                      │          │  │  Max 50 items  │  │
│  ┌────────────────┐  │          │  │                │  │
│  │   on_tap       │  │          │  │  Hit Rate >90% │  │
│  │  (click/tap)   │  │          │  │                │  │
│  └────────────────┘  │          │  │  Semantic Hash │  │
│                      │          │  │  Target Check  │  │
│  ┌────────────────┐  │          │  │  Perf Tracking │  │
│  │   on_hover     │  │          │  │                │  │
│  │  (desktop)     │  │          │  └────────────────┘  │
│  └────────────────┘  │          │                      │
│                      │          └──────────────────────┘
│  ┌────────────────┐  │                    │
│  │   on_hold      │  │                    │
│  │  (500ms)       │  │                    │
│  └────────────────┘  │                    │
│                      │                    │
│  ┌────────────────┐  │                    ▼
│  │ on_datasource  │  │          ┌──────────────────────┐
│  │  (Phase 2)     │  │          │    anime.js v4       │
│  └────────────────┘  │          │   (window.cblcars    │
│                      │          │       .anim)         │
└──────────────────────┘          │                      │
            │                     │  - createScope()     │
            │                     │  - presets (13)      │
            ▼                     │  - timeline()        │
┌──────────────────────┐          │  - set()             │
│   DOM Elements       │          │  - remove()          │
│                      │          │  - pause()           │
│  - addEventListener  │◄─────────┤  - play()            │
│  - removeEventListener          │                      │
│  - cursor: pointer   │          └──────────────────────┘
│                      │
└──────────────────────┘


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    SystemsManager Integration                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Phase 1: ThemeManager
  └─► CSS variables ready

Phase 2: DataSourceManager
  └─► Entity subscriptions ready (Phase 2 hookup)

Phase 3: Processing Systems
  └─► Merge pipeline complete

Phase 4: RenderPipeline
  └─► onOverlayRendered() hook
       │
       ▼
Phase 5: Animation Systems  ◄─── PHASE 1 IMPLEMENTATION
  ├─► AnimationRegistry (existing, preserved)
  │    └─► Semantic caching, LRU eviction
  │
  └─► AnimationManager (NEW)
       ├─► AnimationConfigProcessor (NEW)
       │    └─► Parse YAML, validate, extract
       │
       ├─► TriggerManager (NEW)
       │    └─► Event listeners per overlay
       │
       └─► Scope Management
            └─► anime.js scopes per overlay

Phase 6: Support Systems
  └─► Logging, debug, utilities

Phase 7: Lifecycle & Completion
  └─► Animation system ready


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                         Data Flow                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

1. YAML Config
   ↓
2. AnimationConfigProcessor.processAnimationConfig()
   ↓
3. Extract: customPresets, overlayAnimations, timelines
   ↓
4. AnimationManager.initialize(overlays, { customPresets, timelines })
   ↓
5. RenderPipeline renders overlay
   ↓
6. AnimationManager.onOverlayRendered(overlayId, element, overlayConfig)
   ↓
7. createScopeForOverlay()
   │  ├─► Create anime.js scope
   │  ├─► Store in scopes Map
   │  └─► Create TriggerManager
   ↓
8. TriggerManager.register(trigger, animDef) for each animation
   │  ├─► on_load: playAnimation() immediately
   │  ├─► on_tap: addEventListener('click')
   │  ├─► on_hover: addEventListener('mouseenter/mouseleave')
   │  └─► on_hold: addEventListener('mousedown/touchstart', 500ms timer)
   ↓
9. User interaction OR on_load
   ↓
10. AnimationManager.playAnimation(overlayId, animDef)
    │  ├─► Resolve preset (custom or built-in)
    │  ├─► Check AnimationRegistry cache
    │  ├─► Execute animation via scope
    │  └─► Return animation instance
    ↓
11. anime.js executes animation on DOM element


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                      API Usage Examples                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Runtime API (window.cblcars.msd):
  ├─► animate('overlay_id', 'pulse', { duration: 500 })
  ├─► stopAnimation('overlay_id')
  ├─► pauseAnimation('overlay_id')
  └─► resumeAnimation('overlay_id')

Debug API (window.cblcars.debug.msd.animations):
  ├─► active() → Array of running animations
  ├─► dump() → { customPresets, overlayAnimations, timelines }
  ├─► registryStats() → { size, hits, misses, hitRate }
  ├─► inspect('overlay_id') → { scope, element, triggers, ... }
  ├─► timeline('timeline_id') → Timeline config
  └─► trigger('overlay_id', 'pulse', { ... }) → Manual test


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                   Phase 1 Status: COMPLETE ✅                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Components Delivered:
  ✅ AnimationManager (559 lines)
  ✅ TriggerManager (247 lines)
  ✅ AnimationConfigProcessor (388 lines)
  ✅ SystemsManager integration
  ✅ Runtime API (4 methods)
  ✅ Debug API (6 methods)
  ✅ Test configuration
  ✅ Validation script (51 checks passed)
  ✅ Comprehensive documentation

Next: Phase 2 - DataSource Integration
  - on_datasource trigger implementation
  - Entity state conditions
  - RulesEngine integration
  - Template parameter resolution
```
