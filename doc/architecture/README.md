# CB-LCARS Architecture Documentation# MSD Architecture Documentation Index



> **Central hub for all architecture documentation****Last Updated:** 2025-10-25

> Navigate the complete architecture of the CB-LCARS rendering system.**Version:** v2025.10.1-fuk.27-69



------



## 📋 Quick Navigation## 📚 Quick Navigation



### 🎯 Start Here### Core System Architecture

- **[Architecture Overview](overview.md)** - High-level system architecture, component relationships

- **[MSD Flow](MSD%20flow.md)** - Complete system data flow from configuration to rendering| Document | Purpose | When to Read |

|----------|---------|--------------|

### 🏗️ Core Subsystems (10 Complete)| [INCREMENTAL_UPDATE_SYSTEM.md](./INCREMENTAL_UPDATE_SYSTEM.md) | Complete guide to incremental overlay style updates | Implementing style-based updates for overlays |

| [overlay-implementation-guide.md](./overlay-implementation-guide.md) | Guide for implementing new overlay renderers | Creating new overlay types with DataSource support |

**Data Systems:**| [StyleResolution Architecture.md](./StyleResolution%20Architecture.md) | Style resolution and merging system | Understanding how styles flow through the system |

- **[DataSource System](subsystems/datasource-system.md)** - Entity data processing, transformations, aggregations (1,200 lines)| [BaseRenderer Architecture.md](./BaseRenderer%20Architecture.md) | Base renderer class and provenance tracking | Extending base renderer functionality |

- **[Template Processor](subsystems/template-processor.md)** - MSD & HA template detection, parsing, validation (900 lines)

- **[Rules Engine](subsystems/rules-engine.md)** - Conditional logic for dynamic styling (850 lines)### Overlay-Specific Features



**Rendering Systems:**| Document | Purpose | When to Read |

- **[Advanced Renderer](subsystems/advanced-renderer.md)** - Core rendering engine, overlay orchestration (1,200 lines)|----------|---------|--------------|

- **[Theme System](subsystems/theme-system.md)** - Token-based themes, component defaults (700 lines)| [OVERLAY_ATTACHMENT_IMPLEMENTATION.md](./OVERLAY_ATTACHMENT_IMPLEMENTATION.md) | Unified overlay attachment point system | Attaching lines to any overlay type |

- **[Style Resolver](subsystems/style-resolver.md)** - Centralized style resolution, token processing (930 lines)| [overlay_to_overlay_implementation.md](./overlay_to_overlay_implementation.md) | Overlay-to-overlay line connections | Creating lines between overlays |



**Support Systems:**### Configuration & Data Flow

- **[Validation System](subsystems/validation-system.md)** ⭐ **NEW** - Schema-based overlay validation (962 lines)

- **[Pack System](subsystems/pack-system.md)** ⭐ **NEW** - Pack structure, themes, presets (445 lines)| Document | Purpose | When to Read |

- **[Animation Registry](subsystems/animation-registry.md)** - Animation management, caching (850 lines)|----------|---------|--------------|

| [MSD Configuration Layering.md](./MSD%20Configuration%20Layering.md) | Configuration inheritance and merging | Understanding config resolution |

**Coordination:**| [MSD Pack Structure.md](./MSD%20Pack%20Structure.md) | MSD pack organization and loading | Creating reusable MSD packs |

- **[Systems Manager](subsystems/systems-manager.md)** - Central orchestrator, lifecycle management (650 lines)| [template-system-architecture.md](./template-system-architecture.md) | Template processing system | Working with dynamic content |



**📚 [Complete Subsystems Index](subsystems/README.md)** - Detailed subsystem descriptions with diagrams### Validation & Schema



---| Document | Purpose | When to Read |

|----------|---------|--------------|

## 🔧 Implementation Details| [validation_architecture.md](./validation_architecture.md) | Validation system architecture | Adding new validation rules |

| [MSD_SCHEMA_V1_Ratified.yaml](./MSD_SCHEMA_V1_Ratified.yaml) | Complete MSD YAML schema | Reference for YAML structure |

**Core Patterns:**

- **[Pipeline Architecture](implementation-details/pipeline-architecture.md)** - Initialization & rendering pipeline---

- **[Gap System](implementation-details/gap-system.md)** - LCARS gap calculations

- **[Incremental Update System](implementation-details/INCREMENTAL_UPDATE_SYSTEM.md)** - Efficient style updates (29KB)## 🎯 Common Tasks

- **[Style Update Mechanism](implementation-details/STYLE_UPDATE_MECHANISM.md)** - Style update flows (7.7KB)

- **[Overlay Attachment Implementation](implementation-details/OVERLAY_ATTACHMENT_IMPLEMENTATION.md)** - Attachment point logic (8.9KB)### "I want to create a new overlay type"



**[📁 All Implementation Details](implementation-details/)** - 13 detailed implementation documents**Read in this order:**

1. [overlay-implementation-guide.md](./overlay-implementation-guide.md) - Complete implementation guide

---2. [INCREMENTAL_UPDATE_SYSTEM.md](./INCREMENTAL_UPDATE_SYSTEM.md) - Optional: Add incremental style updates

3. [OVERLAY_ATTACHMENT_IMPLEMENTATION.md](./OVERLAY_ATTACHMENT_IMPLEMENTATION.md) - Optional: Support line attachments

## 📚 User Guides (Advanced)

### "I want to add incremental updates to an existing overlay"

**Configuration:**

- **[Configuration Layers](../user-guide/advanced/configuration-layers.md)** - Understanding configuration priority and layering**Read:**

- **[Style Priority](../user-guide/advanced/style-priority.md)** - How presets interact with explicit styles1. [INCREMENTAL_UPDATE_SYSTEM.md](./INCREMENTAL_UPDATE_SYSTEM.md) - Complete incremental update guide



**[📁 Complete User Guide](../user-guide/)** - Examples, tutorials, and reference**Key sections:**

- Renderer Interface (required methods)

---- Critical Bug Fixes (finalStyle merge)

- Implementing New Renderers (step-by-step)

## 📦 Archives

### "I want to understand how overlays update when entities change"

**Historical Documentation:**

- **[Phase 2-3 Migration](../archive/2025-10-phase2-3-migration/)** - Session notes from Phase 2-3 (19 files, Oct 2025)**Read in this order:**

- **[Fixes & Migrations](../archive/2025-10-fixes-and-migrations/)** - Bug fixes and migration notes (15 files)1. [overlay-implementation-guide.md](./overlay-implementation-guide.md) - DataSource integration section

- **[Architecture Consolidation](../archive/2025-10-architecture-consolidation/)** - Consolidated architecture docs (4 files)2. [INCREMENTAL_UPDATE_SYSTEM.md](./INCREMENTAL_UPDATE_SYSTEM.md) - Update flow section



---**Key concepts:**

- **Content updates** → BaseOverlayUpdater → Template processing

## 🎨 System Architecture Diagram- **Style updates** → SystemsManager → Incremental updates or selective re-render



```mermaid### "I want to attach lines to overlays"

graph TB

    subgraph "Home Assistant"**Read:**

        HA[HA Core]1. [OVERLAY_ATTACHMENT_IMPLEMENTATION.md](./OVERLAY_ATTACHMENT_IMPLEMENTATION.md) - Complete attachment system

        HASS[hass Object]2. [overlay_to_overlay_implementation.md](./overlay_to_overlay_implementation.md) - Overlay-to-overlay specifics

    end

---

    subgraph "CB-LCARS Pipeline"

        Config[User Config + Packs]## 📖 System Overview



        subgraph "Core Systems"### MSD Pipeline Flow

            SM[Systems Manager]

            DSM[DataSource Manager]```

            Theme[Theme System]User YAML Configuration

            Validate[Validation System]  ↓

        endValidation (schemas/)

  ↓

        subgraph "Processing"ModelBuilder (pipeline/ModelBuilder.js)

            TP[Template Processor]  ├─> Style Resolution

            RE[Rules Engine]  ├─> Template Detection

            SR[Style Resolver]  └─> finalStyle Creation

        end  ↓

AdvancedRenderer (renderer/AdvancedRenderer.js)

        subgraph "Rendering"  ├─> Delegates to Specialized Renderers

            AR[Advanced Renderer]  ├─> Builds SVG Markup

            ANIM[Animation Registry]  └─> Caches DOM Elements

            APM[Attachment Manager]  ↓

        endSystemsManager (pipeline/SystemsManager.js)

  ├─> Entity Change Listener

        subgraph "Overlays"  ├─> Rules Engine Evaluation

            Text[Text Overlay]  ├─> Incremental Update Orchestration

            Button[Button Overlay]  └─> Fallback to Selective Re-render

            Line[Line Overlay]  ↓

            Grid[Status Grid]BaseOverlayUpdater (BaseOverlayUpdater.js)

            Chart[ApexChart]  ├─> DataSource Change Detection

        end  ├─> Template Processing

    end  └─> Content Updates

```

    subgraph "Output"

        SVG[SVG Container]### Update Systems

        DOM[DOM Elements]

    end**Two parallel update systems:**



    HA --> HASS#### 1. Content Updates (BaseOverlayUpdater)

    HASS --> Config- **Trigger:** Entity state changes

    Config --> SM- **Detection:** Overlays with template placeholders (`{field.path}`)

    Config --> Validate- **Action:** Process templates with new entity data

    - **Update:** Change text content, not styles

    SM --> DSM- **Performance:** Very fast (DOM text update only)

    SM --> Theme

    SM --> AR#### 2. Style Updates (SystemsManager Incremental)

    - **Trigger:** Entity state changes + matching rules

    DSM --> TP- **Detection:** Rules engine produces style patches

    DSM --> RE- **Action:** Merge patches into `overlay.finalStyle`, call renderer

    - **Update:** Change colors, sizes, other style properties

    Theme --> SR- **Performance:** Fast (no full rebuild), smooth transitions

    - **Fallback:** Selective re-render if incremental not available

    TP --> AR

    RE --> SR### Renderer Capabilities

    SR --> AR

    | Overlay Type | Content Updates | Style Updates (Incremental) |

    AR --> ANIM|--------------|----------------|----------------------------|

    AR --> APM| StatusGrid | ✅ Via templates | ✅ Phase 1 Complete |

    AR --> Text| ApexCharts | ✅ Via templates | ✅ Phase 2 Complete |

    AR --> Button| Text | ✅ Via templates | ⏳ Phase 5 Pending |

    AR --> Line| Button | ✅ Via templates | ⏳ Phase 3 Pending |

    AR --> Grid| Line | ❌ N/A | ⏳ Phase 4 Pending |

    AR --> Chart| Sparkline | ✅ Via templates | ⏳ Future |

    | HistoryBar | ✅ Via templates | ⏳ Future |

    Text --> SVG

    Button --> SVG---

    Line --> SVG

    Grid --> DOM## 🔧 Implementation Status

    Chart --> DOM

### ✅ Complete Features

    style SM fill:#ff9900,stroke:#cc7700,stroke-width:3px

    style AR fill:#99ccff,stroke:#6699cc,stroke-width:2px- **StatusGrid Incremental Updates** - Cell-level and grid-level style updates

    style DSM fill:#99ccff,stroke:#6699cc,stroke-width:2px- **ApexCharts Incremental Updates** - Complete color API with CSS variable resolution

```- **Overlay Attachment System** - Lines can attach to any overlay type

- **Template Processing** - Dynamic content from DataSource entities

---- **Rules Engine Integration** - Style patches from entity state rules

- **Patch Merge System** - Critical fix for finalStyle updating

## 🚀 Data Flow

### ⏳ In Progress

**Initialization Flow:**

```- **Button Incremental Updates** - Phase 3 (recommended next)

User Config- **Line Incremental Updates** - Phase 4

  ↓- **Text Incremental Updates** - Phase 5

Pack Merging (builtin + external + user)

  ↓### 🎯 Future Enhancements

Validation System (schema validation)

  ↓- Batch incremental updates for multiple overlays

Theme System (initialize active theme)- Animation coordination with incremental updates

  ↓- Partial chart updates (series-level)

Systems Manager (initialize all subsystems)- Grid cell transition animations

  ↓

DataSource Manager (subscribe to entities)---

  ↓

Rules Engine (evaluate initial rules)## 🐛 Known Issues & Fixes

  ↓

Advanced Renderer (render SVG)### Fixed Issues

  ↓

Output (SVG + DOM)1. **finalStyle Not Updated During Incremental Updates** ✅

```   - **Problem:** finalStyle created once at page load, never updated

   - **Solution:** SystemsManager now merges patches into finalStyle

**Update Flow (Entity State Change):**   - **Impact:** All renderers receive correctly updated styles

```   - **See:** [INCREMENTAL_UPDATE_SYSTEM.md](./INCREMENTAL_UPDATE_SYSTEM.md#critical-bug-fixes)

HA Entity Change

  ↓2. **CSS Variables Not Resolved for ApexCharts** ✅

DataSource Manager (update buffer, apply transformations)   - **Problem:** Canvas-based rendering doesn't understand CSS vars

  ↓   - **Solution:** Recursive CSS variable resolver in ApexChartsAdapter

Template Processor (detect affected templates)   - **Impact:** Theme colors work correctly in charts

  ↓   - **See:** [INCREMENTAL_UPDATE_SYSTEM.md](./INCREMENTAL_UPDATE_SYSTEM.md#bug-2-css-variables-not-resolved-for-apexcharts)

Rules Engine (re-evaluate dirty rules)

  ↓---

Style Resolver (resolve new styles)

  ↓## 📝 Contributing

Advanced Renderer (incremental update)

  ↓### Adding New Documentation

DOM Update (only changed elements)

```When adding new architecture documentation:



---1. **Create document in `doc/architecture/`**

2. **Use clear naming:** `{FEATURE}_ARCHITECTURE.md` or `{feature}-guide.md`

## 🔍 Component Relationships3. **Include header with:**

   - Last Updated date

### Core Dependencies   - Version number

   - Purpose/scope

```4. **Add entry to this README.md**

Systems Manager (orchestrator)5. **Link from related documents**

  ├── DataSource Manager (data hub)

  │   ├── Template Processor (template detection)### Documentation Standards

  │   └── Rules Engine (conditional logic)

  ├── Theme System (token-based defaults)- **Use emoji markers** for status: ✅ Complete, ⏳ In Progress, ❌ Blocked

  │   └── Style Resolver (style resolution)- **Include code examples** with syntax highlighting

  ├── Validation System (schema validation)- **Add troubleshooting sections** for common issues

  ├── Pack System (configuration composition)- **Link to related documents** for context

  └── Advanced Renderer (rendering engine)- **Keep table of contents** updated for long documents

      ├── Animation Registry (animation caching)

      ├── Attachment Manager (attachment points)---

      └── Specialized Renderers (overlay types)

```## 🔗 Related Resources



### Data Flow Patterns### External Documentation

- [Home Assistant Developer Docs](https://developers.home-assistant.io/)

**Pattern 1: Configuration → Rendering**- [ApexCharts Documentation](https://apexcharts.com/docs/)

```- [SVG Specification](https://www.w3.org/TR/SVG/)

Config → Validation → Theme → Systems Manager → Renderer → Output

```### Internal Resources

- `examples/` - Example MSD configurations

**Pattern 2: Entity → Data → Visual Update**- `msd/` - Technical implementation notes

```- `proposals/` - Proposed features and designs

Entity State → DataSource → Template/Rules → Style Resolver → Incremental Update

```---



**Pattern 3: User Action → System Response**## 📊 Quick Reference

```

Button Click → Action Handler → Service Call → Entity State → (Pattern 2)### File Locations

```

```

---src/

├── msd/

## 📊 Documentation Metrics│   ├── pipeline/

│   │   ├── SystemsManager.js      # Incremental update orchestration

| Category | Files | Total Lines | Status |│   │   └── ModelBuilder.js        # Initial model building

|----------|-------|-------------|--------|│   ├── renderer/

| **Subsystems** | 10 | ~8,500 | ✅ Complete |│   │   ├── AdvancedRenderer.js    # Rendering orchestration

| **Implementation Details** | 13 | ~2,800 | ✅ Complete |│   │   ├── StatusGridRenderer.js  # StatusGrid with incremental updates

| **User Guides (Advanced)** | 2 | ~520 | ✅ Complete |│   │   ├── ApexChartsOverlayRenderer.js  # ApexCharts with incremental updates

| **Archives** | 38 | ~9,000+ | 📦 Archived |│   │   ├── TextOverlayRenderer.js

| **Total Active Docs** | 27 | ~11,820 | ✅ Current |│   │   └── LineOverlayRenderer.js

│   ├── charts/

---│   │   └── ApexChartsAdapter.js   # CSS variable resolution

│   ├── validation/

## 🎯 Finding What You Need│   │   └── schemas/               # Validation schemas

│   └── BaseOverlayUpdater.js      # Content update system

### "I want to understand..."```



- **How data flows** → [Architecture Overview](overview.md), [MSD Flow](MSD%20flow.md)### Key Classes & Methods

- **How rendering works** → [Advanced Renderer](subsystems/advanced-renderer.md)

- **How themes work** → [Theme System](subsystems/theme-system.md)**SystemsManager:**

- **How validation works** → [Validation System](subsystems/validation-system.md)- `_overlayRenderers` - Renderer registry Map

- **How to create packs** → [Pack System](subsystems/pack-system.md)- `_applyIncrementalUpdates()` - Orchestrate incremental updates

- **Configuration priority** → [Configuration Layers](../user-guide/advanced/configuration-layers.md)- `_findOverlayById()` - Lookup overlay config

- **Style resolution order** → [Style Priority](../user-guide/advanced/style-priority.md)- `_findOverlayElement()` - Lookup DOM element



### "I need to implement..."**Renderer Interface:**

- `static render()` - Initial markup generation

- **New overlay type** → [Advanced Renderer - Implementation Patterns](subsystems/advanced-renderer.md#implementation-patterns)- `static supportsIncrementalUpdate()` - Declare capability

- **New data transformation** → [DataSource System](subsystems/datasource-system.md)- `static updateIncremental()` - Perform style update

- **New rule condition** → [Rules Engine](subsystems/rules-engine.md)- `static update{Type}Data()` - Perform content update

- **New animation** → [Animation Registry](subsystems/animation-registry.md)

- **New theme** → [Theme System](subsystems/theme-system.md)**BaseOverlayUpdater:**

- `_registerUpdaters()` - Register overlay types

### "I'm debugging..."- `_hasTemplateContent()` - Detect templates

- `updateOverlaysForDataSourceChanges()` - Trigger content updates

- **Rendering issues** → [Advanced Renderer - Debugging](subsystems/advanced-renderer.md#debugging)

- **Data not updating** → [DataSource System - Debugging](subsystems/datasource-system.md#debugging)---

- **Template errors** → [Template Processor - Debugging](subsystems/template-processor.md#debugging)

- **Style not applying** → [Style Resolver - Debugging](subsystems/style-resolver.md#debugging)**Index Version:** 1.0

- **Rules not working** → [Rules Engine - Debugging](subsystems/rules-engine.md#debugging)**Last Updated:** 2025-10-25

**Maintainer:** CB-LCARS Team

---

## 📝 Documentation Standards

All architecture documentation follows these standards:

✅ **Comprehensive** - Complete coverage of subsystem functionality
✅ **Examples** - Real-world usage examples with code
✅ **Diagrams** - Mermaid diagrams for architecture and flow
✅ **API Reference** - Complete method signatures and parameters
✅ **Debugging** - Debug access and troubleshooting guidance
✅ **Cross-references** - Links to related documentation

---

## 🔄 Recent Updates

**October 26, 2025 - Architecture Consolidation**
- ✅ Added 2 new subsystem docs (Validation System, Pack System)
- ✅ Enhanced 4 existing subsystems with consolidated content
- ✅ Moved 2 docs to user guide (Configuration Layers, Style Priority)
- ✅ Archived 38 historical files with comprehensive READMEs
- ✅ Created this central architecture hub

**Key Improvements:**
- 10 complete subsystem docs (up from 8)
- Eliminated duplication across architecture docs
- Better organization (user guides separate from architecture)
- Comprehensive navigation and search guidance
- Complete cross-referencing between related docs

---

## 🎓 Learning Path

**Beginner (Understanding the System):**
1. [Architecture Overview](overview.md) - Start here
2. [MSD Flow](MSD%20flow.md) - See the complete picture
3. [DataSource System](subsystems/datasource-system.md) - Understand the data hub
4. [Advanced Renderer](subsystems/advanced-renderer.md) - See how rendering works

**Intermediate (Configuration & Customization):**
1. [Theme System](subsystems/theme-system.md) - Theming and styling
2. [Pack System](subsystems/pack-system.md) - Creating packs
3. [Configuration Layers](../user-guide/advanced/configuration-layers.md) - Config priority
4. [Template Processor](subsystems/template-processor.md) - Dynamic content

**Advanced (Implementation & Extension):**
1. [Advanced Renderer - Implementation Patterns](subsystems/advanced-renderer.md#implementation-patterns) - Create overlays
2. [Rules Engine](subsystems/rules-engine.md) - Conditional logic
3. [Validation System](subsystems/validation-system.md) - Schema validation
4. [Style Resolver](subsystems/style-resolver.md) - Style resolution

---

## 📞 Getting Help

- **General Questions** → Check [Architecture Overview](overview.md) and [User Guide](../user-guide/)
- **Implementation Questions** → See [Subsystems](subsystems/) and [Implementation Details](implementation-details/)
- **Debugging** → Each subsystem has a dedicated Debugging section
- **Contributing** → See [Contributing Guide](../contributing/)

---

**Last Updated:** October 26, 2025
**Architecture Version:** 2025.10.1-fuk.42-69
**Total Documentation:** 27 active files, 11,820+ lines
**Subsystems Documented:** 10 of 12 complete (83%)
