## Style Resolution System

### Overview

The **StyleResolverService** provides centralized style resolution with:
- Multi-tier resolution (explicit → token → theme → preset → fallback)
- Intelligent caching for performance
- Token reference resolution with nesting
- Computed token support (color manipulation)
- Provenance tracking for debugging
- Theme change notifications

### Architecture

```
┌─────────────────────────────────────────┐
│          PipelineCore                   │
│  ┌───────────────────────────────────┐ │
│  │    StyleResolverService           │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │     TokenResolver           │ │ │
│  │  │  ┌───────────────────────┐ │ │ │
│  │  │  │ ThemeTokenResolver    │ │ │ │
│  │  │  └───────────────────────┘ │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
               ↓
   ┌───────────┴───────────┐
   ↓                       ↓
BaseRenderer       ApexChartsOverlay
(auto-integrated)  (manual integration)
```

### Integration Points

- **PipelineCore**: Creates StyleResolverService during initialization
- **BaseRenderer**: Automatic integration via `this.styleResolver`
- **TextOverlayRenderer, ButtonRenderer, etc.**: Inherit from BaseRenderer
- **ApexChartsOverlayRenderer**: Manual integration (singleton pattern)
- **ApexChartsAdapter**: Maps resolved styles to ApexCharts options

### Resolution Chain

1. **Explicit Value**: Direct value from overlay config
2. **Token Resolution**: Resolve via ThemeTokenResolver
3. **Theme Default**: Component-specific defaults
4. **Preset Value**: From LCARS presets (if applied)
5. **System Fallback**: Hardcoded default

### Key Files

- `src/msd/styles/StyleResolverService.js` - Core service
- `src/msd/styles/TokenResolver.js` - Token resolution
- `src/msd/styles/CacheManager.js` - Intelligent caching
- `src/msd/styles/PresetManager.js` - Preset application
- `src/msd/styles/ProvenanceTracker.js` - Debug tracking
- `src/msd/renderer/BaseRenderer.js` - Auto integration
- `src/msd/renderer/ApexChartsOverlayRenderer.js` - Manual integration
- `src/msd/charts/ApexChartsAdapter.js` - Style mapping

### See Also

- [Style Resolution User Guide](../user/style-resolution.md)
- [Theme System Architecture](theme-system.md)
- [Token Reference](../reference/tokens.md)